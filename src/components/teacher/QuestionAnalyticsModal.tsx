import React, { useState, useMemo } from 'react';
import { 
  BarChart2, AlertTriangle, CheckCircle2, XCircle, Search, Filter, 
  Copy, Check, X, Users, BookOpen, ArrowUpRight, ArrowDownRight, 
  HelpCircle, Sparkles, TrendingUp, TrendingDown, Layers, FileText,
  FileSpreadsheet, Download, Eye, EyeOff, ShieldCheck, Clock, Zap,
  ChevronDown, ChevronUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ExamItem, ExamSubmission } from '../../types';
import { normalizeExamTitle, calculateScoreLocally } from '../../services/storageService';

interface QuestionAnalyticsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  exams: ExamItem[];
  history: ExamSubmission[];
  initialExamId?: string;
  initialClass?: string;
  availableClasses: string[];
  embedded?: boolean;
}

interface QuestionStat {
  part: 1 | 2 | 3;
  partLabel: string;
  questionNumber: number;
  label: string;
  correctAnswer: string;
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  correctRate: number; // 0 - 100
  incorrectRate: number; // 0 - 100
  blankRate: number; // 0 - 100
  // Details for part 1: distribution of choices
  choiceDistribution?: Record<string, number>;
  mostCommonWrongChoice?: string;
  // Details for part 2: sub-items (a, b, c, d)
  subItemStats?: Array<{
    sub: 'a' | 'b' | 'c' | 'd';
    correctKey: string;
    correctCount: number;
    incorrectCount: number;
    correctRate: number;
    incorrectRate: number;
  }>;
  // Details for part 3: common wrong answers
  commonWrongInputs?: Array<{ text: string; count: number }>;
}

