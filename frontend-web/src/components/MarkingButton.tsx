'use client';

interface MarkingButtonProps {
  onMark: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function MarkingButton({ onMark, disabled, loading }: MarkingButtonProps) {
  return (
    <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
      <button
        onClick={onMark}
        disabled={disabled || loading}
        className="
          w-24 h-24 rounded-full
          bg-yellow-400 text-gray-900
          font-bold text-lg shadow-xl
          active:scale-95 transition-transform
          disabled:opacity-50 disabled:cursor-not-allowed
          flex flex-col items-center justify-center gap-1
        "
      >
        {loading ? (
          <div className="w-6 h-6 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span className="text-2xl">🐾</span>
            <span className="text-xs font-semibold">Marking</span>
          </>
        )}
      </button>
    </div>
  );
}
