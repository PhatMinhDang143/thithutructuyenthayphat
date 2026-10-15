import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AppUser, ExamItem, ExamSubmission, StudentAnswers, SubmissionTiming } from './types';
import { Header } from './components/common/Header';
import { AuthView } from './components/student/AuthView';
import {
  fetchAllData,
  submitExamResult,
  submitExamAnswersToServer,
  getStoredCurrentUser,
  logoutUser,
  updateStudentAvatar,
} from './services/storageService';
import {
  LayoutDashboard,
  FileSpreadsheet,
  ShieldCheck,
  Activity,
  Power,
  Component,
  BarChart2,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

// ================= LAZY LOAD: STUDENT VIEWS =================
const LobbyView = lazy(() =>
  import('./components/student/LobbyView').then((m) => ({ default: m.LobbyView }))
);
const ExamView = lazy(() =>
  import('./components/student/ExamView').then((m) => ({ default: m.ExamView }))
);
const ResultView = lazy(() =>
  import('./components/student/ResultView').then((m) => ({ default: m.ResultView }))
);

// ================= LAZY LOAD: TEACHER VIEWS =================
const DashboardView = lazy(() =>
  import('./components/teacher/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const ExamsMain = lazy(() =>
  import('./components/teacher/ExamsMain').then((m) => ({ default: m.ExamsMain }))
);
const StudentsManager = lazy(() =>
  import('./components/teacher/StudentsManager').then((m) => ({ default: m.StudentsManager }))
);
const HistoryViewer = lazy(() =>
  import('./components/teacher/HistoryViewer').then((m) => ({ default: m.HistoryViewer }))
);
const QuestionAnalyticsModal = lazy(() =>
  import('./components/teacher/QuestionAnalyticsModal').then((m) => ({
    default: m.QuestionAnalyticsModal,
  }))
);

// ================= NEO-BRUTALIST SKELETON FALLBACK =================
const BrutalistSkeleton: React.FC<{ label?: string }> = ({ label = 'Đang tải mô-đun giao diện...' }) => (
  <div className="w-full max-w-6xl mx-auto p-4 sm:p-8 space-y-6 animate-pulse">
    <div className="bg-white border-3 border-[#111111] p-6 shadow-[6px_6px_0px_#111111] flex items-center justify-between">
      <div className="space-y-3 w-2/3">
        <div className="h-6 bg-[#FFC93C] border-2 border-[#111111] w-48" />
        <div className="h-4 bg-[#FDF6E9] border border-[#111111] w-3/4" />
      </div>
      <div className="w-12 h-12 bg-[#4D6BFE] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] flex items-center justify-center">
        <div className="w-5 h-5 border-3 border-white border-t-transparent animate-spin" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="bg-white border-3 border-[#111111] p-5 h-44 shadow-[5px_5px_0px_#111111] flex flex-col justify-between"
        >
          <div className="h-4 bg-[#FDF6E9] border border-[#111111] w-1/2" />
          <div className="h-6 bg-neutral-200 border border-[#111111] w-full" />
          <div className="h-10 bg-[#FFC93C]/60 border-2 border-[#111111] w-full" />
        </div>
      ))}
    </div>
    <p className="text-center text-xs font-black uppercase tracking-wider text-[#111111]">{label}</p>
  </div>
);

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    return getStoredCurrentUser();
  });

  // App Data
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [students, setStudents] = useState<{ [username: string]: any }>({});
  const [history, setHistory] = useState<ExamSubmission[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Hash fingerprint để chống re-render thừa khi dữ liệu nền không đổi
  const lastDataHashRef = useRef<string>('');

  // Student Flow State
  const [studentSubView, setStudentSubView] = useState<'lobby' | 'exam' | 'result'>('lobby');
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);
  const [resultData, setResultData] = useState<ExamSubmission | null>(null);
  const [leaderboard, setLeaderboard] = useState<ExamSubmission[]>([]);

  // Teacher Flow State
  const [teacherSubView, setTeacherSubView] = useState<
    'dashboard' | 'exams' | 'students' | 'history' | 'analytics'
  >('dashboard');
  const [teacherMobileMenuOpen, setTeacherMobileMenuOpen] = useState<boolean>(false);

  const handleUpdateAvatar = async (newAvatar: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, avatar: newAvatar };
    setCurrentUser(updatedUser);
    await updateStudentAvatar(currentUser.username, newAvatar, updatedUser);
    await loadData(false, undefined, true);
  };

  const teacherNavItems = [
    { id: 'dashboard' as const, label: 'Trang Tổng Quan', shortLabel: 'Tổng Quan', icon: LayoutDashboard, color: '#FFC93C' },
    { id: 'exams' as const, label: 'Kho Đề Thi & Phân Lớp', shortLabel: 'Kho Đề Thi', icon: FileSpreadsheet, color: '#FFC93C' },
    { id: 'students' as const, label: 'Học Sinh & Phân Lớp', shortLabel: 'Học Sinh', icon: ShieldCheck, color: '#FFC93C' },
    { id: 'history' as const, label: 'Nhật Ký Nộp & Điểm', shortLabel: 'Nhật Ký Điểm', icon: Activity, color: '#FFC93C' },
    { id: 'analytics' as const, label: 'Phân Tích Đúng / Sai', shortLabel: 'Phân Tích Đề', icon: BarChart2, color: '#00E599' },
  ];

  // Data Loading (chạy qua Web Worker và chỉ setState khi dữ liệu thực sự thay đổi)
  const loadData = async (
    showLoadingSpinner: boolean = true,
    userRoleOverride?: 'student' | 'teacher' | 'guest',
    forceUpdate: boolean = false
  ) => {
    if (showLoadingSpinner) setLoading(true);
    try {
      const activeRole = userRoleOverride || currentUser?.role;
      const data = await fetchAllData(activeRole);

      // Tạo mã băm (fingerprint) nhanh từ kết quả của Worker
      const incomingHash =
        (data as any).dataHash ||
        `${data.exams.length}_${Object.keys(data.students).length}_${data.history.length}_${data.history[0]?.id || ''}_${data.exams.map((e) => e.updatedAt || e.id).join(',')}`;

      if (forceUpdate || incomingHash !== lastDataHashRef.current) {
        lastDataHashRef.current = incomingHash;
        setExams(data.exams);
        setStudents(data.students);
        setHistory(data.history);
        setClasses(data.classes);
      }

      if (currentUser && (currentUser.role === 'student' || currentUser.role === 'guest')) {
        const myLatest =
          data.students[currentUser.username.toLowerCase()] || data.students[currentUser.username];
        if (myLatest && myLatest.avatar && myLatest.avatar !== currentUser.avatar) {
          const updatedUser = { ...currentUser, avatar: myLatest.avatar };
          setCurrentUser(updatedUser);
          try {
            localStorage.setItem('app_current_user', JSON.stringify(updatedUser));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('Sync error:', e);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true, undefined, true);

    const handleSyncEvent = () => {
      if (studentSubView !== 'exam') {
        loadData(false, undefined, true);
      }
    };

    window.addEventListener('storage', handleSyncEvent);
    window.addEventListener('app_data_updated', handleSyncEvent);
    window.addEventListener('focus', handleSyncEvent);

    const interval = setInterval(() => {
      if (studentSubView !== 'exam' && !document.hidden) {
        loadData(false);
      }
    }, 8000);

    return () => {
      window.removeEventListener('storage', handleSyncEvent);
      window.removeEventListener('app_data_updated', handleSyncEvent);
      window.removeEventListener('focus', handleSyncEvent);
      clearInterval(interval);
    };
  }, [studentSubView, currentUser?.role]);

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setStudentSubView('lobby');
    setSelectedExam(null);
    setResultData(null);
    setTeacherSubView('dashboard');
    loadData(false, 'guest', true);
  };

  const handleExamSubmit = async (
    studentAnswers: StudentAnswers,
    cheatCount: number,
    exam: ExamItem,
    timing?: SubmissionTiming
  ) => {
    if (!currentUser) return;
    setLoading(true);

    const res = await submitExamAnswersToServer({
      examId: exam.id,
      examTitle: exam.title,
      username: currentUser.username,
      name: currentUser.name,
      avatar: currentUser.avatar,
      group: currentUser.group,
      studentAnswers,
      cheatCount,
      timing,
    });

    setLoading(false);

    if (res.success && res.submission) {
      const serverGradedSubmission = res.submission;
      setResultData(serverGradedSubmission);
      setStudentSubView('result');

      const updatedData = await fetchAllData(currentUser.role);
      setHistory(updatedData.history);

      const examLeaderboard = updatedData.history
        .filter(
          (h) =>
            (h.examTitle || '').trim().toLowerCase() === (exam.title || '').trim().toLowerCase() ||
            (h.examId && h.examId === exam.id)
        )
        .sort((a, b) => {
          const sB = Number(b.score) || 0;
          const sA = Number(a.score) || 0;
          if (sB !== sA) return sB - sA;
          const tA = a.timing?.totalSeconds || 999999;
          const tB = b.timing?.totalSeconds || 999999;
          return tA - tB;
        });

      setLeaderboard(examLeaderboard);
    } else {
      if (res.error && res.error.includes('vượt quá')) {
        alert(res.error);
        setSelectedExam(null);
        setStudentSubView('lobby');
        return;
      }
      const fallbackPayload: ExamSubmission = {
        username: currentUser.username,
        name: currentUser.name,
        avatar: currentUser.avatar,
        group: currentUser.group,
        examTitle: exam.title,
        score: 0,
        correct: 0,
        cheat: cheatCount >= 4 ? `${cheatCount} lần (Bị dừng bài)` : `${cheatCount} lần`,
        submitted_at: new Date().toLocaleString('vi-VN'),
        details: studentAnswers,
        timing,
      };
      setResultData(fallbackPayload);
      setStudentSubView('result');
      await submitExamResult(fallbackPayload);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FDF6E9] text-[#111111] flex flex-col font-sans">
      {!(
        currentUser &&
        (currentUser.role === 'student' || currentUser.role === 'guest') &&
        studentSubView === 'exam'
      ) && (
        <Header
          currentUser={currentUser}
          onLogout={handleLogout}
          onRefreshData={() => loadData(true, undefined, true)}
          onUpdateAvatar={handleUpdateAvatar}
        />
      )}

      <main className="flex-1 flex flex-col">
        {/* 1. NO USER LOGGED IN */}
        {!currentUser && (
          <AuthView
            studentsMap={students}
            onLoginSuccess={(usr) => {
              const validRole =
                usr.role === 'teacher' ? 'teacher' : usr.role === 'guest' ? 'guest' : 'student';
              const cleanUser: AppUser = {
                username: String(usr.username || '').trim(),
                name: String(usr.name || usr.username || 'Học sinh').trim(),
                group: String(usr.group || 'Chưa phân lớp').trim(),
                role: validRole,
              };
              setCurrentUser(cleanUser);
              loadData(false, validRole, true);
              if (validRole === 'teacher') {
                setTeacherSubView('dashboard');
              } else {
                setStudentSubView('lobby');
                setSelectedExam(null);
                setResultData(null);
              }
            }}
            onEnterAsGuest={() => {
              setCurrentUser({
                name: 'Khách ' + Math.floor(Math.random() * 8999 + 1000),
                role: 'guest',
                username: 'guest',
                group: 'Khách',
              });
              setStudentSubView('lobby');
              setSelectedExam(null);
              setResultData(null);
            }}
          />
        )}

        {/* 2. LOGGED IN AS TEACHER / ADMIN */}
        {currentUser && currentUser.role === 'teacher' && (
          <div className="flex flex-col lg:flex-row w-full min-h-[calc(100dvh-65px)] bg-[#FDF6E9] text-[#111111]">
            <aside className="hidden lg:flex w-64 bg-white border-r-3 border-[#111111] flex-col shrink-0 p-4 space-y-3 z-20 shadow-[4px_0px_0px_#111111]">
              <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] flex items-center gap-2.5">
                <Component className="w-5 h-5 text-[#4D6BFE]" />
                <div>
                  <h2 className="font-black text-xs text-[#111111] uppercase tracking-wider">
                    Bảng Điều Khiển GV
                  </h2>
                  <p className="text-[10px] text-[#4D6BFE] font-black uppercase">Management Console</p>
                </div>
              </div>

              <nav className="flex-1 space-y-2">
                {teacherNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = teacherSubView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTeacherSubView(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 font-black text-xs uppercase tracking-wider transition-all border-2 border-[#111111] ${
                        isActive
                          ? item.id === 'analytics'
                            ? 'bg-[#00E599] text-[#111111] shadow-[3px_3px_0px_#111111] translate-x-1'
                            : 'bg-[#FFC93C] text-[#111111] shadow-[3px_3px_0px_#111111] translate-x-1'
                          : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] hover:text-[#111111]'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-[#111111]" /> {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="pt-2 border-t-2 border-[#111111]">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 font-black text-xs uppercase text-white bg-[#E63946] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#111111] transition-all"
                >
                  <Power className="w-4 h-4" /> Đăng Xuất GV
                </button>
              </div>
            </aside>

            {/* Mobile Teacher Top Navigation */}
            <div className="lg:hidden w-full bg-white border-b-2 border-[#111111] sticky top-[53px] sm:top-[57px] z-30 shadow-[0_3px_0px_#111111]">
              <div className="flex items-center justify-between px-3 py-2 bg-[#FFFFFF] border-b border-neutral-200">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setTeacherMobileMenuOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-black text-xs uppercase shrink-0"
                  >
                    <Menu className="w-4 h-4" />
                    <span>Menu GV</span>
                  </button>
                  <div className="flex items-center gap-1.5 min-w-0 pl-1">
                    {(() => {
                      const activeItem =
                        teacherNavItems.find((t) => t.id === teacherSubView) || teacherNavItems[0];
                      const ActiveIcon = activeItem.icon;
                      return (
                        <>
                          <div className="p-1 bg-[#FDF6E9] border border-[#111111] shrink-0">
                            <ActiveIcon className="w-3.5 h-3.5 text-[#111111]" />
                          </div>
                          <span className="font-black text-xs text-[#111111] uppercase tracking-wide truncate">
                            {activeItem.label}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2 py-1 bg-[#E63946] text-white border border-[#111111] shadow-[1px_1px_0px_#111111] text-[10px] font-black uppercase flex items-center gap-1 shrink-0 ml-2"
                >
                  <Power className="w-3 h-3" />
                  <span className="hidden xs:inline">Thoát</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-2 overflow-x-auto no-scrollbar bg-[#F8F9FA]">
                {teacherNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = teacherSubView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTeacherSubView(item.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#111111] text-[11px] font-black uppercase whitespace-nowrap transition-all shrink-0 ${
                        isActive
                          ? item.id === 'analytics'
                            ? 'bg-[#00E599] text-[#111111] shadow-[2px_2px_0px_#111111]'
                            : 'bg-[#FFC93C] text-[#111111] shadow-[2px_2px_0px_#111111]'
                          : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] hover:text-[#111111]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {teacherMobileMenuOpen && (
              <div className="fixed inset-0 z-50 flex lg:hidden">
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                  onClick={() => setTeacherMobileMenuOpen(false)}
                />
                <div className="relative w-[85%] max-w-xs bg-white border-r-3 border-[#111111] shadow-[5px_0px_0px_#111111] flex flex-col p-4 z-50 h-full overflow-y-auto">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-[#111111]">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#FFC93C] border-2 border-[#111111] shadow-[1px_1px_0px_#111111]">
                        <Component className="w-4 h-4 text-[#111111]" />
                      </div>
                      <div>
                        <h2 className="font-black text-xs text-[#111111] uppercase tracking-wider">
                          Bảng Điều Khiển GV
                        </h2>
                        <p className="text-[9px] text-[#4D6BFE] font-black uppercase">Chế Độ Di Động</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTeacherMobileMenuOpen(false)}
                      className="p-1.5 bg-neutral-100 hover:bg-neutral-200 border-2 border-[#111111]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <nav className="flex-1 space-y-2">
                    {teacherNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = teacherSubView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setTeacherSubView(item.id);
                            setTeacherMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-3 font-black text-xs uppercase tracking-wider transition-all border-2 border-[#111111] ${
                            isActive
                              ? item.id === 'analytics'
                                ? 'bg-[#00E599] text-[#111111] shadow-[3px_3px_0px_#111111]'
                                : 'bg-[#FFC93C] text-[#111111] shadow-[3px_3px_0px_#111111]'
                              : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] hover:text-[#111111]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-[#111111]" />
                            <span>{item.label}</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                        </button>
                      );
                    })}
                  </nav>

                  <div className="pt-3 mt-3 border-t-2 border-[#111111]">
                    <button
                      type="button"
                      onClick={() => {
                        setTeacherMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 font-black text-xs uppercase text-white bg-[#E63946] border-2 border-[#111111] shadow-[3px_3px_0px_#111111]"
                    >
                      <Power className="w-4 h-4" /> Đăng Xuất GV
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Teacher Content View wrapped in Suspense */}
            <div className="flex-1 w-full min-w-0 p-2.5 sm:p-4 lg:p-8 overflow-y-auto custom-scroll">
              <Suspense fallback={<BrutalistSkeleton label="Đang tải công cụ quản lý Giáo viên..." />}>
                {teacherSubView === 'dashboard' && (
                  <DashboardView
                    exams={exams}
                    students={students}
                    history={history}
                    classes={classes}
                    onNavigateToAnalytics={() => setTeacherSubView('analytics')}
                  />
                )}
                {teacherSubView === 'exams' && (
                  <ExamsMain
                    exams={exams}
                    classes={classes}
                    onRefresh={() => loadData(true, undefined, true)}
                    history={history}
                  />
                )}
                {teacherSubView === 'students' && (
                  <StudentsManager
                    students={students}
                    classes={classes}
                    onRefresh={() => loadData(true, undefined, true)}
                  />
                )}
                {teacherSubView === 'history' && (
                  <HistoryViewer
                    history={history}
                    classes={classes}
                    onRefresh={() => loadData(true, undefined, true)}
                    exams={exams}
                  />
                )}
                {teacherSubView === 'analytics' && (
                  <QuestionAnalyticsModal
                    embedded={true}
                    exams={exams}
                    history={history}
                    availableClasses={classes}
                  />
                )}
              </Suspense>
            </div>
          </div>
        )}

        {/* 3. LOGGED IN AS STUDENT / GUEST */}
        {currentUser && (currentUser.role === 'student' || currentUser.role === 'guest') && (
          <div className="w-full">
            <Suspense fallback={<BrutalistSkeleton label="Đang chuẩn bị không gian phòng thi..." />}>
              {studentSubView === 'exam' && selectedExam ? (
                <ExamView user={currentUser} exam={selectedExam} onExamSubmit={handleExamSubmit} />
              ) : studentSubView === 'result' && selectedExam && resultData ? (
                <ResultView
                  user={currentUser}
                  exam={selectedExam}
                  resultData={resultData}
                  leaderboard={leaderboard}
                  onUpdateAvatar={handleUpdateAvatar}
                  onBackToLobby={() => {
                    setSelectedExam(null);
                    setResultData(null);
                    setStudentSubView('lobby');
                  }}
                />
              ) : (
                <LobbyView
                  user={currentUser}
                  exams={exams || []}
                  history={history || []}
                  loading={loading}
                  onLogout={handleLogout}
                  onUpdateAvatar={handleUpdateAvatar}
                  onSelectExam={(ex) => {
                    setSelectedExam(ex);
                    setStudentSubView('exam');
                  }}
                  onViewResult={(ex, submission) => {
                    setSelectedExam(ex);
                    setResultData(submission);
                    const examLeaderboard = (history || [])
                      .filter(
                        (h) =>
                          (h.examTitle || '').trim().toLowerCase() ===
                            (ex.title || '').trim().toLowerCase() ||
                          (h.examId && h.examId === ex.id)
                      )
                      .sort((a, b) => {
                        const sB = Number(b.score) || 0;
                        const sA = Number(a.score) || 0;
                        if (sB !== sA) return sB - sA;
                        const tA = a.timing?.totalSeconds || 999999;
                        const tB = b.timing?.totalSeconds || 999999;
                        return tA - tB;
                      });
                    setLeaderboard(examLeaderboard);
                    setStudentSubView('result');
                  }}
                />
              )}
            </Suspense>
          </div>
        )}
      </main>
    </div>
  );
}
