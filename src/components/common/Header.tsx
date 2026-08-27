import React, { useState } from 'react';
import { School, Settings, LogOut, RefreshCw, UserCheck, ShieldCheck, User, Code, Copy, Check, ExternalLink } from 'lucide-react';
import { AppUser } from '../../types';
import { getApiUrl, setApiUrl, resetApiUrl, GOOGLE_APPS_SCRIPT_CODE } from '../../services/storageService';

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
  const [activeTab, setActiveTab] = useState<'api' | 'script'>('api');
  const [apiUrlInput, setApiUrlInput] = useState(getApiUrl());
  const [saveMsg, setSaveMsg] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

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

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
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
                THPT 2025
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 truncate hidden xs:block">
              Hệ thống khảo sát & đánh giá năng lực học sinh
            </p>
          </div>
        </div>

        {/* Right Section: User Pill, Sync & Settings */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-xl px-2.5 py-1 sm:py-1.5 shadow-inner">
              <div className="flex items-center gap-1.5 text-xs text-slate-200">
                {currentUser.role === 'teacher' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : currentUser.role === 'student' ? (
                  <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                ) : (
                  <User className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <div className="flex flex-col text-left leading-tight">
                  <span className="font-bold text-white text-[11px] sm:text-xs max-w-[100px] sm:max-w-[150px] truncate">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
                    {currentUser.role === 'teacher'
                      ? 'Giáo viên'
                      : currentUser.group
                      ? `Lớp: ${currentUser.group}`
                      : 'Khách'}
                  </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" /> Cấu Hình Đồng Bộ Dữ Liệu
              </h3>
              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('api')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    activeTab === 'api'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Kết Nối API
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('script')}
                  className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                    activeTab === 'script'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" /> Mã Code.gs
                </button>
              </div>
            </div>

            {activeTab === 'api' ? (
              <div className="space-y-4 overflow-y-auto">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Hệ thống tự động lưu trữ tức thì mọi thay đổi cấu hình đề thi, đáp án và danh sách học sinh vào bộ nhớ máy và đồng bộ lên Google Sheet qua Web App URL:
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

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                    <p className="font-bold text-slate-300">💡 Cơ chế lưu trữ đa tầng:</p>
                    <p>• Dữ liệu đề thi, phân lớp và học sinh luôn được ưu tiên lưu an toàn trong máy.</p>
                    <p>• Khi sửa cấu hình đề thi, hệ thống sẽ tự động cập nhật cả trên máy và Google Sheet mà không làm mất cấu hình đã lưu.</p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleResetSettings}
                      className="text-xs text-slate-400 hover:text-white underline"
                    >
                      Khôi phục URL mặc định
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
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Sao chép mã Apps Script này dán vào Google Sheet của bạn (Tiện ích mở rộng &gt; Apps Script):
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-md shadow-indigo-600/20"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? 'Đã sao chép!' : 'Sao chép mã'}
                  </button>
                </div>

                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-y-auto custom-scroll max-h-[350px]">
                  <pre className="text-[11px] font-mono text-indigo-300 leading-relaxed select-all">
                    {GOOGLE_APPS_SCRIPT_CODE}
                  </pre>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
