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
      error: 'Chưa cấu hình Google Apps Script API URL. Vui lòng bấm vào nút Cài đặt (⚙️) ở góc trên để cấu hình.',
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
      error: `Không thể kết nối đến Google Apps Script (${err?.message || err}). Hãy đảm bảo Web App được triển khai với quyền "Bất kỳ ai" (Anyone).`,
    };
  }
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

// Smart Fetch & Merge function: NEVER overwrites local user edits with stale remote data
export const fetchAllData = async (): Promise<{
  exams: ExamItem[];
  students: { [username: string]: StudentAccount };
  history: ExamSubmission[];
  classes: string[];
  cloudSynced: boolean;
}> => {
  initLocalStorageIfEmpty();
  const apiUrl = getApiUrl();
  const localExams = getLocalExams();

  let cloudSynced = false;
  let remoteExams: ExamItem[] = [];
  let remoteStudents: { [username: string]: StudentAccount } = {};
  let remoteHistory: ExamSubmission[] = [];

  // Attempt Google Apps Script fetch if API_URL is present
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}?action=get_all`, { mode: 'cors' });
      if (res.ok) {
        const rawData = await res.json();
        const data = rawData?.data || rawData;
        if (data && !data.error) {
          cloudSynced = true;

          // 1. Normalize remote exams
          const rawEx = data.exams || [];
          const parsedRemoteExams: ExamItem[] = Array.isArray(rawEx)
            ? rawEx
            : typeof rawEx === 'object'
            ? Object.values(rawEx)
            : [];

          remoteExams = parsedRemoteExams.filter((ex) => ex && ex.id);

          // 2. Normalize remote students
          const rawSt = data.students || {};
          if (Array.isArray(rawSt)) {
            rawSt.forEach((s: any) => {
              if (s) {
                const u = String(s.username || s.sbd || s.id || s.ma_hs || '').trim();
                if (u) {
                  remoteStudents[u.toLowerCase()] = {
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
                  remoteStudents[u.toLowerCase()] = {
                    username: u,
                    name: String(s.name || s.ten || s.ho_ten || s.fullName || u).trim(),
                    password: String(s.password !== undefined ? s.password : s.matkhau !== undefined ? s.matkhau : '123').trim(),
                    group: String(s.group || s.lop || s.className || s.class || s.nhom || 'Chưa phân lớp').trim(),
                  };
                }
              }
            });
          }

          // 3. Normalize remote history
          const rawH = data.history || [];
          remoteHistory = Array.isArray(rawH) ? rawH : typeof rawH === 'object' ? Object.values(rawH) : [];
        }
      }
    } catch (e) {
      console.warn("API_URL get_all fetch failed, continuing with local storage:", e);
    }
  }

  // === SMART MERGE EXAMS ===
  // Build a map of local exams by ID
  const examMap = new Map<string, ExamItem>();
  
  // 1. Put local exams first
  localExams.forEach((ex) => {
    if (ex && ex.id) examMap.set(ex.id, ex);
  });

  // 2. Merge remote exams into local without overwriting newer local edits
  if (cloudSynced && remoteExams.length > 0) {
    remoteExams.forEach((rEx) => {
      const localVer = examMap.get(rEx.id);
      if (!localVer) {
        // New exam from cloud sheet
        examMap.set(rEx.id, {
          ...rEx,
          duration: Number(rEx.duration) || 45,
        });
      } else {
        // Local takes precedence for user edits, but merge non-conflicting remote data
        const mergedQuestions = {
          ...(rEx.questions || {}),
          ...(localVer.questions || {}),
          file_link: localVer.questions?.file_link || rEx.questions?.file_link || '',
          explain_link: localVer.questions?.explain_link || rEx.questions?.explain_link || '',
          target_group: localVer.questions?.target_group || rEx.questions?.target_group || 'Tất cả',
        };

        const mergedExam: ExamItem = {
          ...rEx,
          ...localVer,
          duration: localVer.duration !== undefined ? Number(localVer.duration) : Number(rEx.duration) || 45,
          title: localVer.title || rEx.title || '',
          questions: mergedQuestions,
          answers: {
            p1: { ...(rEx.answers?.p1 || {}), ...(localVer.answers?.p1 || {}) },
            p2: { ...(rEx.answers?.p2 || {}), ...(localVer.answers?.p2 || {}) },
            p3: { ...(rEx.answers?.p3 || {}), ...(localVer.answers?.p3 || {}) },
          },
        };
        examMap.set(rEx.id, mergedExam);
      }
    });
  }

  const mergedExams = Array.from(examMap.values());
  safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(mergedExams.length > 0 ? mergedExams : INITIAL_EXAMS));

  // === SMART MERGE STUDENTS ===
  let localStudents: { [username: string]: StudentAccount } = {};
  try {
    const rawLocalStudents = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS) || '{}');
    if (typeof rawLocalStudents === 'object' && !Array.isArray(rawLocalStudents)) {
      localStudents = rawLocalStudents;
    }
  } catch (e) {
    localStudents = {};
  }

  const mergedStudents = { ...remoteStudents, ...localStudents };
  safeSetItem(STORAGE_KEYS.STUDENTS, JSON.stringify(mergedStudents));

  // === SMART MERGE HISTORY ===
  let localHistory: ExamSubmission[] = [];
  try {
    const rawLocalH = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    if (Array.isArray(rawLocalH)) localHistory = rawLocalH;
  } catch (e) {
    localHistory = [];
  }

  // Combine unique history entries by timestamp + username + examTitle
  const historyMap = new Map<string, ExamSubmission>();
  [...remoteHistory, ...localHistory].forEach((h) => {
    if (h) {
      const key = `${h.username}_${h.examTitle}_${h.submitted_at}`;
      historyMap.set(key, h);
    }
  });
  const mergedHistory = Array.from(historyMap.values());
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(mergedHistory));

  // === DEDUCE UNIQUE CLASSES ===
  const classSet = new Set<string>(INITIAL_CLASSES);
  Object.values(mergedStudents).forEach((s) => {
    if (s && s.group && s.group.trim()) classSet.add(s.group.trim());
  });
  mergedExams.forEach((ex) => {
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
    exams: mergedExams.length > 0 ? mergedExams : INITIAL_EXAMS,
    students: mergedStudents,
    history: mergedHistory,
    classes: classesList,
    cloudSynced,
  };
};

// Save Exam Data with Local + Cloud Multi-tier Sync
export const saveExamData = async (
  examPayload: ExamItem
): Promise<{ success: boolean; cloudSynced: boolean; message: string }> => {
  initLocalStorageIfEmpty();

  // Normalize duration & values
  examPayload.duration = Number(examPayload.duration) || 45;

  // 1. ALWAYS persist directly to LocalStorage first (Zero data loss guarantee)
  const localExams = getLocalExams();
  const idx = localExams.findIndex((e) => e.id === examPayload.id);
  if (idx >= 0) {
    const existing = localExams[idx];
    const finalFileLink = examPayload.questions?.file_link || existing.questions?.file_link || '';
    const finalExplainLink = examPayload.questions?.explain_link !== undefined ? examPayload.questions.explain_link : (existing.questions?.explain_link || '');
    
    localExams[idx] = { 
      ...existing, 
      ...examPayload,
      duration: Number(examPayload.duration) || 45,
      questions: {
        ...(existing.questions || {}),
        ...(examPayload.questions || {}),
        file_link: finalFileLink,
        explain_link: finalExplainLink,
      }
    };
  } else {
    localExams.unshift(examPayload);
  }

  const localSaveRes = safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(localExams));
  if (!localSaveRes.success) {
    return {
      success: false,
      cloudSynced: false,
      message: localSaveRes.error || 'Lỗi: Không thể lưu vào bộ nhớ trình duyệt.',
    };
  }

  // Update target classes
  if (examPayload.questions?.target_group) {
    try {
      const localClasses: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES) || '[]');
      const classSet = new Set(localClasses);
      examPayload.questions.target_group.split(',').forEach((g) => {
        const trimmed = g.trim();
        if (trimmed && trimmed.toLowerCase() !== 'tất cả') {
          classSet.add(trimmed);
        }
      });
      safeSetItem(STORAGE_KEYS.CLASSES, JSON.stringify(Array.from(classSet)));
    } catch (e) {
      // ignore
    }
  }

  // 2. Synchronize to Google Apps Script Web App API
  const apiUrl = getApiUrl();
  let cloudSynced = false;
  let cloudErrorMsg = '';

  if (apiUrl) {
    try {
      // Create a cloud payload. If file_link is a huge base64, send a marked indicator to avoid Google Sheet cell 50k char limit
      const cloudPayload = { ...examPayload, duration: Number(examPayload.duration) || 45 };
      if (cloudPayload.questions?.file_link?.startsWith('data:')) {
        // Large base64 files cannot fit in a standard Google Sheet cell (limit 50,000 chars)
        // Keep local base64, but flag in cloud sheet
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
          cloudSynced = true;
        } else {
          cloudErrorMsg = data?.message || data?.error || 'Google Sheet từ chối cập nhật';
        }
      }
    } catch (e: any) {
      console.warn('Backend API save_exam failed, saved in local storage:', e);
      cloudErrorMsg = e?.message || 'Không thể kết nối đến Google Apps Script';
    }
  }

  if (cloudSynced) {
    return {
      success: true,
      cloudSynced: true,
      message: 'Đã lưu cấu hình và đồng bộ thành công lên Google Sheet & bộ nhớ hệ thống!',
    };
  } else {
    return {
      success: true,
      cloudSynced: false,
      message: `Đã lưu cấu hình vào bộ nhớ máy thành công! ${
        cloudErrorMsg ? `(Lưu ý: Chưa đồng bộ Google Sheet do: ${cloudErrorMsg})` : ''
      }`,
    };
  }
};

// Delete Exam
export const deleteExamData = async (
  examId: string
): Promise<{ success: boolean; message: string }> => {
  initLocalStorageIfEmpty();
  const localExams = getLocalExams();
  const updated = localExams.filter((e) => e.id !== examId);
  safeSetItem(STORAGE_KEYS.EXAMS, JSON.stringify(updated));

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}?action=delete_exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ id: examId }),
      });
    } catch (e) {
      console.warn('Backend API delete failed, deleted locally:', e);
    }
  }

  return { success: true, message: 'Đã xóa đề thi thành công!' };
};

// Save Students Data
export const saveStudentsData = async (
  studentsObj: { [username: string]: StudentAccount }
): Promise<{ success: boolean; cloudSynced: boolean; message: string }> => {
  initLocalStorageIfEmpty();
  const res = safeSetItem(STORAGE_KEYS.STUDENTS, JSON.stringify(studentsObj));
  if (!res.success) {
    return { success: false, cloudSynced: false, message: res.error || 'Không thể lưu danh sách học sinh.' };
  }

  // Update classes
  try {
    const localClasses: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLASSES) || '[]');
    const classSet = new Set(localClasses);
    Object.values(studentsObj).forEach((s) => {
      if (s.group && s.group.trim()) classSet.add(s.group.trim());
    });
    safeSetItem(STORAGE_KEYS.CLASSES, JSON.stringify(Array.from(classSet)));
  } catch (e) {
    // ignore
  }

  const apiUrl = getApiUrl();
  let cloudSynced = false;
  if (apiUrl) {
    try {
      const resp = await fetch(`${apiUrl}?action=save_students`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ students: studentsObj }),
      });
      if (resp.ok) {
        cloudSynced = true;
      }
    } catch (e) {
      console.warn('Backend API save_students failed, saved locally:', e);
    }
  }

  return {
    success: true,
    cloudSynced,
    message: cloudSynced
      ? 'Đã lưu và đồng bộ danh sách học sinh lên Google Sheet thành công!'
      : 'Đã lưu danh sách học sinh vào bộ nhớ máy thành công!',
  };
};

// Submit Exam Result
export const submitExamResult = async (payload: ExamSubmission): Promise<{ success: boolean }> => {
  initLocalStorageIfEmpty();
  let localHistory: ExamSubmission[] = [];
  try {
    localHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
  } catch (e) {
    localHistory = [];
  }

  payload.id = 'sub_' + Date.now();
  if (!payload.submitted_at) {
    payload.submitted_at = new Date().toLocaleString('vi-VN');
  }

  localHistory.unshift(payload);
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(localHistory));

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}?action=submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn('Backend API submit failed, saved locally:', e);
    }
  }

  return { success: true };
};

// Clear History
export const clearExamHistory = async (): Promise<{ success: boolean }> => {
  initLocalStorageIfEmpty();
  safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));

  const apiUrl = getApiUrl();
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}?action=clear_history`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({}),
      });
    } catch (e) {
      console.warn('Backend API clear history failed, cleared locally:', e);
    }
  }

  return { success: true };
};

