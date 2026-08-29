import React, { useState, useEffect, useRef } from 'react';
import { AppUser, ExamItem, StudentAnswers } from '../../types';
import { 
  Clock, Minimize2, Maximize2, User, Flag, Check, Edit3, X, 
  AlertTriangle, Send, FileText, AlertCircle, Eye, Bookmark, Settings, Palette
} from 'lucide-react';
import { PdfViewer } from '../common/PdfViewer';
import { useTheme } from '../../context/ThemeContext';
import { ThemeSettingsModal } from '../common/ThemeSettingsModal';

interface ExamViewProps {
  user: AppUser;
  exam: ExamItem;
  onExamSubmit: (studentAnswers: StudentAnswers, cheatCount: number, exam: ExamItem) => void;
}

export const ExamView: React.FC<ExamViewProps> = ({ user, exam, onExamSubmit }) => {
  const { playClickSound, theme } = useTheme();
  const [showThemeModal, setShowThemeModal] = useState(false);

  const cfg = exam.questions || {};
  const numP1 = cfg.num_p1 || 0;
  const numP2 = cfg.num_p2 || 0;
  const numP3 = cfg.num_p3 || 0;

  const p1Questions = Array.from({ length: numP1 }, (_, i) => i + 1);
  const p2Questions = Array.from({ length: numP2 }, (_, i) => i + 1);
  const p3Questions = Array.from({ length: numP3 }, (_, i) => i + 1);

  const [isFocusMode, setIsFocusMode] = useState(theme.focusModeByDefault);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(window.innerWidth > 768);


  // Draggable Floating Button on Mobile
  const [btnPos, setBtnPos] = useState({ x: window.innerWidth - 175, y: window.innerHeight - 85 });
  const btnDrag = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0, hasMoved: false });

  useEffect(() => {
    const updatePos = () => setBtnPos({ x: window.innerWidth - 175, y: window.innerHeight - 85 });
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
    let newX = Math.max(0, Math.min(btnDrag.current.initialX + dx, window.innerWidth - 165));
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
    const draftData = { ansPart1, ansPart2, ansPart3, flaggedQuestions, timeLeft, cheatCount };
    localStorage.setItem(storageKey, JSON.stringify(draftData));
  }, [ansPart1, ansPart2, ansPart3, flaggedQuestions, timeLeft, cheatCount]);

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
    <div className={`h-[100dvh] w-full flex flex-col bg-[#FDF6E9] text-[#111111] overflow-hidden ${isFocusMode ? 'focus-active' : ''}`}>
      {/* Top Bar - Neo-Brutalist High Contrast Header */}
      <header className="h-14 bg-white border-b-2 border-[#111111] flex items-center justify-between px-3 md:px-6 shrink-0 z-40 shadow-[0_2px_0px_#111111]">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`p-2 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all ${
              isFocusMode ? 'bg-[#FFC93C] text-[#111111]' : 'bg-[#FDF6E9] text-[#111111] hover:bg-white'
            }`}
            title={isFocusMode ? "Thu nhỏ đề thi" : "Phóng to đề thi toàn màn hình"}
          >
            {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <span className="font-black text-xs md:text-sm text-[#111111] uppercase truncate max-w-[150px] sm:max-w-xs md:max-w-md">
            {exam.title}
          </span>
        </div>

        {/* Timer */}
        <div className={`flex flex-col items-center justify-center border-2 border-[#111111] px-3 md:px-4 py-1 min-w-[110px] md:min-w-[130px] shadow-[3px_3px_0px_#111111] ${
          isDanger ? 'timer-danger' : 'bg-white'
        }`}>
          <p className="text-[9px] uppercase tracking-widest font-black text-neutral-600">Thời Gian</p>
          <p className="text-sm md:text-base font-black font-mono tracking-tight flex items-center gap-1.5 text-[#111111]">
            <Clock className="w-4 h-4" /> {minutes}:{seconds}
          </p>
        </div>

        {/* Student Info & Mobile Sheet Toggle & Appearance Modal */}
        <div className="flex items-center gap-2">
          {/* Theme Settings Button in Exam View */}
          <button
            type="button"
            onClick={() => setShowThemeModal(true)}
            className="p-1.5 sm:p-2 bg-white hover:bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="Tùy chỉnh giao diện (Màu sắc, cỡ chữ, âm thanh)"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* Quick toggle button on mobile header */}
          <button
            onClick={() => setIsMobileSheetOpen(!isMobileSheetOpen)}
            className="md:hidden px-2.5 py-1.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs font-black flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{totalAnswered}/{totalQuestions}</span>
          </button>

          <div className="text-right hidden sm:block bg-[#FDF6E9] border-2 border-[#111111] px-3 py-1 shadow-[2px_2px_0px_#111111]">
            <p className="text-xs font-black text-[#111111] leading-tight truncate max-w-[140px]">{user.name}</p>
            <p className="text-[10px] text-[#4D6BFE] uppercase font-black">Lớp: {user.group}</p>
          </div>
          <div className="bg-[#4D6BFE] text-white p-2 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] hidden sm:block">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* PDF Viewer Section */}
        <div
          className={`w-full relative z-10 bg-[#FDF6E9] flex flex-col p-1.5 md:p-3 pdf-container border-b-2 md:border-b-0 md:border-r-2 border-[#111111] shrink-0 transition-all duration-300 ${
            isFocusMode ? 'h-full md:w-full' : 'h-full md:w-3/5 lg:w-2/3'
          }`}
        >
          <div className="flex-1 w-full h-full relative overflow-hidden bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111]">
            <PdfViewer fileUrl={cfg.file_link} exam={exam} title={exam.title} />
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
            className="md:hidden fixed z-40 bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] text-[#111111] px-4 py-2.5 border-3 border-[#111111] shadow-[4px_4px_0px_#111111] font-black flex items-center gap-2 cursor-move select-none"
            style={{ left: `${btnPos.x}px`, top: `${btnPos.y}px`, touchAction: 'none' }}
            onPointerDown={onBtnDown}
            onPointerMove={onBtnMove}
            onPointerUp={onBtnUp}
            onPointerCancel={onBtnUp}
          >
            <Edit3 className="w-4 h-4" />
            <span className="text-xs uppercase">Phiếu Bài</span>
            <span className="bg-[#111111] text-white px-2 py-0.5 text-[10px] font-black">
              {totalAnswered}/{totalQuestions}
            </span>
          </div>
        )}

        {/* Answer Sheet Panel (Bảng câu hỏi bên phải) */}
        <aside
          className={`sidebar-panel w-full md:w-2/5 lg:w-1/3 bg-[#FDF6E9] flex flex-col transition-all duration-300 ${
            isMobileSheetOpen ? 'sheet-open' : ''
          } ${isFocusMode ? 'hidden' : 'flex'}`}
        >
          {/* Mobile Sheet Drag Handle */}
          <div 
            onClick={() => setIsMobileSheetOpen(false)} 
            className="md:hidden pt-2 pb-1 flex justify-center cursor-pointer bg-white border-b-2 border-[#111111]"
          >
            <div className="w-16 h-2 bg-[#111111]"></div>
          </div>

          <div className="p-3 md:p-4 border-b-2 border-[#111111] flex items-center justify-between shrink-0 bg-white shadow-[0_2px_0px_#111111]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#4D6BFE] text-white border border-[#111111] shadow-[1px_1px_0px_#111111]">
                <Edit3 className="w-4 h-4" />
              </div>
              <h3 className="font-black text-sm uppercase tracking-wider text-[#111111]">Phiếu Đáp Án</h3>
              <span className="text-[11px] font-black px-2.5 py-1 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                {totalAnswered}/{totalQuestions}
              </span>
            </div>
            <button
              onClick={() => setIsMobileSheetOpen(false)}
              className="md:hidden p-1.5 text-[#111111] hover:bg-[#E63946] hover:text-white bg-[#FDF6E9] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]"
              title="Đóng phiếu bài làm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Question List: Large numbers, bold font, square boxes without rounded corners */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scroll space-y-6 pb-24 md:pb-6">
            {/* Part I: Multiple Choice */}
            {p1Questions.length > 0 && (
              <div>
                <div className="flex items-center justify-between bg-[#FFFFFF] border-2 border-[#111111] px-3 py-2 mb-3 shadow-[3px_3px_0px_#111111]">
                  <h4 className="text-xs font-black text-[#111111] uppercase tracking-wider">
                    Phần I: Trắc Nghiệm ({p1Questions.length} câu)
                  </h4>
                  <span className="text-[10px] font-black text-[#4D6BFE] bg-[#FDF6E9] px-2 py-0.5 border border-[#111111]">
                    Chọn 1 đáp án
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 xl:grid-cols-5 gap-2">
                  {p1Questions.map((qNum) => {
                    const isFlagged = flaggedQuestions[`p1_${qNum}`];
                    const selected = ansPart1[qNum];
                    return (
                      <div 
                        key={qNum} 
                        className={`relative flex flex-col items-center p-2 border-2 border-[#111111] transition-all ${
                          selected 
                            ? 'bg-[#FFFFFF] shadow-[3px_3px_0px_#111111]' 
                            : 'bg-white shadow-[2px_2px_0px_#111111]'
                        } ${isFlagged ? 'ring-2 ring-[#FFC93C]' : ''}`}
                      >
                        {/* Bookmark/Flag Button */}
                        <button
                          type="button"
                          onClick={() => setFlaggedQuestions({ ...flaggedQuestions, [`p1_${qNum}`]: !isFlagged })}
                          className={`absolute top-1 right-1 p-0.5 transition-colors ${
                            isFlagged 
                              ? 'bg-[#FFC93C] text-[#111111] border border-[#111111]' 
                              : 'text-neutral-400 hover:text-[#111111]'
                          }`}
                          title={isFlagged ? "Bỏ đánh dấu câu này" : "Đánh dấu xem lại câu này"}
                        >
                          <Flag className="w-2.5 h-2.5 fill-current" />
                        </button>

                        {/* Large bold number */}
                        <span className="text-sm font-black text-[#111111] mb-1.5">
                          {qNum}
                        </span>

                        {/* 4 Options: Non-rounded squares */}
                        <div className="flex gap-1 w-full flex-wrap justify-center">
                          {['A', 'B', 'C', 'D'].map((ans) => {
                            const isSelected = selected === ans;
                            return (
                              <button
                                key={ans}
                                type="button"
                                onClick={() => {
                                  setAnsPart1({ ...ansPart1, [qNum]: ans });
                                  playClickSound();
                                }}
                                className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center font-black text-xs border-2 border-[#111111] transition-all ${
                                  isSelected
                                    ? 'bg-[#4D6BFE] text-white shadow-[1px_1px_0px_#111111] translate-x-[1px] translate-y-[1px]'
                                    : 'bg-white text-[#111111] shadow-[2px_2px_0px_#111111] hover:bg-[#FDF6E9] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                                }`}
                              >
                                {ans}
                              </button>
                            );
                          })}
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
                <div className="flex items-center justify-between bg-[#FFFFFF] border-2 border-[#111111] px-3 py-2 mb-3 shadow-[3px_3px_0px_#111111]">
                  <h4 className="text-xs font-black text-[#111111] uppercase tracking-wider">
                    Phần II: Đúng / Sai ({p2Questions.length} câu)
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] font-black">
                    <span className="bg-[#0F9D58] text-white px-1.5 py-0.5 border border-[#111111] shadow-[1px_1px_0px_#111111]">
                      Đ: Đúng
                    </span>
                    <span className="bg-[#E63946] text-white px-1.5 py-0.5 border border-[#111111] shadow-[1px_1px_0px_#111111]">
                      S: Sai
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {p2Questions.map((qNum) => {
                    const isFlagged = flaggedQuestions[`p2_${qNum}`];
                    return (
                      <div 
                        key={qNum} 
                        className={`p-3 bg-white border-2 border-[#111111] shadow-[3px_3px_0px_#111111] relative ${
                          isFlagged ? 'ring-2 ring-[#FFC93C]' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2.5 pb-1.5 border-b border-neutral-200">
                          <span className="text-sm font-black text-[#111111]">
                            Câu {qNum}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFlaggedQuestions({ ...flaggedQuestions, [`p2_${qNum}`]: !isFlagged })}
                            className={`p-1 text-xs font-bold flex items-center gap-1 border border-[#111111] shadow-[1px_1px_0px_#111111] ${
                              isFlagged ? 'bg-[#FFC93C] text-[#111111]' : 'bg-[#FDF6E9] text-neutral-600'
                            }`}
                          >
                            <Flag className="w-3 h-3 fill-current" />
                            <span className="text-[10px]">Đánh dấu</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {(['a', 'b', 'c', 'd'] as const).map((sub) => {
                            const currentVal = ansPart2[qNum]?.[sub];
                            return (
                              <div key={sub} className="flex items-center justify-between bg-[#FDF6E9] px-2.5 py-1.5 border-2 border-[#111111]">
                                <span className="text-xs font-black uppercase text-[#111111]">{sub}.</span>
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAnsPart2({ ...ansPart2, [qNum]: { ...ansPart2[qNum], [sub]: 'Đ' } });
                                      playClickSound();
                                    }}
                                    className={`w-7 h-6 sm:w-8 sm:h-7 flex items-center justify-center font-black text-xs border-2 border-[#111111] transition-all ${
                                      currentVal === 'Đ' 
                                        ? 'bg-[#0F9D58] text-white shadow-[1px_1px_0px_#111111] translate-x-[1px] translate-y-[1px]' 
                                        : 'bg-white text-[#111111] shadow-[2px_2px_0px_#111111] hover:bg-neutral-100'
                                    }`}
                                  >
                                    Đ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAnsPart2({ ...ansPart2, [qNum]: { ...ansPart2[qNum], [sub]: 'S' } });
                                      playClickSound();
                                    }}
                                    className={`w-7 h-6 sm:w-8 sm:h-7 flex items-center justify-center font-black text-xs border-2 border-[#111111] transition-all ${
                                      currentVal === 'S' 
                                        ? 'bg-[#E63946] text-white shadow-[1px_1px_0px_#111111] translate-x-[1px] translate-y-[1px]' 
                                        : 'bg-white text-[#111111] shadow-[2px_2px_0px_#111111] hover:bg-neutral-100'
                                    }`}
                                  >
                                    S
                                  </button>
                                </div>
                              </div>
                            );
                          })}
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
                <div className="flex items-center justify-between bg-[#FFFFFF] border-2 border-[#111111] px-3 py-2 mb-3 shadow-[3px_3px_0px_#111111]">
                  <h4 className="text-xs font-black text-[#111111] uppercase tracking-wider">
                    Phần III: Trả Lời Ngắn ({p3Questions.length} câu)
                  </h4>
                  <span className="text-[10px] font-black text-[#111111] bg-[#FFC93C] px-2 py-0.5 border border-[#111111]">
                    Điền số
                  </span>
                </div>

                <div className="space-y-2.5">
                  {p3Questions.map((qNum) => {
                    const isFlagged = flaggedQuestions[`p3_${qNum}`];
                    return (
                      <div 
                        key={qNum} 
                        className={`flex items-center gap-2 bg-white p-2.5 border-2 border-[#111111] shadow-[3px_3px_0px_#111111] relative ${
                          isFlagged ? 'ring-2 ring-[#FFC93C]' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setFlaggedQuestions({ ...flaggedQuestions, [`p3_${qNum}`]: !isFlagged })}
                          className={`p-1 transition-colors ${
                            isFlagged ? 'bg-[#FFC93C] text-[#111111] border border-[#111111]' : 'text-neutral-400 hover:text-[#111111]'
                          }`}
                          title="Đánh dấu xem lại"
                        >
                          <Flag className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <span className="text-xs font-black text-[#111111] w-14 text-center shrink-0">
                          Câu {qNum}
                        </span>
                        <input
                          type="text"
                          value={ansPart3[qNum] || ''}
                          onChange={(e) => setAnsPart3({ ...ansPart3, [qNum]: e.target.value })}
                          className="flex-1 bg-[#FDF6E9] border-2 border-[#111111] px-3 py-2 text-xs font-black text-[#111111] outline-none focus:bg-white shadow-[2px_2px_0px_#111111]"
                          placeholder="Nhập đáp số..."
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button: #FFC93C (vàng mù tạt) với viền đen 2px và đổ bóng khối */}
          <div className="p-4 bg-white border-t-2 border-[#111111] shrink-0 shadow-[0_-2px_0px_#111111]">
            <button
              onClick={() => handleSubmit(false)}
              className="w-full bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] py-3.5 border-3 border-[#111111] shadow-[4px_4px_0px_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#111111] font-black text-sm uppercase tracking-wider text-[#111111] flex items-center justify-center gap-2 transition-all"
            >
              <Send className="w-4 h-4" /> Nộp Bài Làm
            </button>
          </div>
        </aside>
      </div>

      {/* Theme & Appearance Customization Modal */}
      <ThemeSettingsModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
    </div>
  );
};

