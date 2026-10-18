/// <reference lib="webworker" />
import { ExamItem, StudentAccount, ExamSubmission } from '../types';

export interface SyncWorkerRequest {
  apiUrl: string;
  userRole?: 'student' | 'teacher' | 'guest';
  localExams: ExamItem[];
  localStudents: { [username: string]: StudentAccount };
  localHistory: ExamSubmission[];
  initialClasses: string[];
  initialExams: ExamItem[];
}

export interface SyncWorkerResponse {
  success: boolean;
  exams: ExamItem[];
  students: { [username: string]: StudentAccount };
  history: ExamSubmission[];
  classes: string[];
  cloudSynced: boolean;
  dataHash: string;
  error?: string;
}

const normalizeExamTitle = (t?: string): string =>
  (t || '').toLowerCase().replace(/\s+/g, ' ').trim();

const normalizeStudent = (raw: any, defaultKey?: string): StudentAccount | null => {
  if (!raw) return null;
  const u = String(raw.username || raw.sbd || raw.id || raw.ma_hs || defaultKey || '').trim();
  if (!u) return null;
  let n = String(raw.name || raw.ten || raw.ho_ten || raw.fullName || u).trim();
  let p = String(
    raw.password !== undefined ? raw.password : raw.matkhau !== undefined ? raw.matkhau : ''
  ).trim();
  const g = String(
    raw.group || raw.lop || raw.className || raw.class || raw.nhom || 'Chưa phân lớp'
  ).trim();

  // Tự động phát hiện và đảo lại nếu cột Họ Tên và Mật khẩu bị ngược trên Google Sheet
  const pHasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(p) || p.includes(' ');
  const nNoVietnamese = !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(n) && !n.includes(' ');
  if (pHasVietnamese && nNoVietnamese && n.length > 0) {
    const temp = n;
    n = p;
    p = temp;
  }

  const av = String(raw.avatar || raw.Avatar || raw.anh || raw.Anh || '').trim();

  return {
    username: u,
    name: n,
    password: p,
    group: g,
    avatar: av || undefined,
  };
};

