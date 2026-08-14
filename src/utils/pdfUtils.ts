/**
 * Utility functions to validate, normalize, and render PDF files & Google Drive URLs.
 */

export interface PdfUrlInfo {
  previewUrl: string;
  directUrl: string;
  isDrive: boolean;
  isBase64: boolean;
  fileId?: string;
  error?: string;
}

/**
 * Extract Google Drive file ID from various link formats:
 * - https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
 * - https://drive.google.com/file/d/{FILE_ID}/edit
 * - https://drive.google.com/file/u/0/d/{FILE_ID}/view
 * - https://drive.google.com/open?id={FILE_ID}
 * - https://drive.google.com/uc?id={FILE_ID}&export=download
 * - https://docs.google.com/file/d/{FILE_ID}
 */
export function extractGoogleDriveFileId(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  // Pattern 1: /file/d/{ID} or /file/u/0/d/{ID}
  const fileDMatch = trimmed.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{15,})/);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  // Pattern 2: /d/{ID} in docs.google.com or drive.google.com
  const dMatch = trimmed.match(/(?:drive|docs)\.google\.com\/[a-zA-Z0-9_\/]*\/d\/([a-zA-Z0-9_-]{15,})/);
  if (dMatch && dMatch[1]) {
    return dMatch[1];
  }

  // Pattern 3: ?id={ID} or &id={ID} in drive.google.com/open or /uc
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  return null;
}

/**
 * Normalize any PDF / Google Drive URL into an iframe-embeddable preview URL and direct URL.
 */
export function normalizePdfUrl(rawUrl?: string): PdfUrlInfo {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      previewUrl: '',
      directUrl: '',
      isDrive: false,
      isBase64: false,
    };
  }

  const trimmed = rawUrl.trim();

  // 1. Check Base64 data URL
  if (trimmed.startsWith('data:application/pdf') || (trimmed.startsWith('data:') && trimmed.includes('base64,'))) {
    return {
      previewUrl: trimmed,
      directUrl: trimmed,
      isDrive: false,
      isBase64: true,
    };
  }

  // 2. Check Google Drive links
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    // Check if user accidentally pasted a Google Drive Folder link
    if (trimmed.includes('/folders/') || trimmed.includes('/drive/folders/')) {
      return {
        previewUrl: '',
        directUrl: trimmed,
        isDrive: true,
        isBase64: false,
        error: 'Đây là link thư mục Google Drive (Folder), không phải link file PDF đề thi. Vui lòng mở file PDF và lấy link của file đó.',
      };
    }

    const fileId = extractGoogleDriveFileId(trimmed);
    if (fileId) {
      return {
        previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        directUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
        isDrive: true,
        isBase64: false,
        fileId,
      };
    } else {
      return {
        previewUrl: trimmed,
        directUrl: trimmed,
        isDrive: true,
        isBase64: false,
        error: 'Không tìm thấy ID file Google Drive. Vui lòng kiểm tra lại đường link.',
      };
    }
  }

  // 3. Regular web link or direct PDF URL
  return {
    previewUrl: trimmed,
    directUrl: trimmed,
    isDrive: false,
    isBase64: false,
  };
}

/**
 * Validate teacher input in ExamForm and give instant user-friendly feedback.
 */
export function validatePdfInput(value?: string, hasUploadedFile?: boolean): {
  isValid: boolean;
  status: 'empty' | 'base64' | 'drive_valid' | 'drive_invalid' | 'url_valid' | 'folder_error';
  message: string;
  previewUrl: string;
  directUrl: string;
} {
  if (hasUploadedFile) {
    return {
      isValid: true,
      status: 'base64',
      message: 'Đã tải lên file PDF trực tiếp (Base64) - Học sinh xem được ngay trên mọi thiết bị.',
      previewUrl: value || '',
      directUrl: value || '',
    };
  }

  if (!value || !value.trim()) {
    return {
      isValid: false,
      status: 'empty',
      message: 'Chưa có file PDF hoặc link đề thi.',
      previewUrl: '',
      directUrl: '',
    };
  }

  const info = normalizePdfUrl(value);

  if (info.isBase64) {
    return {
      isValid: true,
      status: 'base64',
      message: 'File PDF nhúng trực tiếp (Base64) hợp lệ.',
      previewUrl: info.previewUrl,
      directUrl: info.directUrl,
    };
  }

  if (info.error) {
    return {
      isValid: false,
      status: info.error.includes('thư mục') ? 'folder_error' : 'drive_invalid',
      message: info.error,
      previewUrl: '',
      directUrl: info.directUrl,
    };
  }

  if (info.isDrive) {
    return {
      isValid: true,
      status: 'drive_valid',
      message: 'Link Google Drive hợp lệ (Đã tự động chuyển đổi sang định dạng nhúng /preview chuẩn).',
      previewUrl: info.previewUrl,
      directUrl: info.directUrl,
    };
  }

  return {
    isValid: true,
    status: 'url_valid',
    message: 'Link tài liệu trực tuyến hợp lệ.',
    previewUrl: info.previewUrl,
    directUrl: info.directUrl,
  };
}
