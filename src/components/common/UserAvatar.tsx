import React, { useState } from 'react';
import { getAvatarPreset, getInitialsColor, extractInitials } from '../../utils/avatarUtils';

interface UserAvatarProps {
  avatar?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showBorder?: boolean;
  rankBadge?: number;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar,
  name = 'Học sinh',
  size = 'md',
  className = '',
  showBorder = true,
  rankBadge,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-18 h-18 text-xl',
    '2xl': 'w-24 h-24 text-2xl',
  };

  const borderClass = showBorder ? 'border-2 border-[#111111] shadow-[2px_2px_0px_#111111]' : '';

  const preset = getAvatarPreset(avatar);
  const isCustomImage = avatar && (avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://')) && !imgError;

  const initials = extractInitials(name);
  const bgColor = getInitialsColor(name);

  return (
    <div className={`relative inline-flex shrink-0 select-none ${className}`}>
      <div
        className={`${sizeClasses[size]} overflow-hidden flex items-center justify-center font-black transition-transform ${borderClass}`}
        style={{
          backgroundColor: preset ? preset.bg : isCustomImage ? '#FFFFFF' : bgColor,
        }}
      >
        {isCustomImage ? (
          <img
            src={avatar}
            alt={name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : preset ? (
          <div className="w-full h-full p-0.5 flex items-center justify-center">
            {preset.svg('w-full h-full')}
          </div>
        ) : (
          <span className="text-white uppercase tracking-wider font-black select-none">
            {initials}
          </span>
        )}
      </div>

      {/* Rank indicator badge for Top 1, 2, 3 */}
      {rankBadge !== undefined && rankBadge > 0 && rankBadge <= 3 && (
        <span
          className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-none border border-[#111111] flex items-center justify-center text-[10px] font-black shadow-[1px_1px_0px_#111111] ${
            rankBadge === 1
              ? 'bg-[#FFC93C] text-[#111111]'
              : rankBadge === 2
              ? 'bg-[#E5E7EB] text-[#111111]'
              : 'bg-[#FED7AA] text-[#7C2D12]'
          }`}
          title={`Hạng ${rankBadge}`}
        >
          {rankBadge === 1 ? '1' : rankBadge === 2 ? '2' : '3'}
        </span>
      )}
    </div>
  );
};
