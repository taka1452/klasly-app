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

// Maps section titles to URL-safe slugs for anchor links
const SLUG_MAP: Record<string, string> = {
  // Owner
  "Getting Started": "getting-started",
  "Dashboard": "dashboard",
  "Members": "managing-members",
  "Instructors": "managing-instructors",
  "Classes": "classes",
  "Rooms": "rooms",
  "Bookings": "bookings",
  "Payments": "payments",
  "Settings": "settings",
  "Reports": "reports",
  "Schedule Visibility": "schedule-visibility",
  "Minor Waivers": "minor-waivers",
  "SOAP Notes": "soap-notes",
  "Traffic Sources (UTM Tracking)": "utm-tracking",
  "Studio Announcements": "updates-notifications",
  "Online Classes": "online-classes",
  "Feature Management": "feature-settings",
  "Referral Program": "referral-program",
  "Events & Retreats": "events-retreats",
  "Studio Passes": "studio-pass",
  "Mobile Access for Members": "mobile-access",
  "Updates & Notifications": "updates-notifications",
  // Member
  "Schedule & Booking": "member-booking",
  "My Bookings": "member-bookings",
  "Credits & Purchases": "member-credits",
  "Waiver & Account": "member-waiver",
  "Install the App": "member-install-app",
  "Updates": "member-updates",
  // Instructor
  "My Schedule": "instructor-schedule",
  "My Classes": "instructor-classes",
  "Room Bookings": "instructor-rooms",
  "Membership": "instructor-membership",
  "My Earnings": "instructor-earnings",
  "My Profile": "instructor-profile",
};

export function SectionBlock({ title, items, tab }: { title: string; items: HelpItem[]; tab?: string }) {
  const icon = ICON_MAP[title] || null;
  // For ambiguous titles shared across tabs, use a prefixed slug
  let slug = SLUG_MAP[title];
  if (title === "Getting Started" && tab === "member") slug = "member-getting-started";
  else if (title === "Getting Started" && tab === "instructor") slug = "instructor-getting-started";
  else if (title === "Dashboard" && tab === "instructor") slug = "instructor-dashboard";
  else if (title === "Payments" && tab === "member") slug = "member-payments";
  else if (title === "Events & Retreats" && tab === "member") slug = "member-events-retreats";
  else if (title === "Studio Passes" && tab === "member") slug = "member-studio-pass";

  return (
    <div
      id={slug}
      style={{
        background: "#fff",
        borderRadius: "10px",
        border: "1px solid #eaeaee",
        padding: "20px 24px",
        marginBottom: "12px",
        scrollMarginTop: "24px",
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
