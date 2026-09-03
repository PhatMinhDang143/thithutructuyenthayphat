import { ExamItem, StudentAccount, ExamSubmission } from '../types';
import { INITIAL_EXAMS, INITIAL_STUDENTS, INITIAL_HISTORY, INITIAL_CLASSES } from '../data/initialData';

const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycby3mDVDZAlmuPoP2fXwJNyQXL5kdmWgqhoEu0FPMhYf9lwj1eqNwSVSGkVzA5d2YKAP/exec";

export const getApiUrl = (): string => {
  return localStorage.getItem('app_api_url') || DEFAULT_API_URL;
};

export const setApiUrl = (url: string) => {
  localStorage.setItem('app_api_url', url.trim());
};

export const resetApiUrl = () => {
  localStorage.removeItem('app_api_url');
};

// Data Store Keys in LocalStorage
export const STORAGE_KEYS = {
  EXAMS: 'app_exams_data',
  STUDENTS: 'app_students_data',
  HISTORY: 'app_history_data',
  CLASSES: 'app_classes_data',
  LAST_SYNC: 'app_last_sync_timestamp',
  AUTH_TOKEN: 'app_auth_jwt_token',
  CURRENT_USER: 'app_current_user',
};

// ================= AUTHENTICATION SERVICES =================
// Helper function for safe JSON fetching (protects against HTML responses like 404 on GitHub Pages or Google login redirects)
export async function safeFetchJson<T = any>(res: Response): Promise<T | null> {
  if (!res) return null;
  try {
    const text = await res.text();
    if (!text || text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch (e) {
    return null;
  }
}

// Client-side scoring calculator (works seamlessly offline, on GitHub Pages, and in hybrid mode)
export function calculateScoreLocally(
  exam: ExamItem | undefined,
  details: any,
  cheatCount: number = 0
): { score: number; correct: number } {
  if (!exam || !exam.answers || !details) {
    return { score: 0, correct: 0 };
  }

  let sAns = details;
  if (typeof sAns === 'string') {
    try {
      sAns = JSON.parse(sAns);
    } catch (e) {
      sAns = { p1: {}, p2: {}, p3: {} };
    }
  }

  const cfg = exam.questions || {};
  const answers = exam.answers || { p1: {}, p2: {}, p3: {} };

  const p1Ans = answers.p1 || {};
  const p2Ans = answers.p2 || {};
  const p3Ans = answers.p3 || {};

  const p1Stu = sAns.p1 || {};
  const p2Stu = sAns.p2 || {};
  const p3Stu = sAns.p3 || {};

  const numP1 = Number(cfg.num_p1) || Object.keys(p1Ans).length || Object.keys(p1Stu).length || 0;
  const numP2 = Number(cfg.num_p2) || Object.keys(p2Ans).length || Object.keys(p2Stu).length || 0;
  const numP3 = Number(cfg.num_p3) || Object.keys(p3Ans).length || Object.keys(p3Stu).length || 0;

  let rawScore = 0;
  let correctCount = 0;

  // 1. Part I: Multiple choice
  let p1Correct = 0;
  const p1Questions = new Set<string>();
  Object.keys(p1Ans).forEach((k) => p1Questions.add(String(k)));
  Object.keys(p1Stu).forEach((k) => p1Questions.add(String(k)));
  for (let i = 1; i <= Math.max(numP1, 1); i++) {
    p1Questions.add(String(i));
  }

  const maxP1Count = Math.max(numP1, Object.keys(p1Ans).length, 1);

  p1Questions.forEach((qKey) => {
    const studentChoice = String(p1Stu[qKey] || '').trim().toUpperCase();
    const correctChoice = String(p1Ans[qKey] || '').trim().toUpperCase();
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
    Object.keys(p2Ans).forEach((k) => p2Questions.add(String(k)));
    Object.keys(p2Stu).forEach((k) => p2Questions.add(String(k)));
    for (let i = 1; i <= Math.max(numP2, 1); i++) {
      p2Questions.add(String(i));
    }

    p2Questions.forEach((qKey) => {
      const stuSub = p2Stu[qKey] || {};
      const keySub = p2Ans[qKey] || {};
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
    Object.keys(p3Ans).forEach((k) => p3Questions.add(String(k)));
    Object.keys(p3Stu).forEach((k) => p3Questions.add(String(k)));
    for (let i = 1; i <= Math.max(numP3, 1); i++) {
      p3Questions.add(String(i));
    }

    p3Questions.forEach((qKey) => {
      const rawStudentVal = String(p3Stu[qKey] || '');
      const rawCorrectVal = String(p3Ans[qKey] || '');
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

  return {
    score: finalScore,
    correct: correctCount,
  };
}

// Re-grade all submissions against latest exam answer keys
export function regradeAllSubmissionsLocally(
  submissions: ExamSubmission[],
  exams: ExamItem[]
): { updatedSubmissions: ExamSubmission[]; regradedCount: number } {
  const normTitle = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

  let regradedCount = 0;
  const updatedSubmissions = submissions.map((sub) => {
    const subId = sub.examId ? String(sub.examId).trim() : '';
    const subTitle = normTitle(sub.examTitle);

    let matchedExam: ExamItem | undefined;
    if (subId) {
      matchedExam = exams.find((e) => e && String(e.id).trim() === subId);
    }
    if (!matchedExam && subTitle) {
      matchedExam = exams.find((e) => e && normTitle(e.title) === subTitle);
      if (!matchedExam) {
        matchedExam = exams.find((e) => {
          if (!e || !e.title) return false;
          const tNorm = normTitle(e.title);
          return tNorm.includes(subTitle) || subTitle.includes(tNorm);
        });
      }
    }

    if (matchedExam && matchedExam.answers && sub.details) {
      const cheatCount = typeof sub.cheat === 'number' ? sub.cheat : parseInt(String(sub.cheat || '0'), 10) || 0;
      const res = calculateScoreLocally(matchedExam, sub.details, cheatCount);
      regradedCount++;
      return {
        ...sub,
        examId: matchedExam.id,
        examTitle: matchedExam.title,
        score: res.score,
        correct: res.correct,
        correctAnswers: matchedExam.answers,
      };
    }
    return sub;
  });

  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedSubmissions));

  // Trigger app data updated
  try {
    window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'history' } }));
  } catch (e) {}

  return { updatedSubmissions, regradedCount };
}

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  } catch (e) {
    return null;
  }
};

