import React from "react";
import type { HelpSection } from "./help-section";

function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: "#333", fontWeight: 600 }}>{children}</strong>;
}

function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol style={{ margin: "6px 0 4px 0", paddingLeft: "20px" }}>
      {children}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "8px 0 0 0", padding: "8px 12px", background: "#f0f7ff", borderRadius: "6px", fontSize: "13px", color: "#555" }}>
      <strong style={{ color: "#1a3a5c" }}>Tip:</strong> {children}
    </p>
  );
}

export const SECTIONS: Record<"owner" | "instructor" | "member", HelpSection[]> = {
  owner: [
    {
      title: "Getting Started",
      items: [
        {
          q: "How do I set up my studio?",
          a: (
            <>
              After signing up, you&apos;ll be guided through onboarding:
              <Steps>
                <li>Create your studio profile (name, timezone).</li>
                <li>Choose a plan — every studio gets a <B>30-day free trial</B>.</li>
                <li>Complete the setup tasks on your Dashboard (add classes, members, pricing, etc.).</li>
              </Steps>
              You can start adding classes, instructors, and members right away.
            </>
          ),
        },
        {
          q: "How do I connect Stripe to receive payments?",
          a: (
            <>
              Go to <B>Settings → Stripe Connect</B> and click &quot;Connect with Stripe.&quot; You&apos;ll be redirected to Stripe&apos;s secure onboarding to enter your business details and bank account. Once completed, member payments go directly to your Stripe account.
              <Tip>Stripe Connect must be set up before members can purchase credits or subscriptions.</Tip>
            </>
          ),
        },
        {
          q: "What is the free trial?",
          a: (
            <>
              Every new studio gets a <B>30-day free trial</B> with full access to all features. You won&apos;t be charged until the trial ends. Cancel anytime during the trial at <B>Settings → Billing</B>.
            </>
          ),
        },
      ],
    },
    {
      title: "Dashboard",
      items: [
        {
          q: "What does the Dashboard show?",
          a: (
            <>
              Your Dashboard gives you a quick overview of your studio:
              <Steps>
                <li><B>Active Members</B> — total members in your studio.</li>
                <li><B>Classes</B> — number of active classes.</li>
                <li><B>Bookings (this week)</B> — confirmed bookings for the current week.</li>
                <li><B>Revenue</B> — total revenue from member payments.</li>
              </Steps>
              The Dashboard also shows setup tasks for new studios and quick links to common actions.
            </>
          ),
        },
      ],
    },
    {
      title: "Members",
      items: [
        {
          q: "How do I add a member?",
          a: (
            <>
              Go to <B>Members → New Member</B>. Enter their name and email address. They&apos;ll receive an invitation email with a link to set up their account and access the member portal.
            </>
          ),
        },
        {
          q: "Can I import members in bulk?",
          a: (
            <>
              Yes. Go to <B>Members → Import</B>. Upload a CSV file with columns for name and email. The system will create accounts and send invitations automatically.
              <Tip>Download the CSV template from the import page to ensure correct formatting.</Tip>
            </>
          ),
        },
        {
          q: "How do member credits work?",
          a: (
            <>
              Members use credits to book classes:
              <Steps>
                <li><B>Credit packs</B> — members buy a set number of credits (e.g., 5 or 10).</li>
                <li><B>Monthly plans</B> — members get unlimited bookings with an active subscription.</li>
                <li>Each class booking uses <B>1 credit</B>. Cancelling a booking returns the credit.</li>
              </Steps>
              You can manually adjust a member&apos;s credits from their detail page: <B>Members → [Member Name] → Edit Credits</B>.
              <Tip>Both owners and managers with member management permissions can adjust credits.</Tip>
            </>
          ),
        },
        {
          q: "How do I view a member's details?",
          a: (
            <>
              Go to <B>Members</B> and click on a member&apos;s name. You&apos;ll see their profile, credit balance, booking history, and payment history. From here you can also adjust credits or cancel bookings.
            </>
          ),
        },
        {
          q: "How do I handle minor members?",
          a: (
            <>
              When adding or editing a member, you can mark them as a minor:
              <Steps>
                <li>Enter their <B>Date of Birth</B> (members under 18 are automatically flagged) or check the <B>&quot;This member is a minor&quot;</B> checkbox.</li>
                <li>Provide a <B>Guardian Email</B> — the parent or legal guardian&apos;s email address.</li>
                <li>When you send a waiver invite (individually or via bulk send), the guardian receives a signing link at their email instead of the member.</li>
                <li>The guardian signs the waiver on behalf of the minor — no Klasly account needed.</li>
              </Steps>
              Minor members show a <B>Minor</B> badge in the members list. On the member detail page, you can send a guardian waiver invite directly.
              <Tip>Bulk waiver invites automatically route to guardian emails for minors. Minors without a guardian email will be skipped.</Tip>
            </>
          ),
        },
      ],
    },
    {
      title: "Instructors",
      items: [
        {
          q: "How do I add an instructor?",
          a: (
            <>
              Go to <B>Instructors → New Instructor</B>. Enter their name and email. They&apos;ll receive a link to access their instructor dashboard where they can view assigned classes, take attendance, and manage their schedule.
            </>
          ),
        },
        {
          q: "Can I import instructors in bulk?",
          a: (
            <>
              Yes. Go to <B>Instructors → Import</B>. Upload a CSV file with name and email columns, just like member imports.
            </>
          ),
        },
        {
          q: "What can instructors see and do?",
          a: (
            <>
              Instructors have their own dashboard where they can:
              <Steps>
                <li>View their assigned classes and schedule.</li>
                <li>Take attendance for each session.</li>
                <li>Create their own classes (in Collective Mode).</li>
                <li>Book rooms for their classes.</li>
                <li>View their earnings.</li>
              </Steps>
              They cannot access payment settings, studio settings, or other instructors&apos; data.
            </>
          ),
        },
      ],
    },
    {
      title: "Classes",
      items: [
        {
          q: "How do I create a class?",
          a: (
            <>
              Go to <B>Classes → New Class</B>. Fill in:
              <Steps>
                <li>Class name and description.</li>
                <li>Assign an instructor.</li>
                <li>Set the day of week, start time, duration, and capacity.</li>
                <li>Optionally assign a room.</li>
              </Steps>
              Once created, sessions (bookable time slots) will be generated automatically.
            </>
          ),
        },
        {
          q: "How do I add sessions to a class?",
          a: (
            <>
              Open a class from the <B>Classes</B> page. Sessions are created automatically based on the class schedule. You can also manually add individual sessions with specific dates from the class detail page.
            </>
          ),
        },
        {
          q: "How do I make a session private?",
          a: (
            <>
              Each session can be toggled between <B>Public</B> and <B>Private</B>. Private sessions are hidden from the member schedule and public widget but remain visible to owners and instructors for room management.
              <Steps>
                <li>When creating a class, use the &quot;Public&quot; checkbox to set the default visibility for all generated sessions.</li>
                <li>To change visibility for an individual session, go to <B>Classes → [Class] → [Session]</B> and click the visibility toggle.</li>
              </Steps>
              <Tip>Private sessions still count for room availability — they prevent double-booking even though members can&apos;t see them.</Tip>
            </>
          ),
        },
        {
          q: "Can I import classes in bulk?",
          a: (
            <>
              Yes. Go to <B>Classes → Import</B>. Upload a CSV file with the class details. This is useful when migrating from another system.
            </>
          ),
        },
        {
          q: "How far ahead are sessions generated?",
          a: (
            <>
              By default, Klasly generates sessions <B>8 weeks</B> ahead. You can change this in <B>Settings</B> under the <B>Scheduling</B> section — choose 4, 6, 8, or 12 weeks depending on how far in advance you want members to book.
              <Tip>Reducing the number of weeks will not delete existing sessions. Increasing it will generate additional sessions on the next automatic run.</Tip>
            </>
          ),
        },
      ],
    },
    {
      title: "Rooms",
      items: [
        {
          q: "How do I manage rooms?",
          a: (
            <>
              Go to <B>Rooms</B> from the sidebar. You can:
              <Steps>
                <li><B>Add rooms</B> — click &quot;New Room&quot; and enter name, capacity, and description.</li>
                <li><B>Assign rooms to classes</B> — when creating or editing a class, select a room from the dropdown.</li>
                <li><B>View room bookings</B> — go to <B>Rooms → Bookings</B> to see a calendar of room usage.</li>
              </Steps>
              <Tip>The system prevents double-booking: if a room is occupied, you&apos;ll see a conflict warning.</Tip>
            </>
          ),
        },
      ],
    },
    {
      title: "Bookings",
      items: [
        {
          q: "How do I view bookings for a session?",
          a: (
            <>
              Go to <B>Bookings</B> from the sidebar, then click on a session. You&apos;ll see:
              <Steps>
                <li><B>Confirmed members</B> — members with a reserved spot.</li>
                <li><B>Waitlist</B> — members waiting for a spot to open.</li>
              </Steps>
              You can cancel bookings on behalf of members from this page.
            </>
          ),
        },
        {
          q: "How does the waitlist work?",
          a: (
            <>
              When a session reaches full capacity:
              <Steps>
                <li>New bookings go to the <B>waitlist</B> (first come, first served).</li>
                <li>If a confirmed member cancels, the first person on the waitlist is <B>automatically promoted</B>.</li>
                <li>The promoted member receives an email notification.</li>
              </Steps>
              <Tip>Waitlist bookings do not consume credits. Credits are only deducted when a member is promoted to confirmed.</Tip>
            </>
          ),
        },
        {
          q: "How do I cancel a booking as an owner?",
          a: (
            <>
              Go to <B>Bookings → [Session]</B> and click the cancel button next to the member&apos;s booking. The member&apos;s credit will be returned automatically if the booking was confirmed.
            </>
          ),
        },
      ],
    },
    {
      title: "Payments",
      items: [
        {
          q: "How do I set pricing?",
          a: (
            <>
              Go to <B>Settings → Pricing</B>. You can configure:
              <Steps>
                <li><B>Credit packs</B> — set the number of credits and price for each pack.</li>
                <li><B>Monthly plans</B> — set the monthly subscription price for unlimited access.</li>
              </Steps>
              Pricing changes apply to new purchases only and do not affect existing subscriptions.
            </>
          ),
        },
        {
          q: "Where do member payments go?",
          a: (
            <>
              Once you&apos;ve connected Stripe via <B>Settings → Stripe Connect</B>, payments go directly to your Stripe account. Stripe&apos;s standard processing fee applies. You can view all transactions in your Stripe dashboard.
            </>
          ),
        },
        {
          q: "How do I view payment history?",
          a: (
            <>
              Go to <B>Payments</B> from the sidebar. You&apos;ll see all member payments with date, amount, type (credit pack or subscription), and status. Failed payments are highlighted so you can follow up.
            </>
          ),
        },
      ],
    },
    {
      title: "Settings",
      items: [
        {
          q: "How do I manage my Klasly subscription?",
          a: (
            <>
              Go to <B>Settings → Billing</B>. You can:
              <Steps>
                <li>View your current plan and billing cycle.</li>
                <li>Switch between Monthly and Yearly plans.</li>
                <li>Update your payment method.</li>
                <li>Cancel your subscription.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "What is the waiver feature?",
          a: (
            <>
              Go to <B>Settings → Waiver</B> to create a digital waiver that members must sign before booking classes. You can customize the waiver text. Members will be prompted to sign when they first access the booking page.
              <Tip>For minor members, the waiver is sent to their guardian&apos;s email address instead. See &quot;How do I handle minor members?&quot; below.</Tip>
            </>
          ),
        },
        {
          q: "How do I embed the schedule widget on my website?",
          a: (
            <>
              Go to <B>Settings → Widget</B>. Copy the embed code and paste it into your website&apos;s HTML. The widget shows your public class schedule and allows visitors to view available sessions.
            </>
          ),
        },
        {
          q: "How do I configure payout settings?",
          a: (
            <>
              Go to <B>Settings → Payout</B>. Choose your payout model:
              <Steps>
                <li><B>Studio Mode</B> — all payments go to the studio&apos;s Stripe account.</li>
                <li><B>Collective Mode</B> — instructors receive payments directly via their own Stripe Connect, with studio fees deducted automatically.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "Can I also teach classes as an owner?",
          a: (
            <>
              Yes. Go to <B>Settings → Studio Features</B> and enable <B>I Also Teach Classes</B>. This adds you as an instructor in your studio. A <B>My Classes</B> section will appear in your sidebar where you can create and manage classes you personally teach, including setting per-class pricing.
              <Tip>When creating classes from the regular Classes page, your name will appear in the instructor dropdown with &quot;(Me)&quot; next to it.</Tip>
            </>
          ),
        },
        {
          q: "How do I delete my studio account?",
          a: (
            <>
              Go to <B>Settings</B> and scroll to the bottom to find the <B>Delete Account</B> section. Deleting your account will:
              <Steps>
                <li>Cancel all active Stripe subscriptions (studio plan, member plans, passes, and instructor memberships).</li>
                <li>Permanently remove all studio data including classes, sessions, bookings, members, and instructors.</li>
                <li>Delete all associated user accounts.</li>
              </Steps>
              <Tip>This action is irreversible. Make sure to export any data you need before deleting your account.</Tip>
            </>
          ),
        },
      ],
    },
    {
      title: "Reports",
      items: [
        {
          q: "How do I view instructor earnings?",
          a: (
            <>
              Go to <B>Instructors → Earnings</B> to see a summary of each instructor&apos;s earnings. Click on an instructor to view their detailed earnings breakdown by month and class.
            </>
          ),
        },
        {
          q: "How do I generate tax reports?",
          a: (
            <>
              Go to <B>Instructors → Tax Report</B>. Select the date range and generate a report showing instructor earnings for tax purposes. You can download the report as needed.
            </>
          ),
        },
      ],
    },
    {
      title: "Schedule Visibility",
      items: [
        {
          q: "How do I make a session private?",
          a: (
            <>
              When creating or editing a session, change the Visibility setting from &quot;Public&quot; to &quot;Private.&quot; Private sessions won&apos;t appear in the member schedule but will still block room bookings and appear in your admin calendar.
            </>
          ),
        },
        {
          q: "Can members see private sessions?",
          a: (
            <>
              No. Private sessions are hidden from the member schedule. Only owners, managers, and the assigned instructor can see them. They appear with a 🔒 icon in the admin view.
            </>
          ),
        },
      ],
    },
    {
      title: "Minor Waivers",
      items: [
        {
          q: "How do I register a minor member?",
          a: (
            <>
              When adding a member, check <B>&quot;This member is a minor&quot;</B> and enter the guardian&apos;s email address. You can also enter a date of birth — if the member is under 18, they&apos;ll automatically be flagged as a minor.
            </>
          ),
        },
        {
          q: "How does the guardian waiver process work?",
          a: (
            <>
              When you send a waiver invite to a minor member, the email goes to their guardian instead. The guardian can review and sign the waiver without needing a Klasly account. Once signed, the member&apos;s profile will show &quot;Guardian Waiver Signed.&quot;
            </>
          ),
        },
      ],
    },
    {
      title: "SOAP Notes",
      items: [
        {
          q: "What are SOAP Notes?",
          a: (
            <>
              SOAP Notes are structured session records used by body therapists and practitioners. SOAP stands for <B>Subjective</B> (client&apos;s complaint), <B>Objective</B> (your findings), <B>Assessment</B> (your judgment), and <B>Plan</B> (next steps).
            </>
          ),
        },
        {
          q: "Who can see SOAP Notes?",
          a: (
            <>
              By default, SOAP Notes are confidential — only the instructor who created them can view them. If an instructor marks a note as &quot;not confidential,&quot; the studio owner can also view it. Members cannot see SOAP Notes.
            </>
          ),
        },
        {
          q: "How do instructors access SOAP Notes?",
          a: (
            <>
              Instructors can find SOAP Notes in their dashboard. Select a member, then navigate to the SOAP Notes section to view history or create a new note.
            </>
          ),
        },
      ],
    },
    {
      title: "Traffic Sources (UTM Tracking)",
      items: [
        {
          q: "How do I track where my members come from?",
          a: (
            <>
              Add UTM parameters to your booking link when sharing it. For example: <B>klasly.app/s/yourstudio?utm_source=instagram</B>. Then check your Analytics page under &quot;Traffic Sources&quot; to see click data by source.
            </>
          ),
        },
        {
          q: "What UTM parameters can I use?",
          a: (
            <>
              You can use <B>utm_source</B> (e.g., instagram, facebook, email), <B>utm_medium</B> (e.g., social, cpc, newsletter), and <B>utm_campaign</B> (e.g., spring_promo, grand_opening) to organize your tracking.
            </>
          ),
        },
      ],
    },
    {
      title: "Studio Announcements",
      items: [
        {
          q: "How do I create an announcement for my studio?",
          a: (
            <>
              Go to <B>Announcements</B> from the sidebar. Fill in the title, body, and select target roles (instructors, members, or both). Click <B>&quot;Create Announcement&quot;</B> and it will immediately appear as a banner for the selected audience.
            </>
          ),
        },
        {
          q: "Can I deactivate or delete an announcement?",
          a: (
            <>
              Yes. On the <B>Announcements</B> page, you&apos;ll see a table of all your announcements. You can:
              <Steps>
                <li><B>Activate / Deactivate</B> — toggle visibility without deleting. Deactivated announcements won&apos;t be shown to anyone.</li>
                <li><B>Delete</B> — permanently remove an announcement.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "Who sees my studio announcements?",
          a: (
            <>
              Studio announcements are shown only to the roles you selected (instructors and/or members) within your studio. They appear as a notification banner in the app. Platform-wide announcements from Klasly are separate.
            </>
          ),
        },
      ],
    },
    {
      title: "Online Classes",
      items: [
        {
          q: "How do I create an online class?",
          a: (
            <>
              When creating or editing a class, select <B>&quot;Online&quot;</B> as the Class Type. Then enter the online meeting link (Zoom, Google Meet, etc.). The room and location fields are hidden for online classes.
              <Tip>The online link is only visible to members who have a confirmed booking. It won&apos;t appear on the public widget.</Tip>
            </>
          ),
        },
        {
          q: "How do members join online classes?",
          a: (
            <>
              After booking an online class, the member will see a <B>&quot;Join Online&quot;</B> link in:
              <Steps>
                <li>The class detail popup on the schedule calendar.</li>
                <li>The booking confirmation email.</li>
              </Steps>
              The link is only shown to members with a confirmed booking — it&apos;s hidden from unbooked members and the public widget.
            </>
          ),
        },
        {
          q: "Can I have hybrid classes?",
          a: (
            <>
              Yes. When creating or editing a class, select <B>&quot;Hybrid&quot;</B> as the Class Type. Hybrid classes default to in-person but let you switch individual sessions to online.
              <Steps>
                <li>Set a default online link on the class (optional).</li>
                <li>Go to each session&apos;s detail page to toggle it between In-person and Online.</li>
                <li>Sessions set to Online will show the 📹 badge and link to members.</li>
              </Steps>
              <Tip>If a session has no link of its own, it uses the class&apos;s default link.</Tip>
            </>
          ),
        },
        {
          q: "Can I switch a class between in-person and online?",
          a: (
            <>
              Yes. Go to <B>Classes → [Class Name]</B> and change the Class Type in the edit form. Switching to online will clear the room and location, and switching to in-person will clear the online link.
            </>
          ),
        },
        {
          q: "When do members see the Zoom link?",
          a: (
            <>
              Members can only see the online link <B>after they have a confirmed booking</B>. Before booking, they will see the 📹 Online badge but the link is hidden. The link is also included in the booking confirmation email.
              <Tip>The public widget never shows the link — members receive it via the schedule calendar and email only.</Tip>
            </>
          ),
        },
      ],
    },
    {
      title: "Feature Management",
      items: [
        {
          q: "How do I enable or disable features?",
          a: (
            <>
              Go to <B>Settings &rarr; Features</B> to toggle optional features on or off. Available features include Online Classes, Digital Waivers, SOAP Notes, UTM Tracking, Events &amp; Retreats, and more.
              <Tip>You can also choose features during onboarding when you first create your studio.</Tip>
            </>
          ),
        },
        {
          q: "What are the core features?",
          a: (
            <>
              Core features are always enabled and cannot be turned off:
              <Steps>
                <li>Member Management</li>
                <li>Scheduling (classes, sessions, bookings)</li>
                <li>Payments (Stripe integration)</li>
                <li>Messaging</li>
              </Steps>
              Optional features can be toggled in <B>Settings &rarr; Features</B>.
            </>
          ),
        },
      ],
    },
    {
      title: "Referral Program",
      items: [
        {
          q: "How does the referral program work?",
          a: (
            <>
              Share your unique referral link with other studio owners.
              When they sign up and make their first payment, you both get <B>1 month of Klasly for free</B>.
              There&apos;s no limit to how many people you can refer.
            </>
          ),
        },
        {
          q: "Where do I find my referral link?",
          a: (
            <>
              Go to <B>Settings → Referral</B>. Your unique link is displayed at the top of the page.
              Click <B>&quot;Copy Link&quot;</B> to copy it to your clipboard.
            </>
          ),
        },
        {
          q: "When do I receive my free month?",
          a: (
            <>
              Your free month is applied automatically when the person you referred makes their first payment (after their trial ends).
              You&apos;ll receive an email notification and the discount will appear on your next billing cycle.
            </>
          ),
        },
        {
          q: "Is there a limit on referrals?",
          a: (
            <>
              No. You can refer as many studio owners as you&apos;d like.
              Each successful referral earns you <B>1 month free</B>.
            </>
          ),
        },
      ],
    },
    {
      title: "Events & Retreats",
      items: [
        {
          q: "How do I create a retreat?",
          a: (
            <>
              Go to <B>Events &amp; Retreats</B> and click <B>&quot;Create Event.&quot;</B> Follow the 5-step form:
              <Steps>
                <li><B>Basic Info</B> — name, dates, location.</li>
                <li><B>Room Options</B> — tiers with pricing &amp; capacity.</li>
                <li><B>Payment Settings</B> — full or installment.</li>
                <li><B>Cancellation Policy</B>.</li>
                <li><B>Custom Form</B> (optional).</li>
              </Steps>
            </>
          ),
        },
        {
          q: "How does installment payment work?",
          a: (
            <>
              When you enable installments, guests can choose to pay in 3 installments: 1/3 at booking, 1/3 after 30 days, 1/3 after 60 days &mdash; automatically charged to their card. You&apos;ll get reminders 7 days before each charge. You can edit individual due dates from the booking detail page under <B>Settings &rarr; Events</B>.
            </>
          ),
        },
        {
          q: "How do I handle cancellations?",
          a: (
            <>
              Open the booking detail page and click <B>&quot;Cancel Booking.&quot;</B> The system auto-calculates the refund based on your cancellation policy (days before event start &times; refund percentage &minus; fee). You can adjust the refund amount manually before confirming. Choose <B>&quot;Process Refund &amp; Cancel&quot;</B> to issue a Stripe refund, or <B>&quot;Cancel without Refund&quot;</B> to cancel without refunding.
            </>
          ),
        },
        {
          q: "Can I create private events?",
          a: (
            <>
              Yes. When creating an event, set <B>Public</B> to <B>No</B>. Only logged-in members of your studio will be able to view and book the event.
            </>
          ),
        },
        {
          q: "Can guests (non-members) book retreats?",
          a: (
            <>
              Yes. Guests enter their name, email, and phone number during checkout. No Klasly account is required. They&apos;ll receive booking confirmation and payment receipts by email.
            </>
          ),
        },
      ],
    },
    {
      title: "Studio Passes",
      items: [
        {
          q: "What are Studio Passes?",
          a: (
            <>
              Studio Passes are monthly membership plans you can offer to your members. Each pass has a set price and optionally a limit on how many classes a member can attend per month (or unlimited). Members subscribe and are billed automatically each month via Stripe.
            </>
          ),
        },
        {
          q: "How do I create a pass?",
          a: (
            <>
              <Steps>
                <li>Go to <B>Passes</B> in the sidebar.</li>
                <li>Click <B>+ Create Pass</B>.</li>
                <li>Enter a name, description, monthly price, and choose unlimited or limited classes per month.</li>
                <li>Click <B>Create</B>. A Stripe product and recurring price are created automatically.</li>
              </Steps>
              <Tip>Stripe Connect must be set up before you can create passes.</Tip>
            </>
          ),
        },
        {
          q: "What is Auto-distribute?",
          a: (
            <>
              Each pass has an <B>Auto-distribute</B> toggle. When ON, instructor payouts from pass revenue are calculated and sent automatically on the 1st of each month. When OFF, you review and approve distributions before they are sent.
            </>
          ),
        },
        {
          q: "How do pass bookings work?",
          a: (
            <>
              When a member with an active pass books a class, the booking is marked as <B>&quot;Pass&quot;</B> — no credits are deducted and no payment is charged. If the booking is cancelled (by the member or by you), the class usage is automatically returned to their monthly allowance.
              <Tip>Pass bookings show a purple &quot;Pass&quot; badge in the attendee list.</Tip>
            </>
          ),
        },
        {
          q: "What statistics are shown on the Passes page?",
          a: (
            <>
              The Passes page shows an overview with:
              <Steps>
                <li><B>Active Subscribers</B> — total members currently subscribed to any pass.</li>
                <li><B>Pass Bookings (This Month)</B> — number of bookings made using a pass this month.</li>
                <li><B>Monthly Recurring Revenue</B> — total MRR from active pass subscriptions.</li>
                <li><B>Top Members</B> — members with the highest pass usage this month.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "How is the payout calculated?",
          a: (
            <>
              Pass revenue minus fees (Stripe, Klasly 0.5%, and your Studio Fee) is split among instructors by the number of classes they taught to pass members. If an instructor taught 4 out of 9 total pass-booked classes, they receive 4/9 of the distributable amount.
            </>
          ),
        },
        {
          q: "Can I adjust individual payout amounts?",
          a: (
            <>
              Yes. When Auto-distribute is OFF, you can edit each instructor&apos;s payout amount on the distribution review page before approving. The total cannot exceed the distributable amount.
              <Tip>Go to <B>Passes → Distributions</B> to review and adjust payouts.</Tip>
            </>
          ),
        },
        {
          q: "When are distributions calculated?",
          a: (
            <>
              Distributions are calculated automatically on the <B>1st of each month</B> based on the previous month&apos;s pass bookings. For example, on March 1st the system calculates distributions for all February pass usage.
              <Tip>If no pass bookings were made during a month, no distributions are created for that period.</Tip>
            </>
          ),
        },
        {
          q: "What is the Distributable Amount?",
          a: (
            <>
              The <B>Distributable Amount</B> is the total pass revenue for the month minus all fees:
              <Steps>
                <li><B>Stripe fees</B> — approximately 2.9% + 30¢ per subscription.</li>
                <li><B>Klasly fee</B> — a small platform fee (typically 0.5%).</li>
                <li><B>Studio fee</B> — your studio&apos;s fee percentage (set in Settings).</li>
              </Steps>
              The remaining amount is split among instructors based on how many classes each one taught to pass holders.
            </>
          ),
        },
        {
          q: "What do the distribution statuses mean?",
          a: (
            <>
              <Steps>
                <li><B>Pending</B> — waiting for your review and approval (Auto-distribute OFF).</li>
                <li><B>Approved</B> — you approved the payout; it will be sent within 2 hours.</li>
                <li><B>Completed</B> — the payout has been sent to the instructor&apos;s Stripe account.</li>
                <li><B>Failed</B> — the payout could not be sent (e.g., instructor&apos;s Stripe account is not connected or incomplete). You will receive an email notification.</li>
              </Steps>
              <Tip>Once approved, payouts cannot be undone. Review amounts carefully before approving.</Tip>
            </>
          ),
        },
      ],
    },
    {
      title: "Mobile Access for Members",
      items: [
        {
          q: "Do my members need to download an app?",
          a: (
            <>
              No. Members can use Klasly in any web browser. For the best experience, they can add Klasly to their phone&apos;s home screen — it works like a native app with no download required.
            </>
          ),
        },
        {
          q: "How do I tell my members to install the app?",
          a: (
            <>
              Share this with your members: &quot;Open <B>app.klasly.app</B> in your phone&apos;s browser, then add it to your home screen. On iPhone, use Safari and tap the Share button → Add to Home Screen. On Android, use Chrome and tap the menu → Install App.&quot;
            </>
          ),
        },
      ],
    },
    {
      title: "Updates & Notifications",
      items: [
        {
          q: "How do I know when new features are available?",
          a: (
            <>
              When new features are released, you&apos;ll see a notification banner at the top of your dashboard. Click <B>&quot;View Updates&quot;</B> to see what&apos;s new. The banner will disappear once you&apos;ve viewed the updates.
              <Tip>You can also send your own announcements to instructors and members via the <B>Announcements</B> page in the sidebar.</Tip>
            </>
          ),
        },
      ],
    },
  ],

  instructor: [
    {
      title: "Getting Started",
      items: [
        {
          q: "How do I access my instructor account?",
          a: (
            <>
              Your studio will send you an invitation email. Click the link to set up your account. Once logged in, you&apos;ll see your <B>Instructor Dashboard</B> with today&apos;s classes and upcoming schedule.
            </>
          ),
        },
        {
          q: "What can I do as an instructor?",
          a: (
            <>
              As an instructor, you can:
              <Steps>
                <li>View your class schedule and assigned sessions.</li>
                <li>Take attendance for each session.</li>
                <li>Create your own classes and set pricing (Collective Mode).</li>
                <li>Book rooms for your classes.</li>
                <li>Track your earnings.</li>
                <li>Manage your profile.</li>
              </Steps>
            </>
          ),
        },
      ],
    },
    {
      title: "Dashboard",
      items: [
        {
          q: "What does the instructor Dashboard show?",
          a: (
            <>
              Your Dashboard shows:
              <Steps>
                <li><B>Today&apos;s classes</B> — sessions you&apos;re teaching today with time, class name, and booking count.</li>
                <li><B>This week&apos;s overview</B> — a quick look at your upcoming week.</li>
              </Steps>
              Click on any session to view details or take attendance.
            </>
          ),
        },
      ],
    },
    {
      title: "My Schedule",
      items: [
        {
          q: "How do I view my schedule?",
          a: (
            <>
              Go to <B>My Schedule</B> from the sidebar. You can switch between:
              <Steps>
                <li><B>Week View</B> — see all your sessions on a weekly calendar grid.</li>
                <li><B>List View</B> — see sessions in a chronological list.</li>
              </Steps>
              Use the Previous/Next Week buttons to navigate between weeks.
            </>
          ),
        },
        {
          q: "How do I take attendance?",
          a: (
            <>
              Click on any session in your schedule to open the session detail page. You&apos;ll see the list of booked members. Mark each member as present or absent. Attendance is saved automatically.
            </>
          ),
        },
      ],
    },
    {
      title: "My Classes",
      items: [
        {
          q: "How do I create my own class?",
          a: (
            <>
              Go to <B>My Classes → New Class</B>. Fill in:
              <Steps>
                <li><B>Class name</B> and optional description.</li>
                <li><B>Price</B> — set the per-class price (students pay this amount).</li>
                <li><B>Day of week</B>, start time, duration, and capacity.</li>
                <li><B>Room</B> — optionally assign a room.</li>
                <li><B>Public/Private</B> — public classes appear on the member schedule; private classes are hidden.</li>
              </Steps>
              When you create a class, sessions for the next 4 weeks are generated automatically.
              <Tip>This feature is available in Collective Mode, where instructors set their own pricing and receive payments directly.</Tip>
            </>
          ),
        },
        {
          q: "What is the difference between public and private classes?",
          a: (
            <>
              <Steps>
                <li><B>Public classes</B> are visible on the member schedule and can be booked by any member.</li>
                <li><B>Private classes</B> are hidden from the member schedule. Only you and the studio owner can see them. Useful for private lessons or invite-only sessions.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "How do I view and manage my classes?",
          a: (
            <>
              Go to <B>My Classes</B> from the sidebar. You&apos;ll see all your classes with their schedule, capacity, and pricing. Click any class name to open the detail page where you can edit all fields and view upcoming sessions.
            </>
          ),
        },
        {
          q: "How do I edit a class?",
          a: (
            <>
              Click the class name on the <B>My Classes</B> page to open the detail page. From there you can edit:
              <Steps>
                <li>Name, description, and schedule (day, time, duration).</li>
                <li>Capacity, price, and room assignment.</li>
                <li>Visibility (Public/Private) and online class settings.</li>
              </Steps>
              Click <B>Save Changes</B> when done.
            </>
          ),
        },
        {
          q: "How do I delete a class?",
          a: (
            <>
              Open the class detail page by clicking the class name. Scroll down to the <B>Danger Zone</B> section and click <B>Delete class</B>. You&apos;ll be asked to confirm before deletion.
              <Tip>Classes with future bookings cannot be deleted. Deactivate the class instead to hide it from the schedule while preserving existing bookings.</Tip>
            </>
          ),
        },
      ],
    },
    {
      title: "Room Bookings",
      items: [
        {
          q: "How do I book a room?",
          a: (
            <>
              Go to <B>Room Bookings → New Booking</B>. Select a room, date, and time. The system will check for conflicts and prevent double-booking.
              <Tip>If a room is already booked at your selected time, you&apos;ll see a warning. Choose a different time or room.</Tip>
            </>
          ),
        },
        {
          q: "How do I view my room bookings?",
          a: (
            <>
              Go to <B>Room Bookings</B> from the sidebar to see all your room reservations with date, time, and room name.
            </>
          ),
        },
        {
          q: "How do I cancel a room booking?",
          a: (
            <>
              On the Room Bookings page, click <B>Cancel</B> next to the booking you want to remove. You&apos;ll be asked to confirm before the cancellation is processed.
            </>
          ),
        },
      ],
    },
    {
      title: "Membership",
      items: [
        {
          q: "What is the instructor membership?",
          a: (
            <>
              Your studio may offer membership tiers for instructors. Go to <B>Membership</B> from the sidebar to view your current membership details, including:
              <Steps>
                <li>Your membership tier and monthly fee.</li>
                <li>Included hours and room access.</li>
                <li>Studio fee percentage (deducted from class payments).</li>
              </Steps>
            </>
          ),
        },
      ],
    },
    {
      title: "My Earnings",
      items: [
        {
          q: "How do I view my earnings?",
          a: (
            <>
              Go to <B>My Earnings</B> from the sidebar. You&apos;ll see:
              <Steps>
                <li><B>Total earnings</B> — your cumulative earnings.</li>
                <li><B>Monthly breakdown</B> — earnings grouped by month.</li>
                <li><B>Per-class details</B> — how much you earned from each class.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "What are Pass Distributions?",
          a: (
            <>
              If the studio offers monthly passes, revenue from pass subscriptions is distributed to instructors based on how many classes each instructor taught to pass holders. This is separate from your per-class earnings and appears in a dedicated <B>Pass Distributions</B> section on your earnings page.
            </>
          ),
        },
        {
          q: "How is my pass distribution calculated?",
          a: (
            <>
              The studio&apos;s pass revenue (minus fees) is split proportionally. For example, if you taught 4 out of 10 total pass-booked classes in a month, you receive 4/10 (40%) of the distributable amount.
              <Tip>Your share percentage and class count are shown for each distribution period.</Tip>
            </>
          ),
        },
        {
          q: "What do the distribution statuses mean?",
          a: (
            <>
              <Steps>
                <li><B>Pending</B> — the studio owner is reviewing the distribution before sending.</li>
                <li><B>Approved</B> — the payout has been approved and will be sent shortly.</li>
                <li><B>Completed</B> — the payout has been sent to your Stripe account.</li>
                <li><B>Failed</B> — there was an issue sending the payout. Please check that your Stripe Connect account is fully set up.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "Why do I need Stripe Connect for pass payouts?",
          a: (
            <>
              Pass distribution payouts are sent directly to your Stripe account. You must complete Stripe Connect onboarding to receive them. Go to <B>My Earnings</B> and follow the setup instructions if you see a &quot;Connect with Stripe&quot; prompt.
            </>
          ),
        },
      ],
    },
    {
      title: "My Profile",
      items: [
        {
          q: "How do I update my profile?",
          a: (
            <>
              Go to <B>My Profile</B> from the sidebar. You can update your display name and other profile information. Changes are reflected across the app immediately.
            </>
          ),
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
          a: (
            <>
              Your studio will send you an invitation via email. Click the link in the email to set up your account. You can also sign in with Google if your studio supports it.
            </>
          ),
        },
        {
          q: "How do I log in?",
          a: (
            <>
              Go to the login page and enter your email and password. If you forgot your password, click <B>Forgot password?</B> to receive a reset link.
            </>
          ),
        },
      ],
    },
    {
      title: "Schedule & Booking",
      items: [
        {
          q: "How do I browse and book classes?",
          a: (
            <>
              Go to <B>Schedule</B> (your default page). You can:
              <Steps>
                <li>Switch between <B>Day</B>, <B>Week</B>, and <B>Month</B> views using the buttons at the top.</li>
                <li>Navigate between dates using the arrow buttons or the <B>Today</B> button.</li>
                <li>Click on any class to see details (time, instructor, capacity).</li>
                <li>Click <B>Book</B> to reserve your spot.</li>
              </Steps>
              <Tip>You need at least 1 credit to book a class, or an active monthly subscription for unlimited bookings.</Tip>
            </>
          ),
        },
        {
          q: "What if a class is full?",
          a: (
            <>
              When a class is at full capacity, you can <B>join the waitlist</B>. If someone cancels:
              <Steps>
                <li>You&apos;ll be automatically promoted to confirmed.</li>
                <li>You&apos;ll receive an email notification.</li>
                <li>Your credit will be deducted only when promoted (not when joining the waitlist).</li>
              </Steps>
            </>
          ),
        },
        {
          q: "How do I cancel a booking?",
          a: (
            <>
              Go to <B>My Bookings</B> and click <B>Cancel</B> on the booking you want to remove. You&apos;ll be asked to confirm by clicking <B>Yes, Cancel</B> (or <B>Keep</B> to go back). Your credit will be returned immediately if the booking was confirmed.
              <Tip>If you&apos;re on the waitlist, you can leave the waitlist without losing any credits.</Tip>
            </>
          ),
        },
        {
          q: "How do I join an online class?",
          a: (
            <>
              Online classes are marked with a 📹 badge on the schedule. After you book an online class:
              <Steps>
                <li>Click on the class in the schedule to open details — you&apos;ll see a <B>&quot;Join Online&quot;</B> link.</li>
                <li>You&apos;ll also receive the link in your booking confirmation email.</li>
              </Steps>
              <Tip>The online link is only visible after you have a confirmed booking. If you&apos;re on the waitlist, you&apos;ll see the link once you&apos;re promoted.</Tip>
            </>
          ),
        },
      ],
    },
    {
      title: "My Bookings",
      items: [
        {
          q: "Where can I see my upcoming bookings?",
          a: (
            <>
              Go to <B>My Bookings</B> from the navigation menu. You&apos;ll see:
              <Steps>
                <li><B>Confirmed bookings</B> — classes you have a reserved spot for.</li>
                <li><B>Waitlisted sessions</B> — classes you&apos;re waiting to get into.</li>
              </Steps>
              Each booking shows the class name, date, time, and instructor.
            </>
          ),
        },
      ],
    },
    {
      title: "Credits & Purchases",
      items: [
        {
          q: "How do I purchase credits or a subscription?",
          a: (
            <>
              Go to <B>Purchase</B> from the navigation menu. You&apos;ll see:
              <Steps>
                <li><B>Credit packs</B> — one-time purchases of a set number of credits.</li>
                <li><B>Monthly plans</B> — subscribe for unlimited bookings each month.</li>
              </Steps>
              Select a plan and complete checkout through Stripe&apos;s secure payment page.
            </>
          ),
        },
        {
          q: "What payment methods are accepted?",
          a: (
            <>
              All major credit and debit cards are accepted through Stripe (Visa, Mastercard, American Express, and more). Payment is processed securely — your card details are never stored by Klasly.
            </>
          ),
        },
        {
          q: "How do credits work?",
          a: (
            <>
              <Steps>
                <li>Each class booking uses <B>1 credit</B>.</li>
                <li>Cancelling a confirmed booking <B>returns</B> your credit.</li>
                <li>Waitlist bookings do <B>not</B> use credits until you&apos;re promoted.</li>
                <li>Monthly plan members have <B>unlimited</B> bookings.</li>
              </Steps>
              Your current credit balance is shown at the top of every page.
            </>
          ),
        },
      ],
    },
    {
      title: "Payments",
      items: [
        {
          q: "Where can I see my payment history?",
          a: (
            <>
              Go to <B>Payments</B> from the navigation menu. You&apos;ll see all past payments with dates, amounts, plan type, and status.
            </>
          ),
        },
      ],
    },
    {
      title: "Waiver & Account",
      items: [
        {
          q: "What is the digital waiver?",
          a: (
            <>
              Some studios require you to sign a digital waiver before booking classes. If required, you&apos;ll be redirected to the <B>Waiver</B> page when you first try to book. Read the waiver carefully and sign to proceed.
            </>
          ),
        },
        {
          q: "I didn't receive the login email",
          a: (
            <>
              Check your spam or junk folder. If you still don&apos;t see it, try requesting a new link from the login page. If the problem persists, contact your studio or reach out to <B>support@klasly.app</B>.
            </>
          ),
        },
        {
          q: "My credits seem incorrect",
          a: (
            <>
              Each booking uses 1 credit, and cancelling returns it. If you believe there&apos;s an error, contact your studio owner or reach out to <B>support@klasly.app</B>.
            </>
          ),
        },
      ],
    },
    {
      title: "Events & Retreats",
      items: [
        {
          q: "How do I book a retreat?",
          a: (
            <>
              Visit the event page, select a room or option, then choose your payment method (full or 3 installments). Complete checkout with your card &mdash; you&apos;ll receive a confirmation email.
            </>
          ),
        },
        {
          q: "When will I be charged for installments?",
          a: (
            <>
              The first installment is charged at booking. The second is auto-charged 30 days later, and the third 60 days later. You&apos;ll receive a reminder email 7 days before each charge. No action is needed &mdash; payments are processed automatically.
            </>
          ),
        },
      ],
    },
    {
      title: "Studio Passes",
      items: [
        {
          q: "What are Studio Passes?",
          a: (
            <>
              Studio Passes are monthly membership plans offered by your studio. Each pass has a monthly price and may include unlimited or a set number of classes per month.
            </>
          ),
        },
        {
          q: "How do I subscribe to a pass?",
          a: (
            <>
              <Steps>
                <li>Go to the <B>Passes</B> tab in your navigation bar.</li>
                <li>Browse available passes — you&apos;ll see the name, description, price, and class limit for each.</li>
                <li>Click <B>Subscribe</B> on the pass you want.</li>
                <li>You&apos;ll be taken to a secure Stripe checkout page to enter your payment details.</li>
                <li>After completing payment, you&apos;ll be redirected back and your pass will be active immediately.</li>
              </Steps>
              <Tip>If you already have an active pass, it will show a &quot;Current Plan&quot; badge.</Tip>
            </>
          ),
        },
        {
          q: "How do I cancel a pass subscription?",
          a: (
            <>
              Go to <B>Passes</B> and click <B>Cancel Subscription</B> on your active pass. Your subscription will remain active until the end of the current billing period — you won&apos;t be charged again after that.
            </>
          ),
        },
        {
          q: "How does booking with a pass work?",
          a: (
            <>
              When you have an active pass with available class capacity, the booking button will show <B>&quot;Book with Pass&quot;</B> instead of the normal booking option. No credits or payment are required — the class is deducted from your monthly pass allowance.
              <Tip>If your pass limit is reached, you can still book using credits or pay-per-class if available.</Tip>
            </>
          ),
        },
        {
          q: "What happens to my pass usage when I cancel a booking?",
          a: (
            <>
              If you cancel a booking that was made with your pass, the class usage is automatically returned to your monthly allowance. You&apos;ll see the updated count on the <B>Passes</B> page.
            </>
          ),
        },
        {
          q: "What happens when I reach my class limit?",
          a: (
            <>
              If your pass has a monthly class limit and you&apos;ve used all your classes, the schedule will show <B>&quot;Pass limit reached&quot;</B>. You can still book classes using credits or pay-per-class if the studio offers those options.
              <Tip>Your class usage resets at the start of each billing period, not the calendar month.</Tip>
            </>
          ),
        },
        {
          q: "What do the pass status badges mean?",
          a: (
            <>
              <Steps>
                <li><B>Current Plan</B> — your pass is active and you can book classes.</li>
                <li><B>Cancels [date]</B> — you cancelled but the pass is still active until the shown date. You can keep booking until then.</li>
                <li><B>Cancelled</B> — your pass has expired. You&apos;ll need to re-subscribe or use credits to book classes.</li>
              </Steps>
            </>
          ),
        },
      ],
    },
    {
      title: "Install the App",
      items: [
        {
          q: "Can I use Klasly like a regular app on my phone?",
          a: (
            <>
              Yes! You can add Klasly to your home screen and use it just like a native app — no app store download needed.
            </>
          ),
        },
        {
          q: "How do I add Klasly to my home screen on iPhone?",
          a: (
            <>
              <Steps>
                <li>Open Klasly in <B>Safari</B> (must be Safari).</li>
                <li>Tap the <B>Share button</B> (square with arrow) at the bottom.</li>
                <li>Scroll down and tap <B>&quot;Add to Home Screen&quot;</B>.</li>
                <li>Tap <B>&quot;Add&quot;</B>.</li>
              </Steps>
              Klasly will appear as an app icon on your home screen.
            </>
          ),
        },
        {
          q: "How do I add Klasly to my home screen on Android?",
          a: (
            <>
              <Steps>
                <li>Open Klasly in <B>Chrome</B>.</li>
                <li>Tap the <B>three-dot menu</B> in the top right.</li>
                <li>Tap <B>&quot;Add to Home Screen&quot;</B> or <B>&quot;Install App&quot;</B>.</li>
                <li>Tap <B>&quot;Install&quot;</B>.</li>
              </Steps>
              Klasly will appear as an app icon on your home screen.
            </>
          ),
        },
        {
          q: "How do I add Klasly to my computer?",
          a: (
            <>
              In Chrome or Edge, look for the install icon in the address bar (a small monitor with a down arrow). Click it and confirm. Klasly will open in its own window like a desktop app.
            </>
          ),
        },
        {
          q: "Is the app different from the website?",
          a: (
            <>
              No. Same features, same data, always up to date. The home screen version just gives you a full-screen experience without the browser toolbar.
            </>
          ),
        },
      ],
    },
    {
      title: "Updates",
      items: [
        {
          q: "What is the notification banner at the top of the page?",
          a: (
            <>
              You may see notification banners for two types of updates:
              <Steps>
                <li><B>Platform updates</B> — new features or changes from Klasly.</li>
                <li><B>Studio announcements</B> — messages from your studio (e.g., schedule changes, events, reminders).</li>
              </Steps>
              Click <B>&quot;View Updates&quot;</B> to read the full message, or dismiss it with the ✕ button.
            </>
          ),
        },
      ],
    },
  ],
};
