import React, { useState } from 'react';
import { ExamSubmission } from '../../types';
import { Trash2, ShieldCheck, AlertTriangle, Filter, Search, Award } from 'lucide-react';
import { clearExamHistory } from '../../services/storageService';

interface HistoryViewerProps {
  history: ExamSubmission[];
  classes: string[];
  onRefresh: () => void;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ history, classes, onRefresh }) => {
  const [selectedClass, setSelectedClass] = useState('Tất cả');
  const [searchTerm, setSearchTerm] = useState('');

  const handleClearHistory = async () => {
    if (window.confirm('CẢNH BÁO: Dọn sạch toàn bộ nhật ký bài làm và điểm số? Hành động này không thể hoàn tác.')) {
      await clearExamHistory();
      alert('Đã xóa bộ nhớ lịch sử thành công!');
      onRefresh();
    }
  };

  const filteredHistory = history.filter((h) => {
    const matchesClass = selectedClass === 'Tất cả' || h.group.toLowerCase() === selectedClass.toLowerCase();
    const matchesSearch =
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.examTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.username.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClass && matchesSearch;
  });

  return (
    <div className="bg-white border-3 border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden flex flex-col h-full space-y-6 text-[#111111]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b-2 border-[#111111] gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase text-[#111111]">Nhật Ký & Bảng Điểm Thi Theo Lớp</h2>
          <p className="text-xs md:text-sm text-neutral-700 font-bold mt-0.5">
            Xem điểm số tự động, thời gian nộp bài và giám sát vi phạm của học sinh.
          </p>
        </div>

        <button
          onClick={handleClearHistory}
          className="px-4 py-3 bg-[#E63946] text-white border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all"
        >
          <Trash2 className="w-4 h-4" /> Xóa Toàn Bộ Lịch Sử
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Class Filter */}
        <div className="flex items-center gap-2 bg-[#FDF6E9] p-3 border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
          <Filter className="w-4 h-4 text-[#4D6BFE] shrink-0" />
          <span className="text-xs font-black text-[#111111] uppercase shrink-0">Lớp:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-white text-[#111111] border-2 border-[#111111] text-xs font-black p-1.5 outline-none cursor-pointer"
          >
            {classes.map((clsName) => (
              <option key={clsName} value={clsName}>
                {clsName === 'Tất cả' ? 'Tất Cả Các Lớp' : `Lớp ${clsName}`}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên học sinh hoặc đề thi..."
            className="w-full p-3 pl-10 bg-white border-2 border-[#111111] shadow-[3px_3px_0px_#111111] text-xs text-[#111111] outline-none font-bold placeholder:text-neutral-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scroll flex-1 px-6 pb-6">
        <table className="w-full text-left border-collapse border-2 border-[#111111]">
          <thead>
            <tr className="text-xs uppercase tracking-wider font-black text-[#111111] bg-[#FDF6E9] border-b-2 border-[#111111]">
              <th className="p-3.5 border-r-2 border-[#111111]">Thời Gian Nộp</th>
              <th className="p-3.5 border-r-2 border-[#111111]">Thí Sinh</th>
              <th className="p-3.5 border-r-2 border-[#111111]">Lớp Học</th>
              <th className="p-3.5 border-r-2 border-[#111111]">Đề Khảo Sát</th>
              <th className="p-3.5 border-r-2 border-[#111111] text-[#0F9D58]">Điểm Số</th>
              <th className="p-3.5 text-center">Giám Sát Vi Phạm</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-neutral-200">
            {filteredHistory.slice().reverse().map((h, i) => (
              <tr key={i} className="hover:bg-[#FDF6E9] transition-colors">
                <td className="p-3.5 text-xs font-bold text-neutral-600 border-r-2 border-neutral-200">{h.submitted_at}</td>
                <td className="p-3.5 text-xs font-black text-[#111111] border-r-2 border-neutral-200">{h.name}</td>
                <td className="p-3.5 text-xs font-black text-[#4D6BFE] uppercase border-r-2 border-neutral-200">{h.group || 'Khách'}</td>
                <td className="p-3.5 text-xs text-neutral-800 font-bold max-w-xs truncate border-r-2 border-neutral-200" title={h.examTitle}>
                  {h.examTitle}
                </td>
                <td className="p-3.5 text-xl text-[#0F9D58] font-black border-r-2 border-neutral-200">{h.score}</td>
                <td className="p-3.5 text-center">
                  <div className="flex justify-center">
                    <span
                      className={`px-3 py-1 text-[11px] font-black flex items-center gap-1.5 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] w-max ${
                        h.cheat && h.cheat.includes('0')
                          ? 'bg-[#FDF6E9] text-neutral-700'
                          : 'bg-[#E63946] text-white'
                      }`}
                    >
                      {h.cheat && h.cheat.includes('0') ? <ShieldCheck className="w-3.5 h-3.5 text-[#0F9D58]" /> : <AlertTriangle className="w-3.5 h-3.5 text-white" />}
                      {h.cheat && h.cheat.includes('0') ? 'Tuyệt đối an toàn' : h.cheat}
                    </span>
                  </div>
                </td>
              </tr>
            ))}

            {filteredHistory.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-neutral-600 font-bold text-xs">
                  Chưa có lịch sử làm bài thi nào phù hợp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

