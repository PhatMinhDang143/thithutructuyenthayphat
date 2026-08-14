import React from 'react';
import { AppUser, ExamItem, ExamQuestionsConfig } from '../../types';
import { LogOut, FileText, Clock, Calendar, Sparkles, Filter, AlertCircle, Users, CheckCircle2, Lock } from 'lucide-react';

interface LobbyViewProps {
  user: AppUser;
  exams: ExamItem[];
  loading: boolean;
  onLogout: () => void;
  onSelectExam: (exam: ExamItem) => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  user,
  exams,
  loading,
  onLogout,
  onSelectExam,
}) => {
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8 min-h-[calc(100dvh-70px)] flex flex-col justify-between">
      <div>
        {/* Welcome & Info Card */}
        <header className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Học Sinh: <strong className="text-white">{user.name}</strong>
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Lớp: <strong className="text-indigo-400 ml-1">{user.group || 'Khách'}</strong>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight">
                Danh Sách Đề Thi Theo Lớp
              </h1>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                Hệ thống tự động đồng bộ và hiển thị các đề thi dành riêng cho học sinh lớp <strong className="text-indigo-300">{user.group || 'Khách'}</strong>.
              </p>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 rounded-xl font-bold text-xs transition-colors border border-slate-700/80 self-start sm:self-auto shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" /> Đăng xuất
            </button>
          </div>
        </header>

        {/* Exams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {loading ? (
            <div className="col-span-full text-center py-16 text-slate-500">
              <Sparkles className="w-7 h-7 animate-spin mb-2 mx-auto text-indigo-400" />
              <p className="text-sm font-semibold text-slate-300">Đang đồng bộ danh sách đề thi...</p>
            </div>
          ) : visibleExams.length > 0 ? (
            visibleExams.map((exam) => {
              const cfg = exam.questions || {};
              const open = isExamOpen(cfg);
              const targetClassText = cfg.target_group || 'Tất cả';

              return (
                <div
                  key={exam.id}
                  className={`bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-lg group relative overflow-hidden ${
                    !open ? 'opacity-75 bg-slate-950/60' : ''
                  }`}
                >
                  <div>
                    {/* Top Tag Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-slate-800/90 text-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-700/80">
                        {cfg.exam_type === 'custom'
                          ? `Tùy biến (${cfg.num_p1 || 0}-${cfg.num_p2 || 0}-${cfg.num_p3 || 0})`
                          : `Chuẩn (${cfg.num_p1 || 12}-${cfg.num_p2 || 4}-${cfg.num_p3 || 6})`}
                      </span>

                      <span className="bg-indigo-950/90 text-indigo-300 border border-indigo-800/60 px-2.5 py-1 rounded-lg text-[11px] font-bold truncate max-w-[120px]">
                        Lớp: {targetClassText}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white uppercase group-hover:text-indigo-300 transition-colors line-clamp-2 mb-3">
                      {exam.title}
                    </h3>

                    {/* Metadata details */}
                    <div className="space-y-2 text-xs text-slate-400 mb-5 bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" /> Thời gian làm bài:
                        </span>
                        <strong className="text-slate-200">{exam.duration} phút</strong>
                      </div>

                      {cfg.start_time && (
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                          <span className="flex items-center gap-1.5 text-amber-400/90">
                            <Calendar className="w-3.5 h-3.5 text-amber-400" /> Thời gian mở:
                          </span>
                          <span className="text-amber-300 font-mono">{cfg.start_time.replace('T', ' ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => {
                      if (open) {
                        onSelectExam(exam);
                      } else {
                        alert('Đề thi chưa tới giờ mở hoặc đã kết thúc thời gian làm bài!');
                      }
                    }}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      open
                        ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    {open ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Vào Làm Bài
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-slate-500" /> Chưa Mở / Đã Đóng
                      </>
                    )}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-16 bg-slate-900/60 rounded-2xl p-8 border border-dashed border-slate-800">
              <AlertCircle className="w-10 h-10 text-indigo-400/60 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-200 mb-1">
                Chưa có đề thi nào cho lớp {user.group || 'Khách'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Hiện tại chưa có bài thi nào được mở cho lớp của bạn. Hãy liên hệ với thầy cô giáo để nhận phân bổ đề thi!
              </p>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-8 pt-4 border-t border-slate-800/80 text-center text-slate-500 text-xs">
        Hệ thống thi trắc nghiệm trực tuyến phân lớp © 2026
      </footer>
    </div>
  );
};
