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

// Initialize local storage if empty
export const initLocalStorageIfEmpty = () => {
  if (!localStorage.getItem(STORAGE_KEYS.EXAMS)) {
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(INITIAL_EXAMS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.HISTORY)) {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(INITIAL_HISTORY));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(INITIAL_CLASSES));
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
        const data = await res.json();
        if (data && !data.error) {
          const exams: ExamItem[] = data.exams || [];
          const students = data.students || {};
          const history: ExamSubmission[] = data.history || [];

          // Merge local + remote
          localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
          localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
          localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));

          // Calculate unique classes from students & exams
          const classSet = new Set<string>(INITIAL_CLASSES);
          Object.values(students).forEach((s: any) => { if (s.group) classSet.add(s.group); });
          exams.forEach((ex) => {
            if (ex.questions?.target_group) {
              ex.questions.target_group.split(',').forEach(g => {
                const trimmed = g.trim();
                if (trimmed && trimmed.toLowerCase() !== 'tất cả' && trimmed.toLowerCase() !== 'all') {
                  classSet.add(trimmed);
                }
              });
            }
          });

          const classesList = Array.from(classSet);
          localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classesList));

          return { exams, students, history, classes: classesList };
        }
      }
    } catch (e) {
      console.warn("API_URL fetch failed, falling back to local storage:", e);
    }
  }

  // Fallback to LocalStorage
  const localExams = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAMS) || JSON.stringify(INITIAL_EXAMS));
  const localStudents = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS) || JSON.stringify(INITIAL_STUDENTS));
  const localHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || JSON.stringify(INITIAL_HISTORY));
  const localClasses = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES) || JSON.stringify(INITIAL_CLASSES));

  return {
    exams: localExams,
    students: localStudents,
    history: localHistory,
    classes: localClasses,
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
  localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(localExams));

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
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(Array.from(classSet)));
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
  localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(updated));

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
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(studentsObj));

  // Extract new classes from student groups
  const localClasses: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES) || '[]');
  const classSet = new Set(localClasses);
  Object.values(studentsObj).forEach(s => {
    if (s.group && s.group.trim()) {
      classSet.add(s.group.trim());
    }
  });
  localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(Array.from(classSet)));

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
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(localHistory));

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
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));

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
