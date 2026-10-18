import React, { useState } from 'react';
import { ExamItem, ExamSubmission } from '../../types';
import { ExamForm } from './ExamForm';
import { FilePlus, Edit, Trash2, Clock, Users, FileText, Calendar, Sparkles, BarChart2, Lock, Unlock, Megaphone, Zap, CheckCircle2 } from 'lucide-react';
import { saveExamData, deleteExamData, getLocalHistory } from '../../services/storageService';
import { QuestionAnalyticsModal } from './QuestionAnalyticsModal';
import { extractGradeFromExam, getExamGradeBadge } from '../../utils/gradeUtils';

interface ExamsMainProps {
  exams: ExamItem[];
  classes: string[];
  onRefresh: () => void;
  history?: ExamSubmission[];
}

export const ExamsMain: React.FC<ExamsMainProps> = ({ exams, classes, onRefresh, history }) => {
  const [editingExam, setEditingExam] = useState<ExamItem | null | 'new'>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedExamForAnalytics, setSelectedExamForAnalytics] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<'all' | '12' | '11' | '10' | 'general'>('all');

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

  const handleToggleReleaseScore = async (exam: ExamItem) => {
    const isCurrentlyReleased = exam.questions?.score_released === true || exam.score_released === true;
    const nextState = !isCurrentlyReleased;

    const confirmMsg = nextState
      ? `Bạn có chắc chắn muốn CÔNG BỐ ĐIỂM ĐỒNG LOẠT cho đề thi "${exam.title}"?\n\nTất cả học sinh đã nộp bài sẽ xem được điểm số và đáp án chi tiết ngay lập tức.`
      : `Bạn có muốn TẠM KHÓA / ẨN ĐIỂM của đề thi "${exam.title}"?\n\nHọc sinh sẽ không xem được điểm cho đến khi bạn công bố lại.`;

    if (!window.confirm(confirmMsg)) return;

    const updatedExam: ExamItem = {
      ...exam,
      score_released: nextState,
      publish_score_mode: exam.questions?.publish_score_mode || exam.publish_score_mode || 'manual',
      questions: {
        ...(exam.questions || {}),
        score_released: nextState,
        publish_score_mode: exam.questions?.publish_score_mode || exam.publish_score_mode || 'manual',
      },
    };

    const res = await saveExamData(updatedExam);
    if (res.success) {
      alert(nextState 
        ? `Đã CÔNG BỐ ĐIỂM ĐỒNG LOẠT thành công cho đề "${exam.title}"!`
        : `Đã tạm ẩn điểm cho đề "${exam.title}".`
      );
      onRefresh();
    } else {
      alert('Lỗi: ' + (res.message || 'Không thể cập nhật trạng thái công bố điểm.'));
    }
  };

  const safeHistory = history || getLocalHistory() || [];

  const k12Count = exams.filter((ex) => extractGradeFromExam(ex) === 12).length;
  const k11Count = exams.filter((ex) => extractGradeFromExam(ex) === 11).length;
  const k10Count = exams.filter((ex) => extractGradeFromExam(ex) === 10).length;
  const generalCount = exams.filter((ex) => extractGradeFromExam(ex) === null).length;

  const filteredExams = exams.filter((ex) => {
    if (gradeFilter === 'all') return true;
    const grade = extractGradeFromExam(ex);
    if (gradeFilter === '12') return grade === 12;
    if (gradeFilter === '11') return grade === 11;
    if (gradeFilter === '10') return grade === 10;
    if (gradeFilter === 'general') return grade === null;
    return true;
  });

  return (
    <div className="space-y-6 text-[#111111]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 border-3 border-[#111111] shadow-[6px_6px_0px_#111111] gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase text-[#111111]">Kho Đề Thi & Phân Quyền Lớp</h2>
          <p className="text-xs md:text-sm text-neutral-700 font-bold mt-0.5">
            Quản lý danh sách đề thi, lọc theo khối 10/11/12, cài đặt ma trận câu hỏi và công bố điểm.
          </p>
        </div>
        <button
          onClick={() => setEditingExam('new')}
          className="px-5 py-3.5 bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black uppercase text-xs tracking-wider flex items-center gap-2 transition-all shrink-0"
        >
          <FilePlus className="w-4 h-4" /> Thêm Đề Thi Mới
        </button>
      </div>

      {/* Grade Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: `Tất Cả (${exams.length})` },
          { key: '12', label: `Khối 12 (${k12Count})` },
          { key: '11', label: `Khối 11 (${k11Count})` },
          { key: '10', label: `Khối 10 (${k10Count})` },
          { key: 'general', label: `Chung Toàn Trường (${generalCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setGradeFilter(tab.key as any)}
            className={`px-3 py-1.5 text-xs font-black uppercase transition-all border-2 border-[#111111] ${
              gradeFilter === tab.key
                ? 'bg-[#111111] text-white shadow-[2px_2px_0px_#111111]'
                : 'bg-white text-[#111111] hover:bg-[#FDF6E9]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredExams.map((ex) => {
          const cfg = ex.questions || {};
          const targetGroup = cfg.target_group ||
            (Array.isArray((ex as any).assigned_classes) && (ex as any).assigned_classes.length > 0 ? (ex as any).assigned_classes.join(', ') : '') ||
            (ex as any).target_group ||
            'Tất cả';
          const examDuration = Math.max(1, Number(ex.duration) || Number((ex as any).time_limit_minutes) || (typeof (ex as any).description === 'number' ? (ex as any).description : 0) || Number(cfg.duration) || 45);
          const isManualMode = cfg.publish_score_mode === 'manual' || ex.publish_score_mode === 'manual';
          const isScoreReleased = cfg.score_released === true || ex.score_released === true;
          const gradeBadge = getExamGradeBadge(ex);
          
          // Count submissions for this exam
          const examSubmissions = safeHistory.filter((h) => {
            const hExam = (h.examTitle || '').trim().toLowerCase();
            return (ex.id && h.examId === ex.id) || hExam === (ex.title || '').trim().toLowerCase();
          });
          const submissionCount = examSubmissions.length;

          return (
            <div
              key={ex.id}
              className="bg-white p-6 border-3 border-[#111111] shadow-[6px_6px_0px_#111111] flex flex-col justify-between"
            >
              <div>
                {/* Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2.5 py-1 text-[11px] font-black border-2 border-[#111111] shadow-[2px_2px_0px_#111111] ${gradeBadge.color}`}>
                      {gradeBadge.label}
                    </span>
                    <span className="bg-[#FDF6E9] text-[#111111] px-2.5 py-1 text-[11px] font-black border-2 border-[#111111] shadow-[2px_2px_0px_#111111] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#4D6BFE]" /> {examDuration} Phút
                    </span>
                  </div>

                  <span className="bg-[#4D6BFE] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] px-2.5 py-1 text-[11px] font-black flex items-center gap-1 truncate max-w-[140px]">
                    <Users className="w-3.5 h-3.5" /> Lớp: {targetGroup}
                  </span>
                </div>

                {/* PUBLISH SCORE STATUS BADGE */}
                <div className="mb-3">
                  {isManualMode ? (
                    isScoreReleased ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0F9D58] text-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[11px] font-black uppercase">
                        <Megaphone className="w-3.5 h-3.5" /> Đã Công Bố Điểm ({submissionCount} bài)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFC93C] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[11px] font-black uppercase">
                        <Lock className="w-3.5 h-3.5 text-[#E63946]" /> Chờ Chấm Đồng Loạt ({submissionCount} bài)
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FDF6E9] text-neutral-800 border-2 border-[#111111] shadow-[2px_2px_0px_#111111] text-[11px] font-black uppercase">
                      <Zap className="w-3.5 h-3.5 text-[#0F9D58]" /> Điểm Tức Thì Sau Nộp ({submissionCount} bài)
                    </span>
                  )}
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

                  {cfg.end_time && (
                    <div className="flex items-center gap-2 text-[11px] text-[#E63946] font-black">
                      <Clock className="w-3.5 h-3.5 text-[#E63946]" />
                      <span>Hạn Chót (Deadline): {cfg.end_time.replace('T', ' ')}</span>
                    </div>
                  )}
                </div>

                {/* BATCH SCORE RELEASE BUTTON FOR MANUAL MODE */}
                {isManualMode && (
                  <div className="mt-3 p-3 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-black uppercase text-neutral-800 flex items-center gap-1">
                        <Megaphone className="w-3.5 h-3.5 text-[#4D6BFE]" /> Chấm Đồng Loạt:
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 border border-[#111111] ${
                        isScoreReleased ? 'bg-[#0F9D58] text-white' : 'bg-[#FFC93C] text-[#111111]'
                      }`}>
                        {isScoreReleased ? 'Đã Mở Điểm' : 'Đang Khóa'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleReleaseScore(ex)}
                      className={`w-full py-2 px-3 text-xs font-black uppercase tracking-wider border-2 border-[#111111] shadow-[2px_2px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 transition-all ${
                        isScoreReleased
                          ? 'bg-neutral-100 hover:bg-[#E63946] hover:text-white text-neutral-800'
                          : 'bg-[#0F9D58] hover:bg-[#0d854a] text-white animate-pulse hover:animate-none'
                      }`}
                    >
                      {isScoreReleased ? (
                        <>
                          <Lock className="w-3.5 h-3.5" /> Khóa / Ẩn Lại Điểm
                        </>
                      ) : (
                        <>
                          <Megaphone className="w-3.5 h-3.5" /> Công Bố Điểm Đồng Loạt ({submissionCount} Học Sinh)
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t-2 border-[#111111] pt-4 mt-6">
                <button
                  onClick={() => {
                    const normalized: ExamItem = {
                      ...ex,
                      duration: examDuration,
                      time_limit_minutes: examDuration,
                      description: examDuration,
                      target_group: targetGroup,
                      assigned_classes: targetGroup === 'Tất cả' ? [] : targetGroup.split(',').map((s) => s.trim()).filter(Boolean),
                      questions: {
                        ...cfg,
                        duration: examDuration,
                        target_group: targetGroup,
                      },
                    };
                    setEditingExam(normalized);
                  }}
                  className="flex-1 py-3 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Sửa & Phân Lớp
                </button>
                <button
                  onClick={() => setSelectedExamForAnalytics(ex.id)}
                  className="px-3 py-3 bg-[#00E599] hover:bg-[#00c784] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Xem phân tích câu đúng nhiều / sai nhiều của đề này"
                >
                  <BarChart2 className="w-3.5 h-3.5" /> Phân Tích
                </button>
                <button
                  onClick={() => handleDeleteExam(ex.id, ex.title)}
                  disabled={isDeleting}
                  className="w-11 h-11 flex items-center justify-center bg-white text-[#E63946] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] hover:bg-[#E63946] hover:text-white active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 cursor-pointer"
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

      {/* Question Analytics Modal */}
      {selectedExamForAnalytics && (
        <QuestionAnalyticsModal
          isOpen={Boolean(selectedExamForAnalytics)}
          onClose={() => setSelectedExamForAnalytics(null)}
          exams={exams}
          history={history || getLocalHistory()}
          availableClasses={classes}
          initialExamId={selectedExamForAnalytics}
        />
      )}
    </div>
  );
};