export const getStoredCurrentUser = (): any => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const loginUser = async (
  username: string,
  password?: string
): Promise<{ success: boolean; user?: any; token?: string; error?: string }> => {
  const cleanUsername = (username || '').trim();
  const cleanPassword = typeof password === 'string' ? password.trim() : '';

  if (!cleanUsername) {
    return {
      success: false,
      error: 'Vui lòng nhập Tên đăng nhập hoặc Số báo danh (SBD)!',
    };
  }

  // 1. Try server API with automatic retry (handles container cold-start / wake-up smoothly)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = (await safeFetchJson(res)) || {};

      if (res.ok && data.success && data.user) {
        if (data.token) {
          safeSetItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
        }
        safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
        return {
          success: true,
          user: data.user,
          token: data.token,
        };
      } else if (res.status === 400 || res.status === 401 || res.status === 403) {
        // Definite rejection (wrong password / account not found on server)
        return {
          success: false,
          error: data.error || 'Tài khoản hoặc mật khẩu không chính xác!',
        };
      }
    } catch (err: any) {
      if (attempt === 1) {
        // Wait 600ms and retry once if network cold start
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      console.warn('Backend login temporarily unreachable, checking offline store:', err);
    }
  }

  // 2. Offline / Local Storage fallback if server is temporarily unreachable
  try {
    // Check Teacher Accounts fallback
    if (cleanUsername.toLowerCase() === 'minhphat' && cleanPassword === '12345') {
      const teacherObj = {
        username: 'Minhphat',
        name: 'Đặng Minh Phát',
        group: 'Giáo Viên Quản Trị',
        role: 'teacher',
      };
      safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(teacherObj));
      return { success: true, user: teacherObj };
    }
    if (cleanUsername.toLowerCase() === 'admin' && cleanPassword === 'admin') {
      const teacherObj = {
        username: 'admin',
        name: 'Quản Trị Viên Hệ Thống',
        group: 'Ban Giám Hiệu',
        role: 'teacher',
      };
      safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(teacherObj));
      return { success: true, user: teacherObj };
    }
    if (cleanUsername.toLowerCase() === 'giaovien' && cleanPassword === '123') {
      const teacherObj = {
        username: 'giaovien',
        name: 'Giáo Viên Bộ Môn',
        group: 'Tổ Chuyên Môn',
        role: 'teacher',
      };
      safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(teacherObj));
      return { success: true, user: teacherObj };
    }

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

    // Check student in local storage
    const localStudentsRaw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    const localStudents = localStudentsRaw ? JSON.parse(localStudentsRaw) : {};
    const lower = cleanUsername.toLowerCase();
    const normInput = normalizeAccents(cleanUsername);
    let foundStudent: any = localStudents[cleanUsername] || localStudents[lower];

    if (!foundStudent) {
      for (const s of Object.values(localStudents) as any[]) {
        if (!s) continue;
        const u = String(s.username || s.sbd || s.ma_hs || s.id || '').trim().toLowerCase();
        const n = String(s.name || '').trim().toLowerCase();
        if (u === lower || n === lower) {
          foundStudent = s;
          break;
        }
        if (normalizeAccents(u) === normInput || normalizeAccents(n) === normInput) {
          foundStudent = s;
          break;
        }
      }
    }

    if (foundStudent) {
      const expPass = String(foundStudent.password !== undefined && foundStudent.password !== null ? foundStudent.password : '').trim();
      const isPassOk =
        !expPass ||
        (cleanPassword !== '' &&
          (expPass === cleanPassword ||
            expPass.toLowerCase() === cleanPassword.toLowerCase() ||
            normalizeAccents(expPass) === normalizeAccents(cleanPassword)));

      if (isPassOk) {
        const studentObj = {
          username: foundStudent.username || cleanUsername,
          name: foundStudent.name || cleanUsername,
          group: foundStudent.group || foundStudent.className || 'Chưa phân lớp',
          role: 'student',
        };
        safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(studentObj));
        return { success: true, user: studentObj };
      } else {
        return { success: false, error: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại!' };
      }
    }

    return {
      success: false,
      error: 'Tài khoản không tồn tại trong danh sách học sinh. Vui lòng kiểm tra lại Tên đăng nhập / Số báo danh!',
    };
  } catch (fallbackErr) {
    console.error('Local fallback login error:', fallbackErr);
  }

  return {
    success: false,
    error: 'Không thể kết nối đến máy chủ xác thực. Vui lòng bấm Đăng nhập lại hoặc làm bài với tư cách Khách!',
  };
};

export const logoutUser = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  } catch (e) {}
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Safe localStorage setter with QuotaExceededError handling & draft garbage collection
export const safeSetItem = (key: string, value: string): { success: boolean; error?: string } => {
  try {
    localStorage.setItem(key, value);
    return { success: true };
  } catch (e: any) {
    const isQuotaError =
      e &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014);

    if (isQuotaError) {
      console.warn('LocalStorage quota exceeded. Cleaning temporary drafts...');
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('exam_draft_') || k.startsWith('temp_'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        localStorage.setItem(key, value);
        return { success: true };
      } catch (retryErr: any) {
        console.error('LocalStorage save failed after draft cleanup:', retryErr);
        return {
          success: false,
          error:
            'Bộ nhớ trình duyệt đã đầy. Khuyến khích sử dụng link chia sẻ Google Drive cho file PDF để dữ liệu luôn đồng bộ mượt mà!',
        };
      }
    }
    return { success: false, error: e?.message || 'Không thể lưu vào bộ nhớ trình duyệt.' };
  }
};

// Helper to get local exams safely
export const getLocalExams = (): ExamItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXAMS);
    if (!raw) return INITIAL_EXAMS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_EXAMS;
  } catch (e) {
    return INITIAL_EXAMS;
  }
};

// Helper to get local history safely
export const getLocalHistory = (): ExamSubmission[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) return INITIAL_HISTORY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_HISTORY;
  } catch (e) {
    return INITIAL_HISTORY;
  }
};

// Initialize local storage if empty
export const initLocalStorageIfEmpty = () => {
  if (!localStorage.getItem(STORAGE_KEYS.EXAMS)) {
    safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(INITIAL_EXAMS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
    safeSetItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.HISTORY)) {
    safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(INITIAL_HISTORY));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
    safeSetItem(STORAGE_KEYS.CLASSES, JSON.stringify(INITIAL_CLASSES));
  }
};

// Upload PDF directly to Google Drive via Google Apps Script
export const uploadPdfToGoogleDrive = async (
  base64Data: string,
  fileName: string
): Promise<{
  success: boolean;
  fileId?: string;
  fileUrl?: string;
  previewUrl?: string;
  directUrl?: string;
  message?: string;
  error?: string;
}> => {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return {
      success: false,
      error: 'Chưa cấu hình Google Apps Script API URL. Vui lòng kiểm tra lại cài đặt.',
    };
  }

  try {
    const payload = {
      action: 'upload_to_drive',
      base64: base64Data,
      fileName: fileName || `De_Thi_${Date.now()}.pdf`,
    };

    const res = await fetch(`${apiUrl}?action=upload_to_drive`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Lỗi kết nối Apps Script: HTTP ${res.status}. Vui lòng kiểm tra lại URL API.`,
      };
    }

    const data = await safeFetchJson(res);
    if (data && data.success && (data.previewUrl || data.fileUrl)) {
      return {
        success: true,
        fileId: data.fileId,
        fileUrl: data.fileUrl,
        previewUrl: data.previewUrl,
        directUrl: data.directUrl,
        message: data.message || 'Đã lưu file thành công vào thư mục Google Drive!',
      };
    } else {
      return {
        success: false,
        error: data?.error || 'Google Apps Script không thể lưu file vào Google Drive.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Không thể kết nối đến Google Apps Script (${err?.message || err}).`,
    };
  }
};

