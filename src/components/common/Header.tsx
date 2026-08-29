import React, { useState } from 'react';
import { School, Settings, LogOut, RefreshCw, UserCheck, ShieldCheck, User, Palette } from 'lucide-react';
import { AppUser } from '../../types';
import { ThemeSettingsModal } from './ThemeSettingsModal';

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
  const [showThemeModal, setShowThemeModal] = useState(false);

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

        {/* Right Section: User Pill, Sync & Appearance Settings */}
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
            title="Làm mới dữ liệu & đồng bộ hệ thống"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Appearance Settings Button (Customization for students & users) */}
          <button
            type="button"
            onClick={() => setShowThemeModal(true)}
            className="p-2 bg-white hover:bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-1.5"
            title="Tùy chỉnh giao diện & màu sắc học tập"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Theme & Appearance Customization Modal */}
      <ThemeSettingsModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
    </header>
  );
};
