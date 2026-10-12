import React, { useState } from 'react';
import { School, Settings, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { AppUser } from '../../types';
import { ThemeSettingsModal } from './ThemeSettingsModal';
import { AvatarPickerModal } from './AvatarPickerModal';
import { UserAvatar } from './UserAvatar';

interface HeaderProps {
  currentUser: AppUser | null;
  onLogout: () => void;
  onRefreshData: () => void;
  onUpdateAvatar?: (newAvatar: string) => Promise<void> | void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onRefreshData,
  onUpdateAvatar,
}) => {
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const isStudentOrGuest = currentUser && (currentUser.role === 'student' || currentUser.role === 'guest');

  return (
    <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b-2 border-[#111111] px-3 sm:px-6 py-2.5 shadow-[0_2px_0px_#111111]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Wordmark */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] shrink-0 font-black">
            <School className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-xs sm:text-base text-[#111111] uppercase tracking-tight truncate">
                <span className="hidden sm:inline">Hệ Thống Thi Trực Tuyến</span>
                <span className="sm:hidden">Thi Trực Tuyến</span>
              </h1>
              <span className="hidden md:inline-block text-[10px] font-black px-1.5 py-0.5 bg-[#4D6BFE] text-white border border-[#111111] shadow-[1px_1px_0px_#111111] shrink-0">
                THPT 2026
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-neutral-600 font-semibold truncate hidden md:block">
              Nền tảng kiểm tra & đánh giá năng lực học sinh
            </p>
          </div>
        </div>

        {/* Right Section: User Badge, Sync & Appearance Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {currentUser ? (
            <div className="flex items-center gap-1 sm:gap-2 bg-[#FDF6E9] border-2 border-[#111111] px-1.5 sm:px-2.5 py-1 sm:py-1.5 shadow-[2px_2px_0px_#111111]">
              {/* User Avatar + Name */}
              <div
                onClick={() => {
                  if (isStudentOrGuest && onUpdateAvatar) {
                    setShowAvatarModal(true);
                  }
                }}
                className={`flex items-center gap-1.5 sm:gap-2 text-xs text-[#111111] ${
                  isStudentOrGuest ? 'cursor-pointer hover:opacity-90 group' : ''
                }`}
                title={isStudentOrGuest ? 'Bấm để đổi ảnh đại diện' : undefined}
              >
                {currentUser.role === 'teacher' ? (
                  <div className="p-1 bg-[#0F9D58] text-white border border-[#111111] shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="relative">
                    <UserAvatar
                      avatar={currentUser.avatar}
                      name={currentUser.name}
                      size="sm"
                      showBorder={true}
                    />
                  </div>
                )}

                <div className="flex flex-col text-left leading-tight min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-black text-[#111111] text-[10px] sm:text-xs max-w-[80px] xs:max-w-[120px] sm:max-w-[160px] truncate">
                      {currentUser.name}
                    </span>
                    {isStudentOrGuest && (
                      <span className="hidden lg:inline text-[9px] text-[#4D6BFE] font-bold underline">
                        Đổi avatar
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] sm:text-[10px] text-neutral-600 font-bold truncate">
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
                className="p-1 text-neutral-700 hover:text-white hover:bg-[#E63946] border border-transparent hover:border-[#111111] transition-all ml-0.5 sm:ml-1 cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-[#111111] font-bold px-2 py-1 bg-[#FDF6E9] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
              Khách
            </span>
          )}

          {/* Sync Button */}
          <button
            type="button"
            onClick={onRefreshData}
            className="p-1.5 sm:p-2 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all shrink-0 cursor-pointer"
            title="Làm mới dữ liệu & đồng bộ hệ thống"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Appearance Settings Button */}
          <button
            type="button"
            onClick={() => setShowThemeModal(true)}
            className="p-1.5 sm:p-2 bg-white hover:bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Tùy chỉnh giao diện học tập"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Theme & Appearance Customization Modal */}
      <ThemeSettingsModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />

      {/* Avatar Picker Modal */}
      {currentUser && (
        <AvatarPickerModal
          isOpen={showAvatarModal}
          currentUser={currentUser}
          onClose={() => setShowAvatarModal(false)}
          onSaveAvatar={async (newAvatar) => {
            if (onUpdateAvatar) {
              await onUpdateAvatar(newAvatar);
            }
          }}
        />
      )}
    </header>
  );
};
