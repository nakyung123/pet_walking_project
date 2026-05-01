'use client';

import { useState, useRef, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

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

interface Props {
  onDone: (pet: PetData) => void;
}

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
  '치와와', '말티즈', '포메라니안', '요크셔테리어', '시추', '비숑프리제',
  '미니어처 핀셔', '파피용', '이탈리안 그레이하운드', '토이 푸들',
  '닥스훈트', '퍼그', '프렌치 불독', '보스턴 테리어', '잭 러셀 테리어',
  '웰시 코기', '미니어처 슈나우저', '스코티시 테리어', '실키 테리어',
  '하바니즈', '말티푸', '포치온', '쉬츄',
  '비글', '코커 스패니얼', '샤페이', '차우차우', '바센지',
  '불독', '시바 이누', '아키타', '바셋 하운드', '달마시안',
  '아메리칸 스태퍼드셔 테리어', '불 테리어', '케이스혼트',
  '포르투갈 워터독', '스탠더드 슈나우저',
  '래브라도 리트리버', '골든 리트리버', '저먼 셰퍼드', '보더 콜리',
  '시베리안 허스키', '알래스칸 말라뮤트', '사모예드', '도베르만',
  '로트와일러', '복서', '그레이트 데인', '세인트 버나드',
  '버니즈 마운틴 독', '뉴펀들랜드', '아이리시 세터', '잉글리시 세터',
  '비즐라', '와이마라너', '그레이하운드', '아프간 하운드',
  '스탠더드 푸들', '오스트레일리안 셰퍼드', '말리노이즈',
  '진돗개', '풍산개', '삽살개', '동경이',
];

function BreedSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query.trim() ? DOG_BREEDS.filter((b) => matchBreed(b, query.trim())) : [];

  useEffect(() => { setActiveIdx(-1); }, [query]);

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

  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('li[data-idx]');
    (items[activeIdx] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const select = (breed: string) => {
    onChange(breed);
    setOpen(false);
    setQuery('');
    setActiveIdx(-1);
  };

  const handleOpen = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0) select(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {!open ? (
        <div
          onClick={handleOpen}
          className="flex items-center border border-gray-200 rounded-xl px-3.5 py-2.5 gap-1 cursor-pointer bg-white"
        >
          <span className={`flex-1 text-sm truncate ${value ? 'text-gray-800' : 'text-gray-400'}`}>
            {value || '견종을 선택해주세요'}
          </span>
          <span className="text-gray-400 text-xs shrink-0">▼</span>
        </div>
      ) : (
        <div className="flex items-center border border-orange-400 rounded-xl px-3.5 py-2.5 gap-1 bg-white">
          <input
            ref={inputRef}
            value={query}
            placeholder="견종을 검색해주세요 (초성 가능)"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm text-gray-800 focus:outline-none placeholder:text-gray-400 bg-transparent"
          />
          <span className="text-gray-400 text-xs shrink-0">▲</span>
        </div>
      )}

      {open && (
        <ul ref={listRef} className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-44 overflow-y-auto scrollbar-hide">
          {query.trim() === '' ? (
            <li className="text-xs text-gray-500 text-center py-3">견종을 입력하면 검색돼요</li>
          ) : filtered.length === 0 ? (
            <li className="text-xs text-gray-400 text-center py-3">검색 결과 없음</li>
          ) : (
            filtered.map((b, i) => (
              <li
                key={b}
                data-idx={i}
                onMouseDown={() => select(b)}
                className={`text-sm px-3.5 py-2 cursor-pointer transition-colors ${
                  i === activeIdx
                    ? 'bg-orange-100 text-orange-600 font-bold'
                    : b === value
                    ? 'text-orange-500 font-bold hover:bg-orange-50'
                    : 'text-gray-700 hover:bg-orange-50'
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

export default function DogSetupScreen({ onDone }: Props) {
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('0');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [neutered, setNeutered] = useState(false);
  const [rawWeight, setRawWeight] = useState(''); // 소수점 없는 정수 문자열 (1005 → 100.5)
  const [personality, setPersonality] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1005 → "100.5"
  const displayWeight = rawWeight ? (parseInt(rawWeight) / 10).toFixed(1) : '0.0';

  const canStart = name.trim() && breed && age && personality.trim();

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotoUrl(url);
    } catch {
      // 업로드 실패 시 무시
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleWeightInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 4); // 최대 4자리 → 999.9
    setRawWeight(digits);
  };

  const handleStart = () => {
    if (!canStart) return;
    onDone({
      name: name.trim(),
      breed,
      age,
      gender,
      neutered,
      personality: personality.trim(),
      weight: rawWeight ? parseInt(rawWeight) / 10 : 0,
      photoUrl: photoUrl ?? undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 overflow-y-auto scrollbar-hide py-8"
      style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #FFEDD5 60%, #FED7AA 100%)' }}
    >
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-30 -translate-x-1/3 -translate-y-1/3"
        style={{ background: 'radial-gradient(circle, #FB923C, transparent)' }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-20 translate-x-1/4 translate-y-1/4"
        style={{ background: 'radial-gradient(circle, #F97316, transparent)' }} />

      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-xs">

        {/* 프로필 사진 */}
        <div className="relative">
          <div
            className="w-24 h-24 rounded-full overflow-hidden shadow-lg border-4 border-white/80 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="w-full h-full flex items-center justify-center bg-orange-50">
                <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : photoUrl ? (
              <img src={photoUrl} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <img src="/bichon.png" alt="강아지" className="w-full h-full object-cover" />
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md text-xs"
          >
            +
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-gray-800">반려견을 소개해주세요!</h2>
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
            퍼피랜드를 함께할 반려견 정보를<br />먼저 입력해주세요.
          </p>
        </div>

        <div className="w-full bg-white/75 rounded-2xl px-5 py-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">
              이름 <span className="text-orange-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="반려견 이름"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-orange-400"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">
              견종 <span className="text-orange-500">*</span>
            </label>
            <BreedSelect value={breed} onChange={setBreed} />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">
              나이 <span className="text-orange-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, '').slice(0, 2) || '0')}
                className="w-20 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-orange-400 text-center"
              />
              <span className="text-sm text-gray-500">살</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">성별</label>
            <div className="flex gap-2">
              {(['male', 'female'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    gender === g ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                  }`}
                  style={gender === g ? { background: 'linear-gradient(135deg, #FB923C, #F97316)' } : {}}
                >
                  {g === 'male' ? '남아' : '여아'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">중성화</label>
            <div className="flex gap-2">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setNeutered(v)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    neutered === v ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                  }`}
                  style={neutered === v ? { background: 'linear-gradient(135deg, #FB923C, #F97316)' } : {}}
                >
                  {v ? '했어요' : '안 했어요'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">체중 (선택)</label>
            <div className="flex items-center gap-2">
              <div className="w-24 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus-within:border-orange-400 flex items-center gap-0.5">
                <input
                  type="text"
                  inputMode="numeric"
                  value={rawWeight}
                  onChange={handleWeightInput}
                  placeholder=""
                  className="w-full text-sm text-gray-800 focus:outline-none bg-transparent text-right"
                  style={{ caretColor: 'auto' }}
                />
              </div>
              <span className="text-sm text-gray-500 shrink-0">= {displayWeight} kg</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">숫자만 입력 (예: 1005 → 100.5kg, 최대 999.9)</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">
              성격 <span className="text-orange-500">*</span>
            </label>
            <input
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="예: 활발하고 사교적이에요"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-orange-400"
            />
          </div>
        </div>

        <div className="w-full">
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full py-4 rounded-2xl text-white font-bold text-sm shadow-md active:scale-95 transition-transform disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
