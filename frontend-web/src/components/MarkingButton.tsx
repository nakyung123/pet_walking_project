'use client';

interface MarkingButtonProps {
  onStartWalk: () => void;
  isWalking: boolean;
  disabled?: boolean;
  onDelete?: () => void;
  deleting?: boolean;
  deleteDisabled?: boolean;
}

export default function MarkingButton({
  onStartWalk, isWalking, disabled,
  onDelete, deleting, deleteDisabled,
}: MarkingButtonProps) {
  if (isWalking) return null;

  return (
    <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center items-center gap-3">
      <button
        onClick={onStartWalk}
        disabled={disabled}
        className="h-14 px-10 rounded-full shadow-xl active:scale-[0.97] transition-transform
          text-white font-bold text-lg whitespace-nowrap disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
      >
        산책 시작하기
      </button>

      <button
        onClick={onDelete}
        disabled={deleteDisabled}
        className="w-14 h-14 rounded-full bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200 flex items-center justify-center text-xl active:scale-[0.97] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {deleting
          ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          : '🗑️'}
      </button>
    </div>
  );
}
