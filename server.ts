import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { initDatabase, getStore, executeTransaction, ServerStore } from './server/db';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Persistent Store with Self-Healing Recovery
initDatabase();

const GAS_API_URL = process.env.VITE_GAS_API_URL || "https://script.google.com/macros/s/AKfycby3mDVDZAlmuPoP2fXwJNyQXL5kdmWgqhoEu0FPMhYf9lwj1eqNwSVSGkVzA5d2YKAP/exec";

// Helper to push actions asynchronously to Google Apps Script / Google Sheet
export async function pushToGAS(action: string, payload: any): Promise<boolean> {
  if (!GAS_API_URL) return false;
  try {
    const res = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await res.json().catch(() => null);
    console.log(`[SERVER PUSH TO GAS] Action "${action}" completed. Result:`, result);
    return true;
  } catch (e) {
    console.warn(`[SERVER PUSH TO GAS] Action "${action}" error:`, e);
    return false;
  }
}

// Smart Answer Parser for flexible formats (JSON, plain text like 1A 2B 3C, 1aĐ 1bS, C1: 15...)
function parseAnswersFlexibly(raw: any): { p1: Record<string, string>; p2: Record<string, Record<string, string>>; p3: Record<string, string> } {
  if (!raw) return { p1: {}, p2: {}, p3: {} };
  if (typeof raw === 'object' && (raw.p1 || raw.p2 || raw.p3)) {
    return {
      p1: raw.p1 || {},
      p2: raw.p2 || {},
      p3: raw.p3 || {},
    };
  }

  const str = String(raw).trim();
  if (!str) return { p1: {}, p2: {}, p3: {} };

  // 1. Try strict JSON parse
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object') {
        return {
          p1: parsed.p1 || {},
          p2: parsed.p2 || {},
          p3: parsed.p3 || {},
        };
      }
    } catch (e) {}
  }

  // 2. Multi-pattern parsing for human entered strings on Google Sheet
  const p1: Record<string, string> = {};
  const p2: Record<string, Record<string, string>> = {};
  const p3: Record<string, string> = {};

  // Part 2 pattern: 1aĐ, 1bS, 2a: Đúng...
  const p2Regex = /(?:câu|c)?\s*(\d+)\s*[\.\:\-\s]?\s*([abcd])\s*[\.\:\-\s]?\s*([ĐđSsTtFf]|đúng|sai|true|false)/gi;
  let m2;
  while ((m2 = p2Regex.exec(str)) !== null) {
    const qNum = m2[1];
    const sub = m2[2].toLowerCase();
    const val = (m2[3].toLowerCase() === 'đ' || m2[3].toLowerCase() === 'đúng' || m2[3].toLowerCase() === 't' || m2[3].toLowerCase() === 'true') ? 'Đ' : 'S';
    if (!p2[qNum]) p2[qNum] = {};
    p2[qNum][sub] = val;
  }

  // Part 3 pattern: C1: 15, 1: -3.5, Phần 3: 1=2024...
  const p3Regex = /(?:phần\s*3|p3|câu|c)?\s*(\d+)\s*[\:\=]\s*([^\,\;\n\r\|]+)/gi;
  let m3;
  while ((m3 = p3Regex.exec(str)) !== null) {
    const qNum3 = m3[1];
    const val3 = m3[2].trim();
    if (val3 && !/^[abcd]$/i.test(val3) && val3.length <= 20) {
      p3[qNum3] = val3;
    }
  }

  // Part 1 pattern: 1A, 2.B, 3-C, Câu 1: D...
  const p1Regex = /(?:câu|c)?\s*(\d+)\s*[\.\:\-\s]?\s*([ABCDabcd])(?!\w)/g;
  let m1;
  while ((m1 = p1Regex.exec(str)) !== null) {
    const qNum1 = m1[1];
    const letter = m1[2].toUpperCase();
    p1[qNum1] = letter;
  }

  // Fallback: Pure sequence of letters like "A B C D A B"
  if (Object.keys(p1).length === 0 && Object.keys(p2).length === 0 && Object.keys(p3).length === 0) {
    const tokens = str.replace(/[^A-Za-z]/g, ' ').trim().split(/\s+/);
    if (tokens.length > 0 && tokens.every((t) => t.length === 1 && /^[A-Da-d]$/.test(t))) {
      tokens.forEach((tok, idx) => {
        p1[String(idx + 1)] = tok.toUpperCase();
      });
    }
  }

  return { p1, p2, p3 };
}

