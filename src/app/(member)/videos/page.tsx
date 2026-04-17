"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Video = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  price: number;
  created_at: string;
  instructors: { profiles: { full_name: string } | { full_name: string }[] } | { profiles: { full_name: string } | { full_name: string }[] }[] | null;
  classes: { name: string } | { name: string }[] | null;
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("studio_id")
        .eq("id", user.id)
        .single();

      if (!profile?.studio_id) return;

      const res = await fetch(`/api/videos?studioId=${profile.studio_id}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Videos</h1>
      <p className="mt-1 text-sm text-gray-500">
        Watch recorded classes and on-demand content
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="card col-span-full">
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="card col-span-full">
            <p className="text-sm text-gray-500">
              No videos available yet. Check back later!
            </p>
          </div>
        ) : (
          videos.map((v) => {
            const instructor = Array.isArray(v.instructors) ? v.instructors[0] : v.instructors;
            const profile = instructor
              ? (Array.isArray(instructor.profiles) ? instructor.profiles[0] : instructor.profiles)
              : null;
            const instructorName = profile?.full_name || "";
            const cls = Array.isArray(v.classes) ? v.classes[0] : v.classes;
            const className = cls?.name || "";

            return (
              <div key={v.id} className="card overflow-hidden">
                {v.thumbnail_url ? (
                  <div className="relative aspect-video bg-gray-100 -mx-4 -mt-4 mb-3">
                    <Image
                      src={v.thumbnail_url}
                      alt={v.title}
                      fill
                      className="object-cover"
                      loading="lazy"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-100 -mx-4 -mt-4 mb-3 flex items-center justify-center">
                    <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                )}
                <h3 className="font-semibold text-gray-900">{v.title}</h3>
                {v.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{v.description}</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  {instructorName && <span>{instructorName}</span>}
                  {className && <span>· {className}</span>}
                  {v.duration && <span>· {formatDuration(v.duration)}</span>}
                </div>
                <div className="mt-3">
                  {v.price === 0 ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Free
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-gray-900">
                      ${(v.price / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