// ================= FETCH ALL DATA (MULTI-TIER SYNCHRONIZATION) =================
// 1. Fetches from /api/all (Instant Server-side Central Database shared across all browsers)
// 2. Fetches from Google Apps Script (Long-term Cloud Sheet backup)
// 3. Merges with local storage, ensuring newer remote edits (like deadline / config updates) always take precedence!
export const fetchAllData = async (
  userRole?: 'student' | 'teacher' | 'guest'
): Promise<{
  exams: ExamItem[];
  students: { [username: string]: StudentAccount };
  history: ExamSubmission[];
  classes: string[];
  cloudSynced: boolean;
}> => {
  initLocalStorageIfEmpty();
  const localExams = getLocalExams();
  const localExamsMap = new Map<string, ExamItem>();
  localExams.forEach((ex) => {
    if (ex && ex.id) localExamsMap.set(ex.id, ex);
  });

  let serverExams: ExamItem[] = [];
  let serverStudents: { [username: string]: StudentAccount } = {};
  let serverHistory: ExamSubmission[] = [];
  let serverClasses: string[] = [];
  let serverFetched = false;

  // Tier 1: Fetch from internal server /api/all with user role and authorization token
  try {
    const roleParam = userRole ? `?role=${encodeURIComponent(userRole)}` : '';
    const headers = getAuthHeaders();
    if (userRole === 'teacher') {
      headers['x-user-role'] = 'teacher';
    }
    const sRes = await fetch(`/api/all${roleParam}`, {
      cache: 'no-cache',
      headers,
    });
    if (sRes.ok) {
      const sJson = await safeFetchJson(sRes);
      if (sJson && sJson.success && sJson.data) {
        serverFetched = true;
        if (Array.isArray(sJson.data.exams)) serverExams = sJson.data.exams;
        if (sJson.data.students && typeof sJson.data.students === 'object') serverStudents = sJson.data.students;
        if (Array.isArray(sJson.data.history)) serverHistory = sJson.data.history;
        if (Array.isArray(sJson.data.classes)) serverClasses = sJson.data.classes;
      }
    }
  } catch (e) {
    // server route fallback
  }

  // Tier 2: Fetch from Google Apps Script if configured
  const apiUrl = getApiUrl();
  let gasSynced = false;
  let gasExams: ExamItem[] = [];
  let gasStudents: { [username: string]: StudentAccount } = {};
  let gasHistory: ExamSubmission[] = [];

  // Helper to normalize and auto-heal student object (prevent inverted Name vs Password)
  const normalizeStudent = (raw: any, defaultKey?: string): StudentAccount | null => {
    if (!raw) return null;
    const u = String(raw.username || raw.sbd || raw.id || raw.ma_hs || defaultKey || '').trim();
    if (!u) return null;

    let n = String(raw.name || raw.ten || raw.ho_ten || raw.fullName || u).trim();
    let p = String(raw.password !== undefined ? raw.password : raw.matkhau !== undefined ? raw.matkhau : '').trim();
    const g = String(raw.group || raw.lop || raw.className || raw.class || raw.nhom || 'Chưa phân lớp').trim();

    // If password contains spaces/Vietnamese accents while name does NOT -> they were inverted!
    const pHasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(p) || p.includes(' ');
    const nNoVietnamese = !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(n) && !n.includes(' ');

    if (pHasVietnamese && nNoVietnamese && n.length > 0) {
      const temp = n;
      n = p;
      p = temp;
    }

    return {
      username: u,
      name: n,
      password: p,
      group: g,
    };
  };

  if (apiUrl) {
    try {
      const gRes = await fetch(`${apiUrl}?action=get_all`, { mode: 'cors', cache: 'no-cache' });
      if (gRes.ok) {
        const rawData = await safeFetchJson(gRes);
        const data = rawData?.data || rawData;
        if (data && !data.error) {
          gasSynced = true;

          // Parse gas exams
          const rawEx = data.exams || [];
          const parsedGasExams: ExamItem[] = Array.isArray(rawEx)
            ? rawEx
            : typeof rawEx === 'object'
            ? Object.values(rawEx)
            : [];
          gasExams = parsedGasExams.filter((ex) => ex && ex.id);

          // Parse gas students
          const rawSt = data.students || {};
          if (Array.isArray(rawSt)) {
            rawSt.forEach((s: any) => {
              const norm = normalizeStudent(s);
              if (norm) gasStudents[norm.username.toLowerCase()] = norm;
            });
          } else if (typeof rawSt === 'object') {
            Object.entries(rawSt).forEach(([k, s]: [string, any]) => {
              const norm = normalizeStudent(s, k);
              if (norm) gasStudents[norm.username.toLowerCase()] = norm;
            });
          }

          // Parse gas history
          const rawH = data.history || [];
          gasHistory = Array.isArray(rawH) ? rawH : typeof rawH === 'object' ? Object.values(rawH) : [];
        }
      }
    } catch (e) {
      console.warn("GAS API get_all fetch warning:", e);
    }
  }

  // === SMART CONSOLIDATION OF EXAMS ===
  // Primary authoritative source: Server > Google Apps Script > Local
  const combinedMap = new Map<string, ExamItem>();

  // 1. Load initial/local exams first as baseline
  localExams.forEach((ex) => {
    if (ex && ex.id) combinedMap.set(ex.id, ex);
  });

  // 2. Merge Google Apps Script exams
  gasExams.forEach((gEx) => {
    if (!gEx || !gEx.id) return;
    const local = localExamsMap.get(gEx.id);
    const existingFileLink = local?.questions?.file_link;

    // Retain local base64 if remote has marker [PDF_STORED_IN_BROWSER]
    let finalFile = gEx.questions?.file_link || '';
    if (finalFile === '[PDF_STORED_IN_BROWSER]' && existingFileLink) {
      finalFile = existingFileLink;
    } else if (!finalFile && existingFileLink) {
      finalFile = existingFileLink;
    }

    combinedMap.set(gEx.id, {
      ...gEx,
      duration: Number(gEx.duration) || 45,
      questions: {
        ...(gEx.questions || {}),
        file_link: finalFile,
      },
    });
  });

  // 3. Merge Server exams (Highest Priority across all connected browsers)
  serverExams.forEach((sEx) => {
    if (!sEx || !sEx.id) return;
    const local = localExamsMap.get(sEx.id);
    const existingFileLink = local?.questions?.file_link;

    let finalFile = sEx.questions?.file_link || '';
    if (finalFile === '[PDF_STORED_IN_BROWSER]' && existingFileLink) {
      finalFile = existingFileLink;
    } else if (!finalFile && existingFileLink) {
      finalFile = existingFileLink;
    }

    combinedMap.set(sEx.id, {
      ...sEx,
      duration: Number(sEx.duration) || 45,
      questions: {
        ...(sEx.questions || {}),
        file_link: finalFile,
      },
    });
  });

  const finalExams = Array.from(combinedMap.values());
  const finalExamsList = finalExams.length > 0 ? finalExams : INITIAL_EXAMS;

  // Protect student client storage: Strip answers if current session is student or guest
  const storageExamsList = userRole === 'teacher'
    ? finalExamsList
    : finalExamsList.map((e) => {
        const { answers, ...safe } = e;
        return safe as ExamItem;
      });

  safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(storageExamsList));

  // If server had 0 exams but local/gas had exams, bootstrap the server store
  if (serverFetched && serverExams.length === 0 && finalExamsList.length > 0 && userRole === 'teacher') {
    fetch('/api/sync/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exams: finalExamsList }),
    }).catch(() => {});
  }

  // === SMART CONSOLIDATION OF STUDENTS ===
  let localStudents: { [username: string]: StudentAccount } = {};
  try {
    const rawLocalStudents = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS) || '{}');
    if (typeof rawLocalStudents === 'object' && !Array.isArray(rawLocalStudents)) {
      localStudents = rawLocalStudents;
    }
  } catch (e) {
    localStudents = {};
  }

  // Authoritative priority: Server (which syncs with Sheet) > Google Apps Script > Local
  let rawMerged: { [username: string]: any } = {};
  if (Object.keys(serverStudents).length > 0) {
    rawMerged = { ...serverStudents };
  } else if (Object.keys(gasStudents).length > 0) {
    rawMerged = { ...gasStudents };
  } else {
    rawMerged = { ...localStudents };
  }

  const mergedStudents: { [username: string]: StudentAccount } = {};
  Object.entries(rawMerged).forEach(([k, s]) => {
    const norm = normalizeStudent(s, k);
    if (norm && norm.username) {
      mergedStudents[norm.username.toLowerCase()] = norm;
    }
  });
  safeSetItem(STORAGE_KEYS.STUDENTS, JSON.stringify(mergedStudents));

  // === SMART CONSOLIDATION OF HISTORY ===
  let localHistory: ExamSubmission[] = [];
  try {
    const rawLocalH = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    if (Array.isArray(rawLocalH)) localHistory = rawLocalH;
  } catch (e) {
    localHistory = [];
  }

  const historyMap = new Map<string, ExamSubmission>();
  const normalizeExamTitle = (t?: string) => (t || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // Process in order: Local -> GAS -> Server (Server has highest authority for graded results)
  [...localHistory, ...gasHistory, ...serverHistory].forEach((h) => {
    if (h && h.username && h.examTitle) {
      const key = `${h.username}_${h.examTitle}_${h.submitted_at}`;
      const existing = historyMap.get(key);

      const mergedDetails = h.details || existing?.details;
      const mergedCorrectAnswers = h.correctAnswers || existing?.correctAnswers;
      const finalScore = h.score !== undefined && h.score !== 0 ? h.score : (existing?.score || h.score || 0);
      const finalCorrect = h.correct !== undefined && h.correct !== 0 ? h.correct : (existing?.correct || h.correct || 0);

      historyMap.set(key, {
        ...(existing || {}),
        ...h,
        score: finalScore,
        correct: finalCorrect,
        details: mergedDetails,
        correctAnswers: mergedCorrectAnswers,
      });
    }
  });

  const mergedHistory = Array.from(historyMap.values()).map((h) => {
    if (!h.correctAnswers) {
      const matched = [...finalExamsList, ...gasExams].find(
        (e) => (e.id && e.id === h.examId) ||
               normalizeExamTitle(e.title) === normalizeExamTitle(h.examTitle) ||
               normalizeExamTitle(e.title).includes(normalizeExamTitle(h.examTitle)) ||
               normalizeExamTitle(h.examTitle).includes(normalizeExamTitle(e.title))
      );
      if (matched && matched.answers) {
        return {
          ...h,
          correctAnswers: matched.answers,
        };
      }
    }
    return h;
  });

  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(mergedHistory));

  // === DEDUCE UNIQUE CLASSES ===
  const classSet = new Set<string>(INITIAL_CLASSES);
  if (Array.isArray(serverClasses)) {
    serverClasses.forEach((c) => c && classSet.add(c.trim()));
  }
  Object.values(mergedStudents).forEach((s) => {
    if (s && s.group && s.group.trim()) classSet.add(s.group.trim());
  });
  finalExamsList.forEach((ex) => {
    if (ex?.questions?.target_group) {
      ex.questions.target_group.split(',').forEach((g) => {
        const trimmed = g.trim();
        if (trimmed && trimmed.toLowerCase() !== 'tất cả' && trimmed.toLowerCase() !== 'all') {
          classSet.add(trimmed);
        }
      });
    }
  });

  const classesList = Array.from(classSet);
  safeSetItem(STORAGE_KEYS.CLASSES, JSON.stringify(classesList));

  return {
    exams: storageExamsList,
    students: mergedStudents,
    history: mergedHistory,
    classes: classesList,
    cloudSynced: serverFetched || gasSynced,
  };
};

