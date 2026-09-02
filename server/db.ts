import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ServerStore {
  exams: any[];
  students: Record<string, any>;
  history: any[];
  classes: string[];
  lastUpdated: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const STORE_FILE = path.join(DATA_DIR, 'server_store.json');
const WAL_FILE = path.join(DATA_DIR, 'submissions_wal.log');
const MAX_ROTATING_BACKUPS = 5;

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// In-Memory State
let inMemoryStore: ServerStore = {
  exams: [],
  students: {},
  history: [],
  classes: ['Tất cả', '12A1', '12A2', '12A3', '11B1', '10C1'],
  lastUpdated: Date.now(),
};

/**
 * Sequential Transaction Queue
 * Guarantees serial execution of all write/mutation operations
 * to prevent race conditions and concurrent overwrite hazards.
 */
class SequentialQueue {
  private queue: Promise<any> = Promise.resolve();

  public async run<T>(task: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          try {
            const result = await task();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        })
        .catch((err) => {
          // Catch unexpected errors so subsequent queued tasks continue uninterrupted
          console.error('[SequentialQueue] Unexpected task failure:', err);
        });
    });
  }
}

const writeQueue = new SequentialQueue();

/**
 * Normalizes, repairs, and sanitizes a raw store object into a guaranteed valid ServerStore structure
 */
function normalizeStore(rawObj: any): ServerStore {
  const defaultClasses = ['Tất cả', '12A1', '12A2', '12A3', '11B1', '10C1'];
  const store: ServerStore = {
    exams: [],
    students: {},
    history: [],
    classes: defaultClasses,
    lastUpdated: Date.now(),
  };

  if (!rawObj || typeof rawObj !== 'object') {
    return store;
  }

  // 1. Separate exams and misplaced submissions
  const rawExams = Array.isArray(rawObj.exams) ? rawObj.exams : [];
  const rawHistory = Array.isArray(rawObj.history) ? rawObj.history : [];

  const allEntries = [...rawExams, ...rawHistory];
  const seenExamIds = new Set<string>();
  const seenSubIds = new Set<string>();

  for (const item of allEntries) {
    if (!item || typeof item !== 'object') continue;

    // Detect if this is a submission
    const isSubmission =
      (typeof item.id === 'string' && item.id.startsWith('sub_')) ||
      item.submitted_at !== undefined ||
      item.score !== undefined;

    if (isSubmission) {
      const subId = item.id || `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      if (!seenSubIds.has(subId)) {
        seenSubIds.add(subId);
        store.history.push({
          ...item,
          id: subId,
        });
      }
    } else {
      // It is an exam
      const examId = item.id || `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      if (!seenExamIds.has(examId)) {
        seenExamIds.add(examId);
        store.exams.push({
          ...item,
          id: examId,
        });
      }
    }
  }

  // 2. Parse Students
  if (rawObj.students && typeof rawObj.students === 'object' && !Array.isArray(rawObj.students)) {
    store.students = { ...rawObj.students };
  }

  // Automatically restore or ensure students from history if missing
  store.history.forEach((h: any) => {
    if (h && h.username && h.username !== 'guest') {
      const u = String(h.username).trim();
      const lower = u.toLowerCase();
      if (!store.students[u] && !store.students[lower]) {
        store.students[lower] = {
          username: u,
          name: h.name || u,
          group: h.group || 'Chưa phân lớp',
          password: '',
        };
      }
    }
  });

  // 3. Parse Classes
  const classSet = new Set<string>(defaultClasses);
  if (Array.isArray(rawObj.classes)) {
    rawObj.classes.forEach((c: any) => {
      if (typeof c === 'string' && c.trim()) classSet.add(c.trim());
    });
  }
  store.exams.forEach((ex) => {
    const tg = ex.questions?.target_group;
    if (tg && typeof tg === 'string') {
      tg.split(',').forEach((g) => {
        const clean = g.trim();
        if (clean && clean.toLowerCase() !== 'tất cả') classSet.add(clean);
      });
    }
  });
  Object.values(store.students).forEach((s: any) => {
    if (s?.group && typeof s.group === 'string' && s.group.trim()) {
      classSet.add(s.group.trim());
    }
  });

  store.classes = Array.from(classSet);
  store.lastUpdated = typeof rawObj.lastUpdated === 'number' ? rawObj.lastUpdated : Date.now();

  return store;
}

/**
 * Validates whether a store object has valid JSON structure
 */
function isValidStore(obj: any): obj is ServerStore {
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.exams) &&
    typeof obj.students === 'object' &&
    Array.isArray(obj.history) &&
    Array.isArray(obj.classes)
  );
}

/**
 * Rotating Backup Manager
 */
function rotateBackups() {
  try {
    if (!fs.existsSync(STORE_FILE)) return;

    // Shift backups: backup.4 -> backup.5, ..., backup.1 -> backup.2
    for (let i = MAX_ROTATING_BACKUPS - 1; i >= 1; i--) {
      const src = path.join(DATA_DIR, `server_store.backup.${i}.json`);
      const dest = path.join(DATA_DIR, `server_store.backup.${i + 1}.json`);
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, dest);
        } catch (e) {}
      }
    }

    // Copy current store file to backup.1
    const backup1 = path.join(DATA_DIR, 'server_store.backup.1.json');
    fs.copyFileSync(STORE_FILE, backup1);
  } catch (err) {
    console.error('[DB] Failed to rotate backups:', err);
  }
}

/**
 * Atomic Write:
 * Writes to a unique temp file, flushes data to disk (fsync),
 * then atomically renames the temp file to destination.
 */
