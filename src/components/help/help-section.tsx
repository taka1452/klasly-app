"use client";

import React, { useState } from "react";
import { ChevronDown } from "./help-icons";
import { ICON_MAP } from "./help-icons";

export type HelpItem = {
  q: string;
  a: React.ReactNode;
  searchText?: string;
};

export type HelpSection = {
  title: string;
  items: HelpItem[];
};

export function AccordionItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #f0f0f3" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          padding: "14px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontSize: "14px",
          fontWeight: 500,
          color: open ? "#1a3a5c" : "#333",
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.45,
          transition: "color 0.15s ease",
        }}
      >
        <span>{question}</span>
        <ChevronDown open={open} />
      </button>
      <div
        style={{
          maxHeight: open ? "600px" : "0",
          overflow: "hidden",
          transition: "max-height 0.25s ease",
        }}
      >
        <div
          style={{
            padding: "0 0 14px 0",
            margin: 0,
            fontSize: "13.5px",
            lineHeight: 1.75,
            color: "#666",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {answer}
        </div>
      </div>
    </div>
  );
}

export function SectionBlock({ title, items }: { title: string; items: HelpItem[] }) {
  const icon = ICON_MAP[title] || null;
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "10px",
        border: "1px solid #eaeaee",
        padding: "20px 24px",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "2px",
          color: "#1a3a5c",
        }}
      >
        {icon}
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "#1a1a2e",
            margin: 0,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {title}
        </h3>
      </div>
      <div>
        {items.map((item, i) => (
          <AccordionItem key={i} question={item.q} answer={item.a} />
        ))}
      </div>
    </div>
  );
}
