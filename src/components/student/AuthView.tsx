import React, { useState } from 'react';
import { User, KeyRound, Loader2, Users, GraduationCap, ArrowRight, LogIn } from 'lucide-react';
import { AppUser, StudentAccount } from '../../types';
import { loginUser } from '../../services/storageService';

interface AuthViewProps {
  studentsMap: { [username: string]: StudentAccount };
  onLoginSuccess: (user: AppUser) => void;
  onEnterAsGuest: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onLoginSuccess,
  onEnterAsGuest,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    try {
      const res = await loginUser(cleanUsername, cleanPassword);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMsg(res.error || 'Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại!');
      }
    } catch (err: any) {
      setErrorMsg('Không thể kết nối đến máy chủ xác thực. Vui lòng thử lại!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden bg-[#FDF6E9] text-[#111111]">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6 md:gap-8 relative z-10 my-auto">
        {/* Unified Login Card */}
        <div className="bg-white border-3 border-[#111111] p-6 md:p-10 shadow-[8px_8px_0px_#111111] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-[#111111]">
              <div className="p-3 bg-[#4D6BFE] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black uppercase text-[#111111] tracking-tight">
                  ĐĂNG NHẬP HỆ THỐNG
                </h2>
                <p className="text-neutral-700 text-xs md:text-sm font-bold">
                  Nhận diện <strong className="text-[#4D6BFE] underline">Học sinh</strong> & <strong className="text-[#111111] underline">Giáo viên</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-black text-[#111111] mb-1.5 uppercase tracking-wide">
                  Tài Khoản / Số Báo Danh (SBD)
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-5 h-5 text-neutral-600" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full p-3.5 pl-11 bg-[#FDF6E9] border-2 border-[#111111] text-[#111111] font-bold text-sm shadow-[3px_3px_0px_#111111] outline-none focus:bg-white transition-all"
                    placeholder="Nhập SBD học sinh hoặc Tài khoản GV..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#111111] mb-1.5 uppercase tracking-wide">
                  Mật Khẩu
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 w-5 h-5 text-neutral-600" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full p-3.5 pl-11 bg-[#FDF6E9] border-2 border-[#111111] text-[#111111] font-bold text-sm shadow-[3px_3px_0px_#111111] outline-none focus:bg-white transition-all"
                    placeholder="Nhập mật khẩu..."
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-[#FEECEE] border-2 border-[#E63946] text-[#E63946] text-xs font-black shadow-[2px_2px_0px_#E63946]">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] text-[#111111] py-4 border-3 border-[#111111] font-black uppercase tracking-wider text-sm transition-all mt-4 disabled:opacity-50 flex items-center justify-center gap-2 shadow-[5px_5px_0px_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#111111]"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                {isLoading ? 'Đang kiểm tra tài khoản...' : 'Đăng Nhập Ngay'}
              </button>
            </form>
          </div>
        </div>

        {/* Guest Option */}
        <div className="bg-white border-3 border-[#111111] p-6 md:p-10 shadow-[8px_8px_0px_#111111] flex flex-col justify-between">
          <div className="flex flex-col items-center text-center my-auto">
            <div className="bg-[#FDF6E9] p-5 border-2 border-[#111111] shadow-[3px_3px_0px_#111111] mb-4">
              <Users className="w-8 h-8 text-[#111111]" />
            </div>
            <h2 className="text-xl md:text-2xl font-black uppercase text-[#111111] mb-2">
              THI THỬ TỰ DO (KHÁCH)
            </h2>
            <p className="text-neutral-700 text-xs md:text-sm mb-6 font-bold leading-relaxed">
              Dành cho học sinh làm bài thi công khai chung mà không cần tài khoản chính thức.
              <br />
              <span className="text-[#E63946] font-black underline">Lưu ý:</span> Khách chỉ xem được các bài thi gán cho <strong>"Tất cả các lớp"</strong>.
            </p>
          </div>

          <button
            onClick={onEnterAsGuest}
            className="w-full bg-white hover:bg-[#FDF6E9] text-[#111111] border-3 border-[#111111] py-4 font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[5px_5px_0px_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#111111]"
          >
            Bắt đầu như Khách <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 text-center text-neutral-700 text-xs font-black">
        Hệ thống thi & phân lớp trực tuyến tự động • Phát triển bởi <strong className="text-[#4D6BFE] underline">Đặng Minh Phát</strong>
      </div>
    </div>
  );
};

