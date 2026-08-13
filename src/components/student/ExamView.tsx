import React, { useState, useEffect, useRef } from 'react';
import { AppUser, ExamItem, StudentAnswers } from '../../types';
import { Clock, Minimize2, Maximize2, User, Flag, Check, Edit3, X, AlertTriangle, Send, FileText } from 'lucide-react';

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

  // PDF Preview Link Formatter
  const getPreviewUrl = (url?: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com/file/d/')) return url.replace(/\/view.*/, '/preview');
    return url;
  };
  const pdfUrl = getPreviewUrl(cfg.file_link);

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

  const minutes = Math.floor(timeLeft / 60);
  const seconds = String(timeLeft % 60).padStart(2, '0');
  const isDanger = timeLeft < 300;

  return (
    <div className={`h-[calc(100vh-60px)] w-full flex flex-col bg-[#0b1121] overflow-hidden ${isFocusMode ? 'focus-active' : ''}`}>
      {/* Top Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 md:px-6 shrink-0 z-40 shadow-md">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`p-2 rounded-lg transition-colors ${isFocusMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title="Phóng to đề thi"
          >
            {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <span className="font-bold text-xs md:text-sm text-indigo-400 uppercase truncate max-w-[180px] md:max-w-xs">
            {exam.title}
          </span>
        </div>

        {/* Timer */}
        <div className="flex flex-col items-center justify-center bg-slate-800/80 border border-slate-700/60 px-4 py-1 rounded-xl min-w-[120px]">
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Thời Gian Còn Lại</p>
          <p className={`text-sm md:text-base font-black font-mono tracking-tight flex items-center gap-1 ${isDanger ? 'timer-danger' : 'text-indigo-400'}`}>
            <Clock className="w-3.5 h-3.5 animate-pulse" /> {minutes}:{seconds}
          </p>
        </div>

        {/* Student Info */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-200">{user.name}</p>
            <p className="text-[10px] text-indigo-400 uppercase font-semibold">Lớp: {user.group}</p>
          </div>
          <div className="bg-indigo-600 p-2 rounded-xl shadow-md">
            <User className="w-4 h-4 text-white" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* PDF Viewer Section */}
        <div
          className={`w-full relative z-10 bg-[#1e1e1e] p-1 md:p-4 pdf-container border-b md:border-b-0 md:border-r border-slate-800 shrink-0 transition-all duration-300 ${
            isFocusMode ? 'h-full md:w-full' : 'h-full md:w-3/5 lg:w-2/3'
          }`}
        >
          {pdfUrl ? (
            <iframe src={pdfUrl} allow="autoplay" className="w-full h-full md:rounded-xl shadow-2xl bg-white"></iframe>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <FileText className="w-16 h-16 mb-3 opacity-30" />
              <p className="text-sm font-semibold">Đề thi chưa đính kèm file PDF</p>
              <p className="text-xs text-slate-600">Vui lòng đọc đề và chọn đáp án ở phiếu bên phải.</p>
            </div>
          )}
        </div>

        {/* Floating Draggable Button for Mobile */}
        {!isMobileSheetOpen && (
          <div
            className="md:hidden fixed z-40 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-full shadow-[0_4px_20px_rgba(79,70,229,0.5)] font-bold flex items-center gap-2 cursor-move select-none"
            style={{ left: `${btnPos.x}px`, top: `${btnPos.y}px`, touchAction: 'none' }}
            onPointerDown={onBtnDown}
            onPointerMove={onBtnMove}
            onPointerUp={onBtnUp}
            onPointerCancel={onBtnUp}
          >
            <Edit3 className="w-4 h-4" /> Phiếu Bài Làm
          </div>
        )}

        {/* Answer Sheet Panel */}
        <aside
          className={`sidebar-panel w-full md:w-2/5 lg:w-1/3 bg-slate-900 flex flex-col transition-all duration-300 ${
            isMobileSheetOpen ? 'sheet-open' : ''
          } ${isFocusMode ? 'hidden' : 'flex'}`}
        >
          <div className="p-3 md:p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/80">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">Phiếu Đáp Án</h3>
            </div>
            <button
              onClick={() => setIsMobileSheetOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
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
