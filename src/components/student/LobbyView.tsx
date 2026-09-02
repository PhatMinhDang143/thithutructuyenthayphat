import React, { useState } from 'react';
import { AppUser, ExamItem, ExamQuestionsConfig, ExamSubmission } from '../../types';
import { 
  LogOut, FileText, Clock, Calendar, Sparkles, Filter, AlertCircle, 
  Users, CheckCircle2, Lock, ArrowRight, RotateCcw, Award, Trophy, 
  Eye, CheckSquare, Search, ChevronRight, BarChart3, BookOpen
} from 'lucide-react';

interface LobbyViewProps {
  user: AppUser;
  exams: ExamItem[];
  history?: ExamSubmission[];
  loading: boolean;
  onLogout: () => void;
  onSelectExam: (exam: ExamItem) => void;
  onViewResult?: (exam: ExamItem, submission: ExamSubmission) => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  user,
  exams,
  history = [],
  loading,
  onLogout,
  onSelectExam,
  onViewResult,
}) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'grades'>('exams');
  const [historySearch, setHistorySearch] = useState('');

  // Check schedule open window
  const isExamOpen = (cfg: ExamQuestionsConfig): boolean => {
    if (!cfg.start_time) return true;
    const now = new Date().getTime();
    const start = new Date(cfg.start_time).getTime();
    const end = cfg.end_time ? new Date(cfg.end_time).getTime() : Infinity;
    return now >= start && now <= end;
  };

  // Strictly filter exams based on student's assigned class group
  const isExamAllowed = (cfg: ExamQuestionsConfig, userGroup: string): boolean => {
    if (!cfg || !cfg.target_group || cfg.target_group.trim() === '') return true; // If unspecified, open to all
    const target = String(cfg.target_group).toLowerCase();
    if (target.includes('tất cả') || target.includes('all')) return true;

    const groupStr = String(userGroup || 'Khách').toLowerCase().trim();
    if (!groupStr || groupStr === 'khách' || groupStr === 'guest') {
      return false; // Guest only sees exams marked for 'Tất cả'
    }

    const allowedClasses = String(cfg.target_group).split(',').map((c) => c.trim().toLowerCase());
    return allowedClasses.includes(groupStr) || target.includes(groupStr);
  };

  const safeExams = Array.isArray(exams) ? exams : [];
  const visibleExams = safeExams.filter((ex) => ex && isExamAllowed(ex.questions || {}, user?.group || 'Khách'));

  // Filter student's own submissions from history
  const userIdentifier = String(user.username || user.name || '').trim().toLowerCase();
  const mySubmissions = (history || []).filter((h) => {
    const hUser = String(h.username || h.name || '').trim().toLowerCase();
    return hUser === userIdentifier;
  });

  // Calculate personal student statistics
  const totalSubmissions = mySubmissions.length;
  const averageScore = totalSubmissions > 0
    ? Number((mySubmissions.reduce((acc, cur) => acc + (Number(cur.score) || 0), 0) / totalSubmissions).toFixed(2))
    : 0;
  const bestScore = totalSubmissions > 0
    ? Math.max(...mySubmissions.map((s) => Number(s.score) || 0))
    : 0;
  const passCount = mySubmissions.filter((s) => (Number(s.score) || 0) >= 5.0).length;

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
    const matchedExam = safeExams.find(
      (e) => (e.id && e.id === sub.examId) || (e.title && e.title.trim().toLowerCase() === (sub.examTitle || '').trim().toLowerCase())
    );

    const targetExam: ExamItem = matchedExam || {
      id: sub.examId || 'exam_' + Date.now(),
      title: sub.examTitle || 'Bài kiểm tra',
      duration: 45,
      questions: {
        exam_type: 'custom',
        num_p1: 12,
        num_p2: 4,
        num_p3: 6,
      },
    };

    onViewResult(targetExam, sub);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 min-h-[calc(100dvh-70px)] flex flex-col justify-between text-[#111111]">
      <div>
        {/* Welcome & Info Card */}
        <header className="bg-white border-3 border-[#111111] p-4 sm:p-6 mb-6 shadow-[6px_6px_0px_#111111]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                  <Users className="w-3.5 h-3.5" />
                  Học Sinh: <strong>{user.name}</strong>
                </span>
                <span className="inline-flex items-center px-3 py-1 text-xs font-black bg-[#4D6BFE] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                  Lớp: <strong className="ml-1 uppercase">{user.group || 'Khách'}</strong>
                </span>
                {totalSubmissions > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-black bg-[#0F9D58] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    <Award className="w-3.5 h-3.5" />
                    Đã hoàn thành: <strong>{totalSubmissions} bài thi</strong>
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-3xl font-black uppercase text-[#111111] tracking-tight">
                Cổng Thi & Bảng Điểm Cá Nhân
              </h1>
              <p className="text-xs sm:text-sm text-neutral-700 font-bold max-w-xl leading-relaxed">
                Xem danh sách đề thi theo lớp <strong className="text-[#4D6BFE] underline">{user.group || 'Khách'}</strong> và theo dõi toàn bộ điểm số, kết quả bài làm của bạn.
              </p>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-[#E63946] hover:text-white text-[#111111] font-black text-xs transition-all border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#111111] self-start sm:self-auto shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" /> Đăng Xuất
            </button>
          </div>
        </header>

        {/* Navigation Tabs (Đề Thi vs Bảng Điểm) */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex items-center gap-2 px-5 py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-3 border-[#111111] transition-all ${
              activeTab === 'exams'
                ? 'bg-[#FFC93C] text-[#111111] shadow-[4px_4px_0px_#111111] -translate-y-0.5'
                : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] shadow-[2px_2px_0px_#111111]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Đề Thi Của Lớp</span>
            <span className="ml-1 px-2 py-0.5 text-xs bg-[#111111] text-white font-black">
              {visibleExams.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('grades')}
            className={`flex items-center gap-2 px-5 py-3 font-black text-xs sm:text-sm uppercase tracking-wider border-3 border-[#111111] transition-all ${
              activeTab === 'grades'
                ? 'bg-[#4D6BFE] text-white shadow-[4px_4px_0px_#111111] -translate-y-0.5'
                : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] shadow-[2px_2px_0px_#111111]'
            }`}
          >
            <Trophy className="w-4 h-4 text-[#FFC93C]" />
            <span>Bảng Điểm & Lịch Sử Bài Làm</span>
            <span className={`ml-1 px-2 py-0.5 text-xs font-black ${
              activeTab === 'grades' ? 'bg-white text-[#111111]' : 'bg-[#111111] text-white'
            }`}>
              {totalSubmissions}
            </span>
          </button>
        </div>

        {/* TAB 1: EXAMS LIST */}
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
                const targetClassText = cfg.target_group || 'Tất cả';

                // Calculate user's attempts on this exam
                const userAttempts = mySubmissions.filter((h) => {
                  const hExam = (h.examTitle || '').trim().toLowerCase();
                  return hExam === (exam.title || '').trim().toLowerCase();
                });

                const attemptCount = userAttempts.length;
                const maxAttempts = Number(cfg.max_attempts) || 0;
                const isLimitExceeded = maxAttempts > 0 && attemptCount >= maxAttempts;
                const remainingAttempts = maxAttempts > 0 ? Math.max(0, maxAttempts - attemptCount) : null;

                // Best score and latest attempt
                const examBestScore = attemptCount > 0 ? Math.max(...userAttempts.map((a) => Number(a.score) || 0)) : null;
                const latestAttempt = attemptCount > 0 ? userAttempts[0] : null;

                return (
                  <div
                    key={exam.id}
                    className={`bg-white border-3 border-[#111111] p-5 flex flex-col justify-between transition-all duration-150 shadow-[5px_5px_0px_#111111] hover:shadow-[7px_7px_0px_#111111] hover:-translate-x-0.5 hover:-translate-y-0.5 relative ${
                      !open || isLimitExceeded ? 'opacity-95 bg-neutral-50' : ''
                    }`}
                  >
                    <div>
                      {/* Top Tag Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="bg-[#FDF6E9] text-[#111111] px-2.5 py-1 text-[11px] font-black border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                          {cfg.exam_type === 'custom'
                            ? `Tùy biến (${cfg.num_p1 || 0}-${cfg.num_p2 || 0}-${cfg.num_p3 || 0})`
                            : `Chuẩn (${cfg.num_p1 || 12}-${cfg.num_p2 || 4}-${cfg.num_p3 || 6})`}
                        </span>

                        <span className="bg-[#4D6BFE] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] px-2.5 py-1 text-[11px] font-black truncate max-w-[130px]">
                          Lớp: {targetClassText}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-[#111111] uppercase line-clamp-2 mb-3 leading-snug">
                        {exam.title}
                      </h3>

                      {/* Prominent Score Card if user has taken this exam */}
                      {attemptCount > 0 && latestAttempt && (
                        <div className="mb-4 p-3 bg-[#FFF9E6] border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
                          <div className="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-[#111111]">
                            <span className="text-[11px] font-black uppercase text-neutral-800 flex items-center gap-1">
                              <Award className="w-3.5 h-3.5 text-[#4D6BFE]" /> Điểm cao nhất:
                            </span>
                            <span className={`text-xs font-black px-2 py-0.5 border border-[#111111] ${getScoreBadgeColor(examBestScore || 0)}`}>
                              {examBestScore} / 10
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-bold text-neutral-700">
                            <span>Lần gần nhất: <strong className="text-[#111111]">{latestAttempt.score}đ</strong> ({latestAttempt.correct} câu đúng)</span>
                            <span className="text-[10px] text-neutral-600 font-mono">{latestAttempt.submitted_at?.split(' ')[0]}</span>
                          </div>
                          
                          {/* Quick View Result Link Button */}
                          {onViewResult && (
                            <button
                              type="button"
                              onClick={() => handleOpenResult(latestAttempt)}
                              className="w-full mt-2 py-1.5 px-2 bg-white hover:bg-[#FFC93C] text-[#111111] border-2 border-[#111111] text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px]"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#4D6BFE]" /> Xem Lại Bài Làm & Điểm Số
                            </button>
                          )}
                        </div>
                      )}

                      {/* Metadata details */}
                      <div className="space-y-2 text-xs font-bold text-neutral-800 mb-5 bg-[#FDF6E9] p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-neutral-700">
                            <Clock className="w-3.5 h-3.5 text-[#4D6BFE]" /> Thời gian:
                          </span>
                          <strong className="text-[#111111]">{exam.duration} phút</strong>
                        </div>

                        {/* Attempts info */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-[#111111]">
                          <span className="flex items-center gap-1.5 text-neutral-700">
                            <RotateCcw className="w-3.5 h-3.5 text-[#4D6BFE]" /> Lượt thi:
                          </span>
                          {maxAttempts > 0 ? (
                            <span className={`font-black text-[11px] px-1.5 py-0.5 border border-[#111111] ${
                              isLimitExceeded ? 'bg-[#E63946] text-white' : 'bg-[#FFC93C] text-[#111111]'
                            }`}>
                              {attemptCount}/{maxAttempts} lần {isLimitExceeded ? '(Hết lượt)' : `(Còn ${remainingAttempts})`}
                            </span>
                          ) : (
                            <span className="text-[#0F9D58] font-black">
                              {attemptCount > 0 ? `Đã làm ${attemptCount} lần (Tự do)` : 'Không giới hạn'}
                            </span>
                          )}
                        </div>

                        {cfg.start_time && (
                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#111111]">
                            <span className="flex items-center gap-1.5 text-neutral-700">
                              <Calendar className="w-3.5 h-3.5 text-[#111111]" /> Mở lúc:
                            </span>
                            <span className="text-[#111111] font-black font-mono">{cfg.start_time.replace('T', ' ')}</span>
                          </div>
                        )}

                        {cfg.end_time && (
                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[#111111]">
                            <span className="flex items-center gap-1.5 text-[#E63946]">
                              <Clock className="w-3.5 h-3.5 text-[#E63946]" /> Hạn chót:
                            </span>
                            <span className="text-[#E63946] font-black font-mono">{cfg.end_time.replace('T', ' ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="space-y-2">
                      <button
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
                        className={`w-full py-3 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-3 border-[#111111] transition-all ${
                          open && !isLimitExceeded
                            ? 'bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] text-[#111111] shadow-[4px_4px_0px_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#111111]'
                            : 'bg-neutral-200 text-neutral-500 cursor-not-allowed shadow-[2px_2px_0px_#111111]'
                        }`}
                      >
                        {isLimitExceeded ? (
                          <>
                            <Lock className="w-4 h-4 text-[#E63946]" /> Đã Hết Lượt Thi ({attemptCount}/{maxAttempts})
                          </>
                        ) : open ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" /> {attemptCount > 0 ? 'Làm Lại Bài Thi' : 'Vào Làm Bài Ngay'}
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 text-neutral-500" /> Chưa Mở / Đã Đóng
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-16 bg-white p-8 border-3 border-dashed border-[#111111] shadow-[6px_6px_0px_#111111]">
                <AlertCircle className="w-12 h-12 text-[#4D6BFE] mx-auto mb-3" />
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

        {/* TAB 2: PERSONAL GRADEBOOK & SUBMISSIONS HISTORY */}
        {activeTab === 'grades' && (
          <div className="space-y-6">
            {/* Overview Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border-3 border-[#111111] p-4 text-center shadow-[4px_4px_0px_#111111]">
                <p className="text-[10px] sm:text-xs text-neutral-600 font-black uppercase mb-1">Điểm Trung Bình (GPA)</p>
                <p className="text-2xl sm:text-4xl font-black text-[#4D6BFE]">{averageScore}</p>
                <p className="text-[10px] text-neutral-500 font-bold mt-1">Thang điểm 10</p>
              </div>

              <div className="bg-white border-3 border-[#111111] p-4 text-center shadow-[4px_4px_0px_#111111]">
                <p className="text-[10px] sm:text-xs text-neutral-600 font-black uppercase mb-1">Điểm Cao Nhất</p>
                <p className="text-2xl sm:text-4xl font-black text-[#0F9D58]">{bestScore}</p>
                <p className="text-[10px] text-neutral-500 font-bold mt-1">Kỷ lục đạt được</p>
              </div>

              <div className="bg-white border-3 border-[#111111] p-4 text-center shadow-[4px_4px_0px_#111111]">
                <p className="text-[10px] sm:text-xs text-neutral-600 font-black uppercase mb-1">Tổng Số Bài Đã Nộp</p>
                <p className="text-2xl sm:text-4xl font-black text-[#111111]">{totalSubmissions}</p>
                <p className="text-[10px] text-neutral-500 font-bold mt-1">Lượt nộp bài</p>
              </div>

              <div className="bg-white border-3 border-[#111111] p-4 text-center shadow-[4px_4px_0px_#111111]">
                <p className="text-[10px] sm:text-xs text-neutral-600 font-black uppercase mb-1">Số Bài Đạt (≥ 5.0)</p>
                <p className="text-2xl sm:text-4xl font-black text-[#FFC93C]">{passCount}/{totalSubmissions}</p>
                <p className="text-[10px] text-neutral-500 font-bold mt-1">
                  {totalSubmissions > 0 ? `${Math.round((passCount / totalSubmissions) * 100)}% hoàn thành` : '0%'}
                </p>
              </div>
            </div>

            {/* Submissions Table Box */}
            <div className="bg-white border-3 border-[#111111] p-4 sm:p-6 shadow-[6px_6px_0px_#111111]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-[#111111]">
                <h3 className="text-base sm:text-lg font-black uppercase text-[#111111] flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#FFC93C]" /> Danh Sách Bài Đã Thi & Bảng Điểm
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
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-500" />
                </div>
              </div>

              {filteredMyHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs md:text-sm text-[#111111] border-collapse border-2 border-[#111111]">
                    <thead>
                      <tr className="bg-[#FDF6E9] text-[#111111] text-xs uppercase font-black border-b-2 border-[#111111]">
                        <th className="p-3 border-r-2 border-[#111111]">#</th>
                        <th className="p-3 border-r-2 border-[#111111]">Tên Đề Thi</th>
                        <th className="p-3 border-r-2 border-[#111111] text-center w-28">Điểm Số</th>
                        <th className="p-3 border-r-2 border-[#111111] text-center w-28">Số Câu Đúng</th>
                        <th className="p-3 border-r-2 border-[#111111] text-center w-36">Thời Gian Nộp</th>
                        <th className="p-3 text-center w-36">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-[#111111] bg-white font-bold">
                      {filteredMyHistory.map((sub, idx) => {
                        const scoreNum = Number(sub.score) || 0;
                        const matchedExam = safeExams.find(
                          (e) => (e.id && e.id === sub.examId) || (e.title && e.title.trim().toLowerCase() === (sub.examTitle || '').trim().toLowerCase())
                        );

                        return (
                          <tr key={sub.id || idx} className="hover:bg-[#FFF9E6] transition-colors">
                            <td className="p-3 border-r-2 border-[#111111] font-black text-center">{idx + 1}</td>
                            <td className="p-3 border-r-2 border-[#111111]">
                              <p className="font-black text-[#111111] uppercase">{sub.examTitle}</p>
                              <span className="text-[10px] text-neutral-600 font-bold">Lớp dự thi: {sub.group || user.group}</span>
                            </td>
                            <td className="p-3 border-r-2 border-[#111111] text-center">
                              <span className={`inline-block px-3 py-1 font-black text-xs sm:text-sm border-2 border-[#111111] shadow-[2px_2px_0px_#111111] ${getScoreBadgeColor(scoreNum)}`}>
                                {scoreNum} / 10
                              </span>
                            </td>
                            <td className="p-3 border-r-2 border-[#111111] text-center font-black">
                              <span className="text-[#0F9D58]">{sub.correct} câu đúng</span>
                            </td>
                            <td className="p-3 border-r-2 border-[#111111] text-center font-mono text-xs text-neutral-700">
                              {sub.submitted_at}
                            </td>
                            <td className="p-3 text-center">
                              {onViewResult ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenResult(sub)}
                                  className="w-full px-2.5 py-1.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] text-xs font-black uppercase flex items-center justify-center gap-1 transition-all"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Xem Chi Tiết
                                </button>
                              ) : (
                                <span className="text-xs text-neutral-500 font-black">Đã lưu</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center bg-[#FDF6E9] border-2 border-dashed border-[#111111] p-6">
                  <Award className="w-12 h-12 text-[#4D6BFE] mx-auto mb-2" />
                  <h4 className="text-base font-black text-[#111111] uppercase mb-1">
                    {historySearch ? 'Không tìm thấy bài thi phù hợp' : 'Bạn chưa nộp bài thi nào'}
                  </h4>
                  <p className="text-xs text-neutral-700 font-bold max-w-sm mx-auto mb-4">
                    {historySearch ? 'Hãy thử tìm kiếm với từ khóa khác.' : 'Hãy chọn một đề thi trong danh sách để làm bài và nhận kết quả chấm điểm tức thì!'}
                  </p>
                  {!historySearch && (
                    <button
                      onClick={() => setActiveTab('exams')}
                      className="px-4 py-2 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] font-black text-xs uppercase"
                    >
                      Xem Danh Sách Đề Thi
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-12 pt-4 border-t-2 border-[#111111] text-center text-neutral-700 font-black text-xs">
        Hệ thống thi trắc nghiệm trực tuyến phân lớp © 2026
      </footer>
    </div>
  );
};


