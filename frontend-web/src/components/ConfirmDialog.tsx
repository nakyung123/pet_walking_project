'use client';

interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, confirmLabel = '확인', onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-xs bg-white rounded-3xl shadow-2xl p-6 text-center">
        <p className="text-sm font-semibold text-gray-800 mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-bold"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