// ================= SAVE EXAM DATA (ALL BROWSERS & CLOUD) =================
export const saveExamData = async (
  examPayload: ExamItem
): Promise<{ success: boolean; cloudSynced: boolean; message: string }> => {
  initLocalStorageIfEmpty();

  // Normalize duration & timestamps
  const now = Date.now();
  examPayload.duration = Math.max(1, Number(examPayload.duration) || 45);
  examPayload.updatedAt = now;

  // 1. Update Client LocalStorage
  const localExams = getLocalExams();
  const idx = localExams.findIndex((e) => e.id === examPayload.id);
  if (idx >= 0) {
    const existing = localExams[idx];
    const finalFileLink = examPayload.questions?.file_link || existing.questions?.file_link || '';
    const finalExplainLink =
      examPayload.questions?.explain_link !== undefined
        ? examPayload.questions.explain_link
        : existing.questions?.explain_link || '';

    localExams[idx] = {
      ...existing,
      ...examPayload,
      updatedAt: now,
      duration: Number(examPayload.duration) || 45,
      questions: {
        ...(existing.questions || {}),
        ...(examPayload.questions || {}),
        file_link: finalFileLink,
        explain_link: finalExplainLink,
      },
    };
  } else {
    localExams.unshift(examPayload);
  }

  safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(localExams));

  // Re-grade local history immediately against the updated exam list
  const currentHistory = getLocalHistory();
  if (currentHistory && currentHistory.length > 0) {
    try {
      regradeAllSubmissionsLocally(currentHistory, localExams);
    } catch (e) {
      console.warn('Local regrade error on exam save:', e);
    }
  }

  // 2. Synchronize to Server Backend (Instant Cross-Browser Sync with Auth)
  let serverSynced = false;
  try {
    const sRes = await fetch('/api/exams/save', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(examPayload),
    });
    if (sRes.ok) {
      serverSynced = true;
      const data = await safeFetchJson(sRes);
      if (data && Array.isArray(data.history) && data.history.length > 0) {
        safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(data.history));
      }
    }
  } catch (e) {
    console.warn('Server API /api/exams/save failed:', e);
  }

  // 3. Synchronize to Google Apps Script Web App API
  const apiUrl = getApiUrl();
  let gasSynced = false;
  let cloudErrorMsg = '';

  if (apiUrl) {
    try {
      const cloudPayload = { ...examPayload, duration: Number(examPayload.duration) || 45, updatedAt: now };
      if (cloudPayload.questions?.file_link?.startsWith('data:')) {
        cloudPayload.questions = {
          ...cloudPayload.questions,
          file_link: '[PDF_STORED_IN_BROWSER]',
        };
      }

      const res = await fetch(`${apiUrl}?action=save_exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(cloudPayload),
      });

      if (res.ok) {
        const data = await safeFetchJson(res);
        if (data && (data.success || !data.error)) {
          gasSynced = true;
        } else {
          cloudErrorMsg = data?.message || data?.error || 'Google Sheet từ chối cập nhật';
        }
      }
    } catch (e: any) {
      console.warn('GAS API save_exam warning:', e);
      cloudErrorMsg = e?.message || 'Không thể kết nối đến Google Apps Script';
    }
  }

  // Trigger cross-tab sync event
  try {
    window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'exam', id: examPayload.id } }));
  } catch (e) {}

  return {
    success: true,
    cloudSynced: serverSynced || gasSynced,
    message: 'Đã lưu cấu hình & hạn chót đề thi thành công! Dữ liệu được đồng bộ tức thì trên toàn bộ trình duyệt.',
  };
};

// ================= DELETE EXAM DATA =================
export const deleteExamData = async (
  examId: string
): Promise<{ success: boolean; message: string }> => {
  initLocalStorageIfEmpty();
  const localExams = getLocalExams();
  const updated = localExams.filter((e) => e.id !== examId);
  safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(updated));

  // Server API (Authenticated)
  try {
    await fetch('/api/exams/delete', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: examId }),
    });
  } catch (e) {}

  // GAS API
  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}?action=delete_exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ id: examId }),
      });
    } catch (e) {}
  }

  try {
    window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'exam_delete', id: examId } }));
  } catch (e) {}

  return { success: true, message: 'Đã xóa đề thi thành công!' };
};

// ================= SAVE STUDENTS DATA =================
export const saveStudentsData = async (
  studentsObj: { [username: string]: StudentAccount }
): Promise<{ success: boolean; cloudSynced: boolean; message: string }> => {
  initLocalStorageIfEmpty();
  safeSetItem(STORAGE_KEYS.STUDENTS, JSON.stringify(studentsObj));

  let serverSynced = false;
  try {
    const sRes = await fetch('/api/students/save', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ students: studentsObj }),
    });
    if (sRes.ok) serverSynced = true;
  } catch (e) {}

  const apiUrl = getApiUrl();
  let gasSynced = false;
  if (apiUrl) {
    try {
      const resp = await fetch(`${apiUrl}?action=save_students`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ students: studentsObj }),
      });
      if (resp.ok) gasSynced = true;
    } catch (e) {}
  }

  try {
    window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'students' } }));
  } catch (e) {}

  return {
    success: true,
    cloudSynced: serverSynced || gasSynced,
    message: 'Đã lưu và đồng bộ danh sách học sinh vào Google Sheet & Server thành công!',
  };
};

// ================= TRIGGER IMMEDIATE SERVER SYNC WITH GOOGLE SHEET =================
export const triggerServerSync = async (): Promise<{ success: boolean; message: string; count?: number }> => {
  // 1. Try internal backend server if available
  try {
    const res = await fetch('/api/sync/refresh', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await safeFetchJson(res);
      if (data && data.success) {
        try {
          window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'refresh' } }));
        } catch (e) {}
        return { success: true, message: data.message || 'Đã đồng bộ từ Google Sheet thành công!', count: data.studentsCount };
      }
    }
  } catch (e) {}

  // 2. Direct client-side sync fallback (for GitHub Pages / static hosting)
  try {
    const freshData = await fetchAllData('teacher');
    const studentsCount = freshData.students ? Object.keys(freshData.students).length : 0;
    try {
      window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'refresh' } }));
    } catch (e) {}
    return {
      success: true,
      message: `Đã đồng bộ trực tiếp từ Google Sheet thành công! (${studentsCount} học sinh)`,
      count: studentsCount,
    };
  } catch (err: any) {
    return { success: false, message: 'Lỗi khi đồng bộ Google Sheet: ' + (err?.message || 'Kiểm tra đường truyền') };
  }
};

// ================= AUTHORITATIVE SERVER-SIDE EXAM SUBMISSION =================
export const submitExamAnswersToServer = async (payload: {
  examId: string;
  examTitle: string;
  username: string;
  name: string;
  group: string;
  studentAnswers: any;
  cheatCount: number;
}): Promise<{ success: boolean; submission?: ExamSubmission; error?: string }> => {
  initLocalStorageIfEmpty();

  // 1. Try server-side grading route
  try {
    const res = await fetch('/api/exams/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await safeFetchJson(res);
      if (data && data.success && data.submission) {
        const gradedSubmission: ExamSubmission = data.submission;

        // Update client local history
        let localHistory: ExamSubmission[] = [];
        try {
          localHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
        } catch (e) {
          localHistory = [];
        }
        localHistory.unshift(gradedSubmission);
        safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(localHistory));

        // Asynchronously forward to Google Apps Script backup if configured
        const apiUrl = getApiUrl();
        if (apiUrl) {
          fetch(`${apiUrl}?action=submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(gradedSubmission),
          }).catch((gasErr) => console.warn('GAS backup sync failed:', gasErr));
        }

        try {
          window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'history' } }));
        } catch (e) {}

        return { success: true, submission: gradedSubmission };
      }
    }
  } catch (err: any) {}

  // 2. Client-side fallback grading (when running statically on GitHub Pages)
  const localExams = getLocalExams();
  const matchedExam = localExams.find((e) => e.id === payload.examId || e.title === payload.examTitle);
  const graded = calculateScoreLocally(matchedExam, payload.studentAnswers, payload.cheatCount);

  const gradedSubmission: ExamSubmission = {
    id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    examId: payload.examId,
    examTitle: payload.examTitle,
    username: payload.username,
    name: payload.name,
    group: payload.group,
    score: graded.score,
    correct: graded.correct,
    cheat: `${payload.cheatCount || 0} lần`,
    submitted_at: new Date().toLocaleString('vi-VN'),
    details: payload.studentAnswers,
    correctAnswers: matchedExam?.answers,
  };

  let localHistory: ExamSubmission[] = [];
  try {
    localHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
  } catch (e) {
    localHistory = [];
  }
  localHistory.unshift(gradedSubmission);
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(localHistory));

  const apiUrl = getApiUrl();
  if (apiUrl) {
    fetch(`${apiUrl}?action=submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(gradedSubmission),
    }).catch(() => {});
  }

  try {
    window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'history' } }));
  } catch (e) {}

  return { success: true, submission: gradedSubmission };
};

// ================= SUBMIT EXAM RESULT =================
export const submitExamResult = async (payload: ExamSubmission): Promise<{ success: boolean; submission?: ExamSubmission }> => {
  initLocalStorageIfEmpty();
  let localHistory: ExamSubmission[] = [];
  try {
    localHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
  } catch (e) {
    localHistory = [];
  }

  payload.id = payload.id || 'sub_' + Date.now();
  if (!payload.submitted_at) {
    payload.submitted_at = new Date().toLocaleString('vi-VN');
  }

  localHistory.unshift(payload);
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(localHistory));

  // Server API
  try {
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {}

  // GAS API
  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}?action=submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch (e) {}
  }

  try {
    window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'history' } }));
  } catch (e) {}

  return { success: true, submission: payload };
};

// ================= CLEAR HISTORY =================
export const clearExamHistory = async (): Promise<{ success: boolean }> => {
  initLocalStorageIfEmpty();
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));

  try {
    await fetch('/api/history/clear', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch (e) {}

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}?action=clear_history`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({}),
      });
    } catch (e) {}
  }

  try {
    window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'history_clear' } }));
  } catch (e) {}

  return { success: true };
};

