import React from 'react';
import { AppUser, ExamItem, ExamQuestionsConfig } from '../../types';
import { LogOut, FileText, Clock, Calendar, Sparkles, Filter, AlertCircle, Users, CheckCircle2, Lock, ArrowRight } from 'lucide-react';

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 min-h-[calc(100dvh-70px)] flex flex-col justify-between text-[#111111]">
      <div>
        {/* Welcome & Info Card */}
        <header className="bg-white border-3 border-[#111111] p-4 sm:p-6 mb-8 shadow-[6px_6px_0px_#111111]">
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
              </div>
              <h1 className="text-xl sm:text-3xl font-black uppercase text-[#111111] tracking-tight">
                Danh Sách Đề Thi Theo Lớp
              </h1>
              <p className="text-xs sm:text-sm text-neutral-700 font-bold max-w-xl leading-relaxed">
                Hệ thống tự động đồng bộ và hiển thị các đề thi dành riêng cho học sinh lớp <strong className="text-[#4D6BFE] underline">{user.group || 'Khách'}</strong>.
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

        {/* Exams Grid */}
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

              return (
                <div
                  key={exam.id}
                  className={`bg-white border-3 border-[#111111] p-5 flex flex-col justify-between transition-all duration-150 shadow-[5px_5px_0px_#111111] hover:shadow-[7px_7px_0px_#111111] hover:-translate-x-0.5 hover:-translate-y-0.5 relative ${
                    !open ? 'opacity-85 bg-neutral-100' : ''
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

                    <h3 className="text-base sm:text-lg font-black text-[#111111] uppercase line-clamp-2 mb-4 leading-snug">
                      {exam.title}
                    </h3>

                    {/* Metadata details */}
                    <div className="space-y-2 text-xs font-bold text-neutral-800 mb-5 bg-[#FDF6E9] p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-neutral-700">
                          <Clock className="w-3.5 h-3.5 text-[#4D6BFE]" /> Thời gian:
                        </span>
                        <strong className="text-[#111111]">{exam.duration} phút</strong>
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
                  <button
                    onClick={() => {
                      if (open) {
                        onSelectExam(exam);
                      } else {
                        alert('Đề thi chưa tới giờ mở hoặc đã kết thúc thời gian làm bài!');
                      }
                    }}
                    className={`w-full py-3.5 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-3 border-[#111111] transition-all ${
                      open
                        ? 'bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] text-[#111111] shadow-[4px_4px_0px_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#111111]'
                        : 'bg-neutral-200 text-neutral-500 cursor-not-allowed shadow-[2px_2px_0px_#111111]'
                    }`}
                  >
                    {open ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Vào Làm Bài Ngay
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-neutral-500" /> Chưa Mở / Đã Đóng
                      </>
                    )}
                  </button>
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
      </div>

      <footer className="mt-12 pt-4 border-t-2 border-[#111111] text-center text-neutral-700 font-black text-xs">
        Hệ thống thi trắc nghiệm trực tuyến phân lớp © 2026
      </footer>
    </div>
  );
};

