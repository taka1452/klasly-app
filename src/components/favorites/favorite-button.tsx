"use client";

import { useState } from "react";

type FavoriteButtonProps = {
  favoriteType: "class" | "instructor";
  targetId: string;
  isFavorited: boolean;
};

export default function FavoriteButton({
  favoriteType,
  targetId,
  isFavorited: initialFavorited,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favoriteType, targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFavorited(data.favorited);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="text-gray-500 hover:text-red-500 transition-colors"
      title={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <svg
        className={`h-5 w-5 ${favorited ? "text-red-500 fill-current" : ""}`}
        fill={favorited ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
}
