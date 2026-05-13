import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Reply, Trash2, Send, X } from "lucide-react";
import { discussionApi, getStoredUser } from "@/lib/api";
import type {
  DiscussionCommentWithReplies,
  DiscussionComment,
  User,
} from "@/lib/types";

interface DiscussionCardProps {
  quizId: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  const years = Math.floor(months / 12);
  return `${years} 年前`;
}

function CommentItem({
  comment,
  currentUser,
  onDelete,
  onReply,
  isReply = false,
}: {
  comment: DiscussionComment;
  currentUser: User | null;
  onDelete: (id: string) => void;
  onReply: (comment: DiscussionComment) => void;
  isReply?: boolean;
}) {
  const isOwner = currentUser && comment.user_id === currentUser.id;
  const displayName = comment.username || "匿名用户";
  const fallback = displayName.charAt(0).toUpperCase();

  return (
    <div className={`flex gap-3 ${isReply ? "ml-10" : ""}`}>
      <Avatar size="sm" className="mt-0.5 shrink-0">
        {comment.avatar_url && <AvatarImage src={comment.avatar_url} alt={displayName} />}
        <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{displayName}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {!isReply && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              onClick={() => onReply(comment)}
            >
              <Reply size={12} />
              回复
            </button>
          )}
          {isOwner && (
            <button
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              onClick={() => onDelete(comment.id)}
            >
              <Trash2 size={12} />
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DiscussionCard({ quizId }: DiscussionCardProps) {
  const [comments, setComments] = useState<DiscussionCommentWithReplies[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<DiscussionComment | null>(null);
  const [currentUser] = useState<User | null>(() => getStoredUser());

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await discussionApi.getComments(quizId);
      setComments(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async () => {
    const content = newContent.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    try {
      await discussionApi.createComment(quizId, {
        content,
        parent_id: replyTo?.id ?? undefined,
      });
      setNewContent("");
      setReplyTo(null);
      await loadComments();
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await discussionApi.deleteComment(quizId, commentId);
      await loadComments();
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const handleReply = (comment: DiscussionComment) => {
    setReplyTo(comment);
    setNewContent(`@${comment.username || "匿名用户"} `);
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle size={18} />
          讨论 ({total})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground py-2">加载中...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">暂无讨论，来发表第一条评论吧</p>
        ) : (
          <div className="space-y-4">
            {comments.map((item) => (
              <div key={item.id}>
                <CommentItem
                  comment={item}
                  currentUser={currentUser}
                  onDelete={handleDelete}
                  onReply={handleReply}
                />
                {item.replies.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {item.replies.map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        currentUser={currentUser}
                        onDelete={handleDelete}
                        onReply={handleReply}
                        isReply
                      />
                    ))}
                  </div>
                )}
                <Separator className="mt-4" />
              </div>
            ))}
          </div>
        )}

        {currentUser && (
          <div className="space-y-2 pt-2">
            {replyTo && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Reply size={12} />
                <span>回复 {replyTo.username || "匿名用户"}</span>
                <button onClick={() => { setReplyTo(null); setNewContent(""); }}>
                  <X size={12} className="hover:text-foreground" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={replyTo ? `回复 ${replyTo.username || "匿名用户"}...` : "发表评论..."}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!newContent.trim() || submitting}
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
