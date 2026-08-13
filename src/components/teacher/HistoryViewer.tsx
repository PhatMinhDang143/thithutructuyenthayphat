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
    if (window.confirm('CẢNH BÁO TỐI CAO: Dọn sạch toàn bộ nhật ký bài làm và điểm số? Hành động này không thể hoàn tác.')) {
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
    <div className="cyber-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white">Nhật Ký & Bảng Điểm Thi Theo Lớp</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Xem điểm số tự động, thời gian nộp bài và giám sát vi phạm của học sinh.
          </p>
        </div>

        <button
          onClick={handleClearHistory}
          className="px-4 py-2.5 bg-rose-950 text-rose-400 border border-rose-900/60 hover:bg-rose-900 rounded-xl font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all"
        >
          <Trash2 className="w-4 h-4" /> Xóa Toàn Bộ Lịch Sử
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Class Filter */}
        <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <Filter className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-bold text-slate-300 uppercase shrink-0">Lớp:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-slate-900 text-white text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer"
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
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên học sinh hoặc đề thi..."
            className="w-full p-3 pl-10 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500 font-medium"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scroll flex-1 p-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-950 border border-slate-800">
              <th className="p-3.5">Thời Gian Nộp</th>
              <th className="p-3.5">Thí Sinh</th>
              <th className="p-3.5">Lớp Học</th>
              <th className="p-3.5">Đề Khảo Sát</th>
              <th className="p-3.5 text-emerald-400">Điểm Số</th>
              <th className="p-3.5 text-center">Giám Sát Vi Phạm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredHistory.slice().reverse().map((h, i) => (
              <tr key={i} className="hover:bg-slate-900/40 transition-colors">
                <td className="p-3.5 text-xs text-slate-400">{h.submitted_at}</td>
                <td className="p-3.5 text-xs font-bold text-white">{h.name}</td>
                <td className="p-3.5 text-xs font-extrabold text-indigo-400 uppercase">{h.group || 'Khách'}</td>
                <td className="p-3.5 text-xs text-slate-300 font-semibold max-w-xs truncate" title={h.examTitle}>
                  {h.examTitle}
                </td>
                <td className="p-3.5 text-lg text-emerald-400 font-black">{h.score}</td>
                <td className="p-3.5 text-center">
                  <div className="flex justify-center">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 w-max ${
                        h.cheat && h.cheat.includes('0')
                          ? 'bg-slate-950 text-slate-500'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {h.cheat && h.cheat.includes('0') ? <ShieldCheck className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-rose-400" />}
                      {h.cheat && h.cheat.includes('0') ? 'Tuyệt đối an toàn' : h.cheat}
                    </span>
                  </div>
                </td>
              </tr>
            ))}

            {filteredHistory.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-500 text-xs">
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