async function safeFetchJson(res: Response): Promise<any | null> {
  if (!res) return null;
  try {
    const text = await res.text();
    if (!text || text.trim().startsWith('<') || text.trim().startsWith('<!DOCTYPE')) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}

self.onmessage = async (event: MessageEvent<SyncWorkerRequest>) => {
  const {
    apiUrl,
    userRole,
    localExams = [],
    localStudents = {},
    localHistory: inputHistory = [],
    initialClasses = [],
    initialExams = [],
  } = event.data;

  let localHistory = [...(inputHistory || [])];

  try {
    const localExamsMap = new Map<string, ExamItem>();
    localExams.forEach((ex) => {
      if (ex && ex.id) localExamsMap.set(ex.id, ex);
    });

    let gasSynced = false;
    let gasExams: ExamItem[] = [];
    let gasStudents: { [username: string]: StudentAccount } = {};
    let gasHistory: ExamSubmission[] = [];

    // 0. Fetch trực tiếp từ Express backend /api/all (Đồng bộ đa trình duyệt tức thì)
    try {
      const sRes = await fetch(`/api/all?role=${encodeURIComponent(userRole || 'student')}`, {
        cache: 'no-cache',
      });
      if (sRes.ok) {
        const sData = await safeFetchJson(sRes);
        const central = sData?.data;
        if (central) {
          if (Array.isArray(central.exams)) {
            central.exams.forEach((ex: any) => {
              if (ex && ex.id) {
                const local = localExamsMap.get(ex.id);
                if (!local || !local.updatedAt || (ex.updatedAt && ex.updatedAt > local.updatedAt)) {
                  localExamsMap.set(ex.id, ex);
                }
              }
            });
          }
          if (central.students && typeof central.students === 'object') {
            Object.assign(localStudents, central.students);
          }
          if (Array.isArray(central.history)) {
            const histMap = new Map();
            localHistory.forEach((h: any) => { if (h && h.id) histMap.set(h.id, h); });
            central.history.forEach((h: any) => { if (h && h.id) histMap.set(h.id, h); });
            localHistory = Array.from(histMap.values());
          }
        }
      }
    } catch (e) {}

    // Fetch trực tiếp từ Google Apps Script Web App trong luồng Worker
    if (apiUrl) {
      try {
        const gRes = await fetch(`${apiUrl}?action=get_all`, {
          mode: 'cors',
          cache: 'no-cache',
        });
        if (gRes.ok) {
          const rawData = await safeFetchJson(gRes);
          const data = rawData?.data || rawData;
          if (data && !data.error) {
            gasSynced = true;

            const rawEx = data.exams || [];
            const parsedGasExams: ExamItem[] = Array.isArray(rawEx)
              ? rawEx
              : typeof rawEx === 'object'
              ? Object.values(rawEx)
              : [];
            gasExams = parsedGasExams.filter((ex) => ex && ex.id);

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

            const rawH = data.history || [];
            gasHistory = Array.isArray(rawH)
              ? rawH
              : typeof rawH === 'object'
              ? Object.values(rawH)
              : [];
          }
        }
      } catch (e) {
        // Nếu mạng chập chờn, tự động dùng dữ liệu local
      }
    }

    // 1. Hợp nhất danh sách Đề thi (Exams)
    const combinedMap = new Map<string, ExamItem>();
    localExams.forEach((ex) => {
      if (ex && ex.id) combinedMap.set(ex.id, ex);
    });

    gasExams.forEach((gEx: any) => {
      if (!gEx || !gEx.id) return;
      const local = localExamsMap.get(gEx.id);
      const existingFileLink = local?.questions?.file_link;

      let finalFile = gEx.questions?.file_link || '';
      if (finalFile === '[PDF_STORED_IN_BROWSER]' && existingFileLink) {
        finalFile = existingFileLink;
      } else if (!finalFile && existingFileLink) {
        finalFile = existingFileLink;
      }

      // 1. Phục hồi questions config nếu gEx lưu trong file_url hoặc thiếu
      let gasQuestions = gEx.questions;
      if (!gasQuestions && gEx.file_url && typeof gEx.file_url === 'string' && gEx.file_url.startsWith('{')) {
        try {
          gasQuestions = JSON.parse(gEx.file_url);
        } catch (e) {}
      }
      if (!gasQuestions || typeof gasQuestions !== 'object') {
        gasQuestions = {};
      }

      // 2. Trích xuất duration từ mọi thuộc tính có thể có (duration, time_limit_minutes, description, questions.duration)
      const gasDurationNum =
        Number(gEx.duration) ||
        Number(gEx.time_limit_minutes) ||
        (typeof gEx.description === 'number' ? gEx.description : 0) ||
        Number(gasQuestions.duration) ||
        0;

      // 3. Trích xuất target_group từ mọi định dạng (questions.target_group, assigned_classes array, target_group string)
      let gasTargetGroup = gasQuestions.target_group || '';
      if (!gasTargetGroup && Array.isArray(gEx.assigned_classes) && gEx.assigned_classes.length > 0) {
        gasTargetGroup = gEx.assigned_classes.join(', ');
      }
      if (!gasTargetGroup && gEx.target_group) {
        gasTargetGroup = String(gEx.target_group);
      }

      // 4. Bảo vệ dữ liệu cục bộ mới cập nhật (nếu giáo viên vừa sửa tại máy này)
      const isLocalNewer = Boolean(local?.updatedAt && local.updatedAt > (gEx.updatedAt || 0));

      const finalDuration = (isLocalNewer && local?.duration)
        ? local.duration
        : (gasDurationNum > 0 ? gasDurationNum : (local?.duration || 45));

      const finalTargetGroup = (isLocalNewer && local?.questions?.target_group)
        ? local.questions.target_group
        : (gasTargetGroup || local?.questions?.target_group || 'Tất cả');

      const existingEntry = combinedMap.get(gEx.id) || local;
      const gHasAnswers =
        gEx.answers &&
        ((gEx.answers.p1 && Object.keys(gEx.answers.p1).length > 0) ||
          (gEx.answers.p2 && Object.keys(gEx.answers.p2).length > 0) ||
          (gEx.answers.p3 && Object.keys(gEx.answers.p3).length > 0));
      const existingHasAnswers =
        existingEntry?.answers &&
        ((existingEntry.answers.p1 && Object.keys(existingEntry.answers.p1).length > 0) ||
          (existingEntry.answers.p2 && Object.keys(existingEntry.answers.p2).length > 0) ||
          (existingEntry.answers.p3 && Object.keys(existingEntry.answers.p3).length > 0));

      const resolvedGasAnswers = gHasAnswers
        ? gEx.answers
        : existingHasAnswers
        ? existingEntry?.answers
        : gEx.answers || existingEntry?.answers;

      const mergedQuestions = {
        ...(local?.questions || {}),
        ...gasQuestions,
        target_group: finalTargetGroup,
        file_link: finalFile,
      };

      if (isLocalNewer && local?.questions) {
        if (local.questions.max_attempts !== undefined) mergedQuestions.max_attempts = local.questions.max_attempts;
        if (local.questions.start_time !== undefined) mergedQuestions.start_time = local.questions.start_time;
        if (local.questions.end_time !== undefined) mergedQuestions.end_time = local.questions.end_time;
        if (local.questions.publish_score_mode) mergedQuestions.publish_score_mode = local.questions.publish_score_mode;
        if (local.questions.score_released !== undefined) mergedQuestions.score_released = local.questions.score_released;
      }

      combinedMap.set(gEx.id, {
        ...gEx,
        duration: Math.max(1, finalDuration),
        answers: resolvedGasAnswers,
        questions: mergedQuestions,
        updatedAt: Math.max(Number(gEx.updatedAt) || 0, Number(local?.updatedAt) || 0),
      });
    });

    const finalExams = Array.from(combinedMap.values());
    const finalExamsList = finalExams.length > 0 ? finalExams : initialExams;

    // Ẩn đáp án gốc nếu phiên hiện tại là học sinh hoặc khách
    const storageExamsList =
      userRole === 'teacher'
        ? finalExamsList
        : finalExamsList.map((e) => {
            const { answers, ...safe } = e;
            return safe as ExamItem;
          });

    // 2. Hợp nhất danh sách Học sinh (Students)
    const rawMerged =
      Object.keys(gasStudents).length > 0 ? { ...gasStudents } : { ...localStudents };
    const mergedStudents: { [username: string]: StudentAccount } = {};
    Object.entries(rawMerged).forEach(([k, s]) => {
      const norm = normalizeStudent(s, k);
      if (norm && norm.username) {
        mergedStudents[norm.username.toLowerCase()] = norm;
      }
    });

    // 3. Hợp nhất Lịch sử thi (History)
    const historyMap = new Map<string, ExamSubmission>();
    [...localHistory, ...gasHistory].forEach((h) => {
      if (h && h.username && h.examTitle) {
        const key = `${h.username}_${h.examTitle}_${h.submitted_at}`;
        const existing = historyMap.get(key);
        const mergedDetails = h.details || existing?.details;
        const mergedCorrectAnswers = h.correctAnswers || existing?.correctAnswers;
        const finalScore =
          h.score !== undefined && h.score !== 0 ? h.score : existing?.score || h.score || 0;
        const finalCorrect =
          h.correct !== undefined && h.correct !== 0
            ? h.correct
            : existing?.correct || h.correct || 0;

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
          (e) =>
            (e.id && e.id === h.examId) ||
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

    // 4. Trích xuất danh sách Lớp học duy nhất
    const classSet = new Set<string>(initialClasses);
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

    // 5. Tạo chuỗi băm (fingerprint) ngay trên Worker để Main Thread so sánh tức thì
    const dataHash = [
      storageExamsList.map((e) => `${e.id}:${e.title}:${e.duration}:${e.questions?.score_released}`).join('|'),
      Object.keys(mergedStudents).length,
      mergedHistory.length,
      mergedHistory[0]?.submitted_at || '',
      mergedHistory[mergedHistory.length - 1]?.submitted_at || '',
      classesList.join(','),
    ].join('::');

    const response: SyncWorkerResponse = {
      success: true,
      exams: storageExamsList,
      students: mergedStudents,
      history: mergedHistory,
      classes: classesList,
      cloudSynced: gasSynced,
      dataHash,
    };

    self.postMessage(response);
  } catch (err: any) {
    self.postMessage({
      success: false,
      exams: localExams,
      students: localStudents,
      history: localHistory,
      classes: initialClasses,
      cloudSynced: false,
      dataHash: '',
      error: err?.message || 'Worker sync error',
    });
  }
};
