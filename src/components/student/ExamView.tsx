import React, { useState, useEffect, useRef } from 'react';
import { AppUser, ExamItem, StudentAnswers } from '../../types';
import { 
  Clock, Minimize2, Maximize2, User, Flag, Check, Edit3, X, 
  AlertTriangle, Send, FileText, ExternalLink, RefreshCw, AlertCircle, Eye
} from 'lucide-react';
import { normalizePdfUrl } from '../../utils/pdfUtils';

interface ExamViewProps {
  user: AppUser;
  exam: ExamItem;
  onExamSubmit: (studentAnswers: StudentAnswers, cheatCount: number, exam: ExamItem) => void;
}

export const ExamView: React.FC<ExamViewProps> = ({ user, exam, onExamSubmit }) => {
  const cfg = exam.questions || {};
  const numP1 = cfg.num_p1 || 0;
  const numP2 = cfg.num_p2 || 0;
  const numP3 = cfg.num_p3 || 0;

  const p1Questions = Array.from({ length: numP1 }, (_, i) => i + 1);
  const p2Questions = Array.from({ length: numP2 }, (_, i) => i + 1);
  const p3Questions = Array.from({ length: numP3 }, (_, i) => i + 1);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(window.innerWidth > 768);
  const [iframeKey, setIframeKey] = useState(0);

  // Draggable Floating Button on Mobile
  const [btnPos, setBtnPos] = useState({ x: window.innerWidth - 170, y: window.innerHeight - 80 });
  const btnDrag = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0, hasMoved: false });

  useEffect(() => {
    const updatePos = () => setBtnPos({ x: window.innerWidth - 170, y: window.innerHeight - 80 });
    window.addEventListener('resize', updatePos);
    return () => window.removeEventListener('resize', updatePos);
  }, []);

  const onBtnDown = (e: React.PointerEvent<HTMLDivElement>) => {
    btnDrag.current.isDragging = true;
    btnDrag.current.hasMoved = false;
    btnDrag.current.startX = e.clientX;
    btnDrag.current.startY = e.clientY;
    btnDrag.current.initialX = btnPos.x;
    btnDrag.current.initialY = btnPos.y;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onBtnMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!btnDrag.current.isDragging) return;
    const dx = e.clientX - btnDrag.current.startX;
    const dy = e.clientY - btnDrag.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) btnDrag.current.hasMoved = true;
    let newX = Math.max(0, Math.min(btnDrag.current.initialX + dx, window.innerWidth - 160));
    let newY = Math.max(60, Math.min(btnDrag.current.initialY + dy, window.innerHeight - 60));
    setBtnPos({ x: newX, y: newY });
  };

  const onBtnUp = (e: React.PointerEvent<HTMLDivElement>) => {
    btnDrag.current.isDragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (!btnDrag.current.hasMoved) setIsMobileSheetOpen(true);
  };

  // Exam Draft State & Auto Save
  const storageKey = `exam_draft_${exam.id}_${user.username}`;
  const [phase, setPhase] = useState<1 | 2>(2);
  const [timeLeft, setTimeLeft] = useState(exam.duration * 60);
  const [cheatCount, setCheatCount] = useState(0);

  const [ansPart1, setAnsPart1] = useState<{ [q: number]: string }>({});
  const [ansPart2, setAnsPart2] = useState<{ [q: number]: { a?: 'Đ' | 'S'; b?: 'Đ' | 'S'; c?: 'Đ' | 'S'; d?: 'Đ' | 'S' } }>({});
  const [ansPart3, setAnsPart3] = useState<{ [q: number]: string }>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<{ [key: string]: boolean }>({});

  const timerRef = useRef<any>(null);

  // Restore Draft
  useEffect(() => {
    const draft = localStorage.getItem(storageKey);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (window.confirm('Phát hiện bản nháp bài làm trước đó. Bạn có muốn khôi phục không?')) {
          if (parsed.ansPart1) setAnsPart1(parsed.ansPart1);
          if (parsed.ansPart2) setAnsPart2(parsed.ansPart2);
          if (parsed.ansPart3) setAnsPart3(parsed.ansPart3);
          if (parsed.flaggedQuestions) setFlaggedQuestions(parsed.flaggedQuestions);
          if (parsed.cheatCount) setCheatCount(parsed.cheatCount);
          if (parsed.timeLeft > 0) setTimeLeft(parsed.timeLeft);
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch (e) {}
    }
  }, [exam.id, user.username]);

  // Auto Save Draft
  useEffect(() => {
    const draftData = { ansPart1, ansPart2, ansPart3, flaggedQuestions, phase, timeLeft, cheatCount };
    localStorage.setItem(storageKey, JSON.stringify(draftData));
  }, [ansPart1, ansPart2, ansPart3, flaggedQuestions, phase, timeLeft, cheatCount]);

  // Robust PDF URL & Type Processing
  const pdfInfo = normalizePdfUrl(cfg.file_link);

  // Open PDF in a separate tab safely (supporting base64 and Google Drive)
  const handleOpenPdfInNewTab = () => {
    if (!cfg.file_link) return;

    if (pdfInfo.isBase64) {
      try {
        const base64Data = cfg.file_link.split(',')[1];
        const contentType = cfg.file_link.split(';')[0].split(':')[1] || 'application/pdf';
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        const blob = new Blob(byteArrays, { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        // Fallback for direct data url opening
        const win = window.open();
        if (win) {
          win.document.write(`<iframe src="${cfg.file_link}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        }
      }
    } else {
      const urlToOpen = pdfInfo.directUrl || pdfInfo.previewUrl || cfg.file_link;
      window.open(urlToOpen, '_blank', 'noopener,noreferrer');
    }
  };

  // Anti-cheat Visibility Tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setCheatCount((prev) => prev + 1);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleSubmit = (isAuto = false) => {
    if (!isAuto && !window.confirm('Bạn có chắc chắn muốn nộp bài làm ngay?')) return;
    clearInterval(timerRef.current);
    localStorage.removeItem(storageKey);
    const studentAnswers: StudentAnswers = { p1: ansPart1, p2: ansPart2, p3: ansPart3 };
    onExamSubmit(studentAnswers, cheatCount, exam);
  };

  // Calculate answered count for progress badge
  const answeredP1Count = Object.values(ansPart1).filter(Boolean).length;
  const answeredP2Count = Object.keys(ansPart2).filter(k => {
    const sub = ansPart2[Number(k)];
    return sub && (sub.a || sub.b || sub.c || sub.d);
  }).length;
  const answeredP3Count = Object.values(ansPart3).filter((v) => Boolean(v && String(v).trim())).length;
  const totalAnswered = answeredP1Count + answeredP2Count + answeredP3Count;
  const totalQuestions = numP1 + numP2 + numP3;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = String(timeLeft % 60).padStart(2, '0');
  const isDanger = timeLeft < 300;

  return (
    <div className={`h-[100dvh] w-full flex flex-col bg-[#0b1121] overflow-hidden ${isFocusMode ? 'focus-active' : ''}`}>
      {/* Top Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 md:px-6 shrink-0 z-40 shadow-md">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`p-2 rounded-lg transition-colors ${isFocusMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title={isFocusMode ? "Thu nhỏ đề thi" : "Phóng to đề thi toàn màn hình"}
          >
            {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <span className="font-bold text-xs md:text-sm text-indigo-400 uppercase truncate max-w-[150px] sm:max-w-xs md:max-w-md">
            {exam.title}
          </span>
        </div>

        {/* Timer */}
        <div className="flex flex-col items-center justify-center bg-slate-800/90 border border-slate-700/60 px-3 md:px-4 py-1 rounded-xl min-w-[105px] md:min-w-[120px]">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Thời Gian</p>
          <p className={`text-sm md:text-base font-black font-mono tracking-tight flex items-center gap-1 ${isDanger ? 'timer-danger' : 'text-indigo-400'}`}>
            <Clock className="w-3.5 h-3.5 animate-pulse" /> {minutes}:{seconds}
          </p>
        </div>

        {/* Student Info & Mobile Sheet Toggle */}
        <div className="flex items-center gap-2">
          {/* Quick toggle button on mobile header */}
          <button
            onClick={() => setIsMobileSheetOpen(!isMobileSheetOpen)}
            className="md:hidden px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{totalAnswered}/{totalQuestions}</span>
          </button>

          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-200">{user.name}</p>
            <p className="text-[10px] text-indigo-400 uppercase font-semibold">Lớp: {user.group}</p>
          </div>
          <div className="bg-indigo-600 p-2 rounded-xl shadow-md hidden sm:block">
            <User className="w-4 h-4 text-white" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* PDF Viewer Section */}
        <div
          className={`w-full relative z-10 bg-[#1e1e1e] flex flex-col p-1 md:p-3 pdf-container border-b md:border-b-0 md:border-r border-slate-800 shrink-0 transition-all duration-300 ${
            isFocusMode ? 'h-full md:w-full' : 'h-full md:w-3/5 lg:w-2/3'
          }`}
        >
          {/* Quick PDF Controls & Mobile Fallback Bar */}
          {pdfInfo.previewUrl && (
            <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl mb-2 text-xs shrink-0 gap-2 shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-300 truncate">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="hidden sm:inline font-semibold text-[11px] text-slate-400 truncate">
                  {pdfInfo.isBase64 ? 'File PDF đính kèm trong bài' : 'Tài liệu đề thi'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIframeKey((prev) => prev + 1)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  title="Tải lại khung xem đề"
                >
                  <RefreshCw className="w-3 h-3" /> Tải lại
                </button>

                <button
                  type="button"
                  onClick={handleOpenPdfInNewTab}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm shadow-indigo-600/30 transition-all"
                  title="Mở đề thi trong tab mới để tránh bị văng hoặc khi dùng điện thoại"
                >
                  <ExternalLink className="w-3 h-3" /> Mở Tab Mới
                </button>
              </div>
            </div>
          )}

          {/* PDF Frame */}
          <div className="flex-1 w-full h-full relative overflow-hidden rounded-xl bg-slate-950">
            {pdfInfo.previewUrl ? (
              <iframe
                key={iframeKey}
                src={pdfInfo.previewUrl}
                title="Exam PDF Viewer"
                allow="autoplay"
                className="w-full h-full md:rounded-xl shadow-2xl bg-white border-0"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center">
                <FileText className="w-16 h-16 mb-3 opacity-30 text-indigo-400" />
                <p className="text-base font-bold text-slate-300">Đề thi chưa đính kèm file PDF</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Giáo viên chưa tải file hoặc link đề thi. Bạn hãy liên hệ giáo viên để cập nhật lại đề.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Backdrop Overlay */}
        {isMobileSheetOpen && (
          <div
            onClick={() => setIsMobileSheetOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* Floating Draggable Button for Mobile */}
        {!isMobileSheetOpen && (
          <div
            className="md:hidden fixed z-40 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-4 py-2.5 rounded-full shadow-[0_6px_25px_rgba(79,70,229,0.6)] font-bold flex items-center gap-2 cursor-move select-none border border-indigo-400/40"
            style={{ left: `${btnPos.x}px`, top: `${btnPos.y}px`, touchAction: 'none' }}
            onPointerDown={onBtnDown}
            onPointerMove={onBtnMove}
            onPointerUp={onBtnUp}
            onPointerCancel={onBtnUp}
          >
            <Edit3 className="w-4 h-4" />
            <span className="text-xs">Phiếu Bài</span>
            <span className="bg-indigo-900/80 px-2 py-0.5 rounded-full text-[10px] text-indigo-200 border border-indigo-400/30">
              {totalAnswered}/{totalQuestions}
            </span>
          </div>
        )}

        {/* Answer Sheet Panel */}
        <aside
          className={`sidebar-panel w-full md:w-2/5 lg:w-1/3 bg-slate-900 flex flex-col transition-all duration-300 ${
            isMobileSheetOpen ? 'sheet-open' : ''
          } ${isFocusMode ? 'hidden' : 'flex'}`}
        >
          {/* Mobile Sheet Drag Handle */}
          <div 
            onClick={() => setIsMobileSheetOpen(false)} 
            className="md:hidden pt-2.5 pb-1 flex justify-center cursor-pointer bg-slate-900/90 rounded-t-3xl"
          >
            <div className="w-12 h-1.5 bg-slate-600/80 rounded-full"></div>
          </div>

          <div className="p-3 md:p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/80">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">Phiếu Đáp Án</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/80 rounded-lg">
                Đã làm: {totalAnswered}/{totalQuestions}
              </span>
            </div>
            <button
              onClick={() => setIsMobileSheetOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
              title="Đóng phiếu bài làm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scroll space-y-6 pb-24 md:pb-6">
            {/* Part I: Multiple Choice */}
            {p1Questions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                  Phần I: Trắc Nghiệm ({p1Questions.length} câu)
                </h4>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 xl:grid-cols-5 gap-2">
                  {p1Questions.map((qNum) => {
                    const isFlagged = flaggedQuestions[`p1_${qNum}`];
                    return (
                      <div key={qNum} className="relative flex flex-col items-center p-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <button
                          type="button"
                          onClick={() => setFlaggedQuestions({ ...flaggedQuestions, [`p1_${qNum}`]: !isFlagged })}
                          className={`absolute top-1 right-1 ${isFlagged ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                        >
                          <Flag className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-[10px] font-bold text-slate-400 mb-1.5">Câu {qNum}</span>
                        <div className="flex gap-1 w-full flex-wrap justify-center">
                          {['A', 'B', 'C', 'D'].map((ans) => (
                            <button
                              key={ans}
                              type="button"
                              onClick={() => setAnsPart1({ ...ansPart1, [qNum]: ans })}
                              className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold transition-all ${
                                ansPart1[qNum] === ans
                                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              {ans}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Part II: True / False */}
            {p2Questions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                  Phần II: Đúng / Sai ({p2Questions.length} câu)
                </h4>
                <div className="space-y-3">
                  {p2Questions.map((qNum) => {
                    const isFlagged = flaggedQuestions[`p2_${qNum}`];
                    return (
                      <div key={qNum} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 relative">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-slate-300">Câu {qNum}</span>
                          <button
                            type="button"
                            onClick={() => setFlaggedQuestions({ ...flaggedQuestions, [`p2_${qNum}`]: !isFlagged })}
                            className={`${isFlagged ? 'text-amber-400' : 'text-slate-600'}`}
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(['a', 'b', 'c', 'd'] as const).map((sub) => (
                            <div key={sub} className="flex items-center justify-between bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-700/40">
                              <span className="text-[11px] font-bold uppercase text-slate-400">{sub}.</span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setAnsPart2({ ...ansPart2, [qNum]: { ...ansPart2[qNum], [sub]: 'Đ' } })}
                                  className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                    ansPart2[qNum]?.[sub] === 'Đ' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  Đ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAnsPart2({ ...ansPart2, [qNum]: { ...ansPart2[qNum], [sub]: 'S' } })}
                                  className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                    ansPart2[qNum]?.[sub] === 'S' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  S
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Part III: Short Answer */}
            {p3Questions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                  Phần III: Trả Lời Ngắn ({p3Questions.length} câu)
                </h4>
                <div className="space-y-2">
                  {p3Questions.map((qNum) => {
                    const isFlagged = flaggedQuestions[`p3_${qNum}`];
                    return (
                      <div key={qNum} className="flex items-center gap-2 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 relative">
                        <button
                          type="button"
                          onClick={() => setFlaggedQuestions({ ...flaggedQuestions, [`p3_${qNum}`]: !isFlagged })}
                          className={`absolute top-2 right-2 ${isFlagged ? 'text-amber-400' : 'text-slate-600'}`}
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-400 w-12 text-center">Câu {qNum}</span>
                        <input
                          type="text"
                          value={ansPart3[qNum] || ''}
                          onChange={(e) => setAnsPart3({ ...ansPart3, [qNum]: e.target.value })}
                          className="flex-1 bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none focus:border-emerald-500"
                          placeholder="Nhập đáp số..."
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="p-4 bg-slate-900/90 border-t border-slate-800 shrink-0">
            <button
              onClick={() => handleSubmit(false)}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Nộp Bài Làm
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
