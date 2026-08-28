import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ClipboardPaste,
  ArrowRight,
  Info,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  ParsedAnswersResult,
  parseAnswersFromFile,
  parseAnswersFromText,
  downloadSampleExcelTemplate,
} from '../../utils/answerParser';

interface QuickAnswerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: {
    p1: Record<number, 'A' | 'B' | 'C' | 'D'>;
    p2: Record<number, Record<'a' | 'b' | 'c' | 'd', 'Đ' | 'S'>>;
    p3: Record<number, string>;
    suggestedCounts?: { numP1?: number; numP2?: number; numP3?: number };
  }) => void;
  currentCounts: {
    numP1: number;
    numP2: number;
    numP3: number;
  };
}

export const QuickAnswerModal: React.FC<QuickAnswerModalProps> = ({
  isOpen,
  onClose,
  onApply,
  currentCounts,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [inputText, setInputText] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedAnswersResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [syncQuestionCounts, setSyncQuestionCounts] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setErrorMsg(null);
    setFileName(file.name);
    try {
      const result = await parseAnswersFromFile(file);
      if (result.p1Count === 0 && result.p2Count === 0 && result.p3Count === 0) {
        setErrorMsg(
          'Không tìm thấy đáp án hợp lệ trong file. Vui lòng kiểm tra định dạng hoặc dùng file Excel mẫu bên dưới.'
        );
        setParsedResult(null);
      } else {
        setParsedResult(result);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Lỗi khi đọc file: ${err?.message || 'Định dạng file không được hỗ trợ'}`);
      setParsedResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    setErrorMsg(null);
    if (!text.trim()) {
      setParsedResult(null);
      return;
    }
    const result = parseAnswersFromText(text);
    setParsedResult(result);
  };

  const handleApply = () => {
    if (!parsedResult) return;

    const maxP1Key = Math.max(0, ...Object.keys(parsedResult.p1).map(Number));
    const maxP2Key = Math.max(0, ...Object.keys(parsedResult.p2).map(Number));
    const maxP3Key = Math.max(0, ...Object.keys(parsedResult.p3).map(Number));

    const suggestedCounts = syncQuestionCounts
      ? {
          numP1: maxP1Key > 0 ? Math.max(currentCounts.numP1, maxP1Key) : undefined,
          numP2: maxP2Key > 0 ? Math.max(currentCounts.numP2, maxP2Key) : undefined,
          numP3: maxP3Key > 0 ? Math.max(currentCounts.numP3, maxP3Key) : undefined,
        }
      : undefined;

    onApply({
      p1: parsedResult.p1,
      p2: parsedResult.p2,
      p3: parsedResult.p3,
      suggestedCounts,
    });
    onClose();
  };

  const fillSampleText = (type: 'standard' | 'p1only' | 'compact') => {
    if (type === 'standard') {
      const sample = `PHẦN I: TRẮC NGHIỆM
1.A  2.B  3.C  4.D  5.A  6.B  7.C  8.D  9.A  10.B  11.C  12.D

PHẦN II: ĐÚNG SAI
Câu 1: a-Đ, b-S, c-Đ, d-S
Câu 2: a-S, b-Đ, c-S, d-Đ
Câu 3: a-Đ, b-Đ, c-S, d-S
Câu 4: a-S, b-S, c-Đ, d-Đ

PHẦN III: TRẢ LỜI NGẮN
Câu 1: 15
Câu 2: -3.5
Câu 3: 2024
Câu 4: 1/2
Câu 5: 45
Câu 6: 100`;
      setInputText(sample);
      handleTextChange(sample);
    } else if (type === 'p1only') {
      const sample = `1.A  2.B  3.C  4.D  5.A  6.B  7.C  8.D  9.A  10.B  11.C  12.D  13.A  14.B  15.C  16.D  17.A  18.B  19.C  20.D`;
      setInputText(sample);
      handleTextChange(sample);
    } else if (type === 'compact') {
      const sample = `ABCDABCDABCD`;
      setInputText(sample);
      handleTextChange(sample);
    }
  };

  const totalDetected =
    (parsedResult?.p1Count || 0) + (parsedResult?.p2Count || 0) + (parsedResult?.p3Count || 0);

  return (
    <div className="fixed inset-0 z-50 bg-[#111111]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-3 border-[#111111] shadow-[8px_8px_0px_#111111] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-[#111111]">
        {/* Header */}
        <div className="p-4 md:p-5 bg-[#FFC93C] border-b-2 border-[#111111] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
              <Sparkles className="w-5 h-5 text-[#4D6BFE]" />
            </div>
            <div>
              <h3 className="font-black text-base md:text-lg uppercase text-[#111111] tracking-wide">
                Nạp Đáp Án Nhanh Cho Đề Thi
              </h3>
              <p className="text-xs font-bold text-neutral-800">
                Nhập file Excel (.xlsx, .xls), Word (.docx) hoặc dán chuỗi đáp án chỉ với 1 cú click
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] hover:bg-[#E63946] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b-2 border-[#111111] bg-[#FDF6E9] px-4 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('file');
              setErrorMsg(null);
            }}
            className={`px-4 py-2 text-xs md:text-sm font-black uppercase flex items-center gap-2 border-2 border-[#111111] transition-all ${
              activeTab === 'file'
                ? 'bg-white shadow-[2px_-2px_0px_#111111] -mb-[2px] border-b-white z-10 text-[#4D6BFE]'
                : 'bg-[#FDF6E9] hover:bg-white text-neutral-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#0F9D58]" />
            1. Tải Lên File (Excel / Word / TXT)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('text');
              setErrorMsg(null);
            }}
            className={`px-4 py-2 text-xs md:text-sm font-black uppercase flex items-center gap-2 border-2 border-[#111111] transition-all ${
              activeTab === 'text'
                ? 'bg-white shadow-[2px_-2px_0px_#111111] -mb-[2px] border-b-white z-10 text-[#4D6BFE]'
                : 'bg-[#FDF6E9] hover:bg-white text-neutral-700'
            }`}
          >
            <ClipboardPaste className="w-4 h-4 text-[#4D6BFE]" />
            2. Dán Văn Bản / Chuỗi Đáp Án
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6 bg-white custom-scroll">
          {/* TAB 1: FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-3 border-dashed rounded-none text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-[#4D6BFE] bg-[#4D6BFE]/10 shadow-[4px_4px_0px_#111111]'
                    : 'border-[#111111] bg-[#FDF6E9] hover:bg-[#F5ECD7]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, .docx, .txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="p-3 bg-white border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
                    <Upload className="w-7 h-7 text-[#4D6BFE]" />
                  </div>
                  <p className="font-black text-sm md:text-base text-[#111111]">
                    {fileName ? `Đã chọn file: ${fileName}` : 'Kéo thả hoặc Nhấp để chọn File Đáp Án'}
                  </p>
                  <p className="text-xs font-bold text-neutral-600">
                    Hỗ trợ file Excel (<strong>.xlsx, .xls</strong>), Word (<strong>.docx</strong>), CSV và Text (<strong>.txt</strong>)
                  </p>
                </div>
              </div>

              {/* Sample Excel download and format tips */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#FDF6E9] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#0F9D58] shrink-0" />
                  <div>
                    <p className="text-xs font-black text-[#111111]">Bạn chưa có file theo mẫu chuẩn?</p>
                    <p className="text-[11px] font-bold text-neutral-600">
                      Tải mẫu Excel 3 phần thi theo chuẩn Bộ Giáo Dục để điền đáp án dễ dàng.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleExcelTemplate}
                  className="px-3 py-1.5 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs font-black uppercase flex items-center gap-1.5 hover:bg-[#ffd460] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Tải File Mẫu Excel (.xlsx)
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TEXT / PASTE */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-black uppercase text-[#111111] flex items-center gap-1">
                  <ClipboardPaste className="w-4 h-4 text-[#4D6BFE]" /> Dán Nội Dung Văn Bản / Bảng Đáp Án:
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-neutral-600">Điền nhanh mẫu:</span>
                  <button
                    type="button"
                    onClick={() => fillSampleText('standard')}
                    className="px-2 py-1 bg-[#FDF6E9] hover:bg-white text-[#111111] border-2 border-[#111111] text-[10px] font-black uppercase"
                  >
                    Chuẩn 3 Phần
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSampleText('p1only')}
                    className="px-2 py-1 bg-[#FDF6E9] hover:bg-white text-[#111111] border-2 border-[#111111] text-[10px] font-black uppercase"
                  >
                    1.A 2.B 3.C...
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSampleText('compact')}
                    className="px-2 py-1 bg-[#FDF6E9] hover:bg-white text-[#111111] border-2 border-[#111111] text-[10px] font-black uppercase"
                  >
                    ABCD...
                  </button>
                </div>
              </div>

              <textarea
                value={inputText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={`Dán đáp án vào đây, ví dụ:
1.A  2.B  3.C  4.D  5.A  6.B  7.C  8.D  9.A  10.B  11.C  12.D

Hoặc dạng Phần II:
Câu 1: a-Đ, b-S, c-Đ, d-S
Câu 2: a-S, b-Đ, c-S, d-Đ

Hoặc dạng Phần III:
Câu 1: 15
Câu 2: -3.5`}
                rows={7}
                className="w-full p-3 bg-white border-2 border-[#111111] shadow-[3px_3px_0px_#111111] text-xs md:text-sm font-mono font-bold text-[#111111] outline-none placeholder:text-neutral-400"
              />
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-[#E63946]/10 border-2 border-[#E63946] flex items-start gap-2 text-[#E63946] text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* PARSE RESULTS PREVIEW */}
          {parsedResult && totalDetected > 0 && (
            <div className="bg-[#FDF6E9] p-4 border-2 border-[#111111] shadow-[4px_4px_0px_#111111] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#111111] pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#0F9D58]" />
                  <span className="font-black text-xs md:text-sm uppercase text-[#111111]">
                    Kết Quả Nhận Diện Đáp Án ({totalDetected} mục đáp án)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {parsedResult.p1Count > 0 && (
                    <span className="px-2 py-0.5 bg-[#4D6BFE] text-white text-[11px] font-black border-2 border-[#111111] shadow-[1px_1px_0px_#111111]">
                      P1: {parsedResult.p1Count} câu
                    </span>
                  )}
                  {parsedResult.p2Count > 0 && (
                    <span className="px-2 py-0.5 bg-[#FFC93C] text-[#111111] text-[11px] font-black border-2 border-[#111111] shadow-[1px_1px_0px_#111111]">
                      P2: {parsedResult.p2Count} câu
                    </span>
                  )}
                  {parsedResult.p3Count > 0 && (
                    <span className="px-2 py-0.5 bg-[#0F9D58] text-white text-[11px] font-black border-2 border-[#111111] shadow-[1px_1px_0px_#111111]">
                      P3: {parsedResult.p3Count} câu
                    </span>
                  )}
                </div>
              </div>

              {/* Part 1 Preview */}
              {parsedResult.p1Count > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-black uppercase text-[#111111] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-[#4D6BFE] border border-[#111111]"></span>
                    Phần I: Trắc Nghiệm ({parsedResult.p1Count} câu)
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white border-2 border-[#111111]">
                    {Object.entries(parsedResult.p1)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([q, ans]) => (
                        <span
                          key={q}
                          className="px-2 py-1 bg-[#FDF6E9] border border-[#111111] text-xs font-black text-[#111111] flex items-center gap-1"
                        >
                          <span className="text-neutral-500 font-bold">C{q}:</span>
                          <span className="text-[#4D6BFE] font-black">{ans}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Part 2 Preview */}
              {parsedResult.p2Count > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-black uppercase text-[#111111] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-[#FFC93C] border border-[#111111]"></span>
                    Phần II: Đúng / Sai ({parsedResult.p2Count} câu)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-2 bg-white border-2 border-[#111111]">
                    {Object.entries(parsedResult.p2)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([q, subAns]: [string, Record<'a' | 'b' | 'c' | 'd', 'Đ' | 'S'>]) => (
                        <div key={q} className="p-1.5 bg-[#FDF6E9] border border-[#111111] text-xs font-black">
                          <span className="text-neutral-700 block mb-1">Câu {q}:</span>
                          <div className="flex items-center justify-between text-[11px]">
                            <span>a:<strong className={subAns.a === 'Đ' ? 'text-[#0F9D58]' : 'text-[#E63946]'}>{subAns.a || '-'}</strong></span>
                            <span>b:<strong className={subAns.b === 'Đ' ? 'text-[#0F9D58]' : 'text-[#E63946]'}>{subAns.b || '-'}</strong></span>
                            <span>c:<strong className={subAns.c === 'Đ' ? 'text-[#0F9D58]' : 'text-[#E63946]'}>{subAns.c || '-'}</strong></span>
                            <span>d:<strong className={subAns.d === 'Đ' ? 'text-[#0F9D58]' : 'text-[#E63946]'}>{subAns.d || '-'}</strong></span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Part 3 Preview */}
              {parsedResult.p3Count > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-black uppercase text-[#111111] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-[#0F9D58] border border-[#111111]"></span>
                    Phần III: Điền Ngắn ({parsedResult.p3Count} câu)
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white border-2 border-[#111111]">
                    {Object.entries(parsedResult.p3)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([q, val]) => (
                        <span
                          key={q}
                          className="px-2 py-1 bg-[#FDF6E9] border border-[#111111] text-xs font-black text-[#111111] flex items-center gap-1"
                        >
                          <span className="text-neutral-500 font-bold">C{q}:</span>
                          <span className="text-[#0F9D58] font-black">{val}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Option to sync question counts */}
              <label className="flex items-center gap-2 cursor-pointer pt-2 border-t-2 border-[#111111]">
                <input
                  type="checkbox"
                  checked={syncQuestionCounts}
                  onChange={(e) => setSyncQuestionCounts(e.target.checked)}
                  className="w-4 h-4 border-2 border-[#111111] accent-[#4D6BFE] cursor-pointer"
                />
                <span className="text-xs font-bold text-neutral-800">
                  Tự động đồng bộ số lượng câu hỏi đề thi theo dữ liệu nạp (nếu số câu nạp nhiều hơn số câu hiện tại)
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-5 bg-[#FDF6E9] border-t-2 border-[#111111] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] hover:bg-neutral-100 text-xs font-black uppercase"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            disabled={!parsedResult || totalDetected === 0}
            onClick={handleApply}
            className="px-6 py-2.5 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] hover:bg-[#ffd460] active:translate-x-[1px] active:translate-y-[1px] text-xs md:text-sm font-black uppercase flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Áp Dụng {totalDetected > 0 ? `(${totalDetected} Mục)` : ''} Vào Đề Thi
          </button>
        </div>
      </div>
    </div>
  );
};
