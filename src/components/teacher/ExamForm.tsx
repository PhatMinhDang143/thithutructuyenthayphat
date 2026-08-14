import React, { useState, useEffect } from 'react';
import { ExamItem, AnswerKeyPart1, AnswerKeyPart2, AnswerKeyPart3 } from '../../types';
import { 
  FilePlus, Save, Loader2, UploadCloud, Clock, Timer, Users, Layers, 
  AlertCircle, FileCheck, CheckCircle2, X, ExternalLink, Eye, Info, Link as LinkIcon, Trash2
} from 'lucide-react';
import { normalizePdfUrl, validatePdfInput } from '../../utils/pdfUtils';

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
  const [duration, setDuration] = useState(initialData?.duration || 45);
  const [examType, setExamType] = useState<'fixed' | 'custom'>(initialData?.questions?.exam_type || 'fixed');

  const [numP1, setNumP1] = useState(initialData?.questions?.num_p1 ?? 12);
  const [numP2, setNumP2] = useState(initialData?.questions?.num_p2 ?? 4);
  const [numP3, setNumP3] = useState(initialData?.questions?.num_p3 ?? 6);

  // TARGET CLASS SELECTION FEATURE (Lớp được phép làm bài)
  const [targetGroup, setTargetGroup] = useState(initialData?.questions?.target_group || 'Tất cả');

  const [startTime, setStartTime] = useState(initialData?.questions?.start_time || '');
  const [endTime, setEndTime] = useState(initialData?.questions?.end_time || '');

  // PDF Source State
  const initialFileLink = initialData?.questions?.file_link || '';
  const isInitialBase64 = initialFileLink.startsWith('data:application/pdf') || initialFileLink.startsWith('data:');
  
  const [fileLink, setFileLink] = useState(isInitialBase64 ? '' : initialFileLink);
  const [explainLink, setExplainLink] = useState(initialData?.questions?.explain_link || '');
  
  const [uploadFile, setUploadFile] = useState<{ name: string; size: string; base64: string } | null>(
    isInitialBase64 ? { name: 'File_PDF_Da_Luu.pdf', size: 'Đã lưu trong hệ thống', base64: initialFileLink } : null
  );

  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [ansP1, setAnsP1] = useState<AnswerKeyPart1>(initialData?.answers?.p1 || {});
  const [ansP2, setAnsP2] = useState<AnswerKeyPart2>(initialData?.answers?.p2 || {});
  const [ansP3, setAnsP3] = useState<AnswerKeyPart3>(initialData?.answers?.p3 || {});

  const [isSaving, setIsSaving] = useState(false);

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
      if (file.size > 3.5 * 1024 * 1024) {
        alert(
          `File PDF "${file.name}" dung lượng ${(file.size / (1024 * 1024)).toFixed(1)}MB vượt quá giới hạn tải trực tiếp (tối đa 3.5MB do giới hạn bộ nhớ trình duyệt).\n\n💡 KHUYẾN NGHỊ: Thầy cô vui lòng tải file lên Google Drive, mở quyền "Bất kỳ ai có liên kết đều có thể xem" và dán link vào ô "Link File Đề Thi (Google Drive)" bên dưới để đảm bảo mọi học sinh xem đề mượt mà và không lo đầy bộ nhớ!`
        );
        return;
      }

      const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      const reader = new FileReader();
      reader.onload = (ev) => {
        const resultStr = ev.target?.result as string;
        if (resultStr) {
          setUploadFile({
            name: file.name,
            size: sizeFormatted,
            base64: resultStr,
          });
          // Clear link input to avoid confusion
          setFileLink('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveUploadedFile = () => {
    setUploadFile(null);
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
  const effectivePdfData = uploadFile?.base64 || fileLink.trim();
  const pdfValidation = validatePdfInput(fileLink.trim(), !!uploadFile?.base64);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề đề thi!');
      return;
    }

    // 1. Resolve Final PDF URL/Base64
    let finalFileLink = '';
    if (uploadFile && uploadFile.base64) {
      // Prioritize directly uploaded base64 file
      finalFileLink = uploadFile.base64;
    } else if (fileLink.trim()) {
      const normalized = normalizePdfUrl(fileLink.trim());
      if (normalized.error) {
        if (!window.confirm(`Cảnh báo link đề thi:\n${normalized.error}\n\nBạn có muốn tiếp tục lưu không?`)) {
          return;
        }
      }
      finalFileLink = normalized.previewUrl || fileLink.trim();
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
    const payload: ExamItem = {
      id: initialData?.id || 'ex_' + Date.now(),
      title: title.trim(),
      duration: Number(duration),
      questions: {
        exam_type: examType,
        num_p1: Number(numP1),
        num_p2: Number(numP2),
        num_p3: Number(numP3),
        target_group: targetGroup.trim() || 'Tất cả',
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
    <form onSubmit={handleSubmit} className="cyber-panel p-6 md:p-8 rounded-2xl shadow-2xl border border-slate-800">
      <div className="flex justify-between items-center border-b border-slate-800 pb-5 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            <FilePlus className="w-6 h-6 text-indigo-500" />
            {initialData ? 'Cập Nhật Cấu Trúc & Phân Lớp Đề Thi' : 'Tạo Đề Thi Mới & Phân Cho Lớp Học'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Thiết lập đề thi PDF, đáp án chuẩn, ma trận câu hỏi và chỉ định lớp học sinh được làm bài.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Config Settings */}
        <div className="lg:col-span-5 space-y-6">
          {/* General info */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-2">
              1. Thông Tin Chung
            </h3>
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase">
                Tiêu Đề Đề Thi <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-xs font-medium"
                placeholder="VD: Đề thi khảo sát Toán Lớp 12A1..."
              />
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase">
                Thời Gian Làm Bài (Phút) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                required
                min={1}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-xs font-medium"
              />
            </div>
          </div>

          {/* CRITICAL FEATURE: TARGET CLASS SELECTION */}
          <div className="bg-indigo-950/40 p-5 rounded-2xl border border-indigo-800/80 space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-800/60 pb-2">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-400" />
                2. Chọn Lớp / Nhóm Học Sinh Được Làm Bài
              </h3>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Tính năng phân lớp: Học sinh thuộc lớp được chọn mới nhìn thấy và làm bài thi này.
            </p>

            {/* Quick Class Selection Chips */}
            <div>
              <label className="block text-[11px] font-bold text-indigo-300 mb-2 uppercase">
                Chọn Nhanh Lớp Học Cho Đề Thi:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTargetGroup('Tất cả')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    targetGroup.toLowerCase().includes('tất cả')
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        Lớp {clsName}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Hoặc Nhập Tên Lớp Chỉ Định Cụ Thể (Phân cách bằng dấu phẩy):
              </label>
              <input
                type="text"
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-indigo-300 font-bold outline-none focus:border-indigo-500"
                placeholder="VD: 12A1, 12A2"
              />
            </div>
          </div>

          {/* Exam Structure */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest border-b border-slate-800 pb-2">
              3. Cấu Trúc Ma Trận Câu Hỏi
            </h3>
            <div>
              <label className="block text-slate-300 text-xs font-semibold mb-1.5 uppercase">
                Hình Thức Đề Thi
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as any)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-medium outline-none focus:border-cyan-500"
              >
                <option value="fixed">Mặc định Bộ GD&ĐT (12 câu P1 - 4 câu P2 - 6 câu P3)</option>
                <option value="custom">Tùy biến số lượng câu hỏi</option>
              </select>
            </div>

            {examType === 'custom' && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 border-dashed">
                <div>
                  <label className="block text-slate-400 text-[10px] font-bold mb-1">Số câu P1 (Trắc nghiệm)</label>
                  <input
                    type="number"
                    min={0}
                    value={numP1}
                    onChange={(e) => setNumP1(Number(e.target.value))}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] font-bold mb-1">Số câu P2 (Đúng/Sai)</label>
                  <input
                    type="number"
                    min={0}
                    value={numP2}
                    onChange={(e) => setNumP2(Number(e.target.value))}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] font-bold mb-1">Số câu P3 (Điền ngắn)</label>
                  <input
                    type="number"
                    min={0}
                    value={numP3}
                    onChange={(e) => setNumP3(Number(e.target.value))}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Timing & File upload */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest border-b border-slate-800 pb-2">
              4. Giờ Mở Đề & Tải File Đề Thi PDF
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1 uppercase">Giờ Mở Đề</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1 uppercase">Giờ Đóng Đề</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                />
              </div>
            </div>

            {/* Upload PDF File Directly */}
            <div className="p-4 bg-purple-950/20 border border-purple-900/40 rounded-xl space-y-2">
              <label className="block text-purple-300 font-bold text-xs uppercase flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-purple-400" /> Cách 1: Tải File PDF Trực Tiếp Từ Máy
                </span>
                <span className="text-[10px] text-emerald-400 font-normal">Khuyên dùng (100% hiển thị)</span>
              </label>

              {uploadFile ? (
                <div className="flex items-center justify-between p-3 bg-slate-950 border border-emerald-500/40 rounded-xl">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-emerald-300 truncate">{uploadFile.name}</p>
                      <p className="text-[10px] text-slate-400">{uploadFile.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPreviewModal(true)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                      title="Xem thử file PDF"
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem thử
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveUploadedFile}
                      className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600/30 rounded-lg transition-colors"
                      title="Xóa file tải lên"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    File PDF tải lên sẽ được lưu trữ trực tiếp vào đề thi, không lo bị chặn quyền xem.
                  </p>
                </div>
              )}
            </div>

            {/* Paste Link Option */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5 text-indigo-400" /> Cách 2: Hoặc Dán Link Google Drive Đề Thi
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
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-indigo-300 font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                />

                {/* Validation Status Indicator */}
                {!uploadFile && fileLink.trim() && (
                  <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                    pdfValidation.isValid 
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300' 
                      : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                  }`}>
                    {pdfValidation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold">{pdfValidation.message}</p>
                      {pdfValidation.isValid && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => setShowPreviewModal(true)}
                            className="text-[11px] font-bold underline text-indigo-300 hover:text-white flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Xem trước khung đề
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" /> Link File Lời Giải Chi Tiết (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={explainLink}
                  onChange={(e) => setExplainLink(e.target.value)}
                  placeholder="https://drive.google.com/... (Xem sau khi nộp bài)"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-300 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Answer Keys Setup */}
        <div className="lg:col-span-7 space-y-6 max-h-[780px] overflow-y-auto custom-scroll pr-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider bg-slate-900 p-3 rounded-xl border border-slate-800">
            5. Nhập Đáp Án Chuẩn Cho Đề Thi
          </h3>

          {/* Part I Answers */}
          {numP1 > 0 && (
            <div className="bg-indigo-950/20 p-5 rounded-2xl border border-indigo-800/40">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">
                Phần I: Đáp Án Trắc Nghiệm ({numP1} câu)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: numP1 }, (_, i) => i + 1).map((qNum) => (
                  <div key={qNum} className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-slate-400 w-8 text-center">C.{qNum}</span>
                    <select
                      value={ansP1[qNum] || ''}
                      onChange={(e) => setAnsP1({ ...ansP1, [qNum]: e.target.value as any })}
                      className="flex-1 bg-slate-900 text-white text-xs font-bold p-1.5 rounded border border-slate-800 outline-none focus:border-indigo-500"
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
            <div className="bg-cyan-950/20 p-5 rounded-2xl border border-cyan-800/40">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">
                Phần II: Đáp Án Đúng / Sai ({numP2} câu)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: numP2 }, (_, i) => i + 1).map((qNum) => (
                  <div key={qNum} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-slate-300 block mb-2 border-b border-slate-800 pb-1">Câu {qNum}</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(['a', 'b', 'c', 'd'] as const).map((sub) => (
                        <div key={sub} className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                          <span className="text-xs font-bold uppercase w-4 text-slate-400">{sub}</span>
                          <select
                            value={ansP2[qNum]?.[sub] || ''}
                            onChange={(e) =>
                              setAnsP2({
                                ...ansP2,
                                [qNum]: { ...(ansP2[qNum] || {}), [sub]: e.target.value as any },
                              })
                            }
                            className="flex-1 bg-slate-950 text-white text-xs font-bold p-1 rounded outline-none"
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
            <div className="bg-purple-950/20 p-5 rounded-2xl border border-purple-800/40">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">
                Phần III: Đáp Án Trả Lời Ngắn ({numP3} câu)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: numP3 }, (_, i) => i + 1).map((qNum) => (
                  <div key={qNum} className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-slate-400 w-10 text-center">C.{qNum}</span>
                    <input
                      type="text"
                      value={ansP3[qNum] || ''}
                      onChange={(e) => setAnsP3({ ...ansP3, [qNum]: e.target.value })}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white text-xs font-bold outline-none focus:border-purple-500"
                      placeholder="Đáp số chuẩn (VD: 15)..."
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-wider bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Hủy Bỏ
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-wider bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-cyan-500 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? 'Đang lưu...' : 'Lưu & Phân Lớp Đề Thi'}
        </button>
      </div>

      {/* PDF Preview Modal for Teacher */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Xem Trước Đề Thi PDF Giáo Viên Thiết Lập</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-950 p-2">
              {effectivePdfData ? (
                <iframe
                  src={normalizePdfUrl(effectivePdfData).previewUrl}
                  title="PDF Preview"
                  className="w-full h-full rounded-xl bg-white"
                  allow="autoplay"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <AlertCircle className="w-10 h-10 mb-2" />
                  <p>Chưa có dữ liệu PDF để xem trước.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

