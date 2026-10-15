import React, { useState, useMemo } from 'react';
import { AppUser, ExamItem, ExamQuestionsConfig, ExamSubmission } from '../../types';
import { 
  LogOut, Clock, Calendar, Lock, CheckCircle2, 
  Trophy, BookOpen, Search, ArrowRight, Eye, Medal
} from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';
import { AvatarPickerModal } from '../common/AvatarPickerModal';
import { ExamLeaderboard } from './ExamLeaderboard';
import { 
  isExamAllowedForStudent, 
  getExamGradeBadge, 
  extractGradeFromClass 
} from '../../utils/gradeUtils';

interface LobbyViewProps {
  user: AppUser;
  exams: ExamItem[];
  history?: ExamSubmission[];
  loading: boolean;
  onLogout: () => void;
  onSelectExam: (exam: ExamItem) => void;
  onViewResult?: (exam: ExamItem, submission: ExamSubmission) => void;
  onUpdateAvatar?: (newAvatar: string) => Promise<void> | void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  user,
  exams,
  history = [],
  loading,
  onLogout,
  onSelectExam,
  onViewResult,
  onUpdateAvatar,
}) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'grades' | 'leaderboard'>('exams');
  const [historySearch, setHistorySearch] = useState('');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedLeaderboardExamId, setSelectedLeaderboardExamId] = useState<string>('');

  // Check schedule open window
  const isExamOpen = (cfg: ExamQuestionsConfig): boolean => {
    if (!cfg.start_time) return true;
    const now = new Date().getTime();
    const start = new Date(cfg.start_time).getTime();
    const end = cfg.end_time ? new Date(cfg.end_time).getTime() : Infinity;
    return now >= start && now <= end;
  };

  const safeExams = Array.isArray(exams) ? exams : [];

  // Lọc thông minh theo Khối lớp (Khối 10, Khối 11, Khối 12) và nhóm lớp chỉ định
  // Triệt tiêu 100% lỗi đề Khối 11 hiện trong tài khoản học sinh Khối 12
  const visibleExams = useMemo(() => {
    return safeExams.filter((ex) => ex && isExamAllowedForStudent(ex, user?.group || 'Khách'));
  }, [safeExams, user?.group]);

  const userGrade = extractGradeFromClass(user?.group);

  // Filter student's own submissions from history
  const userIdentifier = String(user.username || user.name || '').trim().toLowerCase();
  const mySubmissions = useMemo(() => {
    return (history || []).filter((h) => {
      const hUser = String(h.username || h.name || '').trim().toLowerCase();
      return hUser === userIdentifier;
    });
  }, [history, userIdentifier]);

  // Calculate personal student statistics
  const checkIsExamScorePending = (targetExam?: ExamItem, sub?: ExamSubmission) => {
    let examObj = targetExam;
    if (!examObj && sub) {
      examObj = safeExams.find(
        (e) => (e.id && e.id === sub.examId) || (e.title && e.title.trim().toLowerCase() === (sub.examTitle || '').trim().toLowerCase())
      );
    }
    if (!examObj) return false;
    const cfg = examObj.questions || {};
    const isManual = cfg.publish_score_mode === 'manual' || examObj.publish_score_mode === 'manual';
    const isReleased = cfg.score_released === true || examObj.score_released === true;
    return isManual && !isReleased;
  };

  const releasedSubmissions = mySubmissions.filter((s) => !checkIsExamScorePending(undefined, s));
  const totalSubmissions = mySubmissions.length;
  const averageScore = releasedSubmissions.length > 0
    ? Number((releasedSubmissions.reduce((acc, cur) => acc + (Number(cur.score) || 0), 0) / releasedSubmissions.length).toFixed(2))
    : 0;
  const bestScore = releasedSubmissions.length > 0
    ? Math.max(...releasedSubmissions.map((s) => Number(s.score) || 0))
    : 0;
  const passCount = releasedSubmissions.filter((s) => (Number(s.score) || 0) >= 5.0).length;

  const filteredMyHistory = mySubmissions.filter((h) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (h.examTitle || '').toLowerCase().includes(q) || (h.submitted_at || '').toLowerCase().includes(q);
  });

  const getScoreBadgeColor = (score: number) => {
    if (score >= 8.0) return 'bg-[#0F9D58] text-white';
    if (score >= 5.0) return 'bg-[#FFC93C] text-[#111111]';
    return 'bg-[#E63946] text-white';
  };

  const handleOpenResult = (sub: ExamSubmission) => {
    if (!onViewResult) return;
    const normalizeTitle = (t?: string) => (t || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const matchedExam = safeExams.find(
      (e) => (e.id && e.id === sub.examId) ||
             normalizeTitle(e.title) === normalizeTitle(sub.examTitle) ||
             normalizeTitle(e.title).includes(normalizeTitle(sub.examTitle)) ||
             normalizeTitle(sub.examTitle).includes(normalizeTitle(e.title))
    );

    const targetExam: ExamItem = matchedExam
      ? {
          ...matchedExam,
          answers: sub.correctAnswers || matchedExam.answers,
        }
      : {
          id: sub.examId || 'exam_' + Date.now(),
          title: sub.examTitle || 'Bài kiểm tra',
          duration: 45,
          answers: sub.correctAnswers,
          questions: {
            exam_type: 'custom',
            num_p1: 12,
            num_p2: 4,
            num_p3: 6,
          },
        };

    onViewResult(targetExam, sub);
  };

  // List of exams that have at least one submission or are available to view leaderboard
  const leaderboardExamList = useMemo(() => {
    const list: { id: string; title: string; count: number; exam?: ExamItem }[] = [];
    const seen = new Set<string>();

    // 1. From visible exams
    visibleExams.forEach((ex) => {
      const subs = (history || []).filter(
        (h) => (h.examTitle || '').trim().toLowerCase() === (ex.title || '').trim().toLowerCase() || (h.examId && h.examId === ex.id)
      );
      list.push({
        id: ex.id,
        title: ex.title,
        count: subs.length,
        exam: ex,
      });
      seen.add((ex.title || '').trim().toLowerCase());
    });

    // 2. From student's own submissions history
    (mySubmissions || []).forEach((h) => {
      const norm = (h.examTitle || '').trim().toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        const subs = (history || []).filter((x) => (x.examTitle || '').trim().toLowerCase() === norm);
        list.push({
          id: h.examId || norm,
          title: h.examTitle,
          count: subs.length,
        });
      }
    });

    return list;
  }, [visibleExams, history, mySubmissions]);

  // Active exam for the Leaderboard Tab
  const activeLeaderboardExam = useMemo(() => {
    if (selectedLeaderboardExamId) {
      const found = leaderboardExamList.find((item) => item.id === selectedLeaderboardExamId);
      if (found) return found;
    }
    // Default to first exam that has submissions, or first visible exam
    const withSubs = leaderboardExamList.find((item) => item.count > 0);
    return withSubs || leaderboardExamList[0] || null;
  }, [leaderboardExamList, selectedLeaderboardExamId]);

  // Submissions for the active leaderboard exam
  const activeLeaderboardSubmissions = useMemo(() => {
    if (!activeLeaderboardExam) return [];
    const targetTitle = (activeLeaderboardExam.title || '').trim().toLowerCase();
    const targetId = activeLeaderboardExam.id;

    return (history || []).filter((h) => {
      const hTitle = (h.examTitle || '').trim().toLowerCase();
      return hTitle === targetTitle || (h.examId && h.examId === targetId);
    });
  }, [history, activeLeaderboardExam]);

  // Quick switch to leaderboard tab for a specific exam
  const handleViewLeaderboardForExam = (examTitle: string, examId?: string) => {
    const target = leaderboardExamList.find(
      (e) => (examId && e.id === examId) || e.title.trim().toLowerCase() === examTitle.trim().toLowerCase()
    );
    if (target) {
      setSelectedLeaderboardExamId(target.id);
    }
    setActiveTab('leaderboard');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 min-h-[calc(100dvh-70px)] flex flex-col justify-between text-[#111111]">
      <div>
        {/* Welcome & Student Profile Card */}
        <header className="bg-white border-3 border-[#111111] p-5 sm:p-7 mb-6 shadow-[6px_6px_0px_#111111]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            {/* Student Identity Left Block */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <UserAvatar
                  avatar={user.avatar}
                  name={user.name}
                  size="xl"
                  showBorder={true}
                />
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(true)}
                  className="absolute -bottom-2 -right-2 px-1.5 py-0.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border border-[#111111] shadow-[1px_1px_0px_#111111] text-[9px] font-black uppercase cursor-pointer"
                  title="Đổi ảnh đại diện"
                >
                  Đổi
                </button>
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-black px-2 py-0.5 bg-[#4D6BFE] text-white border border-[#111111] uppercase tracking-wide">
                    {userGrade ? `Khối ${userGrade} • Lớp ${user.group}` : `Lớp ${user.group || 'Khách'}`}
                  </span>
                  <span className="font-mono text-neutral-600 font-bold">
                    SBD: {user.username}
                  </span>
                  <span className="text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={() => setShowAvatarModal(true)}
                    className="text-[#4D6BFE] font-black hover:underline cursor-pointer"
                  >
                    Tùy biến avatar
                  </button>
                </div>

                <h1 className="text-xl sm:text-3xl font-black uppercase text-[#111111] tracking-tight truncate">
                  {user.name}
                </h1>

                <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                  Cổng làm bài kiểm tra và theo dõi xếp hạng thi đua học tập.
                </p>
              </div>
            </div>

            {/* Student Fast Metrics Right Block */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-neutral-200">
              <div className="bg-[#FDF6E9] border-2 border-[#111111] p-2.5 sm:p-3 text-center min-w-[76px] sm:min-w-[92px]">
                <p className="text-[10px] text-neutral-600 font-black uppercase">Đã Hoàn Thành</p>
                <p className="text-lg sm:text-2xl font-black text-[#111111] tabular-nums">{totalSubmissions}</p>
                <span className="text-[9px] text-neutral-500 font-bold">bài thi</span>
              </div>

              <div className="bg-[#F0FDF4] border-2 border-[#111111] p-2.5 sm:p-3 text-center min-w-[76px] sm:min-w-[92px]">
                <p className="text-[10px] text-neutral-600 font-black uppercase">Điểm Cao Nhất</p>
                <p className="text-lg sm:text-2xl font-black text-[#0F9D58] tabular-nums">{bestScore.toFixed(1)}</p>
                <span className="text-[9px] text-neutral-500 font-bold">kỷ lục</span>
              </div>

              <div className="bg-[#EEF2FF] border-2 border-[#111111] p-2.5 sm:p-3 text-center min-w-[76px] sm:min-w-[92px]">
                <p className="text-[10px] text-neutral-600 font-black uppercase">Điểm TB</p>
                <p className="text-lg sm:text-2xl font-black text-[#4D6BFE] tabular-nums">{averageScore.toFixed(1)}</p>
                <span className="text-[9px] text-neutral-500 font-bold">thang 10</span>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="p-2.5 sm:px-3 sm:py-3 bg-white hover:bg-[#E63946] hover:text-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] transition-all cursor-pointer shrink-0"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Navigation Tabs (3 distinct zones) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
          {/* Tab 1: Exams */}
          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-3 border-[#111111] transition-all cursor-pointer ${
              activeTab === 'exams'
                ? 'bg-[#FFC93C] text-[#111111] shadow-[4px_4px_0px_#111111] -translate-y-0.5'
                : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] shadow-[2px_2px_0px_#111111]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Đề Thi Của Lớp</span>
            <span className="ml-1 px-1.5 py-0.2 text-xs bg-[#111111] text-white font-black tabular-nums">
              {visibleExams.length}
            </span>
          </button>

          {/* Tab 2: Grades & History */}
          <button
            type="button"
            onClick={() => setActiveTab('grades')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-3 border-[#111111] transition-all cursor-pointer ${
              activeTab === 'grades'
                ? 'bg-[#4D6BFE] text-white shadow-[4px_4px_0px_#111111] -translate-y-0.5'
                : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] shadow-[2px_2px_0px_#111111]'
            }`}
          >
            <Trophy className="w-4 h-4 text-[#FFC93C]" />
            <span>Bảng Điểm Cá Nhân</span>
            <span className={`ml-1 px-1.5 py-0.2 text-xs font-black tabular-nums ${
              activeTab === 'grades' ? 'bg-white text-[#111111]' : 'bg-[#111111] text-white'
            }`}>
              {totalSubmissions}
            </span>
          </button>

          {/* Tab 3: Leaderboard (Direct Student View!) */}
          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-3 border-[#111111] transition-all cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-[#00E599] text-[#111111] shadow-[4px_4px_0px_#111111] -translate-y-0.5'
                : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] shadow-[2px_2px_0px_#111111]'
            }`}
          >
            <Medal className="w-4 h-4 text-[#111111]" />
            <span>Bảng Xếp Hạng Đề Thi</span>
            <span className="ml-1 px-1.5 py-0.2 text-xs bg-[#111111] text-white font-black">
              Top
            </span>
          </button>
        </div>

        {/* ================= TAB 1: EXAMS LIST ================= */}
        {activeTab === 'exams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {loading ? (
              <div className="col-span-full text-center py-16 bg-white border-3 border-[#111111] shadow-[6px_6px_0px_#111111] p-8">
                <div className="w-10 h-10 border-4 border-[#111111] border-t-[#4D6BFE] animate-spin mb-3 mx-auto"></div>
                <p className="text-base font-black text-[#111111]">Đang đồng bộ danh sách đề thi...</p>
              </div>
            ) : visibleExams.length > 0 ? (
              visibleExams.map((exam) => {
                const cfg = exam.questions || {};
                const open = isExamOpen(cfg);

                // Calculate user's attempts on this exam
                const userAttempts = mySubmissions.filter((h) => {
                  const hExam = (h.examTitle || '').trim().toLowerCase();
                  return hExam === (exam.title || '').trim().toLowerCase() || (h.examId && h.examId === exam.id);
                });

                const attemptCount = userAttempts.length;
                const maxAttempts = Number(cfg.max_attempts) || 0;
                const isLimitExceeded = maxAttempts > 0 && attemptCount >= maxAttempts;
                const remainingAttempts = maxAttempts > 0 ? Math.max(0, maxAttempts - attemptCount) : null;

                const examBestScore = attemptCount > 0 ? Math.max(...userAttempts.map((a) => Number(a.score) || 0)) : null;

                return (
                  <div
                    key={exam.id}
                    className={`bg-white border-3 border-[#111111] p-5 flex flex-col justify-between transition-all duration-150 shadow-[5px_5px_0px_#111111] hover:shadow-[7px_7px_0px_#111111] relative ${
                      !open || isLimitExceeded ? 'opacity-95 bg-neutral-50' : ''
                    }`}
                  >
                    <div>
                      {/* Top Metadata Strip */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 text-[11px] font-black border-2 border-[#111111] shadow-[1px_1px_0px_#111111] ${getExamGradeBadge(exam).color}`}>
                            {getExamGradeBadge(exam).label}
                          </span>
                          <span className="bg-[#FDF6E9] text-[#111111] px-2 py-0.5 text-[11px] font-black border-2 border-[#111111]">
                            {cfg.exam_type === 'custom'
                              ? `Tùy biến (${cfg.num_p1 || 0}-${cfg.num_p2 || 0}-${cfg.num_p3 || 0})`
                              : `Chuẩn (${cfg.num_p1 || 12}-${cfg.num_p2 || 4}-${cfg.num_p3 || 6})`}
                          </span>
                        </div>

                        <span className="font-mono text-neutral-600 font-bold">
                          {exam.duration} phút
                        </span>
                      </div>

                      {/* Exam Title */}
                      <h3 className="font-black text-base sm:text-lg text-[#111111] uppercase tracking-tight leading-snug mb-3">
                        {exam.title}
                      </h3>

                      {/* Info lines without excessive icons */}
                      <div className="space-y-2 text-xs border-t-2 border-[#111111] pt-3 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600 font-medium">Đối tượng:</span>
                          <span className="font-black text-[#111111] uppercase">
                            {cfg.target_group && cfg.target_group.trim() !== '' && cfg.target_group.toLowerCase() !== 'tất cả'
                              ? cfg.target_group
                              : getExamGradeBadge(exam).grade
                              ? `Toàn Khối ${getExamGradeBadge(exam).grade}`
                              : 'Tất cả các lớp'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-neutral-600 font-medium">Số lượt đã làm:</span>
                          {maxAttempts > 0 ? (
                            <span className={`font-black text-[11px] px-1.5 py-0.5 border border-[#111111] ${
                              isLimitExceeded ? 'bg-[#E63946] text-white' : 'bg-[#FFC93C] text-[#111111]'
                            }`}>
                              {attemptCount}/{maxAttempts} lần {isLimitExceeded ? '(Hết lượt)' : `(Còn ${remainingAttempts})`}
                            </span>
                          ) : (
                            <span className="text-[#0F9D58] font-black">
                              {attemptCount > 0 ? `Đã làm ${attemptCount} lần` : 'Không giới hạn'}
                            </span>
                          )}
                        </div>

                        {examBestScore !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-600 font-medium">Điểm cao nhất của bạn:</span>
                            <span className="font-black text-sm text-[#4D6BFE] tabular-nums">
                              {examBestScore.toFixed(2)} / 10
                            </span>
                          </div>
                        )}

                        {cfg.end_time && (
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-200">
                            <span className="text-[#E63946] font-bold">Hạn nộp bài:</span>
                            <span className="text-[#E63946] font-mono font-black">{cfg.end_time.replace('T', ' ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!open) {
                            alert('Đề thi chưa tới giờ mở hoặc đã kết thúc thời gian làm bài!');
                            return;
                          }
                          if (isLimitExceeded) {
                            alert(`Bạn đã hoàn thành đủ ${maxAttempts} lượt làm bài cho phép của đề thi này. Hãy liên hệ giáo viên nếu cần mở lại bài thi!`);
                            return;
                          }
                          onSelectExam(exam);
                        }}
                        className={`w-full py-3 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-3 border-[#111111] transition-all cursor-pointer ${
                          open && !isLimitExceeded
                            ? 'bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] text-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px]'
                            : 'bg-neutral-200 text-neutral-500 cursor-not-allowed shadow-[2px_2px_0px_#111111]'
                        }`}
                      >
                        {isLimitExceeded ? (
                          <>Đã Hết Lượt Thi ({attemptCount}/{maxAttempts})</>
                        ) : open ? (
                          <>{attemptCount > 0 ? 'Làm Lại Bài Thi' : 'Vào Làm Bài Ngay'}</>
                        ) : (
                          <>Chưa Mở / Đã Đóng</>
                        )}
                      </button>

                      {/* Quick link to view Leaderboard for this test */}
                      <button
                        type="button"
                        onClick={() => handleViewLeaderboardForExam(exam.title, exam.id)}
                        className="w-full py-2 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] font-black text-[11px] uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Trophy className="w-3.5 h-3.5 text-[#FFC93C]" />
                        <span>Xem Bảng Xếp Hạng Đề Này</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-16 bg-white p-8 border-3 border-dashed border-[#111111] shadow-[6px_6px_0px_#111111]">
                <h3 className="text-lg font-black text-[#111111] mb-1 uppercase">
                  Chưa có đề thi nào cho lớp {user.group || 'Khách'}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-700 font-bold max-w-md mx-auto">
                  Hiện tại chưa có bài thi nào được mở cho lớp của bạn. Hãy liên hệ với thầy cô giáo để nhận phân bổ đề thi!
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: PERSONAL GRADEBOOK & SUBMISSIONS HISTORY ================= */}
        {activeTab === 'grades' && (
          <div className="space-y-6">
            {/* Overview Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white border-3 border-[#111111] p-4 text-center shadow-[4px_4px_0px_#111111]">
                <p className="text-[10px] sm:text-xs text-neutral-600 font-black uppercase mb-1">Điểm TB (GPA)</p>
                <p className="text-2xl sm:text-3xl font-black text-[#4D6BFE] tabular-nums">{averageScore.toFixed(2)}</p>
                <p className="text-[10px] text-neutral-500 font-bold mt-1">Thang điểm 10</p>
              </div>

              <div className="bg-white border-3 border-[#111111] p-4 text-center shadow-[4px_4px_0px_#111111]">
                <p className="text-[10px] sm:text-xs text-neutral-600 font-black uppercase mb-1">Điểm Cao Nhất</p>
                <p className="text-2xl sm:text-3xl font-black text-[#0F9D58] tabular-nums">{bestScore.toFixed(2)}</p>
                <p className="text-[10px] text-neutral-500 font-bold mt-1">Kỷ lục đạt được</p>
              </div>

              <div className="bg-white border-3 border-[#111111] p-4 text-center shadow-[4px_4px_0px_#111111]">
                <p className="text-[10px] sm:text-xs text-neutral-600 font-black uppercase mb-1">Tổng Số Bài Đã Nộp</p>
                <p className="text-2xl sm:text-3xl font-black text-[#111111] tabular-nums">{totalSubmissions}</p>
                <p className="text-[10px] text-neutral-500 font-bold mt-1">Lượt nộp bài</p>
              </div>

              <div className="bg-white border-3 border-[#111111] p-4 text-center shadow-[4px_4px_0px_#111111]">
                <p className="text-[10px] sm:text-xs text-neutral-600 font-black uppercase mb-1">Số Bài Đạt (≥ 5.0)</p>
                <p className="text-2xl sm:text-3xl font-black text-[#FFC93C] tabular-nums">{passCount}/{totalSubmissions}</p>
                <p className="text-[10px] text-neutral-500 font-bold mt-1">
                  {totalSubmissions > 0 ? `${Math.round((passCount / totalSubmissions) * 100)}% hoàn thành` : '0%'}
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-white border-3 border-[#111111] p-4 text-center shadow-[4px_4px_0px_#111111]">
                <p className="text-[10px] sm:text-xs text-neutral-600 font-black uppercase mb-1">Giám Sát Rời Tab</p>
                {(() => {
                  const violations = filteredMyHistory.filter((h) => h.cheat && String(h.cheat) !== '0 lần').length;
                  return (
                    <>
                      <p className={`text-2xl sm:text-3xl font-black tabular-nums ${violations > 0 ? 'text-[#E63946]' : 'text-[#0F9D58]'}`}>
                        {violations}
                      </p>
                      <p className="text-[10px] text-neutral-500 font-bold mt-1">
                        {violations > 0 ? 'Lượt có rời màn hình' : 'Tuyệt đối an toàn'}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Submissions Table Box */}
            <div className="bg-white border-3 border-[#111111] p-4 sm:p-6 shadow-[6px_6px_0px_#111111]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-[#111111]">
                <h3 className="text-base sm:text-lg font-black uppercase text-[#111111]">
                  Danh Sách Bài Đã Thi & Bảng Điểm
                </h3>

                {/* Search in student's history */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Tìm theo tên bài thi..."
                    className="w-full bg-[#FDF6E9] border-2 border-[#111111] px-3 py-2 text-xs font-black text-[#111111] outline-none focus:bg-white shadow-[2px_2px_0px_#111111]"
                  />
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-500 pointer-events-none" />
                </div>
              </div>

              {filteredMyHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs md:text-sm text-[#111111] border-collapse border-2 border-[#111111]">
                    <thead>
                      <tr className="bg-[#FDF6E9] text-[#111111] text-xs uppercase font-black border-b-2 border-[#111111]">
                        <th className="p-3 border-r-2 border-[#111111] text-center w-12">#</th>
                        <th className="p-3 border-r-2 border-[#111111]">Tên Đề Thi</th>
                        <th className="p-3 border-r-2 border-[#111111] text-center w-28">Điểm Số</th>
                        <th className="p-3 border-r-2 border-[#111111] text-center w-36">Thời Gian Làm</th>
                        <th className="p-3 border-r-2 border-[#111111] text-center w-32">Rời Màn Hình</th>
                        <th className="p-3 border-r-2 border-[#111111] text-center w-36">Thời Gian Nộp</th>
                        <th className="p-3 text-center w-52">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-[#111111] bg-white font-bold">
                      {filteredMyHistory.map((sub, idx) => {
                        const scoreNum = Number(sub.score) || 0;
                        const matchedExam = safeExams.find(
                          (e) => (e.id && e.id === sub.examId) || (e.title && e.title.trim().toLowerCase() === (sub.examTitle || '').trim().toLowerCase())
                        );
                        const isScorePending = checkIsExamScorePending(matchedExam, sub);
                        const durationText = sub.timing?.formattedDuration || 'Đã ghi nhận';
                        const cheatText = sub.cheat || '0 lần';
                        const hasViolation = cheatText && String(cheatText) !== '0 lần';

                        return (
                          <tr key={sub.id || idx} className="hover:bg-[#FFF9E6] transition-colors">
                            <td className="p-3 border-r-2 border-[#111111] font-black text-center tabular-nums">{idx + 1}</td>
                            <td className="p-3 border-r-2 border-[#111111]">
                              <p className="font-black text-[#111111] uppercase">{sub.examTitle}</p>
                              <span className="text-[10px] text-neutral-600 font-bold">Lớp dự thi: {sub.group || user.group}</span>
                            </td>
                            <td className="p-3 border-r-2 border-[#111111] text-center">
                              {isScorePending ? (
                                <span className="inline-block px-2.5 py-1 font-black text-xs border border-[#111111] bg-[#FFC93C] text-[#111111]">
                                  Chờ Công Bố
                                </span>
                              ) : (
                                <span className={`inline-block px-3 py-1 font-black text-xs sm:text-sm border-2 border-[#111111] shadow-[2px_2px_0px_#111111] tabular-nums ${getScoreBadgeColor(scoreNum)}`}>
                                  {scoreNum.toFixed(2)} / 10
                                </span>
                              )}
                            </td>
                            <td className="p-3 border-r-2 border-[#111111] text-center font-black">
                              <span className="text-neutral-800 text-xs tabular-nums">
                                {durationText}
                              </span>
                            </td>
                            <td className="p-3 border-r-2 border-[#111111] text-center">
                              {hasViolation ? (
                                <span className="inline-block px-2 py-0.5 text-xs font-black bg-[#FFF0F0] text-[#E63946] border border-[#E63946] tabular-nums">
                                  {cheatText}
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 text-xs font-bold bg-[#F0FDF4] text-[#0F9D58] border border-[#0F9D58]/40">
                                  0 lần (An toàn)
                                </span>
                              )}
                            </td>
                            <td className="p-3 border-r-2 border-[#111111] text-center font-mono text-xs text-neutral-700">
                              {sub.submitted_at}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center gap-1.5 justify-center">
                                {onViewResult && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenResult(sub)}
                                    className={`px-2.5 py-1.5 border-2 border-[#111111] shadow-[1px_1px_0px_#111111] text-xs font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                      isScorePending
                                        ? 'bg-[#FDF6E9] hover:bg-[#FFC93C] text-[#111111]'
                                        : 'bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111]'
                                    }`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{isScorePending ? 'Xem Bài' : 'Xem Chi Tiết'}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleViewLeaderboardForExam(sub.examTitle, sub.examId)}
                                  className="px-2.5 py-1.5 bg-white hover:bg-[#00E599] text-[#111111] border-2 border-[#111111] shadow-[1px_1px_0px_#111111] text-xs font-black uppercase flex items-center justify-center gap-1 transition-all cursor-pointer"
                                  title="Xem bảng xếp hạng của đề thi này"
                                >
                                  <Trophy className="w-3.5 h-3.5 text-[#FFC93C]" />
                                  <span>Xếp Hạng</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center bg-[#FDF6E9] border-2 border-dashed border-[#111111] p-6">
                  <h4 className="text-base font-black text-[#111111] uppercase mb-1">
                    {historySearch ? 'Không tìm thấy bài thi phù hợp' : 'Bạn chưa nộp bài thi nào'}
                  </h4>
                  <p className="text-xs text-neutral-700 font-bold max-w-sm mx-auto mb-4">
                    {historySearch ? 'Hãy thử tìm kiếm với từ khóa khác.' : 'Hãy chọn một đề thi trong danh sách để làm bài và nhận kết quả chấm điểm tức thì!'}
                  </p>
                  {!historySearch && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('exams')}
                      className="px-4 py-2 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] font-black text-xs uppercase cursor-pointer"
                    >
                      Xem Danh Sách Đề Thi
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: EXAM LEADERBOARD (DIRECT IN STUDENT VIEW!) ================= */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* Exam Selector Toolbar */}
            <div className="bg-white border-3 border-[#111111] p-4 sm:p-5 shadow-[4px_4px_0px_#111111]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider text-[#111111]">
                    Chọn Đề Thi Cần Xem Bảng Xếp Hạng:
                  </h3>
                  <p className="text-xs text-neutral-600 font-medium">
                    Xếp hạng đầy đủ tất cả học sinh, kèm điểm số và thời gian làm bài chi tiết.
                  </p>
                </div>

                {/* Exam select dropdown */}
                <div className="w-full sm:w-80">
                  <select
                    value={activeLeaderboardExam?.id || ''}
                    onChange={(e) => setSelectedLeaderboardExamId(e.target.value)}
                    className="w-full bg-[#FDF6E9] border-2 border-[#111111] p-2.5 text-xs font-black text-[#111111] uppercase outline-none shadow-[2px_2px_0px_#111111] cursor-pointer"
                  >
                    {leaderboardExamList.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({item.count} lượt nộp)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Render Leaderboard Component */}
            {activeLeaderboardExam ? (
              <ExamLeaderboard
                examTitle={activeLeaderboardExam.title}
                examDuration={activeLeaderboardExam.exam?.duration || 45}
                submissions={activeLeaderboardSubmissions}
                currentUser={user}
                onOpenAvatarPicker={() => setShowAvatarModal(true)}
              />
            ) : (
              <div className="text-center py-16 bg-white border-3 border-[#111111] p-8">
                <p className="text-sm font-black text-neutral-600">
                  Chưa có đề thi nào trong hệ thống để xem bảng xếp hạng.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="mt-12 pt-4 border-t-2 border-[#111111] text-center text-neutral-700 font-black text-xs">
        Hệ thống thi trắc nghiệm trực tuyến phân lớp © 2026
      </footer>

      {/* Avatar Picker Modal */}
      {showAvatarModal && (
        <AvatarPickerModal
          isOpen={showAvatarModal}
          currentUser={user}
          onClose={() => setShowAvatarModal(false)}
          onSaveAvatar={async (newAvatar) => {
            if (onUpdateAvatar) {
              await onUpdateAvatar(newAvatar);
            }
          }}
        />
      )}
    </div>
  );
};
