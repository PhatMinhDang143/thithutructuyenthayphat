import React, { useState } from 'react';
import { Fingerprint, KeyRound, Loader2, User } from 'lucide-react';
import { loginUser } from '../../services/storageService';
import { AppUser } from '../../types';

interface AdminAuthViewProps {
  onLoginSuccess: (user?: AppUser) => void;
}

export const AdminAuthView: React.FC<AdminAuthViewProps> = ({ onLoginSuccess }) => {
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await loginUser(adminUser.trim(), adminPass.trim());
      if (res.success && res.user && res.user.role === 'teacher') {
        onLoginSuccess(res.user);
      } else if (res.success && res.user && res.user.role !== 'teacher') {
        setErrorMsg('Tài khoản không có quyền truy cập trang Quản Trị Giáo Viên!');
      } else {
        setErrorMsg(res.error || 'Sai Tên Đăng Nhập hoặc Mật Khẩu Quản Trị Viên!');
      }
    } catch (err: any) {
      setErrorMsg('Không thể kết nối đến máy chủ xác thực.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#010409] p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-2xl border border-slate-800 relative z-10">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 p-4 rounded-2xl shadow-xl text-white mb-3">
            <Fingerprint className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-widest uppercase">TRANG GIÁO VIÊN / QUẢN TRỊ</h2>
          <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider mt-1">
            Xác thực máy chủ bảo mật & phân quyền JWT
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Tài Khoản Giáo Viên / Admin
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                required
                className="w-full p-3.5 pl-10 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl outline-none text-white font-bold text-sm transition-colors"
                placeholder="Tên đăng nhập (VD: Minhphat)"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Mật Mã Bảo Mật
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                required
                className="w-full p-3.5 pl-10 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl outline-none text-white font-bold text-sm tracking-widest transition-colors"
                placeholder="••••••••"
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
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-indigo-600/20 transition-all mt-4 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isLoading ? 'Đang xác thực bảo mật...' : 'Đăng Nhập Quản Trị'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-500">
          💡 Tài khoản quản trị mặc định: <code className="text-indigo-400 font-bold">Minhphat</code> / mật khẩu: <code className="text-indigo-400 font-bold">12345</code> (hoặc admin/admin)
        </div>
      </div>
    </div>
  );
};