// ================= DELETE SPECIFIC HISTORY ENTRIES =================
export const deleteHistoryEntries = async (ids: string[] | string): Promise<{ success: boolean; deletedCount?: number }> => {
  initLocalStorageIfEmpty();
  const targetIds = Array.isArray(ids) ? ids.map(String) : [String(ids)];
  const idSet = new Set(targetIds);

  // 1. Update local storage
  let currentHistory: ExamSubmission[] = [];
  try {
    currentHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
  } catch (e) {
    currentHistory = [];
  }
  const updatedHistory = currentHistory.filter((h: any) => !idSet.has(String(h.id)));
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));

  // 2. Call backend API
  try {
    const res = await fetch('/api/history/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ ids: targetIds }),
    });
    const data = await safeFetchJson(res);
    try {
      window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'history_deleted', ids: targetIds } }));
    } catch (e) {}
    return { success: data?.success ?? true, deletedCount: data?.deletedCount ?? targetIds.length };
  } catch (e) {
    try {
      window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'history_deleted', ids: targetIds } }));
    } catch (ev) {}
    return { success: true, deletedCount: targetIds.length };
  }
};

// Full Google Apps Script Code.gs Template for Teachers
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG THI TRỰC TUYẾN (HỖ TRỢ LƯU FILE GOOGLE DRIVE & ĐỒNG BỘ ĐỀ THI)
 * Hướng dẫn cài đặt / Cập nhật:
 * 1. Mở Google Sheet -> Chọn Tiện ích mở rộng (Extensions) -> Apps Script
 * 2. Xóa toàn bộ mã cũ và dán toàn bộ đoạn mã này vào file Code.gs.
 * 3. [QUAN TRỌNG ĐỂ CẤP QUYỀN DRIVE]:
 *    - Ở thanh công cụ trên cùng của Apps Script, chọn hàm "testAuthorizeDrive" và bấm nút "Chạy" (Run ▶️).
 *    - Google sẽ hiện popup "Cần có sự ủy quyền" -> Bấm "Xem lại quyền" -> Chọn tài khoản của bạn -> Bấm "Nâng cao" (Advanced) -> "Đi tới Dự án (không an toàn)" -> "Cho phép" (Allow).
 * 4. Bấm "Triển khai" (Deploy) -> "Quản lý tùy chọn triển khai" (Manage deployments)
 *    -> Bấm biểu tượng cây bút (Chỉnh sửa) -> Chọn Phiên bản: "Mới" (New version) -> Bấm "Triển khai" (Deploy).
 */

