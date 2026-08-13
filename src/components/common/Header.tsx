import React, { useState } from 'react';
import { School, Settings, LogOut, RefreshCw, UserCheck, ShieldCheck } from 'lucide-react';
import { AppUser } from '../../types';
import { getApiUrl, setApiUrl, resetApiUrl } from '../../services/storageService';

interface HeaderProps {
  currentUser: AppUser | null;
  onLogout: () => void;
  onRefreshData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onRefreshData,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrlInput, setApiUrlInput] = useState(getApiUrl());
  const [saveMsg, setSaveMsg] = useState('');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setApiUrl(apiUrlInput);
    setSaveMsg('Đã lưu cấu hình Google Apps Script API!');
    setTimeout(() => setSaveMsg(''), 2500);
    onRefreshData();
  };

  const handleResetSettings = () => {
    resetApiUrl();
    setApiUrlInput(getApiUrl());
    setSaveMsg('Đã khôi phục về URL mặc định!');
    setTimeout(() => setSaveMsg(''), 2500);
    onRefreshData();
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/30">
            <School className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-base md:text-lg text-white uppercase tracking-tight flex items-center gap-2">
              Hệ Thống Thi & Phân Lớp <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">PRO</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Tự động phân quyền Học Sinh / Giáo Viên khi đăng nhập
            </p>
          </div>
        </div>

        {/* User Badge, Refresh & Settings */}
        <div className="flex items-center gap-2.5">
          {currentUser ? (
            <div className="flex items-center gap-3 bg-slate-800/90 px-3.5 py-1.5 rounded-xl border border-slate-700/80 shadow-inner">
              <div className="flex items-center gap-2">
                {currentUser.role === 'teacher' ? (
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                ) : (
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                )}
                <div className="text-left">
                  <p className="text-xs font-bold text-white leading-snug">{currentUser.name}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {currentUser.role === 'teacher' ? (
                      <span className="text-cyan-400">Giáo Viên Quản Trị</span>
                    ) : (
                      <span className="text-indigo-400">Lớp: {currentUser.group || 'Khách'}</span>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1 flex items-center gap-1 text-xs font-semibold"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-semibold px-3 py-1 bg-slate-800/50 rounded-lg border border-slate-700/50">
              Chưa đăng nhập
            </div>
          )}

          <button
            onClick={onRefreshData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700/50"
            title="Đồng bộ dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700/50"
            title="Cấu hình Web App API"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal for API_URL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" /> Cấu Hình Google Apps Script API
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Nếu bạn đã triển khai Google Apps Script cho Google Sheet của riêng bạn, hãy dán đường link <code>exec</code> vào đây:
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Đường dẫn Web App API (API_URL)
                </label>
                <input
                  type="text"
                  value={apiUrlInput}
                  onChange={(e) => setApiUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-indigo-300 font-mono outline-none focus:border-indigo-500"
                />
              </div>

              {saveMsg && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-emerald-400 text-xs font-semibold">
                  {saveMsg}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetSettings}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Khôi phục URL gốc
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                  >
                    Lưu Thay Đổi
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
