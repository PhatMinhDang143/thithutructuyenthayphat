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
    <div className="space-y-8 text-[#111111]">
      <div className="bg-white border-3 border-[#111111] p-6 shadow-[6px_6px_0px_#111111]">
        <h1 className="text-2xl md:text-3xl font-black text-[#111111] tracking-tight uppercase">
          HỆ THỐNG TỔNG QUAN GIÁO VIÊN
        </h1>
        <p className="text-xs md:text-sm text-neutral-700 font-bold mt-1">
          Báo cáo tình hình thi trực tuyến và phân bổ đề thi theo từng lớp học.
        </p>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 border-3 border-[#111111] shadow-[6px_6px_0px_#111111] relative overflow-hidden">
          <FileText className="absolute -right-3 -bottom-3 w-24 h-24 opacity-10 text-[#111111]" />
          <h3 className="text-neutral-700 font-black uppercase tracking-wider text-xs mb-1">
            Tổng Đề Thi Hiện Có
          </h3>
          <p className="text-4xl md:text-5xl font-black text-[#4D6BFE]">{examCount}</p>
          <div className="mt-3 text-xs text-neutral-800 font-bold flex items-center gap-1.5 pt-2 border-t-2 border-[#111111]">
            <CheckCircle className="w-3.5 h-3.5 text-[#0F9D58]" /> Đã thiết lập chỉ định lớp
          </div>
        </div>

        <div className="bg-white p-6 border-3 border-[#111111] shadow-[6px_6px_0px_#111111] relative overflow-hidden">
          <Users className="absolute -right-3 -bottom-3 w-24 h-24 opacity-10 text-[#111111]" />
          <h3 className="text-neutral-700 font-black uppercase tracking-wider text-xs mb-1">
            Số Học Sinh Trong Hệ Thống
          </h3>
          <p className="text-4xl md:text-5xl font-black text-[#111111]">{studentCount}</p>
          <div className="mt-3 text-xs text-neutral-800 font-bold flex items-center gap-1.5 pt-2 border-t-2 border-[#111111]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4D6BFE]" /> Được phân tài khoản & lớp
          </div>
        </div>

        <div className="bg-white p-6 border-3 border-[#111111] shadow-[6px_6px_0px_#111111] relative overflow-hidden">
          <Layers className="absolute -right-3 -bottom-3 w-24 h-24 opacity-10 text-[#111111]" />
          <h3 className="text-neutral-700 font-black uppercase tracking-wider text-xs mb-1">
            Danh Sách Lớp Học
          </h3>
          <p className="text-4xl md:text-5xl font-black text-[#FFC93C]">{classes.filter(c => c !== 'Tất cả').length}</p>
          <div className="mt-3 text-xs text-neutral-800 font-bold flex items-center gap-1.5 pt-2 border-t-2 border-[#111111]">
            <Layers className="w-3.5 h-3.5 text-[#111111]" /> Lớp 12A1, 12A2, 11B1...
          </div>
        </div>

        <div className="bg-white p-6 border-3 border-[#111111] shadow-[6px_6px_0px_#111111] relative overflow-hidden">
          <Award className="absolute -right-3 -bottom-3 w-24 h-24 opacity-10 text-[#111111]" />
          <h3 className="text-neutral-700 font-black uppercase tracking-wider text-xs mb-1">
            Lượt Bài Làm Nộp Lại
          </h3>
          <p className="text-4xl md:text-5xl font-black text-[#0F9D58]">{historyCount}</p>
          <div className="mt-3 text-xs text-neutral-800 font-bold flex items-center gap-1.5 pt-2 border-t-2 border-[#111111]">
            <TrendingUp className="w-3.5 h-3.5 text-[#0F9D58]" /> Đã chấm điểm tự động
          </div>
        </div>
      </div>

      {/* Class breakdown overview */}
      <div className="bg-white p-6 border-3 border-[#111111] shadow-[6px_6px_0px_#111111]">
        <h3 className="text-base font-black text-[#111111] mb-4 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#4D6BFE]" /> Phân Bổ Học Sinh Theo Từng Lớp
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(classStats).map(([groupName, count]) => (
            <div key={groupName} className="bg-[#FDF6E9] p-4 border-2 border-[#111111] shadow-[3px_3px_0px_#111111] text-center">
              <span className="text-xs font-black text-[#4D6BFE] uppercase tracking-wide block mb-1">
                Lớp {groupName}
              </span>
              <span className="text-2xl font-black text-[#111111]">{count}</span>
              <span className="text-[11px] text-neutral-700 font-bold block">học sinh</span>
            </div>
          ))}
          {Object.keys(classStats).length === 0 && (
            <div className="col-span-full text-neutral-600 font-bold text-xs py-4 text-center">Chưa có học sinh nào được phân lớp.</div>
          )}
        </div>
      </div>
    </div>
  );
};