function testAuthorizeDrive() {
  var folderName = 'DeThi_Online_Drive';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  Logger.log('Đã cấp quyền Google Drive thành công! Thư mục: ' + folder.getName());
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'get_all';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'get_all') {
    var data = {
      exams: getExamsData(ss),
      students: getStudentsData(ss),
      history: getHistoryData(ss)
    };
    return createJsonResponse({ success: true, data: data });
  }
  
  return createJsonResponse({ success: false, error: 'Hành động không hợp lệ: ' + action });
}

function doPost(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        postData = {};
      }
    }
    if (!action && postData.action) {
      action = postData.action;
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. TẢI FILE PDF LÊN GOOGLE DRIVE
    if (action === 'upload_to_drive' || action === 'upload_file') {
      return createJsonResponse(uploadFileToDrive(postData));
    }
    
    // 2. LƯU CẤU HÌNH ĐỀ THI
    if (action === 'save_exam') {
      saveExamToSheet(ss, postData);
      return createJsonResponse({ success: true, message: 'Đã lưu đề thi thành công' });
    }
    
    // 3. XÓA ĐỀ THI
    if (action === 'delete_exam') {
      deleteExamFromSheet(ss, postData.id);
      return createJsonResponse({ success: true, message: 'Đã xóa đề thi thành công' });
    }
    
    // 4. LƯU DANH SÁCH HỌC SINH
    if (action === 'save_students') {
      saveStudentsToSheet(ss, postData.students);
      return createJsonResponse({ success: true, message: 'Đã lưu danh sách học sinh' });
    }
    
    // 5. NỘP BÀI THI
    if (action === 'submit') {
      saveSubmissionToSheet(ss, postData);
      return createJsonResponse({ success: true, message: 'Đã lưu kết quả thi' });
    }
    
    // 6. XÓA NHẬT KÝ THI
    if (action === 'clear_history') {
      clearHistorySheet(ss);
      return createJsonResponse({ success: true, message: 'Đã xóa nhật ký thi' });
    }
    
    return createJsonResponse({ success: false, error: 'Hành động POST không hợp lệ: ' + action });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function uploadFileToDrive(postData) {
  try {
    var rawName = postData.fileName || ('De_Thi_' + new Date().getTime() + '.pdf');
    var base64Data = postData.base64 || '';
    
    if (!base64Data) {
      return { success: false, error: 'Không tìm thấy dữ liệu file base64' };
    }
    
    if (base64Data.indexOf('base64,') > -1) {
      base64Data = base64Data.split('base64,')[1];
    }
    
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, 'application/pdf', rawName);
    
    var folderName = 'DeThi_Online_Drive';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    var fileUrl = file.getUrl();
    var previewUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';
    var directUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;
    
    return {
      success: true,
      fileId: fileId,
      fileUrl: fileUrl,
      previewUrl: previewUrl,
      directUrl: directUrl,
      fileName: file.getName(),
      message: 'Đã tải và lưu file thành công vào thư mục Google Drive [' + folderName + ']!'
    };
  } catch (err) {
    return { success: false, error: 'Lỗi tải lên Google Drive: ' + err.toString() };
  }
}

function findSheet(ss, names) {
  for (var i = 0; i < names.length; i++) {
    var s = ss.getSheetByName(names[i]);
    if (s) return s;
  }
  return null;
}

function getExamSheet(ss) {
  return findSheet(ss, ['Exams', 'Dethi', 'DeThi', 'Đề thi', 'De_Thi']) || ss.insertSheet('Exams');
}

function getStudentSheet(ss) {
  return findSheet(ss, ['Students', 'Hocsinh', 'HocSinh', 'Học sinh', 'Danh_Sach_Hoc_Sinh']) || ss.insertSheet('Students');
}

function getHistorySheet(ss) {
  return findSheet(ss, ['History', 'Lichsu', 'LichSu', 'Lịch sử', 'Nhat_Ky_Thi']) || ss.insertSheet('History');
}

