'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { updateMyProfile } from '@/services/api';
import WalkSummaryModal from '@/components/WalkSummaryModal';
import ConfirmDialog from '@/components/ConfirmDialog';
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

const CHOSUNG_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function getChosung(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) return CHOSUNG_LIST[Math.floor((code - 0xAC00) / (21 * 28))];
  return char;
}

function matchBreed(breed: string, query: string): boolean {
  if (!query.trim()) return false;
  if (breed.includes(query)) return true;
  const isChosung = [...query].every((c) => CHOSUNG_LIST.includes(c));
  if (isChosung) return [...breed].map(getChosung).join('').includes(query);
  return false;
}

const DOG_BREEDS = [
  '믹스견',
  // 소형견
  '치와와', '말티즈', '포메라니안', '요크셔테리어', '시추', '비숑프리제',
  '미니어처 핀셔', '파피용', '이탈리안 그레이하운드', '토이 푸들',
  '닥스훈트', '퍼그', '프렌치 불독', '보스턴 테리어', '잭 러셀 테리어',
  '웰시 코기', '미니어처 슈나우저', '스코티시 테리어', '실키 테리어',
  '하바니즈', '말티푸', '포치온', '쉬츄',
  // 중형견
  '비글', '코커 스패니얼', '샤페이', '차우차우', '바센지',
  '불독', '시바 이누', '아키타', '바셋 하운드', '달마시안',
  '아메리칸 스태퍼드셔 테리어', '불 테리어', '케이스혼트',
  '포르투갈 워터독', '스탠더드 슈나우저',
  // 대형견
  '래브라도 리트리버', '골든 리트리버', '저먼 셰퍼드', '보더 콜리',
  '시베리안 허스키', '알래스칸 말라뮤트', '사모예드', '도베르만',
  '로트와일러', '복서', '그레이트 데인', '세인트 버나드',
  '버니즈 마운틴 독', '뉴펀들랜드', '아이리시 세터', '잉글리시 세터',
  '비즐라', '와이마라너', '그레이하운드', '아프간 하운드',
  '스탠더드 푸들', '오스트레일리안 셰퍼드', '말리노이즈',
  // 한국 견종
  '진돗개', '풍산개', '삽살개', '동경이',
];

function BreedSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim() ? DOG_BREEDS.filter((b) => matchBreed(b, query.trim())) : [];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const select = (breed: string) => {
    onChange(breed);
    setOpen(false);
    setQuery('');
  };

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={containerRef} className="flex-1 relative">
      {!open ? (
        <div
          onClick={handleOpen}
          className="flex items-center border border-gray-200 rounded-lg px-2 py-1.5 gap-1 cursor-pointer"
        >
          <span className={`flex-1 text-xs truncate ${value ? 'text-gray-800' : 'text-gray-500'}`}>
            {value || '견종 선택하기'}
          </span>
          <span className="text-gray-500 text-[10px] shrink-0">▼</span>
        </div>
      ) : (
        <div className="flex items-center border border-orange-400 rounded-lg px-2 py-1.5 gap-1">
          <input
            ref={inputRef}
            value={query}
            placeholder="견종을 검색해주세요"
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-xs text-gray-800 focus:outline-none placeholder:text-gray-500 bg-transparent"
          />
          <span className="text-gray-500 text-[10px] shrink-0">▲</span>
        </div>
      )}

      {open && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-44 overflow-y-auto">
          {query.trim() === '' ? (
            <li className="text-xs text-gray-500 text-center py-3">견종을 입력하면 검색돼요</li>
          ) : filtered.length === 0 ? (
            <li className="text-xs text-gray-400 text-center py-3">검색 결과 없음</li>
          ) : (
            filtered.map((b) => (
              <li
                key={b}
                onMouseDown={() => select(b)}
                className={`text-xs px-3 py-2 cursor-pointer hover:bg-orange-50 transition-colors ${
                  b === value ? 'text-orange-500 font-bold' : 'text-gray-700'
                }`}
              >
                {b}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function WalkCalendarModal({ onClose }: { onClose: () => void }) {
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
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="text-base font-bold text-gray-900">산책일지</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm">✕</button>
        </div>

        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <button onClick={prevMonth} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 text-sm">◀</button>
          <span className="text-sm font-bold text-gray-800">{year}년 {month + 1}월</span>
          <button onClick={nextMonth} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 text-sm">▶</button>
        </div>

        <div className="grid grid-cols-7 px-3 pb-1 shrink-0">
          {WEEK_DAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 px-3 pb-8 gap-y-2">
          {cells.map((d, i) => {
            if (d === null) return <div key={`e-${i}`} />;
            const summary = getDaySummary(d);
            const hasWalk = !!summary;
            return (
              <button
                key={d}
                onClick={() => { if (summary) setSelectedLog(summary.merged); }}
                disabled={!hasWalk}
                className={`flex flex-col items-center py-1.5 rounded-xl transition-colors ${hasWalk ? 'hover:bg-orange-50' : ''}`}
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
    marking: '📍',
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
  name: '',
  breed: '',
  age: '',
  gender: 'male',
  neutered: false,
  personality: '',
  weight: 0,
};

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
  const [showPoints, setShowPoints] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(false);

  useEffect(() => {
    setTotalPoints(loadPointHistory().reduce((s, h) => s + h.points, 0));
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

  const handleDelete = () => {
    if (pets.length <= 1) return;
    setPendingDelete(true);
  };

  const confirmDelete = () => {
    setPendingDelete(false);
    const newPets = pets.filter((_, i) => i !== activePetIdx);
    const newIdx = Math.max(0, activePetIdx - 1);
    setPets(newPets);
    setActivePetIdx(newIdx);
    setDraft(newPets[newIdx] ?? DEFAULT_PET);
    savePets(newPets, newIdx);
    setEditing(false);
  };

  const handleSave = () => {
    if (!draft.name.trim() || !draft.age || !draft.breed || !draft.personality.trim()) return;
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
    if (addingPet) setAddDraft({ ...DEFAULT_PET, name: '', breed: '', age: '', personality: '' });
  }, [addingPet]);

  const handleAddSave = () => {
    if (!addDraft.name.trim() || !addDraft.age || !addDraft.breed || !addDraft.personality.trim()) return;
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
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 w-full h-full flex flex-col [&::-webkit-scrollbar]:hidden">
        <div className="mb-3 shrink-0">
          <span className="text-sm font-bold text-gray-800">강아지 정보 추가</span>
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
              { label: '이름', key: 'name', placeholder: '이름을 입력해주세요' },
              { label: '성격', key: 'personality', placeholder: '성격을 입력해주세요' },
            ] as { label: string; key: keyof PetData; placeholder: string }[]
          ).map(({ label, key, placeholder }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-700 font-medium w-10 shrink-0">{label}</span>
              <input
                value={addDraft[key] as string}
                placeholder={placeholder}
                maxLength={key === 'name' ? 8 : undefined}
                onChange={(e) => setAddDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                className="flex-1 text-xs text-gray-800 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400 placeholder:text-gray-400"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">나이</span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={addDraft.age}
                placeholder="0"
                onChange={(e) => setAddDraft((prev) => ({ ...prev, age: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))}
                className="w-16 text-xs text-gray-800 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400 placeholder:text-gray-400"
              />
              <span className="text-xs text-gray-600 font-medium">살</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">견종</span>
            <BreedSelect
              value={addDraft.breed}
              onChange={(v) => setAddDraft((prev) => ({ ...prev, breed: v }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">체중</span>
            <input
              type="text"
              inputMode="decimal"
              value={addDraft.weight || ''}
              placeholder="0.0"
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                const clean = raw.split('.').length > 2 ? raw.slice(0, raw.lastIndexOf('.')) : raw;
                setAddDraft((prev) => ({ ...prev, weight: clean === '' ? 0 : (parseFloat(clean) || prev.weight) }));
              }}
              className="w-16 text-xs text-gray-800 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400 placeholder:text-gray-400"
            />
            <span className="text-xs text-gray-500">kg</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">성별</span>
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
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">중성화</span>
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

        <div className="mt-4 shrink-0 flex gap-2">
          <button
            onClick={onAddPetCancel}
            className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 active:scale-[0.98] transition-transform"
          >
            취소
          </button>
          <button
            onClick={handleAddSave}
            disabled={!addDraft.name.trim() || !addDraft.age || !addDraft.breed || !addDraft.personality.trim()}
            className="flex-1 h-11 rounded-2xl text-white text-sm font-bold active:scale-[0.98] transition-transform disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
          >
            추가
          </button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-4 w-full h-full flex flex-col overflow-y-auto [&::-webkit-scrollbar]:hidden">
        <div className="mb-3 shrink-0">
          <span className="text-sm font-bold text-gray-800">강아지 정보 수정</span>
        </div>

        {/* 사진 업로드 */}
        <div className="flex flex-col items-center mb-3 shrink-0">
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
          <span className="text-xs text-orange-500">사진 변경</span>
        </div>

        <div className="space-y-2">
          {(
            [
              { label: '이름', key: 'name', placeholder: '이름을 입력해주세요' },
              { label: '성격', key: 'personality', placeholder: '성격을 입력해주세요' },
            ] as { label: string; key: keyof PetData; placeholder: string }[]
          ).map(({ label, key, placeholder }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-700 font-medium w-10 shrink-0">{label}</span>
              <input
                value={draft[key] as string}
                placeholder={placeholder}
                maxLength={key === 'name' ? 8 : undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                className="flex-1 text-xs text-gray-800 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400 placeholder:text-gray-400"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">나이</span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.age}
                placeholder="0"
                onChange={(e) => setDraft((prev) => ({ ...prev, age: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))}
                className="w-16 text-xs text-gray-800 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400 placeholder:text-gray-400"
              />
              <span className="text-xs text-gray-600 font-medium">살</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">견종</span>
            <BreedSelect
              value={draft.breed}
              onChange={(v) => setDraft((prev) => ({ ...prev, breed: v }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">체중</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft.weight || ''}
              placeholder="0.0"
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                const clean = raw.split('.').length > 2 ? raw.slice(0, raw.lastIndexOf('.')) : raw;
                setDraft((prev) => ({ ...prev, weight: clean === '' ? 0 : (parseFloat(clean) || prev.weight) }));
              }}
              className="w-16 text-xs text-gray-800 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-400 placeholder:text-gray-400"
            />
            <span className="text-xs text-gray-500">kg</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">성별</span>
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
            <span className="text-xs text-gray-700 font-medium w-10 shrink-0">중성화</span>
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

        <div className="mt-4 shrink-0 flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 active:scale-[0.98] transition-transform"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!draft.name.trim() || !draft.age || !draft.breed || !draft.personality.trim()}
            className="flex-1 h-11 rounded-2xl text-white text-sm font-bold active:scale-[0.98] transition-transform disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
          >
            저장
          </button>
        </div>
        {pets.length > 1 && (
          <button
            onClick={handleDelete}
            className="mt-2 w-full h-10 rounded-2xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 active:scale-[0.98] transition-transform"
          >
            이 반려견 삭제
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl px-5 py-4 w-full h-full flex flex-col">
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
          <p className="text-sm text-gray-700 font-medium mt-1">
            {pet.breed} · {pet.age ? `${pet.age}살` : ''}
          </p>
          <p className="text-sm mt-1">
            <span className={pet.gender === 'male' ? 'text-blue-500' : 'text-pink-500'}>
              {pet.gender === 'male' ? '♂ 수컷' : '♀ 암컷'}
            </span>
            <span className="text-gray-600 ml-1.5">
              · 중성화 {pet.neutered ? '했어요' : '안했어요'}
            </span>
          </p>
          {pet.personality && (
            <p className="text-sm text-gray-700 mt-1 truncate">"{pet.personality}"</p>
          )}
        </div>
      </div>

      {/* 하단 버튼: 포인트 / 프로필 편집 */}
      <div className="shrink-0 border-t border-gray-100 pt-3 grid grid-cols-2 gap-1 text-center">
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
        <button
          onClick={() => { setDraft(pet); setEditing(true); }}
          className="flex flex-col items-center py-2 rounded-xl hover:bg-gray-50 active:bg-orange-50 transition-colors"
        >
          <p className="text-xs text-gray-400 mb-1">프로필 편집</p>
          <svg className="mx-auto" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      {showPoints && createPortal(<PointHistoryModal onClose={() => setShowPoints(false)} />, document.body)}

      {pendingDelete && createPortal(
        <ConfirmDialog
          message={`${pet.name}을(를) 삭제하시겠습니까?`}
          confirmLabel="삭제"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(false)}
        />,
        document.body,
      )}
    </div>
  );
}
