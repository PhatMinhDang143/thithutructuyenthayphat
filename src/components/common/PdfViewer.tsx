import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ZoomIn, ZoomOut, RotateCcw, ExternalLink, RefreshCw, 
  FileText, Eye, Maximize2, LayoutList, ChevronUp, ChevronDown, 
  HelpCircle, Layers
} from 'lucide-react';
import { normalizePdfUrl } from '../../utils/pdfUtils';
import { ExamItem } from '../../types';

// Configure PDF.js worker reliably via unpkg or cdnjs
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('PDF.js worker setup fallback:', e);
}

// Single Page Component that handles its own canvas rendering lifecycle safely
interface PdfPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  scale: number;
}

const PdfSinglePage: React.FC<PdfPageProps> = ({ pdfDoc, pageNum, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({ width: 600, height: 800 });
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        // Cancel previous render task if still in progress
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (err) {
            // Ignore cancellation error
          }
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2); // Max 2x for performance
        const unscaledViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: scale * dpr });
        const displayWidth = unscaledViewport.width * scale;
        const displayHeight = unscaledViewport.height * scale;

        setPageDimensions({ width: displayWidth, height: displayHeight });

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // Render PDF page into canvas context
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
          canvas: canvas,
        };

        const task = (page.render as any)(renderContext);
        renderTaskRef.current = task;

        await task.promise;
        if (!isCancelled) {
          setIsRendered(true);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Render error on page ${pageNum}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNum, scale]);

  return (
    <div 
      id={`pdf-page-${pageNum}`}
      className="mb-4 sm:mb-6 flex flex-col items-center bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111] overflow-hidden transition-all"
      style={{ width: pageDimensions.width ? `${pageDimensions.width}px` : '100%', maxWidth: '100%' }}
    >
      {/* Top Page Header Tag */}
      <div className="w-full bg-[#FDF6E9] border-b-2 border-[#111111] px-3 py-1.5 flex items-center justify-between text-[#111111] select-none">
        <span className="text-[11px] font-black uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-[#4D6BFE]" /> Trang {pageNum}
        </span>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-white border border-[#111111]">
          {pageNum} / {pdfDoc.numPages}
        </span>
      </div>

      {/* Render Canvas */}
      <div className="relative w-full flex justify-center bg-white min-h-[300px]">
        {!isRendered && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-[#FDF6E9]"
            style={{ minHeight: `${pageDimensions.height || 400}px` }}
          >
            <div className="w-7 h-7 border-3 border-[#111111] border-t-[#4D6BFE] animate-spin"></div>
          </div>
        )}
        <canvas ref={canvasRef} className="block max-w-full" />
      </div>
    </div>
  );
};

