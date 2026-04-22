'use client';

interface MarkingButtonProps {
  onMark: () => void;
  onStartWalk: () => void;
  isWalking: boolean;
  disabled?: boolean;
  loading?: boolean;
  cooldownUntil?: number | null;
}

export default function MarkingButton({
  onMark, onStartWalk, isWalking,
  disabled, loading, cooldownUntil,
}: MarkingButtonProps) {
  const remaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0;
  const inCooldown = remaining > 0;

  if (!isWalking) {
    return (
      <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center">
        <button
          onClick={onStartWalk}
          className="h-14 px-10 rounded-full shadow-xl active:scale-[0.97] transition-transform
            text-white font-bold text-lg whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
        >
          산책 시작하기
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-[98px] left-0 right-0 z-10 flex justify-center">
      <button
        onClick={onMark}
        disabled={disabled || loading || inCooldown}
        className="h-14 px-10 rounded-full shadow-xl active:scale-[0.97] transition-transform
          disabled:opacity-50 disabled:cursor-not-allowed
          text-white font-bold text-lg whitespace-nowrap"
        style={{ background: inCooldown ? '#9CA3AF' : 'linear-gradient(135deg, #FB923C, #F97316)' }}
      >
        {loading ? (
          <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
        ) : inCooldown ? (
          `${remaining}초 후 가능`
        ) : (
          '마킹하기'
        )}
      </button>
    </div>
  );
}
