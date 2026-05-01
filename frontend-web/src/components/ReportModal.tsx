'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

const DEFAULT_REPORT_TYPES = [
  '욕설 / 비방',
  '스팸',
  '위치 조작 의심',
  '부적절한 닉네임',
  '기타',
];

interface ReportModalProps {
  targetName: string;
  reportTypes?: string[];
  onSubmit?: (reason: string) => Promise<void>;
  onClose: () => void;
}

export default function ReportModal({ targetName, reportTypes, onSubmit, onClose }: ReportModalProps) {
  const types = reportTypes ?? DEFAULT_REPORT_TYPES;
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit?.(selected);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10">
            <div className="text-5xl">✅</div>
            <p className="text-base font-bold text-gray-900">신고가 접수됐습니다</p>
            <p className="text-xs text-gray-400 text-center">검토 후 조치하겠습니다.</p>
            <button
              onClick={onClose}
              className="mt-2 w-full py-3 rounded-2xl bg-orange-400 text-white text-sm font-bold"
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">신고하기</h2>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-xs text-gray-500">
                <span className="font-bold text-gray-800">{targetName}</span>을(를) 신고하는 이유를 선택해주세요.
              </p>

              <div className="flex flex-col gap-2">
                {types.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelected(type)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium text-left transition-colors ${
                      selected === type
                        ? 'border-orange-400 bg-orange-50 text-orange-600'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selected === type ? 'border-orange-400' : 'border-gray-300'
                    }`}>
                      {selected === type && <div className="w-2 h-2 rounded-full bg-orange-400" />}
                    </div>
                    {type}
                  </button>
                ))}
              </div>

              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="추가 내용을 입력해주세요 (선택)"
                className="w-full h-20 px-3 py-2 text-sm border border-gray-200 rounded-2xl resize-none outline-none focus:border-orange-400"
              />

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 text-sm font-bold"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selected || submitting}
                  className="flex-1 py-3 rounded-2xl bg-orange-400 text-white text-sm font-bold disabled:opacity-40"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : '신고하기'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
