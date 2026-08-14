import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ZoomIn, ZoomOut, RotateCcw, ExternalLink, RefreshCw, 
  FileText, AlertCircle, Eye, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Download
} from 'lucide-react';
import { normalizePdfUrl } from '../../utils/pdfUtils';
import { ExamItem } from '../../types';

// Setup PDF.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('Failed to set workerSrc for pdfjs:', e);
}

interface PdfViewerProps {
  fileUrl?: string;
  exam?: ExamItem;
  title?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ fileUrl, exam, title }) => {
  const [scale, setScale] = useState<number>(1.2);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [renderMode, setRenderMode] = useState<'canvas' | 'drive_iframe' | 'docs_iframe' | 'sample'>('sample');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const pdfInfo = normalizePdfUrl(fileUrl);

  // Determine rendering strategy based on URL type
  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    pdfDocRef.current = null;

    if (!fileUrl || !fileUrl.trim()) {
      setRenderMode('sample');
      setLoading(false);
      return;
    }

    const trimmed = fileUrl.trim();

    // 1. Is Base64 Data URL? -> Canvas via PDF.js
    if (trimmed.startsWith('data:application/pdf') || (trimmed.startsWith('data:') && trimmed.includes('base64,'))) {
      setRenderMode('canvas');
      loadPdfFromBase64(trimmed);
      return;
    }

    // 2. Is dummy/sample URL? -> Show sample structured exam sheet
    if (trimmed.includes('w3.org') || trimmed.includes('dummy.pdf') || trimmed.includes('example.com')) {
      setRenderMode('sample');
      setLoading(false);
      return;
    }

    // 3. Is Google Drive? -> Google Drive /preview iframe with fallback
    if (pdfInfo.isDrive && pdfInfo.previewUrl) {
      setRenderMode('drive_iframe');
      setLoading(false);
      return;
    }

    // 4. Standard external web URL (e.g. https://.../file.pdf) -> Try PDF.js Canvas, fallback to iframe
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      setRenderMode('canvas');
      loadPdfFromUrl(trimmed);
      return;
    }

    // Fallback
    setRenderMode('sample');
    setLoading(false);
  }, [fileUrl]);

  // Load PDF from Base64 string using PDF.js
  const loadPdfFromBase64 = async (base64Str: string) => {
    try {
      const base64Data = base64Str.includes('base64,') ? base64Str.split('base64,')[1] : base64Str;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      setLoading(false);
      renderAllPages(pdf, scale);
    } catch (err: any) {
      console.error('PDF.js base64 render failed:', err);
      setErrorMessage('Không thể giải mã file PDF cục bộ. Đang hiển thị bản mẫu đề thi.');
      setRenderMode('sample');
      setLoading(false);
    }
  };

  // Load PDF from regular URL using PDF.js (with CORS fallback)
  const loadPdfFromUrl = async (url: string) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ url });
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      setLoading(false);
      renderAllPages(pdf, scale);
    } catch (err: any) {
      console.warn('PDF.js direct URL fetch failed (likely CORS). Switching to Google Docs viewer iframe:', err);
      // Fallback to Google Docs viewer for cross-origin PDFs
      setRenderMode('docs_iframe');
      setLoading(false);
    }
  };

  // Render all pages to canvas
  const renderAllPages = async (pdf: pdfjsLib.PDFDocumentProxy, currentScale: number) => {
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    container.innerHTML = ''; // clear existing canvases

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: currentScale });

        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'mb-4 flex flex-col items-center shadow-xl rounded-lg overflow-hidden bg-white relative';
        pageWrapper.id = `pdf-page-${pageNum}`;

        // Page number tag
        const pageBadge = document.createElement('div');
        pageBadge.className = 'w-full bg-slate-100 text-slate-500 text-[10px] font-bold py-1 px-3 border-b border-slate-200 text-right';
        pageBadge.innerText = `Trang ${pageNum} / ${pdf.numPages}`;
        pageWrapper.appendChild(pageBadge);

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.className = 'max-w-full h-auto block';

        pageWrapper.appendChild(canvas);
        container.appendChild(pageWrapper);

        if (context) {
          await (page.render as any)({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          }).promise;
        }
      } catch (e) {
        console.error(`Error rendering page ${pageNum}:`, e);
      }
    }
  };

  // Re-render canvases when zoom scale changes
  useEffect(() => {
    if (renderMode === 'canvas' && pdfDocRef.current) {
      renderAllPages(pdfDocRef.current, scale);
    }
  }, [scale]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.6));
  const handleResetZoom = () => setScale(1.2);

  // Open PDF in a clean external tab
  const handleOpenExternal = () => {
    if (!fileUrl) return;

    if (pdfInfo.isBase64) {
      try {
        const base64Data = fileUrl.split(',')[1];
        const contentType = fileUrl.split(';')[0].split(':')[1] || 'application/pdf';
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          byteArrays.push(new Uint8Array(byteNumbers));
        }
        const blob = new Blob(byteArrays, { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        window.open(fileUrl, '_blank');
      }
    } else {
      const urlToOpen = pdfInfo.directUrl || pdfInfo.previewUrl || fileUrl;
      window.open(urlToOpen, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden select-text" ref={containerRef}>
      {/* Top Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        {/* Left: Document Info */}
        <div className="flex items-center gap-2 text-slate-300">
          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-bold text-slate-200 truncate max-w-[160px] sm:max-w-xs">
            {title || exam?.title || 'Tài Liệu Đề Thi'}
          </span>
          {renderMode === 'canvas' && numPages > 0 && (
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-indigo-300 border border-slate-700">
              {numPages} trang
            </span>
          )}
        </div>

        {/* Right: Controls (Zoom, Reload, Open Tab) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {renderMode === 'canvas' && (
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Thu nhỏ (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[10px] font-mono font-bold text-indigo-300">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Phóng to (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors ml-0.5"
                title="Đặt lại kích thước"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          {renderMode.includes('iframe') && (
            <button
              type="button"
              onClick={() => setIframeKey((prev) => prev + 1)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700"
              title="Tải lại khung hiển thị"
            >
              <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Tải lại</span>
            </button>
          )}

          {fileUrl && !fileUrl.includes('w3.org') && !fileUrl.includes('dummy.pdf') && (
            <button
              type="button"
              onClick={handleOpenExternal}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 transition-all"
              title="Mở đề thi trong tab trình duyệt mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở Tab Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full relative overflow-auto p-2 sm:p-4 flex justify-center bg-slate-950">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs z-30">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-300">Đang tải và dựng hình đề thi...</p>
            <p className="text-xs text-slate-500 mt-1">Vui lòng chờ trong giây lát</p>
          </div>
        )}

        {/* 1. PDF.js Canvas Rendering (For Uploaded Base64 and direct files) */}
        {renderMode === 'canvas' && (
          <div
            ref={canvasContainerRef}
            className="w-full flex flex-col items-center py-2 transition-transform duration-200"
          />
        )}

        {/* 2. Google Drive /preview Iframe Rendering */}
        {renderMode === 'drive_iframe' && pdfInfo.previewUrl && (
          <div className="w-full h-full flex flex-col relative rounded-xl overflow-hidden shadow-2xl bg-white">
            <iframe
              key={iframeKey}
              src={pdfInfo.previewUrl}
              title="Google Drive PDF Viewer"
              allow="autoplay; encrypted-media; fullscreen"
              className="w-full h-full border-0"
            />
          </div>
        )}

        {/* 3. Google Docs Viewer Fallback for external PDF URLs */}
        {renderMode === 'docs_iframe' && fileUrl && (
          <div className="w-full h-full flex flex-col relative rounded-xl overflow-hidden shadow-2xl bg-white">
            <iframe
              key={iframeKey}
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
              title="Google Docs PDF Viewer Fallback"
              allow="autoplay; encrypted-media; fullscreen"
              className="w-full h-full border-0"
            />
          </div>
        )}

        {/* 4. Beautiful Built-in Sample Exam Paper (When using sample exams or dummy links) */}
        {renderMode === 'sample' && (
          <div className="max-w-3xl w-full bg-white text-slate-900 rounded-xl shadow-2xl p-6 md:p-10 font-serif leading-relaxed my-auto border border-slate-200">
            {/* Exam Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
              <div className="flex justify-between items-start text-xs font-sans font-bold uppercase tracking-wider text-slate-600 mb-2">
                <span>TRƯỜNG THPT CHUYÊN</span>
                <span>KỲ THI KHẢO SÁT CHẤT LƯỢNG NĂM 2026</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold uppercase text-slate-900 font-sans tracking-tight">
                {exam?.title || title || 'ĐỀ THI KHẢO SÁT TRẮC NGHIỆM'}
              </h2>
              <p className="text-xs font-sans font-medium text-slate-600 mt-1">
                Thời gian làm bài: <strong>{exam?.duration || 50} phút</strong> (Không kể thời gian phát đề)
              </p>
              <div className="mt-2 text-[11px] font-sans text-indigo-700 bg-indigo-50 border border-indigo-200 py-1 px-3 rounded-md inline-block">
                💡 Lưu ý: Đây là bản đề thi trực quan chuẩn hóa. Học sinh hãy đọc câu hỏi và chọn đáp án ở phiếu bên phải!
              </div>
            </div>

            {/* Questions Content */}
            <div className="space-y-6 text-sm">
              {/* Part 1 */}
              <div>
                <h3 className="font-sans font-bold text-base text-indigo-900 bg-slate-100 px-3 py-1.5 rounded-lg mb-3">
                  PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (Thí sinh chọn 1 đáp án A, B, C hoặc D)
                </h3>
                <div className="space-y-3 font-sans pl-2">
                  {Array.from({ length: exam?.questions?.num_p1 || 12 }, (_, i) => i + 1).map((qNum) => (
                    <div key={qNum} className="pb-2 border-b border-slate-100">
                      <p className="font-bold text-slate-900">
                        Câu {qNum}: <span className="font-normal text-slate-800">
                          {qNum === 1 && 'Hàm số $y = f(x)$ có bảng biến thiên như hình vẽ. Mệnh đề nào dưới đây là đúng?'}
                          {qNum === 2 && 'Tập nghiệm của bất phương trình $\\log_2(x - 1) < 3$ là:'}
                          {qNum === 3 && 'Cho khối chóp $S.ABC$ có đáy là tam giác vuông tại $A$, $AB = a, AC = 2a$. Thể tích khối chóp là:'}
                          {qNum === 4 && 'Số phức liên hợp của số phức $z = 3 - 4i$ là:'}
                          {qNum > 4 && `Nội dung câu hỏi số ${qNum} khảo sát kiến thức trọng tâm chương trình.`}
                        </span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs font-sans">
                        <span className="p-1.5 rounded bg-slate-50 border border-slate-200"><strong>A.</strong> Đáp án A</span>
                        <span className="p-1.5 rounded bg-slate-50 border border-slate-200"><strong>B.</strong> Đáp án B</span>
                        <span className="p-1.5 rounded bg-slate-50 border border-slate-200"><strong>C.</strong> Đáp án C</span>
                        <span className="p-1.5 rounded bg-slate-50 border border-slate-200"><strong>D.</strong> Đáp án D</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Part 2 */}
              {(exam?.questions?.num_p2 || 4) > 0 && (
                <div>
                  <h3 className="font-sans font-bold text-base text-indigo-900 bg-slate-100 px-3 py-1.5 rounded-lg mb-3">
                    PHẦN II. Câu trắc nghiệm đúng sai (Thí sinh trả lời Đúng/Sai cho từng ý a, b, c, d)
                  </h3>
                  <div className="space-y-3 font-sans pl-2">
                    {Array.from({ length: exam?.questions?.num_p2 || 4 }, (_, i) => i + 1).map((qNum) => (
                      <div key={qNum} className="pb-2 border-b border-slate-100">
                        <p className="font-bold text-slate-900">
                          Câu {qNum}: <span className="font-normal text-slate-800">Xét tính đúng sai của các khẳng định sau:</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 text-xs">
                          <span className="p-1.5 bg-slate-50 border border-slate-200 rounded">a) Khẳng định ý a</span>
                          <span className="p-1.5 bg-slate-50 border border-slate-200 rounded">b) Khẳng định ý b</span>
                          <span className="p-1.5 bg-slate-50 border border-slate-200 rounded">c) Khẳng định ý c</span>
                          <span className="p-1.5 bg-slate-50 border border-slate-200 rounded">d) Khẳng định ý d</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Part 3 */}
              {(exam?.questions?.num_p3 || 6) > 0 && (
                <div>
                  <h3 className="font-sans font-bold text-base text-indigo-900 bg-slate-100 px-3 py-1.5 rounded-lg mb-3">
                    PHẦN III. Câu trắc nghiệm trả lời ngắn (Thí sinh điền kết quả dạng số)
                  </h3>
                  <div className="space-y-3 font-sans pl-2">
                    {Array.from({ length: exam?.questions?.num_p3 || 6 }, (_, i) => i + 1).map((qNum) => (
                      <div key={qNum} className="pb-2 border-b border-slate-100">
                        <p className="font-bold text-slate-900">
                          Câu {qNum}: <span className="font-normal text-slate-800">Tính toán và điền đáp số chính xác cho câu {qNum}.</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 text-center font-sans text-xs text-slate-500 font-bold">
              --- HẾT ---
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
