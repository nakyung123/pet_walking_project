'use client';

interface MarkingButtonProps {
  onMark: () => void;
  onDelete: () => void;
  disabled?: boolean;
  loading?: boolean;
  deleting?: boolean;
  cooldownUntil?: number | null;
}

export default function MarkingButton({
  onMark, onDelete, disabled, loading, deleting, cooldownUntil,
}: MarkingButtonProps) {
  const remaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0;
  const inCooldown = remaining > 0;

  return (
    <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center items-center gap-3">
      {/* 마킹 버튼 */}
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

      {/* 삭제 버튼 */}
      <button
        onClick={onDelete}
        disabled={disabled || deleting}
        className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200
          text-xl active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed
          flex items-center justify-center shrink-0"
      >
        {deleting
          ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          : '🗑️'}
      </button>
    </div>
  );
}
