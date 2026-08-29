import React, { useState } from 'react';
import { ExamItem, StudentAccount, ExamSubmission } from '../../types';
import { 
  FileText, Users, Award, Layers, TrendingUp, ShieldCheck, CheckCircle, 
  Settings, Code, Copy, Check, ExternalLink, RefreshCw 
} from 'lucide-react';
import { getApiUrl, setApiUrl, resetApiUrl, GOOGLE_APPS_SCRIPT_CODE } from '../../services/storageService';

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

  // Teacher Google Apps Script API configuration state
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'script'>('api');
  const [apiUrlInput, setApiUrlInput] = useState(getApiUrl());
  const [saveMsg, setSaveMsg] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setApiUrl(apiUrlInput);
    setSaveMsg('Đã lưu cấu hình Google Apps Script API an toàn!');
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const handleResetSettings = () => {
    resetApiUrl();
    setApiUrlInput(getApiUrl());
    setSaveMsg('Đã khôi phục URL mặc định!');
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  // Calculate student distribution by class
  const classStats: { [group: string]: number } = {};
  (Object.values(students) as StudentAccount[]).forEach((s) => {
    const grp = s.group || 'Chưa phân lớp';
    classStats[grp] = (classStats[grp] || 0) + 1;
  });

  return (
    <div className="space-y-8 text-[#111111]">
      <div className="bg-white border-3 border-[#111111] p-6 shadow-[6px_6px_0px_#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#111111] tracking-tight uppercase">
            HỆ THỐNG TỔNG QUAN GIÁO VIÊN
          </h1>
          <p className="text-xs md:text-sm text-neutral-700 font-bold mt-1">
            Báo cáo tình hình thi trực tuyến và phân bổ đề thi theo từng lớp học.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className="px-4 py-2.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] text-xs font-black shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-2 shrink-0 transition-all"
        >
          <Settings className="w-4 h-4" />
          <span>{showConfig ? 'Ẩn Cấu Hình API GV' : 'Cấu Hình Google Sheet API (Bảo Mật)'}</span>
        </button>
      </div>

      {/* Teacher Private Google Sheet API & Script Setup */}
      {showConfig && (
        <div className="bg-white border-3 border-[#111111] p-6 shadow-[6px_6px_0px_#111111] space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#111111] pb-3 gap-2">
            <h3 className="text-base font-black text-[#111111] uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0F9D58]" /> Cấu Hình Google Apps Script (Bảo Mật Nội Bộ GV)
            </h3>
            <div className="flex gap-1 bg-[#FDF6E9] p-1 border-2 border-[#111111] text-xs font-black">
              <button
                type="button"
                onClick={() => setActiveTab('api')}
                className={`px-3 py-1 font-black transition-all ${
                  activeTab === 'api'
                    ? 'bg-[#4D6BFE] text-white border border-[#111111] shadow-[1px_1px_0px_#111111]'
                    : 'text-neutral-700 hover:text-[#111111]'
                }`}
              >
                Kết Nối Web App API
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('script')}
                className={`px-3 py-1 font-black flex items-center gap-1.5 transition-all ${
                  activeTab === 'script'
                    ? 'bg-[#4D6BFE] text-white border border-[#111111]'
                    : 'text-neutral-700 hover:text-[#111111]'
                }`}
              >
                <Code className="w-3.5 h-3.5" /> Mã Code.gs
              </button>
            </div>
          </div>

          {activeTab === 'api' ? (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-[#111111] uppercase mb-1">
                  Đường dẫn Web App API (API_URL)
                </label>
                <input
                  type="text"
                  value={apiUrlInput}
                  onChange={(e) => setApiUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full p-3 bg-[#FDF6E9] border-2 border-[#111111] text-xs text-[#111111] font-mono outline-none focus:bg-white shadow-[2px_2px_0px_#111111]"
                />
              </div>

              {saveMsg && (
                <div className="p-3 bg-[#0F9D58] text-white border-2 border-[#111111] text-xs font-bold shadow-[2px_2px_0px_#111111]">
                  {saveMsg}
                </div>
              )}

              <div className="p-3 bg-[#FDF6E9] border-2 border-[#111111] text-xs text-neutral-800 space-y-1 shadow-[2px_2px_0px_#111111]">
                <p className="font-black text-[#111111]">🔒 An toàn & Bảo mật:</p>
                <p>• Thông tin API và mã Code.gs chỉ hiển thị trong Bảng Điều Hành Giáo Viên, học sinh không thể xem thấy.</p>
                <p>• Dữ liệu bài thi và đề thi được đồng bộ tự động giữa máy chủ và Google Sheet theo thời gian thực.</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetSettings}
                  className="text-xs font-bold text-neutral-700 hover:text-[#111111] underline"
                >
                  Khôi phục URL mặc định
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] text-xs font-black shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  Lưu Cấu Hình
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-700 font-medium">
                  Mã Code.gs dùng cho Google Sheets (Tiện ích mở rộng &gt; Apps Script &gt; Dán mã &gt; Triển khai Web App):
                </p>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3 py-1.5 bg-[#FFC93C] hover:bg-[#ffd460] text-[#111111] border-2 border-[#111111] text-xs font-black flex items-center gap-1.5 shrink-0 shadow-[2px_2px_0px_#111111]"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-[#0F9D58]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedScript ? 'Đã sao chép!' : 'Sao chép mã'}
                </button>
              </div>

              <div className="bg-[#111111] border-2 border-[#111111] p-3 overflow-y-auto custom-scroll max-h-[300px]">
                <pre className="text-[11px] font-mono text-[#FFC93C] leading-relaxed select-all">
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

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
