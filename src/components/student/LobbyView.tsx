import React from 'react';
import { AppUser, ExamItem, ExamQuestionsConfig } from '../../types';
import { LogOut, FileText, Clock, Calendar, Shield, Sparkles, Filter, AlertCircle, Users } from 'lucide-react';

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
    <div className="max-w-6xl mx-auto p-4 md:p-8 min-h-[calc(100vh-80px)] flex flex-col justify-between">
      <div>
        {/* Header Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-6 pt-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Lớp Học Sinh: <strong className="text-white">{user.group || 'Khách'}</strong>
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight text-white">
              Danh Sách Đề Thi Theo Lớp
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-0.5">
              Xin chào <strong className="text-slate-200">{user.name}</strong>, hệ thống tự động hiển thị các đề thi được giao cho lớp <span className="text-indigo-400 font-bold">{user.group || 'Khách'}</span>.
            </p>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 rounded-xl font-semibold text-xs transition-colors border border-slate-700/60 self-start md:self-auto"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </header>

        {/* Filter Notice Banner */}
        <div className="mb-6 p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-2xl flex items-start gap-3">
          <Filter className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-indigo-300 font-bold">Lọc đề thi chính xác theo lớp:</strong> Mỗi học sinh được giáo viên phân vào từng lớp riêng biệt. Bạn chỉ có thể xem và thực hiện bài làm dành cho <strong>{user.group || 'Khách'}</strong> hoặc các đề kiểm tra chung cho toàn trường.
          </div>
        </div>

        {/* Exams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-20 text-slate-500">
              <Sparkles className="w-6 h-6 animate-spin mb-2 mx-auto text-indigo-400" />
              Đang tải danh sách đề thi của lớp...
            </div>
          ) : visibleExams.length > 0 ? (
            visibleExams.map((exam) => {
              const cfg = exam.questions || {};
              const open = isExamOpen(cfg);
              const targetClassText = cfg.target_group || 'Tất cả';

              return (
                <div
                  key={exam.id}
                  className={`glass-panel p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:border-indigo-500/60 group relative overflow-hidden ${
                    !open ? 'opacity-70' : ''
                  }`}
                >
                  <div>
                    {/* Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-700">
                        {cfg.exam_type === 'custom'
                          ? `Tùy biến (${cfg.num_p1 || 0}-${cfg.num_p2 || 0}-${cfg.num_p3 || 0})`
                          : `Cấu trúc (${cfg.num_p1 || 12}-${cfg.num_p2 || 4}-${cfg.num_p3 || 6})`}
                      </span>

                      <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                        Lớp: {targetClassText}
                      </span>
                    </div>

                    <h3 className="text-base md:text-lg font-bold mb-3 text-white uppercase group-hover:text-indigo-300 transition-colors line-clamp-2">
                      {exam.title}
                    </h3>

                    <div className="space-y-1.5 text-xs text-slate-400 mb-6">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>Thời gian: <strong className="text-slate-200">{exam.duration} phút</strong></span>
                      </div>

                      {cfg.start_time && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <Calendar className="w-4 h-4 text-amber-400" />
                          <span>Mở đề: <span className="text-amber-300">{cfg.start_time.replace('T', ' ')}</span></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (open) {
                        onSelectExam(exam);
                      } else {
                        alert('Đề thi chưa tới giờ mở hoặc đã kết thúc!');
                      }
                    }}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                      open
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    {open ? 'Vào Thi Ngay' : 'Chưa Mở / Đã Đóng'}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-20 glass-panel rounded-2xl p-8 border border-dashed border-slate-800">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-300 mb-1">Không có đề thi nào dành cho lớp {user.group || 'Khách'}</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hiện chưa có đề thi nào được giáo viên giao cho lớp của bạn. Bạn có thể nhờ giáo viên gán lớp trong phần quản trị đề thi.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 text-center text-slate-600 text-xs">
        Bản quyền website thuộc về <strong className="text-indigo-400">Đặng Minh Phát</strong>
      </div>
    </div>
  );
};
