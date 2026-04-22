'use client';

import { UserProfile } from '@/services/api';

interface UserProfilePopupProps {
  profile: UserProfile;
  onClose: () => void;
}

export default function UserProfilePopup({ profile, onClose }: UserProfilePopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-xs bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* 헤더 배경 */}
        <div
          className="h-24 w-full"
          style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
        />

        {/* 프로필 사진 — 헤더와 본문 사이 */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2">
          <div className="w-[72px] h-[72px] rounded-full border-4 border-white shadow-lg overflow-hidden bg-orange-100">
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt={profile.dogName} className="w-full h-full object-cover" />
            ) : (
              <img
                src={`https://place.dog/72/72?${profile.userId.slice(0, 6)}`}
                alt={profile.dogName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
        >
          ✕
        </button>

        {/* 본문 */}
        <div className="px-5 pt-12 pb-5 flex flex-col items-center gap-4">
          {/* 이름 */}
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{profile.dogName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{profile.displayName}의 반려견</p>
          </div>

          {/* 견종 / 나이 / 성격 */}
          <div className="w-full grid grid-cols-3 gap-2">
            {[
              { label: '견종', value: profile.dogBreed ?? '미등록' },
              { label: '나이', value: profile.dogAge ?? '미등록' },
              { label: '성격', value: profile.dogPersonality ?? '미등록' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-2xl px-2 py-3 text-center">
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className="text-xs font-bold text-gray-800 mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* 점수 / 영역 */}
          <div className="w-full grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded-2xl px-3 py-3 text-center">
              <p className="text-[10px] text-gray-400">현재 점수</p>
              <p className="text-sm font-bold text-blue-600 mt-0.5">
                {profile.totalScore.toLocaleString()}점
              </p>
            </div>
            <div className="bg-orange-50 rounded-2xl px-3 py-3 text-center">
              <p className="text-[10px] text-gray-400">점령 타일</p>
              <p className="text-sm font-bold text-orange-600 mt-0.5">
                {profile.tileCount}개
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
