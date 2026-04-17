"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  images: string[];
  eventName: string;
};

export default function EventGallery({ images, eventName }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  return (
    <>
      {/* Grid gallery */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelectedIndex(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Image
              src={url}
              alt={`${eventName} photo ${i + 1}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setSelectedIndex(null)}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : images.length - 1);
            }}
            className="absolute left-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            aria-label="Previous"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[selectedIndex]}
              alt={`${eventName} photo ${selectedIndex + 1}`}
              width={1600}
              height={1200}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
              sizes="90vw"
              priority
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedIndex(selectedIndex < images.length - 1 ? selectedIndex + 1 : 0);
            }}
            className="absolute right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            aria-label="Next"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-4 text-sm text-white/80">
            {selectedIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
