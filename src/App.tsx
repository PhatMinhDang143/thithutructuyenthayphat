import React, { useState, useEffect } from 'react';
import { AppUser, ExamItem, ExamSubmission, StudentAnswers } from './types';
import { Header } from './components/common/Header';
import { AuthView } from './components/student/AuthView';
import { LobbyView } from './components/student/LobbyView';
import { ExamView } from './components/student/ExamView';
import { ResultView } from './components/student/ResultView';

import { DashboardView } from './components/teacher/DashboardView';
import { ExamsMain } from './components/teacher/ExamsMain';
import { StudentsManager } from './components/teacher/StudentsManager';
import { HistoryViewer } from './components/teacher/HistoryViewer';

import { fetchAllData, submitExamResult, submitExamAnswersToServer, getStoredCurrentUser, logoutUser } from './services/storageService';
import { LayoutDashboard, FileSpreadsheet, ShieldCheck, Activity, Power, Component } from 'lucide-react';

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
  const [teacherSubView, setTeacherSubView] = useState<'dashboard' | 'exams' | 'students' | 'history'>('dashboard');

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
  const handleExamSubmit = async (studentAnswers: StudentAnswers, cheatCount: number, exam: ExamItem) => {
    if (!currentUser) return;

    setLoading(true);

    // Send raw student answers to the server. The server computes the score securely from its hidden answer key.
    const res = await submitExamAnswersToServer({
      examId: exam.id,
      examTitle: exam.title,
      username: currentUser.username,
      name: currentUser.name,
      group: currentUser.group,
      studentAnswers,
      cheatCount,
    });

    setLoading(false);

    if (res.success && res.submission) {
      const serverGradedSubmission = res.submission;
      setResultData(serverGradedSubmission);
      setStudentSubView('result');

      // Refresh history
      const updatedData = await fetchAllData(currentUser.role);
      setHistory(updatedData.history);

      // Compute leaderboard for this exam
      const examLeaderboard = updatedData.history
        .filter((h) => h.examTitle === exam.title)
        .sort((a, b) => b.score - a.score);

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
        group: currentUser.group,
        examTitle: exam.title,
        score: 0,
        correct: 0,
        cheat: `${cheatCount} lần`,
        submitted_at: new Date().toLocaleString('vi-VN'),
        details: studentAnswers,
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
          <div className="flex w-full min-h-[calc(100dvh-65px)] overflow-hidden bg-[#FDF6E9] text-[#111111]">
            {/* Teacher Navigation Sidebar */}
            <aside className="w-64 bg-white border-r-3 border-[#111111] flex flex-col shrink-0 p-4 space-y-3 z-20 shadow-[4px_0px_0px_#111111]">
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
                <button
                  onClick={() => setTeacherSubView('dashboard')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 font-black text-xs uppercase tracking-wider transition-all border-2 border-[#111111] ${
                    teacherSubView === 'dashboard'
                      ? 'bg-[#FFC93C] text-[#111111] shadow-[3px_3px_0px_#111111] translate-x-1'
                      : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] hover:text-[#111111]'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-[#111111]" /> Trang Tổng Quan
                </button>

                <button
                  onClick={() => setTeacherSubView('exams')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 font-black text-xs uppercase tracking-wider transition-all border-2 border-[#111111] ${
                    teacherSubView === 'exams'
                      ? 'bg-[#FFC93C] text-[#111111] shadow-[3px_3px_0px_#111111] translate-x-1'
                      : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] hover:text-[#111111]'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#111111]" /> Kho Đề Thi & Phân Lớp
                </button>

                <button
                  onClick={() => setTeacherSubView('students')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 font-black text-xs uppercase tracking-wider transition-all border-2 border-[#111111] ${
                    teacherSubView === 'students'
                      ? 'bg-[#FFC93C] text-[#111111] shadow-[3px_3px_0px_#111111] translate-x-1'
                      : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] hover:text-[#111111]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-[#111111]" /> Học Sinh & Phân Lớp
                </button>

                <button
                  onClick={() => setTeacherSubView('history')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 font-black text-xs uppercase tracking-wider transition-all border-2 border-[#111111] ${
                    teacherSubView === 'history'
                      ? 'bg-[#FFC93C] text-[#111111] shadow-[3px_3px_0px_#111111] translate-x-1'
                      : 'bg-white text-neutral-700 hover:bg-[#FDF6E9] hover:text-[#111111]'
                  }`}
                >
                  <Activity className="w-4 h-4 text-[#111111]" /> Nhật Ký Nộp & Điểm
                </button>
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

            {/* Teacher Content View */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scroll">
              {teacherSubView === 'dashboard' && (
                <DashboardView exams={exams} students={students} history={history} classes={classes} />
              )}

              {teacherSubView === 'exams' && (
                <ExamsMain exams={exams} classes={classes} onRefresh={loadData} />
              )}

              {teacherSubView === 'students' && (
                <StudentsManager students={students} classes={classes} onRefresh={loadData} />
              )}

              {teacherSubView === 'history' && (
                <HistoryViewer history={history} classes={classes} onRefresh={loadData} />
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
                onSelectExam={(ex) => {
                  setSelectedExam(ex);
                  setStudentSubView('exam');
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