function parseAnswersFromSheet(raw) {
  if (!raw) return { p1: {}, p2: {}, p3: {} };
  if (typeof raw === 'object' && (raw.p1 || raw.p2 || raw.p3)) {
    return { p1: raw.p1 || {}, p2: raw.p2 || {}, p3: raw.p3 || {} };
  }
  var str = String(raw).trim();
  if (!str) return { p1: {}, p2: {}, p3: {} };

  // 1. Try JSON parse
  if (str.indexOf('{') === 0 && str.lastIndexOf('}') === str.length - 1) {
    try {
      var parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object') {
        return {
          p1: parsed.p1 || {},
          p2: parsed.p2 || {},
          p3: parsed.p3 || {}
        };
      }
    } catch(e) {}
  }

  // 2. Parse human-friendly format (1A 2B 3C, 1aĐ 1bS, C1: 15...)
  var p1 = {}, p2 = {}, p3 = {};

  // Part 2
  var p2Regex = /(?:câu|c)?\s*(\d+)\s*[\.\:\-\s]?\s*([abcd])\s*[\.\:\-\s]?\s*([ĐđSsTtFf]|đúng|sai|true|false)/gi;
  var m2;
  while ((m2 = p2Regex.exec(str)) !== null) {
    var qNum2 = m2[1];
    var sub2 = m2[2].toLowerCase();
    var val2 = (m2[3].toLowerCase() === 'đ' || m2[3].toLowerCase() === 'đúng' || m2[3].toLowerCase() === 't' || m2[3].toLowerCase() === 'true') ? 'Đ' : 'S';
    if (!p2[qNum2]) p2[qNum2] = {};
    p2[qNum2][sub2] = val2;
  }

  // Part 3
  var p3Regex = /(?:phần\s*3|p3|câu|c)?\s*(\d+)\s*[\:\=]\s*([^\,\;\n\r\|]+)/gi;
  var m3;
  while ((m3 = p3Regex.exec(str)) !== null) {
    var qNum3 = m3[1];
    var val3 = m3[2].trim();
    if (val3 && !/^[abcd]$/i.test(val3) && val3.length <= 20) {
      p3[qNum3] = val3;
    }
  }

  // Part 1
  var p1Regex = /(?:câu|c)?\s*(\d+)\s*[\.\:\-\s]?\s*([ABCDabcd])(?!\w)/g;
  var m1;
  while ((m1 = p1Regex.exec(str)) !== null) {
    var qNum1 = m1[1];
    var letter = m1[2].toUpperCase();
    p1[qNum1] = letter;
  }

  // Fallback: Pure sequence like "A B C D A B"
  if (Object.keys(p1).length === 0 && Object.keys(p2).length === 0 && Object.keys(p3).length === 0) {
    var tokens = str.replace(/[^A-Za-z]/g, ' ').trim().split(/\s+/);
    if (tokens.length > 0 && tokens.every(function(t) { return t.length === 1 && /^[A-Da-d]$/.test(t); })) {
      for (var k = 0; k < tokens.length; k++) {
        p1[String(k + 1)] = tokens[k].toUpperCase();
      }
    }
  }

  return { p1: p1, p2: p2, p3: p3 };
}

function getExamsData(ss) {
  var sheet = getExamSheet(ss);
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  var exams = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (r[0]) {
      try {
        var qObj = {};
        if (r[3]) {
          try { qObj = typeof r[3] === 'string' ? JSON.parse(r[3]) : r[3]; } catch(e) {}
        }
        var ansObj = parseAnswersFromSheet(r[4]);

        exams.push({
          id: String(r[0]),
          title: String(r[1] || ''),
          duration: Number(r[2]) || 45,
          questions: qObj,
          answers: ansObj
        });
      } catch(e) {}
    }
  }
  return exams;
}

function saveExamToSheet(ss, exam) {
  var sheet = getExamSheet(ss);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'Title', 'Duration', 'Questions_JSON', 'Answers_JSON', 'Updated_At']);
  }
  var data = sheet.getDataRange().getValues();
  var foundRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(exam.id)) {
      foundRow = i + 1;
      break;
    }
  }
  
  var durationVal = Number(exam.duration) || 45;
  var rowValues = [
    String(exam.id),
    String(exam.title || ''),
    durationVal,
    JSON.stringify(exam.questions || {}),
    JSON.stringify(exam.answers || {}),
    new Date().toLocaleString('vi-VN')
  ];
  
  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function deleteExamFromSheet(ss, examId) {
  var sheet = getExamSheet(ss);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(examId)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function getStudentsData(ss) {
  var sheet = getStudentSheet(ss);
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return {};
  
  // Dynamically detect column headers
  var headerRow = rows[0] || [];
  var colUser = -1, colName = -1, colPass = -1, colGroup = -1;

  for (var c = 0; c < headerRow.length; c++) {
    var h = String(headerRow[c] || '').toLowerCase().trim();
    if (colUser === -1 && (h.indexOf('sbd') > -1 || h.indexOf('user') > -1 || h.indexOf('tài khoản') > -1 || h.indexOf('tai khoan') > -1 || h.indexOf('mã') > -1 || h === 'id')) {
      colUser = c;
    } else if (colPass === -1 && (h.indexOf('pass') > -1 || h.indexOf('mật khẩu') > -1 || h.indexOf('mat khau') > -1 || h.indexOf('matkhau') > -1 || h.indexOf('mk') > -1)) {
      colPass = c;
    } else if (colName === -1 && (h.indexOf('tên') > -1 || h.indexOf('name') > -1 || h.indexOf('họ') > -1 || h.indexOf('sinh') > -1 || h.indexOf('fullname') > -1)) {
      colName = c;
    } else if (colGroup === -1 && (h.indexOf('lớp') > -1 || h.indexOf('lop') > -1 || h.indexOf('group') > -1 || h.indexOf('class') > -1 || h.indexOf('nhóm') > -1 || h.indexOf('nhom') > -1)) {
      colGroup = c;
    }
  }

  if (colUser === -1) colUser = 0;
  if (colName === -1 && colPass === -1) {
    colName = 1;
    colPass = 2;
  } else if (colName === -1) {
    colName = (colPass === 1) ? 2 : 1;
  } else if (colPass === -1) {
    colPass = (colName === 1) ? 2 : 1;
  }
  if (colGroup === -1) colGroup = 3;

  var students = {};
  for (var i = 1; i < rows.length; i++) {
    var u = String(rows[i][colUser] || '').trim();
    if (u) {
      var n = String(rows[i][colName] || u).trim();
      var p = String(rows[i][colPass] !== undefined ? rows[i][colPass] : '123').trim();
      var g = String(rows[i][colGroup] || 'Chưa phân lớp').trim();

      // Auto-detect if name and password got inverted in sheet data
      var pHasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(p) || p.indexOf(' ') > -1;
      var nNoVietnamese = !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(n) && n.indexOf(' ') === -1;
      if (pHasVietnamese && nNoVietnamese && n.length > 0) {
        var tmp = n;
        n = p;
        p = tmp;
      }

      students[u.toLowerCase()] = {
        username: u,
        name: n,
        password: p,
        group: g
      };
    }
  }
  return students;
}

function saveStudentsToSheet(ss, studentsObj) {
  var sheet = getStudentSheet(ss);
  sheet.clearContents();
  sheet.appendRow(['Username', 'Name', 'Password', 'Group', 'Updated_At']);
  
  var rows = [];
  var nowStr = new Date().toLocaleString('vi-VN');
  Object.keys(studentsObj).forEach(function(k) {
    var s = studentsObj[k];
    rows.push([s.username, s.name, s.password || '123', s.group || 'Chưa phân lớp', nowStr]);
  });
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }
}

