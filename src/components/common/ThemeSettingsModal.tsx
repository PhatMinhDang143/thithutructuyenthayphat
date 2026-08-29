import React from 'react';
import { Palette, Type, Sparkles, Volume2, VolumeX, RotateCcw, Check, Sun, Moon, Zap, Eye, Compass, ShieldCheck } from 'lucide-react';
import { useTheme, ThemePalette, FontSizeScale, ShadowStyle } from '../../context/ThemeContext';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteOption {
  id: ThemePalette;
  name: string;
  desc: string;
  bgHex: string;
  accentHex: string;
  badgeHex: string;
  isDark?: boolean;
}

const PALETTES: PaletteOption[] = [
  {
    id: 'retro',
    name: 'Cổ Điển Retro (Mặc định)',
    desc: 'Nền kem ấm áp kết hợp viền đậm cá tính',
    bgHex: '#FDF6E9',
    accentHex: '#FFC93C',
    badgeHex: '#4D6BFE',
  },
  {
    id: 'ocean',
    name: 'Xanh Biển Điện (Ocean)',
    desc: 'Tươi sáng, hiện đại và tràn đầy năng lượng',
    bgHex: '#EFF6FF',
    accentHex: '#3B82F6',
    badgeHex: '#1D4ED8',
  },
  {
    id: 'mint',
    name: 'Bạc Hà Dịu Mắt (Mint)',
    desc: 'Tông xanh ngọc êm dịu, chống mỏi mắt khi đọc đề',
    bgHex: '#F0FDF4',
    accentHex: '#10B981',
    badgeHex: '#047857',
  },
  {
    id: 'lavender',
    name: 'Hoa Oải Hương (Lavender)',
    desc: 'Tím pastel tinh tế, mượt mà và tập trung',
    bgHex: '#FAF5FF',
    accentHex: '#8B5CF6',
    badgeHex: '#6D28D9',
  },
  {
    id: 'coral',
    name: 'San Hô Nhiệt Huyết (Coral)',
    desc: 'Tông đỏ hồng ấm áp, tiếp thêm động lực làm bài',
    bgHex: '#FFF1F2',
    accentHex: '#F43F5E',
    badgeHex: '#BE123C',
  },
  {
    id: 'dark',
    name: 'Đêm Huyền Bí (Midnight Dark)',
    desc: 'Chế độ tối bảo vệ thị lực khi học vào ban đêm',
    bgHex: '#18181B',
    accentHex: '#6366F1',
    badgeHex: '#FFC93C',
    isDark: true,
  },
];

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, updateTheme, resetTheme, playClickSound } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FFFFFF] border-3 border-[#111111] max-w-xl w-full p-4 sm:p-6 shadow-[8px_8px_0px_#111111] relative flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#111111] uppercase tracking-tight">
                Tùy Chỉnh Giao Diện & Trải Nghiệm
              </h3>
              <p className="text-[11px] text-neutral-600 font-semibold">
                Cá nhân hóa màu sắc, kích thước chữ và phong cách hiển thị
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 bg-[#FDF6E9] hover:bg-[#E63946] hover:text-white text-[#111111] border-2 border-[#111111] font-black text-xs shadow-[2px_2px_0px_#111111] transition-all"
          >
            ✕
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 custom-scroll">
          {/* Section 1: Color Themes */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-black text-[#111111] uppercase flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#FFC93C]" /> Bảng Màu Phong Cách
              </label>
              <span className="text-[10px] font-bold text-neutral-600 uppercase bg-[#FDF6E9] px-2 py-0.5 border border-[#111111]">
                Chọn bảng màu bạn thích
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PALETTES.map((p) => {
                const isSelected = theme.palette === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      updateTheme({ palette: p.id });
                      playClickSound();
                    }}
                    className={`p-3 text-left border-2 border-[#111111] transition-all flex items-start gap-3 relative ${
                      isSelected
                        ? 'bg-white shadow-[4px_4px_0px_#111111] -translate-y-0.5'
                        : 'bg-[#FAF8F5] hover:bg-white hover:shadow-[2px_2px_0px_#111111]'
                    }`}
                  >
                    {/* Color Swatch Preview */}
                    <div
                      className="w-10 h-10 border-2 border-[#111111] shrink-0 flex items-center justify-center shadow-[1px_1px_0px_#111111]"
                      style={{ backgroundColor: p.bgHex }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border border-[#111111]"
                        style={{ backgroundColor: p.accentHex }}
                      />
                    </div>

                    {/* Palette Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-xs text-[#111111] truncate">{p.name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 bg-[#0F9D58] text-white text-[9px] font-black border border-[#111111] shrink-0">
                            Đang dùng
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-600 font-medium leading-tight mt-0.5 line-clamp-2">
                        {p.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Font Size Scaling */}
          <div className="pt-2 border-t-2 border-[#111111]">
            <label className="block text-xs font-black text-[#111111] uppercase mb-2 flex items-center gap-1.5">
              <Type className="w-4 h-4 text-[#4D6BFE]" /> Kích Thước Chữ (Font Size)
            </label>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'normal' as FontSizeScale, label: 'Chuẩn (100%)', sample: 'Aa', desc: 'Mặc định' },
                { id: 'medium' as FontSizeScale, label: 'Vừa (110%)', sample: 'Aa+', desc: 'Dễ đọc' },
                { id: 'large' as FontSizeScale, label: 'Lớn (120%)', sample: 'Aa++', desc: 'Rõ nét' },
              ].map((f) => {
                const isSelected = theme.fontSize === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      updateTheme({ fontSize: f.id });
                      playClickSound();
                    }}
                    className={`p-2.5 text-center border-2 border-[#111111] transition-all ${
                      isSelected
                        ? 'bg-[#FFC93C] text-[#111111] font-black shadow-[3px_3px_0px_#111111] -translate-y-0.5'
                        : 'bg-[#FDF6E9] text-neutral-800 hover:bg-white font-bold'
                    }`}
                  >
                    <span className="text-sm font-black block">{f.sample}</span>
                    <span className="text-[11px] block">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Shadow & Layout Style */}
          <div className="pt-2 border-t-2 border-[#111111]">
            <label className="block text-xs font-black text-[#111111] uppercase mb-2 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#0F9D58]" /> Phong Cách Đổ Bóng & Khung Viền
            </label>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'brutal' as ShadowStyle, label: 'Khối 3D Cổ Điển', desc: 'Neo-Brutalist' },
                { id: 'soft' as ShadowStyle, label: 'Đổ Bóng Mềm', desc: 'Hiệu ứng mịn' },
                { id: 'flat' as ShadowStyle, label: 'Tối Giản Phẳng', desc: 'Sắc nét 2px' },
              ].map((s) => {
                const isSelected = theme.shadowStyle === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      updateTheme({ shadowStyle: s.id });
                      playClickSound();
                    }}
                    className={`p-2.5 text-center border-2 border-[#111111] transition-all ${
                      isSelected
                        ? 'bg-[#4D6BFE] text-white font-black shadow-[3px_3px_0px_#111111] -translate-y-0.5'
                        : 'bg-[#FDF6E9] text-neutral-800 hover:bg-white font-bold'
                    }`}
                  >
                    <span className="text-[11px] font-black block">{s.label}</span>
                    <span className="text-[9px] opacity-80 block">{s.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Examination Interaction Settings */}
          <div className="pt-2 border-t-2 border-[#111111]">
            <label className="block text-xs font-black text-[#111111] uppercase mb-2.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#E63946]" /> Trải Nghiệm Tương Tác Khi Làm Bài
            </label>

            <div className="space-y-2">
              {/* Sound Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-[#FDF6E9] border-2 border-[#111111]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-white border border-[#111111]">
                    {theme.soundEnabled ? <Volume2 className="w-4 h-4 text-[#0F9D58]" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
                  </div>
                  <div>
                    <span className="text-xs font-black text-[#111111] block">Âm thanh phản hồi khi chọn đáp án</span>
                    <span className="text-[10px] text-neutral-600 font-medium">Phát tiếng gõ nhẹ giúp xác nhận lựa chọn</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {theme.soundEnabled && (
                    <button
                      type="button"
                      onClick={playClickSound}
                      className="text-[10px] font-black px-2 py-1 bg-white border border-[#111111] hover:bg-neutral-100"
                    >
                      Nghe thử 🔊
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateTheme({ soundEnabled: !theme.soundEnabled })}
                    className={`w-12 h-6 border-2 border-[#111111] flex items-center p-0.5 transition-colors ${
                      theme.soundEnabled ? 'bg-[#0F9D58] justify-end' : 'bg-neutral-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 bg-white border border-[#111111]" />
                  </button>
                </div>
              </div>

              {/* Auto Next Question Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-[#FDF6E9] border-2 border-[#111111]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-white border border-[#111111]">
                    <Eye className="w-4 h-4 text-[#4D6BFE]" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-[#111111] block">Tự động cuộn đến câu tiếp theo</span>
                    <span className="text-[10px] text-neutral-600 font-medium">Tự động chuyển tiêu điểm sau khi đánh dấu câu</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateTheme({ autoNextQuestion: !theme.autoNextQuestion })}
                  className={`w-12 h-6 border-2 border-[#111111] flex items-center p-0.5 transition-colors ${
                    theme.autoNextQuestion ? 'bg-[#4D6BFE] justify-end' : 'bg-neutral-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 bg-white border border-[#111111]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 mt-3 border-t-2 border-[#111111] shrink-0">
          <button
            type="button"
            onClick={() => {
              resetTheme();
              playClickSound();
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-[#111111] px-2 py-1.5 hover:bg-neutral-100 border border-transparent hover:border-[#111111] transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Khôi phục mặc định
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] text-xs font-black shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#111111] flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Hoàn Tất & Áp Dụng
          </button>
        </div>
      </div>
    </div>
  );
};