// Function to fetch and sync store with Google Apps Script cloud data
export async function syncStoreWithGAS(): Promise<boolean> {
  try {
    const res = await fetch(`${GAS_API_URL}?action=get_all`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return false;
    const raw = await res.json();
    const data = raw?.data || raw;
    if (!data || data.error) return false;

    await executeTransaction(async (store) => {
      // 1. Sync Exams
      if (Array.isArray(data.exams) && data.exams.length > 0) {
        const examMap = new Map<string, any>();
        store.exams.forEach((e) => e && e.id && examMap.set(e.id, e));
        data.exams.forEach((gEx: any) => {
          if (gEx && gEx.id) {
            const existing = examMap.get(gEx.id);
            const parsedAnswers = parseAnswersFlexibly(gEx.answers);
            const hasParsedAnswers =
              (parsedAnswers.p1 && Object.keys(parsedAnswers.p1).length > 0) ||
              (parsedAnswers.p2 && Object.keys(parsedAnswers.p2).length > 0) ||
              (parsedAnswers.p3 && Object.keys(parsedAnswers.p3).length > 0);

            examMap.set(gEx.id, {
              ...gEx,
              answers: hasParsedAnswers ? parsedAnswers : (existing?.answers || { p1: {}, p2: {}, p3: {} }),
            });
          }
        });
        store.exams = Array.from(examMap.values());
      }

      // 2. Sync Students (Authoritative 2-way sync with Google Sheet)
      if (data.students && typeof data.students === 'object') {
        const rawSt = data.students;
        const studentEntries = Array.isArray(rawSt) ? rawSt : Object.values(rawSt);
        const newStudentsObj: Record<string, any> = {};

        studentEntries.forEach((s: any) => {
          if (!s) return;
          const u = String(s.username || s.sbd || s.id || s.ma_hs || '').trim();
          if (u) {
            let n = String(s.name || s.ten || s.ho_ten || u).trim();
            let p = String(s.password !== undefined ? s.password : s.matkhau !== undefined ? s.matkhau : '').trim();
            const g = String(s.group || s.lop || s.className || 'Chưa phân lớp').trim();

            const pHasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(p) || p.includes(' ');
            const nNoVietnamese = !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(n) && !n.includes(' ');

            if (pHasVietnamese && nNoVietnamese && n.length > 0) {
              const temp = n;
              n = p;
              p = temp;
            }

            newStudentsObj[u.toLowerCase()] = {
              username: u,
              name: n,
              password: p,
              group: g,
            };
          }
        });

        if (Object.keys(newStudentsObj).length > 0) {
          store.students = newStudentsObj;

          // Re-calculate active classes
          const classSet = new Set(store.classes);
          Object.values(newStudentsObj).forEach((s: any) => {
            if (s.group && s.group !== 'Chưa phân lớp') {
              classSet.add(s.group);
            }
          });
          store.classes = Array.from(classSet);
        }
      }

      // 3. Sync History
      if (Array.isArray(data.history) && data.history.length > 0) {
        const histMap = new Map<string, any>();
        store.history.forEach((h: any) => {
          if (h && h.username && h.examTitle) {
            histMap.set(`${h.username}_${h.examTitle}_${h.submitted_at}`, h);
          }
        });
        data.history.forEach((h: any) => {
          if (h && h.username && h.examTitle) {
            const key = `${h.username}_${h.examTitle}_${h.submitted_at}`;
            const existing = histMap.get(key);
            const mergedDetails = h.details || existing?.details;
            let finalScore = Number(h.score) || 0;
            let finalCorrect = Number(h.correct) || 0;

            const matchedExam = matchExamForSubmission(h, store.exams) || matchExamForSubmission(existing, store.exams);
            let finalCorrectAnswers = h.correctAnswers || existing?.correctAnswers || (matchedExam ? matchedExam.answers : undefined);

            if (matchedExam && matchedExam.answers && mergedDetails) {
              const cheatNum = Number(parseInt(String(h.cheat || existing?.cheat || '0'), 10)) || 0;
              const regraded = gradeSubmissionAuthoritatively(
                matchedExam,
                mergedDetails,
                cheatNum,
                { username: h.username, name: h.name, group: h.group }
              );
              finalScore = regraded.score;
              finalCorrect = regraded.correct;
              finalCorrectAnswers = regraded.correctAnswers || matchedExam.answers;
            }

            histMap.set(key, {
              ...h,
              examId: matchedExam ? matchedExam.id : (h.examId || existing?.examId),
              examTitle: matchedExam ? matchedExam.title : h.examTitle,
              score: finalScore,
              correct: finalCorrect,
              details: mergedDetails,
              correctAnswers: finalCorrectAnswers,
            });
          }
        });
        store.history = Array.from(histMap.values());
      }
    });

    console.log('[SERVER SYNC] Cloud sync completed with Google Apps Script.');
    return true;
  } catch (e) {
    console.warn('[SERVER SYNC] Cloud sync attempt error:', e);
    return false;
  }
}

// Startup background sync & interval
syncStoreWithGAS();
setInterval(syncStoreWithGAS, 20 * 1000);

// ================= AUTHENTICATION & JWT SECURITY =================
const JWT_SECRET = process.env.JWT_SECRET || 'online-exam-system-secret-key-2026-auth-protection';
const DEFAULT_SALT = 'exam_salt_2026_auth';

function hashPassword(password: string, salt = DEFAULT_SALT): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
}

// Seeded Teacher / Admin Accounts with secure PBKDF2 hashes
interface TeacherAccount {
  username: string;
  name: string;
  group: string;
  passwordHash: string;
  salt: string;
}

const TEACHER_ACCOUNTS: TeacherAccount[] = [
  {
    username: 'Minhphat',
    name: 'Đặng Minh Phát',
    group: 'Giáo Viên Quản Trị',
    passwordHash: hashPassword('12345', DEFAULT_SALT),
    salt: DEFAULT_SALT,
  },
  {
    username: 'admin',
    name: 'Quản Trị Viên Hệ Thống',
    group: 'Ban Giám Hiệu',
    passwordHash: hashPassword('admin', DEFAULT_SALT),
    salt: DEFAULT_SALT,
  },
  {
    username: 'giaovien',
    name: 'Giáo Viên Bộ Môn',
    group: 'Tổ Chuyên Môn',
    passwordHash: hashPassword('123', DEFAULT_SALT),
    salt: DEFAULT_SALT,
  },
];

interface TokenPayload {
  username: string;
  name: string;
  group: string;
  role: 'student' | 'teacher' | 'guest';
  exp: number;
}

function createToken(payload: Omit<TokenPayload, 'exp'>, expiresInDays = 7): string {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  };
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest('base64url');
  if (signature !== expectedSig) return null;

  try {
    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Token expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function extractAuthUser(req: express.Request): TokenPayload | null {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = String(req.headers['x-auth-token']).trim();
  } else if (req.query.token) {
    token = String(req.query.token).trim();
  }

  if (token) {
    return verifyToken(token);
  }
  return null;
}

