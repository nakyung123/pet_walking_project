'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getPosts, createPost, Post, PostCategory } from '@/services/api';
import PostDetailModal from '@/components/PostDetailModal';

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
  currentUserId: string;
  onClose: () => void;
}

const CATEGORY_TABS: { value: PostCategory | 'all'; label: string }[] = [
  { value: 'all',      label: '전체'       },
  { value: 'walk_log', label: '산책일지'   },
  { value: 'brag',     label: '🌟 자랑'    },
  { value: 'other',    label: '💬 기타'    },
];

const CREATE_CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: 'walk_log', label: '산책일지'   },
  { value: 'brag',     label: '🌟 자랑하기' },
  { value: 'other',    label: '💬 기타'     },
];

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
    >
      {post.images.length > 0 && (
        <img src={post.images[0].url} alt="" className="w-full h-36 object-cover" />
      )}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-[10px] font-bold text-orange-500 shrink-0">
            {post.displayName.slice(0, 1)}
          </div>
          <span className="text-xs font-semibold text-gray-700">{post.displayName}</span>
          <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(post.createdAt)}</span>
        </div>
        <h3 className="text-sm font-bold text-gray-900 truncate mb-1">{post.title}</h3>
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{post.content}</p>
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50">
          <span className="text-xs text-gray-400">❤️ {post.likeCount}</span>
          <span className="text-xs text-gray-400">💬 {post.commentCount}</span>
        </div>
      </div>
    </div>
  );
}

export default function CommunityPanel({ idToken, currentUserId, onClose }: Props) {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [category, setCategory]   = useState<PostCategory | 'all'>('all');
  const [posts, setPosts]         = useState<Post[]>([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [loading, setLoading]     = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // 글쓰기 폼 상태
  const [createCategory, setCreateCategory] = useState<PostCategory>('walk_log');
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [images, setImages]   = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPosts = useCallback(async (cat: PostCategory | 'all', p: number, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await getPosts(cat, p, idToken);
      if (res.success && res.data) {
        setPosts((prev) => reset ? res.data! : [...prev, ...res.data!]);
        setHasMore(res.data.length === 20);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    loadPosts(category, 1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, idToken]);

  const openCreate = () => {
    setCreateCategory('walk_log');
    setTitle('');
    setContent('');
    setImages([]);
    setPreviews([]);
    setView('create');
  };

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
    try {
      const imageUrls = await Promise.all(images.map((f) => compressToBase64(f)));
      await createPost({ category: createCategory, title: title.trim(), content: content.trim(), imageUrls }, idToken);
      setView('list');
      setPosts([]);
      setPage(1);
      loadPosts(category, 1, true);
    } catch (e) {
      console.error('[PostCreate] 작성 실패:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-50 rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '85dvh' }}>

        {view === 'list' && (
          <>
            {/* 목록 헤더 */}
            <div className="bg-white rounded-t-3xl border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between px-5 pt-5 pb-2">
                <h1 className="text-base font-bold text-gray-900">커뮤니티</h1>
                <div className="flex items-center gap-3">
                  <button onClick={openCreate} className="text-sm font-bold text-orange-500">글쓰기</button>
                  <button
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm"
                  >✕</button>
                </div>
              </div>
              <div className="flex gap-2 px-5 pb-3 overflow-x-auto scrollbar-hide">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setCategory(tab.value)}
                    className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${
                      category === tab.value ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 게시글 목록 */}
            <div className={`flex-1 min-h-0 scrollbar-hide px-4 pt-4 pb-4 space-y-3 overflow-y-auto`}>
              {posts.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center h-full mb-16 text-gray-500 text-sm">
                  <p>아직 게시글이 없어요</p>
                  <p className="text-xs mt-1">첫 번째 글을 작성해보세요!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard key={post.id} post={post} onClick={() => { setSelectedPostId(post.id); setView('detail'); }} />
                ))
              )}

              {hasMore && !loading && posts.length > 0 && (
                <button
                  onClick={() => { const next = page + 1; setPage(next); loadPosts(category, next); }}
                  className="w-full py-3 text-sm text-orange-500 font-semibold"
                >더 보기</button>
              )}

              {loading && (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </>
        )}

        {view === 'create' && (
          <>
            {/* 작성 헤더 */}
            <div className="bg-white rounded-t-3xl border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between px-5 pt-5 pb-4">
                <button onClick={() => setView('list')} className="text-sm text-orange-500 font-bold">← 뒤로</button>
                <h1 className="text-base font-bold text-gray-900">게시글 작성</h1>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm"
                >✕</button>
              </div>
            </div>

            {/* 작성 폼 */}
            <div className="flex-1 overflow-hidden px-5 py-4 space-y-4">
              {/* 카테고리 */}
              <div className="flex gap-2">
                {CREATE_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCreateCategory(c.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                      createCategory === c.value ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-700'
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 bg-white"
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
                  rows={7}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 resize-none bg-white"
                />
                <p className={`text-right text-[11px] mt-1 ${content.length >= 480 ? 'text-orange-500' : 'text-gray-400'}`}>
                  {content.length}/500자
                </p>
              </div>

              {/* 이미지 첨부 */}
              <div className="flex gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-[92px] h-[92px] rounded-xl overflow-hidden border border-gray-200">
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
                    className="w-[92px] h-[92px] rounded-xl border-2 border-dashed border-gray-400 flex flex-col items-center justify-center text-gray-600 text-xs gap-1"
                  >
                    <span className="text-xl">+</span>
                    <span>{images.length}/3</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </div>
            </div>

            {/* 제출 버튼 */}
            <div className="px-5 py-4 border-t border-gray-100 bg-white rounded-b-3xl shrink-0">
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
          </>
        )}

        {view === 'detail' && selectedPostId && (
          <PostDetailModal
            inline
            postId={selectedPostId}
            idToken={idToken}
            currentUserId={currentUserId}
            onClose={() => { setSelectedPostId(null); setView('list'); }}
            onDeleted={() => {
              setPosts((prev) => prev.filter((p) => p.id !== selectedPostId));
              setSelectedPostId(null);
              setView('list');
            }}
            onPostUpdate={(pid, updates) => {
              setPosts((prev) => prev.map((p) => p.id === pid ? { ...p, ...updates } : p));
            }}
          />
        )}
      </div>
    </div>
  );
}
