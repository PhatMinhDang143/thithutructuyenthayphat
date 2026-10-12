import React, { useState, useRef } from 'react';
import { AppUser } from '../../types';
import { AVATAR_PRESETS, compressImageFile } from '../../utils/avatarUtils';
import { UserAvatar } from './UserAvatar';
import { X, Upload, Check } from 'lucide-react';

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentUser: AppUser;
  onClose: () => void;
  onSaveAvatar: (newAvatar: string) => Promise<void> | void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSaveAvatar,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(currentUser.avatar || 'scholar');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Kích thước ảnh vượt quá 8MB. Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }

    setUploadError('');
    setIsUploading(true);

    try {
      const dataUrl = await compressImageFile(file, 256, 0.85);
      setSelectedAvatar(dataUrl);
    } catch (err: any) {
      setUploadError('Không thể xử lý ảnh: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveAvatar(selectedAvatar);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white border-3 border-[#111111] shadow-[8px_8px_0px_#111111] max-h-[92dvh] flex flex-col text-[#111111]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-[#FDF6E9] border-b-3 border-[#111111] shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-[#111111]">
              Đổi Ảnh Đại Diện
            </h2>
            <p className="text-xs text-neutral-600 font-bold">
              Tùy biến avatar hiển thị trên bảng điểm và bảng xếp hạng
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white hover:bg-neutral-200 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[#111111] transition-all"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scroll">
          {/* Live Preview Card */}
          <div className="p-4 bg-[#F8F9FA] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] flex flex-col sm:flex-row items-center gap-4">
            <UserAvatar
              avatar={selectedAvatar}
              name={currentUser.name}
              size="2xl"
              showBorder={true}
            />
            <div className="text-center sm:text-left space-y-1 min-w-0">
              <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-[#FFC93C] border border-[#111111] inline-block">
                Xem Trước
              </span>
              <h3 className="font-black text-base text-[#111111] truncate">
                {currentUser.name}
              </h3>
              <p className="text-xs text-neutral-600 font-bold">
                Lớp: <span className="text-[#4D6BFE] uppercase">{currentUser.group || 'Khách'}</span> · SBD: <span className="font-mono">{currentUser.username}</span>
              </p>
              <p className="text-[11px] text-neutral-500 font-medium">
                Avatar này sẽ xuất hiện trên bục vinh danh và danh sách nộp bài thi.
              </p>
            </div>
          </div>

          {/* Section 1: Upload Custom Photo */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-xs sm:text-sm uppercase tracking-wider text-[#111111]">
                Cách 1: Tải Ảnh Riêng Từ Thiết Bị
              </h4>
              <span className="text-[11px] text-neutral-500 font-bold">PNG, JPG, WEBP</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2.5 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-black text-xs uppercase flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Đang Xử Lý Ảnh...' : 'Chọn Tệp Ảnh Từ Máy'}</span>
              </button>

              <span className="text-xs text-neutral-600 font-medium">
                Tự động cắt vuông và nén nhẹ để tải cực nhanh.
              </span>
            </div>

            {uploadError && (
              <p className="text-xs text-[#E63946] font-bold mt-1 bg-red-50 p-2 border border-[#E63946]">
                {uploadError}
              </p>
            )}
          </div>

          {/* Section 2: Choose Preset Avatar */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-xs sm:text-sm uppercase tracking-wider text-[#111111]">
                Cách 2: Chọn Bộ Sưu Tập Avatar Có Sẵn
              </h4>
              <span className="text-[11px] text-neutral-500 font-bold">12 mẫu thiết kế</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = selectedAvatar === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(preset.id);
                      setUploadError('');
                    }}
                    className={`p-2.5 border-2 text-center transition-all flex flex-col items-center gap-1.5 relative cursor-pointer ${
                      isSelected
                        ? 'border-[#111111] bg-[#FFC93C] shadow-[3px_3px_0px_#111111] -translate-y-0.5'
                        : 'border-neutral-300 bg-white hover:border-[#111111] hover:bg-[#FDF6E9]'
                    }`}
                  >
                    <div className="w-10 h-10 p-0.5">
                      {preset.svg('w-full h-full')}
                    </div>
                    <span className="font-black text-[11px] text-[#111111] truncate w-full leading-tight">
                      {preset.name}
                    </span>
                    <span className="text-[9px] text-neutral-600 font-medium truncate w-full">
                      {preset.tag}
                    </span>

                    {isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#111111] text-white flex items-center justify-center border border-white">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#F8F9FA] border-t-2 border-[#111111] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 bg-white hover:bg-neutral-100 text-[#111111] border-2 border-[#111111] font-black text-xs uppercase cursor-pointer transition-all"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-black text-xs uppercase cursor-pointer transition-all disabled:opacity-50"
          >
            {isSaving ? 'Đang Lưu...' : 'Lưu Ảnh Đại Diện'}
          </button>
        </div>
      </div>
    </div>
  );
};
