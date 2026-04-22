"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { HelpCircle } from "lucide-react";
import Link from "next/link";

type HelpTipProps = {
  text: string;
  helpSlug?: string;
  side?: "top" | "right" | "bottom" | "left";
};

export default function HelpTip({
  text,
  helpSlug,
  side = "top",
}: HelpTipProps) {
  const [visible, setVisible] = useState(false);
  const [actualSide, setActualSide] = useState(side);
  const iconRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const adjustPosition = useCallback(() => {
    if (!iconRef.current || !tipRef.current) return;
    const iconRect = iconRef.current.getBoundingClientRect();
    const tipRect = tipRef.current.getBoundingClientRect();
    let resolved = side;

    // Check if tooltip overflows viewport and adjust
    if (side === "top" && iconRect.top - tipRect.height - 8 < 0) {
      resolved = "bottom";
    } else if (
      side === "bottom" &&
      iconRect.bottom + tipRect.height + 8 > window.innerHeight
    ) {
      resolved = "top";
    } else if (side === "left" && iconRect.left - tipRect.width - 8 < 0) {
      resolved = "right";
    } else if (
      side === "right" &&
      iconRect.right + tipRect.width + 8 > window.innerWidth
    ) {
      resolved = "left";
    }

    // Additional horizontal overflow check for top/bottom
    if (resolved === "top" || resolved === "bottom") {
      const tipLeft = iconRect.left + iconRect.width / 2 - tipRect.width / 2;
      if (tipLeft < 8) {
        tipRef.current.style.left = `${-iconRect.left + 8}px`;
        tipRef.current.style.transform =
          resolved === "top"
            ? "translateY(0)"
            : "translateY(0)";
      } else if (tipLeft + tipRect.width > window.innerWidth - 8) {
        const shift = tipLeft + tipRect.width - window.innerWidth + 8;
        tipRef.current.style.left = `${-shift}px`;
      }
    }

    setActualSide(resolved);
  }, [side]);

  useEffect(() => {
    if (visible) {
      adjustPosition();
    }
  }, [visible, adjustPosition]);

  // Close on outside click (mobile)
  useEffect(() => {
    if (!visible) return;
    function handleClick(e: MouseEvent) {
      if (
        iconRef.current &&
        !iconRef.current.contains(e.target as Node) &&
        tipRef.current &&
        !tipRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [visible]);

  const positionStyles: Record<string, React.CSSProperties> = {
    top: {
      bottom: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      marginBottom: "6px",
    },
    bottom: {
      top: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      marginTop: "6px",
    },
    left: {
      right: "100%",
      top: "50%",
      transform: "translateY(-50%)",
      marginRight: "6px",
    },
    right: {
      left: "100%",
      top: "50%",
      transform: "translateY(-50%)",
      marginLeft: "6px",
    },
  };

  const arrowStyles: Record<string, React.CSSProperties> = {
    top: {
      position: "absolute",
      bottom: "-4px",
      left: "50%",
      transform: "translateX(-50%) rotate(45deg)",
      width: "8px",
      height: "8px",
      background: "#111827",
    },
    bottom: {
      position: "absolute",
      top: "-4px",
      left: "50%",
      transform: "translateX(-50%) rotate(45deg)",
      width: "8px",
      height: "8px",
      background: "#111827",
    },
    left: {
      position: "absolute",
      right: "-4px",
      top: "50%",
      transform: "translateY(-50%) rotate(45deg)",
      width: "8px",
      height: "8px",
      background: "#111827",
    },
    right: {
      position: "absolute",
      left: "-4px",
      top: "50%",
      transform: "translateY(-50%) rotate(45deg)",
      width: "8px",
      height: "8px",
      background: "#111827",
    },
  };

  return (
    <span
      ref={iconRef}
      className="relative inline-flex ml-1 cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setVisible((v) => !v);
      }}
    >
      <HelpCircle className="h-4 w-4 text-gray-500 hover:text-gray-600 transition-colors" />

      {visible && (
        <div
          ref={tipRef}
          role="tooltip"
          style={{
            ...positionStyles[actualSide],
            position: "absolute",
            zIndex: 50,
            opacity: 1,
            animation: "helpTipFadeIn 150ms ease",
          }}
        >
          <div
            className="rounded-lg bg-gray-900 px-3 py-2 shadow-lg"
            style={{ maxWidth: "240px" }}
          >
            <p className="text-xs text-white leading-relaxed">{text}</p>
            {helpSlug && (
              <Link
                href={`/help#${helpSlug}`}
                className="mt-1 block text-xs text-blue-300 hover:text-blue-200 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Learn more →
              </Link>
            )}
            <span style={arrowStyles[actualSide]} />
          </div>
        </div>
      )}
    </span>
  );
}