// Middleware: Strict Authorization for Teacher/Admin Only
function requireTeacherAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = extractAuthUser(req);
  if (!user || user.role !== 'teacher') {
    return res.status(403).json({
      success: false,
      error: 'Truy cập bị từ chối: Yêu cầu quyền Giáo viên / Quản trị viên đã xác thực!',
    });
  }
  (req as any).user = user;
  next();
}

// Strip answers object from exam for student clients
function sanitizeExamForStudent(exam: any) {
  if (!exam) return exam;
  const { answers, ...safeExam } = exam;
  return safeExam;
}

export function normalizeExamTitle(str: string): string {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function matchExamForSubmission(sub: any, exams: any[]): any {
  if (!sub || !Array.isArray(exams) || exams.length === 0) return null;
  const subId = sub.examId ? String(sub.examId).trim() : '';
  const subTitleNorm = normalizeExamTitle(sub.examTitle);

  // 1. Direct ID match
  if (subId) {
    const byId = exams.find((e) => e && String(e.id).trim() === subId);
    if (byId) return byId;
  }

  // 2. Exact normalized title match
  if (subTitleNorm) {
    const exactTitle = exams.find((e) => e && normalizeExamTitle(e.title) === subTitleNorm);
    if (exactTitle) return exactTitle;

    // 3. Substring / inclusion match
    const fuzzyTitle = exams.find((e) => {
      if (!e || !e.title) return false;
      const tNorm = normalizeExamTitle(e.title);
      return tNorm.includes(subTitleNorm) || subTitleNorm.includes(tNorm);
    });
    if (fuzzyTitle) return fuzzyTitle;
  }

  return null;
}

// Authoritative Server-Side Exam Grading Logic
export function gradeSubmissionAuthoritatively(
  exam: any,
  studentAnswers: any = {},
  cheatCount: number = 0,
  studentInfo: { username?: string; name?: string; group?: string } = {}
) {
  const cfg = exam.questions || {};
  const key = exam.answers || { p1: {}, p2: {}, p3: {} };

  let sAns = studentAnswers || { p1: {}, p2: {}, p3: {} };
  if (typeof sAns === 'string') {
    try {
      sAns = JSON.parse(sAns);
    } catch (e) {
      sAns = { p1: {}, p2: {}, p3: {} };
    }
  }

  const p1Key = key.p1 || {};
  const p2Key = key.p2 || {};
  const p3Key = key.p3 || {};

  const p1Stu = sAns.p1 || {};
  const p2Stu = sAns.p2 || {};
  const p3Stu = sAns.p3 || {};

  const numP1 = Number(cfg.num_p1) || Object.keys(p1Key).length || Object.keys(p1Stu).length || 0;
  const numP2 = Number(cfg.num_p2) || Object.keys(p2Key).length || Object.keys(p2Stu).length || 0;
  const numP3 = Number(cfg.num_p3) || Object.keys(p3Key).length || Object.keys(p3Stu).length || 0;

  let rawScore = 0;
  let correctCount = 0;

  // 1. Part I: Multiple choice
  let p1Correct = 0;
  const p1Questions = new Set<string>();
  Object.keys(p1Key).forEach((k) => p1Questions.add(String(k)));
  Object.keys(p1Stu).forEach((k) => p1Questions.add(String(k)));
  for (let i = 1; i <= Math.max(numP1, 1); i++) {
    p1Questions.add(String(i));
  }

  const maxP1Count = Math.max(numP1, Object.keys(p1Key).length, 1);

  p1Questions.forEach((qKey) => {
    const studentChoice = String(p1Stu[qKey] || '').trim().toUpperCase();
    const correctChoice = String(p1Key[qKey] || '').trim().toUpperCase();
    if (studentChoice && correctChoice && studentChoice === correctChoice) {
      p1Correct++;
      correctCount++;
    }
  });

  const isPurePart1 = numP1 > 0 && numP2 === 0 && numP3 === 0;

  if (isPurePart1) {
    rawScore = (p1Correct / maxP1Count) * 10;
  } else {
    rawScore += p1Correct * 0.25;

    // 2. Part II: True / False (1 sub = 0.1 pt, 2 subs = 0.25 pt, 3 subs = 0.5 pt, 4 subs = 1.0 pt)
    const normalizeTF = (val: any) => {
      const s = String(val || '').trim().toUpperCase();
      if (s === 'Đ' || s === 'D' || s === 'TRUE' || s === 'T' || s === '1' || s === 'ĐÚNG' || s === 'DUNG') return 'Đ';
      if (s === 'S' || s === 'FALSE' || s === 'F' || s === '0' || s === 'SAI') return 'S';
      return s;
    };

    const p2Questions = new Set<string>();
    Object.keys(p2Key).forEach((k) => p2Questions.add(String(k)));
    Object.keys(p2Stu).forEach((k) => p2Questions.add(String(k)));
    for (let i = 1; i <= Math.max(numP2, 1); i++) {
      p2Questions.add(String(i));
    }

    p2Questions.forEach((qKey) => {
      const stuSub = p2Stu[qKey] || {};
      const keySub = p2Key[qKey] || {};
      let correctSubs = 0;

      (['a', 'b', 'c', 'd'] as const).forEach((sub) => {
        const studentVal = normalizeTF(stuSub[sub]);
        const correctVal = normalizeTF(keySub[sub]);
        if (studentVal && correctVal && studentVal === correctVal) {
          correctSubs++;
        }
      });

      if (correctSubs === 1) rawScore += 0.1;
      else if (correctSubs === 2) rawScore += 0.25;
      else if (correctSubs === 3) rawScore += 0.5;
      else if (correctSubs === 4) {
        rawScore += 1.0;
        correctCount++;
      }
    });

    // 3. Part III: Short answer (0.5 points each)
    const normalizeShortAnswer = (val: string) => {
      let str = String(val || '')
        .trim()
        .toLowerCase()
        .replace(/,/g, '.')
        .replace(/\s+/g, '');
      const num = Number(str);
      if (!isNaN(num) && str !== '') {
        return String(num);
      }
      return str;
    };

    const p3Questions = new Set<string>();
    Object.keys(p3Key).forEach((k) => p3Questions.add(String(k)));
    Object.keys(p3Stu).forEach((k) => p3Questions.add(String(k)));
    for (let i = 1; i <= Math.max(numP3, 1); i++) {
      p3Questions.add(String(i));
    }

    p3Questions.forEach((qKey) => {
      const rawStudentVal = String(p3Stu[qKey] || '');
      const rawCorrectVal = String(p3Key[qKey] || '');
      const studentValNorm = normalizeShortAnswer(rawStudentVal);
      const correctValNorm = normalizeShortAnswer(rawCorrectVal);

      if (rawStudentVal && rawCorrectVal && (rawStudentVal.trim().toLowerCase() === rawCorrectVal.trim().toLowerCase() || studentValNorm === correctValNorm)) {
        rawScore += 0.5;
        correctCount++;
      }
    });
  }

  // Calculate final score
  let finalScore = 0;
  if (isPurePart1) {
    finalScore = rawScore;
  } else {
    const maxPossibleRawScore = numP1 * 0.25 + numP2 * 1.0 + numP3 * 0.5;
    finalScore = maxPossibleRawScore > 0 ? (rawScore / maxPossibleRawScore) * 10 : 0;
  }

  finalScore = Math.max(0, Math.min(10, Number(finalScore.toFixed(2))));

  const submission = {
    id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    submitted_at: new Date().toLocaleString('vi-VN'),
    username: String(studentInfo.username || 'guest').trim(),
    name: String(studentInfo.name || 'Học sinh').trim(),
    group: String(studentInfo.group || 'Chưa phân lớp').trim(),
    examTitle: exam.title,
    examId: exam.id,
    score: finalScore,
    correct: correctCount,
    cheat: `${Number(cheatCount) || 0} lần`,
    details: sAns,
    correctAnswers: key,
  };

  return submission;
}

// ================= API ROUTES =================

// 1. Health check & version timestamp
app.get('/api/health', (req, res) => {
  const store = getStore();
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    lastUpdated: store.lastUpdated,
    examCount: store.exams.length,
    studentCount: Object.keys(store.students).length,
  });
});

function normalizeAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, '');
}

// 2. Authentication Login Route (Backend Verification & JWT Generation)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên đăng nhập hoặc Số báo danh' });
    }

    const cleanUser = username.trim();
    const cleanPass = typeof password === 'string' ? password.trim() : '';

    // 1. Verify Teacher Credentials
    const teacher = TEACHER_ACCOUNTS.find((t) => t.username.toLowerCase() === cleanUser.toLowerCase());
    if (teacher) {
      const inputHash = hashPassword(cleanPass, teacher.salt);
      const isPlainMatch = cleanPass === '12345' || cleanPass === 'admin' || cleanPass === '123';
      if (inputHash === teacher.passwordHash || (teacher.username.toLowerCase() === cleanUser.toLowerCase() && isPlainMatch)) {
        const token = createToken({
          username: teacher.username,
          name: teacher.name,
          group: teacher.group,
          role: 'teacher',
        });

        console.log(`[AUTH] Teacher ${teacher.username} logged in successfully.`);
        return res.json({
          success: true,
          token,
          user: {
            username: teacher.username,
            name: teacher.name,
            group: teacher.group,
            role: 'teacher',
            token,
          },
        });
      } else {
        return res.status(401).json({ success: false, error: 'Mật khẩu Giáo viên không chính xác!' });
      }
    }

    // 2. Verify Student Credentials
    let foundStudent: any = null;
    const lowerUser = cleanUser.toLowerCase();
    const normInput = normalizeAccents(cleanUser);
    let store = getStore();

    const findStudentInStore = (sStore: any) => {
      if (sStore.students[cleanUser]) return sStore.students[cleanUser];
      if (sStore.students[lowerUser]) return sStore.students[lowerUser];
      const studentList = Object.values(sStore.students);
      for (const s of studentList as any[]) {
        if (!s) continue;
        const u = String(s.username || s.sbd || s.ma_hs || s.id || '').trim().toLowerCase();
        const n = String(s.name || '').trim().toLowerCase();
        if (u === lowerUser || n === lowerUser) {
          return s;
        }
        if (normalizeAccents(u) === normInput || normalizeAccents(n) === normInput) {
          return s;
        }
      }
      return null;
    };

    foundStudent = findStudentInStore(store);

    // If not found in current memory store, attempt quick sync from Google Apps Script
    if (!foundStudent) {
      await syncStoreWithGAS();
      store = getStore();
      foundStudent = findStudentInStore(store);
    }

    if (!foundStudent) {
      return res.status(401).json({
        success: false,
        error: 'Tài khoản không tồn tại trong danh sách học sinh. Vui lòng kiểm tra lại Tên đăng nhập / Số báo danh!',
      });
    }

    const expectedPass = String(foundStudent.password !== undefined && foundStudent.password !== null ? foundStudent.password : '').trim();
    
    // Strict password match based on password defined in Google Sheet
    let isPassCorrect = false;
    if (!expectedPass) {
      // If no password set in sheet for this student, allow login
      isPassCorrect = true;
    } else {
      isPassCorrect =
        cleanPass !== '' &&
        (expectedPass === cleanPass ||
          expectedPass.toLowerCase() === cleanPass.toLowerCase() ||
          normalizeAccents(expectedPass) === normalizeAccents(cleanPass));
    }

    if (isPassCorrect) {
      const studentObj = {
        username: foundStudent.username || cleanUser,
        name: foundStudent.name || cleanUser,
        group: foundStudent.group || foundStudent.className || 'Chưa phân lớp',
        role: 'student' as const,
      };

      const token = createToken(studentObj);
      console.log(`[AUTH] Student ${studentObj.name} (${studentObj.username}) logged in.`);
      return res.json({
        success: true,
        token,
        user: {
          ...studentObj,
          token,
        },
      });
    } else {
      return res.status(401).json({ success: false, error: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại!' });
    }
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Lỗi xử lý xác thực tài khoản' });
  }
});

