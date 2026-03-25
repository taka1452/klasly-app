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
              <Steps>
                <li>Go to <B>Settings → Stripe Connect</B> and click <B>&quot;Connect with Stripe.&quot;</B></li>
                <li>You&apos;ll be redirected to Stripe&apos;s secure onboarding — enter your business type, legal details, and bank account.</li>
                <li>Once complete, you&apos;ll see a <B>✅ Stripe Connected</B> status. Member payments now go directly to your Stripe account.</li>
              </Steps>
              If setup is incomplete (e.g., you left Stripe&apos;s page mid-way), return to <B>Settings → Stripe Connect</B> and click <B>&quot;Continue Setup.&quot;</B> You&apos;ll also see a reminder on your Dashboard until setup is done.
              <Tip>Stripe Connect must be set up before members can purchase credits, subscriptions, or studio passes.</Tip>
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
        {
          q: 'What is the "Update Available" notification?',
          a: (
            <>
              When we release improvements to Klasly, you&apos;ll see a small notification at the bottom of your screen. Tap <B>Update Now</B> to get the latest version. Your data is never affected by updates.
            </>
          ),
        },
        {
          q: 'Why do I see "You\'re offline" at the top of my screen?',
          a: (
            <>
              This means your device has lost its internet connection. You can still view recently loaded pages like your schedule, but actions like making bookings or sending messages require an internet connection. The banner will disappear automatically when you&apos;re back online.
            </>
          ),
        },
        {
          q: "What are push notifications?",
          a: (
            <>
              Push notifications are alerts that appear on your members&apos; phones and computers — even when they&apos;re not using Klasly. Members receive reminders 1 hour before class, booking confirmations, and new messages. Members can enable or disable notifications in their settings.
            </>
          ),
        },
        {
          q: "Do I need to set up push notifications?",
          a: (
            <>
              No setup needed! Push notifications work automatically. When members visit your Klasly booking page, they&apos;ll be asked if they&apos;d like to receive notifications. They can change their preference anytime.
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
              Creating a class is now a two-step process using <B>templates</B> and <B>sessions</B>:
              <Steps>
                <li>Go to <B>Classes</B> in the sidebar and create a template with the class name, duration, capacity, type, and instructor.</li>
                <li>From the template, click <B>Schedule</B> to create a session. Pick a date, time, room, and choose Single or Weekly repeat.</li>
              </Steps>
              You can also create sessions directly from the <B>instructor room calendar</B> by clicking an empty time slot and selecting a template from the dropdown.
              <Tip>Clicking <B>+ Add class</B> on the Schedule page takes you to the template creation page.</Tip>
            </>
          ),
        },
        {
          q: "How does the Schedule calendar work?",
          a: (
            <>
              The <B>Schedule</B> page shows all upcoming sessions in a calendar format with Day, Week, and Month views. You can navigate between dates and click any session to go to its detail page. Sessions are color-coded:
              <Steps>
                <li><B>Blue</B> — normal public sessions.</li>
                <li><B>Violet</B> — private sessions.</li>
                <li><B>Amber</B> — fully booked sessions.</li>
                <li><B>Gray</B> — cancelled sessions.</li>
                <li><B>Teal</B> — instructor room bookings (shown with a &quot;Room&quot; badge).</li>
              </Steps>
              Each card shows the class name, time, instructor, and booking count. Classes with a room show a teal room badge. Online classes display a camera icon. A red line indicates the current time.
            </>
          ),
        },
        {
          q: "How do I add sessions to a class?",
          a: (
            <>
              Open a class from the <B>Schedule</B> page. Sessions are created automatically based on the class schedule. You can also manually add individual sessions with specific dates from the class detail page.
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
                <li>To change visibility for an individual session, go to <B>Schedule → [Class] → [Session]</B> and click the visibility toggle.</li>
              </Steps>
              <Tip>Private sessions still count for room availability — they prevent double-booking even though members can&apos;t see them.</Tip>
            </>
          ),
        },
        {
          q: "What are class templates?",
          a: (
            <>
              Class templates are reusable blueprints for your classes. Each template stores the class name, description, duration, capacity, class type (in-person, online, or hybrid), optional pricing, and assigned instructor. Templates make it faster to create new classes without re-entering the same details each time.
              <Steps>
                <li>Go to <B>Classes</B> in the sidebar to see all templates in a grid view.</li>
                <li>Click <B>+ New Template</B> to create one. Fill in the name, class type, duration, capacity, price, and instructor.</li>
                <li>Click any template card to edit its details, or click <B>Schedule</B> to create a session from it.</li>
                <li>Templates can be deactivated from the edit page &mdash; they won&apos;t appear in the list but can be restored later.</li>
              </Steps>
              <Tip>Instructors can also create and manage their own templates. Owners and managers can see and edit all templates for the studio.</Tip>
            </>
          ),
        },
        {
          q: "How do I set the class duration?",
          a: (
            <>
              When creating or editing a class template, choose the duration using the <B>hours</B> and <B>minutes</B> selectors. For example, select &quot;1&quot; hour and &quot;30&quot; minutes for a 90-minute class. Durations are available in 15-minute increments.
            </>
          ),
        },
        {
          q: "Can I add an image to my classes?",
          a: (
            <>
              Yes! When creating or editing a class template, you can upload a photo or logo using the <B>Class Image</B> field. Supported formats are JPG, PNG, and WebP (max 2MB). This image will appear on your class list, your members&apos; booking page, and your WordPress widget.
            </>
          ),
        },
        {
          q: "How do I find a specific class?",
          a: (
            <>
              On the <B>Classes</B> page, use the search bar to find classes by name or instructor. You can also filter by day of the week using the day tabs, or sort by name, day, instructor, or creation date.
            </>
          ),
        },
        {
          q: "Can I import classes in bulk?",
          a: (
            <>
              Yes. Go to <B>Schedule → Import CSV</B>. Upload a CSV file with the class details. This is useful when migrating from another system.
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
              Go to <B>Rooms</B> from the sidebar. The default view shows a <B>Room Usage</B> timeline for the day, with all rooms and their bookings. To add or edit rooms, click <B>Manage Rooms</B>.
              <Steps>
                <li><B>Add rooms</B> — click &quot;Manage Rooms → + Add room&quot; and enter name, capacity, and description.</li>
                <li><B>Assign rooms to classes</B> — when creating or editing a class, select a room from the dropdown.</li>
                <li><B>View room usage</B> — the Rooms page shows all room bookings and class sessions in a daily timeline view.</li>
              </Steps>
              If you also teach classes (owner-instructor), a <B>Book Room</B> tab appears on the Rooms page so you can create room bookings directly.
              <Tip>Room bookings also appear on the Schedule calendar (in teal), so you can see classes and room usage together.</Tip>
            </>
          ),
        },
        {
          q: "How do I delete a room?",
          a: (
            <>
              Go to <B>Rooms → Manage Rooms</B>, click <B>Edit</B> on the room you want to remove, then scroll down to the <B>Danger zone</B> section and click <B>Delete room</B>.
              <Tip>If the room has upcoming sessions, you&apos;ll need to cancel or reassign them before you can delete it. Past session data is preserved.</Tip>
            </>
          ),
        },
        {
          q: "Can I see room bookings on the calendar?",
          a: (
            <>
              Yes. Instructor room bookings are shown on the <B>Schedule</B> calendar alongside class sessions. Room bookings appear in <B>teal</B> with a &quot;Room&quot; badge to distinguish them from classes.
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
        {
          q: "How do I record drop-in attendance?",
          a: (
            <>
              On the session attendance page, click the <B>Drop-in</B> tab. Search for the member and click <B>Add</B>. The member&apos;s credit will be deducted automatically. If the deduction was a mistake, click <B>Undo</B> to reverse it.
              <Tip>Drop-in attendees are listed separately from booked members and are counted in the total attendance.</Tip>
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
          q: "How do I change my studio's currency?",
          a: (
            <>
              Go to <B>Settings → Studio Currency</B> and select your preferred currency from the dropdown. Supported currencies are USD, CAD, AUD, GBP, and EUR. This affects all member-facing pricing (classes, passes, events, memberships).
              <Tip>Your studio currency must match your Stripe account&apos;s default currency. Your Klasly platform subscription remains in USD regardless of this setting.</Tip>
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
              Go to <B>Settings → Widget</B> to set up and customize the embeddable schedule:
              <Steps>
                <li>Toggle <B>Enable Widget</B> to turn on the public schedule.</li>
                <li>Choose a <B>Theme Color</B> (green, blue, purple, red, orange, pink, or teal).</li>
                <li>Add your website&apos;s domain to the <B>Allowed Origins</B> list (e.g., yourstudio.com).</li>
                <li>Copy the <B>embed code</B> and paste it into your website&apos;s HTML.</li>
              </Steps>
              <Tip>The widget works with any website builder — WordPress, Wix, Squarespace, or custom HTML. Only the studio owner can change widget settings.</Tip>
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
              Yes. Go to <B>Settings → Studio Features</B> and enable <B>I Also Teach Classes</B>. This adds you as an instructor in your studio. A <B>My Classes</B> and <B>My Earnings</B> section will appear in your sidebar where you can create and manage classes you personally teach, view your earnings, and connect your Stripe account for direct payouts.
              <Tip>When creating classes from the regular Classes page, your name will appear in the instructor dropdown with &quot;(Me)&quot; next to it.</Tip>
            </>
          ),
        },
        {
          q: "Can a manager also teach classes?",
          a: (
            <>
              Yes. Go to <B>Managers</B> in the sidebar, find the manager, and enable the <B>Teach Classes</B> permission. Once enabled, the manager can go to <B>Settings → I Also Teach Classes</B> to activate instructor mode. They will see <B>My Classes</B> and <B>My Earnings</B> in their sidebar and can connect their own Stripe account for direct payouts.
            </>
          ),
        },
        {
          q: "How do I manage email notification preferences?",
          a: (
            <>
              Go to <B>Settings &rarr; Notifications</B>. You can toggle individual email notification types on or off, including:
              <Steps>
                <li><B>Booking confirmations</B> &mdash; sent when you or a member books a class.</li>
                <li><B>Cancellation notices</B> &mdash; sent when a booking is cancelled.</li>
                <li><B>Class changes</B> &mdash; sent when a class time or details change.</li>
                <li><B>Payment receipts</B> &mdash; sent when a payment is processed.</li>
                <li><B>Waiver requests</B> &mdash; sent when a waiver needs signing.</li>
                <li><B>New messages</B> &mdash; sent when you receive an in-app message.</li>
                <li><B>Waitlist updates</B> &mdash; sent when promoted from a waitlist.</li>
                <li><B>Event reminders</B> &mdash; sent for upcoming events and retreats.</li>
              </Steps>
              <Tip>Important account notifications like password resets and security alerts cannot be turned off.</Tip>
            </>
          ),
        },
        {
          q: "What are the help tips I see next to labels?",
          a: (
            <>
              The small <B>? icons</B> next to form labels and section headings are context help tips. Hover (or tap on mobile) to see a short explanation of the field. Many tips include a <B>Learn more</B> link that jumps to the relevant section of this help page.
            </>
          ),
        },
        {
          q: "How do I navigate the settings pages?",
          a: (
            <>
              All settings pages now include a <B>side navigation bar</B> grouped by category:
              <Steps>
                <li><B>Payments &amp; Billing</B> — Studio Currency, Stripe Connect, Products &amp; Pricing, Subscription.</li>
                <li><B>Scheduling</B> — Widget (Embed).</li>
                <li><B>Forms &amp; Waivers</B> — Waiver Template.</li>
                <li><B>Collective Mode</B> — Collective Setup, Rooms, Tiers, Payout (visible only in Collective Mode).</li>
                <li><B>Studio</B> — Features, Referral, Notifications, Account, Support.</li>
              </Steps>
              <Tip>Click any item in the side nav to jump directly to that settings page. The active page is highlighted.</Tip>
            </>
          ),
        },
        {
          q: "How do I delete my studio account?",
          a: (
            <>
              Go to <B>Settings</B> and scroll to the <B>Danger Zone</B> section. To delete your account, you must type your <B>studio name</B> exactly to confirm. Deleting your account will:
              <Steps>
                <li>Cancel all active Stripe subscriptions (studio plan, member plans, passes, and instructor memberships).</li>
                <li>Permanently remove all studio data including classes, sessions, bookings, members, and instructors.</li>
                <li>Delete all associated user accounts.</li>
              </Steps>
              <Tip>This action is irreversible. Make sure to export any data you need before deleting your account.</Tip>
            </>
          ),
        },
        {
          q: "Why do I see a confirmation dialog before deleting or deactivating?",
          a: (
            <>
              Destructive actions like deleting a member, deleting an instructor, deactivating a class, cancelling a booking, or deleting your account now show a <B>confirmation dialog</B> before proceeding. This helps prevent accidental data loss. You can dismiss the dialog by clicking <B>Cancel</B> or pressing <B>Escape</B>.
            </>
          ),
        },
        {
          q: "What do the detailed error messages mean?",
          a: (
            <>
              When something goes wrong (e.g. a booking conflict, insufficient credits, or a payment failure), Klasly now shows a detailed error message with a <B>title</B>, <B>description</B>, and sometimes a <B>suggested action link</B> to help you resolve the issue quickly. You can dismiss the error by clicking the <B>X</B> button.
            </>
          ),
        },
        {
          q: "What is the Registration Funnel on the admin dashboard?",
          a: (
            <>
              The <B>Registration Funnel</B> shows how many users are at each stage of the signup journey: <B>Signed Up</B>, <B>Studio Created</B>, <B>Payment Complete</B>, <B>Tour Complete</B>, and <B>Active Use</B>. The conversion percentage between stages helps identify where users drop off.
            </>
          ),
        },
        {
          q: "How does the User Journey table work?",
          a: (
            <>
              The <B>User Journey</B> table lists each studio owner with their current stage, setup progress (classes, instructors, members, Stripe Connect), and creation date. You can filter by stage to find users who need attention. Click <B>View</B> to go to the studio detail page.
            </>
          ),
        },
        {
          q: "How can I see if studio staff are actively using the platform?",
          a: (
            <>
              On the <B>Studio Detail</B> page (Admin &gt; Studios &gt; click a studio), scroll to the <B>User Activity</B> section. It shows the last login time and activity status for each owner, manager, and instructor. Users are marked as <B>Active</B> (logged in within 30 days), <B>Inactive</B> (30-90 days), or <B>Dormant</B> (90+ days or never logged in).
            </>
          ),
        },
        {
          q: "Will I get notified when a new studio signs up?",
          a: (
            <>
              Yes. When a new studio is created, an email notification is automatically sent to all admin email addresses configured in the <B>ADMIN_EMAILS</B> environment variable.
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
              Instructors can find SOAP Notes in their sidebar under <B>SOAP Notes</B>. Select a member to view their history or create a new note:
              <Steps>
                <li>Click <B>SOAP Notes</B> in the sidebar, then select a member from the list.</li>
                <li>Click <B>+ New Note</B> and fill in the Subjective, Objective, Assessment, and Plan fields.</li>
                <li>Choose whether the note is <B>confidential</B> (visible only to you) or <B>shared</B> (also visible to the studio owner).</li>
                <li>Click <B>Save</B>. The note is linked to the session date.</li>
              </Steps>
              <Tip>SOAP Notes must be enabled under Settings → Features before they appear in the sidebar.</Tip>
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
        {
          q: "Is there an easy way to build UTM links?",
          a: (
            <>
              Yes. On the <B>Analytics</B> page, scroll down to the <B>Link Builder</B> section. Pick a preset (Instagram, Facebook, Email, Google) or type in custom source, medium, and campaign values. The tracking URL is generated automatically — click <B>Copy</B> to use it.
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
              Yes. Go to <B>Schedule → [Class Name]</B> and change the Class Type in the edit form. Switching to online will clear the room and location, and switching to in-person will clear the online link.
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
              Go to <B>Settings &rarr; Features</B> to toggle optional features on or off. Available features include Online Classes, Digital Waivers, SOAP Notes, UTM Tracking, Events &amp; Retreats, and more. At the top of the page, you&apos;ll see a <B>Recommended for your studio</B> banner showing popular features you haven&apos;t enabled yet.
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
        {
          q: "What is the Application Form?",
          a: (
            <>
              In Step 5 of the event creator (or editor), you can add custom questions that guests must answer during checkout. Supported field types include short text, long text, dropdown, radio buttons, and checkboxes. Mark fields as required to ensure guests provide the information before completing their booking. Responses are saved with each booking record.
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
          q: "Can I manually assign a pass to a member?",
          a: (
            <>
              Yes. As the studio owner, you can assign a pass to a member without requiring them to go through Stripe checkout. This is useful for complimentary memberships or manual billing arrangements. The assigned pass works the same as a self-subscribed pass — the member can book classes using it immediately.
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
    {
      title: "Overage Billing",
      items: [
        {
          q: "How does overage billing work?",
          a: (
            <>
              When an instructor uses more hours than their tier includes, the extra time is charged at the overage rate you set. Charges are calculated at the end of each month and billed automatically. You can waive charges before they&apos;re processed.
              <Steps>
                <li>Go to <B>Settings &gt; Tiers</B> and edit a tier.</li>
                <li>Choose <B>&quot;Allow overage with hourly charge&quot;</B> and set the rate.</li>
                <li>At the end of each month, overage is calculated and charged automatically.</li>
                <li>View and manage charges under <B>Settings &gt; Tiers &gt; Overage Charges</B>.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "Can I block instructors from going over their limit?",
          a: (
            <>
              Yes. When editing a tier, select <B>&quot;Block scheduling when limit is reached&quot;</B>. Instructors won&apos;t be able to schedule room bookings beyond their monthly hours.
            </>
          ),
        },
        {
          q: "How is the overage amount calculated?",
          a: (
            <>
              Overage is calculated proportionally based on the actual minutes used. For example, 1 hour and 15 minutes of overage at $25/hour = $31.25.
              <Tip>Instructors are warned when they approach 90% of their monthly limit and again when they exceed it.</Tip>
            </>
          ),
        },
        {
          q: "Can I waive an overage charge?",
          a: (
            <>
              Yes. Go to <B>Settings &gt; Tiers &gt; Overage Charges</B>, find the charge, and click <B>Waive</B>. If the charge has already been processed, a refund will be issued automatically.
            </>
          ),
        },
      ],
    },
    {
      title: "Messaging",

      items: [
        {
          q: "How do I send a message to a member?",
          a: (
            <>
              Go to <B>Messages</B> in the sidebar. You&apos;ll see a list of all your studio members. Click on a member to open the conversation and type your message.
              <Tip>You can also start a conversation from a member&apos;s profile page.</Tip>
            </>
          ),
        },
        {
          q: "Who can send messages?",
          a: (
            <>
              <B>Owners</B> can message any member. <B>Managers</B> with the &quot;Messages&quot; permission can also message all members. <B>Members</B> can only reply to messages from the studio (owner or manager).
            </>
          ),
        },
        {
          q: "How do I know if I have unread messages?",
          a: (
            <>
              A red badge appears on the <B>Messages</B> link in the sidebar showing the number of unread messages. The badge updates automatically.
            </>
          ),
        },
      ],
    },
    {
      title: "Manager Role",

      items: [
        {
          q: "How do I add a manager?",
          a: (
            <>
              Go to <B>Managers</B> in the sidebar and click <B>+ Invite manager</B>. Enter the person&apos;s email address. They&apos;ll receive an invitation to join your studio as a manager.
            </>
          ),
        },
        {
          q: "What permissions can I give a manager?",
          a: (
            <>
              Each manager has 8 permission toggles:
              <Steps>
                <li><B>Members</B> — create, edit, and view member profiles and credits.</li>
                <li><B>Classes</B> — create and edit class templates, sessions, and schedules.</li>
                <li><B>Instructors</B> — invite, edit, and remove instructors.</li>
                <li><B>Bookings</B> — view bookings, manage attendance, cancel bookings, and manage events.</li>
                <li><B>Rooms</B> — create, edit, and manage studio rooms.</li>
                <li><B>Payments</B> — view payment history, passes, and export reports.</li>
                <li><B>Messages</B> — send messages and announcements to members.</li>
                <li><B>Teach</B> — register as an instructor and teach classes.</li>
              </Steps>
              <Tip>Hover over each permission badge to see what it controls.</Tip>
            </>
          ),
        },
        {
          q: "Can I remove a manager?",
          a: (
            <>
              Yes. Go to <B>Managers</B>, find the manager, and click <B>Remove</B>. You&apos;ll see a confirmation before the manager is removed. Their role will revert to member.
            </>
          ),
        },
      ],
    },
    {
      title: "Payout Settings",

      items: [
        {
          q: "What is the difference between Studio Mode and Collective Mode?",
          a: (
            <>
              <B>Studio Mode</B>: All payments go to the studio&apos;s Stripe account. Instructors are paid separately (e.g., salary or manual transfer).
              <br /><br />
              <B>Collective Mode</B>: Payments are split automatically. Each instructor connects their own Stripe account, and earnings are distributed after deducting the studio fee.
            </>
          ),
        },
        {
          q: "How do I set the studio fee?",
          a: (
            <>
              Go to <B>Settings &gt; Payout</B>. Choose between a <B>percentage</B> (e.g., 20%) or <B>fixed amount</B> (e.g., $5 per booking). You can also set per-instructor fee overrides if some instructors have different rates.
            </>
          ),
        },
      ],
    },
    {
      title: "Collective Mode Setup",

      items: [
        {
          q: "What is the Collective Mode Setup wizard?",
          a: (
            <>
              The <B>Collective Mode Setup</B> page (found at <B>Settings &gt; Collective Mode Setup</B>) is a step-by-step checklist that guides you through configuring your shared studio. It tracks your progress across four steps: setting up rooms, defining membership tiers, configuring the studio fee, and inviting your first instructor.
            </>
          ),
        },
        {
          q: "What are the four setup steps?",
          a: (
            <>
              <Steps>
                <li><B>Set up your rooms</B> &mdash; Define the physical spaces instructors can book (e.g., Main Studio, Practitioner Room).</li>
                <li><B>Define membership tiers</B> &mdash; Create monthly tiers with different hour allowances and prices.</li>
                <li><B>Set your Studio Fee</B> &mdash; Choose the percentage deducted from instructor transactions.</li>
                <li><B>Invite your first instructor</B> &mdash; Send an email invitation so they can join, connect Stripe, and pick a tier.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "How do I know which steps are complete?",
          a: (
            <>
              Each completed step shows a green check mark and is visually dimmed. The page header shows a progress counter (e.g., 2/4 done). When all four steps are finished, a success banner confirms your Collective Mode is fully configured.
            </>
          ),
        },
      ],
    },
    {
      title: "Billing & Subscription",

      items: [
        {
          q: "How do I manage my subscription?",
          a: (
            <>
              Go to <B>Settings &gt; Billing</B> to view your current plan, switch between monthly and yearly, update your payment method, apply promo codes, or cancel.
            </>
          ),
        },
        {
          q: "What happens if my payment fails?",
          a: (
            <>
              If a payment fails, your plan status changes to <B>Past Due</B>. You&apos;ll see an alert on the dashboard and billing page prompting you to update your payment method. If not resolved, your account enters a <B>Grace Period</B> with limited access.
            </>
          ),
        },
      ],
    },
    {
      title: "CSV Import & Export",

      items: [
        {
          q: "How do I bulk import members?",
          a: (
            <>
              <Steps>
                <li>Go to <B>Members</B> and click <B>Import CSV</B>.</li>
                <li>Download the CSV template and fill it with your member data.</li>
                <li>Upload the file and map columns to fields.</li>
                <li>Review the preview and click <B>Import</B>.</li>
              </Steps>
              <Tip>The import will skip rows with invalid email addresses and show you which rows were skipped.</Tip>
            </>
          ),
        },
        {
          q: "What data can I export?",
          a: (
            <>
              You can export <B>Members</B>, <B>Instructors</B>, <B>Classes</B>, <B>Bookings</B>, and <B>Payments</B> as CSV files. Look for the <B>Export CSV</B> button on each page.
            </>
          ),
        },
      ],
    },
    {
      title: "Support",

      items: [
        {
          q: "How do I contact support?",
          a: (
            <>
              Go to <B>Settings &gt; Support</B> and click <B>New Ticket</B>. Describe your issue and our team will respond within the thread. You can check the status of your tickets at any time.
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
        {
          q: "What is the welcome message on the Dashboard?",
          a: (
            <>
              If you haven&apos;t completed the onboarding tutorial yet, you&apos;ll see a <B>Welcome to Klasly</B> card at the top of your Dashboard. It explains what you can do from your instructor portal — Schedule, Attendance, Profile, and Earnings. The message disappears automatically once you complete the tutorial.
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
              Use the Previous/Next Week buttons to navigate between weeks. Your schedule shows both class sessions and room-only bookings. Class sessions appear in green, while room bookings appear in teal with a &quot;Room&quot; badge. Each session displays the date, time range, class or room name, and booking count (for classes).
            </>
          ),
        },
        {
          q: "What are the different session types on my schedule?",
          a: (
            <>
              Your schedule includes two types of sessions:
              <Steps>
                <li><B>Class sessions</B> — regular classes with booking counts and capacity. Click to view the session detail page.</li>
                <li><B>Room-only bookings</B> — time slots you&apos;ve reserved in a room without a class. These are shown with a teal &quot;Room&quot; badge.</li>
              </Steps>
            </>
          ),
        },
        {
          q: "How do I take attendance?",
          a: (
            <>
              Click on any class session in your schedule to open the session detail page. You&apos;ll see the list of booked members. Mark each member as present or absent. Attendance is saved automatically.
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
          q: "How do I create an online or hybrid class?",
          a: (
            <>
              When creating a class, choose <B>Class Type</B>:
              <Steps>
                <li><B>In-person</B> — a regular class held at the studio (default).</li>
                <li><B>Online</B> — a virtual class. Add your Zoom or Google Meet link. No room needed.</li>
                <li><B>Hybrid</B> — students can attend in-person or online. Add a room and an online link.</li>
              </Steps>
              <Tip>Online classes don&apos;t require a room booking, so you can create them without booking a studio room first.</Tip>
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
              Open the <B>Room Calendar</B> page. Click an empty time slot to open the session form. You can choose:
              <Steps>
                <li><B>Room only</B> — a simple room reservation with a custom title (no class attached).</li>
                <li><B>Class template</B> — select a template from the dropdown to create a class session in that room. The duration auto-fills from the template.</li>
              </Steps>
              Choose <B>Single</B> for one date, or <B>Weekly</B> to repeat the booking for multiple weeks. The system checks for conflicts and prevents double-booking.
              <Tip>If you don&apos;t have an active membership yet, you&apos;ll see a reminder to purchase one before booking. This ensures your hours are tracked correctly.</Tip>
            </>
          ),
        },
        {
          q: "Can I create recurring room bookings?",
          a: (
            <>
              Yes. When booking a room, select <B>Recurring (weekly)</B>. Choose a day of week, start and end times, and the number of weeks. Individual bookings will be created for each week, so you can cancel individual dates if needed.
            </>
          ),
        },
        {
          q: "How do I view my room bookings?",
          a: (
            <>
              Go to <B>Room Bookings</B> from the sidebar to see all your room reservations with date, time, and room name. Recurring bookings are marked with a <B>Recurring</B> badge.
            </>
          ),
        },
        {
          q: "How do I cancel a room booking?",
          a: (
            <>
              On the Room Bookings page, click <B>Cancel</B> to cancel a single booking. For recurring bookings, you can also click <B>Cancel all future</B> to cancel all remaining bookings in the series.
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
    {
      title: "Overage & Hour Limits",
      items: [
        {
          q: "What happens if I go over my monthly hours?",
          a: (
            <>
              Depending on your studio&apos;s settings, you may be charged an overage fee at the end of the month. You&apos;ll see a warning when approaching your limit, and your current usage is always visible on your dashboard.
              <Tip>Check the quota bar on your Room Bookings page to see how many hours you&apos;ve used this month.</Tip>
            </>
          ),
        },
        {
          q: "How are overage charges calculated?",
          a: (
            <>
              Overage is calculated based on actual minutes used beyond your tier&apos;s monthly limit, at the hourly rate set by your studio. The charge appears at the end of the month.
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
        {
          q: "Can I use Klasly on my phone?",
          a: (
            <>
              Yes! Klasly is fully optimized for mobile devices. You can access all features — browsing schedules, booking classes, viewing payments, and messaging — directly from your phone&apos;s browser. On mobile, a <B>bottom navigation bar</B> gives you quick access to Schedule, Bookings, Credits, and Account. On iPhone, the app also supports the notch and home bar areas for a seamless experience.
              <Tip>On mobile, the schedule defaults to Day view for easier one-handed browsing. Use the bottom navigation bar for quick access to key sections.</Tip>
            </>
          ),
        },
        {
          q: "Can I use Klasly without internet?",
          a: (
            <>
              You can view your recently loaded schedule and class information even when offline. However, booking classes, making payments, and sending messages require an internet connection.
            </>
          ),
        },
        {
          q: "What is the welcome message on the Schedule page?",
          a: (
            <>
              If you haven&apos;t completed the onboarding tutorial yet, you&apos;ll see a <B>Welcome</B> card at the top of the Schedule page. It walks you through three steps: browse the schedule, book a class, and check your bookings. It also links to a detailed booking guide. The message disappears once you complete the tutorial.
            </>
          ),
        },
        {
          q: 'I see "Update Available" — what should I do?',
          a: (
            <>
              Tap <B>Update Now</B> to refresh the app with the latest improvements. This won&apos;t affect your bookings or account.
            </>
          ),
        },
        {
          q: "How do I enable push notifications?",
          a: (
            <>
              When you first visit your studio&apos;s Klasly page, you&apos;ll see a prompt to enable notifications. Tap <B>Enable Notifications</B> to start receiving class reminders and booking updates. You can also enable them from <B>Settings</B> in the navigation.
            </>
          ),
        },
        {
          q: "How do I turn off push notifications?",
          a: (
            <>
              Go to <B>Settings</B> and toggle off <B>Push Notifications</B>. You can also disable specific notification types while keeping others on.
            </>
          ),
        },
        {
          q: "I'm not receiving notifications on iPhone. What should I do?",
          a: (
            <>
              On iPhone (iOS 16.4 or later), push notifications only work when Klasly is added to your Home Screen. Open Klasly in Safari, tap the <B>Share</B> button, then tap <B>Add to Home Screen</B>. After that, enable notifications when prompted.
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
              Visit the event page, select a room or option, then choose your payment method (full or 3 installments). Some events include an application form with additional questions you need to fill out before checkout. Complete checkout with your card &mdash; you&apos;ll receive a confirmation email.
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
      title: "Messages",
      items: [
        {
          q: "How do I message my studio?",
          a: (
            <>
              Go to <B>Messages</B> from the navigation menu. You can send and receive messages directly with your studio. Type your message and press <B>Enter</B> (or the send button) to send.
            </>
          ),
        },
        {
          q: "Will I be notified about new messages?",
          a: (
            <>
              Yes. A red badge appears on the <B>Messages</B> link when you have unread messages. Open the messages page to read and reply.
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