export const QuestionAnalyticsModal: React.FC<QuestionAnalyticsModalProps> = ({
  isOpen = true,
  onClose,
  exams,
  history,
  initialExamId,
  initialClass,
  availableClasses,
  embedded = false,
}) => {
  if (!embedded && !isOpen) return null;

  // Selected Exam (require explicit selection if initialExamId is not provided)
  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    if (initialExamId && exams.some((e) => e.id === initialExamId)) return initialExamId;
    return '';
  });

  // Filter Class
  const [selectedClass, setSelectedClass] = useState<string>(initialClass || 'Tất cả');
  // Question search filter
  const [searchTerm, setSearchTerm] = useState('');
  // Filter tab: 'all' | 'high_error' | 'high_correct' | 'p1' | 'p2' | 'p3'
  const [activeTab, setActiveTab] = useState<'all' | 'high_error' | 'high_correct' | 'p1' | 'p2' | 'p3'>('all');
  const [copiedReport, setCopiedReport] = useState(false);
  const [exportedExcel, setExportedExcel] = useState(false);

  // View mode: 'analytics' (question analysis) or 'students' (student list)
  const [activeViewMode, setActiveViewMode] = useState<'analytics' | 'students'>('analytics');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentResultFilter, setStudentResultFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<ExamSubmission | null>(null);
  const [expandedQuestionKey, setExpandedQuestionKey] = useState<string | null>(null);

  const selectedExam = useMemo(() => {
    if (!selectedExamId) return null;
    return exams.find((e) => e.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Filter submissions matching this exam & class
  const filteredSubmissions = useMemo(() => {
    if (!selectedExam) return [];
    const normExamTitle = normalizeExamTitle(selectedExam.title);
    return history.filter((h) => {
      const matchExam = normalizeExamTitle(h.examTitle) === normExamTitle;
      if (!matchExam) return false;
      if (selectedClass !== 'Tất cả' && h.group !== selectedClass) return false;
      return true;
    });
  }, [selectedExam, history, selectedClass]);

  // Helper normalizer for Part 2 True/False
  const normalizeTF = (val: any): string => {
    const s = String(val || '').trim().toUpperCase();
    if (s === 'Đ' || s === 'D' || s === 'TRUE' || s === 'T' || s === '1' || s === 'ĐÚNG' || s === 'DUNG') return 'Đ';
    if (s === 'S' || s === 'FALSE' || s === 'F' || s === '0' || s === 'SAI') return 'S';
    return s;
  };

  // Helper normalizer for Part 3 Short Answer
  const normalizeShortAnswer = (val: string): string => {
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

  // Question-by-question statistical calculation
  const questionStats: QuestionStat[] = useMemo(() => {
    if (!selectedExam || !selectedExam.answers) return [];

    const cfg = selectedExam.questions || {};
    const answers = selectedExam.answers || { p1: {}, p2: {}, p3: {} };
    const p1Ans = answers.p1 || {};
    const p2Ans = answers.p2 || {};
    const p3Ans = answers.p3 || {};

    const numP1 = Number(cfg.num_p1) || Object.keys(p1Ans).length || 0;
    const numP2 = Number(cfg.num_p2) || Object.keys(p2Ans).length || 0;
    const numP3 = Number(cfg.num_p3) || Object.keys(p3Ans).length || 0;

    const totalSubs = filteredSubmissions.length;
    const stats: QuestionStat[] = [];

    // Parse all student answers once
    const parsedSubmissions = filteredSubmissions.map((h) => {
      let sAns = h.details;
      if (typeof sAns === 'string') {
        try {
          sAns = JSON.parse(sAns);
        } catch (e) {
          sAns = { p1: {}, p2: {}, p3: {} };
        }
      }
      return {
        ...h,
        parsedDetails: sAns || { p1: {}, p2: {}, p3: {} },
      };
    });

    // 1. PART I
    for (let q = 1; q <= numP1; q++) {
      const qKey = String(q);
      const correctKey = String(p1Ans[qKey] || '').trim().toUpperCase();
      let correctCount = 0;
      let incorrectCount = 0;
      let blankCount = 0;
      const choicesCount: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
      const wrongChoicesCount: Record<string, number> = {};

      parsedSubmissions.forEach((sub) => {
        const studentChoice = String(sub.parsedDetails?.p1?.[qKey] || '').trim().toUpperCase();
        if (!studentChoice) {
          blankCount++;
        } else {
          if (['A', 'B', 'C', 'D'].includes(studentChoice)) {
            choicesCount[studentChoice] = (choicesCount[studentChoice] || 0) + 1;
          }
          if (studentChoice === correctKey) {
            correctCount++;
          } else {
            incorrectCount++;
            wrongChoicesCount[studentChoice] = (wrongChoicesCount[studentChoice] || 0) + 1;
          }
        }
      });

      // Find most common wrong choice
      let mostCommonWrong = '';
      let maxWrongCount = 0;
      Object.entries(wrongChoicesCount).forEach(([c, cnt]) => {
        if (cnt > maxWrongCount) {
          maxWrongCount = cnt;
          mostCommonWrong = `${c} (${cnt} lượt chọn, ${totalSubs > 0 ? Math.round((cnt / totalSubs) * 100) : 0}%)`;
        }
      });

      const effectiveTotal = Math.max(totalSubs, 1);
      stats.push({
        part: 1,
        partLabel: 'Phần I (Trắc nghiệm)',
        questionNumber: q,
        label: `Phần I - Câu ${q}`,
        correctAnswer: correctKey || 'Chưa nạp',
        totalAttempts: totalSubs,
        correctCount,
        incorrectCount,
        blankCount,
        correctRate: totalSubs > 0 ? Math.round((correctCount / totalSubs) * 100) : 0,
        incorrectRate: totalSubs > 0 ? Math.round((incorrectCount / totalSubs) * 100) : 0,
        blankRate: totalSubs > 0 ? Math.round((blankCount / totalSubs) * 100) : 0,
        choiceDistribution: choicesCount,
        mostCommonWrongChoice: mostCommonWrong,
      });
    }

    // 2. PART II (True/False with 4 sub-items a, b, c, d)
    for (let q = 1; q <= numP2; q++) {
      const qKey = String(q);
      const keySub = p2Ans[qKey] || {};
      let perfectCorrectSubs = 0;
      let incorrectQuestionCount = 0;
      let blankCount = 0;

      const subItemsDetailed: QuestionStat['subItemStats'] = (['a', 'b', 'c', 'd'] as const).map((sub) => {
        const correctVal = normalizeTF(keySub[sub]);
        let subCorrect = 0;
        let subIncorrect = 0;

        parsedSubmissions.forEach((submission) => {
          const stuSub = submission.parsedDetails?.p2?.[qKey] || {};
          const studentVal = normalizeTF(stuSub[sub]);
          if (!studentVal) {
            subIncorrect++;
          } else if (studentVal === correctVal) {
            subCorrect++;
          } else {
            subIncorrect++;
          }
        });

        return {
          sub,
          correctKey: correctVal || '?',
          correctCount: subCorrect,
          incorrectCount: subIncorrect,
          correctRate: totalSubs > 0 ? Math.round((subCorrect / totalSubs) * 100) : 0,
          incorrectRate: totalSubs > 0 ? Math.round((subIncorrect / totalSubs) * 100) : 0,
        };
      });

      // Calculate whole-question correctness (all 4 subs correct = 100% question success)
      parsedSubmissions.forEach((submission) => {
        const stuSub = submission.parsedDetails?.p2?.[qKey] || {};
        let matching = 0;
        let answeredSubs = 0;

        (['a', 'b', 'c', 'd'] as const).forEach((sub) => {
          const correctVal = normalizeTF(keySub[sub]);
          const studentVal = normalizeTF(stuSub[sub]);
          if (studentVal) answeredSubs++;
          if (studentVal && correctVal && studentVal === correctVal) {
            matching++;
          }
        });

        if (answeredSubs === 0) {
          blankCount++;
        } else if (matching === 4) {
          perfectCorrectSubs++;
        } else {
          incorrectQuestionCount++;
        }
      });

      const formattedAnswer = (['a', 'b', 'c', 'd'] as const)
        .map((s) => `${s}: ${normalizeTF(keySub[s]) || '?'}`)
        .join(' | ');

      stats.push({
        part: 2,
        partLabel: 'Phần II (Đúng/Sai)',
        questionNumber: q,
        label: `Phần II - Câu ${q}`,
        correctAnswer: formattedAnswer,
        totalAttempts: totalSubs,
        correctCount: perfectCorrectSubs,
        incorrectCount: incorrectQuestionCount,
        blankCount,
        correctRate: totalSubs > 0 ? Math.round((perfectCorrectSubs / totalSubs) * 100) : 0,
        incorrectRate: totalSubs > 0 ? Math.round((incorrectQuestionCount / totalSubs) * 100) : 0,
        blankRate: totalSubs > 0 ? Math.round((blankCount / totalSubs) * 100) : 0,
        subItemStats: subItemsDetailed,
      });
    }

    // 3. PART III (Short answers)
    for (let q = 1; q <= numP3; q++) {
      const qKey = String(q);
      const rawCorrectVal = String(p3Ans[qKey] || '');
      const normCorrectVal = normalizeShortAnswer(rawCorrectVal);
      let correctCount = 0;
      let incorrectCount = 0;
      let blankCount = 0;
      const wrongAnswerFrequencies: Record<string, number> = {};

      parsedSubmissions.forEach((sub) => {
        const rawStudentVal = String(sub.parsedDetails?.p3?.[qKey] || '').trim();
        if (!rawStudentVal) {
          blankCount++;
        } else {
          const normStudentVal = normalizeShortAnswer(rawStudentVal);
          const isCorrect =
            rawStudentVal.toLowerCase() === rawCorrectVal.toLowerCase() ||
            (normCorrectVal !== '' && normStudentVal === normCorrectVal);

          if (isCorrect) {
            correctCount++;
          } else {
            incorrectCount++;
            const displayStr = rawStudentVal.slice(0, 30);
            wrongAnswerFrequencies[displayStr] = (wrongAnswerFrequencies[displayStr] || 0) + 1;
          }
        }
      });

      const commonWrongList = Object.entries(wrongAnswerFrequencies)
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      stats.push({
        part: 3,
        partLabel: 'Phần III (Trả lời ngắn)',
        questionNumber: q,
        label: `Phần III - Câu ${q}`,
        correctAnswer: rawCorrectVal || 'Chưa nạp',
        totalAttempts: totalSubs,
        correctCount,
        incorrectCount,
        blankCount,
        correctRate: totalSubs > 0 ? Math.round((correctCount / totalSubs) * 100) : 0,
        incorrectRate: totalSubs > 0 ? Math.round((incorrectCount / totalSubs) * 100) : 0,
        blankRate: totalSubs > 0 ? Math.round((blankCount / totalSubs) * 100) : 0,
        commonWrongInputs: commonWrongList,
      });
    }

    return stats;
  }, [selectedExam, filteredSubmissions]);

  // TOP QUESTIONS WITH HIGHEST ERROR RATE (Câu sai nhiều nhất)
  const topWrongQuestions = useMemo(() => {
    return [...questionStats]
      .filter((q) => q.totalAttempts > 0)
      .sort((a, b) => b.incorrectRate - a.incorrectRate)
      .slice(0, 5);
  }, [questionStats]);

  // TOP QUESTIONS WITH HIGHEST CORRECT RATE (Câu đúng nhiều nhất)
  const topCorrectQuestions = useMemo(() => {
    return [...questionStats]
      .filter((q) => q.totalAttempts > 0)
      .sort((a, b) => b.correctRate - a.correctRate)
      .slice(0, 5);
  }, [questionStats]);

  // Filter questions for detailed table
  const displayedQuestions = useMemo(() => {
    let list = questionStats;

    if (activeTab === 'high_error') {
      list = list.filter((q) => q.incorrectRate >= 40 || q.blankRate >= 40);
    } else if (activeTab === 'high_correct') {
      list = list.filter((q) => q.correctRate >= 70);
    } else if (activeTab === 'p1') {
      list = list.filter((q) => q.part === 1);
    } else if (activeTab === 'p2') {
      list = list.filter((q) => q.part === 2);
    } else if (activeTab === 'p3') {
      list = list.filter((q) => q.part === 3);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((q) => 
        q.label.toLowerCase().includes(term) ||
        q.correctAnswer.toLowerCase().includes(term) ||
        String(q.questionNumber) === term
      );
    }

    return list;
  }, [questionStats, activeTab, searchTerm]);

  // General Score Stats
  const scoreStats = useMemo(() => {
    if (filteredSubmissions.length === 0) return { avg: 0, max: 0, min: 0, passed: 0, failed: 0 };
    const scores = filteredSubmissions.map((s) => Number(s.score) || 0);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / scores.length) * 100) / 100;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const passed = scores.filter((sc) => sc >= 5.0).length;
    const failed = scores.length - passed;
    return { avg, max, min, passed, failed };
  }, [filteredSubmissions]);

  const getSubmissionStats = (sub: ExamSubmission) => {
    const sc = Number(sub.score) || 0;
    const result = sc >= 5.0 ? 'Đạt' : 'Chưa đạt';
    let rank = 'Đạt';
    if (sc >= 9.0) rank = 'Xuất sắc';
    else if (sc >= 8.0) rank = 'Giỏi';
    else if (sc >= 6.5) rank = 'Khá';
    else if (sc < 5.0) rank = 'Chưa đạt';

    const cfg = selectedExam?.questions || {};
    const answers = selectedExam?.answers || { p1: {}, p2: {}, p3: {} };
    const p1Ans = answers.p1 || {};
    const p2Ans = answers.p2 || {};
    const p3Ans = answers.p3 || {};
    const numP1 = Number(cfg.num_p1) || Object.keys(p1Ans).length || 0;
    const numP2 = Number(cfg.num_p2) || Object.keys(p2Ans).length || 0;
    const numP3 = Number(cfg.num_p3) || Object.keys(p3Ans).length || 0;
    const totalQ = numP1 + numP2 + numP3;

    let correct: number | undefined = undefined;
    if (typeof sub.correct === 'number') {
      correct = sub.correct;
    } else if (typeof (sub as any).correctCount === 'number') {
      correct = (sub as any).correctCount;
    } else if (selectedExam && sub.details) {
      const calc = calculateScoreLocally(selectedExam, sub.details);
      correct = calc.correct;
    }

    const finalCorrect = correct !== undefined ? correct : (totalQ > 0 && sc > 0 ? Math.round((sc / 10) * totalQ) : 0);
    const finalTotal = totalQ || (sub as any).totalQuestions || finalCorrect;
    const finalWrong = finalTotal >= finalCorrect ? finalTotal - finalCorrect : 0;

    let duration = 'Chưa ghi nhận';
    if (sub.timing?.formattedDuration) {
      duration = sub.timing.formattedDuration;
    } else if (sub.timing?.totalSeconds) {
      const m = Math.floor(sub.timing.totalSeconds / 60);
      const s = sub.timing.totalSeconds % 60;
      duration = m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
    } else if ((sub as any).durationMinutes) {
      duration = `${(sub as any).durationMinutes} phút`;
    }

    const rawSubAt = sub.submitted_at || (sub as any).submittedAt || '';
    let submittedAt = rawSubAt;
    if (rawSubAt && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(rawSubAt)) {
      const d = new Date(rawSubAt);
      if (!isNaN(d.getTime())) {
        submittedAt = d.toLocaleString('vi-VN');
      }
    }

    return {
      score: sc,
      result,
      rank,
      correct: finalCorrect,
      wrong: finalWrong,
      total: finalTotal,
      duration,
      submittedAt,
    };
  };

  // Filtered student submissions for the student list tab
  const studentListFiltered = useMemo(() => {
    return filteredSubmissions.filter((s) => {
      const scoreNum = Number(s.score) || 0;
      if (studentResultFilter === 'passed' && scoreNum < 5.0) return false;
      if (studentResultFilter === 'failed' && scoreNum >= 5.0) return false;
      if (studentSearchTerm.trim()) {
        const query = studentSearchTerm.toLowerCase();
        const matchName = (s.name || '').toLowerCase().includes(query);
        const matchUser = (s.username || '').toLowerCase().includes(query);
        const matchGroup = (s.group || '').toLowerCase().includes(query);
        return matchName || matchUser || matchGroup;
      }
      return true;
    });
  }, [filteredSubmissions, studentResultFilter, studentSearchTerm]);

  // Copy full analytics report to clipboard
  const handleCopyReport = () => {
    if (!selectedExam) return;
    let report = `BÁO CÁO PHÂN TÍCH CÂU HỎI ĐÚNG / SAI\n`;
    report += `Đề thi: ${selectedExam.title}\n`;
    report += `Phạm vi lớp: ${selectedClass}\n`;
    report += `Số lượt làm bài: ${filteredSubmissions.length} bài\n`;
    report += `Điểm trung bình: ${scoreStats.avg} / 10 (Cao nhất: ${scoreStats.max}, Thấp nhất: ${scoreStats.min})\n`;
    report += `Đạt (≥ 5.0): ${scoreStats.passed}/${filteredSubmissions.length} HS (${Math.round((scoreStats.passed / (filteredSubmissions.length || 1)) * 100)}%) | Chưa đạt (< 5.0): ${scoreStats.failed}/${filteredSubmissions.length} HS (${Math.round((scoreStats.failed / (filteredSubmissions.length || 1)) * 100)}%)\n\n`;

    report += `=== ⚠️ TOP CÂU SAI NHIỀU NHẤT (Cần giáo viên chữa kỹ) ===\n`;
    topWrongQuestions.forEach((q, idx) => {
      report += `${idx + 1}. ${q.label}: Sai/Bỏ trống ${q.incorrectRate + q.blankRate}% (${q.incorrectCount} sai, ${q.blankCount} bỏ trống / ${q.totalAttempts} học sinh) - Đáp án: [${q.correctAnswer}]\n`;
      if (q.mostCommonWrongChoice) {
        report += `   -> Học sinh hay nhầm: ${q.mostCommonWrongChoice}\n`;
      }
    });

    report += `\n=== 🏆 TOP CÂU ĐÚNG NHIỀU NHẤT (Học sinh nắm vững) ===\n`;
    topCorrectQuestions.forEach((q, idx) => {
      report += `${idx + 1}. ${q.label}: Đúng ${q.correctRate}% (${q.correctCount}/${q.totalAttempts} học sinh) - Đáp án: [${q.correctAnswer}]\n`;
    });

    report += `\n=== BẢNG TỔNG HỢP CHI TIẾT TỪNG CÂU ===\n`;
    questionStats.forEach((q) => {
      report += `${q.label} | Đáp án: [${q.correctAnswer}] | Đúng: ${q.correctRate}% | Sai: ${q.incorrectRate}% | Chưa làm: ${q.blankRate}%\n`;
    });

    navigator.clipboard.writeText(report).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3000);
    });
  };

  // Export full analytics report to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!selectedExam) return;

    try {
      const wb = XLSX.utils.book_new();

      // ==========================================
      // SHEET 1: Thống Kê Toàn Bộ Câu Hỏi
      // ==========================================
      const sheet1Data: Record<string, any>[] = [];

      // Metadata Header Row
      sheet1Data.push({
        'STT': '',
        'Vị Trí Câu': `BÁO CÁO PHÂN TÍCH ĐỀ THI: ${selectedExam.title.toUpperCase()}`,
        'Phần Thi': `Phạm vi: ${selectedClass === 'Tất cả' ? 'Tất cả các lớp' : `Lớp ${selectedClass}`}`,
        'Đáp Án Chuẩn': '',
        'Tỉ Lệ Đúng (%)': '',
        'Tỉ Lệ Sai (%)': '',
        'Tỉ Lệ Bỏ Trống (%)': '',
        'Số HS Đúng': '',
        'Số HS Sai': '',
        'Số HS Bỏ Trống': '',
        'Tổng Lượt Làm': filteredSubmissions.length,
        'Học Sinh Hay Nhầm': '',
        'Phân Bổ Lựa Chọn': '',
        'Đánh Giá Sư Phạm': `Điểm TB: ${scoreStats.avg} | Cao nhất: ${scoreStats.max} | Thấp nhất: ${scoreStats.min} | Đạt (>=5.0): ${scoreStats.passed}/${filteredSubmissions.length} HS (${Math.round((scoreStats.passed / (filteredSubmissions.length || 1)) * 100)}%) | Chưa đạt (<5.0): ${scoreStats.failed}/${filteredSubmissions.length} HS (${Math.round((scoreStats.failed / (filteredSubmissions.length || 1)) * 100)}%)`,
      });

      // Blank line
      sheet1Data.push({});

      questionStats.forEach((q, idx) => {
        let optionsStr = '';
        if (q.part === 1 && q.choiceDistribution) {
          optionsStr = `A: ${q.choiceDistribution['A'] || 0} | B: ${q.choiceDistribution['B'] || 0} | C: ${q.choiceDistribution['C'] || 0} | D: ${q.choiceDistribution['D'] || 0}`;
        } else if (q.part === 2 && q.subItemStats) {
          optionsStr = q.subItemStats.map((s) => `${s.sub}: Đúng ${s.correctRate}%`).join(' | ');
        } else if (q.part === 3 && q.commonWrongInputs && q.commonWrongInputs.length > 0) {
          optionsStr = q.commonWrongInputs.map((item) => `"${item.text}": ${item.count} HS`).join('; ');
        }

        let assessment = 'Đạt chuẩn yêu cầu';
        const failRate = q.incorrectRate + q.blankRate;
        if (q.correctRate >= 85) {
          assessment = 'Nắm vững rất tốt';
        } else if (failRate >= 50) {
          assessment = '⚠️ Báo động: Tỉ lệ sai rất cao (Cần chữa kỹ)';
        } else if (failRate >= 35) {
          assessment = 'Lưu ý: Nhiều học sinh bị nhầm lẫn';
        }

        sheet1Data.push({
          'STT': idx + 1,
          'Vị Trí Câu': q.label,
          'Phần Thi': q.partLabel,
          'Đáp Án Chuẩn': q.correctAnswer,
          'Tỉ Lệ Đúng (%)': `${q.correctRate}%`,
          'Tỉ Lệ Sai (%)': `${q.incorrectRate}%`,
          'Tỉ Lệ Bỏ Trống (%)': `${q.blankRate}%`,
          'Số HS Đúng': q.correctCount,
          'Số HS Sai': q.incorrectCount,
          'Số HS Bỏ Trống': q.blankCount,
          'Tổng Lượt Làm': q.totalAttempts,
          'Học Sinh Hay Nhầm': q.mostCommonWrongChoice || 'Không đáng kể',
          'Phân Bổ Lựa Chọn': optionsStr,
          'Đánh Giá Sư Phạm': assessment,
        });
      });

      const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
      ws1['!cols'] = [
        { wch: 6 },   // STT
        { wch: 24 },  // Vị Trí Câu
        { wch: 22 },  // Phần Thi
        { wch: 15 },  // Đáp Án Chuẩn
        { wch: 15 },  // Tỉ Lệ Đúng (%)
        { wch: 15 },  // Tỉ Lệ Sai (%)
        { wch: 18 },  // Tỉ Lệ Bỏ Trống (%)
        { wch: 12 },  // Số HS Đúng
        { wch: 12 },  // Số HS Sai
        { wch: 14 },  // Số HS Bỏ Trống
        { wch: 14 },  // Tổng Lượt Làm
        { wch: 25 },  // Học Sinh Hay Nhầm
        { wch: 36 },  // Phân Bổ Lựa Chọn
        { wch: 45 },  // Đánh Giá Sư Phạm
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'Thong_Ke_Tung_Cau');

      // ==========================================
      // SHEET 2: Top Câu Sai Nhiều & Câu Bẫy
      // ==========================================
      const sheet2Data = topWrongQuestions.map((q, idx) => {
        const failRate = q.incorrectRate + q.blankRate;
        let advice = 'Giáo viên nên phân tích phương án nhiễu';
        if (failRate >= 60) {
          advice = 'Lỗ hổng kiến thức lớn - Cần ôn tập lại chuyên đề và chữa bài chi tiết từng bước';
        } else if (q.blankRate >= 30) {
          advice = 'Nhiều học sinh bỏ trắng - Có thể đề quá dài hoặc bài toán lạ';
        }

        return {
          'Xếp Hạng': `Top ${idx + 1}`,
          'Vị Trí Câu': q.label,
          'Phần Thi': q.partLabel,
          'Đáp Án Đúng': q.correctAnswer,
          'Tỉ Lệ Sai & Trống': `${failRate}%`,
          'Tỉ Lệ Sai': `${q.incorrectRate}%`,
          'Tỉ Lệ Bỏ Trống': `${q.blankRate}%`,
          'Số HS Sai': q.incorrectCount,
          'Số HS Bỏ Trống': q.blankCount,
          'Tổng Lượt Làm': q.totalAttempts,
          'Phương Án Hay Nhầm Lẫn': q.mostCommonWrongChoice || 'Nhiều phương án khác nhau',
          'Khuyến Nghị Giảng Dạy': advice,
        };
      });

      const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
      ws2['!cols'] = [
        { wch: 10 },
        { wch: 24 },
        { wch: 22 },
        { wch: 15 },
        { wch: 18 },
        { wch: 14 },
        { wch: 16 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 30 },
        { wch: 55 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Top_Cau_Sai_Nhieu');

      // ==========================================
      // SHEET 3: Top Câu Đúng Nhiều Nhất
      // ==========================================
      const sheet3Data = topCorrectQuestions.map((q, idx) => ({
        'Xếp Hạng': `Top ${idx + 1}`,
        'Vị Trí Câu': q.label,
        'Phần Thi': q.partLabel,
        'Đáp Án Đúng': q.correctAnswer,
        'Tỉ Lệ Đúng (%)': `${q.correctRate}%`,
        'Số HS Đúng': q.correctCount,
        'Tổng Lượt Làm': q.totalAttempts,
        'Đánh Giá': 'Học sinh nắm rất vững dạng bài này',
      }));

      const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
      ws3['!cols'] = [
        { wch: 10 },
        { wch: 24 },
        { wch: 22 },
        { wch: 15 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 35 },
      ];
      XLSX.utils.book_append_sheet(wb, ws3, 'Top_Cau_Dung_Nhieu');

      // ==========================================
      // SHEET 4: Bảng Điểm Học Sinh
      // ==========================================
      const sheet4Data = filteredSubmissions.map((sub, idx) => {
        const stats = getSubmissionStats(sub);

        return {
          'STT': idx + 1,
          'Họ Và Tên': sub.name || (sub as any).studentName || sub.username,
          'Tài Khoản (SBD)': sub.username || '',
          'Lớp': sub.group || (sub as any).className || (sub as any).class || 'Chưa rõ',
          'Điểm Số': stats.score,
          'Đánh Giá': stats.result,
          'Xếp Loại': stats.rank,
          'Số Câu Đúng': stats.correct,
          'Số Câu Sai': stats.wrong,
          'Tổng Số Câu': stats.total,
          'Tỉ Lệ Đúng (%)': `${stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%`,
          'Thời Gian Làm Bài': stats.duration,
          'Thời Gian Nộp': stats.submittedAt,
          'Số Lần Vi Phạm': sub.cheat || '0 lần',
        };
      });

      const ws4 = XLSX.utils.json_to_sheet(sheet4Data);
      ws4['!cols'] = [
        { wch: 6 },   // STT
        { wch: 26 },  // Họ Và Tên
        { wch: 16 },  // Tài Khoản (SBD)
        { wch: 12 },  // Lớp
        { wch: 10 },  // Điểm Số
        { wch: 14 },  // Đánh Giá (Đạt / Chưa đạt)
        { wch: 14 },  // Xếp Loại (Xuất sắc / Giỏi / Khá / Đạt / Chưa đạt)
        { wch: 14 },  // Số Câu Đúng
        { wch: 14 },  // Số Câu Sai
        { wch: 14 },  // Tổng Số Câu
        { wch: 16 },  // Tỉ Lệ Đúng (%)
        { wch: 20 },  // Thời Gian Làm Bài
        { wch: 22 },  // Thời Gian Nộp
        { wch: 16 },  // Số Lần Vi Phạm
      ];
      XLSX.utils.book_append_sheet(wb, ws4, 'Bang_Diem_Chi_Tiet');

      // Tạo tên file an toàn, rõ ràng
      const safeTitle = (selectedExam.title || 'DeThi')
        .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')
        .substring(0, 30);
      const safeClass = (selectedClass || 'TatCa').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Thong_Ke_Cau_Hoi_${safeTitle}_${safeClass}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);

      setExportedExcel(true);
      setTimeout(() => setExportedExcel(false), 3000);
    } catch (err) {
      console.error('Lỗi xuất file Excel thống kê:', err);
      alert('Không thể xuất file Excel: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const modalContent = (
    <div className={`bg-white border-3 border-[#111111] shadow-[8px_8px_0px_#111111] w-full ${embedded ? '' : 'max-w-5xl max-h-[92vh] flex flex-col my-auto'} animate-in fade-in duration-200`}>
      {/* Header */}
      <div className="bg-[#4D6BFE] text-white p-4 sm:p-5 border-b-3 border-[#111111] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
              Phân Tích Câu Đúng Nhiều / Sai Nhiều
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 font-medium">
              Thống kê chi tiết mức độ hiểu bài, câu dễ bẫy và kiến thức học sinh bị hổng
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 bg-white text-[#111111] hover:bg-rose-500 hover:text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] transition-all font-bold"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        {/* Filter Controls Bar */}
        <div className="bg-[#F4F4F0] p-4 border-b-2 border-[#111111] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Exam Select */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
              <BookOpen className="w-4 h-4 text-[#111111] shrink-0" />
              <select
                value={selectedExamId}
                onChange={(e) => {
                  setSelectedExamId(e.target.value);
                  setActiveViewMode('analytics');
                }}
                className="w-full bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] px-3 py-1.5 text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#4D6BFE]"
              >
                <option value="">-- Vui lòng chọn đề thi ({exams.length} đề) --</option>
                {exams.map((ex) => {
                  const subCount = history.filter(
                    (h) => normalizeExamTitle(h.examTitle) === normalizeExamTitle(ex.title)
                  ).length;
                  return (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({subCount} lượt nộp)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Class Select */}
            <div className="flex items-center gap-1.5 min-w-[140px]">
              <Users className="w-4 h-4 text-[#111111] shrink-0" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={!selectedExam}
                className="bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] px-3 py-1.5 text-xs sm:text-sm font-bold text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#4D6BFE] disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                <option value="Tất cả">Tất cả các lớp</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    Lớp {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={!selectedExam || filteredSubmissions.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-xs sm:text-sm border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5 transition-all ${
                !selectedExam || filteredSubmissions.length === 0
                  ? 'bg-neutral-200 text-neutral-400 border-neutral-400 shadow-none cursor-not-allowed'
                  : 'bg-[#4D6BFE] hover:bg-[#3b5bdb] text-white cursor-pointer'
              }`}
              title="Xuất báo cáo thống kê câu đúng / sai & bảng điểm ra file Excel (.xlsx)"
            >
              {exportedExcel ? <Check className="w-4 h-4 text-emerald-300" /> : <FileSpreadsheet className="w-4 h-4" />}
              {exportedExcel ? 'Đã Xuất Excel!' : 'Xuất File Excel (.xlsx)'}
            </button>

            <button
              onClick={handleCopyReport}
              disabled={!selectedExam || filteredSubmissions.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-black text-xs sm:text-sm border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5 transition-all ${
                !selectedExam || filteredSubmissions.length === 0
                  ? 'bg-neutral-200 text-neutral-400 border-neutral-400 shadow-none cursor-not-allowed'
                  : 'bg-[#00E599] hover:bg-[#00c784] text-[#111111] cursor-pointer'
              }`}
            >
              {copiedReport ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
              {copiedReport ? 'Đã Sao Chép Báo Cáo!' : 'Sao Chép Báo Cáo'}
            </button>
          </div>
        </div>

        {/* View Mode Navigation Switcher (Only when an exam is selected) */}
        {selectedExam && (
          <div className="flex flex-wrap items-center justify-between border-b-2 border-[#111111] bg-[#FDF6E9] px-4 sm:px-6 py-2 shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveViewMode('analytics')}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black border-2 border-[#111111] transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeViewMode === 'analytics'
                    ? 'bg-[#111111] text-white shadow-[2px_2px_0px_#00E599]'
                    : 'bg-white text-[#111111] hover:bg-neutral-100 shadow-[2px_2px_0px_#111111]'
                }`}
              >
                <BarChart2 className="w-4 h-4 text-[#00E599]" />
                <span>Phân Tích Câu Hỏi (Đúng / Sai)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveViewMode('students')}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black border-2 border-[#111111] transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeViewMode === 'students'
                    ? 'bg-[#111111] text-white shadow-[2px_2px_0px_#FFC93C]'
                    : 'bg-white text-[#111111] hover:bg-neutral-100 shadow-[2px_2px_0px_#111111]'
                }`}
              >
                <Users className="w-4 h-4 text-[#FFC93C]" />
                <span>Danh Sách Học Sinh Nộp Bài ({filteredSubmissions.length})</span>
              </button>
            </div>

            <div className="text-xs font-bold text-neutral-600 hidden md:block">
              {activeViewMode === 'analytics'
                ? `Đang phân tích câu hỏi đề: ${selectedExam.title}`
                : `Bảng điểm chi tiết (${filteredSubmissions.length} bài thi): ${selectedExam.title}`}
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-white">
          {!selectedExam ? (
            <div className="p-6 sm:p-10 max-w-4xl mx-auto text-center space-y-6 flex-1 flex flex-col justify-center">
              <div className="w-16 h-16 bg-[#FFC93C] border-3 border-[#111111] shadow-[3px_3px_0px_#111111] flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8 text-[#111111]" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black uppercase text-[#111111]">
                  Vui Lòng Chọn Đề Thi Để Bắt Đầu Phân Tích & Xem Thống Kê
                </h3>
                <p className="text-xs sm:text-sm text-neutral-600 font-bold max-w-lg mx-auto mt-2">
                  Hệ thống không tự động bung dữ liệu để tránh làm rối mắt. Hãy chọn một đề thi cụ thể bên dưới hoặc dùng hộp chọn ở thanh công cụ phía trên.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-left pt-2">
                {exams.map((ex) => {
                  const subCount = history.filter(
                    (h) => normalizeExamTitle(h.examTitle) === normalizeExamTitle(ex.title)
                  ).length;
                  return (
                    <div
                      key={ex.id}
                      onClick={() => {
                        setSelectedExamId(ex.id);
                        setActiveViewMode('analytics');
                      }}
                      className="p-4 bg-white hover:bg-[#FDF6E9] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 bg-[#4D6BFE] text-white text-[10px] font-black uppercase">
                            {ex.subject || 'Đề Thi'}
                          </span>
                          <span className="text-[11px] font-bold text-neutral-500">
                            {ex.durationMinutes || 45} phút
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-[#111111] mt-2 line-clamp-2 group-hover:text-[#4D6BFE] transition-colors">
                          {ex.title}
                        </h4>
                      </div>

                      <div className="mt-4 pt-3 border-t-2 border-neutral-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#0F9D58]" />
                          <strong>{subCount}</strong> bài đã nộp
                        </span>
                        <span className="text-xs font-black text-[#4D6BFE] group-hover:translate-x-1 transition-transform">
                          Chọn đề &rarr;
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeViewMode === 'students' ? (
            <div className="space-y-4">
              {/* Filter & Search Bar for students */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FDF6E9] p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                    <input
                      type="text"
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      placeholder="Tìm theo tên học sinh, SBD hoặc lớp..."
                      className="w-full pl-9 pr-3 py-1.5 bg-white border-2 border-[#111111] text-xs font-bold text-[#111111] outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setStudentResultFilter('all')}
                    className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all cursor-pointer ${
                      studentResultFilter === 'all'
                        ? 'bg-[#111111] text-white'
                        : 'bg-white text-[#111111] hover:bg-neutral-100'
                    }`}
                  >
                    Tất Cả ({filteredSubmissions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentResultFilter('passed')}
                    className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all cursor-pointer ${
                      studentResultFilter === 'passed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    Đạt ({scoreStats.passed})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentResultFilter('failed')}
                    className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all cursor-pointer ${
                      studentResultFilter === 'failed'
                        ? 'bg-rose-600 text-white'
                        : 'bg-white text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    Chưa Đạt ({scoreStats.failed})
                  </button>
                </div>
              </div>

              {/* Students Table */}
              <div className="overflow-x-auto border-2 border-[#111111] shadow-[3px_3px_0px_#111111] bg-white">
                <table className="w-full min-w-[700px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FDF6E9] border-b-2 border-[#111111] font-black uppercase text-[#111111]">
                      <th className="p-3 w-12 text-center border-r-2 border-[#111111]">STT</th>
                      <th className="p-3 border-r-2 border-[#111111]">Họ và Tên (SBD)</th>
                      <th className="p-3 border-r-2 border-[#111111]">Lớp</th>
                      <th className="p-3 border-r-2 border-[#111111]">Điểm & Đánh Giá</th>
                      <th className="p-3 border-r-2 border-[#111111] text-center">Đúng / Sai</th>
                      <th className="p-3 border-r-2 border-[#111111] text-center">Thời Gian Làm Bài</th>
                      <th className="p-3 border-r-2 border-[#111111] text-center">Giám Sát</th>
                      <th className="p-3 text-center w-28">Chi Tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-neutral-200">
                    {studentListFiltered.map((sub, idx) => {
                      const stats = getSubmissionStats(sub);
                      return (
                        <tr key={sub.id || idx} className="hover:bg-[#FDF6E9]/60 transition-colors">
                          <td className="p-3 text-center font-bold text-neutral-500 border-r-2 border-neutral-200">
                            {idx + 1}
                          </td>
                          <td className="p-3 border-r-2 border-neutral-200">
                            <div className="font-black text-[#111111] text-sm">{sub.name}</div>
                            <div className="text-[11px] font-mono text-neutral-500 font-bold">{sub.username}</div>
                          </td>
                          <td className="p-3 font-black text-[#4D6BFE] uppercase border-r-2 border-neutral-200">
                            {sub.group || 'Khách'}
                          </td>
                          <td className="p-3 border-r-2 border-neutral-200">
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-black text-[#0F9D58]">{stats.score}</span>
                              <span
                                className={`px-1.5 py-0.2 text-[10px] font-black uppercase border rounded ${
                                  stats.result === 'Đạt'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                                    : 'bg-rose-100 text-rose-800 border-rose-400'
                                }`}
                              >
                                {stats.result}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center border-r-2 border-neutral-200 font-bold">
                            <span className="text-emerald-700">{stats.correct}</span> / <span className="text-rose-600">{stats.wrong}</span>
                            {stats.total > 0 && <span className="text-neutral-400 font-normal"> ({stats.total}c)</span>}
                          </td>
                          <td className="p-3 text-center border-r-2 border-neutral-200">
                            <div className="font-bold text-neutral-700">{stats.duration}</div>
                          </td>
                          <td className="p-3 text-center border-r-2 border-neutral-200">
                            {sub.cheat && String(sub.cheat) !== '0 lần' ? (
                              <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-black text-[10px]">
                                {sub.cheat}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Nghiêm túc
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentForDetails(sub)}
                              className="px-2.5 py-1 bg-[#4D6BFE] hover:bg-[#3b5bdb] text-white border border-[#111111] font-black text-[11px] shadow-[1px_1px_0px_#111111] transition-all cursor-pointer"
                            >
                              Xem Bài &rarr;
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {studentListFiltered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-neutral-500 font-bold">
                          Không tìm thấy học sinh nào phù hợp với bộ lọc tìm kiếm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Metric Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="bg-[#F8F9FA] p-3 sm:p-4 border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
                  <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Tổng Lượt Nộp</div>
                  <div className="text-xl sm:text-2xl font-black text-[#111111] mt-1 flex items-baseline gap-1">
                    {filteredSubmissions.length}
                    <span className="text-xs font-normal text-gray-600">bài thi</span>
                  </div>
                </div>

                <div className="bg-[#FFF9E6] p-3 sm:p-4 border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Điểm Trung Bình</div>
                  <div className="text-xl sm:text-2xl font-black text-amber-900 mt-1 flex items-baseline gap-1">
                    {scoreStats.avg}
                    <span className="text-xs font-normal text-amber-700">/ 10</span>
                  </div>
                </div>

                <div className="bg-[#EBFBF5] p-3 sm:p-4 border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Đạt (≥ 5.0)</div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1 flex items-baseline gap-1">
                    {scoreStats.passed}
                    <span className="text-xs font-normal text-emerald-700">
                      ({filteredSubmissions.length > 0 ? Math.round((scoreStats.passed / filteredSubmissions.length) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="bg-[#FFF0F0] p-3 sm:p-4 border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
                  <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Chưa Đạt (&lt; 5.0)</div>
                  <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1 flex items-baseline gap-1">
                    {scoreStats.failed}
                    <span className="text-xs font-normal text-rose-600">
                      ({filteredSubmissions.length > 0 ? Math.round((scoreStats.failed / filteredSubmissions.length) * 100) : 0}%)
                    </span>
                  </div>
                </div>

                <div className="bg-[#FFF5F5] p-3 sm:p-4 border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
                  <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Cảnh Báo Rời Tab</div>
                  <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1 flex items-baseline gap-1">
                    {filteredSubmissions.filter((s) => s.cheat && String(s.cheat) !== '0 lần').length}
                    <span className="text-xs font-normal text-rose-600">lượt</span>
                  </div>
                  <div className="text-[10px] text-neutral-600 font-bold mt-0.5">
                    Giám sát rời màn hình
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-[#F0F4FF] p-3 sm:p-4 border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
                  <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Tổng Số Câu</div>
                  <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1 flex items-baseline gap-1">
                    {questionStats.length}
                    <span className="text-xs font-normal text-indigo-600">câu hỏi</span>
                  </div>
                </div>
              </div>

              {/* Quick banner linking to Student List */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#FDF6E9] border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-[#4D6BFE] shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-neutral-800">
                    Đã ghi nhận <strong>{filteredSubmissions.length} bài làm</strong> của học sinh cho đề thi này.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveViewMode('students')}
                  className="px-4 py-2 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] font-black text-xs shadow-[2px_2px_0px_#111111] flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Xem Danh Sách Học Sinh &rarr;</span>
                </button>
              </div>

              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-12 px-4 border-2 border-dashed border-gray-300 bg-gray-50">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h3 className="text-lg font-black text-gray-800">Chưa Có Lượt Nộp Bài Nào</h3>
              <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
                Chưa có học sinh nào thuộc {selectedClass === 'Tất cả' ? 'các lớp' : `lớp ${selectedClass}`} nộp bài cho đề thi này. Hãy chọn đề thi khác hoặc mời học sinh làm bài!
              </p>
            </div>
          ) : (
            <>
              {/* TWO KEY FOCUS HIGHLIGHT CARDS (Câu Đúng Nhiều & Câu Sai Nhiều) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* ⚠️ TOP CÂU SAI NHIỀU NHẤT */}
                <div className="bg-[#FFF5F5] border-3 border-[#111111] shadow-[4px_4px_0px_#111111] p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-rose-500 text-white border-2 border-[#111111]">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-rose-700 uppercase">
                          Câu Sai Nhiều Nhất (Học Sinh Yếu)
                        </h3>
                        <p className="text-xs text-gray-600 font-medium">Học sinh hay bị bẫy hoặc chưa nắm chắc kiến thức</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-black text-xs">
                      ƯU TIÊN CHỮA
                    </span>
                  </div>

                  <div className="space-y-3">
                    {topWrongQuestions.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Không có câu nào bị sai nhiều.</p>
                    ) : (
                      topWrongQuestions.map((q, idx) => (
                        <div key={q.label} className="bg-white p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-black text-sm text-[#111111]">{q.label}</span>
                                <span className="text-xs px-1.5 py-0.2 bg-gray-100 border border-gray-300 text-gray-700 font-bold">
                                  Đáp án: {q.correctAnswer}
                                </span>
                              </div>
                              {q.mostCommonWrongChoice && (
                                <div className="text-xs text-rose-700 font-semibold mt-1">
                                  ⚠️ Nhiều bạn nhầm sang: <span className="font-black">{q.mostCommonWrongChoice}</span>
                                </div>
                              )}
                              {q.commonWrongInputs && q.commonWrongInputs.length > 0 && (
                                <div className="text-xs text-rose-700 font-semibold mt-1">
                                  ⚠️ Lỗi sai phổ biến: {q.commonWrongInputs.map((w) => `"${w.text}" (${w.count} bạn)`).join(', ')}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base font-black text-rose-600">
                                {q.incorrectRate}%
                              </span>
                              <div className="text-[10px] text-gray-500 font-bold">
                                {q.incorrectCount}/{q.totalAttempts} học sinh sai
                              </div>
                            </div>
                          </div>

                          {/* Mini Progress Bar */}
                          <div className="w-full bg-gray-200 h-2 mt-2 border border-[#111111] flex overflow-hidden">
                            <div style={{ width: `${q.correctRate}%` }} className="bg-[#00E599]" title={`Đúng: ${q.correctRate}%`} />
                            <div style={{ width: `${q.incorrectRate}%` }} className="bg-rose-500" title={`Sai: ${q.incorrectRate}%`} />
                            <div style={{ width: `${q.blankRate}%` }} className="bg-gray-400" title={`Bỏ trống: ${q.blankRate}%`} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 🏆 TOP CÂU ĐÚNG NHIỀU NHẤT */}
                <div className="bg-[#F0FFF9] border-3 border-[#111111] shadow-[4px_4px_0px_#111111] p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#00E599] text-[#111111] border-2 border-[#111111]">
                        <TrendingUp className="w-5 h-5 text-emerald-900" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-emerald-800 uppercase">
                          Câu Đúng Nhiều Nhất (Học Sinh Giỏi)
                        </h3>
                        <p className="text-xs text-gray-600 font-medium">Học sinh nắm vững lý thuyết và kỹ năng giải toán</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-xs">
                      NẮM CHẮC
                    </span>
                  </div>

                  <div className="space-y-3">
                    {topCorrectQuestions.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Chưa có dữ liệu thống kê.</p>
                    ) : (
                      topCorrectQuestions.map((q, idx) => (
                        <div key={q.label} className="bg-white p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="font-black text-sm text-[#111111]">{q.label}</span>
                                <span className="text-xs px-1.5 py-0.2 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold">
                                  Đáp án: {q.correctAnswer}
                                </span>
                              </div>
                              <div className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{q.correctCount} / {q.totalAttempts} học sinh trả lời chính xác</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-base font-black text-emerald-600">
                                {q.correctRate}%
                              </span>
                              <div className="text-[10px] text-gray-500 font-bold">Tỉ lệ đúng</div>
                            </div>
                          </div>

                          {/* Mini Progress Bar */}
                          <div className="w-full bg-gray-200 h-2 mt-2 border border-[#111111] flex overflow-hidden">
                            <div style={{ width: `${q.correctRate}%` }} className="bg-[#00E599]" title={`Đúng: ${q.correctRate}%`} />
                            <div style={{ width: `${q.incorrectRate}%` }} className="bg-rose-500" title={`Sai: ${q.incorrectRate}%`} />
                            <div style={{ width: `${q.blankRate}%` }} className="bg-gray-400" title={`Bỏ trống: ${q.blankRate}%`} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* DETAILED QUESTION-BY-QUESTION BREAKDOWN TABLE */}
              <div className="border-3 border-[#111111] shadow-[4px_4px_0px_#111111] bg-white">
                
                {/* Table Filter Tabs */}
                <div className="p-3 sm:p-4 bg-[#F4F4F0] border-b-2 border-[#111111] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setActiveTab('all')}
                      className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all ${
                        activeTab === 'all'
                          ? 'bg-[#111111] text-white shadow-[2px_2px_0px_#4D6BFE]'
                          : 'bg-white text-[#111111] hover:bg-gray-100'
                      }`}
                    >
                      Tất Cả Các Câu ({questionStats.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('high_error')}
                      className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all flex items-center gap-1 ${
                        activeTab === 'high_error'
                          ? 'bg-rose-600 text-white shadow-[2px_2px_0px_#111111]'
                          : 'bg-white text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Câu Sai Nhiều (≥40%)
                    </button>
                    <button
                      onClick={() => setActiveTab('high_correct')}
                      className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all flex items-center gap-1 ${
                        activeTab === 'high_correct'
                          ? 'bg-emerald-600 text-white shadow-[2px_2px_0px_#111111]'
                          : 'bg-white text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Câu Đúng Nhiều (≥70%)
                    </button>
                    <button
                      onClick={() => setActiveTab('p1')}
                      className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all ${
                        activeTab === 'p1' ? 'bg-[#4D6BFE] text-white' : 'bg-white text-[#111111]'
                      }`}
                    >
                      Phần I
                    </button>
                    <button
                      onClick={() => setActiveTab('p2')}
                      className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all ${
                        activeTab === 'p2' ? 'bg-[#4D6BFE] text-white' : 'bg-white text-[#111111]'
                      }`}
                    >
                      Phần II
                    </button>
                    <button
                      onClick={() => setActiveTab('p3')}
                      className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all ${
                        activeTab === 'p3' ? 'bg-[#4D6BFE] text-white' : 'bg-white text-[#111111]'
                      }`}
                    >
                      Phần III
                    </button>
                  </div>

                  {/* Search box */}
                  <div className="relative min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm câu (vd: Câu 5)..."
                      className="w-full pl-8 pr-3 py-1 text-xs font-bold border-2 border-[#111111] shadow-[2px_2px_0px_#111111] focus:outline-none focus:ring-2 focus:ring-[#4D6BFE]"
                    />
                  </div>
                </div>

                {/* Question List Cards */}
                <div className="divide-y-2 divide-[#111111]">
                  {displayedQuestions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 font-bold text-sm">
                      Không tìm thấy câu hỏi nào phù hợp với bộ lọc hiện tại.
                    </div>
                  ) : (
                    displayedQuestions.map((q) => {
                      const isHighError = q.incorrectRate >= 40 || q.blankRate >= 40;
                      const isHighCorrect = q.correctRate >= 70;

                      return (
                        <div key={q.label} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="font-black text-sm text-[#111111]">{q.label}</span>
                                <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs">
                                  {q.partLabel}
                                </span>
                                <span className="px-2 py-0.5 bg-gray-100 border border-gray-300 text-gray-800 font-mono font-bold text-xs">
                                  Chuẩn: {q.correctAnswer}
                                </span>
                                {isHighError && (
                                  <span className="px-2 py-0.5 bg-rose-100 border border-rose-300 text-rose-800 font-black text-xs flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Sai nhiều
                                  </span>
                                )}
                                {isHighCorrect && (
                                  <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 font-black text-xs flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Đúng nhiều
                                  </span>
                                )}
                              </div>

                              {/* Part 1 Choice Distribution */}
                              {q.part === 1 && q.choiceDistribution && (
                                <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
                                  <span className="font-bold text-gray-500">Phân bố chọn:</span>
                                  {(['A', 'B', 'C', 'D'] as const).map((ch) => {
                                    const count = q.choiceDistribution?.[ch] || 0;
                                    const percent = q.totalAttempts > 0 ? Math.round((count / q.totalAttempts) * 100) : 0;
                                    const isCorrectChoice = ch === q.correctAnswer;
                                    return (
                                      <span
                                        key={ch}
                                        className={`px-2 py-0.5 font-mono font-bold border ${
                                          isCorrectChoice
                                            ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                                            : count > 0
                                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                                            : 'bg-gray-50 border-gray-200 text-gray-500'
                                        }`}
                                      >
                                        {ch}: {count} ({percent}%)
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Part 2 Sub-item breakdown */}
                              {q.part === 2 && q.subItemStats && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                  {q.subItemStats.map((sub) => (
                                    <div
                                      key={sub.sub}
                                      className={`p-1.5 border text-xs ${
                                        sub.incorrectRate >= 40
                                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                                          : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                      }`}
                                    >
                                      <div className="font-bold flex justify-between">
                                        <span>Ý {sub.sub} ({sub.correctKey})</span>
                                        <span className="font-black">{sub.correctRate}% đúng</span>
                                      </div>
                                      <div className="text-[10px] text-gray-600">
                                        {sub.correctCount} đúng / {sub.incorrectCount} sai
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Part 3 Common wrong answer strings */}
                              {q.part === 3 && q.commonWrongInputs && q.commonWrongInputs.length > 0 && (
                                <div className="text-xs text-gray-600 mt-2 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-rose-700">Các câu trả lời sai hay gặp:</span>
                                  {q.commonWrongInputs.map((w, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 font-mono">
                                      "{w.text}" ({w.count} bạn)
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Right side stats & progress bar */}
                            <div className="w-full sm:w-56 shrink-0 space-y-1">
                              <div className="flex justify-between text-xs font-bold">
                                <span className="text-emerald-700">{q.correctCount} đúng ({q.correctRate}%)</span>
                                <span className="text-rose-700">{q.incorrectCount} sai ({q.incorrectRate}%)</span>
                                {q.blankCount > 0 && (
                                  <span className="text-gray-500">{q.blankCount} trống</span>
                                )}
                              </div>
                              <div className="w-full bg-gray-200 h-2.5 border border-[#111111] flex overflow-hidden">
                                <div
                                  style={{ width: `${q.correctRate}%` }}
                                  className="bg-[#00E599] transition-all"
                                  title={`Đúng: ${q.correctRate}%`}
                                />
                                <div
                                  style={{ width: `${q.incorrectRate}%` }}
                                  className="bg-rose-500 transition-all"
                                  title={`Sai: ${q.incorrectRate}%`}
                                />
                                <div
                                  style={{ width: `${q.blankRate}%` }}
                                  className="bg-gray-400 transition-all"
                                  title={`Bỏ trống: ${q.blankRate}%`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </>
          )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F4F4F0] border-t-3 border-[#111111] flex justify-between items-center shrink-0">
          <div className="text-xs text-gray-600 font-medium hidden sm:block">
            Màu xanh: Tỉ lệ học sinh trả lời đúng | Màu đỏ: Tỉ lệ trả lời sai | Màu xám: Bỏ trống
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#111111] hover:bg-gray-800 text-white font-black text-sm border-2 border-[#111111] shadow-[3px_3px_0px_#4D6BFE] transition-all ml-auto"
            >
              Đóng Bảng Phân Tích
            </button>
          )}
        </div>

        {/* Student Submission Detail Modal */}
        {selectedStudentForDetails && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white border-3 border-[#111111] shadow-[6px_6px_0px_#111111] max-w-2xl w-full max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b-2 border-[#111111] bg-[#FDF6E9]">
                <div>
                  <span className="px-2 py-0.5 bg-[#4D6BFE] text-white text-[10px] font-black uppercase">
                    Chi Tiết Bài Làm Của Thí Sinh
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-[#111111] mt-1">
                    {selectedStudentForDetails.name} - Lớp {selectedStudentForDetails.group || 'Khách'}
                  </h3>
                  <div className="text-xs text-neutral-600 font-bold flex items-center gap-3 mt-1">
                    <span>SBD: <strong className="font-mono">{selectedStudentForDetails.username}</strong></span>
                    <span>Điểm: <strong className="text-emerald-700 text-sm">{selectedStudentForDetails.score} / 10</strong></span>
                    {selectedStudentForDetails.timing?.formattedDuration && (
                      <span>Thời gian: <strong>{selectedStudentForDetails.timing.formattedDuration}</strong></span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentForDetails(null)}
                  className="p-1.5 bg-white text-[#111111] hover:bg-rose-500 hover:text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-bold"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Answers breakdown */}
              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {(() => {
                  let parsed = selectedStudentForDetails.details;
                  if (typeof parsed === 'string') {
                    try {
                      parsed = JSON.parse(parsed);
                    } catch (e) {
                      parsed = null;
                    }
                  }
                  const p1Ans = parsed?.p1 || {};
                  const p2Ans = parsed?.p2 || {};
                  const p3Ans = parsed?.p3 || {};
                  const examP1Key = selectedExam?.answers?.p1 || {};
                  const examP2Key = selectedExam?.answers?.p2 || {};
                  const examP3Key = selectedExam?.answers?.p3 || {};

                  return (
                    <div className="space-y-4 text-xs">
                      {/* Part I */}
                      {Object.keys(examP1Key).length > 0 && (
                        <div className="border-2 border-[#111111] p-3 bg-[#F8F9FA]">
                          <h4 className="font-black uppercase text-[#111111] mb-2">Phần I: Trắc Nghiệm Nhiều Lựa Chọn</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {Object.keys(examP1Key).map((k) => {
                              const studentAns = String(p1Ans[k] || '').trim().toUpperCase();
                              const correctAns = String(examP1Key[k] || '').trim().toUpperCase();
                              const isCorrect = studentAns && studentAns === correctAns;
                              return (
                                <div
                                  key={k}
                                  className={`p-2 border font-bold flex items-center justify-between ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                      : 'bg-rose-50 border-rose-300 text-rose-900'
                                  }`}
                                >
                                  <span>Câu {k}: <strong>{studentAns || '(Trống)'}</strong></span>
                                  {isCorrect ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  ) : (
                                    <span className="text-[10px] text-rose-700">ĐA: {correctAns}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Part II */}
                      {Object.keys(examP2Key).length > 0 && (
                        <div className="border-2 border-[#111111] p-3 bg-[#F8F9FA]">
                          <h4 className="font-black uppercase text-[#111111] mb-2">Phần II: Đúng / Sai</h4>
                          <div className="space-y-2">
                            {Object.keys(examP2Key).map((k) => {
                              const subObj = examP2Key[k] || {};
                              const sSubObj = p2Ans[k] || {};
                              return (
                                <div key={k} className="p-2 bg-white border border-neutral-300">
                                  <div className="font-black text-neutral-800 mb-1">Câu {k}:</div>
                                  <div className="grid grid-cols-4 gap-2">
                                    {(['a', 'b', 'c', 'd'] as const).map((subKey) => {
                                      const sAns = normalizeTF(sSubObj[subKey]);
                                      const cAns = normalizeTF(subObj[subKey]);
                                      const isCorrect = sAns && sAns === cAns;
                                      return (
                                        <div
                                          key={subKey}
                                          className={`p-1.5 border text-center font-bold ${
                                            isCorrect
                                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                              : 'bg-rose-50 border-rose-300 text-rose-900'
                                          }`}
                                        >
                                          <span>Ý {subKey}: {sAns || '-'}</span>
                                          {!isCorrect && <div className="text-[9px] text-rose-700">ĐA: {cAns}</div>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Part III */}
                      {Object.keys(examP3Key).length > 0 && (
                        <div className="border-2 border-[#111111] p-3 bg-[#F8F9FA]">
                          <h4 className="font-black uppercase text-[#111111] mb-2">Phần III: Trả Lời Ngắn</h4>
                          <div className="space-y-2">
                            {Object.keys(examP3Key).map((k) => {
                              const sAns = normalizeShortAnswer(p3Ans[k] || '');
                              const cAns = normalizeShortAnswer(examP3Key[k] || '');
                              const isCorrect = sAns && sAns === cAns;
                              return (
                                <div
                                  key={k}
                                  className={`p-2 border font-bold flex items-center justify-between ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                      : 'bg-rose-50 border-rose-300 text-rose-900'
                                  }`}
                                >
                                  <span>Câu {k}: Bài làm: <strong>{p3Ans[k] || '(Trống)'}</strong></span>
                                  {isCorrect ? (
                                    <span className="text-emerald-700 flex items-center gap-1 font-black">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Chính xác
                                    </span>
                                  ) : (
                                    <span className="text-rose-700 text-[11px]">Đáp án: {examP3Key[k]}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="p-3 bg-[#F4F4F0] border-t-2 border-[#111111] flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForDetails(null)}
                  className="px-4 py-1.5 bg-[#111111] text-white text-xs font-black border-2 border-[#111111] shadow-[2px_2px_0px_#4D6BFE]"
                >
                  Đóng Chi Tiết
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
  );

  if (embedded) {
    return modalContent;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {modalContent}
    </div>
  );
};