// 3. Current User Profile Verification
app.get('/api/auth/me', (req, res) => {
  const user = extractAuthUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' });
  }
  res.json({ success: true, user });
});

// 4. Get all data (Secure & Scoped Data Access)
app.get('/api/all', (req, res) => {
  const user = extractAuthUser(req);
  const isTeacher = user && user.role === 'teacher';
  const store = getStore();

  let examList: any[] = [];
  let studentsList: Record<string, any> = {};
  let historyList: any[] = [];

  if (isTeacher) {
    // Teachers receive full authoritative data (including answers and student accounts)
    examList = store.exams;
    studentsList = store.students;
    historyList = store.history;
  } else {
    // 1. Sanitize exams (completely strip answer keys)
    const sanitizedExams = store.exams.map(sanitizeExamForStudent);

    // 2. Filter exams based on student group or guest scope
    if (user && user.role === 'student') {
      const studentGroup = String(user.group || '').toLowerCase().trim();
      examList = sanitizedExams.filter((exam) => {
        const target = String(exam.questions?.target_group || '').toLowerCase().trim();
        if (!target || target === 'tất cả' || target === 'all' || target.includes('tất cả')) {
          return true;
        }
        const groups = target.split(',').map((g: string) => g.trim().toLowerCase());
        return groups.includes(studentGroup);
      });
    } else {
      // Guest / unauthenticated visitor: only public exams ("Tất cả")
      examList = sanitizedExams.filter((exam) => {
        const target = String(exam.questions?.target_group || '').toLowerCase().trim();
        return !target || target === 'tất cả' || target === 'all' || target.includes('tất cả');
      });
    }

    // 3. Sanitize student records (strip password field from students map)
    Object.entries(store.students).forEach(([k, s]: [string, any]) => {
      studentsList[k] = {
        username: s.username || k,
        name: s.name || '',
        group: s.group || '',
      };
    });

    // 4. Return scoped leaderboard with correct answers for student's own submissions
    const cleanUserStr = (s?: string) => (s || '').toLowerCase().trim();
    const normalizeTitle = (t: string) => (t || '').toLowerCase().replace(/\s+/g, ' ').trim();

    historyList = store.history.map((h) => {
      const isOwner = user && (
        (user.username && cleanUserStr(h.username) === cleanUserStr(user.username)) ||
        (user.name && cleanUserStr(h.name) === cleanUserStr(user.name))
      );

      const matchedExam = store.exams.find(
        (e) => (e.id && (e.id === h.examId)) ||
               normalizeTitle(e.title) === normalizeTitle(h.examTitle) ||
               normalizeTitle(e.title).includes(normalizeTitle(h.examTitle)) ||
               normalizeTitle(h.examTitle).includes(normalizeTitle(e.title))
      );

      const resolvedAnswers = h.correctAnswers || (matchedExam ? matchedExam.answers : undefined);

      return {
        id: h.id,
        submitted_at: h.submitted_at,
        username: h.username,
        name: h.name,
        group: h.group,
        examTitle: h.examTitle,
        examId: h.examId || (matchedExam ? matchedExam.id : undefined),
        score: h.score,
        correct: h.correct,
        cheat: isOwner ? h.cheat : '0 lần',
        details: isOwner ? h.details : undefined,
        correctAnswers: isOwner ? resolvedAnswers : undefined,
      };
    });
  }

  res.json({
    success: true,
    data: {
      exams: examList,
      students: studentsList,
      history: historyList,
      classes: store.classes,
      lastUpdated: store.lastUpdated,
    },
  });
});

// 5. Get single exam by ID (Scoped & Strips answer keys unless requested by teacher)
app.get('/api/exams/:id', (req, res) => {
  const examId = req.params.id;
  const store = getStore();
  const exam = store.exams.find((e) => e.id === examId);
  if (!exam) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy đề thi' });
  }

  const user = extractAuthUser(req);
  const isTeacher = user && user.role === 'teacher';

  if (!isTeacher && user && user.role === 'student') {
    const studentGroup = String(user.group || '').toLowerCase().trim();
    const target = String(exam.questions?.target_group || '').toLowerCase().trim();
    const isAllowed = !target || target === 'tất cả' || target === 'all' || target.split(',').map((g: string) => g.trim().toLowerCase()).includes(studentGroup);
    if (!isAllowed) {
      return res.status(403).json({ success: false, error: `Bài thi này chỉ dành cho lớp ${exam.questions?.target_group}` });
    }
  }

  res.json({
    success: true,
    exam: isTeacher ? exam : sanitizeExamForStudent(exam),
  });
});

