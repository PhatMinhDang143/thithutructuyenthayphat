import { ExamItem, StudentAccount, ExamSubmission } from '../types';

export const INITIAL_CLASSES = [
  'Tất cả',
  '11A',
  '12G3',
  '12B'
];

export const INITIAL_STUDENTS: { [username: string]: StudentAccount } = {};

export const INITIAL_EXAMS: ExamItem[] = [
  {
    id: 'ex_12a1_math',
    title: 'Đề Thi Kiểm Tra Toán Khảo Sát - Lớp 12A1',
    duration: 50,
    questions: {
      exam_type: 'fixed',
      num_p1: 12,
      num_p2: 4,
      num_p3: 6,
      target_group: '12A1', // Chỉ dành cho Lớp 12A1!
      file_link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      explain_link: 'https://drive.google.com'
    },
    answers: {
      p1: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A', 6: 'B', 7: 'C', 8: 'D', 9: 'A', 10: 'B', 11: 'C', 12: 'D' },
      p2: {
        1: { a: 'Đ', b: 'S', c: 'Đ', d: 'S' },
        2: { a: 'S', b: 'Đ', c: 'S', d: 'Đ' },
        3: { a: 'Đ', b: 'Đ', c: 'S', d: 'S' },
        4: { a: 'S', b: 'S', c: 'Đ', d: 'Đ' }
      },
      p3: { 1: '15', 2: '2.5', 3: '100', 4: '-4', 5: '8', 6: '12' }
    }
  },
  {
    id: 'ex_12a2_physics',
    title: 'Đề Khảo Sát Vật Lý - Lớp 12A2',
    duration: 45,
    questions: {
      exam_type: 'fixed',
      num_p1: 12,
      num_p2: 4,
      num_p3: 6,
      target_group: '12A2', // Chỉ dành cho Lớp 12A2!
      file_link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      explain_link: ''
    },
    answers: {
      p1: { 1: 'B', 2: 'A', 3: 'D', 4: 'C', 5: 'B', 6: 'A', 7: 'C', 8: 'D', 9: 'A', 10: 'C', 11: 'B', 12: 'A' },
      p2: {
        1: { a: 'Đ', b: 'Đ', c: 'S', d: 'S' },
        2: { a: 'S', b: 'S', c: 'Đ', d: 'Đ' },
        3: { a: 'Đ', b: 'S', c: 'Đ', d: 'S' },
        4: { a: 'S', b: 'Đ', c: 'S', d: 'Đ' }
      },
      p3: { 1: '10', 2: '20', 3: '30', 4: '40', 5: '50', 6: '60' }
    }
  },
  {
    id: 'ex_all_chemistry',
    title: 'Đề Thi Thử Hóa Học Toàn Trường (Tất Cả Lớp)',
    duration: 60,
    questions: {
      exam_type: 'fixed',
      num_p1: 12,
      num_p2: 4,
      num_p3: 6,
      target_group: 'Tất cả', // Cho tất cả các lớp
      file_link: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      explain_link: 'https://drive.google.com'
    },
    answers: {
      p1: { 1: 'C', 2: 'C', 3: 'A', 4: 'B', 5: 'D', 6: 'A', 7: 'B', 8: 'C', 9: 'D', 10: 'A', 11: 'B', 12: 'C' },
      p2: {
        1: { a: 'S', b: 'Đ', c: 'S', d: 'Đ' },
        2: { a: 'Đ', b: 'S', c: 'Đ', d: 'S' },
        3: { a: 'S', b: 'S', c: 'Đ', d: 'Đ' },
        4: { a: 'Đ', b: 'Đ', c: 'S', d: 'S' }
      },
      p3: { 1: '2', 2: '4', 3: '6', 4: '8', 5: '10', 6: '12' }
    }
  }
];

export const INITIAL_HISTORY: ExamSubmission[] = [
  {
    id: 'sub_1',
    submitted_at: '2026-08-12 14:30:15',
    username: 'hs12a1_01',
    name: 'Nguyễn Văn An',
    group: '12A1',
    examTitle: 'Đề Thi Thử Hóa Học Toàn Trường (Tất Cả Lớp)',
    score: 8.75,
    correct: 18,
    cheat: '0 lần'
  },
  {
    id: 'sub_2',
    submitted_at: '2026-08-12 16:10:00',
    username: 'hs12a1_02',
    name: 'Trần Thị Bình',
    group: '12A1',
    examTitle: 'Đề Thi Kiểm Tra Toán Khảo Sát - Lớp 12A1',
    score: 9.5,
    correct: 20,
    cheat: '0 lần'
  }
];
