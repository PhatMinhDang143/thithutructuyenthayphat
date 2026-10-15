/**
 * gradeUtils.ts
 * Bộ lọc thông minh phân loại Khối lớp (Khối 10, Khối 11, Khối 12) và Lớp học
 * Giải quyết dứt điểm vấn đề: Đề thi Khối 11 xuất hiện nhầm trong tài khoản học sinh Khối 12 (hoặc ngược lại)
 */

/**
 * Trích xuất khối lớp (10, 11, 12) từ tên lớp hoặc nhóm học sinh
 * Ví dụ: "12A1" -> 12, "12B" -> 12, "11A" -> 11, "10C1" -> 10, "Khối 11" -> 11, "K12" -> 12
 */
export function extractGradeFromClass(cls?: string): number | null {
  if (!cls) return null;
  const s = String(cls).trim().toLowerCase();
  if (!s || s === 'khách' || s === 'guest' || s === 'tất cả' || s === 'all') return null;

  // Khối 10, Khối 11, Khối 12, K10, K11, K12, Lớp 10, Lớp 11, Lớp 12
  const mKhoi = s.match(/(?:khối|k|lớp)\s*(10|11|12)\b/i);
  if (mKhoi) return parseInt(mKhoi[1], 10);

  // Bắt đầu bằng 10, 11, 12 như 12A1, 11B, 10C, 12/2, 11.3
  const mStart = s.match(/\b(10|11|12)(?:[a-zA-Z\.\/\-_]|$)/);
  if (mStart) return parseInt(mStart[1], 10);

  return null;
}

/**
 * Trích xuất khối lớp mục tiêu của đề thi (10, 11, 12) dựa vào target_group và tiêu đề đề thi
 */
export function extractGradeFromExam(exam?: { title?: string; questions?: any; file_url?: any }): number | null {
  if (!exam) return null;

  let cfg = exam.questions;
  if (!cfg && typeof exam.file_url === 'string' && exam.file_url.startsWith('{')) {
    try {
      cfg = JSON.parse(exam.file_url);
    } catch {}
  }
  const targetGroup = String(cfg?.target_group || '').toLowerCase().trim();

  // 1. Kiểm tra target_group trước (nếu giáo viên gán chỉ định Khối 10/11/12)
  if (targetGroup) {
    if (targetGroup.includes('khối 10') || targetGroup.includes('k10') || targetGroup.includes('lớp 10') || targetGroup === '10') {
      return 10;
    }
    if (targetGroup.includes('khối 11') || targetGroup.includes('k11') || targetGroup.includes('lớp 11') || targetGroup === '11') {
      return 11;
    }
    if (targetGroup.includes('khối 12') || targetGroup.includes('k12') || targetGroup.includes('lớp 12') || targetGroup === '12') {
      return 12;
    }

    // Nếu target_group là danh sách các lớp cụ thể (vd: "11A, 11B" hoặc "12A1, 12A2, 12B")
    if (!targetGroup.includes('tất cả') && !targetGroup.includes('all')) {
      const classes = targetGroup.split(',').map((c) => c.trim());
      const grades = classes.map(extractGradeFromClass).filter((g): g is number => g !== null);
      if (grades.length > 0) {
        // Kiểm tra xem tất cả các lớp có cùng 1 khối không
        const firstGrade = grades[0];
        if (grades.every((g) => g === firstGrade)) {
          return firstGrade;
        }
      }
    }
  }

  // 2. Kiểm tra tiêu đề đề thi (VD: "Đề khảo sát Toán 11 lần 1", "Đề ôn tập C1,2 Toán 12", "Toán 11", "K11", "Vật lý 12", "Hóa 10")
  const title = String(exam.title || '').toLowerCase().trim();
  if (title) {
    // Khối 10/11/12 hoặc K10/K11/K12 hoặc Lớp 10/11/12
    const mKhoi = title.match(/(?:khối|k|lớp)\s*(10|11|12)\b/i);
    if (mKhoi) return parseInt(mKhoi[1], 10);

    // Môn học kèm số khối: Toán 11, Lý 12, Hóa 10, Sử 11, Địa 12, GDCD 11, Anh 12, v.v.
    const mSubject = title.match(
      /(?:toán|vật\s*lý|vật\s*lí|lý|hóa\s*học|hóa|sinh\s*học|sinh|tiếng\s*anh|anh|lịch\s*sử|sử|địa\s*lí|địa\s*lý|địa|gdcd|gdkt\s*[\&\+]\s*pl|tin\s*học|tin|ngữ\s*văn|văn|khtn)\s*(10|11|12)\b/i
    );
    if (mSubject) return parseInt(mSubject[1], 10);

    // Mã lớp trong tiêu đề: 11A, 12A1, 12B, 10C...
    const mClassInTitle = title.match(/\b(10|11|12)[a-zA-Z]\w*\b/i);
    if (mClassInTitle) return parseInt(mClassInTitle[1], 10);

    // Số 10, 11, 12 đứng độc lập nhưng trong ngữ cảnh thi cử
    // VD: "Đề thi 11", "Kiểm tra 12", "Khảo sát 11", "Ôn tập 12"
    const mContext = title.match(
      /(?:đề\s*thi|kiểm\s*tra|khảo\s*sát|ôn\s*tập|chương\s*\d+|hk\d+|giữa\s*kỳ|cuối\s*kỳ)\s*(?:môn\s*\w+\s*)?(10|11|12)\b/i
    );
    if (mContext) return parseInt(mContext[1], 10);

    // THPT Quốc gia / Tốt nghiệp THPT mặc định là khối 12 nếu không nói gì khác
    if (
      title.includes('tốt nghiệp thpt') ||
      title.includes('thptqg') ||
      title.includes('đgnl') ||
      title.includes('đánh giá năng lực')
    ) {
      return 12;
    }
  }

  return null;
}

