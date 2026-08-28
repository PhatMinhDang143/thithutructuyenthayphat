import React from 'react';
import { AppUser, ExamItem, ExamSubmission } from '../../types';
import { Trophy, CheckCircle, XCircle, ArrowLeft, FileText, CheckSquare, Award, Lock, ExternalLink, AlertTriangle } from 'lucide-react';
import { normalizePdfUrl } from '../../utils/pdfUtils';

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

  const explainUrlInfo = normalizePdfUrl(cfg.explain_link);
  const finalExplainUrl = explainUrlInfo.directUrl || explainUrlInfo.previewUrl || cfg.explain_link;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 min-h-[calc(100dvh-80px)] flex flex-col justify-between text-[#111111]">
      <div>
        {/* Header */}
        <header className="mb-8 bg-white border-3 border-[#111111] p-6 text-center shadow-[6px_6px_0px_#111111]">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0F9D58] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs font-black uppercase mb-3">
            <CheckCircle className="w-4 h-4" /> Đã Nộp Bài Thành Công
          </div>
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-[#111111] mb-2">
            KẾT QUẢ BÀI THI CỦA BẠN
          </h1>
          <p className="text-sm sm:text-base text-[#4D6BFE] font-black uppercase tracking-wide bg-[#FDF6E9] py-1 px-4 inline-block border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
            {exam.title}
          </p>
        </header>

        {/* Score Cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-6 mb-8">
          <div className="bg-white p-4 md:p-6 text-center border-3 border-[#111111] shadow-[5px_5px_0px_#111111]">
            <p className="text-[10px] md:text-xs text-neutral-600 font-black uppercase mb-1">Điểm Số</p>
            <p className="text-3xl md:text-5xl font-black text-[#4D6BFE]">{resultData.score}</p>
          </div>
          <div className="bg-white p-4 md:p-6 text-center border-3 border-[#111111] shadow-[5px_5px_0px_#111111]">
            <p className="text-[10px] md:text-xs text-neutral-600 font-black uppercase mb-1">Số Câu Đúng</p>
            <p className="text-3xl md:text-5xl font-black text-[#0F9D58]">{resultData.correct}</p>
          </div>
          <div className="bg-white p-4 md:p-6 text-center border-3 border-[#111111] shadow-[5px_5px_0px_#111111]">
            <p className="text-[10px] md:text-xs text-neutral-600 font-black uppercase mb-1">Cảnh Báo</p>
            <p className={`text-3xl md:text-5xl font-black ${resultData.cheat > 0 ? 'text-[#E63946]' : 'text-neutral-500'}`}>
              {resultData.cheat}
            </p>
          </div>
        </div>

        {/* Answer Explanations (Full student vs Guest view) */}
        {user.role === 'student' ? (
          <div className="mt-8 bg-white border-3 border-[#111111] p-5 sm:p-7 shadow-[6px_6px_0px_#111111]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-[#111111]">
              <h3 className="text-lg md:text-xl font-black text-[#111111] uppercase tracking-tight flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#4D6BFE]" /> Chi Tiết Đáp Án & Lời Giải
              </h3>

              {cfg.explain_link && (
                <a
                  href={finalExplainUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] text-xs font-black transition-all flex items-center gap-2 self-start sm:self-auto"
                >
                  <ExternalLink className="w-4 h-4" /> Xem File Lời Giải PDF
                </a>
              )}
            </div>

            <div className="space-y-6">
              {/* Part I Details */}
              {p1Questions.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-[#111111] uppercase tracking-wider mb-3 bg-[#FDF6E9] p-2 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    Phần I: Trắc Nghiệm ({p1Questions.length} câu)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {p1Questions.map((qNum) => {
                      const sAns = resultData.details?.p1?.[qNum] || '_';
                      const cAns = exam.answers?.p1?.[qNum] || '_';
                      const isCorrect = String(sAns).toUpperCase() === String(cAns).toUpperCase();

                      return (
                        <div
                          key={qNum}
                          className={`p-3 border-2 border-[#111111] shadow-[3px_3px_0px_#111111] ${
                            isCorrect
                              ? 'bg-[#E8F8F0] text-[#111111]'
                              : 'bg-[#FEECEE] text-[#111111]'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-black text-xs">Câu {qNum}</span>
                            {isCorrect ? (
                              <span className="text-[10px] font-black text-white bg-[#0F9D58] px-1.5 py-0.5 border border-[#111111]">Đúng</span>
                            ) : (
                              <span className="text-[10px] font-black text-white bg-[#E63946] px-1.5 py-0.5 border border-[#111111]">Sai</span>
                            )}
                          </div>
                          <div className="text-xs font-bold space-y-0.5">
                            <div>Chọn: <span className="font-black text-[#111111]">{sAns}</span></div>
                            <div>Đúng: <span className="font-black text-[#0F9D58]">{cAns}</span></div>
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
                  <h4 className="text-xs font-black text-[#111111] uppercase tracking-wider mb-3 bg-[#FDF6E9] p-2 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    Phần II: Đúng / Sai ({p2Questions.length} câu)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {p2Questions.map((qNum) => (
                      <div key={qNum} className="bg-[#FDF6E9] border-2 border-[#111111] p-3.5 shadow-[3px_3px_0px_#111111]">
                        <div className="font-black text-xs mb-2 text-[#111111] pb-1 border-b border-[#111111]">
                          Câu {qNum}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(['a', 'b', 'c', 'd'] as const).map((sub) => {
                            const sAns = resultData.details?.p2?.[qNum]?.[sub] || '_';
                            const cAns = exam.answers?.p2?.[qNum]?.[sub] || '_';
                            const isCorrect = String(sAns).toUpperCase() === String(cAns).toUpperCase();

                            return (
                              <div
                                key={sub}
                                className={`p-2 border-2 border-[#111111] flex justify-between items-center ${
                                  isCorrect ? 'bg-[#E8F8F0]' : 'bg-[#FEECEE]'
                                }`}
                              >
                                <span className="font-bold">Ý {sub}: <strong>{sAns}</strong> <span className="text-[10px] text-neutral-600">({cAns})</span></span>
                                {isCorrect ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-[#0F9D58]" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-[#E63946]" />
                                )}
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
                  <h4 className="text-xs font-black text-[#111111] uppercase tracking-wider mb-3 bg-[#FDF6E9] p-2 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    Phần III: Trả Lời Ngắn ({p3Questions.length} câu)
                  </h4>
                  <div className="space-y-2">
                    {p3Questions.map((qNum) => {
                      const sAns = resultData.details?.p3?.[qNum] || '';
                      const cAns = exam.answers?.p3?.[qNum] || '';
                      const isCorrect = String(sAns).trim().toLowerCase() === String(cAns).trim().toLowerCase();

                      return (
                        <div
                          key={qNum}
                          className={`p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] flex justify-between items-center ${
                            isCorrect ? 'bg-[#E8F8F0]' : 'bg-[#FEECEE]'
                          }`}
                        >
                          <span className="font-black text-xs">Câu {qNum}</span>
                          <div className="text-xs space-x-3 font-bold">
                            <span>Ghi: <strong className="text-[#111111]">{sAns || 'Bỏ trống'}</strong></span>
                            <span>Chuẩn: <strong className="text-[#0F9D58]">{cAns}</strong></span>
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
          <div className="mt-8 bg-white border-3 border-[#111111] p-8 text-center text-neutral-700 text-xs font-black shadow-[6px_6px_0px_#111111]">
            <Lock className="w-8 h-8 mx-auto mb-2 text-[#111111]" />
            <p>Bạn đang làm dưới tư cách Khách. Chi tiết đáp án chỉ hiển thị cho Học Sinh chính thức.</p>
          </div>
        )}

        {/* Leaderboard */}
        <div className="mt-8 bg-white border-3 border-[#111111] p-5 sm:p-7 shadow-[6px_6px_0px_#111111]">
          <h3 className="text-base sm:text-lg font-black mb-4 uppercase text-[#111111] flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#FFC93C]" /> Bảng Xếp Hạng Đề Thi ({exam.title})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm text-[#111111]">
              <thead>
                <tr className="border-b-2 border-[#111111] bg-[#FDF6E9] text-[#111111] text-xs uppercase font-black">
                  <th className="py-3 px-4 border-r border-[#111111]">Thứ Hạng</th>
                  <th className="py-3 px-4 border-r border-[#111111]">Thí Sinh</th>
                  <th className="py-3 px-4 border-r border-[#111111]">Lớp</th>
                  <th className="py-3 px-4 text-right font-black">Điểm Số</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-neutral-200">
                {leaderboard.map((item, idx) => {
                  const isCurrent = item.username === user.username && item.name === user.name;
                  return (
                    <tr key={idx} className={isCurrent ? 'bg-[#FFF2B2] font-black' : 'hover:bg-[#FDF6E9]'}>
                      <td className="py-3 px-4 border-r border-neutral-200 font-black">
                        {idx === 0 && <span className="text-[#111111] bg-[#FFC93C] px-2 py-0.5 border border-[#111111]">🥇 Top 1</span>}
                        {idx === 1 && <span className="text-[#111111] bg-neutral-200 px-2 py-0.5 border border-[#111111]">🥈 Top 2</span>}
                        {idx === 2 && <span className="text-[#111111] bg-amber-200 px-2 py-0.5 border border-[#111111]">🥉 Top 3</span>}
                        {idx > 2 && `${idx + 1}`}
                      </td>
                      <td className="py-3 px-4 border-r border-neutral-200 font-bold">{item.name} {isCurrent && '(Bạn)'}</td>
                      <td className="py-3 px-4 border-r border-neutral-200 text-neutral-700 font-bold">{item.group || 'Khách'}</td>
                      <td className="py-3 px-4 text-right font-black text-sm">{item.score}</td>
                    </tr>
                  );
                })}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-500 font-bold">Chưa có bảng xếp hạng cho đề thi này.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button
        onClick={onBackToLobby}
        className="w-full mt-8 bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] text-[#111111] py-4 border-3 border-[#111111] shadow-[5px_5px_0px_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#111111] font-black uppercase transition-all tracking-wider flex items-center justify-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" /> Quay Về Phòng Chờ Đề Thi
      </button>
    </div>
  );
};

