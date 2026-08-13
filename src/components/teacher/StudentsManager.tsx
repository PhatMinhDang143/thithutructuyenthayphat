import React, { useState, useEffect } from 'react';
import { StudentAccount } from '../../types';
import { UserPlus, Save, Trash2, Loader2, Users, Layers, Filter, Plus, ShieldCheck } from 'lucide-react';
import { saveStudentsData } from '../../services/storageService';

interface StudentsManagerProps {
  students: { [username: string]: StudentAccount };
  classes: string[];
  onRefresh: () => void;
}

export const StudentsManager: React.FC<StudentsManagerProps> = ({
  students,
  classes,
  onRefresh,
}) => {
  const [studentList, setStudentList] = useState<StudentAccount[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('Tất cả');
  const [newClassName, setNewClassName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const list = (Object.entries(students) as [string, StudentAccount][]).map(([username, data]) => ({
      username: username || data.username,
      password: data.password || '123',
      name: data.name || '',
      group: data.group || '12A1',
    }));
    setStudentList(list);
  }, [students]);

  const handleUpdateRow = (index: number, field: keyof StudentAccount, value: string) => {
    const updated = [...studentList];
    updated[index] = { ...updated[index], [field]: value };
    setStudentList(updated);
  };

  const handleAddRow = () => {
    setStudentList([
      {
        username: `hs_${Date.now().toString().slice(-4)}`,
        password: '123',
        name: 'Học sinh mới',
        group: selectedClassFilter !== 'Tất cả' ? selectedClassFilter : '12A1',
      },
      ...studentList,
    ]);
  };

  const handleRemoveRow = (index: number) => {
    const updated = studentList.filter((_, idx) => idx !== index);
    setStudentList(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const obj: { [username: string]: StudentAccount } = {};

    studentList.forEach((s) => {
      const cleanUser = s.username.trim();
      if (cleanUser) {
        obj[cleanUser] = {
          username: cleanUser,
          password: s.password ? s.password.trim() : '123',
          name: s.name.trim() || 'Học sinh',
          group: s.group ? s.group.trim() : '12A1',
        };
      }
    });

    const res = await saveStudentsData(obj);
    if (res.success) {
      alert('Đã cập nhật danh sách học viên & lớp học thành công!');
      onRefresh();
    } else {
      alert('Lỗi: ' + (res.message || 'Không thể lưu học sinh.'));
    }
    setIsSaving(false);
  };

  // Filter list by selected class
  const filteredList = studentList.filter((s) => {
    if (selectedClassFilter === 'Tất cả') return true;
    return s.group.toLowerCase().trim() === selectedClassFilter.toLowerCase().trim();
  });

  return (
    <div className="cyber-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white">Xác Thực & Phân Lớp Học Viên</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quản lý tài khoản học sinh và gán trực tiếp vào từng lớp học cụ thể.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={handleAddRow}
            className="px-4 py-2.5 bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/60 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Thêm Ô Học Sinh
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu Tất Cả Thay Đổi'}
          </button>
        </div>
      </div>

      {/* Class Filter Bar */}
      <div className="px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-xl mx-6 border border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-300 uppercase">Lọc Danh Sách Theo Lớp:</span>
          <div className="flex flex-wrap gap-1.5 ml-2">
            {classes.map((clsName) => (
              <button
                key={clsName}
                onClick={() => setSelectedClassFilter(clsName)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedClassFilter === clsName
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {clsName === 'Tất cả' ? 'Tất Cả Lớp' : `Lớp ${clsName}`}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Hiển thị: <strong className="text-white">{filteredList.length}</strong> học sinh
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 custom-scroll p-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-950 border border-slate-800">
              <th className="p-3.5 w-44">Tài Khoản (SBD)</th>
              <th className="p-3.5 w-36">Mật Khẩu</th>
              <th className="p-3.5">Họ Và Tên Học Sinh</th>
              <th className="p-3.5 w-48">Phân Lớp Học Sinh</th>
              <th className="p-3.5 w-16 text-center">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredList.map((s, idx) => {
              // Find real index in total list
              const realIndex = studentList.findIndex((item) => item === s);

              return (
                <tr key={realIndex >= 0 ? realIndex : idx} className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-2">
                    <input
                      type="text"
                      value={s.username}
                      onChange={(e) => handleUpdateRow(realIndex, 'username', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 p-2.5 rounded-xl outline-none font-bold text-xs text-indigo-300"
                      placeholder="Mã định danh"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={s.password}
                      onChange={(e) => handleUpdateRow(realIndex, 'password', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 p-2.5 rounded-xl outline-none text-xs text-slate-300 font-mono"
                      placeholder="Mật khẩu"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => handleUpdateRow(realIndex, 'name', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 p-2.5 rounded-xl outline-none font-bold text-xs text-white"
                      placeholder="Họ tên đầy đủ"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={s.group}
                      onChange={(e) => handleUpdateRow(realIndex, 'group', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 p-2.5 rounded-xl outline-none font-extrabold text-xs text-cyan-300 uppercase"
                      placeholder="VD: 12A1"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleRemoveRow(realIndex)}
                      className="p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-all"
                      title="Xóa học sinh này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredList.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center text-slate-500 text-xs">
                  Không có học sinh nào trong {selectedClassFilter === 'Tất cả' ? 'danh sách' : `Lớp ${selectedClassFilter}`}. Nhấn "Thêm Ô Học Sinh" để tạo tài khoản mới.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