async function atomicWriteStore(data: ServerStore): Promise<void> {
  const serialized = JSON.stringify(data, null, 2);
  const tempFileName = `server_store.tmp.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.json`;
  const tempFilePath = path.join(DATA_DIR, tempFileName);

  // 1. Rotate backups before overwriting
  rotateBackups();

  // 2. Write to temporary file
  await fs.promises.writeFile(tempFilePath, serialized, 'utf-8');

  // 3. Flush to disk to guarantee physical write
  try {
    const handle = await fs.promises.open(tempFilePath, 'r+');
    await handle.sync();
    await handle.close();
  } catch (e) {
    // Ignore if not supported on specific virtual filesystem
  }

  // 4. Atomic Rename (POSIX / Windows atomic replacement)
  await fs.promises.rename(tempFilePath, STORE_FILE);
}

/**
 * Append-Only Write-Ahead Log (WAL) for Exam Submissions
 * Keeps an indelible audit trail of all student submissions with cryptographic hash
 */
async function appendToWAL(entry: {
  txId: string;
  type: string;
  timestamp: number;
  data: any;
}): Promise<void> {
  try {
    const payloadStr = JSON.stringify(entry.data);
    const checksum = crypto.createHash('sha256').update(payloadStr).digest('hex').substring(0, 16);
    const logLine =
      JSON.stringify({
        txId: entry.txId,
        type: entry.type,
        timestamp: entry.timestamp,
        checksum,
        data: entry.data,
      }) + '\n';

    await fs.promises.appendFile(WAL_FILE, logLine, 'utf-8');
  } catch (err) {
    console.error('[WAL] Failed to append entry to WAL log:', err);
  }
}

/**
 * Reconciles missing submissions from WAL if any crash occurred
 */
function reconcileWAL(store: ServerStore) {
  try {
    if (!fs.existsSync(WAL_FILE)) return;
    const content = fs.readFileSync(WAL_FILE, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const existingIds = new Set(store.history.map((h: any) => h.id));
    let recoveredCount = 0;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'SUBMISSION' && parsed.data && parsed.data.id) {
          if (!existingIds.has(parsed.data.id)) {
            store.history.unshift(parsed.data);
            existingIds.add(parsed.data.id);
            recoveredCount++;
          }
        }
      } catch (e) {}
    }

    if (recoveredCount > 0) {
      console.log(`[WAL] Reconciled and recovered ${recoveredCount} submissions from transaction log.`);
    }
  } catch (err) {
    console.error('[WAL] Error during WAL reconciliation:', err);
  }
}

/**
 * Initialize Database on startup with Self-Healing Rollback and Structure Auto-Repair
 */
export function initDatabase(): ServerStore {
  let loaded = false;

  // 1. Try reading and normalizing the primary file
  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      inMemoryStore = normalizeStore(parsed);
      loaded = true;
      console.log(
        `[DB] Successfully loaded & normalized store: ${inMemoryStore.exams.length} exams, ${Object.keys(inMemoryStore.students).length} students, ${inMemoryStore.history.length} submissions.`
      );
      // Write back normalized file
      fs.writeFileSync(STORE_FILE, JSON.stringify(inMemoryStore, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[DB] Primary store failed to parse. Scanning backups...', err);
    }
  }

  // 2. Fallback to rotating backups if primary failed
  if (!loaded) {
    for (let i = 1; i <= MAX_ROTATING_BACKUPS; i++) {
      const backupPath = path.join(DATA_DIR, `server_store.backup.${i}.json`);
      if (fs.existsSync(backupPath)) {
        try {
          const raw = fs.readFileSync(backupPath, 'utf-8');
          const parsed = JSON.parse(raw);
          inMemoryStore = normalizeStore(parsed);
          loaded = true;
          console.log(`[DB] Recovered state successfully from backup file: backup.${i}.json!`);
          fs.writeFileSync(STORE_FILE, JSON.stringify(inMemoryStore, null, 2), 'utf-8');
          break;
        } catch (e) {}
      }
    }
  }

  if (!loaded) {
    inMemoryStore = normalizeStore({});
    fs.writeFileSync(STORE_FILE, JSON.stringify(inMemoryStore, null, 2), 'utf-8');
  }

  // 3. Reconcile with Write-Ahead Log
  reconcileWAL(inMemoryStore);

  // 4. Setup periodic snapshot backup (every 30 mins)
  setInterval(() => {
    try {
      const snapshotName = `snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const snapshotPath = path.join(BACKUP_DIR, snapshotName);
      fs.writeFileSync(snapshotPath, JSON.stringify(inMemoryStore, null, 2), 'utf-8');

      // Keep only last 10 snapshots
      const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('snapshot_')).sort();
      while (files.length > 10) {
        const oldest = files.shift();
        if (oldest) {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, oldest));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('[DB] Periodic snapshot failed:', e);
    }
  }, 30 * 60 * 1000);

  return inMemoryStore;
}

/**
 * Get current store snapshot (Read-Only)
 */
export function getStore(): ServerStore {
  return inMemoryStore;
}

/**
 * Execute an Atomic Database Transaction
 * All state mutations are queued and executed sequentially with atomic write to disk.
 */
export async function executeTransaction<T>(
  task: (store: ServerStore) => Promise<T> | T,
  options?: { walEntry?: { type: string; data: any } }
): Promise<T> {
  return writeQueue.run(async () => {
    // 1. Execute transactional logic
    const result = await task(inMemoryStore);
    inMemoryStore.lastUpdated = Date.now();

    // 2. Append to Write-Ahead Log if specified
    if (options?.walEntry) {
      const txId = 'tx_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      await appendToWAL({
        txId,
        type: options.walEntry.type,
        timestamp: inMemoryStore.lastUpdated,
        data: options.walEntry.data,
      });
    }

    // 3. Atomically persist store to disk
    await atomicWriteStore(inMemoryStore);

    return result;
  });
}