// Full Google Apps Script Code.gs Template for Teachers
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG THI TRỰC TUYẾN (HỖ TRỢ LƯU FILE GOOGLE DRIVE)
 * Hướng dẫn cài đặt / Cập nhật:
 * 1. Mở Google Sheet -> Chọn Tiện ích mở rộng (Extensions) -> Apps Script
 * 2. Xóa toàn bộ mã cũ và dán toàn bộ đoạn mã này vào file Code.gs.
 * 3. [QUAN TRỌNG ĐỂ CẤP QUYỀN DRIVE]:
 *    - Ở thanh công cụ trên cùng của Apps Script, chọn hàm "testAuthorizeDrive" và bấm nút "Chạy" (Run ▶️).
 *    - Google sẽ hiện popup "Cần có sự ủy quyền" -> Bấm "Xem lại quyền" -> Chọn tài khoản của bạn -> Bấm "Nâng cao" (Advanced) -> "Đi tới Dự án (không an toàn)" -> "Cho phép" (Allow).
 * 4. Bấm "Triển khai" (Deploy) -> "Quản lý tùy chọn triển khai" (Manage deployments)
 *    -> Bấm biểu tượng cây bút (Chỉnh sửa) -> Chọn Phiên bản: "Mới" (New version) -> Bấm "Triển khai" (Deploy).
 */

// Hàm chạy thử 1 lần để cấp quyền Google Drive (Bấm nút Run ▶️ hàm này trong Apps Script)
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

// 0. Hàm tải file PDF lên Google Drive và tạo liên kết công khai
function uploadFileToDrive(postData) {
  try {
    var rawName = postData.fileName || ('De_Thi_' + new Date().getTime() + '.pdf');
    var base64Data = postData.base64 || '';
    
    if (!base64Data) {
      return { success: false, error: 'Không tìm thấy dữ liệu file base64' };
    }
    
    // Tách phần đầu data:application/pdf;base64 nếu có
    if (base64Data.indexOf('base64,') > -1) {
      base64Data = base64Data.split('base64,')[1];
    }
    
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, 'application/pdf', rawName);
    
    // Tạo hoặc lấy thư mục "DeThi_Online_Drive" trên Google Drive của giáo viên
    var folderName = 'DeThi_Online_Drive';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    var file = folder.createFile(blob);
    // Cấp quyền bất kỳ ai có liên kết đều xem được
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

// Helper to find sheet by multiple alias names (Vietnamese & English)
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

// 1. Quản lý Sheet Exams
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

// 2. Quản lý Sheet Students
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

// 3. Quản lý Sheet History
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
