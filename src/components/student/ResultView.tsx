import React, { useState } from 'react';
import { AppUser, ExamItem, ExamSubmission } from '../../types';
import { 
  Trophy, CheckCircle, XCircle, ArrowLeft, FileText, CheckSquare, 
  Award, Lock, ExternalLink, AlertTriangle, Filter, Eye, Sparkles, BookOpen
} from 'lucide-react';
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
  const [filterMode, setFilterMode] = useState<'all' | 'wrong' | 'correct'>('all');
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  const cfg = exam.questions || {};
  const answerKey = resultData.correctAnswers || exam.answers || { p1: {}, p2: {}, p3: {} };
  
  const numP1 = Number(cfg.num_p1) || (exam.answers?.p1 ? Object.keys(exam.answers.p1).length : (resultData.correctAnswers?.p1 ? Object.keys(resultData.correctAnswers.p1).length : 12));
  const numP2 = Number(cfg.num_p2) || (exam.answers?.p2 ? Object.keys(exam.answers.p2).length : (resultData.correctAnswers?.p2 ? Object.keys(resultData.correctAnswers.p2).length : 4));
  const numP3 = Number(cfg.num_p3) || (exam.answers?.p3 ? Object.keys(exam.answers.p3).length : (resultData.correctAnswers?.p3 ? Object.keys(resultData.correctAnswers.p3).length : 6));

  const p1Questions = Array.from({ length: numP1 }, (_, i) => i + 1);
  const p2Questions = Array.from({ length: numP2 }, (_, i) => i + 1);
  const p3Questions = Array.from({ length: numP3 }, (_, i) => i + 1);

  const explainUrlInfo = normalizePdfUrl(cfg.explain_link);
  const finalExplainUrl = explainUrlInfo.directUrl || explainUrlInfo.previewUrl || cfg.explain_link;

  const examPdfInfo = normalizePdfUrl(cfg.file_link);
  const finalExamPdfUrl = examPdfInfo.directUrl || examPdfInfo.previewUrl || cfg.file_link;

  const normalizeShortAnswer = (val: string) => {
    return String(val || '')
      .trim()
      .toLowerCase()
      .replace(/,/g, '.')
      .replace(/\s+/g, '');
  };

  // Helper calculation for Part 1 correctness
  const isP1Correct = (qNum: number) => {
    const sAns = String(resultData.details?.p1?.[qNum] || (resultData.details?.p1 as any)?.[String(qNum)] || '').trim().toUpperCase();
    const cAns = String(answerKey.p1?.[qNum] || (answerKey.p1 as any)?.[String(qNum)] || '').trim().toUpperCase();
    return sAns !== '' && cAns !== '' && sAns === cAns;
  };

  // Helper calculation for Part 2 correctness
  const getP2Stats = (qNum: number) => {
    const sAnsObj = resultData.details?.p2?.[qNum] || (resultData.details?.p2 as any)?.[String(qNum)] || {};
    const cAnsObj = answerKey.p2?.[qNum] || (answerKey.p2 as any)?.[String(qNum)] || {};
    
    let correctCount = 0;
    (['a', 'b', 'c', 'd'] as const).forEach((sub) => {
      const s = String(sAnsObj[sub] || '').trim().toUpperCase();
      const c = String(cAnsObj[sub] || '').trim().toUpperCase();
      if (s !== '' && c !== '' && s === c) {
        correctCount++;
      }
    });

    let points = 0;
    if (correctCount === 1) points = 0.1;
    else if (correctCount === 2) points = 0.25;
    else if (correctCount === 3) points = 0.5;
    else if (correctCount === 4) points = 1.0;

    return { correctCount, points, isAllCorrect: correctCount === 4 };
  };

  // Helper calculation for Part 3 correctness
  const isP3Correct = (qNum: number) => {
    const sAns = String(resultData.details?.p3?.[qNum] || (resultData.details?.p3 as any)?.[String(qNum)] || '');
    const cAns = String(answerKey.p3?.[qNum] || (answerKey.p3 as any)?.[String(qNum)] || '');
    if (!sAns.trim() || !cAns.trim()) return false;
    return sAns.trim().toLowerCase() === cAns.trim().toLowerCase() || normalizeShortAnswer(sAns) === normalizeShortAnswer(cAns);
  };

  // Filter lists based on tab
  const filteredP1 = p1Questions.filter((qNum) => {
    if (filterMode === 'all') return true;
    const correct = isP1Correct(qNum);
    return filterMode === 'correct' ? correct : !correct;
  });

  const filteredP2 = p2Questions.filter((qNum) => {
    if (filterMode === 'all') return true;
    const stats = getP2Stats(qNum);
    return filterMode === 'correct' ? stats.isAllCorrect : !stats.isAllCorrect;
  });

  const filteredP3 = p3Questions.filter((qNum) => {
    if (filterMode === 'all') return true;
    const correct = isP3Correct(qNum);
    return filterMode === 'correct' ? correct : !correct;
  });

  const totalQuestions = p1Questions.length + p2Questions.length + p3Questions.length;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 min-h-[calc(100dvh-80px)] flex flex-col justify-between text-[#111111]">
      <div>
        {/* Header */}
        <header className="mb-6 bg-white border-3 border-[#111111] p-6 text-center shadow-[6px_6px_0px_#111111]">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0F9D58] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs font-black uppercase mb-3">
            <CheckCircle className="w-4 h-4" /> Đã Nộp Bài & Chấm Điểm Tự Động
          </div>
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-[#111111] mb-2">
            KẾT QUẢ VÀ ĐÁP ÁN CHI TIẾT
          </h1>
          <p className="text-sm sm:text-base text-[#4D6BFE] font-black uppercase tracking-wide bg-[#FDF6E9] py-1 px-4 inline-block border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
            {exam.title}
          </p>
        </header>

        {/* Score Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white p-4 text-center border-3 border-[#111111] shadow-[4px_4px_0px_#111111]">
            <p className="text-[11px] text-neutral-600 font-black uppercase mb-1">Điểm Số</p>
            <p className="text-3xl md:text-4xl font-black text-[#4D6BFE]">{resultData.score}</p>
            <span className="text-[10px] font-black uppercase text-neutral-500">Thang điểm 10</span>
          </div>
          <div className="bg-white p-4 text-center border-3 border-[#111111] shadow-[4px_4px_0px_#111111]">
            <p className="text-[11px] text-neutral-600 font-black uppercase mb-1">Số Câu Đúng</p>
            <p className="text-3xl md:text-4xl font-black text-[#0F9D58]">{resultData.correct}</p>
            <span className="text-[10px] font-black uppercase text-neutral-500">/{totalQuestions} câu hỏi</span>
          </div>
          <div className="bg-white p-4 text-center border-3 border-[#111111] shadow-[4px_4px_0px_#111111]">
            <p className="text-[11px] text-neutral-600 font-black uppercase mb-1">Thời Gian Nộp</p>
            <p className="text-sm md:text-base font-black text-[#111111] mt-2 truncate">{resultData.submitted_at || 'Vừa xong'}</p>
            <span className="text-[10px] font-black uppercase text-neutral-500">Hệ thống ghi nhận</span>
          </div>
          <div className="bg-white p-4 text-center border-3 border-[#111111] shadow-[4px_4px_0px_#111111]">
            <p className="text-[11px] text-neutral-600 font-black uppercase mb-1">Cảnh Báo</p>
            <p className={`text-3xl md:text-4xl font-black ${resultData.cheat && String(resultData.cheat) !== '0 lần' ? 'text-[#E63946]' : 'text-neutral-600'}`}>
              {resultData.cheat || '0 lần'}
            </p>
            <span className="text-[10px] font-black uppercase text-neutral-500">Chuyển tab / Rời màn hình</span>
          </div>
        </div>

        {/* Detailed Answer Key & Explanations Section */}
        <div className="bg-white border-3 border-[#111111] p-4 sm:p-7 shadow-[6px_6px_0px_#111111] mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-[#111111]">
            <div>
              <h3 className="text-lg md:text-xl font-black text-[#111111] uppercase tracking-tight flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#0F9D58]" /> Đối Chiếu Đáp Án Chuẩn & Bài Làm Của Bạn
              </h3>
              <p className="text-xs text-neutral-600 font-bold mt-1">
                Xem chi tiết câu nào bạn đã làm đúng, câu nào sai và đáp án chính xác của đề thi.
              </p>
            </div>

            {/* Quick Action Links (PDF and Explanations) */}
            <div className="flex flex-wrap items-center gap-2">
              {cfg.file_link && (
                <a
                  href={finalExamPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#4D6BFE]" /> Xem Đề Bài PDF
                </a>
              )}
              {cfg.explain_link && (
                <a
                  href={finalExplainUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Lời Giải Chi Tiết PDF
                </a>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 bg-[#FDF6E9] border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
            <span className="text-xs font-black uppercase text-neutral-700 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#111111]" /> Bộ lọc hiển thị câu hỏi:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all ${
                  filterMode === 'all'
                    ? 'bg-[#111111] text-white shadow-[2px_2px_0px_#FFC93C]'
                    : 'bg-white text-[#111111] hover:bg-neutral-100'
                }`}
              >
                Tất Cả ({totalQuestions})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('wrong')}
                className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all flex items-center gap-1 ${
                  filterMode === 'wrong'
                    ? 'bg-[#E63946] text-white shadow-[2px_2px_0px_#111111]'
                    : 'bg-white text-[#E63946] hover:bg-red-50'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" /> Chỉ Câu Sai / Chưa Làm
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('correct')}
                className={`px-3 py-1 text-xs font-black border-2 border-[#111111] transition-all flex items-center gap-1 ${
                  filterMode === 'correct'
                    ? 'bg-[#0F9D58] text-white shadow-[2px_2px_0px_#111111]'
                    : 'bg-white text-[#0F9D58] hover:bg-green-50'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Chỉ Câu Đúng
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {/* PART I: MULTIPLE CHOICE */}
            {p1Questions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3 bg-[#FDF6E9] p-2.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                  <h4 className="text-xs sm:text-sm font-black text-[#111111] uppercase tracking-wider">
                    Phần I: Câu Hỏi Trắc Nghiệm (0.25 điểm / câu)
                  </h4>
                  <span className="text-[11px] font-black text-[#4D6BFE]">
                    {filteredP1.length}/{p1Questions.length} câu
                  </span>
                </div>

                {filteredP1.length === 0 ? (
                  <p className="text-xs text-neutral-500 font-bold italic py-2">Không có câu hỏi nào theo bộ lọc đã chọn.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredP1.map((qNum) => {
                      const sAns = String(resultData.details?.p1?.[qNum] || (resultData.details?.p1 as any)?.[String(qNum)] || '').trim().toUpperCase();
                      const cAns = String(answerKey.p1?.[qNum] || (answerKey.p1 as any)?.[String(qNum)] || '').trim().toUpperCase();
                      const isCorrect = sAns !== '' && cAns !== '' && sAns === cAns;
                      const isBlank = !sAns;

                      return (
                        <div
                          key={qNum}
                          className={`p-3 border-2 border-[#111111] shadow-[3px_3px_0px_#111111] transition-all ${
                            isCorrect
                              ? 'bg-[#E8F8F0] border-[#111111]'
                              : isBlank
                              ? 'bg-neutral-100 border-[#111111]'
                              : 'bg-[#FEECEE] border-[#111111]'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-[#111111]/20">
                            <span className="font-black text-xs text-[#111111]">Câu {qNum}</span>
                            {isCorrect ? (
                              <span className="text-[10px] font-black text-white bg-[#0F9D58] px-2 py-0.5 border border-[#111111] flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> ĐÚNG (+0.25đ)
                              </span>
                            ) : isBlank ? (
                              <span className="text-[10px] font-black text-[#111111] bg-neutral-200 px-2 py-0.5 border border-[#111111]">
                                BỎ TRỐNG (0đ)
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-white bg-[#E63946] px-2 py-0.5 border border-[#111111] flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> SAI (0đ)
                              </span>
                            )}
                          </div>

                          {/* Choices Visual Buttons */}
                          <div className="grid grid-cols-4 gap-1 mb-2">
                            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                              const isStudentPick = sAns === opt;
                              const isCorrectAnswer = cAns === opt;

                              let bgClass = 'bg-white text-neutral-600 border-neutral-300';
                              if (isCorrectAnswer) {
                                bgClass = 'bg-[#0F9D58] text-white font-black border-[#111111] shadow-[1px_1px_0px_#111111] ring-2 ring-[#0F9D58]';
                              } else if (isStudentPick && !isCorrect) {
                                bgClass = 'bg-[#E63946] text-white font-black border-[#111111] line-through';
                              }

                              return (
                                <div
                                  key={opt}
                                  className={`text-center py-1 text-xs border rounded-none font-bold ${bgClass}`}
                                >
                                  {opt}
                                </div>
                              );
                            })}
                          </div>

                          <div className="text-[11px] font-bold space-y-0.5 bg-white/70 p-1.5 border border-[#111111]/30">
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-600">Bạn chọn:</span>
                              <span className={`font-black ${isCorrect ? 'text-[#0F9D58]' : isBlank ? 'text-neutral-500' : 'text-[#E63946]'}`}>
                                {sAns || 'Chưa chọn'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-600">Đáp án đúng:</span>
                              <span className="font-black text-[#0F9D58] bg-[#E8F8F0] px-1.5 py-0.5 border border-[#0F9D58]">
                                {cAns || 'Chưa cập nhật'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PART II: TRUE / FALSE */}
            {p2Questions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3 bg-[#FDF6E9] p-2.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                  <h4 className="text-xs sm:text-sm font-black text-[#111111] uppercase tracking-wider">
                    Phần II: Câu Hỏi Đúng / Sai (Tối đa 1.0 điểm / câu)
                  </h4>
                  <span className="text-[11px] font-black text-[#4D6BFE]">
                    {filteredP2.length}/{p2Questions.length} câu
                  </span>
                </div>

                {filteredP2.length === 0 ? (
                  <p className="text-xs text-neutral-500 font-bold italic py-2">Không có câu hỏi nào theo bộ lọc đã chọn.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredP2.map((qNum) => {
                      const sAnsObj = resultData.details?.p2?.[qNum] || (resultData.details?.p2 as any)?.[String(qNum)] || {};
                      const cAnsObj = answerKey.p2?.[qNum] || (answerKey.p2 as any)?.[String(qNum)] || {};
                      const stats = getP2Stats(qNum);

                      return (
                        <div
                          key={qNum}
                          className="bg-[#FDF6E9] border-2 border-[#111111] p-4 shadow-[4px_4px_0px_#111111]"
                        >
                          <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-[#111111]">
                            <span className="font-black text-xs uppercase text-[#111111]">
                              Câu {qNum} (Phần II)
                            </span>
                            <span className={`text-[11px] font-black px-2 py-0.5 border border-[#111111] ${
                              stats.isAllCorrect ? 'bg-[#0F9D58] text-white' : stats.correctCount > 0 ? 'bg-[#FFC93C] text-[#111111]' : 'bg-[#E63946] text-white'
                            }`}>
                              Đúng {stats.correctCount}/4 ý (+{stats.points}đ)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {(['a', 'b', 'c', 'd'] as const).map((sub) => {
                              const rawStudent = sAnsObj[sub];
                              const rawCorrect = cAnsObj[sub];
                              const s = String(rawStudent || '').trim().toUpperCase();
                              const c = String(rawCorrect || '').trim().toUpperCase();
                              const isSubCorrect = s !== '' && c !== '' && s === c;

                              const formatVal = (v: string) => {
                                if (v === 'D' || v === 'Đ' || v === 'TRUE' || v === 'ĐÚNG') return 'ĐÚNG';
                                if (v === 'S' || v === 'FALSE' || v === 'SAI') return 'SAI';
                                return v || '_';
                              };

                              return (
                                <div
                                  key={sub}
                                  className={`p-2.5 border-2 border-[#111111] flex flex-col justify-between gap-1.5 shadow-[2px_2px_0px_#111111] ${
                                    isSubCorrect ? 'bg-[#E8F8F0]' : 'bg-[#FEECEE]'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-black text-xs text-[#111111]">Ý ({sub})</span>
                                    {isSubCorrect ? (
                                      <span className="text-[10px] font-black text-[#0F9D58] flex items-center gap-0.5">
                                        <CheckCircle className="w-3.5 h-3.5" /> Đúng
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-black text-[#E63946] flex items-center gap-0.5">
                                        <XCircle className="w-3.5 h-3.5" /> Sai
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[11px] font-bold space-y-0.5 pt-1 border-t border-[#111111]/20">
                                    <div className="flex justify-between">
                                      <span className="text-neutral-600">Bạn chọn:</span>
                                      <span className={`font-black ${isSubCorrect ? 'text-[#0F9D58]' : 'text-[#E63946]'}`}>
                                        {formatVal(s)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-600">Đáp án chuẩn:</span>
                                      <span className="font-black text-[#0F9D58]">
                                        {formatVal(c)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PART III: SHORT ANSWER */}
            {p3Questions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3 bg-[#FDF6E9] p-2.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                  <h4 className="text-xs sm:text-sm font-black text-[#111111] uppercase tracking-wider">
                    Phần III: Trả Lời Ngắn (0.5 điểm / câu)
                  </h4>
                  <span className="text-[11px] font-black text-[#4D6BFE]">
                    {filteredP3.length}/{p3Questions.length} câu
                  </span>
                </div>

                {filteredP3.length === 0 ? (
                  <p className="text-xs text-neutral-500 font-bold italic py-2">Không có câu hỏi nào theo bộ lọc đã chọn.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredP3.map((qNum) => {
                      const sAns = String(resultData.details?.p3?.[qNum] || (resultData.details?.p3 as any)?.[String(qNum)] || '');
                      const cAns = String(answerKey.p3?.[qNum] || (answerKey.p3 as any)?.[String(qNum)] || '');
                      const isCorrect = isP3Correct(qNum);
                      const isBlank = !sAns.trim();

                      return (
                        <div
                          key={qNum}
                          className={`p-3 border-2 border-[#111111] shadow-[3px_3px_0px_#111111] ${
                            isCorrect ? 'bg-[#E8F8F0]' : isBlank ? 'bg-neutral-100' : 'bg-[#FEECEE]'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2 pb-1 border-b border-[#111111]/20">
                            <span className="font-black text-xs text-[#111111]">Câu {qNum}</span>
                            {isCorrect ? (
                              <span className="text-[10px] font-black text-white bg-[#0F9D58] px-2 py-0.5 border border-[#111111] flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> ĐÚNG (+0.5đ)
                              </span>
                            ) : isBlank ? (
                              <span className="text-[10px] font-black text-[#111111] bg-neutral-200 px-2 py-0.5 border border-[#111111]">
                                BỎ TRỐNG (0đ)
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-white bg-[#E63946] px-2 py-0.5 border border-[#111111] flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> SAI (0đ)
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-bold space-y-1">
                            <div className="p-1.5 bg-white border border-[#111111]/30">
                              <span className="text-[10px] uppercase text-neutral-500 block">Bạn ghi:</span>
                              <span className={`font-black text-sm ${isCorrect ? 'text-[#0F9D58]' : 'text-[#E63946]'}`}>
                                {sAns || '(Không điền)'}
                              </span>
                            </div>
                            <div className="p-1.5 bg-[#E8F8F0] border border-[#0F9D58]">
                              <span className="text-[10px] uppercase text-[#0F9D58] font-black block">Đáp án chuẩn:</span>
                              <span className="font-black text-sm text-[#0F9D58]">
                                {cAns || 'Chưa cập nhật'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white border-3 border-[#111111] p-5 sm:p-7 shadow-[6px_6px_0px_#111111]">
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

