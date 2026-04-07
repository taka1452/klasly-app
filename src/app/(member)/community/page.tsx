"use client";

import { useEffect, useState, useCallback } from "react";
import PostCard from "@/components/community/post-card";
import PostForm from "@/components/community/post-form";
import { createClient } from "@/lib/supabase/client";

type Post = {
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

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");

  const loadPosts = useCallback(async (sid: string) => {
    const res = await fetch(`/api/community/posts?studioId=${sid}`);
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("studio_id, role")
        .eq("id", user.id)
        .single();

      if (profile?.studio_id) {
        setStudioId(profile.studio_id);
        setUserRole(profile.role);
        loadPosts(profile.studio_id);
      }
    }
    init();
  }, [loadPosts]);

  const canPost = ["owner", "instructor", "manager"].includes(userRole);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Community</h1>
          <p className="mt-1 text-sm text-gray-500">
            Studio announcements and discussions
          </p>
        </div>
      </div>

      {canPost && studioId && (
        <div className="mt-4">
          <PostForm
            onCreated={() => {
              if (studioId) loadPosts(studioId);
            }}
          />
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="card">
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="card">
            <p className="text-sm text-gray-500">
              No posts yet. Check back later for updates from your studio.
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onRefresh={() => {
                if (studioId) loadPosts(studioId);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