function getHistoryData(ss) {
  var sheet = getHistorySheet(ss);
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  // Read exams to allow on-the-fly authoritative regrading if score was 0
  var examsMap = {};
  try {
    var exData = getExamsData(ss);
    for (var eIdx = 0; eIdx < exData.length; eIdx++) {
      var ex = exData[eIdx];
      if (ex && ex.title) examsMap[ex.title.trim()] = ex;
      if (ex && ex.id) examsMap[ex.id.trim()] = ex;
    }
  } catch(e) {}

  var history = [];
  var updatedRows = false;

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r || r.length === 0 || !r[0]) continue;

    var id = '';
    var submitted_at = '';
    var username = '';
    var name = '';
    var group = '';
    var examTitle = '';
    var score = 0;
    var correct = 0;
    var cheat = '0 lần';
    var detailsObj = null;

    // Scan every cell in the row to find JSON details, timestamps, cheat counts, and usernames
    for (var c = 0; c < r.length; c++) {
      var cellVal = r[c];
      if (cellVal === undefined || cellVal === null) continue;
      var strVal = String(cellVal).trim();

      if (!detailsObj && strVal.charAt(0) === '{' && (strVal.indexOf('"p1"') > -1 || strVal.indexOf('"p2"') > -1 || strVal.indexOf('"p3"') > -1)) {
        try {
          detailsObj = JSON.parse(strVal);
        } catch(err) {}
      } else if (!submitted_at && (strVal.indexOf(':') > -1 && (strVal.indexOf('/') > -1 || strVal.indexOf('-') > -1))) {
        submitted_at = strVal;
      } else if (!cheat || cheat === '0 lần') {
        if (strVal.indexOf('lần') > -1) {
          cheat = strVal;
        }
      }
    }

    // Standard or legacy column alignment
    if (r[0] && String(r[0]).indexOf('sub_') === 0) {
      id = String(r[0]);
      submitted_at = submitted_at || String(r[1] || '');
      username = String(r[2] || '');
      name = String(r[3] || '');
      group = String(r[4] || '');
      examTitle = String(r[5] || '');
      score = Number(r[6] || 0);
      correct = Number(r[7] || 0);
      cheat = cheat || String(r[8] || '0 lần');
    } else {
      // Row starts with Timestamp
      submitted_at = submitted_at || String(r[0] || '');
      username = String(r[1] || '');
      name = String(r[2] || '');
      group = String(r[3] || '');
      examTitle = String(r[4] || '');
      score = Number(r[5] || 0);
      if (typeof r[6] === 'number') {
        correct = Number(r[6] || 0);
        cheat = cheat || String(r[7] || '0 lần');
      } else {
        cheat = cheat || String(r[6] || '0 lần');
      }
      id = 'sub_' + (username ? username + '_' : '') + (submitted_at ? submitted_at.replace(/[^0-9]/g, '') : i);
    }

    // Auto-regrade if score is 0 but student answers details exist
    if (detailsObj && examTitle && (score === 0 || isNaN(score))) {
      var matchedExam = examsMap[examTitle.trim()];
      if (matchedExam && matchedExam.answers) {
        var regraded = gradeExamLocally(matchedExam, detailsObj);
        if (regraded.score > 0 || regraded.correct > 0) {
          score = regraded.score;
          correct = regraded.correct;
        }
      }
    }

    history.push({
      id: id,
      submitted_at: submitted_at,
      username: username,
      name: name,
      group: group,
      examTitle: examTitle,
      score: score,
      correct: correct,
      cheat: cheat,
      details: detailsObj
    });
  }
  return history;
}

function gradeExamLocally(exam, details) {
  var score = 0;
  var correctCount = 0;
  var answers = exam.answers || {};

  // Part 1: Multiple Choice
  var p1Ans = answers.p1 || {};
  var p1Details = details.p1 || {};
  var p1Keys = Object.keys(p1Ans);
  for (var k = 0; k < p1Keys.length; k++) {
    var qNum = p1Keys[k];
    var correctOpt = String(p1Ans[qNum] || '').trim().toUpperCase();
    var stuOpt = String(p1Details[qNum] || '').trim().toUpperCase();
    if (correctOpt && stuOpt && correctOpt === stuOpt) {
      score += 0.25;
      correctCount++;
    }
  }

  // Part 2: True/False 4 sub-items
  var p2Ans = answers.p2 || {};
  var p2Details = details.p2 || {};
  var p2Keys = Object.keys(p2Ans);
  for (var i = 0; i < p2Keys.length; i++) {
    var qNum2 = p2Keys[i];
    var correctSub = p2Ans[qNum2] || {};
    var stuSub = p2Details[qNum2] || {};
    var subCorrectCount = 0;

    ['a', 'b', 'c', 'd'].forEach(function(opt) {
      var cVal = String(correctSub[opt] || '').trim().toUpperCase();
      var sVal = String(stuSub[opt] || '').trim().toUpperCase();
      if (cVal && sVal && (cVal === sVal || (cVal === 'Đ' && sVal === 'D') || (cVal === 'S' && sVal === 'S'))) {
        subCorrectCount++;
        correctCount++;
      }
    });

    if (subCorrectCount === 1) score += 0.1;
    else if (subCorrectCount === 2) score += 0.25;
    else if (subCorrectCount === 3) score += 0.5;
    else if (subCorrectCount === 4) score += 1.0;
  }

  // Part 3: Short Numerical
  var p3Ans = answers.p3 || {};
  var p3Details = details.p3 || {};
  var p3Keys = Object.keys(p3Ans);
  for (var j = 0; j < p3Keys.length; j++) {
    var qNum3 = p3Keys[j];
    var cStr = String(p3Ans[qNum3] || '').trim().replace(',', '.');
    var sStr = String(p3Details[qNum3] || '').trim().replace(',', '.');
    if (cStr && sStr && cStr.toLowerCase() === sStr.toLowerCase()) {
      score += 0.5;
      correctCount++;
    }
  }

  score = Math.round(score * 100) / 100;
  return { score: Math.min(10, score), correct: correctCount };
}

function saveSubmissionToSheet(ss, sub) {
  var sheet = getHistorySheet(ss);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Thời Gian', 'Tài Khoản', 'Họ Tên', 'Lớp', 'Đề Thi', 'Điểm', 'Cảnh Báo', 'Chi Tiết Bài Làm']);
  }
  sheet.appendRow([
    sub.submitted_at || new Date().toLocaleString('vi-VN'),
    sub.username,
    sub.name,
    sub.group,
    sub.examTitle,
    sub.score,
    sub.cheat || '0 lần',
    JSON.stringify(sub.details || {})
  ]);
}

function clearHistorySheet(ss) {
  var sheet = getHistorySheet(ss);
  if (sheet) {
    sheet.clearContents();
    sheet.appendRow(['Thời Gian', 'Tài Khoản', 'Họ Tên', 'Lớp', 'Đề Thi', 'Điểm', 'Cảnh Báo', 'Chi Tiết Bài Làm']);
  }
}
`;

