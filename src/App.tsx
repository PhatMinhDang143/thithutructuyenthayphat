import React, { useState, useEffect } from 'react';
import { AppUser, ExamItem, ExamSubmission, StudentAnswers, SubmissionTiming } from './types';
import { Header } from './components/common/Header';
import { AuthView } from './components/student/AuthView';
import { LobbyView } from './components/student/LobbyView';
import { ExamView } from './components/student/ExamView';
import { ResultView } from './components/student/ResultView';

import { DashboardView } from './components/teacher/DashboardView';
import { ExamsMain } from './components/teacher/ExamsMain';
import { StudentsManager } from './components/teacher/StudentsManager';
import { HistoryViewer } from './components/teacher/HistoryViewer';
import { QuestionAnalyticsModal } from './components/teacher/QuestionAnalyticsModal';

import { fetchAllData, submitExamResult, submitExamAnswersToServer, getStoredCurrentUser, logoutUser, updateStudentAvatar } from './services/storageService';
import { LayoutDashboard, FileSpreadsheet, ShieldCheck, Activity, Power, Component, BarChart2, Menu, X, ChevronRight } from 'lucide-react';

export default function App() {
  // Current logged in user (null = show Login screen)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    return getStoredCurrentUser();
  });

  // App Data
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [students, setStudents] = useState<{ [username: string]: any }>({});
  const [history, setHistory] = useState<ExamSubmission[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Student Flow State
  const [studentSubView, setStudentSubView] = useState<'lobby' | 'exam' | 'result'>('lobby');
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);
  const [resultData, setResultData] = useState<ExamSubmission | null>(null);
  const [leaderboard, setLeaderboard] = useState<ExamSubmission[]>([]);

  // Teacher Flow State
  const [teacherSubView, setTeacherSubView] = useState<'dashboard' | 'exams' | 'students' | 'history' | 'analytics'>('dashboard');
  const [teacherMobileMenuOpen, setTeacherMobileMenuOpen] = useState<boolean>(false);

  const handleUpdateAvatar = async (newAvatar: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, avatar: newAvatar };
    setCurrentUser(updatedUser);
    await updateStudentAvatar(currentUser.username, newAvatar, updatedUser);
    await loadData(false);
  };

  const teacherNavItems = [
    { id: 'dashboard' as const, label: 'Trang Tổng Quan', shortLabel: 'Tổng Quan', icon: LayoutDashboard, color: '#FFC93C' },
    { id: 'exams' as const, label: 'Kho Đề Thi & Phân Lớp', shortLabel: 'Kho Đề Thi', icon: FileSpreadsheet, color: '#FFC93C' },
    { id: 'students' as const, label: 'Học Sinh & Phân Lớp', shortLabel: 'Học Sinh', icon: ShieldCheck, color: '#FFC93C' },
    { id: 'history' as const, label: 'Nhật Ký Nộp & Điểm', shortLabel: 'Nhật Ký Điểm', icon: Activity, color: '#FFC93C' },
    { id: 'analytics' as const, label: 'Phân Tích Đúng / Sai', shortLabel: 'Phân Tích Đề', icon: BarChart2, color: '#00E599' },
  ];

  // Data Loading (supports silent background sync and role-based data filtering)
  const loadData = async (showLoadingSpinner: boolean = true, userRoleOverride?: 'student' | 'teacher' | 'guest') => {
    if (showLoadingSpinner) setLoading(true);
    try {
      const activeRole = userRoleOverride || currentUser?.role;
      const data = await fetchAllData(activeRole);
      setExams(data.exams);
      setStudents(data.students);
      setHistory(data.history);
      setClasses(data.classes);
    } catch (e) {
      console.warn('Sync error:', e);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    loadData(true);

    // Cross-tab and window event synchronization
    const handleSyncEvent = () => {
      // If student is currently taking an exam, don't interrupt their screen
      if (studentSubView !== 'exam') {
        loadData(false);
      }
    };

    window.addEventListener('storage', handleSyncEvent);
    window.addEventListener('app_data_updated', handleSyncEvent);
    window.addEventListener('focus', handleSyncEvent);

    // Periodic background sync interval (every 8 seconds)
    const interval = setInterval(() => {
      if (studentSubView !== 'exam') {
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
    // Refresh data with guest/student view
    loadData(false, 'guest');
  };

  // Authoritative Server-Side Exam Submission & Grading
  const handleExamSubmit = async (
    studentAnswers: StudentAnswers, 
    cheatCount: number, 
    exam: ExamItem,
    timing?: SubmissionTiming
  ) => {
    if (!currentUser) return;

    setLoading(true);

    // Send raw student answers to the server. The server computes the score securely from its hidden answer key.
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

      // Refresh history
      const updatedData = await fetchAllData(currentUser.role);
      setHistory(updatedData.history);

      // Compute leaderboard for this exam (Score DESC, then Duration ASC)
      const examLeaderboard = updatedData.history
        .filter((h) => (h.examTitle || '').trim().toLowerCase() === (exam.title || '').trim().toLowerCase() || (h.examId && h.examId === exam.id))
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
      if (res.error && res.error.includes('vượt quá số lần làm bài')) {
        alert(res.error);
        setSelectedExam(null);
        setStudentSubView('lobby');
        return;
      }

      // Fallback: If server is temporarily unreachable, create local submission
      console.warn('Server grading returned error, attempting fallback submission:', res.error);
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
    <div className="min-h-[100dvh] bg-[#030712] text-slate-100 flex flex-col font-sans">
      {/* Top Header (Hidden during student exam view to give full 100dvh space for reading and answering) */}
      {!(currentUser && (currentUser.role === 'student' || currentUser.role === 'guest') && studentSubView === 'exam') && (
        <Header
          currentUser={currentUser}
          onLogout={handleLogout}
          onRefreshData={loadData}
          onUpdateAvatar={handleUpdateAvatar}
        />
      )}

      <main className="flex-1 flex flex-col">
        {/* 1. NO USER LOGGED IN -> UNIFIED AUTH VIEW */}
        {!currentUser && (
          <AuthView
            studentsMap={students}
            onLoginSuccess={(usr) => {
              // Validate user object
              const validRole = usr.role === 'teacher' ? 'teacher' : usr.role === 'guest' ? 'guest' : 'student';
              const cleanUser: AppUser = {
                username: String(usr.username || '').trim(),
                name: String(usr.name || usr.username || 'Học sinh').trim(),
                group: String(usr.group || 'Chưa phân lớp').trim(),
                role: validRole,
              };

              setCurrentUser(cleanUser);
              loadData(false, validRole);
              if (validRole === 'teacher') {
                setTeacherSubView('dashboard');
              } else {
                // Strictly set student flow to lobby view upon login
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
            {/* Desktop Teacher Navigation Sidebar (Visible on lg: screens and above) */}
            <aside className="hidden lg:flex w-64 bg-white border-r-3 border-[#111111] flex-col shrink-0 p-4 space-y-3 z-20 shadow-[4px_0px_0px_#111111]">
              <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] flex items-center gap-2.5">
                <Component className="w-5 h-5 text-[#4D6BFE]" />
                <div>
                  <h2 className="font-black text-xs text-[#111111] uppercase tracking-wider">
                    Bảng Điều Hành GV
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

            {/* Mobile & Tablet Teacher Top Navigation (Visible on screens < lg) */}
            <div className="lg:hidden w-full bg-white border-b-2 border-[#111111] sticky top-[53px] sm:top-[57px] z-30 shadow-[0_3px_0px_#111111]">
              {/* Row 1: Current View Badge + Menu Toggle + Quick Logout */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#FFFFFF] border-b border-neutral-200">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setTeacherMobileMenuOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black text-xs uppercase shrink-0"
                    title="Mở toàn bộ danh mục chức năng"
                  >
                    <Menu className="w-4 h-4" />
                    <span>Menu GV</span>
                  </button>

                  {/* Active view indicator */}
                  <div className="flex items-center gap-1.5 min-w-0 pl-1">
                    {(() => {
                      const activeItem = teacherNavItems.find((t) => t.id === teacherSubView) || teacherNavItems[0];
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
                  title="Đăng xuất giáo viên"
                >
                  <Power className="w-3 h-3" />
                  <span className="hidden xs:inline">Thoát</span>
                </button>
              </div>

              {/* Row 2: Smooth Horizontal Scrollable Tabs */}
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

            {/* Mobile Drawer (Slide out menu from left) */}
            {teacherMobileMenuOpen && (
              <div className="fixed inset-0 z-50 flex lg:hidden">
                {/* Backdrop */}
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                  onClick={() => setTeacherMobileMenuOpen(false)}
                />

                {/* Drawer Content */}
                <div className="relative w-[85%] max-w-xs bg-white border-r-3 border-[#111111] shadow-[5px_0px_0px_#111111] flex flex-col p-4 z-50 h-full overflow-y-auto">
                  {/* Drawer Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-[#111111]">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#FFC93C] border-2 border-[#111111] shadow-[1px_1px_0px_#111111]">
                        <Component className="w-4 h-4 text-[#111111]" />
                      </div>
                      <div>
                        <h2 className="font-black text-xs text-[#111111] uppercase tracking-wider">
                          Bảng Điều Hành GV
                        </h2>
                        <p className="text-[9px] text-[#4D6BFE] font-black uppercase">Chế độ Di Động</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTeacherMobileMenuOpen(false)}
                      className="p-1.5 bg-neutral-100 hover:bg-neutral-200 border-2 border-[#111111] shadow-[1px_1px_0px_#111111] text-[#111111]"
                      title="Đóng menu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Navigation Links in Drawer */}
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

                  {/* Drawer Footer */}
                  <div className="pt-3 mt-3 border-t-2 border-[#111111]">
                    <button
                      type="button"
                      onClick={() => {
                        setTeacherMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 font-black text-xs uppercase text-white bg-[#E63946] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                      <Power className="w-4 h-4" /> Đăng Xuất GV
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Teacher Content View - 100% full width and fluid on mobile */}
            <div className="flex-1 w-full min-w-0 p-2.5 sm:p-4 lg:p-8 overflow-y-auto custom-scroll">
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
                <ExamsMain exams={exams} classes={classes} onRefresh={loadData} history={history} />
              )}

              {teacherSubView === 'students' && (
                <StudentsManager students={students} classes={classes} onRefresh={loadData} />
              )}

              {teacherSubView === 'history' && (
                <HistoryViewer history={history} classes={classes} onRefresh={loadData} exams={exams} />
              )}

              {teacherSubView === 'analytics' && (
                <QuestionAnalyticsModal
                  embedded={true}
                  exams={exams}
                  history={history}
                  availableClasses={classes}
                />
              )}
            </div>
          </div>
        )}

        {/* 3. LOGGED IN AS STUDENT / GUEST */}
        {currentUser && (currentUser.role === 'student' || currentUser.role === 'guest') && (
          <div className="w-full">
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
              // Default fallback: Always render LobbyView if not in active exam or result view
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
                    .filter((h) => (h.examTitle || '').trim().toLowerCase() === (ex.title || '').trim().toLowerCase() || (h.examId && h.examId === ex.id))
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
          </div>
        )}
      </main>
    </div>
  );
}
