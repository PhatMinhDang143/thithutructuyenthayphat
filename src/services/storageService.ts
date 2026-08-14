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

// Data Store in LocalStorage for smooth offline / non-script operation
const STORAGE_KEYS = {
  EXAMS: 'app_exams_data',
  STUDENTS: 'app_students_data',
  HISTORY: 'app_history_data',
  CLASSES: 'app_classes_data',
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
      console.warn('LocalStorage quota exceeded. Attempting draft cleanup...');
      // Prune all temporary exam drafts to free memory
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('exam_draft_') || k.startsWith('temp_'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        // Retry saving after pruning
        localStorage.setItem(key, value);
        return { success: true };
      } catch (retryErr: any) {
        console.error('LocalStorage save failed even after draft cleanup:', retryErr);
        return {
          success: false,
          error:
            'Dung lượng bộ nhớ trình duyệt đã đầy (giới hạn ~5MB). Nếu đề thi đính kèm file PDF dung lượng lớn, thầy cô vui lòng sử dụng link chia sẻ từ Google Drive thay vì tải file trực tiếp để đảm bảo đồng bộ cho tất cả học sinh!',
        };
      }
    }
    return { success: false, error: e?.message || 'Không thể lưu vào bộ nhớ trình duyệt.' };
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

export const fetchAllData = async (): Promise<{
  exams: ExamItem[];
  students: { [username: string]: StudentAccount };
  history: ExamSubmission[];
  classes: string[];
}> => {
  initLocalStorageIfEmpty();
  const apiUrl = getApiUrl();

  // Attempt Google Apps Script fetch if API_URL is present
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}?action=get_all`, { mode: 'cors' });
      if (res.ok) {
        const rawData = await res.json();
        const data = rawData?.data || rawData;
        if (data && !data.error) {
          // Normalize exams
          const rawExams = data.exams || [];
          const exams: ExamItem[] = Array.isArray(rawExams)
            ? rawExams
            : typeof rawExams === 'object'
            ? Object.values(rawExams)
            : [];

          // Normalize students dictionary
          const rawStudents = data.students || {};
          const normalizedStudents: { [username: string]: StudentAccount } = {};

          if (Array.isArray(rawStudents)) {
            rawStudents.forEach((s: any) => {
              if (s) {
                const u = String(s.username || s.sbd || s.id || s.ma_hs || s.tai_khoan || '').trim();
                if (u) {
                  normalizedStudents[u.toLowerCase()] = {
                    username: u,
                    name: String(s.name || s.ten || s.ho_ten || s.fullName || u).trim(),
                    password: String(s.password !== undefined ? s.password : s.matkhau !== undefined ? s.matkhau : '123').trim(),
                    group: String(s.group || s.lop || s.className || s.class || s.nhom || 'Chưa phân lớp').trim(),
                  };
                }
              }
            });
          } else if (typeof rawStudents === 'object') {
            Object.entries(rawStudents).forEach(([k, s]: [string, any]) => {
              if (s) {
                const u = String(s.username || s.sbd || k || '').trim();
                if (u) {
                  normalizedStudents[u.toLowerCase()] = {
                    username: u,
                    name: String(s.name || s.ten || s.ho_ten || s.fullName || u).trim(),
                    password: String(s.password !== undefined ? s.password : s.matkhau !== undefined ? s.matkhau : '123').trim(),
                    group: String(s.group || s.lop || s.className || s.class || s.nhom || 'Chưa phân lớp').trim(),
                  };
                }
              }
            });
          }

          // Normalize history
          const rawHistory = data.history || [];
          const history: ExamSubmission[] = Array.isArray(rawHistory)
            ? rawHistory
            : typeof rawHistory === 'object'
            ? Object.values(rawHistory)
            : [];

          // Merge local + remote
          safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams.length > 0 ? exams : INITIAL_EXAMS));
          safeSetItem(STORAGE_KEYS.STUDENTS, JSON.stringify(normalizedStudents));
          safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));

          // Calculate unique classes from students & exams
          const classSet = new Set<string>(INITIAL_CLASSES);
          Object.values(normalizedStudents).forEach((s: any) => { if (s.group) classSet.add(s.group); });
          exams.forEach((ex) => {
            if (ex?.questions?.target_group) {
              ex.questions.target_group.split(',').forEach(g => {
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
            exams: exams.length > 0 ? exams : INITIAL_EXAMS,
            students: normalizedStudents,
            history,
            classes: classesList,
          };
        }
      }
    } catch (e) {
      console.warn("API_URL fetch failed, falling back to local storage:", e);
    }
  }

  // Fallback to LocalStorage with normalization
  let localStudents: { [username: string]: StudentAccount } = {};
  try {
    const rawLocalStudents = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS) || '{}');
    if (Array.isArray(rawLocalStudents)) {
      rawLocalStudents.forEach((s: any) => {
        const u = String(s.username || s.sbd || '').trim();
        if (u) {
          localStudents[u.toLowerCase()] = {
            username: u,
            name: String(s.name || u).trim(),
            password: String(s.password || '123').trim(),
            group: String(s.group || 'Chưa phân lớp').trim(),
          };
        }
      });
    } else if (typeof rawLocalStudents === 'object') {
      Object.entries(rawLocalStudents).forEach(([k, s]: [string, any]) => {
        const u = String(s.username || k).trim();
        if (u) {
          localStudents[u.toLowerCase()] = {
            username: u,
            name: String(s.name || u).trim(),
            password: String(s.password || '123').trim(),
            group: String(s.group || 'Chưa phân lớp').trim(),
          };
        }
      });
    }
  } catch (e) {
    localStudents = {};
  }

  const localExams = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAMS) || JSON.stringify(INITIAL_EXAMS));
  const localHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || JSON.stringify(INITIAL_HISTORY));
  const localClasses = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES) || JSON.stringify(INITIAL_CLASSES));

  return {
    exams: Array.isArray(localExams) ? localExams : INITIAL_EXAMS,
    students: localStudents,
    history: Array.isArray(localHistory) ? localHistory : INITIAL_HISTORY,
    classes: Array.isArray(localClasses) ? localClasses : INITIAL_CLASSES,
  };
};

export const saveExamData = async (examPayload: ExamItem): Promise<{ success: boolean; message?: string }> => {
  initLocalStorageIfEmpty();
  const localExams: ExamItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAMS) || '[]');
  const idx = localExams.findIndex(e => e.id === examPayload.id);
  if (idx >= 0) {
    localExams[idx] = examPayload;
  } else {
    localExams.unshift(examPayload);
  }
  
  const localSaveRes = safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(localExams));
  if (!localSaveRes.success) {
    return { success: false, message: localSaveRes.error || "Không thể lưu đề thi vào bộ nhớ máy do quá tải dung lượng." };
  }

  // Also update class list if new class target is added
  if (examPayload.questions?.target_group) {
    const localClasses: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES) || '[]');
    const classSet = new Set(localClasses);
    examPayload.questions.target_group.split(',').forEach(g => {
      const trimmed = g.trim();
      if (trimmed && trimmed.toLowerCase() !== 'tất cả') {
        classSet.add(trimmed);
      }
    });
    safeSetItem(STORAGE_KEYS.CLASSES, JSON.stringify(Array.from(classSet)));
  }

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}?action=save_exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(examPayload)
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.warn("Backend API call failed, saved locally:", e);
    }
  }

  return { success: true, message: "Lưu đề thi thành công vào bộ nhớ máy!" };
};

export const deleteExamData = async (examId: string): Promise<{ success: boolean; message?: string }> => {
  initLocalStorageIfEmpty();
  const localExams: ExamItem[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAMS) || '[]');
  const updated = localExams.filter(e => e.id !== examId);
  safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(updated));

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}?action=delete_exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ id: examId })
      });
      return await res.json();
    } catch (e) {
      console.warn("Backend API call failed, deleted locally:", e);
    }
  }

  return { success: true, message: "Đã xóa đề thi khỏi bộ nhớ!" };
};

export const saveStudentsData = async (studentsObj: { [username: string]: StudentAccount }): Promise<{ success: boolean; message?: string }> => {
  initLocalStorageIfEmpty();
  const res = safeSetItem(STORAGE_KEYS.STUDENTS, JSON.stringify(studentsObj));
  if (!res.success) {
    return { success: false, message: res.error || "Không thể lưu danh sách học viên." };
  }

  // Extract new classes from student groups
  const localClasses: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES) || '[]');
  const classSet = new Set(localClasses);
  Object.values(studentsObj).forEach(s => {
    if (s.group && s.group.trim()) {
      classSet.add(s.group.trim());
    }
  });
  safeSetItem(STORAGE_KEYS.CLASSES, JSON.stringify(Array.from(classSet)));

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}?action=save_students`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ students: studentsObj })
      });
      return await res.json();
    } catch (e) {
      console.warn("Backend API call failed, saved students locally:", e);
    }
  }

  return { success: true, message: "Đã cập nhật danh sách học viên!" };
};

export const submitExamResult = async (payload: ExamSubmission): Promise<{ success: boolean }> => {
  initLocalStorageIfEmpty();
  const localHistory: ExamSubmission[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
  payload.id = 'sub_' + Date.now();
  payload.submitted_at = new Date().toLocaleString('vi-VN');
  localHistory.push(payload);
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(localHistory));

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}?action=submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Backend API submit failed, saved result locally:", e);
    }
  }

  return { success: true };
};

export const clearExamHistory = async (): Promise<{ success: boolean }> => {
  initLocalStorageIfEmpty();
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}?action=clear_history`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({})
      });
    } catch (e) {
      console.warn("Backend API clear history failed, cleared locally:", e);
    }
  }

  return { success: true };
};
