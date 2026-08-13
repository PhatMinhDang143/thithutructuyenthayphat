import React from 'react';
import { AppUser, ExamItem, ExamSubmission } from '../../types';
import { Trophy, CheckCircle, XCircle, ArrowLeft, FileText, CheckSquare, Award, Lock, ExternalLink } from 'lucide-react';

interface ResultViewProps {
  user: AppUser;
  exam: ExamItem;
  resultData: ExamSubmission;
  leaderboard: ExamSubmission[];
  onBackToLobby: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  user,
  exam,
  resultData,
  leaderboard,
  onBackToLobby,
}) => {
  const cfg = exam.questions || {};
  const p1Questions = Array.from({ length: cfg.num_p1 || 0 }, (_, i) => i + 1);
  const p2Questions = Array.from({ length: cfg.num_p2 || 0 }, (_, i) => i + 1);
  const p3Questions = Array.from({ length: cfg.num_p3 || 0 }, (_, i) => i + 1);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 min-h-[calc(100vh-80px)] flex flex-col justify-between">
      <div>
        {/* Header */}
        <header className="mb-8 border-b border-slate-800 pb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold uppercase mb-2">
            <CheckCircle className="w-4 h-4" /> Đã Nộp Bài Thành Công
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold uppercase tracking-tight text-white mb-1">
            KẾT QUẢ BÀI THI KHIẾN BẠN
          </h1>
          <p className="text-sm text-indigo-400 font-bold uppercase">{exam.title}</p>
        </header>

        {/* Score Cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-6 mb-8">
          <div className="glass-panel p-4 md:p-6 rounded-2xl text-center border-t-4 border-indigo-500">
            <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase mb-1">Điểm Số</p>
            <p className="text-2xl md:text-4xl font-black text-indigo-400">{resultData.score}</p>
          </div>
          <div className="glass-panel p-4 md:p-6 rounded-2xl text-center border-t-4 border-emerald-500">
            <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase mb-1">Số Câu Đúng</p>
            <p className="text-2xl md:text-4xl font-black text-emerald-400">{resultData.correct}</p>
          </div>
          <div className="glass-panel p-4 md:p-6 rounded-2xl text-center border-t-4 border-rose-500">
            <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase mb-1">Cảnh Báo Vi Phạm</p>
            <p className="text-2xl md:text-4xl font-black text-rose-400">{resultData.cheat}</p>
          </div>
        </div>

        {/* Answer Explanations (Full student vs Guest view) */}
        {user.role === 'student' ? (
          <div className="mt-8 border-t border-slate-800 pt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-lg md:text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-400" /> Chi Tiết Đáp Án & Lời Giải
              </h3>

              {cfg.explain_link && (
                <a
                  href={cfg.explain_link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start"
                >
                  <ExternalLink className="w-4 h-4" /> Xem File Lời Giải Chi Tiết Của Giáo Viên
                </a>
              )}
            </div>

            <div className="space-y-6">
              {/* Part I Details */}
              {p1Questions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">
                    Phần I: Trắc Nghiệm
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {p1Questions.map((qNum) => {
                      const sAns = resultData.details?.p1?.[qNum] || '_';
                      const cAns = exam.answers?.p1?.[qNum] || '_';
                      const isCorrect = String(sAns).toUpperCase() === String(cAns).toUpperCase();

                      return (
                        <div
                          key={qNum}
                          className={`p-3 rounded-xl border ${
                            isCorrect
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}
                        >
                          <div className="font-bold text-xs mb-1">Câu {qNum}</div>
                          <div className="text-[11px] space-y-0.5">
                            <div>Chọn: <span className="font-bold">{sAns}</span></div>
                            <div>Đáp án đúng: <span className="font-bold">{cAns}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Part II Details */}
              {p2Questions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">
                    Phần II: Đúng / Sai
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {p2Questions.map((qNum) => (
                      <div key={qNum} className="bg-slate-800/50 border border-slate-700/60 p-4 rounded-xl">
                        <div className="font-bold text-xs mb-2 text-white">Câu {qNum}</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(['a', 'b', 'c', 'd'] as const).map((sub) => {
                            const sAns = resultData.details?.p2?.[qNum]?.[sub] || '_';
                            const cAns = exam.answers?.p2?.[qNum]?.[sub] || '_';
                            const isCorrect = String(sAns).toUpperCase() === String(cAns).toUpperCase();

                            return (
                              <div
                                key={sub}
                                className={`p-2 rounded-lg flex justify-between items-center ${
                                  isCorrect ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                }`}
                              >
                                <span>Ý {sub}: <strong className="mx-0.5">{sAns}</strong> (Đúng: {cAns})</span>
                                {isCorrect ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Part III Details */}
              {p3Questions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">
                    Phần III: Trả Lời Ngắn
                  </h4>
                  <div className="space-y-2">
                    {p3Questions.map((qNum) => {
                      const sAns = resultData.details?.p3?.[qNum] || '';
                      const cAns = exam.answers?.p3?.[qNum] || '';
                      const isCorrect = String(sAns).trim().toLowerCase() === String(cAns).trim().toLowerCase();

                      return (
                        <div
                          key={qNum}
                          className={`p-3 rounded-xl border flex justify-between items-center ${
                            isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}
                        >
                          <span className="font-bold text-xs">Câu {qNum}</span>
                          <div className="text-xs space-x-4">
                            <span>Ghi: <strong className="font-bold">{sAns || 'Bỏ trống'}</strong></span>
                            <span>Đáp án chuẩn: <strong className="font-bold">{cAns}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-8 border-t border-slate-800 pt-8 text-center text-slate-500 text-xs">
            <Lock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p>Bạn đang làm dưới tư cách Khách. Chi tiết đáp án chỉ hiển thị cho Học Sinh chính thức.</p>
          </div>
        )}

        {/* Leaderboard */}
        <div className="mt-10 glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-bold mb-4 uppercase text-indigo-400 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Bảng Xếp Hạng Đề Thi ({exam.title})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Thứ Hạng</th>
                  <th className="py-3 px-4">Thí Sinh</th>
                  <th className="py-3 px-4">Lớp</th>
                  <th className="py-3 px-4 text-right">Điểm Số</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leaderboard.map((item, idx) => {
                  const isCurrent = item.username === user.username && item.name === user.name;
                  return (
                    <tr key={idx} className={isCurrent ? 'bg-indigo-600/20 text-indigo-300 font-bold' : 'hover:bg-slate-800/40'}>
                      <td className="py-3 px-4">
                        {idx === 0 && <span className="text-amber-400 font-bold">🥇 Top 1</span>}
                        {idx === 1 && <span className="text-slate-300 font-bold">🥈 Top 2</span>}
                        {idx === 2 && <span className="text-amber-600 font-bold">🥉 Top 3</span>}
                        {idx > 2 && `${idx + 1}`}
                      </td>
                      <td className="py-3 px-4 font-semibold">{item.name} {isCurrent && '(Bạn)'}</td>
                      <td className="py-3 px-4 text-slate-400">{item.group || 'Khách'}</td>
                      <td className="py-3 px-4 text-right font-black text-white">{item.score}</td>
                    </tr>
                  );
                })}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">Chưa có bảng xếp hạng cho đề thi này.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button
        onClick={onBackToLobby}
        className="w-full mt-8 bg-slate-800 hover:bg-slate-700 text-slate-200 py-4 rounded-xl font-bold uppercase transition-colors tracking-wide flex items-center justify-center gap-2 border border-slate-700/60"
      >
        <ArrowLeft className="w-4 h-4" /> Quay Về Phòng Chờ Đề Thi
      </button>
    </div>
  );
};
