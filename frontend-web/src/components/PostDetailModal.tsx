'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getPostDetail, getComments, toggleLike, createComment,
  deleteComment, deletePost, reportContent, getUserProfile,
  Post, Comment, UserProfile,
} from '@/services/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import ReportModal from '@/components/ReportModal';
import UserProfilePopup from '@/components/UserProfilePopup';

const POST_REPORT_TYPES = [
  '욕설 / 비방',
  '스팸 / 도배',
  '부적절한 내용',
  '허위 정보',
  '기타',
];

interface Props {
  postId: string;
  idToken: string;
  currentUserId: string;
  onClose: () => void;
  onDeleted: () => void;
  inline?: boolean;
  onPostUpdate?: (postId: string, updates: { likeCount?: number; likedByMe?: boolean; commentCount?: number }) => void;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function CommentItem({
  comment, depth, currentUserId, idToken, postId,
  onReply, onDeleted, onReport, onAuthorClick,
}: {
  comment: Comment;
  depth: number;
  currentUserId: string;
  idToken: string;
  postId: string;
  onReply: (id: string, name: string) => void;
  onDeleted: (id: string) => void;
  onReport: (commentId: string) => void;
  onAuthorClick: (userId: string) => void;
}) {
  const isMe = comment.userId === currentUserId;
  return (
    <div style={{ marginLeft: depth * 16 }} className="mt-3">
      <div className="flex gap-2">
        <div className="w-7 h-7 rounded-full bg-orange-100 border border-orange-200 shrink-0 flex items-center justify-center text-xs font-bold text-orange-500">
          {comment.displayName.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAuthorClick(comment.userId)}
              className="text-xs font-bold text-gray-800 hover:text-orange-500 transition-colors"
            >
              {comment.displayName}
            </button>
            <span className="text-[10px] text-gray-400">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-700 mt-0.5 leading-snug break-words whitespace-pre-wrap">{comment.content}</p>
          <div className="flex gap-3 mt-1">
            <button
              onClick={() => onReply(comment.id, comment.displayName)}
              className="text-[11px] text-orange-500 font-semibold"
            >답글</button>
            {!isMe && (
              <button onClick={() => onReport(comment.id)} className="text-[11px] text-gray-400">신고</button>
            )}
            {isMe && (
              <button onClick={() => onDeleted(comment.id)} className="text-[11px] text-red-400">삭제</button>
            )}
          </div>
        </div>
      </div>
      {comment.replies.map((r) => (
        <CommentItem
          key={r.id}
          comment={r}
          depth={depth + 1}
          currentUserId={currentUserId}
          idToken={idToken}
          postId={postId}
          onReply={onReply}
          onDeleted={onDeleted}
          onReport={onReport}
          onAuthorClick={onAuthorClick}
        />
      ))}
    </div>
  );
}

function PostDetailContent({
  post, comments, input, replyTo, imageIdx, submitting, isMyPost,
  currentUserId, idToken, lightboxOpen,
  onClose, onDeletePost, onLike, onReport, onSubmitComment,
  onDeleteComment, onReplySet, onReplyCancel, onImageIdx, onInputChange, onKeyDown,
  onImageClick, onLightboxClose, onAuthorClick,
}: {
  post: Post;
  comments: Comment[];
  input: string;
  replyTo: { id: string; name: string } | null;
  imageIdx: number;
  submitting: boolean;
  isMyPost: boolean;
  currentUserId: string;
  idToken: string;
  lightboxOpen: boolean;
  onClose: () => void;
  onDeletePost: () => void;
  onLike: () => void;
  onReport: (commentId?: string) => void;
  onSubmitComment: () => void;
  onDeleteComment: (id: string) => void;
  onReplySet: (id: string, name: string) => void;
  onReplyCancel: () => void;
  onImageIdx: (i: number) => void;
  onInputChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onImageClick: () => void;
  onLightboxClose: () => void;
  onAuthorClick: (userId: string) => void;
}) {
  const actionBtnClass = "shrink-0 px-3 h-8 rounded-full text-white text-xs font-bold border transition-colors";

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-base hover:bg-gray-200 transition-colors"
        >
          ←
        </button>
        <div className="flex gap-2">
          {!isMyPost && (
            <button
              onClick={() => onReport()}
              className={actionBtnClass}
              style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)', borderColor: 'transparent' }}
            >신고</button>
          )}
          {isMyPost && (
            <button
              onClick={onDeletePost}
              className={actionBtnClass}
              style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)', borderColor: 'transparent' }}
            >삭제</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 이미지 */}
        {post.images.length > 0 && (
          <div className="relative bg-gray-100 aspect-video">
            <img
              src={post.images[imageIdx]?.url}
              alt=""
              className="w-full h-full object-cover cursor-pointer"
              onClick={onImageClick}
            />
            {/* 화살표 버튼 */}
            {post.images.length > 1 && (
              <>
                <button
                  onClick={() => onImageIdx((imageIdx - 1 + post.images.length) % post.images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center text-sm hover:bg-black/60 transition-colors"
                >
                  ‹
                </button>
                <button
                  onClick={() => onImageIdx((imageIdx + 1) % post.images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center text-sm hover:bg-black/60 transition-colors"
                >
                  ›
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {post.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => onImageIdx(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imageIdx ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="px-5 py-4">
          {/* 작성자 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-sm font-bold text-orange-500">
              {post.displayName.slice(0, 1)}
            </div>
            <div>
              <button
                onClick={() => onAuthorClick(post.userId)}
                className="text-sm font-bold text-gray-800 hover:text-orange-500 transition-colors"
              >
                {post.displayName}
              </button>
              <p className="text-[10px] text-gray-400">{timeAgo(post.createdAt)}</p>
            </div>
          </div>

          <h2 className="text-base font-bold text-gray-900 mb-2 break-words">{post.title}</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${post.likedByMe ? 'text-orange-500' : 'text-gray-400'}`}
            >
              <span className="text-base">{post.likedByMe ? '❤️' : '🤍'}</span>
              {post.likeCount}
            </button>
            <span className="flex items-center gap-1.5 text-sm text-gray-400">
              <span>{'💬'}</span>{post.commentCount}
            </span>
          </div>
        </div>

        <div className="px-5 pb-4 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-500 pt-4 mb-2">댓글 {comments.length}개</p>
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              depth={0}
              currentUserId={currentUserId}
              idToken={idToken}
              postId={post.id}
              onReply={onReplySet}
              onDeleted={onDeleteComment}
              onReport={(commentId) => onReport(commentId)}
              onAuthorClick={onAuthorClick}
            />
          ))}
        </div>
      </div>

      {/* 댓글 입력 */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-orange-50 rounded-xl">
            <span className="text-xs text-orange-600 flex-1">{'↩'} {replyTo.name}에게 답글</span>
            <button onClick={onReplyCancel} className="text-[10px] text-gray-400">취소</button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={300}
              placeholder="댓글을 입력하세요... (300자 이내)"
              rows={1}
              className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 resize-none"
            />
            {input.length > 0 && (
              <p className={`text-right text-[10px] mt-0.5 ${input.length >= 280 ? 'text-orange-500' : 'text-gray-400'}`}>
                {input.length}/300자
              </p>
            )}
          </div>
          <button
            onClick={onSubmitComment}
            disabled={!input.trim() || submitting}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white disabled:opacity-40 shrink-0"
            style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
          >
            {submitting
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <span>{'↑'}</span>}
          </button>
        </div>
      </div>

      {/* 이미지 원본 lightbox */}
      {lightboxOpen && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90"
          onClick={onLightboxClose}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white text-lg hover:bg-white/30 transition-colors"
            onClick={onLightboxClose}
          >✕</button>
          {post.images.length > 1 && (
            <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
              {imageIdx + 1} / {post.images.length}
            </span>
          )}
          <img
            src={post.images[imageIdx]?.url}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

export default function PostDetailModal({ postId, idToken, currentUserId, onClose, onDeleted, inline, onPostUpdate }: Props) {
  const [post, setPost]         = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput]       = useState('');
  const [replyTo, setReplyTo]   = useState<{ id: string; name: string } | null>(null);
  const [imageIdx, setImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingPostDelete, setPendingPostDelete] = useState(false);
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ commentId?: string } | null>(null);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);

  const loadPost = useCallback(async () => {
    const [postRes, commentsRes] = await Promise.all([
      getPostDetail(postId, idToken),
      getComments(postId, idToken),
    ]);
    if (postRes.success && postRes.data) setPost(postRes.data);
    if (commentsRes.success && commentsRes.data) setComments(commentsRes.data);
  }, [postId, idToken]);

  useEffect(() => { loadPost(); }, [loadPost]);

  const handleLike = async () => {
    if (!post) return;
    const res = await toggleLike(postId, idToken);
    if (res.success && res.data) {
      const { liked, likeCount } = res.data;
      setPost((p) => p ? { ...p, likedByMe: liked, likeCount } : p);
      onPostUpdate?.(postId, { likedByMe: liked, likeCount });
    }
  };

  const handleSubmitComment = async () => {
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await createComment(postId, { parentId: replyTo?.id, content: input.trim() }, idToken);
      if (res.success) {
        setInput('');
        setReplyTo(null);
        const prevCount = post?.commentCount ?? 0;
        await loadPost();
        onPostUpdate?.(postId, { commentCount: prevCount + 1 });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    setPendingCommentId(commentId);
  };

  const confirmDeleteComment = async () => {
    if (!pendingCommentId) return;
    const id = pendingCommentId;
    setPendingCommentId(null);
    const prevCount = post?.commentCount ?? 0;
    await deleteComment(postId, id, idToken);
    await loadPost();
    onPostUpdate?.(postId, { commentCount: Math.max(0, prevCount - 1) });
  };

  const handleDeletePost = () => {
    if (!post || post.userId !== currentUserId) return;
    setPendingPostDelete(true);
  };

  const confirmDeletePost = async () => {
    setPendingPostDelete(false);
    await deletePost(postId, idToken);
    onDeleted();
  };

  const handleReport = (commentId?: string) => {
    setReportTarget({ commentId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); }
  };

  const handleAuthorClick = async (userId: string) => {
    if (userId === currentUserId) return;
    const res = await getUserProfile(userId, idToken);
    if (res.success && res.data) setViewingProfile(res.data);
  };

  if (!post) {
    if (inline) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>;
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /></div>;
  }

  const isMyPost = post.userId === currentUserId;
  const contentProps = {
    post, comments, input, replyTo, imageIdx, submitting, isMyPost,
    currentUserId, idToken, lightboxOpen,
    onClose, onDeletePost: handleDeletePost, onLike: handleLike,
    onReport: handleReport, onSubmitComment: handleSubmitComment,
    onDeleteComment: handleDeleteComment,
    onReplySet: (id: string, name: string) => setReplyTo({ id, name }),
    onReplyCancel: () => setReplyTo(null),
    onImageIdx: setImageIdx,
    onInputChange: setInput,
    onKeyDown: handleKeyDown,
    onImageClick: () => setLightboxOpen(true),
    onLightboxClose: () => setLightboxOpen(false),
    onAuthorClick: handleAuthorClick,
  };

  const confirmDialogs = (
    <>
      {pendingPostDelete && createPortal(
        <ConfirmDialog
          message="게시글을 삭제하시겠습니까?"
          confirmLabel="삭제"
          onConfirm={confirmDeletePost}
          onCancel={() => setPendingPostDelete(false)}
        />,
        document.body,
      )}
      {pendingCommentId && createPortal(
        <ConfirmDialog
          message="댓글을 삭제하시겠습니까?"
          confirmLabel="삭제"
          onConfirm={confirmDeleteComment}
          onCancel={() => setPendingCommentId(null)}
        />,
        document.body,
      )}
      {reportTarget !== null && (
        <ReportModal
          targetName={reportTarget.commentId ? '댓글' : '이 게시글'}
          reportTypes={POST_REPORT_TYPES}
          onSubmit={async (reason) => {
            await reportContent(
              { postId: reportTarget.commentId ? undefined : postId, commentId: reportTarget.commentId, reason },
              idToken,
            );
          }}
          onClose={() => setReportTarget(null)}
        />
      )}
      {viewingProfile && (
        <UserProfilePopup
          profile={viewingProfile}
          onClose={() => setViewingProfile(null)}
        />
      )}
    </>
  );

  if (inline) {
    return (
      <div className="flex flex-col h-full bg-white rounded-3xl overflow-hidden">
        <PostDetailContent {...contentProps} />
        {confirmDialogs}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">
        <PostDetailContent {...contentProps} />
      </div>
      {confirmDialogs}
    </div>
  );
}
