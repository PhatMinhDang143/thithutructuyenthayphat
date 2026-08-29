import React, { useState, useEffect } from 'react';
import { ExamItem, AnswerKeyPart1, AnswerKeyPart2, AnswerKeyPart3 } from '../../types';
import { 
  FilePlus, Save, Loader2, UploadCloud, Clock, Timer, Users, Layers, 
  AlertCircle, FileCheck, CheckCircle2, X, ExternalLink, Eye, Info, Link as LinkIcon, Trash2, Cloud, Sparkles, RefreshCw,
  FileSpreadsheet, Download, Zap, RotateCcw
} from 'lucide-react';
import { normalizePdfUrl, validatePdfInput } from '../../utils/pdfUtils';
import { PdfViewer } from '../common/PdfViewer';
import { uploadPdfToGoogleDrive, getApiUrl } from '../../services/storageService';
import { QuickAnswerModal } from './QuickAnswerModal';
import { downloadSampleExcelTemplate } from '../../utils/answerParser';

interface ExamFormProps {
  initialData: ExamItem | null;
  availableClasses: string[];
  onSave: (payload: ExamItem) => Promise<void>;
  onCancel: () => void;
}

export const ExamForm: React.FC<ExamFormProps> = ({
  initialData,
  availableClasses,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [duration, setDuration] = useState<number>(initialData?.duration ? Number(initialData.duration) : 45);
  const [examType, setExamType] = useState<'fixed' | 'custom'>(initialData?.questions?.exam_type || 'fixed');

  const [numP1, setNumP1] = useState(initialData?.questions?.num_p1 ?? 12);
  const [numP2, setNumP2] = useState(initialData?.questions?.num_p2 ?? 4);
  const [numP3, setNumP3] = useState(initialData?.questions?.num_p3 ?? 6);

  // TARGET CLASS SELECTION FEATURE (Lớp được phép làm bài)
  const [targetGroup, setTargetGroup] = useState(initialData?.questions?.target_group || 'Tất cả');

  // MAX ATTEMPTS / RETRY LIMIT FEATURE (Số lần làm bài tối đa)
  const [maxAttempts, setMaxAttempts] = useState<number>(
    initialData?.questions?.max_attempts !== undefined ? Number(initialData.questions.max_attempts) : 0
  );

  const [startTime, setStartTime] = useState(initialData?.questions?.start_time || '');
  const [endTime, setEndTime] = useState(initialData?.questions?.end_time || '');

  // PDF Source State
  const initialFileLink = initialData?.questions?.file_link || '';
  const isInitialBase64 = initialFileLink.startsWith('data:application/pdf') || initialFileLink.startsWith('data:');
  const hasExistingFile = Boolean(initialFileLink && initialFileLink.trim() !== '' && initialFileLink !== '[PDF_STORED_IN_BROWSER]');

  // Mode for editing existing file vs replacing it
  const [isReplacingFile, setIsReplacingFile] = useState(!hasExistingFile);
  const [isNewFileUpload, setIsNewFileUpload] = useState(false);
  
  const [fileLink, setFileLink] = useState(isInitialBase64 ? '' : initialFileLink);
  const [explainLink, setExplainLink] = useState(initialData?.questions?.explain_link || '');
  
  const [uploadFile, setUploadFile] = useState<{ name: string; size: string; base64: string } | null>(
    isInitialBase64 ? { name: 'File_PDF_Da_Luu.pdf', size: 'Đã lưu trong hệ thống', base64: initialFileLink } : null
  );

  // Google Drive Upload State
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadSuccessMsg, setDriveUploadSuccessMsg] = useState<string | null>(null);
  const [driveUploadErrorMsg, setDriveUploadErrorMsg] = useState<string | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showQuickAnswerModal, setShowQuickAnswerModal] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const [ansP1, setAnsP1] = useState<AnswerKeyPart1>(initialData?.answers?.p1 || {});
  const [ansP2, setAnsP2] = useState<AnswerKeyPart2>(initialData?.answers?.p2 || {});
  const [ansP3, setAnsP3] = useState<AnswerKeyPart3>(initialData?.answers?.p3 || {});

  const [isSaving, setIsSaving] = useState(false);

  const handleApplyQuickAnswers = (data: {
    p1: Record<number, 'A' | 'B' | 'C' | 'D'>;
    p2: Record<number, Record<'a' | 'b' | 'c' | 'd', 'Đ' | 'S'>>;
    p3: Record<number, string>;
    suggestedCounts?: { numP1?: number; numP2?: number; numP3?: number };
  }) => {
    let p1Updated = { ...ansP1, ...data.p1 };
    let p2Updated = { ...ansP2, ...data.p2 };
    let p3Updated = { ...ansP3, ...data.p3 };

    setAnsP1(p1Updated);
    setAnsP2(p2Updated);
    setAnsP3(p3Updated);

    if (data.suggestedCounts) {
      let changed = false;
      if (data.suggestedCounts.numP1 && data.suggestedCounts.numP1 > numP1) {
        setNumP1(data.suggestedCounts.numP1);
        changed = true;
      }
      if (data.suggestedCounts.numP2 && data.suggestedCounts.numP2 > numP2) {
        setNumP2(data.suggestedCounts.numP2);
        changed = true;
      }
      if (data.suggestedCounts.numP3 && data.suggestedCounts.numP3 > numP3) {
        setNumP3(data.suggestedCounts.numP3);
        changed = true;
      }
      if (changed) {
        setExamType('custom');
      }
    }

    const c1 = Object.keys(data.p1).length;
    const c2 = Object.keys(data.p2).length;
    const c3 = Object.keys(data.p3).length;
    setImportSuccessMsg(`Đã nạp thành công: ${c1} câu P1, ${c2} câu P2, ${c3} câu P3 vào đề thi!`);

    setTimeout(() => {
      setImportSuccessMsg(null);
    }, 5000);
  };

  const handleClearAllAnswers = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ đáp án đang nhập?')) {
      setAnsP1({});
      setAnsP2({});
      setAnsP3({});
      setImportSuccessMsg(null);
    }
  };

  useEffect(() => {
    if (examType === 'fixed') {
      setNumP1(12);
      setNumP2(4);
      setNumP3(6);
    }
  }, [examType]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Vui lòng chọn file định dạng PDF!');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        alert(`File PDF "${file.name}" dung lượng quá lớn (${(file.size / (1024 * 1024)).toFixed(1)}MB). Vui lòng chọn file dưới 25MB.`);
        return;
      }

      setDriveUploadSuccessMsg(null);
      setDriveUploadErrorMsg(null);
      setIsNewFileUpload(true);

      const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const resultStr = ev.target?.result as string;
        if (resultStr) {
          setUploadFile({
            name: file.name,
            size: sizeFormatted,
            base64: resultStr,
          });

          // If Apps Script API is configured, automatically attempt to upload to Google Drive
          const hasApi = !!getApiUrl();
          if (hasApi) {
            handleUploadToGoogleDriveDirect(resultStr, file.name);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadToGoogleDriveDirect = async (base64Str: string, fileName: string) => {
    setIsUploadingToDrive(true);
    setDriveUploadSuccessMsg(null);
    setDriveUploadErrorMsg(null);

    try {
      const res = await uploadPdfToGoogleDrive(base64Str, fileName);
      if (res.success && res.previewUrl) {
        setFileLink(res.previewUrl);
        setDriveUploadSuccessMsg(`Đã tải lên Google Drive thành công (Thư mục: DeThi_Online_Drive)! Link xem trước: ${res.previewUrl}`);
        // Clear local base64 so browser memory isn't loaded with large payload
        setUploadFile(null);
        setIsNewFileUpload(false);
      } else {
        setDriveUploadErrorMsg(res.error || 'Không thể tải file lên Google Drive. Đã lưu file cục bộ.');
      }
    } catch (err: any) {
      setDriveUploadErrorMsg(err?.message || 'Lỗi khi đẩy file lên Google Drive.');
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleRemoveUploadedFile = () => {
    setUploadFile(null);
    setDriveUploadSuccessMsg(null);
    setDriveUploadErrorMsg(null);
    setIsNewFileUpload(false);
  };

  const handleToggleClass = (clsName: string) => {
    if (clsName === 'Tất cả') {
      setTargetGroup('Tất cả');
      return;
    }

    let currentArray = targetGroup
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s.toLowerCase() !== 'tất cả');

    if (currentArray.includes(clsName)) {
      currentArray = currentArray.filter((s) => s !== clsName);
    } else {
      currentArray.push(clsName);
    }

    if (currentArray.length === 0) {
      setTargetGroup('Tất cả');
    } else {
      setTargetGroup(currentArray.join(', '));
    }
  };

  // Determine active PDF url for preview & validation
  const effectivePdfData = uploadFile?.base64 || fileLink.trim() || initialFileLink;
  const pdfValidation = validatePdfInput(fileLink.trim() || (uploadFile ? 'uploaded' : (hasExistingFile ? initialFileLink : '')), !!uploadFile?.base64 || hasExistingFile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề đề thi!');
      return;
    }

    // 1. Resolve Final PDF URL/Base64
    let finalFileLink = '';

    if (!isReplacingFile && hasExistingFile) {
      // Keep existing file link as-is (super fast and zero friction)
      finalFileLink = initialFileLink;
    } else if (fileLink.trim()) {
      const normalized = normalizePdfUrl(fileLink.trim());
      if (normalized.error && !normalized.isDrive) {
        if (!window.confirm(`Cảnh báo link đề thi:\n${normalized.error}\n\nBạn có muốn tiếp tục lưu không?`)) {
          return;
        }
      }
      finalFileLink = normalized.previewUrl || fileLink.trim();
    } else if (uploadFile && uploadFile.base64) {
      // If newly uploaded and not on Drive yet, try Drive once or fallback to base64
      if (isNewFileUpload) {
        setIsSaving(true);
        const hasApi = !!getApiUrl();
        if (hasApi) {
          try {
            const driveRes = await uploadPdfToGoogleDrive(uploadFile.base64, uploadFile.name);
            if (driveRes.success && driveRes.previewUrl) {
              finalFileLink = driveRes.previewUrl;
            } else {
              finalFileLink = uploadFile.base64;
            }
          } catch (err) {
            finalFileLink = uploadFile.base64;
          }
        } else {
          finalFileLink = uploadFile.base64;
        }
      } else {
        finalFileLink = uploadFile.base64;
      }
    } else if (hasExistingFile) {
      finalFileLink = initialFileLink;
    }

    // 2. Resolve Explain Link
    let finalExplainLink = explainLink.trim();
    if (finalExplainLink) {
      const normalizedExp = normalizePdfUrl(finalExplainLink);
      if (normalizedExp.isDrive && normalizedExp.directUrl) {
        finalExplainLink = normalizedExp.directUrl;
      }
    }

    setIsSaving(true);
    const durationNum = Math.max(1, Number(duration) || 45);
    const payload: ExamItem = {
      id: initialData?.id || 'ex_' + Date.now(),
      title: title.trim(),
      duration: durationNum,
      questions: {
        exam_type: examType,
        num_p1: Number(numP1),
        num_p2: Number(numP2),
        num_p3: Number(numP3),
        target_group: targetGroup.trim() || 'Tất cả',
        max_attempts: Number(maxAttempts) || 0,
        start_time: startTime,
        end_time: endTime,
        file_link: finalFileLink,
        explain_link: finalExplainLink,
      },
      answers: {
        p1: ansP1,
        p2: ansP2,
        p3: ansP3,
      },
    };

    try {
      await onSave(payload);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 border-3 border-[#111111] shadow-[6px_6px_0px_#111111] text-[#111111]">
      <div className="flex justify-between items-center border-b-2 border-[#111111] pb-5 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase text-[#111111] flex items-center gap-2">
            <FilePlus className="w-6 h-6 text-[#4D6BFE]" />
            {initialData ? 'Cập Nhật Cấu Trúc & Phân Lớp Đề Thi' : 'Tạo Đề Thi Mới & Phân Cho Lớp Học'}
          </h2>
          <p className="text-xs md:text-sm text-neutral-700 font-bold mt-1">
            Thiết lập đề thi PDF, đáp án chuẩn, ma trận câu hỏi và chỉ định lớp học sinh được làm bài.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Config Settings */}
        <div className="lg:col-span-5 space-y-6">
          {/* General info */}
          <div className="bg-[#FDF6E9] p-5 border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-4">
            <h3 className="text-xs font-black text-[#111111] uppercase tracking-widest border-b-2 border-[#111111] pb-2">
              1. Thông Tin Chung
            </h3>
            <div>
              <label className="block text-[#111111] text-xs font-black mb-1.5 uppercase">
                Tiêu Đề Đề Thi <span className="text-[#E63946]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full p-3 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[#111111] outline-none text-xs font-bold"
                placeholder="VD: Đề thi khảo sát Toán Lớp 12A1..."
              />
            </div>

            {/* DURATION SETTING WITH QUICK PRESET BUTTONS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[#111111] text-xs font-black uppercase flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#4D6BFE]" />
                  Thời Gian Làm Bài (Phút) <span className="text-[#E63946]">*</span>
                </label>
                <span className="text-xs font-black text-[#111111] bg-[#FFC93C] px-2.5 py-0.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                  {duration} Phút
                </span>
              </div>
              <input
                type="number"
                value={duration}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setDuration(isNaN(val) ? 0 : Math.max(1, val));
                }}
                required
                min={1}
                max={360}
                className="w-full p-3 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[#111111] outline-none text-sm font-black mb-2"
                placeholder="Nhập số phút làm bài (VD: 45, 60, 90)..."
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {[15, 30, 45, 50, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDuration(mins)}
                    className={`px-2.5 py-1 text-[11px] font-black uppercase transition-all border-2 border-[#111111] ${
                      duration === mins
                        ? 'bg-[#4D6BFE] text-white shadow-[2px_2px_0px_#111111]'
                        : 'bg-white text-[#111111] hover:bg-[#FDF6E9]'
                    }`}
                  >
                    {mins} phút
                  </button>
                ))}
              </div>
            </div>

            {/* MAX ATTEMPTS / RETAKE LIMIT SETTING */}
            <div className="pt-3 border-t-2 border-[#111111]">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[#111111] text-xs font-black uppercase flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-[#4D6BFE]" />
                  Số Lần Làm Bài Tối Đa (Thi Lại)
                </label>
                <span className={`text-xs font-black px-2.5 py-0.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] ${
                  maxAttempts === 0 ? 'bg-[#0F9D58] text-white' : maxAttempts === 1 ? 'bg-[#E63946] text-white' : 'bg-[#FFC93C] text-[#111111]'
                }`}>
                  {maxAttempts === 0 ? 'Không Giới Hạn' : `Tối Đa ${maxAttempts} Lần`}
                </span>
              </div>

              <input
                type="number"
                value={maxAttempts}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setMaxAttempts(isNaN(val) || val < 0 ? 0 : val);
                }}
                min={0}
                max={50}
                className="w-full p-3 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[#111111] outline-none text-sm font-black mb-2"
                placeholder="0 = Không giới hạn, 1 = Chỉ 1 lần duy nhất, 2, 3,..."
              />

              {/* Quick Attempts Preset Buttons */}
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {[
                  { label: 'Không giới hạn (0)', val: 0 },
                  { label: '1 lần (Duy nhất)', val: 1 },
                  { label: '2 lần thi', val: 2 },
                  { label: '3 lần thi', val: 3 },
                  { label: '5 lần thi', val: 5 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setMaxAttempts(item.val)}
                    className={`px-2.5 py-1 text-[11px] font-black uppercase transition-all border-2 border-[#111111] ${
                      maxAttempts === item.val
                        ? 'bg-[#4D6BFE] text-white shadow-[2px_2px_0px_#111111]'
                        : 'bg-white text-[#111111] hover:bg-[#FDF6E9]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-neutral-600 font-bold leading-tight">
                * Nếu đặt là <strong>1 lần</strong>: Học sinh chỉ nộp bài 1 lần và không được thi lại (trừ khi giáo viên xóa bài làm cũ trong mục Nhật Ký).
              </p>
            </div>
          </div>

          {/* CRITICAL FEATURE: TARGET CLASS SELECTION */}
          <div className="bg-[#FDF6E9] p-5 border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#111111] pb-2">
              <h3 className="text-xs font-black text-[#111111] uppercase tracking-widest flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#4D6BFE]" />
                2. Chọn Lớp / Nhóm Học Sinh Được Làm Bài
              </h3>
            </div>

            <p className="text-xs text-neutral-700 font-bold leading-relaxed">
              Tính năng phân lớp: Học sinh thuộc lớp được chọn mới nhìn thấy và làm bài thi này.
            </p>

            {/* Quick Class Selection Chips */}
            <div>
              <label className="block text-[11px] font-black text-[#111111] mb-2 uppercase">
                Chọn Nhanh Lớp Học Cho Đề Thi:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTargetGroup('Tất cả')}
                  className={`px-3 py-1.5 text-xs font-black uppercase transition-all border-2 border-[#111111] ${
                    targetGroup.toLowerCase().includes('tất cả')
                      ? 'bg-[#FFC93C] text-[#111111] shadow-[2px_2px_0px_#111111]'
                      : 'bg-white text-[#111111] hover:bg-[#FDF6E9]'
                  }`}
                >
                  Tất Cả Các Lớp
                </button>

                {availableClasses
                  .filter((c) => c !== 'Tất cả')
                  .map((clsName) => {
                    const isSelected = targetGroup
                      .split(',')
                      .map((s) => s.trim().toLowerCase())
                      .includes(clsName.toLowerCase());

                    return (
                      <button
                        key={clsName}
                        type="button"
                        onClick={() => handleToggleClass(clsName)}
                        className={`px-3 py-1.5 text-xs font-black uppercase transition-all border-2 border-[#111111] ${
                          isSelected
                            ? 'bg-[#4D6BFE] text-white shadow-[2px_2px_0px_#111111]'
                            : 'bg-white text-[#111111] hover:bg-[#FDF6E9]'
                        }`}
                      >
                        Lớp {clsName}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                Hoặc Nhập Tên Lớp Chỉ Định Cụ Thể (Phân cách bằng dấu phẩy):
              </label>
              <input
                type="text"
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className="w-full p-2.5 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs text-[#111111] font-black outline-none"
                placeholder="VD: 12A1, 12A2"
              />
            </div>
          </div>

          {/* Exam Structure */}
          <div className="bg-[#FDF6E9] p-5 border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-4">
            <h3 className="text-xs font-black text-[#111111] uppercase tracking-widest border-b-2 border-[#111111] pb-2">
              3. Cấu Trúc Ma Trận Câu Hỏi
            </h3>
            <div>
              <label className="block text-[#111111] text-xs font-black mb-1.5 uppercase">
                Hình Thức Đề Thi
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as any)}
                className="w-full p-3 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[#111111] text-xs font-black outline-none cursor-pointer"
              >
                <option value="fixed">Mặc định Bộ GD&ĐT (12 câu P1 - 4 câu P2 - 6 câu P3)</option>
                <option value="custom">Tùy biến số lượng câu hỏi</option>
              </select>
            </div>

            {examType === 'custom' && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-[#111111]">
                <div>
                  <label className="block text-[#111111] text-[10px] font-black mb-1">Số câu P1 (Trắc nghiệm)</label>
                  <input
                    type="number"
                    min={0}
                    value={numP1}
                    onChange={(e) => setNumP1(Number(e.target.value))}
                    className="w-full p-2 bg-white border-2 border-[#111111] text-[#111111] text-xs font-black"
                  />
                </div>
                <div>
                  <label className="block text-[#111111] text-[10px] font-black mb-1">Số câu P2 (Đúng/Sai)</label>
                  <input
                    type="number"
                    min={0}
                    value={numP2}
                    onChange={(e) => setNumP2(Number(e.target.value))}
                    className="w-full p-2 bg-white border-2 border-[#111111] text-[#111111] text-xs font-black"
                  />
                </div>
                <div>
                  <label className="block text-[#111111] text-[10px] font-black mb-1">Số câu P3 (Điền ngắn)</label>
                  <input
                    type="number"
                    min={0}
                    value={numP3}
                    onChange={(e) => setNumP3(Number(e.target.value))}
                    className="w-full p-2 bg-white border-2 border-[#111111] text-[#111111] text-xs font-black"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Timing & File upload */}
          <div className="bg-[#FDF6E9] p-5 border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-4">
            <h3 className="text-xs font-black text-[#111111] uppercase tracking-widest border-b-2 border-[#111111] pb-2">
              4. Giờ Mở Đề & Tải File Đề Thi PDF
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-800 text-[11px] font-black mb-1 uppercase">Giờ Mở Đề</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-[#111111] text-[#111111] font-bold text-xs"
                />
              </div>
              <div>
                <label className="block text-neutral-800 text-[11px] font-black mb-1 uppercase">Giờ Đóng Đề</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-[#111111] text-[#111111] font-bold text-xs"
                />
              </div>
            </div>

            {/* Section 4: File PDF Display / Upload */}
            {hasExistingFile && !isReplacingFile ? (
              /* EXISTING FILE CARD */
              <div className="p-4 bg-white border-2 border-[#111111] shadow-[3px_3px_0px_#111111] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#0F9D58] font-black text-xs uppercase">
                    <FileCheck className="w-4 h-4 text-[#0F9D58]" />
                    <span>File Đề Thi Đã Được Lưu</span>
                  </div>
                  <span className="text-[10px] bg-[#0F9D58] text-white px-2 py-0.5 border-2 border-[#111111] font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-white" /> Đang Hoạt Động
                  </span>
                </div>

                <div className="bg-[#FDF6E9] p-3 border-2 border-[#111111] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-[#111111] truncate">
                      {initialFileLink.startsWith('data:') 
                        ? '📄 File PDF đã lưu trong hệ thống' 
                        : (initialFileLink.includes('drive.google.com') ? '☁️ File PDF trên Google Drive' : initialFileLink)}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowPreviewModal(true)}
                        className="px-2.5 py-1.5 bg-[#4D6BFE] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs font-black flex items-center gap-1 active:translate-x-[1px] active:translate-y-[1px]"
                        title="Xem thử đề thi"
                      >
                        <Eye className="w-3.5 h-3.5" /> Xem thử PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsReplacingFile(true)}
                        className="px-2.5 py-1.5 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs font-black flex items-center gap-1 active:translate-x-[1px] active:translate-y-[1px]"
                        title="Thay đổi sang file đề khác"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Đổi file
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-800 font-bold leading-relaxed bg-white p-2 border-2 border-[#111111]">
                    💡 <strong>Lưu ý:</strong> Đề thi đã có sẵn file đề. Bạn có thể thoải mái chỉnh sửa <strong>thời gian làm bài, giờ mở/đóng đề, lớp học, đáp án</strong> rồi bấm <strong>"Lưu & Phân Lớp Đề Thi"</strong> mà <u>không cần</u> tải lại file.
                  </p>
                </div>
              </div>
            ) : (
              /* UPLOAD / CHANGE FILE SECTION */
              <div className="space-y-4">
                {hasExistingFile && isReplacingFile && (
                  <div className="flex items-center justify-between p-2.5 bg-[#FFC93C] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    <span className="text-xs text-[#111111] font-black flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-[#111111]" /> Đang ở chế độ thay đổi file đề mới
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsReplacingFile(false);
                        setUploadFile(null);
                        setFileLink(isInitialBase64 ? '' : initialFileLink);
                      }}
                      className="px-2.5 py-1 bg-white text-[#111111] border-2 border-[#111111] text-xs font-black"
                    >
                      Giữ lại file cũ
                    </button>
                  </div>
                )}

                {/* Upload PDF File Directly */}
                <div className="p-4 bg-white border-2 border-[#111111] shadow-[3px_3px_0px_#111111] space-y-3">
                  <label className="block text-[#111111] font-black text-xs uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-[#4D6BFE]" /> Cách 1: Tải File PDF Mới & Đẩy Lên Drive
                    </span>
                    <span className="text-[10px] text-[#0F9D58] font-black flex items-center gap-1">
                      <Cloud className="w-3 h-3 text-[#0F9D58]" /> Tự động đẩy lên Google Drive
                    </span>
                  </label>

                  {/* Upload Status Banner */}
                  {isUploadingToDrive && (
                    <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] flex items-center gap-2.5 text-[#111111] text-xs font-bold">
                      <Loader2 className="w-4 h-4 text-[#4D6BFE] animate-spin shrink-0" />
                      <div>
                        <p className="font-black text-[#111111]">Đang tải file lên Google Drive qua Apps Script...</p>
                        <p className="text-[10px] text-neutral-700">File sẽ được lưu vào thư mục [DeThi_Online_Drive] và tạo link công khai.</p>
                      </div>
                    </div>
                  )}

                  {driveUploadSuccessMsg && (
                    <div className="p-3 bg-[#0F9D58]/10 border-2 border-[#0F9D58] flex items-start gap-2 text-[#0F9D58] text-xs">
                      <CheckCircle2 className="w-4 h-4 text-[#0F9D58] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-black text-[#0F9D58]">Đã tải lên Google Drive thành công!</p>
                        <p className="text-[10px] font-bold text-neutral-800 mt-0.5">
                          File đã được lưu vào thư mục <strong>DeThi_Online_Drive</strong> và link xem trước được gắn vào đề thi.
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            type="button"
                            onClick={() => setShowPreviewModal(true)}
                            className="text-[11px] font-black text-[#4D6BFE] underline flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Xem thử PDF
                          </button>
                          {fileLink && (
                            <a
                              href={fileLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-black text-[#111111] underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Mở trên Google Drive
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {driveUploadErrorMsg && (
                    <div className="p-3 bg-[#FFC93C]/20 border-2 border-[#111111] flex items-start gap-2 text-[#111111] text-xs">
                      <AlertCircle className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-black text-[#111111]">Thông báo tải lên Google Drive:</p>
                        <p className="text-[11px] font-bold text-neutral-800 mt-0.5 leading-relaxed">{driveUploadErrorMsg}</p>
                        <p className="text-[10px] font-bold text-neutral-600 mt-1">
                          💡 Hệ thống vẫn lưu trữ file PDF trực tiếp để học sinh làm bài bình thường.
                        </p>
                      </div>
                    </div>
                  )}

                  {uploadFile ? (
                    <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <FileCheck className="w-5 h-5 text-[#0F9D58] shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-black text-[#111111] truncate">{uploadFile.name}</p>
                            <p className="text-[10px] font-bold text-neutral-600">{uploadFile.size}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowPreviewModal(true)}
                            className="px-2.5 py-1 bg-[#4D6BFE] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs font-black flex items-center gap-1"
                            title="Xem thử file PDF"
                          >
                            <Eye className="w-3.5 h-3.5" /> Xem thử
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveUploadedFile}
                            className="p-1.5 bg-white text-[#E63946] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] hover:bg-[#E63946] hover:text-white transition-colors"
                            title="Xóa file tải lên"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Manual Push to Drive Button if not uploaded yet */}
                      {!isUploadingToDrive && (
                        <div className="pt-2 border-t-2 border-[#111111] flex items-center justify-between">
                          <span className="text-[10px] font-bold text-neutral-700">Đã chọn file PDF mới</span>
                          <button
                            type="button"
                            onClick={() => handleUploadToGoogleDriveDirect(uploadFile.base64, uploadFile.name)}
                            className="px-3 py-1.5 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[11px] font-black flex items-center gap-1.5 transition-all"
                          >
                            <Cloud className="w-3.5 h-3.5" /> Đẩy Lên Google Drive Ngay
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        className="w-full text-xs text-neutral-800 font-bold file:mr-3 file:py-2 file:px-4 file:border-2 file:border-[#111111] file:shadow-[2px_2px_0px_#111111] file:text-xs file:font-black file:bg-[#FFC93C] file:text-[#111111] hover:file:bg-[#ffd460] cursor-pointer"
                      />
                      <p className="text-[10px] font-bold text-neutral-700 mt-1.5 leading-relaxed">
                        Chọn file PDF đề thi từ máy tính. Hệ thống sẽ tự động lưu và đẩy lên thư mục <strong>DeThi_Online_Drive</strong> trên Google Drive của giáo viên.
                      </p>
                    </div>
                  )}
                </div>

                {/* Paste Link Option */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#111111] text-xs font-black mb-1.5 uppercase flex items-center gap-1">
                      <LinkIcon className="w-3.5 h-3.5 text-[#4D6BFE]" /> Cách 2: Hoặc Dán Link Google Drive Đề Thi
                    </label>
                    <input
                      type="text"
                      value={fileLink}
                      onChange={(e) => {
                        setFileLink(e.target.value);
                        if (uploadFile) setUploadFile(null);
                      }}
                      disabled={!!uploadFile}
                      placeholder="https://drive.google.com/file/d/.../view"
                      className="w-full p-2.5 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs text-[#111111] font-mono font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    />

                    {/* Validation Status Indicator */}
                    {!uploadFile && fileLink.trim() && (
                      <div className={`mt-2 p-2.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs flex items-start gap-2 ${
                        pdfValidation.isValid 
                          ? 'bg-[#0F9D58]/10 text-[#0F9D58]' 
                          : 'bg-[#E63946]/10 text-[#E63946]'
                      }`}>
                        {pdfValidation.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-[#0F9D58] shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-[#E63946] shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-black">{pdfValidation.message}</p>
                          {pdfValidation.isValid && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                type="button"
                                onClick={() => setShowPreviewModal(true)}
                                className="text-[11px] font-black underline text-[#4D6BFE] flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> Xem trước khung đề
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[#111111] text-xs font-black mb-1.5 uppercase flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5 text-[#0F9D58]" /> Link File Lời Giải Chi Tiết (Tùy chọn)
              </label>
              <input
                type="text"
                value={explainLink}
                onChange={(e) => setExplainLink(e.target.value)}
                placeholder="https://drive.google.com/... (Xem sau khi nộp bài)"
                className="w-full p-2.5 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs text-[#111111] font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Answer Keys Setup */}
        <div className="lg:col-span-7 space-y-6 max-h-[780px] overflow-y-auto custom-scroll pr-2">
          {/* Section 5 Header & Quick Import Action Bar */}
          <div className="bg-[#FDF6E9] p-4 border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#111111] pb-3">
              <div>
                <h3 className="text-sm font-black text-[#111111] uppercase tracking-wider flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-[#FFC93C] border-2 border-[#111111]"></span>
                  5. Nhập Đáp Án Chuẩn Cho Đề Thi
                </h3>
                <p className="text-[11px] font-bold text-neutral-600 mt-0.5">
                  Chọn đáp án thủ công bên dưới hoặc dùng công cụ nạp tự động nhanh.
                </p>
              </div>

              {/* MAIN QUICK IMPORT BUTTON */}
              <button
                type="button"
                onClick={() => setShowQuickAnswerModal(true)}
                className="px-4 py-2 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] text-xs font-black uppercase flex items-center gap-2 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 text-[#111111] fill-[#111111]" />
                <span>Nạp Đáp Án Nhanh (Excel / Word / Dán)</span>
              </button>
            </div>

            {/* Sub Tools: Download Excel template & Clear */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={downloadSampleExcelTemplate}
                className="px-3 py-1.5 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[11px] font-black uppercase flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px] transition-all"
              >
                <Download className="w-3.5 h-3.5 text-[#0F9D58]" /> Tải File Mẫu Excel (.xlsx)
              </button>

              <button
                type="button"
                onClick={handleClearAllAnswers}
                className="px-3 py-1.5 bg-white hover:bg-[#E63946] hover:text-white text-[#E63946] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[11px] font-black uppercase flex items-center gap-1.5 transition-colors"
                title="Xóa tất cả các lựa chọn đáp án"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Xóa Tất Cả Đáp Án
              </button>
            </div>

            {/* Success notification banner */}
            {importSuccessMsg && (
              <div className="p-3 bg-[#0F9D58]/10 border-2 border-[#0F9D58] flex items-center justify-between gap-2 text-[#0F9D58] text-xs font-black shadow-[2px_2px_0px_#111111]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{importSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImportSuccessMsg(null)}
                  className="p-1 hover:bg-[#0F9D58]/20 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Part I Answers */}
          {numP1 > 0 && (
            <div className="bg-[#FDF6E9] p-5 border-2 border-[#111111] shadow-[4px_4px_0px_#111111]">
              <h4 className="text-xs font-black text-[#111111] uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-[#4D6BFE] border border-[#111111]"></span>
                Phần I: Đáp Án Trắc Nghiệm ({numP1} câu)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: numP1 }, (_, i) => i + 1).map((qNum) => (
                  <div key={qNum} className="flex items-center gap-2 bg-white p-2 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    <span className="text-xs font-black text-[#111111] w-8 text-center">C.{qNum}</span>
                    <select
                      value={ansP1[qNum] || ''}
                      onChange={(e) => setAnsP1({ ...ansP1, [qNum]: e.target.value as any })}
                      className="flex-1 bg-[#FDF6E9] text-[#111111] text-xs font-black p-1.5 border-2 border-[#111111] outline-none cursor-pointer"
                    >
                      <option value="">Chọn</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Part II Answers */}
          {numP2 > 0 && (
            <div className="bg-[#FDF6E9] p-5 border-2 border-[#111111] shadow-[4px_4px_0px_#111111]">
              <h4 className="text-xs font-black text-[#111111] uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-[#FFC93C] border border-[#111111]"></span>
                Phần II: Đáp Án Đúng / Sai ({numP2} câu)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: numP2 }, (_, i) => i + 1).map((qNum) => (
                  <div key={qNum} className="bg-white p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    <span className="text-xs font-black text-[#111111] block mb-2 border-b-2 border-[#111111] pb-1">Câu {qNum}</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(['a', 'b', 'c', 'd'] as const).map((sub) => (
                        <div key={sub} className="flex items-center gap-2 bg-[#FDF6E9] p-1.5 border-2 border-[#111111]">
                          <span className="text-xs font-black uppercase w-4 text-[#111111]">{sub}</span>
                          <select
                            value={ansP2[qNum]?.[sub] || ''}
                            onChange={(e) =>
                              setAnsP2({
                                ...ansP2,
                                [qNum]: { ...(ansP2[qNum] || {}), [sub]: e.target.value as any },
                              })
                            }
                            className="flex-1 bg-white text-[#111111] text-xs font-black p-1 border-2 border-[#111111] outline-none cursor-pointer"
                          >
                            <option value="">-</option>
                            <option value="Đ">Đúng</option>
                            <option value="S">Sai</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Part III Answers */}
          {numP3 > 0 && (
            <div className="bg-[#FDF6E9] p-5 border-2 border-[#111111] shadow-[4px_4px_0px_#111111]">
              <h4 className="text-xs font-black text-[#111111] uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-[#0F9D58] border border-[#111111]"></span>
                Phần III: Đáp Án Trả Lời Ngắn ({numP3} câu)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: numP3 }, (_, i) => i + 1).map((qNum) => (
                  <div key={qNum} className="flex items-center gap-2 bg-white p-2.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    <span className="text-xs font-black text-[#111111] w-10 text-center">C.{qNum}</span>
                    <input
                      type="text"
                      value={ansP3[qNum] || ''}
                      onChange={(e) => setAnsP3({ ...ansP3, [qNum]: e.target.value })}
                      className="flex-1 bg-[#FDF6E9] border-2 border-[#111111] p-1.5 text-[#111111] text-xs font-black outline-none"
                      placeholder="Đáp số (VD: 15)..."
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mt-8 pt-5 border-t-2 border-[#111111]">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 font-black uppercase text-xs tracking-wider bg-white text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] hover:bg-[#FDF6E9] active:translate-x-[1px] active:translate-y-[1px] transition-all"
        >
          Hủy Bỏ
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-3 font-black uppercase text-xs tracking-wider bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] hover:bg-[#ffd460] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Đang lưu...' : 'Lưu & Phân Lớp Đề Thi'}
        </button>
      </div>

      {/* PDF Preview Modal for Teacher */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-[#111111]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-3 border-[#111111] shadow-[8px_8px_0px_#111111] w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-[#FDF6E9] border-b-2 border-[#111111] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#4D6BFE]" />
                <h3 className="font-black text-sm text-[#111111] uppercase">Xem Trước Đề Thi PDF Giáo Viên Thiết Lập</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 bg-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] hover:bg-[#E63946] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-[#FDF6E9] p-4 overflow-hidden flex flex-col">
              {effectivePdfData ? (
                <div className="flex-1 w-full h-full border-2 border-[#111111] shadow-[3px_3px_0px_#111111] overflow-hidden">
                  <PdfViewer fileUrl={effectivePdfData} title={title || 'Xem trước đề thi'} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-600 font-bold">
                  <AlertCircle className="w-10 h-10 mb-2" />
                  <p>Chưa có dữ liệu PDF để xem trước.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Answer Importer Modal (Excel / Word / Text Paste) */}
      <QuickAnswerModal
        isOpen={showQuickAnswerModal}
        onClose={() => setShowQuickAnswerModal(false)}
        onApply={handleApplyQuickAnswers}
        currentCounts={{
          numP1,
          numP2,
          numP3,
        }}
      />
    </form>
  );
};

