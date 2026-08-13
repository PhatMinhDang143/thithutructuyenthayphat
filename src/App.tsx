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

import { fetchAllData, submitExamResult } from './services/storageService';
import { LayoutDashboard, FileSpreadsheet, ShieldCheck, Activity, Power, Component } from 'lucide-react';

export default function App() {
  // Current logged in user (null = show Login screen)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

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

  // Data Loading
  const loadData = async () => {
    setLoading(true);
    const data = await fetchAllData();
    setExams(data.exams);
    setStudents(data.students);
    setHistory(data.history);
    setClasses(data.classes);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    setStudentSubView('lobby');
    setSelectedExam(null);
    setResultData(null);
    setTeacherSubView('dashboard');
  };

  // Calculate score and submit exam
  const handleExamSubmit = async (studentAnswers: StudentAnswers, cheatCount: number, exam: ExamItem) => {
    if (!currentUser) return;

    const cfg = exam.questions || {};
    const key = exam.answers || { p1: {}, p2: {}, p3: {} };

    let rawScore = 0;
    let correctCount = 0;

    // Part I
    for (let i = 1; i <= (cfg.num_p1 || 0); i++) {
      const sAns = studentAnswers.p1[i] || '';
      const cAns = key.p1?.[i] || '';
      if (sAns && cAns && String(sAns).trim().toUpperCase() === String(cAns).trim().toUpperCase()) {
        rawScore += 0.25;
        correctCount++;
      }
    }

    // Part II
    for (let i = 1; i <= (cfg.num_p2 || 0); i++) {
      let correctSubs = 0;
      (['a', 'b', 'c', 'd'] as const).forEach((sub) => {
        const sAns = studentAnswers.p2[i]?.[sub];
        const cAns = key.p2?.[i]?.[sub];
        if (sAns && cAns && String(sAns).trim().toUpperCase() === String(cAns).trim().toUpperCase()) {
          correctSubs++;
        }
      });

      if (correctSubs === 1) rawScore += 0.1;
      else if (correctSubs === 2) rawScore += 0.25;
      else if (correctSubs === 3) rawScore += 0.5;
      else if (correctSubs === 4) {
        rawScore += 1.0;
        correctCount++;
      }
    }

    // Part III
    for (let i = 1; i <= (cfg.num_p3 || 0); i++) {
      const sAns = studentAnswers.p3[i] || '';
      const cAns = key.p3?.[i] || '';
      if (sAns && cAns && String(sAns).trim().toLowerCase() === String(cAns).trim().toLowerCase()) {
        rawScore += 0.5;
        correctCount++;
      }
    }

    const maxPossibleRawScore = (cfg.num_p1 || 0) * 0.25 + (cfg.num_p2 || 0) * 1.0 + (cfg.num_p3 || 0) * 0.5;
    let finalScore = maxPossibleRawScore > 0 ? (rawScore / maxPossibleRawScore) * 10 : 0;
    finalScore = Number(finalScore.toFixed(2));

    const payload: ExamSubmission = {
      username: currentUser.username,
      name: currentUser.name,
      group: currentUser.group,
      examTitle: exam.title,
      score: finalScore,
      correct: correctCount,
      cheat: `${cheatCount} lần`,
      submitted_at: new Date().toLocaleString('vi-VN'),
      details: studentAnswers,
    };

    setResultData(payload);
    setStudentSubView('result');

    // Submit and sync
    await submitExamResult(payload);
    const updatedData = await fetchAllData();
    setHistory(updatedData.history);

    // Compute leaderboard for this exam
    const examLeaderboard = updatedData.history
      .filter((h) => h.examTitle === exam.title)
      .sort((a, b) => b.score - a.score);

    setLeaderboard(examLeaderboard);
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        onRefreshData={loadData}
      />

      <main className="flex-1">
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
          <div className="flex w-full min-h-[calc(100vh-65px)] overflow-hidden">
            {/* Teacher Navigation Sidebar */}
            <aside className="w-64 bg-slate-950/80 border-r border-slate-900 flex flex-col shrink-0 p-4 space-y-2 z-20">
              <div className="p-3 mb-2 bg-gradient-to-r from-indigo-950 to-slate-900 border border-indigo-900/50 rounded-xl flex items-center gap-2.5">
                <Component className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="font-extrabold text-xs text-white uppercase tracking-wider">
                    Bảng Điều Hành GV
                  </h2>
                  <p className="text-[10px] text-cyan-400 font-semibold uppercase">Management Console</p>
                </div>
              </div>

              <nav className="flex-1 space-y-1.5">
                <button
                  onClick={() => setTeacherSubView('dashboard')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                    teacherSubView === 'dashboard'
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" /> Trang Tổng Quan
                </button>

                <button
                  onClick={() => setTeacherSubView('exams')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                    teacherSubView === 'exams'
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" /> Kho Đề Thi & Phân Lớp
                </button>

                <button
                  onClick={() => setTeacherSubView('students')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                    teacherSubView === 'students'
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" /> Quản Lý Học Sinh & Lớp
                </button>

                <button
                  onClick={() => setTeacherSubView('history')}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                    teacherSubView === 'history'
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Activity className="w-4 h-4" /> Nhật Ký Nộp Bài & Điểm
                </button>
              </nav>

              <div className="pt-2 border-t border-slate-900">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs uppercase text-rose-400 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 transition-all"
                >
                  <Power className="w-4 h-4" /> Đăng xuất Giáo Viên
                </button>
              </div>
            </aside>

            {/* Teacher Content View */}
            <div className="flex-1 p-6 overflow-y-auto custom-scroll">
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