interface PdfViewerProps {
  fileUrl?: string;
  exam?: ExamItem;
  title?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ fileUrl, exam, title }) => {
  const [scale, setScale] = useState<number>(1.0);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [renderMode, setRenderMode] = useState<'canvas' | 'drive_iframe' | 'docs_iframe' | 'sample'>('sample');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [fitMode, setFitMode] = useState<'fit-width' | 'custom'>('fit-width');

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfInfo = normalizePdfUrl(fileUrl);

  // Auto calculate scale for "Fit to Width"
  const calculateFitWidthScale = useCallback((pdf: pdfjsLib.PDFDocumentProxy) => {
    if (!containerRef.current) return 1.0;
    const containerWidth = containerRef.current.clientWidth;
    // Standard A4 width is ~595px at 72dpi
    const availableWidth = Math.max(containerWidth - 32, 280);
    const calculatedScale = Math.min(Math.max(availableWidth / 595, 0.5), 2.2);
    return calculatedScale;
  }, []);

  // Determine rendering strategy based on URL type
  useEffect(() => {
    setLoading(true);
    setPdfDoc(null);
    setNumPages(0);

    if (!fileUrl || !fileUrl.trim()) {
      setRenderMode('sample');
      setLoading(false);
      return;
    }

    const trimmed = fileUrl.trim();

    // 1. Is Base64 Data URL? -> Render via PDF.js Canvas
    if (trimmed.startsWith('data:application/pdf') || (trimmed.startsWith('data:') && trimmed.includes('base64,'))) {
      setRenderMode('canvas');
      loadPdfFromBase64(trimmed);
      return;
    }

    // 2. Is dummy/sample placeholder URL? -> Show structured native exam paper
    if (trimmed.includes('w3.org') || trimmed.includes('dummy.pdf') || trimmed.includes('example.com')) {
      setRenderMode('sample');
      setLoading(false);
      return;
    }

    // 3. Is Google Drive link? -> Use Google Drive preview frame
    if (pdfInfo.isDrive && pdfInfo.previewUrl) {
      setRenderMode('drive_iframe');
      setLoading(false);
      return;
    }

    // 4. Standard external web URL (https://.../file.pdf)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      setRenderMode('canvas');
      loadPdfFromUrl(trimmed);
      return;
    }

    // Fallback
    setRenderMode('sample');
    setLoading(false);
  }, [fileUrl]);

  // Load PDF from Base64 string
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
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      
      const fitScale = calculateFitWidthScale(pdf);
      setScale(fitScale);
      setLoading(false);
    } catch (err: any) {
      console.error('PDF.js Base64 decode error:', err);
      setRenderMode('sample');
      setLoading(false);
    }
  };

  // Load PDF from regular URL
  const loadPdfFromUrl = async (url: string) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ url });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      
      const fitScale = calculateFitWidthScale(pdf);
      setScale(fitScale);
      setLoading(false);
    } catch (err: any) {
      console.warn('PDF.js cross-origin fetch blocked. Falling back to Docs Viewer:', err);
      setRenderMode('docs_iframe');
      setLoading(false);
    }
  };

  // Responsive scale readjustment on resize
  useEffect(() => {
    const handleResize = () => {
      if (fitMode === 'fit-width' && pdfDoc) {
        const fitScale = calculateFitWidthScale(pdfDoc);
        setScale(fitScale);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitMode, pdfDoc, calculateFitWidthScale]);

  const handleZoomIn = () => {
    setFitMode('custom');
    setScale((prev) => Math.min(prev + 0.2, 2.5));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleFitWidth = () => {
    setFitMode('fit-width');
    if (pdfDoc) {
      const fitScale = calculateFitWidthScale(pdfDoc);
      setScale(fitScale);
    } else {
      setScale(1.0);
    }
  };

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
    <div className="w-full h-full flex flex-col bg-[#FDF6E9] overflow-hidden" ref={containerRef}>
      {/* Sleek Compact Toolbar */}
      <div className="bg-white border-b-2 border-[#111111] px-3 py-2 flex items-center justify-between gap-2 shrink-0 z-20 shadow-[0_2px_0px_#111111]">
        {/* Left: Document Info & Page Count */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-[#FFC93C] text-[#111111] border border-[#111111] shadow-[1px_1px_0px_#111111] shrink-0 font-black">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-xs font-black text-[#111111] truncate max-w-[130px] sm:max-w-[200px] md:max-w-xs">
            {title || exam?.title || 'Đề Thi PDF'}
          </span>
          {renderMode === 'canvas' && numPages > 0 && (
            <span className="text-[10px] font-black bg-[#4D6BFE] text-white px-2 py-0.5 border border-[#111111] shadow-[1px_1px_0px_#111111] shrink-0">
              {numPages} trang
            </span>
          )}
        </div>

        {/* Right: Controls (Zoom, Fit Width, Open Tab) */}
        <div className="flex items-center gap-2 shrink-0">
          {renderMode === 'canvas' && (
            <div className="flex items-center bg-[#FDF6E9] p-0.5 border-2 border-[#111111] shadow-[1px_1px_0px_#111111]">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 text-[#111111] hover:bg-white active:bg-neutral-200 transition-colors"
                title="Thu nhỏ (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              
              <button
                type="button"
                onClick={handleFitWidth}
                className={`px-1.5 py-0.5 text-[10px] font-black border-x border-[#111111] transition-colors ${
                  fitMode === 'fit-width' ? 'bg-[#4D6BFE] text-white' : 'text-[#111111] hover:bg-white'
                }`}
                title="Tự động căn vừa chiều rộng"
              >
                {Math.round(scale * 100)}%
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 text-[#111111] hover:bg-white active:bg-neutral-200 transition-colors"
                title="Phóng to (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {renderMode.includes('iframe') && (
            <button
              type="button"
              onClick={() => setIframeKey((prev) => prev + 1)}
              className="px-2 py-1 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] text-xs font-bold flex items-center gap-1 shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px]"
              title="Tải lại khung xem đề"
            >
              <RefreshCw className="w-3 h-3" /> <span className="hidden sm:inline">Tải lại</span>
            </button>
          )}

          {fileUrl && !fileUrl.includes('w3.org') && !fileUrl.includes('dummy.pdf') && (
            <button
              type="button"
              onClick={handleOpenExternal}
              className="px-2.5 py-1 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] text-xs font-black flex items-center gap-1 shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] transition-all"
              title="Mở đề thi trong tab mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Mở Tab Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Document Viewer Container */}
      <div className="flex-1 w-full h-full relative overflow-y-auto overflow-x-auto p-2 sm:p-4 flex flex-col items-center bg-[#FDF6E9]">
        {loading && (
          <div className="my-auto flex flex-col items-center justify-center p-8 text-center bg-white border-2 border-[#111111] shadow-[4px_4px_0px_#111111]">
            <div className="w-10 h-10 border-4 border-[#111111] border-t-[#4D6BFE] animate-spin mb-3"></div>
            <p className="text-sm font-black text-[#111111]">Đang tải và hiển thị đề thi...</p>
            <p className="text-xs text-neutral-600 font-bold mt-1">Độ phân giải HD cho điện thoại và máy tính</p>
          </div>
        )}

        {/* 1. PDF.js Canvas HD Mode */}
        {!loading && renderMode === 'canvas' && pdfDoc && (
          <div className="w-full flex flex-col items-center max-w-full">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pNum) => (
              <PdfSinglePage
                key={`pdf-page-${pNum}`}
                pdfDoc={pdfDoc}
                pageNum={pNum}
                scale={scale}
              />
            ))}
          </div>
        )}

        {/* 2. Google Drive /preview Frame */}
        {!loading && renderMode === 'drive_iframe' && pdfInfo.previewUrl && (
          <div className="w-full h-full flex flex-col relative border-2 border-[#111111] shadow-[4px_4px_0px_#111111] bg-white overflow-hidden">
            <iframe
              key={iframeKey}
              src={pdfInfo.previewUrl}
              title="Google Drive PDF Viewer"
              allow="autoplay; encrypted-media; fullscreen"
              className="w-full h-full border-0"
            />
          </div>
        )}

        {/* 3. Google Docs Viewer Fallback */}
        {!loading && renderMode === 'docs_iframe' && fileUrl && (
          <div className="w-full h-full flex flex-col relative border-2 border-[#111111] shadow-[4px_4px_0px_#111111] bg-white overflow-hidden">
            <iframe
              key={iframeKey}
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
              title="Google Docs PDF Viewer"
              allow="autoplay; encrypted-media; fullscreen"
              className="w-full h-full border-0"
            />
          </div>
        )}

        {/* 4. Elegant Professional Native Exam Template (Sample) */}
        {!loading && renderMode === 'sample' && (
          <div className="max-w-3xl w-full bg-white text-[#111111] border-3 border-[#111111] shadow-[6px_6px_0px_#111111] p-5 sm:p-8 md:p-10 leading-relaxed my-auto">
            {/* Header */}
            <div className="border-b-3 border-[#111111] pb-4 mb-6 text-center">
              <div className="flex justify-between items-start text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#111111] mb-2">
                <span>BỘ GIÁO DỤC & ĐÀO TẠO</span>
                <span>KỲ THI ĐÁNH GIÁ NĂNG LỰC 2026</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black uppercase text-[#111111] tracking-tight">
                {exam?.title || title || 'ĐỀ KHẢO SÁT CHẤT LƯỢNG HỌC TẬP'}
              </h2>
              <p className="text-xs font-bold text-neutral-700 mt-1">
                Thời gian làm bài: <strong>{exam?.duration || 50} phút</strong> (Không kể thời gian phát đề)
              </p>
              <div className="mt-3 text-[11px] font-black text-[#111111] bg-[#FFC93C] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] py-1 px-3 inline-block">
                📖 <em>Thí sinh làm bài trực tiếp và chọn câu trả lời tại Phiếu Bài Làm bên phải</em>
              </div>
            </div>

            {/* Questions Body */}
            <div className="space-y-6 text-sm">
              {/* Part 1 */}
              <div>
                <div className="font-black text-sm sm:text-base text-[#111111] bg-[#FDF6E9] px-3 py-2 mb-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                  PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn (Thí sinh chọn 1 đáp án A, B, C hoặc D)
                </div>
                <div className="space-y-3 pl-1 sm:pl-2">
                  {Array.from({ length: exam?.questions?.num_p1 || 12 }, (_, i) => i + 1).map((qNum) => (
                    <div key={qNum} className="pb-3 border-b-2 border-neutral-200">
                      <p className="font-extrabold text-[#111111] leading-snug">
                        Câu {qNum}: <span className="font-semibold text-neutral-800">
                          {qNum === 1 && 'Hàm số y = f(x) liên tục trên R và có đạo hàm f\'(x) = (x - 1)(x + 2)^2. Số điểm cực trị của hàm số là:'}
                          {qNum === 2 && 'Nghiệm của phương trình logarit log_3(2x - 1) = 2 là:'}
                          {qNum === 3 && 'Cho hình chóp S.ABCD có đáy là hình vuông cạnh a, SA vuông góc với mặt phẳng đáy, SA = a√3. Góc giữa SC và mặt đáy bằng:'}
                          {qNum === 4 && 'Trong không gian Oxyz, mặt cầu (S): (x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 16 có bán kính bằng:'}
                          {qNum > 4 && `Nội dung câu hỏi số ${qNum} phục vụ kiểm tra kiến thức tổng hợp chương trình.`}
                        </span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs font-bold">
                        <span className="p-1.5 bg-[#FDF6E9] border-2 border-[#111111]"><strong className="text-[#4D6BFE]">A.</strong> Phương án A</span>
                        <span className="p-1.5 bg-[#FDF6E9] border-2 border-[#111111]"><strong className="text-[#4D6BFE]">B.</strong> Phương án B</span>
                        <span className="p-1.5 bg-[#FDF6E9] border-2 border-[#111111]"><strong className="text-[#4D6BFE]">C.</strong> Phương án C</span>
                        <span className="p-1.5 bg-[#FDF6E9] border-2 border-[#111111]"><strong className="text-[#4D6BFE]">D.</strong> Phương án D</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Part 2 */}
              {(exam?.questions?.num_p2 || 4) > 0 && (
                <div>
                  <div className="font-black text-sm sm:text-base text-[#111111] bg-[#FDF6E9] px-3 py-2 mb-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    PHẦN II. Câu trắc nghiệm đúng sai (Thí sinh trả lời Đúng/Sai cho từng ý a, b, c, d)
                  </div>
                  <div className="space-y-3 pl-1 sm:pl-2">
                    {Array.from({ length: exam?.questions?.num_p2 || 4 }, (_, i) => i + 1).map((qNum) => (
                      <div key={qNum} className="pb-3 border-b-2 border-neutral-200">
                        <p className="font-extrabold text-[#111111] leading-snug">
                          Câu {qNum}: <span className="font-semibold text-neutral-800">Xét tính đúng / sai của các mệnh đề sau:</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 text-xs font-bold">
                          <span className="p-1.5 bg-[#FDF6E9] border-2 border-[#111111]">a) Mệnh đề khẳng định ý a</span>
                          <span className="p-1.5 bg-[#FDF6E9] border-2 border-[#111111]">b) Mệnh đề khẳng định ý b</span>
                          <span className="p-1.5 bg-[#FDF6E9] border-2 border-[#111111]">c) Mệnh đề khẳng định ý c</span>
                          <span className="p-1.5 bg-[#FDF6E9] border-2 border-[#111111]">d) Mệnh đề khẳng định ý d</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Part 3 */}
              {(exam?.questions?.num_p3 || 6) > 0 && (
                <div>
                  <div className="font-black text-sm sm:text-base text-[#111111] bg-[#FDF6E9] px-3 py-2 mb-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    PHẦN III. Câu trắc nghiệm trả lời ngắn (Thí sinh điền kết quả dạng số)
                  </div>
                  <div className="space-y-3 pl-1 sm:pl-2">
                    {Array.from({ length: exam?.questions?.num_p3 || 6 }, (_, i) => i + 1).map((qNum) => (
                      <div key={qNum} className="pb-3 border-b-2 border-neutral-200">
                        <p className="font-extrabold text-[#111111] leading-snug">
                          Câu {qNum}: <span className="font-semibold text-neutral-800">Tính toán và điền đáp số chính xác cho câu {qNum}.</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t-2 border-[#111111] text-center text-xs text-neutral-700 font-black">
              --- HẾT ---
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
