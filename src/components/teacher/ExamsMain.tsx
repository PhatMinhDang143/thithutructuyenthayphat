import React, { useState } from 'react';
import { ExamItem } from '../../types';
import { ExamForm } from './ExamForm';
import { FilePlus, Edit, Trash2, Clock, Users, FileText, Calendar, Sparkles } from 'lucide-react';
import { saveExamData, deleteExamData } from '../../services/storageService';

interface ExamsMainProps {
  exams: ExamItem[];
  classes: string[];
  onRefresh: () => void;
}

export const ExamsMain: React.FC<ExamsMainProps> = ({ exams, classes, onRefresh }) => {
  const [editingExam, setEditingExam] = useState<ExamItem | null | 'new'>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (editingExam !== null) {
    return (
      <ExamForm
        initialData={editingExam === 'new' ? null : editingExam}
        availableClasses={classes}
        onSave={async (payload) => {
          const res = await saveExamData(payload);
          if (res.success) {
            alert(res.message || 'Đã lưu cấu hình & phân lớp đề thi thành công!');
            setEditingExam(null);
            onRefresh();
          } else {
            alert('Lỗi: ' + (res.message || 'Không thể lưu đề thi.'));
          }
        }}
        onCancel={() => setEditingExam(null)}
      />
    );
  }

  const handleDeleteExam = async (id: string, title: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn đề thi "${title}"?`)) {
      setIsDeleting(true);
      const res = await deleteExamData(id);
      if (res.success) {
        alert('Đã xóa đề thi thành công!');
        onRefresh();
      }
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 p-6 rounded-2xl border border-slate-800 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white">Kho Đề Thi & Phân Quyền Lớp</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quản lý danh sách đề thi, cài đặt ma trận câu hỏi và chọn lớp được phép làm bài.
          </p>
        </div>
        <button
          onClick={() => setEditingExam('new')}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase text-xs tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all shrink-0"
        >
          <FilePlus className="w-4 h-4" /> Thêm Đề Thi Mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {exams.map((ex) => {
          const cfg = ex.questions || {};
          const targetGroup = cfg.target_group || 'Tất cả';

          return (
            <div
              key={ex.id}
              className="bg-slate-900/60 rounded-2xl p-6 border border-slate-800 hover:border-indigo-500/50 transition-all duration-300 shadow-xl flex flex-col justify-between group glow-card"
            >
              <div>
                {/* Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-700 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" /> {ex.duration} Phút
                  </span>

                  <span className="bg-indigo-950 text-indigo-300 border border-indigo-800/80 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1">
                    <Users className="w-3 h-3 text-indigo-400" /> Lớp: {targetGroup}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                  {ex.title}
                </h3>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      Cấu trúc: {cfg.exam_type === 'custom' ? 'Tùy biến' : 'Mặc định (12-4-6)'}
                    </span>
                  </div>

                  {cfg.start_time && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Giờ Mở: {cfg.start_time.replace('T', ' ')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 border-t border-slate-800/80 pt-4 mt-6">
                <button
                  onClick={() => setEditingExam(ex)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                >
                  <Edit className="w-3.5 h-3.5" /> Sửa & Phân Lớp
                </button>
                <button
                  onClick={() => handleDeleteExam(ex.id, ex.title)}
                  disabled={isDeleting}
                  className="w-10 h-10 flex items-center justify-center bg-rose-950/80 text-rose-400 border border-rose-900 hover:bg-rose-600 hover:text-white rounded-xl transition-all disabled:opacity-50"
                  title="Xóa đề thi"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {exams.length === 0 && (
          <div className="col-span-full text-slate-500 py-20 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/30 font-medium">
            Kho đề thi hiện đang trống. Hãy nhấn nút "Thêm Đề Thi Mới" để bắt đầu!
          </div>
        )}
      </div>
    </div>
  );
};
