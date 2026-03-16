"use client";

import { DM_Sans } from "next/font/google";
import { useState, useMemo } from "react";
import { SECTIONS } from "@/components/help/help-data";
import { SectionBlock } from "@/components/help/help-section";
import { MailIcon, SearchIcon } from "@/components/help/help-icons";

const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

type Tab = "owner" | "instructor" | "member";

const TABS: { key: Tab; label: string }[] = [
  { key: "owner", label: "Studio Owners" },
  { key: "instructor", label: "Instructors" },
  { key: "member", label: "Members" },
];

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (typeof node === "object" && "props" in node) {
    return extractText((node as React.ReactElement).props.children);
  }
  return "";
}

export default function KlaslyHelp() {
  const [tab, setTab] = useState<Tab>("owner");
  const [search, setSearch] = useState("");

  const sections = SECTIONS[tab];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.q.toLowerCase().includes(q) ||
            section.title.toLowerCase().includes(q) ||
            extractText(item.a).toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, search]);

  return (
    <div
      className={dmSans.className}
      style={{
        minHeight: "100vh",
        background: "#f7f7fa",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#1a3a5c",
          padding: "44px 24px 52px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.4)",
            margin: "0 0 14px 0",
          }}
        >
          Help Center
        </p>
        <h1
          style={{
            fontSize: "clamp(26px, 4vw, 34px)",
            fontWeight: 700,
            color: "#fff",
            margin: "0 0 8px 0",
            lineHeight: 1.25,
          }}
        >
          How can we help?
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "rgba(255,255,255,0.55)",
            margin: 0,
          }}
        >
          Guides and answers for using Klasly
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          maxWidth: "680px",
          margin: "-24px auto 0",
          padding: "0 20px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            background: "#fff",
            borderRadius: "8px",
            border: "1px solid #e0e0e5",
            padding: "3px",
            boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setSearch("");
              }}
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "'DM Sans', sans-serif",
                background: tab === t.key ? "#1a3a5c" : "transparent",
                color: tab === t.key ? "#fff" : "#888",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Content */}
      <div
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "24px 20px 60px",
        }}
      >
        {/* Search */}
        <div
          style={{
            position: "relative",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#aaa",
              display: "flex",
              alignItems: "center",
            }}
          >
            <SearchIcon />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help topics..."
            style={{
              width: "100%",
              padding: "12px 14px 12px 40px",
              border: "1px solid #eaeaee",
              borderRadius: "8px",
              fontSize: "14px",
              fontFamily: "'DM Sans', sans-serif",
              background: "#fff",
              outline: "none",
              color: "#333",
              boxSizing: "border-box",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#aaa",
                fontSize: "16px",
                padding: "4px",
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          )}
        </div>

        {/* Sections */}
        {filtered.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: "10px",
              border: "1px solid #eaeaee",
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "14px", color: "#888", margin: 0 }}>
              No results found for &quot;{search}&quot;. Try a different search term.
            </p>
          </div>
        ) : (
          filtered.map((section, i) => (
            <SectionBlock
              key={`${tab}-${i}`}
              title={section.title}
              items={section.items}
            />
          ))
        )}

        {/* Contact */}
        <div
          style={{
            background: "#fff",
            borderRadius: "10px",
            border: "1px solid #eaeaee",
            padding: "24px",
            textAlign: "center",
            marginTop: "4px",
          }}
        >
          <p
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "#1a1a2e",
              margin: "0 0 4px 0",
            }}
          >
            Still need help?
          </p>
          <p
            style={{
              fontSize: "13.5px",
              color: "#888",
              margin: "0 0 16px 0",
            }}
          >
            We&apos;re happy to help with any questions.
          </p>
          <a
            href="mailto:support@klasly.app"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 22px",
              background: "#1a3a5c",
              color: "#fff",
              borderRadius: "7px",
              fontSize: "13.5px",
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <MailIcon />
            support@klasly.app
          </a>
        </div>
      </div>
    </div>
  );
}
