'use client';

import { useState, useEffect } from 'react';
import { updateMyProfile } from '@/services/api';
import WalkSummaryModal from '@/components/WalkSummaryModal';
import type { WalkSummaryData } from '@/components/WalkSummaryModal';

interface WalkRecord extends WalkSummaryData {
  date: string;
  savedAt: number;
}

interface PointRecord {
  timestamp: number;
  type: 'marking' | 'mission' | 'occupy';
  points: number;
  label: string;
}

function loadWalkLogs(): WalkRecord[] {
  try {
    const saved = localStorage.getItem('walkLogs');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function loadPointHistory(): PointRecord[] {
  try {
    const saved = localStorage.getItem('pointHistory');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function WalkCalendarModal({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [logs, setLogs] = useState<WalkRecord[]>([]);
  const [selectedLog, setSelectedLog] = useState<WalkRecord | null>(null);

  useEffect(() => { setLogs(loadWalkLogs()); }, []);

  const logsByDate = logs.reduce<Record<string, WalkRecord[]>>((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {});

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const formatKey = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const getDaySummary = (d: number) => {
    const dayLogs = logsByDate[formatKey(d)];
    if (!dayLogs || dayLogs.length === 0) return null;
    return {
      totalSeconds: dayLogs.reduce((s, l) => s + l.seconds, 0),
      totalDistance: dayLogs.reduce((s, l) => s + l.distance, 0),
      merged: {
        date: formatKey(d),
        savedAt: dayLogs[dayLogs.length - 1].savedAt,
        seconds: dayLogs.reduce((s, l) => s + l.seconds, 0),
        distance: dayLogs.reduce((s, l) => s + l.distance, 0),
        scoreGained: dayLogs.reduce((s, l) => s + l.scoreGained, 0),
        tilesGained: dayLogs.reduce((s, l) => s + l.tilesGained, 0),
        pathCoords: dayLogs.flatMap(l => l.pathCoords),
      } as WalkRecord,
    };
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  if (selectedLog) {
    return (
      <WalkSummaryModal
        summary={selectedLog}
        onClose={() => setSelectedLog(null)}
        isPast
        dateLabel={selectedLog.date}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="text-base font-bold text-gray-900">산책일지</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm">✕</button>
        </div>

        <div className="flex items-center justify-between px-5 pb-3">
          <button onClick={prevMonth} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 text-sm">◀</button>
          <span className="text-sm font-bold text-gray-800">{year}년 {month + 1}월</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 text-sm">▶</button>
        </div>

        <div className="grid grid-cols-7 px-3 pb-1">
          {WEEK_DAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 px-3 pb-5 gap-y-0.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={`e-${i}`} />;
            const summary = getDaySummary(d);
            const hasWalk = !!summary;
            return (
              <button
                key={d}
                onClick={() => { if (summary) setSelectedLog(summary.merged); }}
                disabled={!hasWalk}
                className={`flex flex-col items-center py-1 rounded-xl transition-colors ${hasWalk ? 'hover:bg-orange-50' : ''}`}
              >
                <span className={`text-xs font-semibold ${hasWalk ? 'text-orange-500' : 'text-gray-700'}`}>{d}</span>
                {hasWalk && (
                  <>
                    <span className="text-[9px] text-gray-400 leading-tight">
                      {summary.totalDistance >= 1
                        ? `${summary.totalDistance.toFixed(1)}km`
                        : `${Math.round(summary.totalDistance * 1000)}m`}
                    </span>
                    <span className="text-[9px] text-gray-400 leading-tight">
                      {Math.floor(summary.totalSeconds / 60)}분
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PointHistoryModal({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState<PointRecord[]>([]);

  useEffect(() => {
    setHistory(loadPointHistory().sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  const total = history.reduce((s, h) => s + h.points, 0);

  const TYPE_ICON: Record<PointRecord['type'], string> = {
    marking: '🐾',
    mission: '⭐',
    occupy: '🏆',
  };

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <p className="text-base font-bold text-gray-900">포인트</p>
            <p className="text-2xl font-black text-orange-500 mt-0.5">{total.toLocaleString()}P</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm">✕</button>
        </div>

        <div className="border-t border-gray-100 mx-5" />

        <div className="overflow-y-auto flex-1 px-5 py-3 [&::-webkit-scrollbar]:hidden">
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">아직 적립된 포인트가 없어요</p>
          ) : (
            <div className="space-y-0.5">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{TYPE_ICON[h.type]}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{h.label}</p>
                      <p className="text-[11px] text-gray-400">{fmt(h.timestamp)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-orange-500">+{h.points.toLocaleString()}P</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PetData {
  name: string;
  breed: string;
  age: string;
  gender: 'male' | 'female';
  neutered: boolean;
  personality: string;
  weight: number;
  photoUrl?: string;
}

const DEFAULT_PET: PetData = {
  name: '우리 강아지',
  breed: '믹스견',
  age: '1살',
  gender: 'male',
  neutered: false,
  personality: '활발해요',
  weight: 5,
};

function todayLabel(): string {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;
}

function loadPets(): PetData[] {
  try {
    const saved = localStorage.getItem('petProfiles');
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
    // 구버전 단일 프로필 마이그레이션
    const legacy = localStorage.getItem('petProfile');
    if (legacy) return [{ ...DEFAULT_PET, ...JSON.parse(legacy) }];
  } catch {}
  return [{ ...DEFAULT_PET }];
}

function loadActivePetIdx(): number {
  try {
    const saved = localStorage.getItem('activePetIdx');
    return saved ? Number(saved) : 0;
  } catch { return 0; }
}

interface PetProfileProps {
  walkSeconds: number;
  walkDistance: number;
  isWalking: boolean;
  idToken?: string | null;
  activePetIdx?: number;
  reloadTrigger?: number;
  addingPet?: boolean;
  onAddPetDone?: (pets: PetData[], newIdx: number) => void;
  onAddPetCancel?: () => void;
  onPetsChange?: (pets: PetData[], activePetIdx: number) => void;
}

export default function PetProfile({
  walkSeconds, walkDistance, isWalking, idToken,
  activePetIdx: externalActivePetIdx,
  reloadTrigger,
  addingPet,
  onAddPetDone,
  onAddPetCancel,
  onPetsChange,
}: PetProfileProps) {
  const [pets, setPets] = useState<PetData[]>([DEFAULT_PET]);
  const [activePetIdx, setActivePetIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PetData>(DEFAULT_PET);
  const [addDraft, setAddDraft] = useState<PetData>(DEFAULT_PET);
  const [today, setToday] = useState('');
  const [showWalkLog, setShowWalkLog] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    setTotalPoints(loadPointHistory().reduce((s, h) => s + h.points, 0));
  }, []);

  useEffect(() => {
    setToday(todayLabel());
    const id = setInterval(() => setToday(todayLabel()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loadedPets = loadPets();
    const loadedIdx = loadActivePetIdx();
    const safeIdx = Math.min(loadedIdx, loadedPets.length - 1);
    setPets(loadedPets);
    setActivePetIdx(safeIdx);
    setDraft(loadedPets[safeIdx] ?? DEFAULT_PET);
  }, []);

  // 외부 추가(드롭다운 +) 시 localStorage 재로드
  useEffect(() => {
    if (reloadTrigger === undefined || reloadTrigger === 0) return;
    const loadedPets = loadPets();
    const loadedIdx = loadActivePetIdx();
    const safeIdx = Math.min(loadedIdx, loadedPets.length - 1);
    setPets(loadedPets);
    setActivePetIdx(safeIdx);
    setDraft(loadedPets[safeIdx] ?? DEFAULT_PET);
  }, [reloadTrigger]);

  // 외부에서 activePetIdx 변경 시 동기화
  useEffect(() => {
    if (externalActivePetIdx === undefined) return;
    const safeIdx = Math.min(externalActivePetIdx, pets.length - 1);
    setActivePetIdx(safeIdx);
    setDraft(pets[safeIdx] ?? DEFAULT_PET);
  }, [externalActivePetIdx, pets]);

  const pet = pets[activePetIdx] ?? DEFAULT_PET;

  const savePets = (newPets: PetData[], newIdx: number) => {
    localStorage.setItem('petProfiles', JSON.stringify(newPets));
    localStorage.setItem('activePetIdx', String(newIdx));
    onPetsChange?.(newPets, newIdx);
  };

  const handleSave = () => {
    const newPets = pets.map((p, i) => (i === activePetIdx ? draft : p));
    setPets(newPets);
    savePets(newPets, activePetIdx);
    setEditing(false);
    if (idToken) {
      updateMyProfile({
        dogBreed: draft.breed,
        dogAge: draft.age,
        dogPersonality: draft.personality,
        photoUrl: draft.photoUrl,
      }, idToken).catch((e) => console.error('[PetProfile] 프로필 동기화 실패:', e));
    }
  };

  // addingPet 진입 시 빈 폼 초기화
  useEffect(() => {
    if (addingPet) setAddDraft({ ...DEFAULT_PET, name: '' });
  }, [addingPet]);

  const handleAddSave = () => {
    const newPets = [...pets, addDraft];
    const newIdx = newPets.length - 1;
    setPets(newPets);
    savePets(newPets, newIdx);
    onAddPetDone?.(newPets, newIdx);
  };

  const handleAddPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAddDraft((prev) => ({ ...prev, photoUrl: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setDraft((prev) => ({ ...prev, photoUrl: url }));
    };
    reader.readAsDataURL(file);
  };

  if (addingPet) {
    return (
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 w-full h-full overflow-y-auto [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-800">강아지 정보 추가</span>
          <div className="flex gap-3">
            <button onClick={onAddPetCancel} className="text-xs text-gray-400 hover:text-gray-600">
              취소
            </button>
            <button onClick={handleAddSave} className="text-xs font-bold text-orange-500 hover:text-orange-600">
              추가
            </button>
          </div>
        </div>

        <label className="flex flex-col items-center mb-3 cursor-pointer">
          <div className="w-16 h-16 rounded-full bg-orange-50 border-2 border-orange-200 overflow-hidden flex items-center justify-center mb-1">
            {addDraft.photoUrl ? (
              <img src={addDraft.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🐶</span>
            )}
          </div>
          <span className="text-xs text-orange-500">사진 추가</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleAddPhotoChange} />
        </label>

        <div className="space-y-2">
          {(
            [
              { label: '이름', key: 'name' },
              { label: '견종', key: 'breed' },
              { label: '나이', key: 'age' },
              { label: '성격', key: 'personality' },
            ] as { label: string; key: keyof PetData }[]
          ).map(({ label, key }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-10 shrink-0">{label}</span>
              <input
                value={addDraft[key] as string}
                maxLength={key === 'name' ? 8 : undefined}
                onChange={(e) => setAddDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400"
              />
            </div>
          ))}

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10 shrink-0">체중</span>
            <input
              type="number" min={0.1} step={0.1}
              value={addDraft.weight}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, weight: Number(e.target.value) }))}
              className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400"
            />
            <span className="text-xs text-gray-500">kg</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10 shrink-0">성별</span>
            {(['male', 'female'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setAddDraft((prev) => ({ ...prev, gender: g }))}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  addDraft.gender === g
                    ? g === 'male' ? 'bg-blue-500 text-white border-blue-500' : 'bg-pink-500 text-white border-pink-500'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                {g === 'male' ? '수컷' : '암컷'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10 shrink-0">중성화</span>
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => setAddDraft((prev) => ({ ...prev, neutered: v }))}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  addDraft.neutered === v ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500'
                }`}
              >
                {v ? '했어요' : '안했어요'}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 w-full h-full overflow-y-auto [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-800">강아지 정보 수정</span>
          <div className="flex gap-3">
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">
              취소
            </button>
            <button onClick={handleSave} className="text-xs font-bold text-orange-500 hover:text-orange-600">
              저장
            </button>
          </div>
        </div>

        {/* 사진 업로드 + 강아지 삭제 */}
        <div className="flex flex-col items-center mb-3">
          <div className="relative">
            <label className="flex flex-col items-center cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-orange-50 border-2 border-orange-200 overflow-hidden flex items-center justify-center mb-1">
                {draft.photoUrl ? (
                  <img src={draft.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🐶</span>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
            {/* 강아지 삭제 버튼 (1마리일 땐 숨김) */}
            {pets.length > 1 && (
              <button
                onClick={() => {
                  const newPets = pets.filter((_, idx) => idx !== activePetIdx);
                  const newIdx = Math.min(activePetIdx, newPets.length - 1);
                  setPets(newPets);
                  setActivePetIdx(newIdx);
                  setDraft(newPets[newIdx]);
                  savePets(newPets, newIdx);
                  setEditing(false);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-500 hover:bg-red-500 text-white flex items-center justify-center transition-colors z-10"
                style={{ fontSize: '10px', lineHeight: 1 }}
              >✕</button>
            )}
          </div>
          <span className="text-xs text-orange-500">사진 변경</span>
        </div>

        <div className="space-y-2">
          {(
            [
              { label: '이름', key: 'name' },
              { label: '견종', key: 'breed' },
              { label: '나이', key: 'age' },
              { label: '성격', key: 'personality' },
            ] as { label: string; key: keyof PetData }[]
          ).map(({ label, key }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-10 shrink-0">{label}</span>
              <input
                value={draft[key] as string}
                maxLength={key === 'name' ? 8 : undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400"
              />
            </div>
          ))}

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10 shrink-0">체중</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={draft.weight}
              onChange={(e) => setDraft((prev) => ({ ...prev, weight: Number(e.target.value) }))}
              className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400"
            />
            <span className="text-xs text-gray-500">kg</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10 shrink-0">성별</span>
            {(['male', 'female'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setDraft((prev) => ({ ...prev, gender: g }))}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  draft.gender === g
                    ? g === 'male'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-pink-500 text-white border-pink-500'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                {g === 'male' ? '수컷' : '암컷'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-10 shrink-0">중성화</span>
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => setDraft((prev) => ({ ...prev, neutered: v }))}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  draft.neutered === v
                    ? 'bg-green-500 text-white border-green-500'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                {v ? '했어요' : '안했어요'}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-5 py-4 w-full h-full flex flex-col">
      {/* 날짜 + 편집 버튼 */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs text-gray-400 font-medium">{today}</span>
        <button
          onClick={() => { setDraft(pet); setEditing(true); }}
          className="text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="편집"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      {/* 강아지 정보 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-3">
        <div className="w-24 h-24 rounded-full bg-orange-50 border-[3px] border-orange-200 overflow-hidden flex items-center justify-center shrink-0">
          {pet.photoUrl ? (
            <img src={pet.photoUrl} alt={pet.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">🐶</span>
          )}
        </div>

        <div className="text-center min-w-0 w-full">
          <p className="text-lg font-bold text-gray-900 truncate">{pet.name}</p>
          <p className="text-sm text-gray-500 mt-1">
            {pet.breed} · {pet.age}
          </p>
          <p className="text-sm mt-1">
            <span className={pet.gender === 'male' ? 'text-blue-500' : 'text-pink-500'}>
              {pet.gender === 'male' ? '♂ 수컷' : '♀ 암컷'}
            </span>
            <span className="text-gray-400 ml-1.5">
              · 중성화 {pet.neutered ? '했어요' : '안했어요'}
            </span>
          </p>
          {pet.personality && (
            <p className="text-sm text-gray-400 mt-1 truncate">"{pet.personality}"</p>
          )}
        </div>
      </div>

      {/* 하단 버튼: 산책일지 / 포인트 */}
      <div className="shrink-0 border-t border-gray-100 pt-3 grid grid-cols-2 gap-1 text-center">
        <button
          onClick={() => setShowWalkLog(true)}
          className="flex flex-col items-center py-2 rounded-xl hover:bg-gray-50 active:bg-orange-50 transition-colors"
        >
          <p className="text-xs text-gray-400 mb-1">산책일지</p>
          <p className="text-sm">📓</p>
        </button>
        <button
          onClick={() => {
            setTotalPoints(loadPointHistory().reduce((s, h) => s + h.points, 0));
            setShowPoints(true);
          }}
          className="flex flex-col items-center py-2 rounded-xl hover:bg-gray-50 active:bg-orange-50 transition-colors"
        >
          <p className="text-xs text-gray-400 mb-1">포인트</p>
          <p className="text-sm font-bold text-orange-500">{totalPoints.toLocaleString()}P</p>
        </button>
      </div>

      {showWalkLog && <WalkCalendarModal onClose={() => setShowWalkLog(false)} />}
      {showPoints && <PointHistoryModal onClose={() => setShowPoints(false)} />}
    </div>
  );
}
