"use client";

import { useState, useCallback } from "react";
import { Heart } from "lucide-react";

type FavoriteButtonProps = {
  favoriteType: "class" | "instructor";
  targetId: string;
  isFavorited: boolean;
  onToggle?: (isFavorited: boolean) => void;
  size?: "sm" | "md";
};

export default function FavoriteButton({
  favoriteType,
  targetId,
  isFavorited: initialFavorited,
  onToggle,
  size = "sm",
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    const newState = !isFavorited;

    // Optimistic update
    setIsFavorited(newState);

    try {
      if (newState) {
        const res = await fetch("/api/member/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorite_type: favoriteType, target_id: targetId }),
        });
        if (!res.ok) {
          setIsFavorited(!newState); // Revert
          return;
        }
      } else {
        const res = await fetch(
          `/api/member/favorites?favorite_type=${favoriteType}&target_id=${targetId}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          setIsFavorited(!newState); // Revert
          return;
        }
      }
      onToggle?.(newState);
    } catch {
      setIsFavorited(!newState); // Revert on error
    } finally {
      setIsLoading(false);
    }
  }, [isFavorited, isLoading, favoriteType, targetId, onToggle]);

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle();
      }}
      disabled={isLoading}
      className={`inline-flex items-center justify-center rounded-full p-1 transition-colors ${
        isFavorited
          ? "text-red-500 hover:text-red-600"
          : "text-gray-300 hover:text-red-400"
      } ${isLoading ? "opacity-50" : ""}`}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={iconSize}
        fill={isFavorited ? "currentColor" : "none"}
      />
    </button>
  );
}
