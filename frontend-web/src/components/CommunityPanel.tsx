'use client';

import { useEffect, useState, useCallback } from 'react';
import { getPosts, Post, PostCategory } from '@/services/api';
import PostCreateModal from '@/components/PostCreateModal';
import PostDetailModal from '@/components/PostDetailModal';

interface Props {
  idToken: string;
  currentUserId: string;
  onClose: () => void;
}

const CATEGORY_TABS: { value: PostCategory | 'all'; label: string }[] = [
  { value: 'all',      label: '전체'       },
  { value: 'walk_log', label: '🐾 산책일지' },
  { value: 'brag',     label: '🌟 자랑'    },
  { value: 'other',    label: '💬 기타'    },
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
          <span className="text-xs text-gray-400">{post.likedByMe ? '❤️' : '🤍'} {post.likeCount}</span>
          <span className="text-xs text-gray-400">💬 {post.commentCount}</span>
        </div>
      </div>
    </div>
  );
}

export default function CommunityPanel({ idToken, currentUserId, onClose }: Props) {
  const [category, setCategory]   = useState<PostCategory | 'all'>('all');
  const [posts, setPosts]         = useState<Post[]>([]);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(true);
  const [loading, setLoading]     = useState(false);
  const [showCreate, setShowCreate]       = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-50 rounded-t-3xl shadow-2xl flex flex-col h-[90vh]">

        {/* 헤더 */}
        <div className="bg-white rounded-t-3xl border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <h1 className="text-base font-bold text-gray-900">커뮤니티</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreate(true)}
                className="text-sm font-bold text-orange-500"
              >글쓰기</button>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm"
              >✕</button>
            </div>
          </div>

          {/* 카테고리 탭 */}
          <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto scrollbar-hide">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setCategory(tab.value)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  category === tab.value ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 게시글 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {posts.length === 0 && !loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              <p className="text-3xl mb-3">🐾</p>
              <p>아직 게시글이 없어요</p>
              <p className="text-xs mt-1">첫 번째 글을 작성해보세요!</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post.id} post={post} onClick={() => setSelectedPostId(post.id)} />
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
      </div>

      {/* 글쓰기 모달 */}
      {showCreate && (
        <PostCreateModal
          idToken={idToken}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setPosts([]);
            setPage(1);
            loadPosts(category, 1, true);
          }}
        />
      )}

      {/* 게시글 상세 */}
      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          idToken={idToken}
          currentUserId={currentUserId}
          onClose={() => setSelectedPostId(null)}
          onDeleted={() => {
            setSelectedPostId(null);
            setPosts((prev) => prev.filter((p) => p.id !== selectedPostId));
          }}
        />
      )}
    </div>
  );
}
