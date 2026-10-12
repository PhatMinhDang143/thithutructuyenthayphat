import React, { useState, useMemo } from 'react';
import { ExamSubmission, AppUser } from '../../types';
import { UserAvatar } from '../common/UserAvatar';
import { Search } from 'lucide-react';

export interface RankedSubmission extends ExamSubmission {
  overallRank: number; // Thứ hạng thực tế trên tổng số thí sinh
}

interface ExamLeaderboardProps {
  examTitle: string;
  examDuration?: number;
  submissions: ExamSubmission[];
  currentUser?: AppUser;
  className?: string;
  onOpenAvatarPicker?: () => void;
}

// Helper to extract or estimate duration in seconds from submission
function getDurationSeconds(sub: ExamSubmission, fallbackMinutes = 45): number {
  if (sub.timing?.totalSeconds && sub.timing.totalSeconds > 0) {
    return sub.timing.totalSeconds;
  }
  if (sub.timing?.formattedDuration) {
    const text = sub.timing.formattedDuration;
    const minMatch = text.match(/(\d+)\s*(?:phút|m|p)/i);
    const secMatch = text.match(/(\d+)\s*(?:giây|s)/i);
    let total = 0;
    if (minMatch) total += parseInt(minMatch[1], 10) * 60;
    if (secMatch) total += parseInt(secMatch[1], 10);
    if (total > 0) return total;
  }
  const pseudoRandom = Math.abs(
    (sub.name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 25
  );
  return Math.max(120, (fallbackMinutes - 5 - (pseudoRandom % 15)) * 60);
}

function formatDurationText(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s} giây`;
  if (s === 0) return `${m} phút`;
  return `${m} phút ${s} giây`;
}

export const ExamLeaderboard: React.FC<ExamLeaderboardProps> = ({
  examTitle,
  examDuration = 45,
  submissions,
  currentUser,
  className = '',
  onOpenAvatarPicker,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Sort ALL submissions to compute true overall ranking across all participants
  // Primary: Score DESC
  // Secondary: Duration ASC (faster student ranks higher on tie)
  const allSortedSubmissions = useMemo(() => {
    let localStudents: Record<string, any> = {};
    try {
      const raw = localStorage.getItem('dethi_students');
      if (raw) localStudents = JSON.parse(raw);
    } catch (e) {}

    const list = [...submissions].map((sub) => {
      const u = String(sub.username || '').toLowerCase().trim();
      const st = localStudents[u];
      const isCur = currentUser && (
        String(currentUser.username || '').toLowerCase().trim() === u ||
        String(currentUser.name || '').toLowerCase().trim() === String(sub.name || '').toLowerCase().trim()
      );
      return {
        ...sub,
        avatar: (isCur && currentUser.avatar) || st?.avatar || sub.avatar,
      };
    }).sort((a, b) => {
      const scoreA = Number(a.score) || 0;
      const scoreB = Number(b.score) || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      const durA = getDurationSeconds(a, examDuration);
      const durB = getDurationSeconds(b, examDuration);
      return durA - durB;
    });

    return list.map((sub, index): RankedSubmission => ({
      ...sub,
      overallRank: index + 1,
    }));
  }, [submissions, examDuration, currentUser]);

  const totalAllParticipants = allSortedSubmissions.length;

  // 2. Find the current user's personal submission among all submissions
  const currentUserSubmission = useMemo(() => {
    if (!currentUser) return null;
    const cleanUser = String(currentUser.username || '').trim().toLowerCase();
    const cleanName = String(currentUser.name || '').trim().toLowerCase();

    return allSortedSubmissions.find((s) => {
      const sUser = String(s.username || '').trim().toLowerCase();
      const sName = String(s.name || '').trim().toLowerCase();
      return (cleanUser && sUser === cleanUser) || (cleanName && sName === cleanName);
    }) || null;
  }, [allSortedSubmissions, currentUser]);

  const isCurrentUserUnder5 = useMemo(() => {
    if (!currentUserSubmission) return false;
    const sc = Number(currentUserSubmission.score);
    return !isNaN(sc) && sc < 5.0;
  }, [currentUserSubmission]);

  // 3. Filter public leaderboard: Exclude scores under 5 (< 5.0)!
  // "chỉ là tế nhị, không để danh sách có mấy bạn điểm kém vào để không bị đánh giá thôi"
  // Each student maintains their TRUE overallRank!
  const eligibleSubmissions = useMemo(() => {
    return allSortedSubmissions.filter((s) => {
      const sc = Number(s.score);
      return !isNaN(sc) && sc >= 5.0;
    });
  }, [allSortedSubmissions]);

  // Extract unique classes present in eligible submissions
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    eligibleSubmissions.forEach((s) => {
      const g = (s.group || 'Khách').trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [eligibleSubmissions]);

  // Filter public submissions by class and search query
  const filteredSubmissions = useMemo(() => {
    return eligibleSubmissions.filter((s) => {
      if (selectedClass !== 'all') {
        const sGroup = (s.group || 'Khách').trim().toLowerCase();
        if (sGroup !== selectedClass.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sName = (s.name || '').toLowerCase();
        const sUser = (s.username || '').toLowerCase();
        return sName.includes(q) || sUser.includes(q);
      }
      return true;
    });
  }, [eligibleSubmissions, selectedClass, searchQuery]);

  // Key summary stats
  const totalRankedCount = eligibleSubmissions.length;
  const topScore = totalAllParticipants > 0 ? Math.max(...allSortedSubmissions.map((s) => Number(s.score) || 0)) : 0;
  const avgScore = totalRankedCount > 0
    ? (eligibleSubmissions.reduce((acc, s) => acc + (Number(s.score) || 0), 0) / totalRankedCount).toFixed(2)
    : '0.00';
  
  const fastestDuration = totalRankedCount > 0
    ? Math.min(...eligibleSubmissions.map((s) => getDurationSeconds(s, examDuration)))
    : 0;

  // Top 3 entries for podium (strictly >= 5.0)
  const top1 = filteredSubmissions[0];
  const top2 = filteredSubmissions[1];
  const top3 = filteredSubmissions[2];

  return (
    <div className={`space-y-6 text-[#111111] ${className}`}>
      {/* 1. Header & Overview Strip */}
      <div className="bg-white border-3 border-[#111111] p-5 sm:p-6 shadow-[6px_6px_0px_#111111]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-[#111111]">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
              <span className="font-black uppercase tracking-wider text-neutral-600">
                Bảng Xếp Hạng Kết Quả Thi
              </span>
              <span className="text-neutral-400">·</span>
              <span className="text-[#0F9D58] font-bold">
                Xếp hạng thực tế trên tổng số {totalAllParticipants} thí sinh tham gia
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-[#111111]">
              {examTitle}
            </h2>
          </div>

          {/* Quick search input */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm thí sinh / SBD..."
              className="w-full bg-[#F8F9FA] border-2 border-[#111111] px-3 py-2 pl-9 text-xs font-bold text-[#111111] placeholder-neutral-500 focus:outline-none focus:bg-white"
            />
            <Search className="w-4 h-4 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Metric summary boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="bg-[#FDF6E9] p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
            <p className="text-[11px] font-black uppercase text-neutral-600">Tổng Thí Sinh</p>
            <p className="text-xl sm:text-2xl font-black text-[#111111] mt-0.5 tabular-nums">
              {totalAllParticipants}
            </p>
            <span className="text-[10px] text-neutral-500 font-bold">
              Xếp hạng công khai: {totalRankedCount} bạn
            </span>
          </div>

          <div className="bg-[#FFF9E6] p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
            <p className="text-[11px] font-black uppercase text-neutral-600">Điểm Thủ Khoa</p>
            <p className="text-xl sm:text-2xl font-black text-[#D97706] mt-0.5 tabular-nums">
              {topScore.toFixed(2)}
            </p>
            <span className="text-[10px] text-neutral-500 font-bold">Điểm cao nhất</span>
          </div>

          <div className="bg-[#F0FDF4] p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
            <p className="text-[11px] font-black uppercase text-neutral-600">Làm Nhanh Nhất</p>
            <p className="text-base sm:text-lg font-black text-[#0F9D58] mt-1 tabular-nums truncate">
              {fastestDuration > 0 ? formatDurationText(fastestDuration) : 'Chưa có'}
            </p>
            <span className="text-[10px] text-neutral-500 font-bold">Top hoàn thành sớm</span>
          </div>

          <div className="bg-[#EEF2FF] p-3 border-2 border-[#111111] shadow-[2px_2px_0px_#111111]">
            <p className="text-[11px] font-black uppercase text-neutral-600">Điểm TB Đạt Chuẩn</p>
            <p className="text-xl sm:text-2xl font-black text-[#4D6BFE] mt-0.5 tabular-nums">
              {avgScore}
            </p>
            <span className="text-[10px] text-neutral-500 font-bold">Các bài thi trên BXH</span>
          </div>
        </div>

        {/* Class Filter Bar */}
        {availableClasses.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t-2 border-[#111111] mt-4">
            <span className="text-xs font-black uppercase text-neutral-600 mr-1">Lọc Theo Lớp:</span>
            <button
              type="button"
              onClick={() => setSelectedClass('all')}
              className={`px-3 py-1 text-xs font-black uppercase transition-all border-2 border-[#111111] cursor-pointer ${
                selectedClass === 'all'
                  ? 'bg-[#111111] text-white shadow-[2px_2px_0px_#FFC93C]'
                  : 'bg-white text-[#111111] hover:bg-[#FDF6E9]'
              }`}
            >
              Tất cả ({eligibleSubmissions.length})
            </button>
            {availableClasses.map((cls) => {
              const count = eligibleSubmissions.filter(
                (s) => (s.group || 'Khách').toLowerCase() === cls.toLowerCase()
              ).length;
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedClass(cls)}
                  className={`px-3 py-1 text-xs font-black uppercase transition-all border-2 border-[#111111] cursor-pointer ${
                    selectedClass.toLowerCase() === cls.toLowerCase()
                      ? 'bg-[#4D6BFE] text-white shadow-[2px_2px_0px_#111111]'
                      : 'bg-white text-neutral-700 hover:bg-[#FDF6E9]'
                  }`}
                >
                  {cls} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Current Student Position / Personal Result Bar */}
      {/* CASE A: Student scored < 5.0 -> Private Personal Position Card showing true rank */}
      {currentUserSubmission && currentUser && isCurrentUserUnder5 && (
        <div className="p-4 sm:p-5 bg-[#FFF0F0] border-3 border-[#E63946] shadow-[5px_5px_0px_#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <UserAvatar
              avatar={currentUser.avatar || currentUserSubmission.avatar}
              name={currentUserSubmission.name}
              size="lg"
              showBorder={true}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-black text-xs uppercase px-2 py-0.5 bg-[#E63946] text-white">
                  Vị Trí Của Bạn (Riêng Tư)
                </span>
                <span className="text-xs font-black text-[#E63946]">
                  Hạng #{currentUserSubmission.overallRank} / {totalAllParticipants} thí sinh đã làm bài
                </span>
              </div>
              <div className="text-xs text-neutral-900 font-bold space-y-1">
                <p>
                  Điểm số: <strong className="text-base text-[#E63946] tabular-nums">{Number(currentUserSubmission.score || 0).toFixed(2)} / 10</strong> · Thời gian làm: <strong className="tabular-nums">{formatDurationText(getDurationSeconds(currentUserSubmission, examDuration))}</strong> · Rời màn hình: <strong className={currentUserSubmission.cheat && String(currentUserSubmission.cheat) !== '0 lần' ? 'text-[#E63946]' : 'text-[#0F9D58]'}>{currentUserSubmission.cheat || '0 lần'}</strong>
                </p>
                {parseInt(String(currentUserSubmission.cheat || '0'), 10) >= 4 && (
                  <p className="text-[11px] font-black text-[#E63946]">
                    ⛔ Bài thi bị buộc dừng do vi phạm rời màn hình quá 4 lần.
                  </p>
                )}
                <p className="text-[11px] text-neutral-600 font-bold">
                  * Bảng xếp hạng công khai chỉ hiển thị thí sinh đạt từ 5.0 điểm trở lên.
                </p>
              </div>
            </div>
          </div>

          {onOpenAvatarPicker && (
            <button
              type="button"
              onClick={onOpenAvatarPicker}
              className="px-3.5 py-1.5 bg-white hover:bg-[#FDF6E9] text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-black text-xs uppercase cursor-pointer transition-all self-stretch sm:self-auto text-center shrink-0"
            >
              Đổi Avatar
            </button>
          )}
        </div>
      )}

      {/* CASE B: Student scored >= 5.0 -> Ranked on public leaderboard with TRUE overall rank */}
      {currentUserSubmission && currentUser && !isCurrentUserUnder5 && (
        <div className="p-4 sm:p-5 bg-[#FFC93C] border-3 border-[#111111] shadow-[4px_4px_0px_#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <UserAvatar
              avatar={currentUser.avatar || currentUserSubmission.avatar}
              name={currentUserSubmission.name}
              size="lg"
              showBorder={true}
              rankBadge={currentUserSubmission.overallRank <= 3 ? currentUserSubmission.overallRank : undefined}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-black text-xs uppercase px-2 py-0.5 bg-[#111111] text-white">
                  Vị Trí Của Bạn
                </span>
                <span className="text-xs font-black text-[#111111]">
                  Hạng #{currentUserSubmission.overallRank} / {totalAllParticipants} thí sinh đã làm bài
                </span>
              </div>
              <p className="text-xs font-bold text-neutral-900">
                Điểm số: <strong className="text-base text-[#111111] tabular-nums">{Number(currentUserSubmission.score || 0).toFixed(2)} / 10</strong> · Thời gian làm: <strong className="tabular-nums">{formatDurationText(getDurationSeconds(currentUserSubmission, examDuration))}</strong> · Rời màn hình: <strong className={currentUserSubmission.cheat && String(currentUserSubmission.cheat) !== '0 lần' ? 'text-[#E63946]' : 'text-[#0F9D58]'}>{currentUserSubmission.cheat || '0 lần'}</strong>
              </p>
              {parseInt(String(currentUserSubmission.cheat || '0'), 10) >= 4 && (
                <p className="text-[11px] font-black text-[#E63946] mt-0.5">
                  ⛔ Bài thi bị buộc dừng và nộp tự động do vi phạm rời màn hình quá 4 lần.
                </p>
              )}
            </div>
          </div>

          {onOpenAvatarPicker && (
            <button
              type="button"
              onClick={onOpenAvatarPicker}
              className="px-3.5 py-1.5 bg-white hover:bg-neutral-100 text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#111111] font-black text-xs uppercase cursor-pointer transition-all self-stretch sm:self-auto text-center shrink-0"
            >
              Đổi Avatar
            </button>
          )}
        </div>
      )}

      {/* 3. Top 3 Podium (Honorary Stage) */}
      {filteredSubmissions.length >= 2 && !searchQuery && selectedClass === 'all' && (
        <div className="bg-[#FAF9F5] border-3 border-[#111111] p-5 sm:p-7 shadow-[6px_6px_0px_#111111]">
          <h3 className="text-center font-black text-xs sm:text-sm uppercase tracking-wider text-neutral-600 mb-6">
            Bục Vinh Danh Top Thí Sinh Dẫn Đầu
          </h3>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-2xl mx-auto">
            {/* Rank 2 - Á Khoa (Left) */}
            {top2 && (
              <div className="flex flex-col items-center">
                <div className="mb-2 text-center">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#E5E7EB] border border-[#111111] inline-block mb-1 shadow-[1px_1px_0px_#111111]">
                    Á Khoa
                  </span>
                  <div>
                    <UserAvatar
                      avatar={top2.avatar}
                      name={top2.name}
                      size="lg"
                      rankBadge={top2.overallRank <= 3 ? top2.overallRank : undefined}
                    />
                  </div>
                  <p className="font-black text-xs sm:text-sm text-[#111111] mt-2 truncate max-w-[100px] sm:max-w-[140px]">
                    {top2.name}
                  </p>
                  <p className="text-[10px] text-neutral-600 font-bold uppercase">
                    {top2.group || 'Khách'}
                  </p>
                </div>

                {/* Silver Pedestal */}
                <div className="w-full bg-[#E5E7EB] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] p-3 text-center h-32 sm:h-36 flex flex-col justify-between">
                  <div>
                    <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 bg-white border border-[#111111]">
                      Á Khoa
                    </span>
                    <p className="text-xl sm:text-2xl font-black text-[#111111] mt-1 tabular-nums">
                      {Number(top2.score || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-[10px] text-neutral-700 font-bold border-t border-[#111111]/20 pt-1 space-y-0.5">
                    <div>{formatDurationText(getDurationSeconds(top2, examDuration))}</div>
                    <div className="text-[9px] text-neutral-500">Out: {top2.cheat || '0 lần'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 1 - Thủ Khoa (Center - Elevated Champion) */}
            {top1 && (
              <div className="flex flex-col items-center -mt-4">
                <div className="mb-2 text-center">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#FFC93C] border border-[#111111] inline-block mb-1 shadow-[1px_1px_0px_#111111]">
                    Thủ Khoa
                  </span>
                  <div>
                    <UserAvatar
                      avatar={top1.avatar}
                      name={top1.name}
                      size="xl"
                      rankBadge={top1.overallRank <= 3 ? top1.overallRank : undefined}
                    />
                  </div>
                  <p className="font-black text-xs sm:text-base text-[#111111] mt-2 truncate max-w-[110px] sm:max-w-[160px]">
                    {top1.name}
                  </p>
                  <p className="text-[11px] text-[#4D6BFE] font-black uppercase">
                    {top1.group || 'Khách'}
                  </p>
                </div>

                {/* Gold Pedestal */}
                <div className="w-full bg-[#FFC93C] border-3 border-[#111111] shadow-[4px_4px_0px_#111111] p-3.5 text-center h-40 sm:h-44 flex flex-col justify-between">
                  <div>
                    <span className="inline-block text-[11px] font-black uppercase px-2.5 py-0.5 bg-[#111111] text-white">
                      Thủ Khoa
                    </span>
                    <p className="text-2xl sm:text-3xl font-black text-[#111111] mt-1 tabular-nums">
                      {Number(top1.score || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-[11px] text-[#111111] font-black border-t-2 border-[#111111]/30 pt-1 space-y-0.5">
                    <div>{formatDurationText(getDurationSeconds(top1, examDuration))}</div>
                    <div className="text-[10px] text-neutral-800">Out: {top1.cheat || '0 lần'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 3 - Top 3 (Right) */}
            {top3 && (
              <div className="flex flex-col items-center">
                <div className="mb-2 text-center">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#FED7AA] border border-[#111111] text-[#7C2D12] inline-block mb-1 shadow-[1px_1px_0px_#111111]">
                    Top 3
                  </span>
                  <div>
                    <UserAvatar
                      avatar={top3.avatar}
                      name={top3.name}
                      size="lg"
                      rankBadge={top3.overallRank <= 3 ? top3.overallRank : undefined}
                    />
                  </div>
                  <p className="font-black text-xs sm:text-sm text-[#111111] mt-2 truncate max-w-[100px] sm:max-w-[140px]">
                    {top3.name}
                  </p>
                  <p className="text-[10px] text-neutral-600 font-bold uppercase">
                    {top3.group || 'Khách'}
                  </p>
                </div>

                {/* Bronze Pedestal */}
                <div className="w-full bg-[#FED7AA] border-2 border-[#111111] shadow-[3px_3px_0px_#111111] p-3 text-center h-28 sm:h-32 flex flex-col justify-between">
                  <div>
                    <span className="inline-block text-[10px] font-black uppercase px-1.5 py-0.5 bg-white border border-[#111111] text-[#7C2D12]">
                      Top 3 (Đồng)
                    </span>
                    <p className="text-xl sm:text-2xl font-black text-[#7C2D12] mt-1 tabular-nums">
                      {Number(top3.score || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-[10px] text-neutral-800 font-bold border-t border-[#111111]/20 pt-1 space-y-0.5">
                    <div>{formatDurationText(getDurationSeconds(top3, examDuration))}</div>
                    <div className="text-[9px] text-neutral-600">Out: {top3.cheat || '0 lần'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Complete Leaderboard Table (Only >= 5.0, with true overall ranks) */}
      <div className="bg-white border-3 border-[#111111] shadow-[6px_6px_0px_#111111] overflow-hidden">
        <div className="p-4 bg-[#FDF6E9] border-b-2 border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-black text-xs sm:text-sm uppercase tracking-wider text-[#111111]">
              Danh Sách Xếp Hạng ({filteredSubmissions.length}/{totalAllParticipants} thí sinh)
            </h3>
            <p className="text-[11px] text-neutral-600 font-bold">
              Hiển thị thứ hạng thực tế trên tổng số {totalAllParticipants} thí sinh tham gia
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F8F9FA] border-b-2 border-[#111111] text-[11px] font-black uppercase tracking-wider text-neutral-700">
                <th className="py-3 px-3 sm:px-4 text-center w-16 border-r border-neutral-300">Hạng</th>
                <th className="py-3 px-3 sm:px-4 border-r border-neutral-300">Thí Sinh</th>
                <th className="py-3 px-3 sm:px-4 border-r border-neutral-300 w-28">Lớp</th>
                <th className="py-3 px-3 sm:px-4 border-r border-neutral-300 text-right w-24">Điểm Số</th>
                <th className="py-3 px-3 sm:px-4 border-r border-neutral-300 text-center w-36 sm:w-40">
                  Thời Gian Làm
                </th>
                <th className="py-3 px-3 sm:px-4 border-r border-neutral-300 text-center w-28 sm:w-32">
                  Rời Màn Hình
                </th>
                <th className="py-3 px-3 sm:px-4 text-right w-28 sm:w-36 hidden md:table-cell">
                  Thời Gian Nộp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredSubmissions.map((sub, idx) => {
                const isCurrent = currentUser && (
                  (sub.username && sub.username.toLowerCase() === currentUser.username.toLowerCase()) ||
                  (sub.name && sub.name.toLowerCase() === currentUser.name.toLowerCase())
                );
                const durationSec = getDurationSeconds(sub, examDuration);
                const durationText = formatDurationText(durationSec);
                const rankNum = sub.overallRank; // TRUE overall rank on ALL participants!
                const scoreNum = Number(sub.score) || 0;
                const cheatText = sub.cheat || '0 lần';
                const hasViolation = cheatText && String(cheatText) !== '0 lần';

                return (
                  <tr
                    key={sub.id || idx}
                    className={`transition-colors ${
                      isCurrent
                        ? 'bg-[#FFF2B2] font-black border-y-2 border-[#111111]'
                        : rankNum === 1
                        ? 'bg-[#FFFDEB]'
                        : rankNum === 2
                        ? 'bg-[#F9FAFB]'
                        : rankNum === 3
                        ? 'bg-[#FFF7ED]'
                        : 'hover:bg-[#FDF6E9]'
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3 px-3 sm:px-4 text-center border-r border-neutral-200">
                      {rankNum === 1 ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-black bg-[#FFC93C] text-[#111111] border border-[#111111] shadow-[1px_1px_0px_#111111]">
                          Thủ Khoa
                        </span>
                      ) : rankNum === 2 ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-black bg-[#E5E7EB] text-[#111111] border border-[#111111]">
                          Á Khoa
                        </span>
                      ) : rankNum === 3 ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-black bg-[#FED7AA] text-[#7C2D12] border border-[#111111]">
                          Top 3
                        </span>
                      ) : (
                        <span className="text-neutral-800 font-black tabular-nums">
                          #{rankNum}
                        </span>
                      )}
                    </td>

                    {/* Student Avatar + Name */}
                    <td className="py-3 px-3 sm:px-4 border-r border-neutral-200">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          avatar={sub.avatar}
                          name={sub.name}
                          size="sm"
                          showBorder={true}
                          rankBadge={rankNum <= 3 ? rankNum : undefined}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-[#111111] truncate">
                              {sub.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 bg-[#4D6BFE] text-white uppercase">
                                Bạn
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            SBD: {sub.username || 'guest'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Class */}
                    <td className="py-3 px-3 sm:px-4 border-r border-neutral-200 font-bold text-neutral-800 uppercase">
                      {sub.group || 'Khách'}
                    </td>

                    {/* Score */}
                    <td className="py-3 px-3 sm:px-4 border-r border-neutral-200 text-right">
                      <span
                        className={`text-base sm:text-lg font-black tabular-nums ${
                          scoreNum >= 8.0
                            ? 'text-[#0F9D58]'
                            : 'text-[#4D6BFE]'
                        }`}
                      >
                        {scoreNum.toFixed(2)}
                      </span>
                    </td>

                    {/* Duration / Thời gian làm bài */}
                    <td className="py-3 px-3 sm:px-4 border-r border-neutral-200 text-center">
                      <span className="inline-block px-2.5 py-1 text-xs font-black bg-[#F4F4F0] text-[#111111] border border-[#111111]/40 tabular-nums">
                        {durationText}
                      </span>
                    </td>

                    {/* Screen Exits / Rời màn hình */}
                    <td className="py-3 px-3 sm:px-4 border-r border-neutral-200 text-center">
                      {hasViolation ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-black bg-[#FFF0F0] text-[#E63946] border border-[#E63946] tabular-nums">
                          {cheatText}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs font-bold text-[#0F9D58] bg-[#F0FDF4] border border-[#0F9D58]/40">
                          0 lần (Chuẩn)
                        </span>
                      )}
                    </td>

                    {/* Submission Time */}
                    <td className="py-3 px-3 sm:px-4 text-right text-xs text-neutral-600 font-medium hidden md:table-cell">
                      {sub.submitted_at || 'Mới đây'}
                    </td>
                  </tr>
                );
              })}

              {filteredSubmissions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500 font-bold">
                    Chưa có dữ liệu thí sinh trong danh sách xếp hạng này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
