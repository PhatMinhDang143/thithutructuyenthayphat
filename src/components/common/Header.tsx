import React, { useState } from 'react';
import { School, Settings, LogOut, RefreshCw, UserCheck, ShieldCheck, User } from 'lucide-react';
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
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/30 shrink-0">
            <School className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-sm sm:text-base text-white uppercase tracking-tight truncate">
                Hệ Thống Thi Trực Tuyến
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block truncate">
              Phân quyền thông minh Học Sinh &amp; Giáo Viên
            </p>
          </div>
        </div>

        {/* User Status & Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {currentUser ? (
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl pl-2 sm:pl-3 pr-1.5 py-1 gap-2 shadow-inner">
              <div className="flex items-center gap-1.5 min-w-0">
                {currentUser.role === 'teacher' ? (
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                ) : (
                  <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                )}
                <div className="text-left hidden xs:block">
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[90px] sm:max-w-[120px]">
                    {currentUser.name}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-indigo-400 leading-tight">
                    {currentUser.role === 'teacher' ? 'Giáo Viên' : `Lớp: ${currentUser.group || 'Khách'}`}
                  </p>
                </div>
              </div>

              {/* Quick Logout Button */}
              <button
                type="button"
                onClick={onLogout}
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium px-2.5 py-1 bg-slate-800/50 rounded-lg border border-slate-700/50">
              Khách
            </span>
          )}

          {/* Sync Button */}
          <button
            type="button"
            onClick={onRefreshData}
            className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded-xl transition-colors border border-slate-700/50"
            title="Đồng bộ dữ liệu từ Google Sheet"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded-xl transition-colors border border-slate-700/50"
            title="Cấu hình Google Apps Script API"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative">
            <h3 className="text-base sm:text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" /> Cấu Hình Google Apps Script API
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Nếu bạn đã triển khai Google Apps Script cho Google Sheet của riêng bạn, hãy dán đường link <code>/exec</code> vào đây:
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
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30"
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