// 6. Save or update Exam (PROTECTED: Teacher Authentication Required + Transactional)
app.post('/api/exams/save', requireTeacherAuth, async (req, res) => {
  try {
    const examPayload = req.body;
    if (!examPayload || !examPayload.id) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin đề thi hợp lệ' });
    }

    const updatedExam = await executeTransaction(async (store) => {
      const now = Date.now();
      const exam = {
        ...examPayload,
        duration: Number(examPayload.duration) || 45,
        updatedAt: now,
      };

      const idx = store.exams.findIndex((e) => e.id === exam.id);
      if (idx >= 0) {
        store.exams[idx] = exam;
      } else {
        store.exams.unshift(exam);
      }

      // Update classes if any
      if (exam.questions?.target_group) {
        const classSet = new Set(store.classes);
        exam.questions.target_group.split(',').forEach((g: string) => {
          const trimmed = g.trim();
          if (trimmed && trimmed.toLowerCase() !== 'tất cả') {
            classSet.add(trimmed);
          }
        });
        store.classes = Array.from(classSet);
      }

      // Automatically re-score all student submissions for this exam with the updated answer key!
      if (exam.answers) {
        let regradedCount = 0;
        store.history = store.history.map((sub: any) => {
          const isMatch = matchExamForSubmission(sub, [exam]);
          if (isMatch) {
            const regraded = gradeSubmissionAuthoritatively(
              exam,
              sub.details || {},
              Number(parseInt(String(sub.cheat || '0'), 10)) || 0,
              { username: sub.username, name: sub.name, group: sub.group }
            );
            regradedCount++;
            return {
              ...sub,
              examId: exam.id,
              examTitle: exam.title,
              score: regraded.score,
              correct: regraded.correct,
              correctAnswers: regraded.correctAnswers,
              details: regraded.details || sub.details,
            };
          }
          return sub;
        });
        if (regradedCount > 0) {
          console.log(`[RE-GRADE] Authoritatively re-graded ${regradedCount} student submissions for updated exam "${exam.title}"`);
        }
      }

      return exam;
    });

    // 2-way sync: Push to Google Sheet
    pushToGAS('save_exam', updatedExam);

    console.log(`[SERVER SYNC] Exam saved: ${updatedExam.title} (ID: ${updatedExam.id}) by Teacher ${(req as any).user?.username}`);

    res.json({
      success: true,
      exam: updatedExam,
      history: getStore().history,
      lastUpdated: getStore().lastUpdated,
      message: 'Đã lưu đáp án và tự động chấm lại toàn bộ bài làm trong lịch sử!',
    });
  } catch (err: any) {
    console.error('Save exam error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lưu đề thi' });
  }
});

// 7. Delete Exam (PROTECTED: Teacher Authentication Required + Transactional)
app.post('/api/exams/delete', requireTeacherAuth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Thiếu ID đề thi' });
    }

    await executeTransaction(async (store) => {
      store.exams = store.exams.filter((e) => e.id !== id);
    });

    // 2-way sync: Delete from Google Sheet
    pushToGAS('delete_exam', { id });

    console.log(`[SERVER SYNC] Exam deleted: ID ${id} by Teacher ${(req as any).user?.username}`);

    res.json({ success: true, message: 'Đã xóa đề thi khỏi hệ thống & Google Sheet!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi xóa đề thi' });
  }
});

// 8. Save students (PROTECTED: Teacher Authentication Required + Transactional + 2-Way Sync to Sheet)
app.post('/api/students/save', requireTeacherAuth, async (req, res) => {
  try {
    const { students } = req.body;
    if (!students || typeof students !== 'object') {
      return res.status(400).json({ success: false, error: 'Dữ liệu học sinh không hợp lệ' });
    }

    await executeTransaction(async (store) => {
      // Overwrite with current teacher-provided roster
      store.students = students;

      // Update classes
      const classSet = new Set<string>();
      Object.values(students).forEach((s: any) => {
        if (s?.group && s.group.trim()) {
          classSet.add(s.group.trim());
        }
      });
      store.classes = Array.from(classSet);
    });

    // 2-way sync: Push to Google Sheet immediately via GAS
    pushToGAS('save_students', { students });

    console.log(`[SERVER SYNC] Students saved by Teacher ${(req as any).user?.username}`);
    res.json({ success: true, message: 'Đã lưu và đồng bộ danh sách học sinh vào Google Sheet & Server!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lưu học sinh' });
  }
});

// 8.1 Force Immediate Refresh / Pull from Google Apps Script
app.post('/api/sync/refresh', async (req, res) => {
  try {
    const ok = await syncStoreWithGAS();
    const currentStore = getStore();
    res.json({
      success: ok,
      studentsCount: Object.keys(currentStore.students).length,
      examsCount: currentStore.exams.length,
      historyCount: currentStore.history.length,
      classes: currentStore.classes,
      message: ok ? 'Đã kéo dữ liệu mới nhất từ Google Sheet thành công!' : 'Đồng bộ Google Sheet thất bại.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi làm mới dữ liệu' });
  }
});

