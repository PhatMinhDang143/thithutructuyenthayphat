import React, { useState } from 'react';
import { User, KeyRound, Loader2, Users, GraduationCap, ArrowRight, Sparkles } from 'lucide-react';
import { AppUser, StudentAccount } from '../../types';

interface AuthViewProps {
  studentsMap: { [username: string]: StudentAccount };
  onLoginSuccess: (user: AppUser) => void;
  onEnterAsGuest: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  studentsMap,
  onLoginSuccess,
  onEnterAsGuest,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    setTimeout(() => {
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();

      // 1. Check if Teacher / Admin Login
      const isTeacherUser = ['minhphat', 'admin', 'giaovien', 'teacher'].includes(cleanUsername.toLowerCase());
      const isTeacherPass = ['12345', 'admin', '123'].includes(cleanPassword);

      if (isTeacherUser && isTeacherPass) {
        onLoginSuccess({
          username: cleanUsername,
          name: 'Đặng Minh Phát',
          group: 'Giáo Viên Quản Trị',
          role: 'teacher',
        });
        setIsLoading(false);
        return;
      }

      // 2. Check Student Login
      const foundStudent = studentsMap[cleanUsername];
      if (foundStudent) {
        if (!foundStudent.password || foundStudent.password === cleanPassword) {
          onLoginSuccess({
            username: foundStudent.username,
            name: foundStudent.name,
            group: foundStudent.group || 'Chưa phân lớp',
            role: 'student',
          });
          setIsLoading(false);
          return;
        }
      }

      setErrorMsg('Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!');
      setIsLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden bg-[#0f172a]">
      {/* Ambient background light */}
      <div className="absolute top-10 left-1/4 w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-[450px] h-[450px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 md:gap-8 relative z-10 my-auto">
        {/* Unified Login Card */}
        <div className="glass-panel p-6 md:p-10 rounded-[2rem] shadow-2xl border-t-4 border-indigo-500 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold uppercase text-white tracking-tight flex items-center gap-2">
                  ĐĂNG NHẬP HỆ THỐNG
                </h2>
                <p className="text-slate-400 text-xs md:text-sm">
                  Tự động nhận diện tài khoản <strong className="text-indigo-400">Học sinh</strong> hoặc <strong className="text-cyan-400">Giáo viên</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                  Tài Khoản / SBD
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-4 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full p-4 pl-12 bg-slate-800/90 border border-slate-700 rounded-xl outline-none focus:border-indigo-500 text-white font-medium text-sm transition-all"
                    placeholder="Nhập SBD học sinh hoặc Tài khoản GV..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                  Mật Khẩu
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-4 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full p-4 pl-12 bg-slate-800/90 border border-slate-700 rounded-xl outline-none focus:border-indigo-500 text-white font-medium text-sm transition-all"
                    placeholder="Nhập mật khẩu..."
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-400 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-4 rounded-xl font-bold uppercase tracking-wider transition-all mt-3 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {isLoading ? 'Đang kiểm tra tài khoản...' : 'Đăng Nhập'}
              </button>
            </form>
          </div>
        </div>

        {/* Guest Option */}
        <div className="glass-panel p-6 md:p-10 rounded-[2rem] flex flex-col justify-between border-t-4 border-slate-600">
          <div className="flex flex-col items-center text-center my-auto">
            <div className="bg-slate-800 p-5 rounded-2xl mb-4 border border-slate-700">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold uppercase text-white mb-2">
              THI THỬ TỰ DO (KHÁCH)
            </h2>
            <p className="text-slate-400 text-xs md:text-sm mb-6 leading-relaxed">
              Dành cho học sinh làm bài thi công khai chung mà không cần tài khoản chính thức.
              <br />
              <span className="text-amber-400 font-medium">Lưu ý:</span> Khách chỉ xem được các bài thi gán cho <strong>"Tất cả các lớp"</strong>.
            </p>
          </div>

          <button
            onClick={onEnterAsGuest}
            className="w-full border-2 border-slate-600 hover:border-slate-400 hover:bg-slate-800 py-4 rounded-xl font-bold uppercase tracking-wider text-slate-200 transition-all flex items-center justify-center gap-2"
          >
            Bắt đầu như Khách <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 text-center text-slate-500 text-xs">
        Hệ thống thi & phân lớp trực tuyến tự động • Phát triển bởi <strong className="text-indigo-400">Đặng Minh Phát</strong>
      </div>
    </div>
  );
};
