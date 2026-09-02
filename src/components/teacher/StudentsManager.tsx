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
    const list = (Object.entries(students) as [string, StudentAccount][]).map(([username, data]) => {
      let u = username || data.username || '';
      let p = String(data.password !== undefined ? data.password : '').trim();
      let n = String(data.name || '').trim();
      let g = String(data.group || 'Chưa phân lớp').trim();

      // Auto-detect if name and password got inverted
      const pHasAccentsOrSpaces = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(p) || p.includes(' ');
      const nHasNoAccentsOrSpaces = !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/i.test(n) && !n.includes(' ');

      if (pHasAccentsOrSpaces && nHasNoAccentsOrSpaces && n.length > 0) {
        const temp = n;
        n = p;
        p = temp;
      }

      return {
        username: u,
        password: p,
        name: n || u,
        group: g,
      };
    });
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
          password: s.password !== undefined ? s.password.trim() : '',
          name: s.name.trim() || 'Học sinh',
          group: s.group ? s.group.trim() : 'Chưa phân lớp',
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
    <div className="bg-white border-3 border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden flex flex-col h-full space-y-6 text-[#111111]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b-2 border-[#111111] gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase text-[#111111]">Xác Thực & Phân Lớp Học Viên</h2>
          <p className="text-xs md:text-sm text-neutral-700 font-bold mt-0.5">
            Quản lý tài khoản học sinh và gán trực tiếp vào từng lớp học cụ thể.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={handleAddRow}
            className="px-4 py-3 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
          >
            <UserPlus className="w-4 h-4 text-[#4D6BFE]" /> Thêm Ô Học Sinh
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-3 bg-[#FFC93C] hover:bg-[#ffd460] active:bg-[#e6b432] text-[#111111] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] active:translate-x-[1px] active:translate-y-[1px] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu Tất Cả Thay Đổi'}
          </button>
        </div>
      </div>

      {/* Class Filter Bar */}
      <div className="px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FDF6E9] p-4 mx-6 border-2 border-[#111111] shadow-[3px_3px_0px_#111111]">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-[#4D6BFE]" />
          <span className="text-xs font-black text-[#111111] uppercase">Lọc Danh Sách Theo Lớp:</span>
          <div className="flex flex-wrap gap-1.5 ml-2">
            {classes.map((clsName) => (
              <button
                key={clsName}
                onClick={() => setSelectedClassFilter(clsName)}
                className={`px-3 py-1 text-xs font-black uppercase transition-all border-2 border-[#111111] ${
                  selectedClassFilter === clsName
                    ? 'bg-[#4D6BFE] text-white shadow-[2px_2px_0px_#111111]'
                    : 'bg-white text-[#111111] hover:bg-[#FDF6E9]'
                }`}
              >
                {clsName === 'Tất cả' ? 'Tất Cả Lớp' : `Lớp ${clsName}`}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-black text-neutral-800">
          Hiển thị: <strong className="text-[#4D6BFE]">{filteredList.length}</strong> học sinh
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 custom-scroll px-6 pb-6">
        <table className="w-full text-left border-collapse border-2 border-[#111111]">
          <thead>
            <tr className="text-xs uppercase tracking-wider font-black text-[#111111] bg-[#FDF6E9] border-b-2 border-[#111111]">
              <th className="p-3.5 w-40 border-r-2 border-[#111111]">Tài Khoản (SBD)</th>
              <th className="p-3.5 border-r-2 border-[#111111]">Họ Và Tên Học Sinh</th>
              <th className="p-3.5 w-36 border-r-2 border-[#111111]">Mật Khẩu</th>
              <th className="p-3.5 w-44 border-r-2 border-[#111111]">Phân Lớp Học Sinh</th>
              <th className="p-3.5 w-16 text-center">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-neutral-200">
            {filteredList.map((s, idx) => {
              // Find real index in total list
              const realIndex = studentList.findIndex((item) => item === s);

              return (
                <tr key={realIndex >= 0 ? realIndex : idx} className="hover:bg-[#FDF6E9] transition-colors">
                  <td className="p-2 border-r-2 border-neutral-200">
                    <input
                      type="text"
                      value={s.username}
                      onChange={(e) => handleUpdateRow(realIndex, 'username', e.target.value)}
                      className="w-full bg-white border-2 border-[#111111] p-2 font-black text-xs text-[#111111] outline-none focus:bg-[#FDF6E9]"
                      placeholder="Mã định danh (SBD)"
                    />
                  </td>
                  <td className="p-2 border-r-2 border-neutral-200">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => handleUpdateRow(realIndex, 'name', e.target.value)}
                      className="w-full bg-white border-2 border-[#111111] p-2 font-black text-xs text-[#111111] outline-none focus:bg-[#FDF6E9]"
                      placeholder="Họ tên đầy đủ (VD: Nam Thiên)"
                    />
                  </td>
                  <td className="p-2 border-r-2 border-neutral-200">
                    <input
                      type="text"
                      value={s.password}
                      onChange={(e) => handleUpdateRow(realIndex, 'password', e.target.value)}
                      className="w-full bg-white border-2 border-[#111111] p-2 text-xs text-[#111111] font-mono font-bold outline-none focus:bg-[#FDF6E9]"
                      placeholder="Mật khẩu (VD: namthien)"
                    />
                  </td>
                  <td className="p-2 border-r-2 border-neutral-200">
                    <input
                      type="text"
                      value={s.group}
                      onChange={(e) => handleUpdateRow(realIndex, 'group', e.target.value)}
                      className="w-full bg-white border-2 border-[#111111] p-2 font-black text-xs text-[#4D6BFE] uppercase outline-none focus:bg-[#FDF6E9]"
                      placeholder="VD: 12A1"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleRemoveRow(realIndex)}
                      className="p-2 bg-white text-[#E63946] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] hover:bg-[#E63946] hover:text-white transition-all active:translate-x-[1px] active:translate-y-[1px]"
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
                <td colSpan={5} className="p-12 text-center text-neutral-600 font-bold text-xs">
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