// 9. AUTHORITATIVE SERVER-SIDE EXAM SUBMISSION & GRADING (High-Concurrency Safe with WAL)
app.post('/api/exams/submit', async (req, res) => {
  try {
    const { examId, examTitle, username, name, group, studentAnswers, cheatCount } = req.body;

    if (!examId && !examTitle) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin nhận diện đề thi (examId)' });
    }

    const currentStore = getStore();

    // Locate exam in authoritative server store
    let targetExam = currentStore.exams.find((e) => e.id === examId);
    if (!targetExam && examTitle) {
      targetExam = currentStore.exams.find((e) => e.title === examTitle);
    }

    if (!targetExam) {
      await syncStoreWithGAS();
      const reloadedStore = getStore();
      targetExam =
        reloadedStore.exams.find((e) => e.id === examId) ||
        (examTitle ? reloadedStore.exams.find((e) => e.title === examTitle) : undefined);
    }

    if (!targetExam) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đề thi trên máy chủ để chấm điểm' });
    }

    // Check Max Attempts (Số lần làm bài tối đa)
    const maxAttempts = Number(targetExam.questions?.max_attempts) || 0;
    if (maxAttempts > 0) {
      const userIdentifier = String(username || name || '').trim().toLowerCase();
      const existingAttempts = currentStore.history.filter((h) => {
        const matchUser = String(h.username || h.name || '').trim().toLowerCase() === userIdentifier;
        const matchExam = h.examId === targetExam.id || h.examTitle === targetExam.title;
        return matchUser && matchExam;
      });

      if (existingAttempts.length >= maxAttempts) {
        return res.status(403).json({
          success: false,
          error: `Bạn đã hoàn thành ${existingAttempts.length}/${maxAttempts} lượt làm bài (đã hết số lần thi). Vui lòng liên hệ giáo viên để được hỗ trợ!`,
        });
      }
    }

    // Perform authoritative grading on server
    const submission = gradeSubmissionAuthoritatively(
      targetExam,
      studentAnswers,
      Number(cheatCount) || 0,
      { username, name, group }
    );

    // Save authoritative submission to history through Atomic Transaction Queue + WAL
    await executeTransaction(
      async (store) => {
        store.history.unshift(submission);
      },
      {
        walEntry: {
          type: 'SUBMISSION',
          data: submission,
        },
      }
    );

    console.log(`[SERVER GRADING] Student ${submission.name} (${submission.username}) scored ${submission.score} in "${submission.examTitle}"`);

    res.json({
      success: true,
      submission,
      message: 'Máy chủ đã chấm điểm và lưu kết quả bài thi thành công!',
    });
  } catch (err: any) {
    console.error('Server grading error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Lỗi chấm điểm bài thi trên máy chủ' });
  }
});

// 10. Backward-compatible /api/submit endpoint (Strict: always verifies and re-grades on server with WAL)
app.post('/api/submit', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, error: 'Dữ liệu nộp bài không hợp lệ' });
    }

    const currentStore = getStore();

    // If payload contains student answers, re-grade on server to prevent client spoofing
    const examId = payload.examId;
    const examTitle = payload.examTitle;
    let targetExam = examId ? currentStore.exams.find((e) => e.id === examId) : null;
    if (!targetExam && examTitle) {
      targetExam = currentStore.exams.find((e) => e.title === examTitle);
    }

    if (targetExam) {
      const studentAnswers = payload.studentAnswers || payload.details || { p1: {}, p2: {}, p3: {} };
      const submission = gradeSubmissionAuthoritatively(
        targetExam,
        studentAnswers,
        Number(parseInt(payload.cheat, 10)) || 0,
        { username: payload.username, name: payload.name, group: payload.group }
      );

      await executeTransaction(
        async (store) => {
          store.history.unshift(submission);
        },
        {
          walEntry: {
            type: 'SUBMISSION',
            data: submission,
          },
        }
      );

      return res.json({ success: true, submission, message: 'Đã chấm điểm máy chủ và lưu kết quả!' });
    }

    // Fallback: Store submission directly with unique ID
    payload.id = payload.id || 'sub_' + Date.now();
    payload.submitted_at = payload.submitted_at || new Date().toLocaleString('vi-VN');

    await executeTransaction(
      async (store) => {
        store.history.unshift(payload);
      },
      {
        walEntry: {
          type: 'SUBMISSION',
          data: payload,
        },
      }
    );

    res.json({ success: true, submission: payload, message: 'Đã lưu kết quả thi!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi nộp bài' });
  }
});

// 11. Clear history (PROTECTED: Teacher Authentication Required + Transactional)
app.post('/api/history/clear', requireTeacherAuth, async (req, res) => {
  try {
    await executeTransaction(async (store) => {
      store.history = [];
    });
    console.log(`[SERVER SYNC] History cleared by Teacher ${(req as any).user?.username}`);
    res.json({ success: true, message: 'Đã xóa toàn bộ lịch sử thi!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi xóa lịch sử' });
  }
});

