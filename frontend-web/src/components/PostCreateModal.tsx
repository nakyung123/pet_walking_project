'use client';

import { useState, useRef } from 'react';
import { createPost, PostCategory } from '@/services/api';

async function compressToBase64(file: File, maxWidth = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas 오류')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface Props {
  idToken: string;
  onClose: () => void;
  onCreated: () => void;
}

const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: 'walk_log', label: '산책일지' },
  { value: 'brag',     label: '🌟 자랑하기' },
  { value: 'other',    label: '💬 기타'     },
];

export default function PostCreateModal({ idToken, onClose, onCreated }: Props) {
  const [category, setCategory] = useState<PostCategory>('walk_log');
  const [title, setTitle]       = useState('');
  const [content, setContent]   = useState('');
  const [images, setImages]     = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).slice(0, 3 - images.length);
    setImages((prev) => [...prev, ...picked].slice(0, 3));
    picked.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url].slice(0, 3));
    });
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setUploadError(null);
    try {
      const imageUrls = await Promise.all(images.map((f) => compressToBase64(f)));
      await createPost({ category, title: title.trim(), content: content.trim(), imageUrls }, idToken);
      onCreated();
    } catch (e) {
      console.error('[PostCreate] 작성 실패:', e);
      setUploadError('게시글 작성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">게시글 작성</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 카테고리 */}
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                  category === c.value ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* 제목 */}
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="제목을 입력하세요"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400"
            />
            <p className="text-right text-[11px] text-gray-400 mt-1">{title.length}/60자</p>
          </div>

          {/* 본문 */}
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              placeholder="내용을 입력하세요 (500자 이내)"
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400 resize-none"
            />
            <p className={`text-right text-[11px] mt-1 ${content.length >= 480 ? 'text-orange-500' : 'text-gray-400'}`}>
              {content.length}/500자
            </p>
          </div>

          {/* 이미지 첨부 */}
          <div>
            <div className="flex gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full text-white text-[10px] flex items-center justify-center"
                  >✕</button>
                </div>
              ))}
              {images.length < 3 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 text-xs gap-1"
                >
                  <span className="text-xl">+</span>
                  <span>{images.length}/3</span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="px-5 py-4 border-t border-gray-100">
          {uploadError && (
            <p className="text-red-500 text-xs text-center mb-2">{uploadError}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="w-full h-12 rounded-2xl text-white font-bold text-sm disabled:opacity-50 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : '게시하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
