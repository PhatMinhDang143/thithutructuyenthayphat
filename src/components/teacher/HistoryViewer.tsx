import React, { useState } from 'react';
import { ExamSubmission } from '../../types';
import { Trash2, ShieldCheck, AlertTriangle, Filter, Search, Award, CheckSquare, Square, RefreshCw, UserCheck, HelpCircle, CheckCircle2 } from 'lucide-react';
import { clearExamHistory, deleteHistoryEntries } from '../../services/storageService';

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
  const [actionNotice, setActionNotice] = useState<string | null>(null);

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
      // Deselect all filtered
      setSelectedIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      // Select all filtered
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
            Xem điểm số, giám sát chống gian lận, xóa bài làm không hợp lệ hoặc reset lượt thi cho học sinh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            <strong>Quản lý lượt làm bài:</strong> Khi giáo viên bấm nút xóa bài làm của một học sinh, số lượt nộp của học sinh đó đối với đề thi sẽ được giải phóng để học sinh có thể làm lại bài.
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
                <td colSpan={8} className="p-12 text-center text-neutral-600 font-bold text-xs">
                  Chưa có lịch sử làm bài thi nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

