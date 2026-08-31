import { ExamItem, StudentAccount, ExamSubmission } from '../types';
import { INITIAL_EXAMS, INITIAL_STUDENTS, INITIAL_HISTORY, INITIAL_CLASSES } from '../data/initialData';

const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbyfElu762bowwlSMwB2opPi1YALh59HQk9gZ90E55n1en56mtb402oLT0590MBVN7ye/exec";

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

      const data = await res.json().catch(() => ({}));

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

    // Check student in local storage
    const localStudentsRaw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    const localStudents = localStudentsRaw ? JSON.parse(localStudentsRaw) : {};
    const lower = cleanUsername.toLowerCase();
    let foundStudent: any = localStudents[cleanUsername] || localStudents[lower];

    if (!foundStudent) {
      for (const s of Object.values(localStudents) as any[]) {
        if (!s) continue;
        const u = String(s.username || s.sbd || s.ma_hs || s.id || '').trim().toLowerCase();
        if (u === lower) {
          foundStudent = s;
          break;
        }
      }
    }

    if (foundStudent) {
      const expPass = String(foundStudent.password !== undefined ? foundStudent.password : '').trim();
      const isPassOk =
        !expPass ||
        expPass === cleanPassword ||
        expPass.toLowerCase() === cleanPassword.toLowerCase() ||
        (expPass === '123' && (!cleanPassword || cleanPassword === '123'));

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
        return { success: false, error: 'Mật khẩu Học sinh không chính xác!' };
      }
    }
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

    const data = await res.json();
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
      const sJson = await sRes.json();
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

  if (apiUrl) {
    try {
      const gRes = await fetch(`${apiUrl}?action=get_all`, { mode: 'cors', cache: 'no-cache' });
      if (gRes.ok) {
        const rawData = await gRes.json();
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
              if (s) {
                const u = String(s.username || s.sbd || s.id || s.ma_hs || '').trim();
                if (u) {
                  gasStudents[u.toLowerCase()] = {
                    username: u,
                    name: String(s.name || s.ten || s.ho_ten || s.fullName || u).trim(),
                    password: String(s.password !== undefined ? s.password : s.matkhau !== undefined ? s.matkhau : '123').trim(),
                    group: String(s.group || s.lop || s.className || s.class || s.nhom || 'Chưa phân lớp').trim(),
                  };
                }
              }
            });
          } else if (typeof rawSt === 'object') {
            Object.entries(rawSt).forEach(([k, s]: [string, any]) => {
              if (s) {
                const u = String(s.username || s.sbd || k || '').trim();
                if (u) {
                  gasStudents[u.toLowerCase()] = {
                    username: u,
                    name: String(s.name || s.ten || s.ho_ten || s.fullName || u).trim(),
                    password: String(s.password !== undefined ? s.password : s.matkhau !== undefined ? s.matkhau : '123').trim(),
                    group: String(s.group || s.lop || s.className || s.class || s.nhom || 'Chưa phân lớp').trim(),
                  };
                }
              }
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

  const mergedStudents = { ...localStudents, ...gasStudents, ...serverStudents };
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
  [...localHistory, ...gasHistory, ...serverHistory].forEach((h) => {
    if (h && h.username && h.examTitle) {
      const key = `${h.username}_${h.examTitle}_${h.submitted_at}`;
      historyMap.set(key, h);
    }
  });
  const mergedHistory = Array.from(historyMap.values());
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
        const data = await res.json();
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
    message: 'Đã lưu và đồng bộ danh sách học sinh thành công!',
  };
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

  try {
    const res = await fetch('/api/exams/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: data?.error || `Máy chủ phản hồi mã lỗi HTTP ${res.status}`,
      };
    }

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
    } else {
      return { success: false, error: data?.error || 'Máy chủ không thể hoàn tất chấm điểm' };
    }
  } catch (err: any) {
    console.error('Server-side grading submission error:', err);
    return { success: false, error: err?.message || 'Không thể kết nối đến máy chủ chấm điểm' };
  }
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
    const data = await res.json();
    try {
      window.dispatchEvent(new CustomEvent('app_data_updated', { detail: { type: 'history_deleted', ids: targetIds } }));
    } catch (e) {}
    return { success: data.success ?? true, deletedCount: data.deletedCount };
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

function getExamsData(ss) {
  var sheet = getExamSheet(ss);
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  var exams = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (r[0]) {
      try {
        exams.push({
          id: String(r[0]),
          title: String(r[1] || ''),
          duration: Number(r[2]) || 45,
          questions: r[3] ? JSON.parse(r[3]) : {},
          answers: r[4] ? JSON.parse(r[4]) : {}
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
  
  var students = {};
  for (var i = 1; i < rows.length; i++) {
    var u = String(rows[i][0] || '').trim();
    if (u) {
      students[u.toLowerCase()] = {
        username: u,
        name: String(rows[i][1] || u),
        password: String(rows[i][2] !== undefined ? rows[i][2] : '123'),
        group: String(rows[i][3] || 'Chưa phân lớp')
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
  
  var history = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) {
      history.push({
        id: String(rows[i][0]),
        submitted_at: String(rows[i][1] || ''),
        username: String(rows[i][2] || ''),
        name: String(rows[i][3] || ''),
        group: String(rows[i][4] || ''),
        examTitle: String(rows[i][5] || ''),
        score: Number(rows[i][6] || 0),
        correct: Number(rows[i][7] || 0),
        cheat: String(rows[i][8] || '0 lần')
      });
    }
  }
  return history;
}

function saveSubmissionToSheet(ss, sub) {
  var sheet = getHistorySheet(ss);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['ID', 'Thời Gian', 'Tài Khoản', 'Họ Tên', 'Lớp', 'Đề Thi', 'Điểm', 'Số Câu Đúng', 'Cảnh Báo']);
  }
  sheet.appendRow([
    sub.id || 'sub_' + new Date().getTime(),
    sub.submitted_at || new Date().toLocaleString('vi-VN'),
    sub.username,
    sub.name,
    sub.group,
    sub.examTitle,
    sub.score,
    sub.correct,
    sub.cheat
  ]);
}

function clearHistorySheet(ss) {
  var sheet = getHistorySheet(ss);
  if (sheet) {
    sheet.clearContents();
    sheet.appendRow(['ID', 'Thời Gian', 'Tài Khoản', 'Họ Tên', 'Lớp', 'Đề Thi', 'Điểm', 'Số Câu Đúng', 'Cảnh Báo']);
  }
}
`;

