"use client";

import { useState } from "react";

type Comment = {
  id: string;
  content: string;
  author_role: string;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

type CommentSectionProps = {
  postId: string;
  comments: Comment[];
  onCommentAdded: () => void;
};

function getRoleBadge(role: string) {
  switch (role) {
    case "owner":
      return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Owner</span>;
    case "instructor":
      return <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Instructor</span>;
    case "manager":
      return <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">Manager</span>;
    default:
      return null;
  }
}

export default function CommentSection({ postId, comments, onCommentAdded }: CommentSectionProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content: content.trim() }),
      });
      if (res.ok) {
        setContent("");
        onCommentAdded();
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {comments.length > 0 && (
        <div className="space-y-2 mb-3">
          {comments.map((c) => {
            const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            const name = profile?.full_name || "User";
            return (
              <div key={c.id} className="text-sm">
                <span className="font-medium text-gray-900">{name}</span>
                {" "}
                {getRoleBadge(c.author_role)}
                <p className="text-gray-600 mt-0.5">{c.content}</p>
              </div>
            );
          })}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          className="input-field flex-1 text-sm"
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
        />
        <button
          type="submit"
          className="btn-primary text-sm px-3"
          disabled={loading || !content.trim()}
        >
          Reply
        </button>
      </form>
    </div>
  );
}
