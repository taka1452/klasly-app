# Reply to Jamie — Phase 1 changes (2026-04)

> Draft response to Jamie's 2026-04-24 feedback email. Plain-text / email-friendly
> — copy into Gmail. References to current-session code lines are only for
> Yudai's internal tracking.

---

Subject: Klasly updates + answers to your questions

Hi Jamie,

Thanks for the detailed list — really helpful. I worked through everything and here's where we stand. I've split your asks into three groups: (1) already shipped in this round, (2) bigger additions coming next, and (3) answers to your questions.

## 1. Changes I've just shipped

These go out in today's deploy:

**Permissions**
Four new toggles on each manager's card in *Managers*, so Sarah can grant them to you individually:
- **Class Pricing** — edit class prices, drop-in rates, promotional pricing (separate from the general *Classes* permission so you can let a manager edit the schedule without price changes).
- **Instructor Contracts & Membership Tiers** — hourly plans, flat / per-class fees, overage charges, and membership tiers.
- **Tutorial** — whether *this* user sees Klasly's onboarding tooltips (more on that in the answers below).
- **Export Your Data** — CSV / PDF exports from Members, Bookings, Payments, Attendance, Waivers, Analytics.
Sarah just needs to open your card in *Managers* and flip the ones she wants.

**Rooms — Add booking for instructors**
On the *Rooms* page there's now a **+ Add booking** button at the top. Pick the instructor, the room, date, start/end time, optional notes, then *Create booking*. The booking shows on the instructor's own calendar exactly like one they made themselves. Use it for private sessions, workshop prep, or guest-teacher holds.

**Classes — edit a scheduled session & special instructions**
Two things here:
- On the class detail page's *Upcoming Sessions* list, each session now has an **Edit** button (pencil icon) next to *Cancel*. Open it to change the date, start/end time, or title of just that one session. The rest of the series stays as-is. So for your *Yin + Sound* example, you'd Edit the May 6 session and move it to May 7 — no cancel-and-recreate.
- The class template form now has a **Special instructions** field. Anything you put there shows up on the member-facing class detail page and in their booking confirmation email.

**Class creation screen — cleared up**
You got that confusing "Class template created — Schedule now?" screen. I redesigned it: it now explains that the class you just created is a *template* (reusable definition), and you need to schedule sessions next. It offers three actions: *Schedule sessions*, *View class detail*, *Back to all classes*. Much less dead-end-y.

**Events — color option**
When creating or editing an event (retreat/workshop), *Step 1* now has a color picker — pick one of 10 presets or set a custom hex. The color shows as a dot next to the event on your events list and as the accent color on the event card.

**Test Accounts — click feedback**
I fixed the "nothing happens" problem. Clicking your own account in the list now shows *"That's the account you're already signed in as"* instead of silently doing nothing, and any switch error shows as an inline red banner instead of a browser alert (which some browsers suppress). If your studio has no test accounts, the panel now shows a big *Create test accounts →* link straight to Settings.

## 2. Bigger pieces — coming in the next rounds

These are real subsystems, not quick tweaks, so I'm scoping them separately. If you want me to push any of them ahead of the others, just tell me the order:

- **Instructor monthly contracts + invoicing** — the contract model is already in Klasly (hourly / flat / overage), but monthly invoice generation needs design. I'll come back with a spec.
- **Analytics report builder** — the kind of "pick metrics + dimensions + filters, save, re-run later" reports you described. Currently the Analytics page is dashboards only.
- **Forms & Documents builder** — one shared system for waivers, instructor applications, contracts, medical intake. Today we only ship a single waiver template per studio.
- **Online Library + Google integration** — paid memberships to an on-demand class library, with Google sign-in and payment tracking. This one touches auth, payments, and the member portal, so it's the biggest.

## 3. Answers to your questions

**What is "Tutorial"?** — It's the onboarding walkthrough: the dashboard checklist, first-time tooltips on each new page, and feature-highlight hint panels that appear when you open something for the first time. It's a UX preference, not a capability — turn it *off* for users who already know Klasly so their UI stays clean. Turning it off does **not** remove access to the Help Center; that's always available.

**What is "Account Switcher"?** — The little person icon at the bottom-right of every page. Owners and managers with *Settings* permission can click it to sign in as one of your studio's **test accounts** (test instructor / test member) to see exactly what they see. Real members and instructors can't be impersonated. It's the fastest way to answer "what does this look like from the member side?" without logging in and out.

**How do I set up test accounts? Why does nothing happen when I click one?** — Two parts:
1. *Setting them up:* **Settings → Test Accounts** (in the Studio section) — there's a card there that creates test accounts for your studio automatically. Each one mirrors a real role (instructor or member) so you can preview the app from that angle.
2. *Why nothing happened:* that was a bug on our end. Clicking your *own* account silently did nothing, and real (non-test) accounts also did nothing visibly. Both cases now show an inline message. Also, if your studio doesn't have test accounts yet, the panel now sends you straight to Settings to create them. I suspect that was what you were hitting.

## Ready to go live?

Your studio has been in a staging/preview mode while we dial things in. On my side, once this round lands we can start pointing your public booking URL at Klasly. The checklist to flip the switch:
1. Confirm Stripe Connect is fully onboarded (Settings → Payouts).
2. Confirm the waiver template and any intake questions read the way you want them to.
3. Pick a go-live date — I'd suggest giving yourself a 2-3 day soft-launch window with just members you trust before you promote it publicly.

Tell me if end of next week feels right, or if you'd like a call to walk through any of the new features live.

Thanks again for the quality feedback — it makes Klasly meaningfully better for every studio.

— Yudai
