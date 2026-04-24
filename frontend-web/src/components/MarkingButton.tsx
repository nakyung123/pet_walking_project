'use client';

interface MarkingButtonProps {
  onStartWalk: () => void;
  isWalking: boolean;
  disabled?: boolean;
}

export default function MarkingButton({ onStartWalk, isWalking, disabled }: MarkingButtonProps) {
  if (isWalking) return null;

  return (
    <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center">
      <button
        onClick={onStartWalk}
        disabled={disabled}
        className="h-14 px-10 rounded-full shadow-xl active:scale-[0.97] transition-transform
          text-white font-bold text-lg whitespace-nowrap disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
      >
        산책 시작하기
      </button>
    </div>
  );
}
