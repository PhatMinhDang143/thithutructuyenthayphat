import React from 'react';

export interface AvatarPreset {
  id: string;
  name: string;
  tag: string;
  bg: string;
  borderColor: string;
  badgeBg: string;
  svg: (className?: string) => React.ReactElement;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'scholar',
    name: 'Học Giả',
    tag: 'Chăm học',
    bg: '#4D6BFE',
    borderColor: '#111111',
    badgeBg: '#FFC93C',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#4D6BFE" />
        {/* Cap */}
        <polygon points="24,11 39,18 24,25 9,18" fill="#FFFFFF" stroke="#111111" strokeWidth="2" strokeLinejoin="round" />
        <path d="M16 22V29C16 32 20 35 24 35C28 35 32 32 32 29V22" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        {/* Tassel */}
        <path d="M35 19.5V28" stroke="#FFC93C" strokeWidth="2" strokeLinecap="round" />
        <circle cx="35" cy="29" r="1.5" fill="#FFC93C" />
      </svg>
    ),
  },
  {
    id: 'champion',
    name: 'Thủ Khoa',
    tag: 'Top 1',
    bg: '#FFC93C',
    borderColor: '#111111',
    badgeBg: '#111111',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#FFC93C" />
        {/* Trophy */}
        <path d="M15 15H33V22C33 27 29 31 24 31C19 31 15 27 15 22V15Z" fill="#FFFFFF" stroke="#111111" strokeWidth="2" />
        <path d="M15 18H11C9.5 18 8.5 19.5 9 21C9.5 22.5 11.5 24 15 24" stroke="#111111" strokeWidth="2" strokeLinecap="round" />
        <path d="M33 18H37C38.5 18 39.5 19.5 39 21C38.5 22.5 36.5 24 33 24" stroke="#111111" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 31V37" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="18" y="37" width="12" height="3" rx="1.5" fill="#111111" />
        <circle cx="24" cy="22" r="2" fill="#FFC93C" />
      </svg>
    ),
  },
  {
    id: 'scientist',
    name: 'Khoa Học',
    tag: 'Khám phá',
    bg: '#0F9D58',
    borderColor: '#111111',
    badgeBg: '#FFC93C',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#0F9D58" />
        {/* Flask */}
        <path d="M21 11H27" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M22 11V18L13 34C12 36 13.5 38 16 38H32C34.5 38 36 36 35 34L26 18V11" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
        <path d="M16 32L32 32" stroke="#FFC93C" strokeWidth="3" strokeLinecap="round" />
        <circle cx="21" cy="28" r="1.5" fill="#FFFFFF" />
        <circle cx="27" cy="25" r="1" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'sprinter',
    name: 'Bứt Phá',
    tag: 'Tốc độ',
    bg: '#E63946',
    borderColor: '#111111',
    badgeBg: '#FFC93C',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#E63946" />
        {/* Lightning bolt */}
        <polygon points="26,8 14,24 23,24 20,40 34,22 25,22" fill="#FFC93C" stroke="#111111" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'owl',
    name: 'Cú Trí Tuệ',
    tag: 'Sâu sắc',
    bg: '#374151',
    borderColor: '#111111',
    badgeBg: '#FFC93C',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#374151" />
        {/* Owl face */}
        <ellipse cx="24" cy="25" rx="13" ry="12" fill="#FFFFFF" />
        {/* Big eyes */}
        <circle cx="19" cy="23" r="5" fill="#FFC93C" stroke="#111111" strokeWidth="1.5" />
        <circle cx="19" cy="23" r="2" fill="#111111" />
        <circle cx="29" cy="23" r="5" fill="#FFC93C" stroke="#111111" strokeWidth="1.5" />
        <circle cx="29" cy="23" r="2" fill="#111111" />
        {/* Beak */}
        <polygon points="24,26 21,30 27,30" fill="#E63946" />
        {/* Eyebrows */}
        <path d="M14 17L22 19" stroke="#111111" strokeWidth="2" strokeLinecap="round" />
        <path d="M34 17L26 19" stroke="#111111" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'target',
    name: 'Mục Tiêu 10',
    tag: 'Chính xác',
    bg: '#7C3AED',
    borderColor: '#111111',
    badgeBg: '#FFFFFF',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#7C3AED" />
        {/* Bullseye target */}
        <circle cx="24" cy="24" r="14" fill="#FFFFFF" stroke="#111111" strokeWidth="2" />
        <circle cx="24" cy="24" r="9" fill="#E63946" />
        <circle cx="24" cy="24" r="4" fill="#FFC93C" stroke="#111111" strokeWidth="1" />
        {/* Crosshair accents */}
        <path d="M24 6V10M24 38V42M6 24H10M38 24H42" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'bookworm',
    name: 'Sách Hay',
    tag: 'Kiên trì',
    bg: '#0284C7',
    borderColor: '#111111',
    badgeBg: '#FFC93C',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#0284C7" />
        {/* Open book */}
        <path d="M24 33C21 31 16 31 11 32V17C16 16 21 16 24 18C27 16 32 16 37 17V32C32 31 27 31 24 33Z" fill="#FFFFFF" stroke="#111111" strokeWidth="2" strokeLinejoin="round" />
        <line x1="24" y1="18" x2="24" y2="33" stroke="#111111" strokeWidth="2" />
        <line x1="15" y1="22" x2="21" y2="22" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="15" y1="26" x2="21" y2="26" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="27" y1="22" x2="33" y2="22" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="27" y1="26" x2="33" y2="26" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'coder',
    name: 'Lập Trình',
    tag: 'Logic',
    bg: '#10B981',
    borderColor: '#111111',
    badgeBg: '#111111',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#10B981" />
        {/* Screen with code tags */}
        <rect x="10" y="14" width="28" height="20" rx="3" fill="#111111" stroke="#FFFFFF" strokeWidth="1.5" />
        <path d="M16 22L13 24L16 26" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M32 22L35 24L32 26" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M26 20L22 28" stroke="#FFC93C" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'star',
    name: 'Ngôi Sao',
    tag: 'Tỏa sáng',
    bg: '#D97706',
    borderColor: '#111111',
    badgeBg: '#FFC93C',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#D97706" />
        {/* 5-point star */}
        <polygon points="24,10 28,19 38,20 30,27 33,37 24,31 15,37 18,27 10,20 20,19" fill="#FFC93C" stroke="#111111" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="2" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'rocket',
    name: 'Tên Lửa',
    tag: 'Vươn xa',
    bg: '#4338CA',
    borderColor: '#111111',
    badgeBg: '#E63946',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#4338CA" />
        {/* Rocket ship */}
        <path d="M24 10C24 10 32 17 31 28L24 33L17 28C16 17 24 10 24 10Z" fill="#FFFFFF" stroke="#111111" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="24" cy="22" r="3" fill="#4338CA" stroke="#111111" strokeWidth="1.5" />
        {/* Fins */}
        <path d="M17 28L11 31L13 25" fill="#E63946" stroke="#111111" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M31 28L37 31L35 25" fill="#E63946" stroke="#111111" strokeWidth="1.5" strokeLinejoin="round" />
        {/* Exhaust flame */}
        <polygon points="24,33 21,39 24,37 27,39" fill="#FFC93C" />
      </svg>
    ),
  },
  {
    id: 'artist',
    name: 'Sáng Tạo',
    tag: 'Độc đáo',
    bg: '#DB2777',
    borderColor: '#111111',
    badgeBg: '#FFFFFF',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#DB2777" />
        {/* Palette */}
        <path d="M24 12C16 12 11 17 11 24C11 30 15 35 21 35C23 35 24 34 24 32C24 30.5 24.5 30 26 30H28C33 30 37 26 37 21C37 16 31 12 24 12Z" fill="#FFFFFF" stroke="#111111" strokeWidth="2" />
        <circle cx="18" cy="19" r="2" fill="#E63946" />
        <circle cx="24" cy="17" r="2" fill="#FFC93C" />
        <circle cx="30" cy="20" r="2" fill="#4D6BFE" />
        <circle cx="32" cy="25" r="2" fill="#0F9D58" />
      </svg>
    ),
  },
  {
    id: 'compass',
    name: 'La Bàn',
    tag: 'Định hướng',
    bg: '#0D9488',
    borderColor: '#111111',
    badgeBg: '#FFC93C',
    svg: (cls = 'w-full h-full') => (
      <svg viewBox="0 0 48 48" fill="none" className={cls}>
        <circle cx="24" cy="24" r="22" fill="#0D9488" />
        {/* Compass circle */}
        <circle cx="24" cy="24" r="14" fill="#FFFFFF" stroke="#111111" strokeWidth="2" />
        {/* Needle */}
        <polygon points="24,14 27,24 24,22" fill="#E63946" />
        <polygon points="24,14 21,24 24,22" fill="#B91C1C" />
        <polygon points="24,34 27,24 24,26" fill="#111111" />
        <polygon points="24,34 21,24 24,26" fill="#4B5563" />
        <circle cx="24" cy="24" r="2" fill="#FFC93C" stroke="#111111" strokeWidth="1" />
      </svg>
    ),
  },
];

export function getAvatarPreset(id?: string): AvatarPreset | undefined {
  if (!id) return undefined;
  return AVATAR_PRESETS.find((p) => p.id === id);
}

// Deterministic background colors for initials fallback
const INITIALS_PALETTE = [
  '#4D6BFE', '#0F9D58', '#E63946', '#D97706', '#7C3AED',
  '#0284C7', '#10B981', '#DB2777', '#0D9488', '#4338CA'
];

export function getInitialsColor(name: string): string {
  if (!name) return INITIALS_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % INITIALS_PALETTE.length;
  return INITIALS_PALETTE[index];
}

export function extractInitials(name: string): string {
  if (!name) return 'HS';
  const clean = name.trim().replace(/\s+/g, ' ');
  const parts = clean.split(' ');
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return (first + last).toUpperCase();
}

/**
 * Compresses an image client-side to a lightweight square data URL (max 256x256)
 */
export async function compressImageFile(file: File, maxDim = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        const targetDim = Math.min(maxDim, minSide);
        canvas.width = targetDim;
        canvas.height = targetDim;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetDim, targetDim);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Khong the doc file anh'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Khong the doc file'));
    reader.readAsDataURL(file);
  });
}