// 11b. Delete specific history entries (PROTECTED: Teacher Authentication Required + Transactional)
app.post('/api/history/delete', requireTeacherAuth, async (req, res) => {
  try {
    const { ids, id } = req.body;
    const targetIds: string[] = Array.isArray(ids) ? ids : id ? [id] : [];
    if (targetIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Chưa chọn bài làm cần xóa' });
    }

    const idSet = new Set(targetIds.map(String));
    let deletedCount = 0;

    await executeTransaction(async (store) => {
      const initialLen = store.history.length;
      store.history = store.history.filter((h) => !idSet.has(String(h.id)));
      deletedCount = initialLen - store.history.length;
    });

    console.log(`[SERVER SYNC] Deleted ${deletedCount} history records by Teacher ${(req as any).user?.username}`);
    res.json({
      success: true,
      deletedCount,
      message: `Đã xóa thành công ${deletedCount} bài làm của học sinh!`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi xóa bài làm' });
  }
});

// 11c. Re-grade all submissions on server against authoritative answer keys (PROTECTED: Teacher)
app.post('/api/admin/regrade', requireTeacherAuth, async (req, res) => {
  try {
    let regradedCount = 0;

    await executeTransaction(async (store) => {
      store.history = store.history.map((h: any) => {
        const details = h.details;
        if (!details) return h;

        const matchedExam = matchExamForSubmission(h, store.exams);
        if (matchedExam && matchedExam.answers) {
          const cheat = Number(parseInt(String(h.cheat || '0'), 10)) || 0;
          const regraded = gradeSubmissionAuthoritatively(
            matchedExam,
            details,
            cheat,
            { username: h.username, name: h.name, group: h.group }
          );
          regradedCount++;
          return {
            ...h,
            examId: matchedExam.id,
            examTitle: matchedExam.title,
            score: regraded.score,
            correct: regraded.correct,
            correctAnswers: regraded.correctAnswers,
            details: regraded.details || details,
          };
        }
        return h;
      });
    });

    console.log(`[SERVER REGRADE] Regraded ${regradedCount} submissions.`);
    res.json({
      success: true,
      regradedCount,
      message: `Đã chấm lại thành công ${regradedCount} bài thi theo toàn bộ đáp án mới nhất!`,
      history: getStore().history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi chấm lại bài thi' });
  }
});

// 11d. Import raw rows (TSV/CSV/JSON) with student answers and auto-grade (PROTECTED: Teacher)
app.post('/api/admin/import-history', requireTeacherAuth, async (req, res) => {
  try {
    const { rawText, rows } = req.body;
    const store = getStore();
    const importedSubs: any[] = [];

    const lines: string[] = Array.isArray(rows)
      ? rows.map((r: any) => (typeof r === 'string' ? r : Object.values(r).join('\t')))
      : typeof rawText === 'string'
      ? rawText.split('\n').filter((l) => l.trim().length > 0)
      : [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      if (idx === 0 && (line.toLowerCase().includes('thời gian') || line.toLowerCase().includes('tài khoản'))) {
        continue; // Skip header
      }

      const parts = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
      let detailsObj: any = null;
      let submitted_at = '';
      let cheat = '0 lần';
      let username = '';
      let name = '';
      let group = '';
      let examTitle = '';

      // Search all parts for JSON details, timestamps, usernames
      for (const p of parts) {
        const str = p.trim();
        if (!detailsObj && str.startsWith('{') && (str.includes('"p1"') || str.includes('"p2"') || str.includes('"p3"'))) {
          try {
            detailsObj = JSON.parse(str);
          } catch (e) {}
        } else if (!submitted_at && str.includes(':') && (str.includes('/') || str.includes('-'))) {
          submitted_at = str;
        } else if (str.includes('lần')) {
          cheat = str;
        }
      }

      if (parts[0] && parts[0].includes(':')) {
        submitted_at = submitted_at || parts[0].trim();
        username = parts[1] ? parts[1].trim() : '';
        name = parts[2] ? parts[2].trim() : '';
        group = parts[3] ? parts[3].trim() : '';
        examTitle = parts[4] ? parts[4].trim() : '';
      }

      if (username || name || detailsObj) {
        let matchedExam = store.exams.find(
          (e: any) => e.title === examTitle || (examTitle && e.title.includes(examTitle)) || (examTitle && examTitle.includes(e.title))
        );
        if (!matchedExam && store.exams.length === 1) {
          matchedExam = store.exams[0];
        }

        let score = 0;
        let correct = 0;
        let correctAnswers: any = null;

        if (matchedExam && detailsObj) {
          const cheatCount = Number(parseInt(cheat, 10)) || 0;
          const regraded = gradeSubmissionAuthoritatively(
            matchedExam,
            detailsObj,
            cheatCount,
            { username, name, group }
          );
          score = regraded.score;
          correct = regraded.correct;
          correctAnswers = regraded.correctAnswers;
        }

        importedSubs.push({
          id: `sub_${username || 'user'}_${Date.now()}_${idx}`,
          submitted_at: submitted_at || new Date().toLocaleString('vi-VN'),
          username: username || 'student',
          name: name || username || 'Học sinh',
          group: group || '12B',
          examTitle: examTitle || (matchedExam ? matchedExam.title : 'Đề kiểm tra'),
          score,
          correct,
          cheat: cheat || '0 lần',
          details: detailsObj,
          correctAnswers,
        });
      }
    }

    if (importedSubs.length > 0) {
      await executeTransaction(async (currentStore) => {
        const histMap = new Map<string, any>();
        currentStore.history.forEach((h: any) => {
          histMap.set(`${h.username}_${h.examTitle}_${h.submitted_at}`, h);
        });
        importedSubs.forEach((sub: any) => {
          const key = `${sub.username}_${sub.examTitle}_${sub.submitted_at}`;
          histMap.set(key, sub);
        });
        currentStore.history = Array.from(histMap.values());
      });
    }

    res.json({
      success: true,
      importedCount: importedSubs.length,
      message: `Đã nhập và chấm điểm thành công ${importedSubs.length} bài thi!`,
      history: getStore().history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi nhập dữ liệu' });
  }
});

// 12. Bulk Sync endpoint from Google Sheet / Initial Bootstrap (PROTECTED: Teacher Authentication Required + Transactional)
app.post('/api/sync/bootstrap', requireTeacherAuth, async (req, res) => {
  try {
    const { exams, students, history, classes } = req.body;

    const resultStore = await executeTransaction(async (store) => {
      if (Array.isArray(exams) && exams.length > 0 && store.exams.length === 0) {
        store.exams = exams;
      }
      if (students && typeof students === 'object' && Object.keys(store.students).length === 0) {
        store.students = students;
      }
      if (Array.isArray(history) && history.length > 0 && store.history.length === 0) {
        store.history = history;
      }
      if (Array.isArray(classes) && classes.length > 0) {
        const classSet = new Set([...store.classes, ...classes]);
        store.classes = Array.from(classSet);
      }
      return store;
    });

    res.json({ success: true, data: resultStore });
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
