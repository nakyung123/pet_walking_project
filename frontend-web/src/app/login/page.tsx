'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import Image from 'next/image';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /KAKAOTALK|Instagram|NAVER|Line|FBAN|FBAV|Twitter|Snapchat|TikTok/i.test(ua);
}

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/map');
  }, [user, loading, router]);

  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 미지원 시 무시
    }
  };

  const handleLogin = async () => {
    setPopupBlocked(false);
    try {
      const result = await signInWithGoogle();
      if (result.popupBlocked) setPopupBlocked(true);
    } catch (e) {
      console.error('[Login] Google 로그인 실패:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #FFEDD5 100%)' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-8 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #FFEDD5 60%, #FED7AA 100%)' }}
    >
      {/* 배경 장식 원 */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-30 -translate-x-1/3 -translate-y-1/3"
        style={{ background: 'radial-gradient(circle, #FB923C, transparent)' }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-20 translate-x-1/4 translate-y-1/4"
        style={{ background: 'radial-gradient(circle, #F97316, transparent)' }} />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-xs">
        {/* 로고 이미지 */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-2xl opacity-40 scale-75"
            style={{ background: 'radial-gradient(circle, #FB923C, #FDE68A)' }} />
          <Image
            src="/login-dog.png"
            alt="퍼피랜드 마스코트"
            width={180}
            height={180}
            className="relative drop-shadow-lg"
            priority
          />
        </div>

        {/* 앱 이름 & 슬로건 */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-800">
            퍼피랜드
          </h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            반려견과 함께 동네를 점령하세요
          </p>
        </div>

        {/* 구분선 */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-orange-200" />
          <span className="text-xs text-orange-300 font-medium">시작하기</span>
          <div className="flex-1 h-px bg-orange-200" />
        </div>

        {inApp ? (
          /* 인앱 브라우저 안내 */
          <div className="w-full bg-orange-50 border border-orange-200 rounded-2xl px-4 py-5 text-center flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-orange-700">외부 브라우저에서 열어주세요</p>
            <p className="text-xs text-orange-500 leading-relaxed">
              카카오톡·인스타그램 등 앱 내 브라우저에서는<br />Google 로그인이 지원되지 않아요.<br />
              아래 버튼으로 주소를 복사한 뒤<br />Chrome 또는 Safari에서 열어주세요.
            </p>
            <button
              onClick={handleCopy}
              className="mt-1 px-5 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold active:scale-95 transition-all"
            >
              {copied ? '복사됐어요!' : '주소 복사하기'}
            </button>
          </div>
        ) : (
          /* 일반 브라우저 로그인 버튼 */
          <>
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold px-6 py-4 rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition-all duration-150 border border-orange-100"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 계속하기
            </button>

            {popupBlocked && (
              <div className="w-full bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-center">
                <p className="text-sm font-semibold text-orange-700">팝업이 차단되었어요</p>
                <p className="text-xs text-orange-500 mt-1 leading-relaxed">
                  주소창 오른쪽의 팝업 차단 아이콘을 클릭해<br />이 사이트의 팝업을 허용한 뒤 다시 시도해주세요.
                </p>
              </div>
            )}
          </>
        )}

        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          로그인 시 서비스 이용약관 및<br />개인정보 처리방침에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
}
