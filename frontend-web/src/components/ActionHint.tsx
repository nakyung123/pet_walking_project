'use client';

export interface HintItem {
  icon: string;
  text: string;
  variant: 'default' | 'warning' | 'gold';
}

const VARIANT_STYLE: Record<HintItem['variant'], string> = {
  default: 'bg-white/97 border border-gray-200/80 text-gray-800',
  warning: 'bg-red-50 border border-red-200 text-red-700',
  gold:    'bg-amber-50 border border-amber-200 text-amber-800',
};

export default function ActionHint({ hints }: { hints: HintItem[] }) {
  if (hints.length === 0) return null;

  return (
    <div className="absolute top-[148px] left-0 right-0 z-10 flex justify-center px-4 pointer-events-none">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pointer-events-auto max-w-[420px] w-full">
        {hints.map((hint, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 shadow-sm backdrop-blur-sm ${VARIANT_STYLE[hint.variant]}`}
          >
            <span className="text-sm leading-none">{hint.icon}</span>
            <span className="text-xs font-semibold whitespace-nowrap">{hint.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
