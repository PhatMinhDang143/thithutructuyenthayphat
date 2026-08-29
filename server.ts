import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistent server-side data directory
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'server_store.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data dir:', e);
  }
}

// In-memory server store
interface ServerStore {
  exams: any[];
  students: Record<string, any>;
  history: any[];
  classes: string[];
  lastUpdated: number;
}

let serverStore: ServerStore = {
  exams: [],
  students: {},
  history: [],
  classes: ['Tất cả', '12A1', '12A2', '12A3', '11B1', '10C1'],
  lastUpdated: Date.now(),
};

// Load saved data from disk if available
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      serverStore = {
        exams: Array.isArray(parsed.exams) ? parsed.exams : [],
        students: parsed.students && typeof parsed.students === 'object' ? parsed.students : {},
        history: Array.isArray(parsed.history) ? parsed.history : [],
        classes: Array.isArray(parsed.classes) && parsed.classes.length > 0 ? parsed.classes : ['Tất cả', '12A1', '12A2', '12A3', '11B1', '10C1'],
        lastUpdated: parsed.lastUpdated || Date.now(),
      };
      console.log(`Loaded ${serverStore.exams.length} exams from server disk store.`);
    }
  }
} catch (err) {
  console.warn('Failed to load server_store.json, starting with fresh store:', err);
}

function saveStoreToDisk() {
  try {
    serverStore.lastUpdated = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(serverStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist server store to disk:', err);
  }
}

// ================= API ROUTES =================

// 1. Health check & version timestamp
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    lastUpdated: serverStore.lastUpdated,
    examCount: serverStore.exams.length,
    studentCount: Object.keys(serverStore.students).length,
  });
});

// 2. Get all data (instant synchronization for all clients)
app.get('/api/all', (req, res) => {
  res.json({
    success: true,
    data: {
      exams: serverStore.exams,
      students: serverStore.students,
      history: serverStore.history,
      classes: serverStore.classes,
      lastUpdated: serverStore.lastUpdated,
    },
  });
});

// 3. Save or update Exam (including deadline, duration, questions, answers)
app.post('/api/exams/save', (req, res) => {
  try {
    const examPayload = req.body;
    if (!examPayload || !examPayload.id) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin đề thi hợp lệ' });
    }

    const now = Date.now();
    const updatedExam = {
      ...examPayload,
      duration: Number(examPayload.duration) || 45,
      updatedAt: now,
    };

    const idx = serverStore.exams.findIndex((e) => e.id === updatedExam.id);
    if (idx >= 0) {
      serverStore.exams[idx] = updatedExam;
    } else {
      serverStore.exams.unshift(updatedExam);
    }

    // Update classes if any
    if (updatedExam.questions?.target_group) {
      const classSet = new Set(serverStore.classes);
      updatedExam.questions.target_group.split(',').forEach((g: string) => {
        const trimmed = g.trim();
        if (trimmed && trimmed.toLowerCase() !== 'tất cả') {
          classSet.add(trimmed);
        }
      });
      serverStore.classes = Array.from(classSet);
    }

    saveStoreToDisk();
    console.log(`[SERVER SYNC] Exam saved: ${updatedExam.title} (ID: ${updatedExam.id}, Deadline: ${updatedExam.questions?.end_time || 'None'})`);

    res.json({
      success: true,
      exam: updatedExam,
      lastUpdated: serverStore.lastUpdated,
      message: 'Đã lưu và đồng bộ đề thi tới toàn bộ hệ thống!',
    });
  } catch (err: any) {
    console.error('Save exam error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lưu đề thi' });
  }
});

// 4. Delete Exam
app.post('/api/exams/delete', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Thiếu ID đề thi' });
    }

    serverStore.exams = serverStore.exams.filter((e) => e.id !== id);
    saveStoreToDisk();
    console.log(`[SERVER SYNC] Exam deleted: ID ${id}`);

    res.json({ success: true, message: 'Đã xóa đề thi khỏi hệ thống!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi xóa đề thi' });
  }
});

// 5. Save students
app.post('/api/students/save', (req, res) => {
  try {
    const { students } = req.body;
    if (!students || typeof students !== 'object') {
      return res.status(400).json({ success: false, error: 'Dữ liệu học sinh không hợp lệ' });
    }

    serverStore.students = { ...serverStore.students, ...students };

    // Update classes
    const classSet = new Set(serverStore.classes);
    Object.values(students).forEach((s: any) => {
      if (s?.group && s.group.trim()) {
        classSet.add(s.group.trim());
      }
    });
    serverStore.classes = Array.from(classSet);

    saveStoreToDisk();
    res.json({ success: true, message: 'Đã lưu danh sách học sinh!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lưu học sinh' });
  }
});

// 6. Submit exam submission
app.post('/api/submit', (req, res) => {
  try {
    const submission = req.body;
    if (!submission) {
      return res.status(400).json({ success: false, error: 'Dữ liệu nộp bài không hợp lệ' });
    }

    submission.id = submission.id || 'sub_' + Date.now();
    submission.submitted_at = submission.submitted_at || new Date().toLocaleString('vi-VN');
    serverStore.history.unshift(submission);

    saveStoreToDisk();
    res.json({ success: true, submission, message: 'Đã lưu kết quả thi!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi nộp bài' });
  }
});

// 7. Clear history
app.post('/api/history/clear', (req, res) => {
  try {
    serverStore.history = [];
    saveStoreToDisk();
    res.json({ success: true, message: 'Đã xóa toàn bộ lịch sử thi!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi xóa lịch sử' });
  }
});

// 8. Bulk Sync endpoint from Google Sheet / Initial Bootstrap
app.post('/api/sync/bootstrap', (req, res) => {
  try {
    const { exams, students, history, classes } = req.body;

    if (Array.isArray(exams) && exams.length > 0 && serverStore.exams.length === 0) {
      serverStore.exams = exams;
    }
    if (students && typeof students === 'object' && Object.keys(serverStore.students).length === 0) {
      serverStore.students = students;
    }
    if (Array.isArray(history) && history.length > 0 && serverStore.history.length === 0) {
      serverStore.history = history;
    }
    if (Array.isArray(classes) && classes.length > 0) {
      const classSet = new Set([...serverStore.classes, ...classes]);
      serverStore.classes = Array.from(classSet);
    }

    saveStoreToDisk();
    res.json({ success: true, data: serverStore });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ================= VITE / STATIC MIDDLEWARE =================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> Express + Vite Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
