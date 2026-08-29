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
 * Initialize Database on startup with Self-Healing Rollback
 */
export function initDatabase(): ServerStore {
  let loaded = false;

  // 1. Try reading the primary file
  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (isValidStore(parsed)) {
        inMemoryStore = {
          exams: parsed.exams,
          students: parsed.students,
          history: parsed.history,
          classes: parsed.classes.length > 0 ? parsed.classes : ['Tất cả', '12A1', '12A2', '12A3', '11B1', '10C1'],
          lastUpdated: parsed.lastUpdated || Date.now(),
        };
        loaded = true;
        console.log(`[DB] Successfully loaded store: ${inMemoryStore.exams.length} exams, ${inMemoryStore.history.length} submissions.`);
      } else {
        console.warn('[DB] Primary store failed schema validation. Attempting backup rollback...');
      }
    } catch (err) {
      console.warn('[DB] Primary store is corrupted or unreadable. Initiating auto-recovery from backups...', err);
    }
  }

  // 2. Self-Healing Fallback: Scan rotating backups if primary was corrupted
  if (!loaded) {
    for (let i = 1; i <= MAX_ROTATING_BACKUPS; i++) {
      const backupPath = path.join(DATA_DIR, `server_store.backup.${i}.json`);
      if (fs.existsSync(backupPath)) {
        try {
          const raw = fs.readFileSync(backupPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (isValidStore(parsed)) {
            inMemoryStore = {
              exams: parsed.exams,
              students: parsed.students,
              history: parsed.history,
              classes: parsed.classes,
              lastUpdated: parsed.lastUpdated || Date.now(),
            };
            loaded = true;
            console.log(`[DB] Recovered state successfully from backup file: backup.${i}.json!`);
            // Restore recovered store to primary
            fs.copyFileSync(backupPath, STORE_FILE);
            break;
          }
        } catch (e) {}
      }
    }
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
