"use client";

import { useEffect, useState } from "react";

const PETALS = [
  { emoji: "🌸", delay: 0 },
  { emoji: "🌼", delay: 60 },
  { emoji: "🌺", delay: 120 },
  { emoji: "🌷", delay: 40 },
  { emoji: "🌻", delay: 100 },
  { emoji: "✨", delay: 80 },
];

export default function FlowerBurst({ trigger }: { trigger: boolean }) {
  const [particles, setParticles] = useState<
    { id: number; emoji: string; x: number; y: number; angle: number; delay: number }[]
  >([]);

  useEffect(() => {
    if (!trigger) return;

    const newParticles = PETALS.map((p, i) => ({
      id: Date.now() + i,
      emoji: p.emoji,
      x: (Math.random() - 0.5) * 60,
      y: (Math.random() - 0.5) * 40 - 20,
      angle: (i / PETALS.length) * 360,
      delay: p.delay,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 1200);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute left-1/2 top-1/2 animate-flower-pop"
          style={{
            "--tx": `${p.x}px`,
            "--ty": `${p.y}px`,
            animationDelay: `${p.delay}ms`,
            fontSize: "14px",
            opacity: 0,
          } as React.CSSProperties}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
