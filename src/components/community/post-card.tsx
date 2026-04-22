"use client";

import { useState } from "react";
import CommentSection from "./comment-section";

type PostCardProps = {
  post: {
    id: string;
    title: string;
    content: string;
    author_role: string;
    created_at: string;
    profiles: { full_name: string } | { full_name: string }[] | null;
    community_comments: {
      id: string;
      content: string;
      author_role: string;
      created_at: string;
      profiles: { full_name: string } | { full_name: string }[] | null;
    }[];
  };
  onRefresh: () => void;
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PostCard({ post, onRefresh }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  const authorName = profile?.full_name || "User";
  const commentCount = post.community_comments?.length || 0;

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{post.title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {authorName} {getRoleBadge(post.author_role)} · {timeAgo(post.created_at)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{post.content}</p>

      <button
        onClick={() => setShowComments(!showComments)}
        className="mt-2 text-xs text-gray-500 hover:text-gray-700"
      >
        {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? "s" : ""}` : "Comment"}
      </button>

      {showComments && (
        <CommentSection
          postId={post.id}
          comments={post.community_comments || []}
          onCommentAdded={onRefresh}
        />
      )}
    </div>
  );
}
