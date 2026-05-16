# Email to Jamie — 2026-05-15

**To:** jamie@theelizabethpdx.com
**Cc:** Sarah@theelizabethpdx.com
**Subject:** Re: More Requests
**Reply to thread:** "More Requests" (5/14)

---

Hi Jamie (and Sarah),

Thanks for the detailed list. Rather than send back a wall of questions, I made decisions where I could and built things. Here's the rundown.


=== NEW FEATURES ===

**Optional Website on instructor bios** — Added a Website field under Specialties on each instructor's edit page. It also shows in the Instructor Info card on the right.
→ [https://app.klasly.app/instructors](https://app.klasly.app/instructors) (open any instructor → Edit)

**Cancellation policy on class templates** — New optional section on each class. Shown on the booking page and in confirmation emails. Leave blank to fall back to your studio-wide policy.
→ [https://app.klasly.app/classes/new](https://app.klasly.app/classes/new) (look for "Cancellation policy")

**Flexible pass expiry** — Reworked the picker into three modes: No expiry / Valid for N days·weeks·months / Fixed expiry date. The middle mode has one-click chips for 1, 3, 4, 6 months and 1 year, and you can type any custom number.
→ [https://app.klasly.app/passes/new](https://app.klasly.app/passes/new)

**Sliding scale / "Pay What You Can" pricing (Option A)** — On the class template, the Pricing section now has a Fixed price / Pay What You Can toggle. Pick Pay What You Can, set a Suggested price and a Minimum price (minimum can be $0 for fully free), and at checkout the attendee sees both numbers and types any amount in the range or more.
→ [https://app.klasly.app/classes/new](https://app.klasly.app/classes/new) (Pricing section)

**Per-hour rental for as-needed renters** — New third option on the Flat / per-class tab of the instructor Contract section. Set $X / hour, and the monthly rental report multiplies the rate by the actual class minutes that instructor taught that month.
→ [https://app.klasly.app/instructors](https://app.klasly.app/instructors) (open an instructor → Contract → Flat / per-class tab)

**Monthly contract usage panel** — On any instructor with an active hourly plan, the Membership Tier card now shows "X hr used of Y hr this month" with a progress bar and, if applicable, the estimated overage. Live updates as classes are taught.
→ [https://app.klasly.app/instructors](https://app.klasly.app/instructors) (right-hand sidebar on any instructor with a plan)

**Per-class required waivers** — Each class template has a "Required waivers" multi-select. Members can't book until they've signed every listed waiver. Already-signed waivers are skipped automatically — no double signing.
→ [https://app.klasly.app/classes/new](https://app.klasly.app/classes/new) (look for "Required waivers")

**Discount codes** — Full system: create codes at Settings → Discount Codes with % or $ off, scope to classes / events / memberships / contracts / all, optional expiry, total usage cap, and one-use-per-member. Tag-based auto-apply too: enter a member tag like "veteran" and the code auto-applies for any member with that tag (set tags on each member's profile). Attendees see "Have a code?" under Book & Pay.
→ [https://app.klasly.app/settings/discount-codes](https://app.klasly.app/settings/discount-codes)

**Customizable confirmation emails** — Edit the studio-wide default subject and body for class bookings and a separate default for events (variables `{memberName}`, `{className}`, `{sessionDate}`, `{startTime}`, `{studioName}` are substituted at send time). Optional per-class override on the class template itself wins over the studio default.
→ [https://app.klasly.app/settings/confirmation-emails](https://app.klasly.app/settings/confirmation-emails)
→ Per-class override: [https://app.klasly.app/classes/new](https://app.klasly.app/classes/new) (tick "Custom confirmation email for this class")


=== ALREADY AVAILABLE ===

**Member & pass import (for the June 1 transfer)** — There's a CSV importer at Dashboard → Members → Import. It accepts name, email, phone, plan type, credits, status, DOB, gender, address, and referrer.
→ [https://app.klasly.app/members/import](https://app.klasly.app/members/import)

Send me a sample export from your current system (10 to 20 rows) and I'll confirm it maps cleanly — or add a one-time mapping step so you don't have to reformat anything for launch day.


=== STILL TO COME ===

Two follow-ups landing next:

- **Discount code support on Sarah's contract invoices and on Event bookings.** The infrastructure is shared with the class-booking system that's already live, so this is mostly a wiring task.

- **Monthly contract hours.** Keeping the current behaviour unless you say otherwise: hours count against the monthly allowance when a session is booked, and are returned automatically if the booking is cancelled before it runs. Most studios pick this because it prevents over-booking. The Hours-this-month panel I shipped today already reflects this.

- **Dashboard "recent activity" feed** — already in flight from your other email, landing this week.


=== ONE THING I NEED ===

A sample CSV export of your current members and passes — 10 to 20 rows is plenty. Once I see the shape, I'll confirm the importer maps cleanly or add a one-time mapping step. Same question for passes: are they in the same export, or separate?


=== QUICK SANITY CHECK ===

When you have a minute:

1. Add a website link to one instructor and confirm it appears in the Instructor Info card.
2. Set up a sliding-scale class with $0 minimum and $20 suggested, book it as a test member, confirm the picker shows up at checkout.
3. Open a monthly pass and try the new "4 months" preset.
4. Add a Per hour rental to a test instructor and watch May's numbers populate at [https://app.klasly.app/settings/contracts?tab=flat](https://app.klasly.app/settings/contracts?tab=flat)
5. Create a discount code like VETS10 at Settings → Discount Codes and try it at the Book & Pay checkout via "Have a code?".
6. Write a custom confirmation email at Settings → Confirmation emails and book a class to see the result.
7. Tick "Required waivers" on a class, try booking without signing, then sign and try again.

Yell about anything that surprises you. Thanks again to both of you.

Best,
Yudai
Klasly Support
