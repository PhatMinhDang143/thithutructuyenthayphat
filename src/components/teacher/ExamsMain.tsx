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
    <div className="space-y-6 text-[#111111]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 border-3 border-[#111111] shadow-[6px_6px_0px_#111111] gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase text-[#111111]">Kho Đề Thi & Phân Quyền Lớp</h2>
          <p className="text-xs md:text-sm text-neutral-700 font-bold mt-0.5">
            Quản lý danh sách đề thi, cài đặt ma trận câu hỏi và chọn lớp được phép làm bài.
          </p>
        </div>
        <button
          onClick={() => setEditingExam('new')}
          className="px-5 py-3.5 bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black uppercase text-xs tracking-wider flex items-center gap-2 transition-all shrink-0"
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
              className="bg-white p-6 border-3 border-[#111111] shadow-[6px_6px_0px_#111111] flex flex-col justify-between"
            >
              <div>
                {/* Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="bg-[#FDF6E9] text-[#111111] px-2.5 py-1 text-[11px] font-black border-2 border-[#111111] shadow-[2px_2px_0px_#111111] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#4D6BFE]" /> {ex.duration} Phút
                  </span>

                  <span className="bg-[#4D6BFE] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] px-2.5 py-1 text-[11px] font-black flex items-center gap-1 truncate max-w-[140px]">
                    <Users className="w-3.5 h-3.5" /> Lớp: {targetGroup}
                  </span>
                </div>

                <h3 className="text-base font-black uppercase text-[#111111] line-clamp-2 mb-3 leading-snug">
                  {ex.title}
                </h3>

                <div className="mt-4 pt-3 border-t-2 border-[#111111] space-y-1.5 text-xs text-neutral-700 font-bold bg-[#FDF6E9] p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#111111]" />
                    <span>
                      Cấu trúc: {cfg.exam_type === 'custom' ? 'Tùy biến' : 'Mặc định (12-4-6)'}
                    </span>
                  </div>

                  {cfg.start_time && (
                    <div className="flex items-center gap-2 text-[11px] text-[#111111] font-black">
                      <Calendar className="w-3.5 h-3.5 text-[#4D6BFE]" />
                      <span>Giờ Mở: {cfg.start_time.replace('T', ' ')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 border-t-2 border-[#111111] pt-4 mt-6">
                <button
                  onClick={() => setEditingExam(ex)}
                  className="flex-1 py-3 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                >
                  <Edit className="w-3.5 h-3.5" /> Sửa & Phân Lớp
                </button>
                <button
                  onClick={() => handleDeleteExam(ex.id, ex.title)}
                  disabled={isDeleting}
                  className="w-11 h-11 flex items-center justify-center bg-white text-[#E63946] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] hover:bg-[#E63946] hover:text-white active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50"
                  title="Xóa đề thi"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {exams.length === 0 && (
          <div className="col-span-full text-neutral-600 py-20 text-center border-3 border-dashed border-[#111111] bg-white shadow-[6px_6px_0px_#111111] font-black">
            Kho đề thi hiện đang trống. Hãy nhấn nút "Thêm Đề Thi Mới" để bắt đầu!
          </div>
        )}
      </div>
    </div>
  );
};

