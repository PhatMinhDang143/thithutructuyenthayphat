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
    <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b-2 border-[#111111] px-3 sm:px-6 py-2.5 shadow-[0_2px_0px_#111111]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] shrink-0 font-black">
            <School className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-sm sm:text-base text-[#111111] uppercase tracking-tight truncate">
                Hệ Thống Thi Trực Tuyến
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-black px-1.5 py-0.5 bg-[#4D6BFE] text-white border border-[#111111] shadow-[1px_1px_0px_#111111] shrink-0">
                THPT 2026
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-neutral-600 font-semibold truncate hidden xs:block">
              Nền tảng kiểm tra & đánh giá năng lực học sinh
            </p>
          </div>
        </div>

        {/* Right Section: User Pill, Sync & Settings */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-2 bg-[#FDF6E9] border-2 border-[#111111] px-2.5 py-1 sm:py-1.5 shadow-[2px_2px_0px_#111111]">
              <div className="flex items-center gap-1.5 text-xs text-[#111111]">
                {currentUser.role === 'teacher' ? (
                  <div className="p-1 bg-[#0F9D58] text-white border border-[#111111]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                ) : currentUser.role === 'student' ? (
                  <div className="p-1 bg-[#4D6BFE] text-white border border-[#111111]">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="p-1 bg-[#FFC93C] text-[#111111] border border-[#111111]">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="flex flex-col text-left leading-tight">
                  <span className="font-extrabold text-[#111111] text-[11px] sm:text-xs max-w-[100px] sm:max-w-[150px] truncate">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-neutral-600 font-bold">
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
                className="p-1 text-neutral-700 hover:text-white hover:bg-[#E63946] border border-transparent hover:border-[#111111] transition-all ml-1"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-[#111111] font-bold px-2.5 py-1 bg-[#FDF6E9] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
              Khách
            </span>
          )}

          {/* Sync Button */}
          <button
            type="button"
            onClick={onRefreshData}
            className="p-2 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="Đồng bộ dữ liệu từ Google Sheet"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="Cấu hình Google Apps Script API"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#FFFFFF] border-3 border-[#111111] max-w-2xl w-full p-5 sm:p-6 shadow-[8px_8px_0px_#111111] relative flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-4">
              <h3 className="text-base sm:text-lg font-black text-[#111111] uppercase tracking-tight flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#4D6BFE]" /> Cấu Hình Đồng Bộ Dữ Liệu
              </h3>
              <div className="flex gap-1 bg-[#FDF6E9] p-1 border-2 border-[#111111] text-xs font-black">
                <button
                  type="button"
                  onClick={() => setActiveTab('api')}
                  className={`px-3 py-1 font-black transition-all ${
                    activeTab === 'api'
                      ? 'bg-[#4D6BFE] text-white border border-[#111111] shadow-[1px_1px_0px_#111111]'
                      : 'text-neutral-700 hover:text-[#111111]'
                  }`}
                >
                  Kết Nối API
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('script')}
                  className={`px-3 py-1 font-black flex items-center gap-1.5 transition-all ${
                    activeTab === 'script'
                      ? 'bg-[#4D6BFE] text-white border border-[#111111] shadow-[1px_1px_0px_#111111]'
                      : 'text-neutral-700 hover:text-[#111111]'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" /> Mã Code.gs
                </button>
              </div>
            </div>

            {activeTab === 'api' ? (
              <div className="space-y-4 overflow-y-auto">
                <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                  Hệ thống tự động lưu trữ tức thì mọi thay đổi cấu hình đề thi, đáp án và danh sách học sinh vào bộ nhớ máy và đồng bộ lên Google Sheet qua Web App URL:
                </p>

                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-[#111111] uppercase mb-1">
                      Đường dẫn Web App API (API_URL)
                    </label>
                    <input
                      type="text"
                      value={apiUrlInput}
                      onChange={(e) => setApiUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full p-3 bg-[#FDF6E9] border-2 border-[#111111] text-xs text-[#111111] font-mono outline-none focus:bg-white shadow-[2px_2px_0px_#111111]"
                    />
                  </div>

                  {saveMsg && (
                    <div className="p-3 bg-[#0F9D58] text-white border-2 border-[#111111] text-xs font-bold shadow-[2px_2px_0px_#111111]">
                      {saveMsg}
                    </div>
                  )}

                  <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] text-xs text-neutral-800 space-y-1 shadow-[2px_2px_0px_#111111]">
                    <p className="font-black text-[#111111]">💡 Cơ chế lưu trữ đa tầng:</p>
                    <p>• Dữ liệu đề thi, phân lớp và học sinh luôn được ưu tiên lưu an toàn trong máy.</p>
                    <p>• Khi sửa cấu hình đề thi, hệ thống sẽ tự động cập nhật cả trên máy và Google Sheet mà không làm mất cấu hình đã lưu.</p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleResetSettings}
                      className="text-xs font-bold text-neutral-700 hover:text-[#111111] underline"
                    >
                      Khôi phục URL mặc định
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSettings(false)}
                        className="px-4 py-2 bg-[#FDF6E9] hover:bg-neutral-200 text-[#111111] border-2 border-[#111111] text-xs font-black shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px]"
                      >
                        Đóng
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] text-xs font-black shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px]"
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
                  <p className="text-xs text-neutral-700 font-medium">
                    Sao chép mã Apps Script này dán vào Google Sheet của bạn (Tiện ích mở rộng &gt; Apps Script):
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="px-3 py-1.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] text-xs font-black flex items-center gap-1.5 shrink-0 shadow-[2px_2px_0px_#111111]"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-[#0F9D58]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? 'Đã sao chép!' : 'Sao chép mã'}
                  </button>
                </div>

                <div className="flex-1 bg-[#111111] border-2 border-[#111111] p-3 overflow-y-auto custom-scroll max-h-[350px]">
                  <pre className="text-[11px] font-mono text-[#FFC93C] leading-relaxed select-all">
                    {GOOGLE_APPS_SCRIPT_CODE}
                  </pre>
                </div>

                <div className="flex justify-end pt-2 border-t-2 border-[#111111]">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 bg-[#FDF6E9] hover:bg-neutral-200 text-[#111111] border-2 border-[#111111] text-xs font-black shadow-[2px_2px_0px_#111111]"
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

