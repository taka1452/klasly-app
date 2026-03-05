"use client";

import { useState } from "react";

const SECTIONS = {
  owner: [
    {
      title: "Getting Started",
      items: [
        {
          q: "How do I set up my studio?",
          a: "After signing up, you'll be guided through onboarding: create your studio profile, choose a plan (30-day free trial included), and you're ready to go. You can start adding classes, instructors, and members right away from the Dashboard.",
        },
        {
          q: "How do I connect Stripe to receive payments?",
          a: 'Go to Settings → Stripe Connect and click "Connect with Stripe." You\'ll be redirected to Stripe\'s secure onboarding page to enter your business details and bank account. Once completed, member payments will go directly to your Stripe account.',
        },
        {
          q: "What is the free trial?",
          a: "Every new studio gets a 30-day free trial. You won't be charged until the trial ends. You can cancel anytime during the trial and pay nothing.",
        },
      ],
    },
    {
      title: "Managing Classes",
      items: [
        {
          q: "How do I create a class?",
          a: 'Go to Classes → "New Class." Enter the class name, description, capacity, and assign an instructor. Once created, you can add sessions (specific dates and times) from the class detail page.',
        },
        {
          q: "How do I add sessions to a class?",
          a: "Open a class from the Classes page, then add sessions with specific dates, start times, and capacity. Each session is a bookable time slot that members can reserve.",
        },
      ],
    },
    {
      title: "Managing Members",
      items: [
        {
          q: "How do I add members?",
          a: 'Go to Members → "New Member." Enter their name and email. They\'ll receive a link to set up their account and access the member portal.',
        },
        {
          q: "Can I import members in bulk?",
          a: "Yes. Go to Members → Import. Upload a CSV file with columns for name and email. The system will create accounts and send invitations automatically.",
        },
        {
          q: "How do member credits work?",
          a: "Members purchase credit packs or a monthly plan. Each class booking uses 1 credit. Monthly plan members have unlimited bookings. You can also adjust credits manually from the member detail page.",
        },
      ],
    },
    {
      title: "Managing Instructors",
      items: [
        {
          q: "How do I add an instructor?",
          a: 'Go to Instructors → "New Instructor." Enter their name and email. They\'ll receive a link to access their instructor dashboard where they can view assigned classes.',
        },
        {
          q: "What can instructors see?",
          a: "Instructors can see their assigned classes, session schedules, and the list of booked members for each session. They cannot access payment info, studio settings, or other instructors' schedules.",
        },
      ],
    },
    {
      title: "Bookings",
      items: [
        {
          q: "How do I view bookings for a session?",
          a: "Go to Bookings, then click on a session. You'll see all confirmed members and the waitlist. You can also cancel bookings on behalf of members from here.",
        },
        {
          q: "How does the waitlist work?",
          a: "When a session is full, new bookings go to the waitlist (first come, first served). If a confirmed member cancels, the first person on the waitlist is automatically promoted and notified by email.",
        },
      ],
    },
    {
      title: "Payments",
      items: [
        {
          q: "How do I set pricing?",
          a: "Go to Settings → Pricing. You can configure the prices for each plan type your studio offers.",
        },
        {
          q: "Where do member payments go?",
          a: "Once you've connected Stripe via Settings → Stripe Connect, payments go directly to your Stripe account. Stripe's standard processing fee applies.",
        },
        {
          q: "How do I view payment history?",
          a: "Go to Payments from the sidebar. You'll see all member payments with date, amount, type, and status.",
        },
      ],
    },
    {
      title: "Settings",
      items: [
        {
          q: "How do I manage my Klasly subscription?",
          a: "Go to Settings → Billing. You can view your current plan, switch between Monthly and Yearly, update your payment method, or cancel your subscription.",
        },
        {
          q: "What is the waiver feature?",
          a: "You can set up a digital waiver that members must agree to. Go to Settings → Waiver to create and customize your waiver.",
        },
      ],
    },
  ],
  member: [
    {
      title: "Getting Started",
      items: [
        {
          q: "How do I create my account?",
          a: "Your studio will send you an invitation via email. Click the link in the email to set up your account.",
        },
        {
          q: "How do I log in?",
          a: "Go to the login page and enter your email. You'll receive a magic link — click it to sign in. No password needed.",
        },
      ],
    },
    {
      title: "Booking Classes",
      items: [
        {
          q: "How do I book a class?",
          a: 'Go to Schedule to see available classes. Click "Book" on the session you want. You need at least 1 credit to book (unless you have an unlimited plan).',
        },
        {
          q: "What if a class is full?",
          a: "You can join the waitlist. If someone cancels, you'll be automatically moved to confirmed and notified by email.",
        },
        {
          q: "How do I cancel a booking?",
          a: 'Go to My Bookings and click "Cancel" on the booking you want to remove. Your credit will be returned.',
        },
        {
          q: "Where can I see my upcoming bookings?",
          a: "Go to My Bookings from the navigation menu. You'll see all your confirmed bookings and waitlisted sessions.",
        },
      ],
    },
    {
      title: "Credits & Payments",
      items: [
        {
          q: "How do I purchase credits?",
          a: "Go to Purchase from the navigation menu. Choose a plan, then complete the checkout through Stripe's secure payment page.",
        },
        {
          q: "What payment methods are accepted?",
          a: "All major credit and debit cards (Visa, Mastercard, American Express) are accepted through Stripe.",
        },
        {
          q: "Where can I see my payment history?",
          a: "Go to Payments from the navigation menu to see all past payments with dates, amounts, and status.",
        },
      ],
    },
    {
      title: "Troubleshooting",
      items: [
        {
          q: "I didn't receive the login email",
          a: "Check your spam or junk folder. If you still don't see it, try requesting a new link. If the problem persists, contact support.",
        },
        {
          q: "My credits seem incorrect",
          a: "Each booking uses 1 credit. Cancelling a booking returns the credit. If you believe there's an error, reach out to support.",
        },
        {
          q: "I was charged but my payment doesn't appear",
          a: "Payments may take a few moments to appear in your history. If it still doesn't show after a few minutes, contact support.",
        },
      ],
    },
  ],
};

const ICON_MAP: Record<string, React.ReactNode> = {
  "Getting Started": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 16 16 12 12 8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
  ),
  "Managing Classes": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  "Managing Members": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  "Managing Instructors": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  Bookings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  ),
  "Booking Classes": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
  ),
  Payments: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
  ),
  "Credits & Payments": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
  ),
  Settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
  Troubleshooting: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
};

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.2s ease",
        flexShrink: 0,
        color: "#999",
      }}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AccordionItem({ question, answer }: { question: string; answer: string }) {
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
          maxHeight: open ? "400px" : "0",
          overflow: "hidden",
          transition: "max-height 0.25s ease",
        }}
      >
        <p
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
        </p>
      </div>
    </div>
  );
}

function SectionBlock({ title, items }: { title: string; items: { q: string; a: string }[] }) {
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

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

export default function KlaslyHelp() {
  const [tab, setTab] = useState<"owner" | "member">("owner");
  const sections = SECTIONS[tab];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f7fa",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

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
          {[
            { key: "owner" as const, label: "Studio Owners" },
            { key: "member" as const, label: "Members" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                padding: "10px 16px",
                border: "none",
                borderRadius: "6px",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "'DM Sans', sans-serif",
                background: tab === t.key ? "#1a3a5c" : "transparent",
                color: tab === t.key ? "#fff" : "#888",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "24px 20px 60px",
        }}
      >
        {sections.map((section, i) => (
          <SectionBlock
            key={`${tab}-${i}`}
            title={section.title}
            items={section.items}
          />
        ))}

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
