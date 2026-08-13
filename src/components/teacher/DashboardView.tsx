import React from 'react';
import { ExamItem, StudentAccount, ExamSubmission } from '../../types';
import { FileText, Users, Award, Layers, TrendingUp, ShieldCheck, CheckCircle } from 'lucide-react';

interface DashboardViewProps {
  exams: ExamItem[];
  students: { [username: string]: StudentAccount };
  history: ExamSubmission[];
  classes: string[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  exams,
  students,
  history,
  classes,
}) => {
  const studentCount = Object.keys(students).length;
  const examCount = exams.length;
  const historyCount = history.length;

  // Calculate student distribution by class
  const classStats: { [group: string]: number } = {};
  (Object.values(students) as StudentAccount[]).forEach((s) => {
    const grp = s.group || 'Chưa phân lớp';
    classStats[grp] = (classStats[grp] || 0) + 1;
  });

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Hệ Thống Tổng Quan Giáo Viên
        </h1>
        <p className="text-xs md:text-sm text-slate-400 mt-1">
          Báo cáo tình hình thi trực tuyến và phân bổ đề thi theo từng lớp học.
        </p>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-6 rounded-2xl border border-indigo-500/20 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <FileText className="absolute -right-4 -bottom-4 w-28 h-28 opacity-10 text-indigo-400" />
          <h3 className="text-indigo-300 font-bold uppercase tracking-wider text-xs mb-1">
            Tổng Đề Thi Hiện Có
          </h3>
          <p className="text-5xl font-black text-white">{examCount}</p>
          <div className="mt-3 text-xs text-indigo-400/80 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Đã thiết lập chỉ định lớp
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-950 via-cyan-900 to-slate-900 p-6 rounded-2xl border border-cyan-500/20 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <Users className="absolute -right-4 -bottom-4 w-28 h-28 opacity-10 text-cyan-400" />
          <h3 className="text-cyan-300 font-bold uppercase tracking-wider text-xs mb-1">
            Số Học Sinh Trong Hệ Thống
          </h3>
          <p className="text-5xl font-black text-white">{studentCount}</p>
          <div className="mt-3 text-xs text-cyan-400/80 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Được phân tài khoản & lớp
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-950 via-purple-900 to-slate-900 p-6 rounded-2xl border border-purple-500/20 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <Layers className="absolute -right-4 -bottom-4 w-28 h-28 opacity-10 text-purple-400" />
          <h3 className="text-purple-300 font-bold uppercase tracking-wider text-xs mb-1">
            Danh Sách Lớp Học
          </h3>
          <p className="text-5xl font-black text-white">{classes.filter(c => c !== 'Tất cả').length}</p>
          <div className="mt-3 text-xs text-purple-400/80 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Lớp 12A1, 12A2, 11B1...
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 p-6 rounded-2xl border border-emerald-500/20 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <Award className="absolute -right-4 -bottom-4 w-28 h-28 opacity-10 text-emerald-400" />
          <h3 className="text-emerald-300 font-bold uppercase tracking-wider text-xs mb-1">
            Lượt Bài Làm Nộp Lại
          </h3>
          <p className="text-5xl font-black text-white">{historyCount}</p>
          <div className="mt-3 text-xs text-emerald-400/80 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Đã chấm điểm tự động
          </div>
        </div>
      </div>

      {/* Class breakdown overview */}
      <div className="cyber-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" /> Phân Bổ Học Sinh Theo Từng Lớp
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(classStats).map(([groupName, count]) => (
            <div key={groupName} className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-center">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide block mb-1">
                Lớp {groupName}
              </span>
              <span className="text-2xl font-black text-white">{count}</span>
              <span className="text-[11px] text-slate-500 block">học sinh</span>
            </div>
          ))}
          {Object.keys(classStats).length === 0 && (
            <div className="col-span-full text-slate-500 text-xs py-4 text-center">Chưa có học sinh nào được phân lớp.</div>
          )}
        </div>
      </div>
    </div>
  );
};