/**
 * Kiểm tra xem học sinh thuộc lớp userGroup có được phép xem và làm đề thi này hay không.
 * Triệt tiêu hoàn toàn lỗi: Đề khối 11 hiện trong tài khoản học sinh khối 12 (hoặc ngược lại).
 */
export function isExamAllowedForStudent(exam: any, userGroup?: string): boolean {
  if (!exam) return false;

  const groupStr = String(userGroup || 'Khách').toLowerCase().trim();
  const isGuest = !groupStr || groupStr === 'khách' || groupStr === 'guest';

  let cfg = exam.questions;
  if (!cfg && typeof exam.file_url === 'string' && exam.file_url.startsWith('{')) {
    try {
      cfg = JSON.parse(exam.file_url);
    } catch {}
  }

  const targetGroup = String(cfg?.target_group || '').toLowerCase().trim();
  const studentGrade = extractGradeFromClass(groupStr);
  const examGrade = extractGradeFromExam(exam);

  // NGUYÊN TẮC VÀNG 1: LỆCH KHỐI LỚP (GRADE MISMATCH)
  // Nếu xác định được khối của học sinh VÀ khối của đề thi, mà 2 khối KHÁC NHAU:
  // Tuyệt đối không cho phép hiển thị (kể cả khi đề để target_group là "Tất cả" hay bỏ trống).
  if (studentGrade !== null && examGrade !== null && studentGrade !== examGrade) {
    return false;
  }

  // Khách vãng lai: chỉ được xem các đề chung toàn trường ("Tất cả") và không có chỉ định khối riêng
  if (isGuest) {
    if (examGrade !== null) return false; // Không mở đề khối cho khách
    return !targetGroup || targetGroup.includes('tất cả') || targetGroup.includes('all');
  }

  // NGUYÊN TẮC VÀNG 2: XỬ LÝ TARGET GROUP
  // Nếu targetGroup để trống hoặc là "Tất cả":
  if (!targetGroup || targetGroup.includes('tất cả') || targetGroup.includes('all') || targetGroup === 'toàn trường') {
    // Nếu đề thuộc 1 khối (VD: đề khối 12 để Tất cả), thì mọi học sinh khối 12 đều xem được
    if (examGrade !== null && studentGrade !== null) {
      return examGrade === studentGrade;
    }
    // Nếu đề thi chung toàn trường không phân khối: mở cho tất cả học sinh
    return true;
  }

  // Nếu targetGroup chỉ định "Khối 11" / "Toàn Khối 11" / "K11"
  if (targetGroup.includes('khối 11') || targetGroup.includes('k11') || targetGroup === '11') {
    return studentGrade === 11;
  }

  // Nếu targetGroup chỉ định "Khối 12" / "Toàn Khối 12" / "K12"
  if (targetGroup.includes('khối 12') || targetGroup.includes('k12') || targetGroup === '12') {
    return studentGrade === 12;
  }

  // Nếu targetGroup chỉ định "Khối 10" / "Toàn Khối 10" / "K10"
  if (targetGroup.includes('khối 10') || targetGroup.includes('k10') || targetGroup === '10') {
    return studentGrade === 10;
  }

  // Nếu targetGroup là danh sách các lớp cụ thể (vd: "12A1, 12A2, 12B")
  const allowedClasses = targetGroup.split(',').map((c) => c.trim().toLowerCase());
  return allowedClasses.includes(groupStr) || targetGroup.includes(groupStr);
}

/**
 * Nhãn hiển thị Khối của đề thi với màu sắc phong cách Neo-Brutalist
 */
export function getExamGradeBadge(exam: any): { label: string; color: string; grade: number | null } {
  const grade = extractGradeFromExam(exam);
  if (grade === 12) {
    return { label: 'Khối 12', color: 'bg-[#4D6BFE] text-white', grade: 12 };
  }
  if (grade === 11) {
    return { label: 'Khối 11', color: 'bg-[#FF8A00] text-white', grade: 11 };
  }
  if (grade === 10) {
    return { label: 'Khối 10', color: 'bg-[#0F9D58] text-white', grade: 10 };
  }
  return { label: 'Toàn Trường', color: 'bg-[#111111] text-white', grade: null };
}
