# Email to Jamie — 2026-05-16 (round 2)

**To:** jamie@theelizabethpdx.com
**Cc:** Sarah@theelizabethpdx.com
**Subject:** Re: More Requests — round 2 updates
**Reply to thread:** "More Requests" (5/14)

---

Hi Jamie (and Sarah),

Round 2 is in. Picked up everything from last week plus a handful of quality-of-life additions you didn't ask for but I think you'll like. Rundown below in the same shape as last time.


=== NEW FEATURES ===

**Per-template waiver re-sign requests** — Settings → Waiver now has a "Send a specific waiver to members" panel when you have more than one active waiver. Pick the template, hit Send, and Klasly emails every active member who hasn't signed THAT waiver. Members who already signed (or who already have a pending invite) are skipped automatically.
→ [https://app.klasly.app/settings/waiver](https://app.klasly.app/settings/waiver)

**Sign-waiver modal at checkout** — When a member tries to book a class that requires a waiver they haven't signed, Klasly opens an in-place modal showing the waiver content. They check Agree, type their name, and the booking continues right after. No more "go sign first, then come back".
No setup needed — kicks in automatically for any class with Required Waivers configured.

**Class reminder emails (24h and 1h before)** — Every confirmed booking now gets two automatic reminders: a "See you tomorrow" the day before, and a "Starting in about an hour" right before. No setup needed. Each booking gets exactly one of each — never duplicated. Same body template as your confirmation emails so any customization carries through.
→ Customize wording: [https://app.klasly.app/settings/confirmation-emails](https://app.klasly.app/settings/confirmation-emails)

**Send-test for confirmation emails** — Each section on the Confirmation Emails settings page has a "Send test to me" link in the top-right. Click it and Klasly emails a preview to your owner address using sample variables. Iterate without bothering real members.
→ [https://app.klasly.app/settings/confirmation-emails](https://app.klasly.app/settings/confirmation-emails)

**Pass renewal reminders** — Members get an automatic email 7 days before their pass expires and again on the expiry day. Stripe-renewing monthly subs are skipped (Stripe handles those); class packs and drop-ins get the nudge so they can re-purchase before they lose access.
No setup needed.

**Same-email role-switcher** — Owners and managers can now add themselves as an instructor using their existing email without getting locked out. The sidebar grows "My Classes" and "My Earnings" links automatically once you have an instructors record. (Background fix for the Cannot Log In issue you flagged a couple weeks ago — Jamie, your account is unblocked.)

**Instructor 80% hour-usage alert** — Instructors on a tiered hourly plan now get an automatic heads-up email when they've used 80% of their monthly hour pool, with remaining hours and (when applicable) the projected overage charge. Fires once per month per instructor. Helps people self-pace before month-end.
No setup needed.

**Members tag filter + bulk email** — On the Members page, when any members have tags (from the new CSV Tags column or set manually), a Tag dropdown appears next to the Status filter. Pick a tag → a blue "Email these members" bar appears. Type subject + body (variables: `{memberName}`, `{studioName}`), hit Send, every tagged active member gets a personalized copy.
→ [https://app.klasly.app/members](https://app.klasly.app/members)

**Member pass freeze / vacation hold** — Members can now pause their own pass from My Passes. They pick the date they want to come back, bookings are blocked while paused, and the pass expiry gets pushed forward by the held days when they resume (so they don't lose what they paid for). You can intercept holds longer than the current period if needed.
→ Member-facing: [https://app.klasly.app/my-passes](https://app.klasly.app/my-passes)

**Pass gifting (class packs only)** — Members with a class pack can gift remaining classes to another member at your studio. They enter the recipient's email + count + a short message; the count is subtracted from their pass immediately so they can't double-spend. The recipient sees a Pending Gifts card on their My Passes page with a Claim button. Senders can revoke before redemption — classes come back.
→ Member-facing: [https://app.klasly.app/my-passes](https://app.klasly.app/my-passes)


=== ALREADY AVAILABLE (related but worth noting) ===

**Settings discoverability** — Confirmation Emails and Discount Codes have their own cards on the Settings page now. Last batch they were direct URLs only.
→ [https://app.klasly.app/settings](https://app.klasly.app/settings)


=== STILL TO COME (not yet implemented) ===

A handful of polish features remain on my list but are de-prioritized until you've kicked the tires on this round. Flag if any feel urgent:

- Discount code analytics (monthly total, top codes by usage)
- Bulk-generate one-time codes for marketing campaigns
- Waiver versioning with auto-resign request when waiver content changes
- Pay-it-forward / tip-jar option on sliding-scale classes


=== QUICK SANITY CHECK ===

When you have a minute:

1. Open Settings → Confirmation emails, tweak the class subject, click "Send test to me" — preview should hit your inbox in seconds with sample variables filled in.
2. Add a tag like "veteran" to one or two members (Members → click a member to edit — or use the Tags column when you next import). Then on /members, pick that tag from the dropdown and try the bulk-email bar.
3. As a test member, book a class that requires a waiver — should open a modal rather than throwing an error.
4. Add Jamie to your instructors list using your own email — should keep your owner role, and you'll see My Classes / My Earnings appear in the sidebar.
5. As a test member, open My Passes and try "Pause / Vacation hold" — pick a return date, confirm, then "Resume now". Expiry should shift forward by the elapsed days.

Yell at anything that surprises you.

Best,
Yudai
Klasly Support
