import React, { useState } from 'react';
import { ExamSubmission, QuestionTimingRecord } from '../../types';
import { 
  Trash2, ShieldCheck, AlertTriangle, Filter, Search, Award, CheckSquare, Square, 
  RefreshCw, UserCheck, HelpCircle, CheckCircle2, Calculator, Upload, ClipboardPaste, 
  X, Clock, Zap, BarChart2
} from 'lucide-react';
import { clearExamHistory, deleteHistoryEntries, getAuthToken, safeFetchJson, regradeAllSubmissionsLocally, getLocalExams, calculateScoreLocally, getApiUrl, safeSetItem, STORAGE_KEYS } from '../../services/storageService';

const formatQuestionName = (key: string): string => {
  if (key.startsWith('p1_')) {
    return `Phần I - Câu ${key.replace('p1_', '')}`;
  }
  if (key.startsWith('p2_')) {
    const parts = key.split('_');
    return `Phần II - Câu ${parts[1]}.${(parts[2] || '').toUpperCase()}`;
  }
  if (key.startsWith('p3_')) {
    return `Phần III - Câu ${key.replace('p3_', '')}`;
  }
  return key;
};

interface HistoryViewerProps {
  history: ExamSubmission[];
  classes: string[];
  onRefresh: () => void;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ history, classes, onRefresh }) => {
  const [selectedClass, setSelectedClass] = useState('Tất cả');
  const [selectedExamTitle, setSelectedExamTitle] = useState('Tất cả');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [selectedTimingSubmission, setSelectedTimingSubmission] = useState<ExamSubmission | null>(null);

  // Extract unique exam titles for filter dropdown
  const uniqueExamTitles = Array.from(
    new Set(history.map((h) => h.examTitle).filter(Boolean))
  );

  const handleClearHistory = async () => {
    if (window.confirm('CẢNH BÁO NGUY HIỂM: Dọn sạch toàn bộ nhật ký bài làm và điểm số của tất cả học sinh? Hành động này không thể hoàn tác.')) {
      setIsDeleting(true);
      await clearExamHistory();
      setSelectedIds([]);
      setActionNotice('Đã dọn sạch toàn bộ lịch sử thi thành công!');
      setTimeout(() => setActionNotice(null), 4000);
      setIsDeleting(false);
      onRefresh();
    }
  };

  const handleRegradeAll = async () => {
    setIsRegrading(true);
    try {
      // 1. Always execute local regrade first so UI is immediately updated
      const localExams = getLocalExams();
      const { updatedSubmissions, regradedCount: localCount } = regradeAllSubmissionsLocally(history, localExams);

      // 2. Try server-side authoritative regrade
      try {
        const token = getAuthToken();
        const res = await fetch('/api/admin/regrade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.ok) {
          const data = await safeFetchJson(res);
          if (data && data.success) {
            if (Array.isArray(data.history) && data.history.length > 0) {
              safeSetItem(STORAGE_KEYS.HISTORY, JSON.stringify(data.history));
            }
            setActionNotice(data.message || `Đã chấm lại điểm cho ${data.regradedCount ?? localCount} bài thi theo đáp án mới nhất!`);
            setTimeout(() => setActionNotice(null), 4000);
            onRefresh();
            setIsRegrading(false);
            return;
          }
        }
      } catch (err) {}

      // Fallback notification if server is offline/static
      setActionNotice(`Đã chấm lại điểm cho ${localCount || history.length} bài thi thành công theo đáp án mới nhất!`);
      setTimeout(() => setActionNotice(null), 4000);
      onRefresh();
    } catch (e: any) {
      alert('Lỗi khi chấm lại điểm: ' + (e?.message || 'Vui lòng thử lại'));
    } finally {
      setIsRegrading(false);
    }
  };

  const handleImportSheetData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteData.trim()) return;

    setIsRegrading(true);
    try {
      // 1. Try backend import route
      try {
        const token = getAuthToken();
        const res = await fetch('/api/admin/import-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ rawText: pasteData }),
        });
        if (res.ok) {
          const data = await safeFetchJson(res);
          if (data && data.success) {
            setActionNotice(data.message || 'Đã nhập và chấm lại điểm thành công!');
            setTimeout(() => setActionNotice(null), 4000);
            setShowImportModal(false);
            setPasteData('');
            onRefresh();
            setIsRegrading(false);
            return;
          }
        }
      } catch (err) {}

      // 2. Client-side import fallback (for GitHub Pages)
      const lines = pasteData.trim().split('\n');
      const localExams = getLocalExams();
      const examsMap: Record<string, any> = {};
      localExams.forEach((ex) => {
        if (ex.id) examsMap[ex.id] = ex;
        if (ex.title) examsMap[ex.title.trim()] = ex;
      });

      const newEntries: ExamSubmission[] = [];
      lines.forEach((line, idx) => {
        const parts = line.split('\t').map((p) => p.trim());
        if (parts.length >= 5) {
          const time = parts[0] || new Date().toLocaleString('vi-VN');
          const u = parts[1] || '';
          const name = parts[2] || '';
          const group = parts[3] || '';
          const examTitle = parts[4] || '';
          let score = parseFloat(parts[5]) || 0;
          let correct = 0;
          const cheat = parts[6] || '0 lần';
          let details: any = {};
          if (parts[7]) {
            try {
              details = JSON.parse(parts[7]);
            } catch (err) {}
          }

          const matchedExam = examsMap[examTitle];
          if (matchedExam && matchedExam.answers && details) {
            const cheatNum = parseInt(cheat, 10) || 0;
            const res = calculateScoreLocally(matchedExam, details, cheatNum);
            score = res.score;
            correct = res.correct;
          }

          if (u || name) {
            newEntries.push({
              id: 'imp_' + Date.now() + '_' + idx,
              submitted_at: time,
              username: u,
              name: name,
              group: group,
              examTitle: examTitle,
              examId: matchedExam?.id || '',
              score: score,
              correct: correct,
              cheat: cheat,
              details: details,
            });
          }
        }
      });

      if (newEntries.length > 0) {
        const merged = [...newEntries, ...history];
        localStorage.setItem('app_history_data', JSON.stringify(merged));
        setActionNotice(`Đã nhập thành công ${newEntries.length} bài thi từ Sheet!`);
        setTimeout(() => setActionNotice(null), 4000);
        setShowImportModal(false);
        setPasteData('');
        onRefresh();
      } else {
        alert('Không nhận diện được dòng dữ liệu hợp lệ. Vui lòng copy các cột từ Google Sheet: Thời gian, Tài khoản, Họ tên, Lớp, Đề thi, Điểm, Cảnh báo, Chi tiết bài làm.');
      }
    } catch (e: any) {
      alert('Lỗi khi nhập dữ liệu: ' + (e?.message || 'Định dạng chưa đúng'));
    } finally {
      setIsRegrading(false);
    }
  };

  const handleDeleteSingle = async (submission: ExamSubmission, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = submission.id;
    if (!id) return;

    if (
      window.confirm(
        `Xác nhận xóa bài làm của học sinh:\n- Thí sinh: ${submission.name} (${submission.username})\n- Đề thi: ${submission.examTitle}\n- Điểm số: ${submission.score}\n\n* Lưu ý: Xóa bài này sẽ dọn bảng điểm và cho phép học sinh thi lại nếu đề thi có giới hạn số lần làm.`
      )
    ) {
      setIsDeleting(true);
      await deleteHistoryEntries([id]);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      setActionNotice(`Đã xóa bài làm của thí sinh ${submission.name}!`);
      setTimeout(() => setActionNotice(null), 4000);
      setIsDeleting(false);
      onRefresh();
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    if (
      window.confirm(
        `Xác nhận xóa ${selectedIds.length} bài làm đã chọn?\n\n* Lưu ý: Các học sinh tương ứng sẽ được trừ số lượt đã nộp và có thể làm lại bài nếu đề thi giới hạn số lần thi.`
      )
    ) {
      setIsDeleting(true);
      await deleteHistoryEntries(selectedIds);
      setActionNotice(`Đã xóa thành công ${selectedIds.length} bài thi đã chọn!`);
      setTimeout(() => setActionNotice(null), 4000);
      setSelectedIds([]);
      setIsDeleting(false);
      onRefresh();
    }
  };

  const filteredHistory = history.filter((h) => {
    const matchesClass = selectedClass === 'Tất cả' || (h.group || '').toLowerCase() === selectedClass.toLowerCase();
    const matchesExam = selectedExamTitle === 'Tất cả' || (h.examTitle || '') === selectedExamTitle;
    const matchesSearch =
      (h.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.examTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.group || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClass && matchesExam && matchesSearch;
  });

  const allFilteredIds = filteredHistory.map((h, idx) => h.id || `sub_idx_${idx}`);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.includes(id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white border-3 border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden flex flex-col h-full space-y-5 text-[#111111]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b-2 border-[#111111] gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl md:text-2xl font-black uppercase text-[#111111]">Nhật Ký & Bảng Điểm Thi Theo Lớp</h2>
            <span className="bg-[#4D6BFE] text-white text-xs font-black px-2.5 py-0.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
              {history.length} Bài Nộp
            </span>
          </div>
          <p className="text-xs md:text-sm text-neutral-700 font-bold mt-1">
            Xem điểm số, giám sát chống gian lận, tự động chấm lại điểm từ đáp án gốc hoặc reset lượt thi cho học sinh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2.5 bg-[#4D6BFE] hover:bg-[#3b5bdb] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all"
            title="Dán dòng dữ liệu từ Google Sheet để hệ thống tự động nhận diện câu trả lời và chấm điểm thật ngay lập tức"
          >
            <ClipboardPaste className="w-4 h-4" /> Dán Dữ Liệu Sheet
          </button>

          <button
            onClick={handleRegradeAll}
            disabled={isRegrading}
            className="px-3.5 py-2.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all"
            title="Tự động chấm lại toàn bộ các bài thi dựa theo đáp án chuẩn của đề"
          >
            <Calculator className={`w-4 h-4 ${isRegrading ? 'animate-spin' : ''}`} /> Chấm Lại Điểm
          </button>

          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="px-4 py-2.5 bg-[#E63946] text-white border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black uppercase text-xs tracking-wider flex items-center gap-1.5 transition-all animate-pulse"
            >
              <Trash2 className="w-4 h-4" /> Xóa {selectedIds.length} Bài Đã Chọn
            </button>
          )}

          <button
            onClick={handleClearHistory}
            disabled={isDeleting}
            className="px-3.5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all"
          >
            <Trash2 className="w-4 h-4 text-[#E63946]" /> Xóa Toàn Bộ
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-3 border-[#111111] shadow-[8px_8px_0px_#111111] max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3">
              <h3 className="text-lg font-black uppercase text-[#111111] flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-[#4D6BFE]" /> Dán Dòng Dữ Liệu Sheet & Tự Động Chấm Điểm
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 hover:bg-neutral-100 border-2 border-[#111111]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-700 font-bold">
              💡 <strong>Cách làm:</strong> Bạn chỉ cần mở Google Sheet, bôi đen và copy (Ctrl+C) các dòng có bài thi của học sinh (gồm cả cột đáp án <code>{'{"p1":...}'}</code>) rồi dán (Ctrl+V) vào ô dưới đây. Hệ thống sẽ <strong>tự động dò đáp án đề thi và chấm điểm chính xác ngay lập tức</strong>!
            </p>

            <form onSubmit={handleImportSheetData} className="space-y-4">
              <textarea
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                placeholder="Dán các dòng copy từ Google Sheet vào đây... Ví dụ:&#10;22:15 01/09/2026	maiphuong12b	Mai Phương	12B	ĐỀ KHẢO SÁT CHẤT LƯỢNG TOÁN  12 LẦN 4	0	4 lần	{&quot;p1&quot;:{&quot;1&quot;:&quot;D&quot;,...}}"
                rows={8}
                className="w-full p-3 bg-[#FDF6E9] border-2 border-[#111111] font-mono text-xs outline-none focus:bg-white shadow-[2px_2px_0px_#111111]"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-neutral-100 border-2 border-[#111111] text-xs font-black uppercase"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isRegrading || !pasteData.trim()}
                  className="px-5 py-2.5 bg-[#0F9D58] hover:bg-[#0b8043] text-white border-2 border-[#111111] text-xs font-black uppercase shadow-[3px_3px_0px_#111111] flex items-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <Calculator className="w-4 h-4" /> {isRegrading ? 'Đang chấm điểm...' : 'Bắt Đầu Chấm Điểm & Cập Nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Toast / Banner */}
      {actionNotice && (
        <div className="mx-6 p-3 bg-[#0F9D58]/15 border-2 border-[#0F9D58] text-[#0F9D58] font-black text-xs flex items-center gap-2 shadow-[3px_3px_0px_#0F9D58]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {actionNotice}
        </div>
      )}

      {/* Guide Note */}
      <div className="mx-6 p-3 bg-[#FDF6E9] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] flex items-center justify-between text-xs text-neutral-800 font-bold gap-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#4D6BFE] shrink-0" />
          <span>
            <strong>Quản lý lượt làm bài & Điểm số:</strong> Bấm <strong>"Chấm Lại Điểm"</strong> hoặc <strong>"Dán Dữ Liệu Sheet"</strong> để tự động tính điểm chuẩn cho những bài nộp có dữ liệu đáp án. Xóa bài làm sẽ giải phóng lượt nộp để học sinh làm lại bài.
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {/* Class Filter */}
        <div className="flex items-center gap-2 bg-[#FDF6E9] p-2.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
          <Filter className="w-4 h-4 text-[#4D6BFE] shrink-0" />
          <span className="text-[11px] font-black text-[#111111] uppercase shrink-0">Lớp:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-white text-[#111111] border-2 border-[#111111] text-xs font-black p-1 outline-none cursor-pointer"
          >
            {classes.map((clsName) => (
              <option key={clsName} value={clsName}>
                {clsName === 'Tất cả' ? 'Tất Cả Các Lớp' : `Lớp ${clsName}`}
              </option>
            ))}
          </select>
        </div>

        {/* Exam Title Filter */}
        <div className="flex items-center gap-2 bg-[#FDF6E9] p-2.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
          <span className="text-[11px] font-black text-[#111111] uppercase shrink-0">Đề thi:</span>
          <select
            value={selectedExamTitle}
            onChange={(e) => setSelectedExamTitle(e.target.value)}
            className="w-full bg-white text-[#111111] border-2 border-[#111111] text-xs font-black p-1 outline-none cursor-pointer truncate"
          >
            <option value="Tất cả">Tất Cả Đề Thi ({uniqueExamTitles.length})</option>
            {uniqueExamTitles.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm tên, SBD hoặc đề..."
            className="w-full p-2.5 pl-9 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs text-[#111111] outline-none font-bold placeholder:text-neutral-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scroll flex-1 px-6 pb-6">
        <table className="w-full text-left border-collapse border-2 border-[#111111]">
          <thead>
            <tr className="text-xs uppercase tracking-wider font-black text-[#111111] bg-[#FDF6E9] border-b-2 border-[#111111]">
              <th className="p-3 w-10 text-center border-r-2 border-[#111111]">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center justify-center mx-auto text-[#111111] hover:text-[#4D6BFE]"
                  title={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                >
                  {isAllSelected ? <CheckSquare className="w-4 h-4 text-[#4D6BFE]" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="p-3.5 border-r-2 border-[#111111]">Thời Gian Nộp</th>
              <th className="p-3.5 border-r-2 border-[#111111]">Thí Sinh (SBD)</th>
              <th className="p-3.5 border-r-2 border-[#111111]">Lớp Học</th>
              <th className="p-3.5 border-r-2 border-[#111111]">Đề Khảo Sát</th>
              <th className="p-3.5 border-r-2 border-[#111111] text-[#0F9D58]">Điểm Số</th>
              <th className="p-3.5 border-r-2 border-[#111111] text-center">Thời Gian & Tốc Độ</th>
              <th className="p-3.5 border-r-2 border-[#111111] text-center">Giám Sát Vi Phạm</th>
              <th className="p-3.5 text-center w-24">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-neutral-200">
            {filteredHistory.slice().reverse().map((h, i) => {
              const rowId = h.id || `sub_${i}`;
              const isSelected = selectedIds.includes(rowId);

              return (
                <tr
                  key={rowId}
                  onClick={() => handleToggleSelectRow(rowId)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#FFC93C]/25 hover:bg-[#FFC93C]/35' : 'hover:bg-[#FDF6E9]'
                  }`}
                >
                  {/* Selection Checkbox */}
                  <td className="p-3 text-center border-r-2 border-neutral-200" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectRow(rowId)}
                      className="flex items-center justify-center mx-auto text-[#111111]"
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4 text-[#4D6BFE]" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>

                  <td className="p-3.5 text-xs font-bold text-neutral-600 border-r-2 border-neutral-200">
                    {h.submitted_at}
                  </td>
                  <td className="p-3.5 text-xs border-r-2 border-neutral-200">
                    <div className="font-black text-[#111111]">{h.name}</div>
                    <div className="text-[11px] font-mono text-neutral-600 font-bold">{h.username}</div>
                  </td>
                  <td className="p-3.5 text-xs font-black text-[#4D6BFE] uppercase border-r-2 border-neutral-200">
                    {h.group || 'Khách'}
                  </td>
                  <td className="p-3.5 text-xs text-neutral-800 font-bold max-w-xs truncate border-r-2 border-neutral-200" title={h.examTitle}>
                    {h.examTitle}
                  </td>
                  <td className="p-3.5 text-xl text-[#0F9D58] font-black border-r-2 border-neutral-200">
                    {h.score}
                  </td>
                  {/* Thời Gian & Tốc Độ (Secret Teacher Telemetry) */}
                  <td className="p-3 text-xs border-r-2 border-neutral-200" onClick={(e) => e.stopPropagation()}>
                    {h.timing ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-black text-[#111111]">
                          <Clock className="w-3.5 h-3.5 text-[#4D6BFE] shrink-0" />
                          <span>{h.timing.formattedDuration}</span>
                        </div>
                        {h.timing.avgSecondsPerQuestion ? (
                          <div className="text-[11px] font-bold text-neutral-600 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-[#FFC93C] shrink-0 fill-current" />
                            <span>TB: {h.timing.avgSecondsPerQuestion}s/câu</span>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setSelectedTimingSubmission(h)}
                          className="mt-1 px-2 py-0.5 bg-[#FDF6E9] hover:bg-[#FFC93C] text-[#111111] border border-[#111111] text-[10px] font-black uppercase flex items-center gap-1 shadow-[1px_1px_0px_#111111] transition-all cursor-pointer"
                        >
                          <BarChart2 className="w-3 h-3 text-[#4D6BFE]" /> Chi tiết tốc độ
                        </button>
                      </div>
                    ) : (
                      <span className="text-neutral-400 font-bold text-[11px] italic">Chưa ghi nhận</span>
                    )}
                  </td>
                  <td className="p-3.5 text-center border-r-2 border-neutral-200">
                    <div className="flex justify-center">
                      <span
                        className={`px-3 py-1 text-[11px] font-black flex items-center gap-1.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] w-max ${
                          h.cheat && h.cheat.includes('0')
                            ? 'bg-[#FDF6E9] text-neutral-700'
                            : 'bg-[#E63946] text-white'
                        }`}
                      >
                        {h.cheat && h.cheat.includes('0') ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#0F9D58]" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-white" />
                        )}
                        {h.cheat && h.cheat.includes('0') ? 'Tuyệt đối an toàn' : h.cheat}
                      </span>
                    </div>
                  </td>
                  <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSingle(h, e)}
                      title="Xóa bài thi này (cho phép học sinh làm lại nếu đề giới hạn)"
                      className="p-2 bg-white hover:bg-[#E63946] text-neutral-700 hover:text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredHistory.length === 0 && (
              <tr>
                <td colSpan={9} className="p-12 text-center text-neutral-600 font-bold text-xs">
                  Chưa có lịch sử làm bài thi nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Secret Question Timing Telemetry Detail Modal (Teacher Only) */}
      {selectedTimingSubmission && selectedTimingSubmission.timing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-3 border-[#111111] shadow-[8px_8px_0px_#111111] max-w-3xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b-2 border-[#111111] bg-[#FDF6E9]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-[#4D6BFE] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    <Clock className="w-4 h-4" />
                  </span>
                  <h3 className="text-base sm:text-lg font-black uppercase text-[#111111]">
                    Nhật Ký Tốc Độ & Thời Gian Làm Bài (Bí Mật - Chỉ Giáo Viên)
                  </h3>
                </div>
                <p className="text-xs text-neutral-700 font-bold mt-1">
                  Thí sinh: <strong>{selectedTimingSubmission.name}</strong> ({selectedTimingSubmission.username}) - Lớp: <strong>{selectedTimingSubmission.group || 'Khách'}</strong> | Đề: <strong>{selectedTimingSubmission.examTitle}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedTimingSubmission(null)}
                className="p-1.5 hover:bg-[#E63946] hover:text-white border-2 border-[#111111] bg-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metric Summary Cards */}
            <div className="p-4 sm:p-5 border-b-2 border-[#111111] bg-white grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                <div className="text-[10px] font-black uppercase text-neutral-600">Tổng thời gian</div>
                <div className="text-sm sm:text-base font-black text-[#4D6BFE] mt-0.5">
                  {selectedTimingSubmission.timing.formattedDuration}
                </div>
                <div className="text-[10px] text-neutral-500 font-bold mt-0.5">
                  {selectedTimingSubmission.timing.totalSeconds} giây
                </div>
              </div>

              <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                <div className="text-[10px] font-black uppercase text-neutral-600">Tốc độ trung bình</div>
                <div className="text-sm sm:text-base font-black text-[#0F9D58] mt-0.5">
                  ~{selectedTimingSubmission.timing.avgSecondsPerQuestion || 0}s
                </div>
                <div className="text-[10px] text-neutral-500 font-bold mt-0.5">mỗi câu hỏi</div>
              </div>

              <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                <div className="text-[10px] font-black uppercase text-neutral-600">Làm nhanh nhất</div>
                <div className="text-xs sm:text-sm font-black text-[#111111] mt-0.5 truncate" title={selectedTimingSubmission.timing.fastestQuestion ? formatQuestionName(selectedTimingSubmission.timing.fastestQuestion.question) : 'N/A'}>
                  {selectedTimingSubmission.timing.fastestQuestion
                    ? formatQuestionName(selectedTimingSubmission.timing.fastestQuestion.question)
                    : 'N/A'}
                </div>
                <div className="text-[10px] text-[#0F9D58] font-black mt-0.5">
                  {selectedTimingSubmission.timing.fastestQuestion ? `${selectedTimingSubmission.timing.fastestQuestion.seconds}s` : ''}
                </div>
              </div>

              <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                <div className="text-[10px] font-black uppercase text-neutral-600">Suy nghĩ lâu nhất</div>
                <div className="text-xs sm:text-sm font-black text-[#111111] mt-0.5 truncate" title={selectedTimingSubmission.timing.slowestQuestion ? formatQuestionName(selectedTimingSubmission.timing.slowestQuestion.question) : 'N/A'}>
                  {selectedTimingSubmission.timing.slowestQuestion
                    ? formatQuestionName(selectedTimingSubmission.timing.slowestQuestion.question)
                    : 'N/A'}
                </div>
                <div className="text-[10px] text-[#E63946] font-black mt-0.5">
                  {selectedTimingSubmission.timing.slowestQuestion ? `${selectedTimingSubmission.timing.slowestQuestion.seconds}s` : ''}
                </div>
              </div>
            </div>

            {/* Question Breakdown Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scroll">
              <h4 className="text-xs font-black uppercase text-[#111111] mb-2.5 flex items-center justify-between">
                <span>Chi tiết thời gian & tốc độ phản hồi từng câu</span>
                <span className="text-[10px] font-bold text-neutral-500 lowercase">
                  *được ghi nhận ngầm trong quá trình thí sinh chọn đáp án
                </span>
              </h4>

              <div className="border-2 border-[#111111] overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#111111] text-white font-black uppercase text-[11px]">
                      <th className="p-2.5 border-r border-neutral-700">Câu Hỏi</th>
                      <th className="p-2.5 border-r border-neutral-700 text-center">Thời Điểm Làm</th>
                      <th className="p-2.5 border-r border-neutral-700 text-center">Thời Gian Nghĩ</th>
                      <th className="p-2.5 border-r border-neutral-700 text-center">Đổi Đáp Án</th>
                      <th className="p-2.5 text-center">Đáp Án Chọn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-t border-[#111111]">
                    {Object.entries(selectedTimingSubmission.timing.questionTimings || {}).map(([qKey, timingVal]) => {
                      const t = timingVal as QuestionTimingRecord;
                      const speedCategory = t.durationSeconds <= 15 ? 'fast' : t.durationSeconds <= 45 ? 'normal' : 'slow';
                      return (
                        <tr key={qKey} className="hover:bg-[#FDF6E9] transition-colors">
                          <td className="p-2.5 font-black text-[#111111] border-r border-neutral-200">
                            {formatQuestionName(qKey)}
                          </td>
                          <td className="p-2.5 text-center text-neutral-600 font-mono font-bold border-r border-neutral-200">
                            {t.answeredAt ? `Phút thứ ${t.answeredAt}` : `${t.timeFromStartSeconds}s`}
                          </td>
                          <td className="p-2.5 text-center border-r border-neutral-200">
                            <span className={`inline-block px-2.5 py-0.5 text-[11px] font-black border border-[#111111] shadow-[1px_1px_0px_#111111] ${
                              speedCategory === 'fast'
                                ? 'bg-[#0F9D58] text-white'
                                : speedCategory === 'normal'
                                ? 'bg-[#FFC93C] text-[#111111]'
                                : 'bg-[#E63946] text-white'
                            }`}>
                              {t.durationSeconds}s
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-bold text-neutral-700 border-r border-neutral-200">
                            {t.changeCount && t.changeCount > 1 ? (
                              <span className="text-[#E63946] font-black font-mono">{t.changeCount} lần</span>
                            ) : (
                              <span className="text-neutral-500 font-mono">1 lần</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-black text-[#4D6BFE]">
                            {t.choice || '-'}
                          </td>
                        </tr>
                      );
                    })}

                    {Object.keys(selectedTimingSubmission.timing.questionTimings || {}).length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-neutral-500 italic">
                          Chưa có nhật ký thời gian chi tiết cho từng câu trong bài nộp này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-2 border-[#111111] bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTimingSubmission(null)}
                className="px-5 py-2 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-xs font-black uppercase tracking-wider active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

