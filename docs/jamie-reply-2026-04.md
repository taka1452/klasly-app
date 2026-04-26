# Reply to Jamie — all 2026-04 feedback shipped

> Draft response to Jamie's 2026-04-24 feedback email. Plain-text / email-friendly
> — copy into Gmail.

---

Subject: Klasly: every item from your list is in

Hi Jamie,

Thanks again for the thorough list — really useful. Rather than staging this, I worked through everything in one push so you and Sarah can start playing with it today. Below is a walkthrough mapped to your email, then answers to your questions and the go-live checklist.

## Permissions (Settings → Managers)
Four new toggles on each manager's card so Sarah can grant them to you individually:
- **Class Pricing** — edit class prices / drop-in rates (separate from general *Classes* so we can let someone touch the schedule without prices).
- **Instructor Contracts & Membership Tiers** — hourly plans, flat / per-class fees, overage, membership tiers.
- **Tutorial** — whether this user sees Klasly's onboarding tooltips (see answer below).
- **Export Your Data** — CSV / PDF exports from Members, Bookings, Payments, Attendance, Waivers, Analytics.

Open your card in *Managers* and Sarah just flips the ones she wants.

## Instructors
- **Own schedule / bookings view** — already live. The instructor portal (Schedule / Sessions / Room bookings / Appointments) is instructor-scoped; they only ever see their own.
- **Monthly contracts + invoicing** — new *Settings → Monthly invoices* page. Pick a month, click *Generate for all instructors*, and Klasly creates a draft invoice per instructor bundling their tier subscription, overage charges, and flat/per-class fees. Review, add an adjustment if needed, *Send* to email it, *Mark paid* when payment arrives. Re-running the generator for the same month overwrites drafts (but never sent/paid invoices).

## Rooms
- **Admin "Add booking"** — new button at the top of the Rooms page. Pick the instructor, the room, date, start/end time, notes, *Create booking*. The booking appears on the instructor's own calendar exactly like one they made themselves. Use it for private sessions, workshop prep, or guest-teacher holds.

## Classes
- **Edit a scheduled session** — the *Upcoming Sessions* list on each class detail page now has an **Edit** button (pencil) next to *Cancel*. You can change the date, start/end time, or title of just that one session. Everything else in the series stays as-is — so your *Yin + Sound* fix is Edit the May 6 session, move it to May 7, done. Room conflict check runs on the new date.
- **Special instructions** — new field on the class template form. Text you put there shows on the member-facing class detail page and in booking confirmation emails.
- **Post-creation screen** — the "Class template created — Schedule now?" screen that felt like a dead end is reworded and gains a third option (*View class detail*) so it's no longer a two-way fork.

## Schedule / Events
- **Event color** — step 1 of Create Event now has a color picker (10 presets + custom hex). The color shows as a dot on your events list and as the accent color on the event card.

## Analytics
- **Report builder with saved reports** — new *Build & save reports* button on the Analytics page. Six built-in report types out of the gate:
 - Revenue over time
 - Class attendance
 - Instructor payouts
 - Member growth
 - Drop-in counts
 - Room utilization

 Tune the date range (last 7 / 30 / 90 days, month-based, custom), group by day / week / month, and optionally filter by instructor. Save it with a name, star favorites, and re-run with one click from the sidebar. *↓ CSV* exports the current chart.

## Forms & documents (applications, contracts, medical intake, multiple waivers)
New *Settings → Forms & documents* page. Click **+ New form** and pick a type — *Waiver*, *Application*, *Contract*, *Medical intake*, or *Custom* (blank). Each starts with a sensible field template you can tweak:
- Drag fields up/down, toggle required, change type, edit options, help text.
- Toggle active / public / require-signature.
- Copy the public link and put it on your website — submissions land back in Klasly.
- View all submissions per form and export CSV.

You can have as many as you like — one general waiver, one aerial waiver, one instructor application, one medical intake, etc.

## Online library + Google
- **Library memberships** — new *Settings → Online library*. Enroll members in *Basic* or *Premium* tiers at a monthly price; the table supports pause / resume / cancel. Published videos in your Library can be tagged *free*, *members*, or *premium* so only the right subscribers can watch. (Self-service Stripe Checkout enrollment is the next iteration — admin-enrollment unblocks you today.)
- **Integrations** — new *Settings → Integrations* lists Google Workspace, Mailchimp, Zoom. Click **Connect Google** to queue the OAuth handshake. Once it completes we sync Google Calendar events and use the connected email to match Google Pay / Wallet subscription charges to your library members. Jamie, I'll loop you in as soon as the OAuth callback is finalized on our end so we can do the first handshake together.

## Test Accounts — click feedback
The "nothing happens" problem is fixed. Clicking your own account now shows *"That's the account you're already signed in as"* inline (instead of silent no-op), any switch error shows as an inline red banner (some browsers suppressed the old alert), and if your studio has zero test accounts, the panel sends you straight to Settings to create them with a big Create test accounts → link.

## Answers to your questions

**Tutorial** — not a capability; it's a UX preference for whether this user sees Klasly's onboarding walkthrough: the dashboard checklist, first-time tooltips on each new page, and feature-highlight hint panels. Turn it **off** once someone knows the app so their UI stays clean. The Help Center is separate and always available.

**Account Switcher** — the person icon at the bottom-right of every page. Owners and managers with *Settings* permission click it to sign in as one of your studio's **test accounts** (test instructor / test member) so you can see what they see. Real members and instructors can't be impersonated.

**Test Accounts — how to set them up** — *Settings → Test Accounts* (in the Studio section). One card creates them automatically for your studio, mirroring each real role so you can preview from that angle.

## Ready to go live?

1. Confirm Stripe Connect is fully onboarded (*Settings → Payouts*).
2. Confirm the waiver template and any intake questions read the way you want them to.
3. If you want the Library live on day one, decide which videos you'll publish and at which tier (free / members / premium).
4. Pick a go-live date — I'd suggest a 2–3 day soft-launch window with members you trust before promoting publicly.

Tell me if end of next week feels right, or I'm happy to do a 30-minute screenshare to walk through the new features live before you start using them in anger.

Thanks again — this round makes Klasly better for every studio.

— Yudai
