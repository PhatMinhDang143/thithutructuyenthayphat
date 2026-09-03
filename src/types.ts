export interface StudentAccount {
  username: string;
  password?: string;
  name: string;
  group: string; // Lớp/Nhóm (e.g. "12A1", "12A2", "11B1")
}

export interface ExamQuestionsConfig {
  exam_type?: 'fixed' | 'custom';
  num_p1?: number; // Số câu Phần I (Trắc nghiệm 4 lựa chọn)
  num_p2?: number; // Số câu Phần II (Đúng/Sai)
  num_p3?: number; // Số câu Phần III (Trả lời ngắn)
  start_time?: string; // ISO datetime or YYYY-MM-DDTHH:mm
  end_time?: string;
  file_link?: string; // Google Drive PDF view/preview URL or uploaded base64 data
  explain_link?: string;
  target_group?: string; // Lớp/Nhóm được phép làm bài (e.g. "Tất cả", "12A1", "12A1, 12A2")
  max_attempts?: number; // Số lần làm bài tối đa (0 hoặc undefined = không giới hạn, 1 = 1 lần, 2 = 2 lần,...)
}

export interface AnswerKeyPart1 {
  [questionNum: number]: string; // "A" | "B" | "C" | "D"
}

export interface AnswerKeyPart2 {
  [questionNum: number]: {
    a?: 'Đ' | 'S';
    b?: 'Đ' | 'S';
    c?: 'Đ' | 'S';
    d?: 'Đ' | 'S';
  };
}

export interface AnswerKeyPart3 {
  [questionNum: number]: string; // Text answer e.g. "15", "-3.5", "100"
}

export interface AnswerKeys {
  p1?: AnswerKeyPart1;
  p2?: AnswerKeyPart2;
  p3?: AnswerKeyPart3;
}

export interface ExamItem {
  id: string;
  title: string;
  duration: number; // in minutes
  questions: ExamQuestionsConfig;
  answers?: AnswerKeys; // Protected: Stripped on server for students, provided only for teachers or inside graded submissions
  updatedAt?: number; // epoch timestamp in ms
}

export interface StudentAnswers {
  p1: { [questionNum: number]: string };
  p2: { [questionNum: number]: { a?: 'Đ' | 'S'; b?: 'Đ' | 'S'; c?: 'Đ' | 'S'; d?: 'Đ' | 'S' } };
  p3: { [questionNum: number]: string };
}

export interface QuestionTimingRecord {
  timeFromStartSeconds: number; // seconds from test start when this question was answered
  durationSeconds: number; // time spent on this question (seconds)
  changeCount?: number; // number of times answer was updated
  answeredAt?: string; // formatted time e.g. "01:45"
  choice?: string; // what choice was chosen
}

export interface SubmissionTiming {
  totalSeconds: number; // Total exam time in seconds
  formattedDuration: string; // e.g. "24 phút 15 giây"
  startedAt?: string; // timestamp / formatted time
  submittedAt?: string; // timestamp / formatted time
  avgSecondsPerQuestion?: number; // Average seconds per question
  fastestQuestion?: { question: string; seconds: number };
  slowestQuestion?: { question: string; seconds: number };
  questionTimings: {
    [questionKey: string]: QuestionTimingRecord; // e.g. "p1_1", "p2_1_a", "p3_1"
  };
}

export interface ExamSubmission {
  id?: string;
  examId?: string;
  submitted_at: string;
  username: string;
  name: string;
  group: string; // Lớp của học sinh
  examTitle: string;
  score: number;
  correct: number;
  cheat: string; // e.g. "0 lần" or "2 lần"
  details?: StudentAnswers;
  correctAnswers?: AnswerKeys; // Authoritative answer key returned securely after server-side grading
  timing?: SubmissionTiming; // Secret telemetry: total exam duration and per-question speed (teacher-only)
}

export interface AppUser {
  username: string;
  name: string;
  group: string; // Class / Group
  role: 'student' | 'guest' | 'teacher';
  token?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AppUser;
  token?: string;
  error?: string;
}
