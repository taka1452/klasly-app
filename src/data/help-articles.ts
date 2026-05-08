import { HelpArticle } from '@/types/help';

export const helpArticles: HelpArticle[] = [

  // ═══════════════════════════════════════
  // GETTING STARTED
  // ═══════════════════════════════════════

  {
    id: 'studio-setup-overview',
    title: 'Set up your studio',
    summary: 'A step-by-step guide to get your studio ready for members.',
    category: 'getting-started',
    audience: ['owner'],
    keywords: ['setup', 'start', 'new', 'first', 'onboarding', 'begin'],
    steps: [
      {
        title: 'Create your studio',
        description: 'After signing up, you\'ll be guided through creating your studio profile — name, timezone, and business type.',
      },
      {
        title: 'Choose your mode',
        description: 'Select Studio Mode (you run everything) or Collective Mode (instructors rent your space and run their own business).',
      },
      {
        title: 'Connect Stripe',
        description: 'Go to Settings → Payments → Connect Stripe. This lets you accept payments from members. Follow the Stripe onboarding — it takes about 5 minutes.',
      },
      {
        title: 'Create your first class',
        description: 'Go to Classes → Create Class. Set the name, day, time, duration, capacity, and instructor. Sessions will be auto-generated.',
      },
      {
        title: 'Add your members',
        description: 'Go to Members → Add Member to add one at a time, or use Import CSV to add many members at once.',
      },
      {
        title: 'Set up your waiver (optional)',
        description: 'Go to Waivers → Edit Template to customize your waiver. You can send it to all members with one click.',
      },
    ],
    tips: [
      'You can always change your mode later in Settings → Features.',
      'Use the setup checklist on your Dashboard to track your progress.',
    ],
    relatedArticles: ['connect-stripe', 'create-recurring-class', 'import-members-csv'],
  },

  {
    id: 'connect-stripe',
    title: 'Connect Stripe to accept payments',
    summary: 'Link your Stripe account so members can pay online. Pick the right country up front — postal / phone / bank formats follow.',
    category: 'getting-started',
    audience: ['owner'],
    keywords: ['stripe', 'payment', 'connect', 'bank', 'money', 'payout', 'country', 'postal code', 'disconnect'],
    steps: [
      {
        title: 'Choose your business country',
        description: 'Settings → Stripe Connect. Pick the Business country (defaults to your studio\'s timezone — change it if your business is registered elsewhere). This determines the postal code, phone, and bank account formats Stripe will ask for.',
      },
      {
        title: 'Click "Connect with Stripe"',
        description: 'You\'ll be redirected to Stripe\'s secure onboarding — enter your business type, legal details, and bank account. This typically takes about 5 minutes.',
      },
      {
        title: 'Return to Klasly',
        description: 'Once complete, you\'ll see a ✅ Stripe Connected status. Member payments now go directly to your Stripe account.',
      },
    ],
    tips: [
      'If setup is incomplete (e.g., you left Stripe\'s page mid-way), return to Settings → Stripe Connect and click "Continue Setup."',
      'Stripe doesn\'t allow changing a Connect account\'s country after it\'s created. If the postal code or phone format doesn\'t match your country, click Disconnect and start over while onboarding is still in progress — pick the correct country and reconnect. The old account is abandoned and can be deleted from your Stripe dashboard later.',
      'Stripe Connect must be set up before members can purchase credits, subscriptions, or studio passes.',
      'You need a bank account and government ID to complete Stripe setup.',
      'Stripe may take 1-2 business days to verify your account. You can still set up classes in the meantime.',
    ],
    relatedArticles: ['studio-setup-overview', 'create-products'],
  },

  {
    id: 'understanding-roles',
    title: 'Understand user roles',
    summary: 'Learn what each role can do — Owner, Manager, Instructor, and Member.',
    category: 'getting-started',
    audience: ['owner', 'manager'],
    keywords: ['role', 'permission', 'owner', 'manager', 'instructor', 'member', 'access'],
    steps: [
      {
        title: 'Owner',
        description: 'Full access to everything. Can manage settings, billing, instructors, members, and all features. There is one Owner per studio.',
      },
      {
        title: 'Manager',
        description: 'Same as Owner, except they cannot change Stripe settings, billing, or delete the studio. Good for trusted staff. Assign in Instructors → Edit → Toggle "Manager".',
      },
      {
        title: 'Instructor',
        description: 'Can view their own schedule, manage attendance for their classes, edit their profile, and view their earnings. In Collective Mode, instructors can also create their own classes and set prices.',
      },
      {
        title: 'Member',
        description: 'Can view the schedule, book classes, manage their payments and subscriptions, and sign waivers. Members see a simplified interface.',
      },
    ],
    tips: [
      'A person can hold more than one role. For example, an instructor who also takes classes appears on both the Instructors and Members lists. Cross-role badges make this visible: members who are also instructors show a violet "Instructor" badge, and instructors who are also members show a sky-blue "Member" badge. Click the badge to jump to their other profile.',
    ],
    relatedArticles: ['invite-instructor', 'assign-manager-role'],
  },

  {
    id: 'free-trial',
    title: 'Free trial and billing',
    summary: 'Every new studio gets a 30-day free trial with full access to all features.',
    category: 'getting-started',
    audience: ['owner'],
    keywords: ['trial', 'free', 'billing', 'plan', 'subscription', 'cancel', 'charge'],
    steps: [
      {
        title: 'Start your free trial',
        description: 'Every new studio gets a 30-day free trial with full access to all features. No credit card required to start.',
      },
      {
        title: 'Manage your subscription',
        description: 'Go to Settings → Billing to view your current plan, switch between Monthly and Yearly, update your payment method, or cancel.',
      },
      {
        title: 'What happens if payment fails',
        description: 'Your plan status changes to "Past Due". You\'ll see an alert on the dashboard and billing page prompting you to update your payment method.',
      },
    ],
    tips: [
      'You won\'t be charged until the trial ends. Cancel anytime during the trial at Settings → Billing.',
    ],
    relatedArticles: ['studio-setup-overview', 'connect-stripe'],
  },

  {
    id: 'push-notifications-overview',
    title: 'Push notifications',
    summary: 'Members receive class reminders, booking confirmations, and new messages automatically.',
    category: 'getting-started',
    audience: ['owner'],
    keywords: ['push', 'notification', 'alert', 'reminder', 'bell'],
    steps: [
      {
        title: 'How it works',
        description: 'Push notifications are alerts that appear on your members\' phones and computers — even when they\'re not using Klasly. Members receive reminders 1 hour before class, booking confirmations, and new messages.',
      },
      {
        title: 'No setup needed',
        description: 'Push notifications work automatically. When members visit your Klasly booking page, they\'ll be asked if they\'d like to receive notifications.',
      },
    ],
    tips: [
      'Members can enable or disable notifications in their settings.',
    ],
    relatedArticles: ['studio-setup-overview', 'staff-notifications-overview'],
  },

  {
    id: 'staff-notifications-overview',
    title: 'Staff notifications & motivation features',
    summary: 'Owners, managers, and instructors get role-specific automated notifications and recap emails — designed to surface what matters and keep momentum.',
    category: 'getting-started',
    audience: ['owner', 'manager', 'instructor'],
    keywords: ['staff', 'notification', 'motivation', 'morning', 'briefing', 'recap', 'summary', 'review', 'birthday', 'low fill', 'todo'],
    steps: [
      {
        title: 'Owner — Monday weekly summary email',
        description: 'Every Monday morning you get an email with last week\'s revenue (with delta vs. the prior week), new and cancelled members, your top three classes by bookings, and your top instructor. The aim is that you no longer need to log in just to check the numbers.',
      },
      {
        title: 'Owner & manager — daily morning todo push',
        description: 'A single push every morning surfacing what needs attention today: waitlisted bookings, recently failed payments, passes expiring within 7 days, and tomorrow\'s classes that are under 50% filled. If everything is clear, the notification says so.',
      },
      {
        title: 'Instructor — morning briefing push',
        description: 'Every morning instructors get a push showing how many classes they teach today, total student count, how many are new faces, and a loyalty highlight when a student is on a 3+ week booking streak.',
      },
      {
        title: 'Instructor — instant review push',
        description: 'When a student leaves a class review, the instructor gets a push with the star rating and class name immediately — so the dopamine hit doesn\'t get lost in an inbox.',
      },
      {
        title: 'Instructor — low-fill warning the night before',
        description: 'In the evening, instructors get a push for any class they\'re teaching tomorrow that\'s under 50% filled, giving them time to share on socials. Tapping the push opens My Classes scoped to that class.',
      },
      {
        title: 'Instructor — birthday alerts',
        description: 'When a recent student (attended in the last 60 days) has a birthday today, their instructors get a quick "Birthday today: {name}" push so they can say hello in person.',
      },
      {
        title: 'Instructor — monthly recap email',
        description: 'On the 1st of each month, instructors get an email with prior-month earnings and delta vs. the previous month, classes taught, unique students served, and average review rating. Hitting an all-time-high month also surfaces a "Personal best" badge.',
      },
      {
        title: 'Instructor — sold-out celebration push',
        description: 'When a booking fills the last seat in one of your classes, you get an immediate "Sold out 🎉" push so the win lands in the moment.',
      },
      {
        title: 'In-app motivational touches',
        description: 'My Earnings counts your totals up smoothly when the month switches, shows a 🏆 badge when the selected month is your all-time best (with a one-time confetti burst), and shows a 🔥 streak badge when you have 3+ consecutive earning months. The Reviews page glows the newest review you haven\'t seen yet. The dashboard greeting changes with the time of day. Owners\' Monday email also calls out 📈 multi-week growth streaks.',
      },
    ],
    tips: [
      'Notifications respect each user\'s push preferences in Settings — anything they\'ve disabled is skipped.',
      'Cron schedules live in vercel.json. Times are UTC; adjust if your studio operates on a markedly different time zone and you want briefings to land closer to local morning.',
      'Failed payments in the daily todo look back 7 days so nothing slips through if you miss a day.',
    ],
    relatedArticles: ['push-notifications-overview'],
  },

  // ═══════════════════════════════════════
  // CLASSES & SCHEDULING
  // ═══════════════════════════════════════

  {
    id: 'create-recurring-class',
    title: 'Create a recurring class',
    summary: 'Set up a class that repeats every week. Sessions are generated automatically.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['class', 'create', 'new', 'recurring', 'weekly', 'schedule', 'add', 'template'],
    steps: [
      {
        title: 'Go to Classes',
        description: 'Click "Classes" in the sidebar navigation.',
      },
      {
        title: 'Click "Create Class"',
        description: 'Fill in the class name, description, and select the type (In-person, Online, or Hybrid).',
      },
      {
        title: 'Set the schedule',
        description: 'Choose the day of the week, start time, and duration. Set the maximum capacity (how many members can attend).',
      },
      {
        title: 'Assign an instructor',
        description: 'Select the instructor who will teach this class. You can change this per session later.',
      },
      {
        title: 'Set the price (optional)',
        description: 'If members pay per class (drop-in), enter the price. If they use credits or a subscription, leave this blank.',
      },
      {
        title: 'Save',
        description: 'Click Save. Sessions will be automatically generated for the next several weeks (based on your Settings → Schedule Generation setting).',
      },
    ],
    tips: [
      'Sessions are auto-generated weekly. You don\'t need to create each session manually.',
      'You can change the generation period in Settings (4, 6, 8, or 12 weeks ahead).',
      'To create a one-time class that doesn\'t repeat, use "Create Session" on the Schedule page instead.',
      'Class templates are reusable blueprints — you can create sessions from any template.',
    ],
    relatedArticles: ['edit-cancel-session', 'import-classes-csv', 'session-generation-period'],
  },

  {
    id: 'edit-cancel-session',
    title: 'Edit or cancel a session',
    summary: 'Change time, instructor, room, or cancel — apply to one session, this and all future, or the entire series.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['session', 'edit', 'cancel', 'change', 'time', 'reschedule', 'delete', 'substitute', 'sub', 'scope', 'future', 'series'],
    steps: [
      {
        title: 'Click on the session',
        description: 'Open the Schedule page (Day / Week / Month / List view) and click the session you want to edit.',
      },
      {
        title: 'Choose the scope',
        description: 'For recurring sessions, pick This session only, This and all future sessions, or All sessions in this series. The dialog shows live "affects N sessions, M bookings" hints, and the Save button label updates to match ("Apply to 12 sessions").',
      },
      {
        title: 'Edit time, instructor, or room',
        description: 'Change start time and the end time follows automatically (Google Calendar–style). Use the Instructor picker to assign a substitute. The dialog warns in amber if the new instructor is already teaching at the same time, in red if the room conflicts.',
      },
      {
        title: 'Notify members',
        description: 'When the change touches date, time, or instructor, the "Email confirmed members" checkbox appears (default ON). Uncheck for silent fixes — typo corrections or data cleanups.',
      },
      {
        title: 'Cancel with a reason',
        description: 'Click Cancel session. The confirm row has an optional Reason field ("Instructor sick", "Snow day"). The reason saves with the session and shows on the cancelled tile so the next person knows what happened.',
      },
    ],
    tips: [
      'Cancelling refunds credits / pass uses to booked members automatically. The notify-members opt-out applies to cancel as well.',
      'Day-of-week changes still need to be handled differently — open the next upcoming session, change the date to the correct day of the week, choose "This and all future sessions", and save.',
      'For ad-hoc batches that aren\'t a recurrence series, use Bulk edit on Upcoming Sessions instead.',
      'Studio Closures (Settings → Studio Closures) automatically fills the reason as "Studio closed: [your label]" for every session it cancels.',
      'Sessions are color-coded: Blue = open, Amber = full, Violet = private, Teal = room booking, Gray = cancelled.',
    ],
    relatedArticles: ['create-recurring-class', 'schedule-visibility', 'bulk-edit-sessions', 'studio-closures', 'class-change-history'],
  },

  {
    id: 'schedule-visibility',
    title: 'Make a session private',
    summary: 'Hide a session from the member schedule while keeping it visible to staff.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager', 'instructor'],
    keywords: ['private', 'public', 'hide', 'visible', 'visibility', 'block', 'personal'],
    featureFlag: 'collective.schedule_visibility',
    prerequisites: ['Feature: Schedule Visibility must be enabled in Settings → Features.'],
    steps: [
      {
        title: 'Open the session',
        description: 'On the Schedule page, click the session you want to make private.',
      },
      {
        title: 'Change visibility',
        description: 'Set Visibility to "Private". Private sessions won\'t appear on the member schedule.',
      },
      {
        title: 'Save',
        description: 'The session will show a lock icon on the management calendar. The room is still blocked — other instructors can\'t book that time.',
      },
    ],
    tips: [
      'Use private sessions for personal practice, 1-on-1 clients, or room maintenance.',
      'Private sessions still count toward instructor hour tracking in Collective Mode.',
    ],
    relatedArticles: ['edit-cancel-session', 'collective-self-scheduling'],
  },

  {
    id: 'import-classes-csv',
    title: 'Import classes from CSV',
    summary: 'Add many classes at once using a spreadsheet file.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['csv', 'import', 'bulk', 'spreadsheet', 'upload', 'classes'],
    steps: [
      {
        title: 'Download the template',
        description: 'Go to Classes → Import CSV. Click "Download Template" to get the CSV template.',
      },
      {
        title: 'Fill in your data',
        description: 'Open the template in Excel or Google Sheets. Fill in class name, day, time, duration, and capacity for each class.',
      },
      {
        title: 'Upload the file',
        description: 'Click "Upload CSV" and select your file. Klasly will preview the data before importing.',
      },
      {
        title: 'Confirm and import',
        description: 'Review the preview. Fix any errors shown in red. Click "Import" to create all classes at once.',
      },
    ],
    tips: [
      'The CSV must use the exact column headers from the template.',
      'Save your spreadsheet as .csv (not .xlsx) before uploading.',
    ],
    relatedArticles: ['create-recurring-class', 'import-members-csv'],
  },

  {
    id: 'online-classes',
    title: 'Set up online or hybrid classes',
    summary: 'Add Zoom or Google Meet links to your classes. Members see the link only after booking.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager', 'instructor'],
    keywords: ['online', 'zoom', 'hybrid', 'virtual', 'video', 'google meet', 'link', 'remote'],
    featureFlag: 'extension.online_classes',
    prerequisites: ['Feature: Online Classes must be enabled in Settings → Features.'],
    steps: [
      {
        title: 'Create or edit a class',
        description: 'Go to Classes → Create Class (or edit an existing one).',
      },
      {
        title: 'Choose the class type',
        description: 'Select "Online" for fully virtual, or "Hybrid" if the class can be attended in-person or online.',
      },
      {
        title: 'Enter the link',
        description: 'Paste your Zoom or Google Meet URL in the "Online Link" field.',
      },
      {
        title: 'Save',
        description: 'Members will see the link only after they book. The booking confirmation email will also include the link.',
      },
    ],
    tips: [
      'For Hybrid classes, members choose "In-person" or "Online" when booking. Their choice appears as a badge on the My Bookings page and is included in the booking data.',
      'The link is hidden until the member books — this prevents unauthorized access.',
      'Online classes don\'t require a room booking.',
    ],
    relatedArticles: ['create-recurring-class', 'edit-cancel-session'],
  },

  {
    id: 'session-generation-period',
    title: 'Change how far ahead sessions are generated',
    summary: 'Control whether sessions are generated 4, 6, 8, or 12 weeks in advance.',
    category: 'classes-scheduling',
    audience: ['owner'],
    keywords: ['generation', 'weeks', 'ahead', 'advance', 'schedule', 'auto', 'cron'],
    steps: [
      {
        title: 'Go to Settings',
        description: 'Open Settings from the sidebar.',
      },
      {
        title: 'Find Schedule Generation',
        description: 'Look for the "Schedule Generation" section.',
      },
      {
        title: 'Choose the period',
        description: 'Select 4, 6, 8, or 12 weeks. The default is 8 weeks.',
      },
    ],
    tips: [
      'Changing to a shorter period won\'t delete existing sessions. It only affects new generation.',
      'Changing to a longer period will fill in the gap at the next weekly generation cycle.',
    ],
    relatedArticles: ['create-recurring-class'],
  },

  {
    id: 'manage-bookings',
    title: 'View and manage session bookings',
    summary: 'See who booked, manage waitlists, take drop-ins, and mark no-shows or late cancels.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['booking', 'attendance', 'waitlist', 'drop-in', 'confirm', 'cancel booking', 'no-show', 'no show', 'late cancel'],
    steps: [
      {
        title: 'Open the session',
        description: 'Click the class on the schedule, or go to Bookings → click on a session. You\'ll see confirmed and waitlisted members.',
      },
      {
        title: 'Add a drop-in',
        description: 'Click + Add drop-in to search for any member and book them on the spot. Their credit / pass is deducted automatically.',
      },
      {
        title: 'Mark no-show or late cancel',
        description: 'Each booked member has a Status column with quick No-show (red) and Late cancel (amber) buttons. Click either to flag the booking — the attended checkbox is automatically cleared. Click Clear on the badge to undo.',
      },
      {
        title: 'Cancel a booking',
        description: 'Click the cancel button next to a member\'s booking. Their credit is returned automatically and the first person on the waitlist is promoted.',
      },
    ],
    tips: [
      'No-show and late cancel are tracked per booking, so the same member can attend on a different session without affecting this one.',
      'Pass sessions are NOT auto-refunded on no-show — that\'s intentional, since most studios charge for no-shows. Cancel the booking instead to refund.',
      'Waitlist bookings do not consume credits. Credits are only deducted when promoted to confirmed.',
      'Drop-in attendees are listed separately and counted in total attendance.',
    ],
    relatedArticles: ['edit-cancel-session', 'create-recurring-class', 'mark-no-show-late-cancel'],
  },

  {
    id: 'manage-rooms',
    title: 'Set up and manage rooms',
    summary: 'Define studio spaces, link a client to a room booking, and filter the schedule by room.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['room', 'space', 'studio', 'practitioner', 'setup', 'manage', 'timeline', 'filter', 'client', 'pass deduct'],
    featureFlag: 'collective.room_management',
    steps: [
      {
        title: 'Add rooms',
        description: 'Rooms → Manage Rooms → + Add room. Enter name, capacity, and description.',
      },
      {
        title: 'Filter the main schedule by room',
        description: 'Above the calendar there\'s a Room dropdown. Default is All rooms; pick a specific room to see only what\'s booked there. Handy for "what\'s happening in Studio B today?" without scrolling through the rest.',
      },
      {
        title: 'Add a room booking with a client',
        description: 'Rooms → + Add booking. Pick the client (e.g. for body therapy / Reiki) and tick "Deduct one session from this client\'s pass" — one session is automatically pulled from their active pass when the booking is created. The booking detail page shows who the client is and that a session was used.',
      },
      {
        title: 'Assign rooms to classes',
        description: 'When creating or editing a class, select a room from the dropdown.',
      },
    ],
    tips: [
      'Room bookings appear on the Schedule calendar in teal with a "Room" badge.',
      'Double-booking is prevented automatically — overlapping room reservations are blocked in red.',
      'When a client is linked, that client gets a 1-hour reminder push notification before the booking, the same way class reminders work.',
      'If you cancel the booking, the deducted pass session is automatically refunded.',
      'No-show / late cancel marks on a linked client do NOT auto-refund the pass session — cancel the booking instead to refund.',
      'If you also teach classes (owner-instructor), a "Book Room" tab appears on the Rooms page.',
    ],
    relatedArticles: ['collective-overview', 'collective-self-scheduling', 'room-booking-client-pass', 'mark-no-show-late-cancel'],
  },

  {
    id: 'duplicate-class',
    title: 'Duplicate a class',
    summary: 'Create a new class from an existing one with all settings pre-filled.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['duplicate', 'copy', 'clone', 'class', 'template'],
    steps: [
      {
        title: 'Open Classes',
        description: 'On the Classes page, find the class card you want to copy.',
      },
      {
        title: 'Click Duplicate',
        description: 'Each card has a Duplicate button next to Schedule. The New Template page opens with every field pre-filled — description, duration, capacity, price, instructor, room, image, recurrence.',
      },
      {
        title: 'Tweak and save',
        description: 'Change the name (and anything else) and save. Sessions start generating immediately based on the recurrence settings you keep.',
      },
    ],
    tips: [
      'Great for variants of the same class — different times, different instructors, or seasonal versions.',
      'Rich text formatting (bold, italic, bullets) carries over, including the SafeMarkdown rendering members see.',
    ],
    relatedArticles: ['create-recurring-class', 'edit-cancel-session'],
  },

  {
    id: 'bulk-edit-sessions',
    title: 'Bulk-edit or bulk-cancel upcoming sessions',
    summary: 'Change time or instructor across many sessions at once, or cancel a batch with one click.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['bulk', 'multiple', 'batch', 'sessions', 'select', 'cancel', 'edit'],
    steps: [
      {
        title: 'Open Upcoming Sessions',
        description: 'Classes → [Class Template] → scroll to Upcoming Sessions.',
      },
      {
        title: 'Click "Select multiple"',
        description: 'Top-right of the list. Checkboxes appear next to each session — tick the ones you want or use Select all.',
      },
      {
        title: 'Edit time / instructor or Cancel',
        description: 'The floating action bar shows Edit time / instructor and Cancel N sessions. The edit dialog lets you change time, instructor, or both — only the fields you opt into get rewritten.',
      },
      {
        title: 'Notify members',
        description: 'Both edit and cancel dialogs include the "Email confirmed members" opt-out (default ON). Members get a single, clean reschedule or cancellation email per session.',
      },
    ],
    tips: [
      'For ad-hoc batches — say, four random sessions across a month that all need a sub — Select multiple is faster than editing each one.',
      'For a whole holiday day across every class, use Studio Closures instead — one click handles all classes that day plus the credit refunds.',
    ],
    relatedArticles: ['edit-cancel-session', 'studio-closures', 'substitute-instructor'],
  },

  {
    id: 'substitute-instructor',
    title: 'Substitute an instructor for a session',
    summary: 'Swap the teacher for one session, all future sessions, or the whole series — with automatic notify.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['substitute', 'sub', 'instructor', 'teacher', 'swap', 'replace', 'cover'],
    steps: [
      {
        title: 'Open the Edit Session dialog',
        description: 'Click the session on the Schedule. The dialog has an Instructor picker.',
      },
      {
        title: 'Pick the substitute',
        description: 'Choose a different teacher and select the scope — single occurrence, this and all future, or all in the series.',
      },
      {
        title: 'Notify confirmed members',
        description: 'Klasly automatically emails confirmed-booking members about the swap (e.g. "Sarah → Mei") so they\'re never surprised on arrival. Untick the "Email confirmed members" box if you\'re doing a silent data fix.',
      },
    ],
    tips: [
      'An amber warning shows if the new instructor is already teaching another class at the same time on the same day. You can still proceed if the overlap is intentional.',
      'In Collective Mode, the substitute\'s hours count toward their monthly tier; the original instructor\'s do not for the swapped session.',
    ],
    relatedArticles: ['edit-cancel-session', 'bulk-edit-sessions', 'instructor-cancellation-hours'],
  },

  {
    id: 'mark-no-show-late-cancel',
    title: 'Mark a member as no-show or late cancel',
    summary: 'Flag bookings that don\'t convert to attendance — for class sessions and room bookings alike.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager', 'instructor'],
    keywords: ['no-show', 'no show', 'noshow', 'late cancel', 'attendance', 'flag', 'penalty'],
    steps: [
      {
        title: 'Class sessions',
        description: 'On the session attendance page, each booked member has a Status column with quick No-show (red) and Late cancel (amber) buttons. Click either to flag the booking — the attended checkbox is automatically cleared.',
      },
      {
        title: 'Room bookings',
        description: 'Open the room-booking detail page (click the booking on the schedule or in Rooms). When a client is linked, a Status row appears with Mark no-show and Mark late cancel actions.',
      },
      {
        title: 'Undo',
        description: 'Click Clear on the badge to undo. The flag stays visible on this session and in reports until cleared.',
      },
    ],
    tips: [
      'Pass sessions are NOT auto-refunded when you mark no-show — that\'s intentional, since most studios charge for no-shows. Cancel the booking instead if you want to refund.',
      'No-show / late cancel are tracked per booking, so the same member can attend on a different session without affecting this one.',
    ],
    relatedArticles: ['manage-bookings', 'manage-rooms', 'room-booking-client-pass'],
  },

  {
    id: 'class-change-history',
    title: 'See the change history for a class',
    summary: 'A timeline of every audited edit on a template and its sessions — for contracted-hours tracking.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['history', 'audit', 'log', 'changes', 'tracked', 'who changed', 'when'],
    steps: [
      {
        title: 'Open the class template',
        description: 'Classes → [class] → scroll past Upcoming Sessions.',
      },
      {
        title: 'Expand "Change history"',
        description: 'The disclosure expands to a timeline of up to 200 most recent entries.',
      },
    ],
    tips: [
      'Template-level entries: price, duration, capacity, default instructor changes.',
      'Session-level entries: instructor swaps, reschedules (date/time), room changes, cancellations, hours-returned overrides.',
      'Each entry shows what changed in plain English ("Time changed 18:00–19:00 → 18:30–19:30"), who made the change, and how long ago — the audit trail you need for contracted-hours calculations.',
    ],
    relatedArticles: ['edit-cancel-session', 'instructor-cancellation-hours'],
  },

  {
    id: 'print-schedule',
    title: 'Print the weekly schedule',
    summary: 'A clean, paper-friendly weekly view for the front desk or PDF email-outs.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager', 'instructor'],
    keywords: ['print', 'paper', 'pdf', 'schedule', 'front desk', 'weekly'],
    steps: [
      {
        title: 'Click Print on the Schedule page',
        description: 'A clean weekly view opens (time, class, instructor, room, capacity — one table per day) and the print dialog pops automatically.',
      },
      {
        title: 'Pick a different week (optional)',
        description: 'Use Previous week / Next week in the preview toolbar to navigate.',
      },
      {
        title: 'Save as PDF',
        description: 'Choose "Save as PDF" in your browser\'s print dialog to email it out.',
      },
    ],
    tips: [
      'You can deep-link to a specific week: /calendar/print?week=YYYY-MM-DD.',
      'Cancelled sessions are shown struck-through so the staff knows what was off that week.',
    ],
    relatedArticles: ['create-recurring-class', 'edit-cancel-session'],
  },

  {
    id: 'soap-notes',
    title: 'Record SOAP notes for a client',
    summary: 'Create treatment records using the SOAP format (Subjective, Objective, Assessment, Plan).',
    category: 'classes-scheduling',
    audience: ['instructor'],
    keywords: ['soap', 'notes', 'treatment', 'record', 'practitioner', 'therapy', 'client', 'bodywork'],
    featureFlag: 'extension.soap_notes',
    prerequisites: ['Feature: SOAP Notes must be enabled in Settings → Features.'],
    steps: [
      {
        title: 'Go to SOAP Notes',
        description: 'Click "SOAP Notes" in the sidebar.',
      },
      {
        title: 'Select the member',
        description: 'Choose the client you want to create a note for.',
      },
      {
        title: 'Fill in the SOAP fields',
        description: 'Subjective: What the client reports. Objective: What you observe. Assessment: Your professional evaluation. Plan: Next steps and recommendations.',
      },
      {
        title: 'Set confidentiality (optional)',
        description: 'Toggle "Confidential" to make the note visible only to you. If off, the studio owner can also view it.',
      },
      {
        title: 'Save',
        description: 'The note is saved to the member\'s record. Members cannot see SOAP notes.',
      },
    ],
    tips: [
      'Confidential notes are only visible to the instructor who created them.',
      'Non-confidential notes can be viewed by the studio owner — useful for care coordination.',
    ],
    relatedArticles: [],
  },

  // ═══════════════════════════════════════
  // MEMBERS
  // ═══════════════════════════════════════

  {
    id: 'add-member',
    title: 'Add a member',
    summary: 'Add a new member to your studio manually.',
    category: 'members',
    audience: ['owner', 'manager'],
    keywords: ['member', 'add', 'new', 'create', 'register', 'sign up', 'phone', 'birthdate', 'gender', 'instructor', 'existing user'],
    steps: [
      {
        title: 'Go to Members',
        description: 'Click "Members" in the sidebar.',
      },
      {
        title: 'Click "Add Member"',
        description: 'The required fields are Full name, Email, Phone, Date of Birth, and Gender (Female / Male / Prefer not to say). Address and Referred by are optional.',
      },
      {
        title: 'Save',
        description: 'New members start on the Drop-in plan with zero credits — change their plan from the member detail page once they purchase one. They receive a welcome email with a one-click sign-in link.',
      },
    ],
    tips: [
      'Phone, date of birth, and gender are required at create time so studios have the demographics they need for waivers, marketing, and emergency contact. Existing members imported before this change keep their original (possibly empty) values.',
      'To add many members at once, use CSV Import instead — required fields are optional in the importer so legacy data still flows through.',
      'If the email already belongs to someone in your studio (e.g., an instructor), the form links them as a member instead of showing an error — no duplicate account is created. This is the easiest way to let an instructor also take classes.',
      'Members can also sign up themselves through your booking page or widget.',
      'Use the "Check Duplicates" button on the Members page to find members that share the same email, phone number, or name — helpful after importing from another system.',
    ],
    relatedArticles: ['import-members-csv', 'manage-member-credits', 'member-minor-waiver'],
  },

  {
    id: 'import-members-csv',
    title: 'Import members from CSV',
    summary: 'Add many members at once by uploading a spreadsheet. Welcome emails default off so you can stage your roster before launch.',
    category: 'members',
    audience: ['owner', 'manager'],
    keywords: ['csv', 'import', 'bulk', 'members', 'upload', 'spreadsheet', 'migrate', 'transfer', 'welcome', 'launch'],
    steps: [
      {
        title: 'Upload',
        description: 'Go to Members → Import. Drag in a .csv up to 5MB. Required columns are Name (one column or First+Last) and Email.',
      },
      {
        title: 'Map',
        description: 'Klasly auto-detects column headers (Mindbody / Zen Planner / spreadsheet exports all work) — auto-detected fields show an "Auto-detected" badge. Optional columns: Phone, Date of Birth, Gender, Address, Referred By, Plan Type, Credits, Status, Is Minor, Guardian Email, Notes.',
      },
      {
        title: 'Review',
        description: 'Set defaults (plan type / credits / status) for rows where the column is blank. Decide whether to send a welcome email (defaults OFF) and whether to mark all imported members as "Waiver Signed" — useful when migrating from a system where waivers were already collected.',
      },
      {
        title: 'Done',
        description: 'See imported / skipped / error counts. Failed rows can be exported as a CSV ("Download errors as CSV") so you can fix and re-import.',
      },
    ],
    tips: [
      'Recommended migration workflow: (1) import existing members with welcome emails OFF and waiver-signed ON, (2) finish setting up waivers / passes / schedule, (3) when ready to launch, send invitations from the Members page or re-import a batch with the toggle ON.',
      'The new required-at-create fields (Phone, Date of Birth, Gender) are optional in the importer so legacy data still flows through.',
      'Dates accept ISO (1992-04-15), US (4/15/1992), EU (15/4/1992), and human-readable ("Apr 15, 1992") formats. Gender accepts female / male / prefer_not_to_say (or single-letter F / M).',
      'Click Download template on the upload step to get a sample CSV with all supported columns and three sample rows including a minor with a separate guardian email.',
      'If a row\'s email matches someone already in your studio (e.g., an instructor), a member record is created for that person — they won\'t be skipped or cause an error. This makes it easy to give existing instructors or staff a member role too.',
    ],
    relatedArticles: ['add-member', 'export-data'],
  },

  {
    id: 'manage-member-credits',
    title: 'Manage member credits',
    summary: 'View, add, or subtract credits for a member.',
    category: 'members',
    audience: ['owner', 'manager'],
    keywords: ['credit', 'credits', 'add', 'subtract', 'adjust', 'balance', 'pack'],
    steps: [
      {
        title: 'Go to the member\'s profile',
        description: 'Go to Members → click on the member\'s name.',
      },
      {
        title: 'Find the Credits section',
        description: 'You\'ll see their current credit balance.',
      },
      {
        title: 'Adjust credits',
        description: 'Click "Adjust Credits". Enter the amount to add or subtract, and optionally a note explaining why.',
      },
    ],
    tips: [
      'Credits are consumed automatically when a member books a class.',
      'If you cancel a session, credits are refunded to booked members automatically.',
      'You can undo a credit consumption if it was a mistake.',
    ],
    relatedArticles: ['add-member', 'create-products'],
  },

  {
    id: 'member-minor-waiver',
    title: 'Add a minor member with guardian waiver',
    summary: 'Register an underage member and send a waiver to their parent or guardian.',
    category: 'members',
    audience: ['owner', 'manager'],
    keywords: ['minor', 'child', 'underage', 'parent', 'guardian', 'waiver', 'youth', 'kid'],
    featureFlag: 'extension.minor_waiver',
    prerequisites: ['Feature: Minor Waiver must be enabled in Settings → Features.'],
    steps: [
      {
        title: 'Add a new member',
        description: 'Go to Members → Add Member. Fill in the minor\'s name and email.',
      },
      {
        title: 'Mark as minor',
        description: 'Toggle "Minor" on. Enter the date of birth and the guardian\'s email address.',
      },
      {
        title: 'Save',
        description: 'The guardian will receive a waiver signing request by email. They can sign without creating a Klasly account.',
      },
    ],
    tips: [
      'The guardian signs from a unique link in the email — no Klasly account needed.',
      'You can check the waiver status on the member\'s profile page.',
      'Bulk waiver invites automatically route to guardian emails for minors.',
    ],
    relatedArticles: ['setup-waiver-template', 'send-waiver-bulk'],
  },

  // ═══════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════

  {
    id: 'create-products',
    title: 'Create membership plans and class packs',
    summary: 'Set up the pricing options your members can purchase.',
    category: 'payments',
    audience: ['owner'],
    keywords: ['product', 'plan', 'pricing', 'subscription', 'membership', 'pack', 'credit', 'drop-in', 'price'],
    steps: [
      {
        title: 'Go to Settings → Products',
        description: 'This is where you define what members can buy.',
      },
      {
        title: 'Create a product',
        description: 'Click "Create Product". Choose the type: Monthly Subscription (auto-renewing) or Class Pack (fixed number of credits).',
      },
      {
        title: 'Set the details',
        description: 'Enter the name, price, and for class packs, the number of credits included.',
      },
      {
        title: 'Save',
        description: 'The product will appear on your pricing page. Members can purchase it during checkout.',
      },
    ],
    tips: [
      'You can create a promo code in Settings → Products → Promo Codes to offer discounts.',
      'Members can switch between plans — their credits carry over.',
    ],
    relatedArticles: ['connect-stripe', 'manage-member-credits', 'view-payment-history'],
  },

  {
    id: 'view-payment-history',
    title: 'View payment history',
    summary: 'See all payments, filter by date or member, and export to CSV.',
    category: 'payments',
    audience: ['owner', 'manager'],
    keywords: ['payment', 'history', 'transaction', 'revenue', 'income', 'receipt', 'export'],
    steps: [
      {
        title: 'Go to Payments',
        description: 'Click "Payments" in the sidebar. You\'ll see a list of all transactions.',
      },
      {
        title: 'Filter (optional)',
        description: 'Use the filters to narrow by date range, member, or payment type.',
      },
      {
        title: 'Export (optional)',
        description: 'Click "Export CSV" to download the payment data for your records or accounting.',
      },
    ],
    relatedArticles: ['create-products', 'connect-stripe'],
  },

  {
    id: 'manage-subscription',
    title: 'Pause, resume, or cancel a member\'s subscription',
    summary: 'Manage a member\'s recurring payment.',
    category: 'payments',
    audience: ['owner', 'manager', 'member'],
    keywords: ['subscription', 'pause', 'cancel', 'resume', 'stop', 'freeze', 'hold'],
    steps: [
      {
        title: 'Find the member',
        description: 'Go to Members → click the member\'s name.',
      },
      {
        title: 'Go to Subscription section',
        description: 'You\'ll see their current plan and billing status.',
      },
      {
        title: 'Choose an action',
        description: 'Pause: Temporarily stops billing. The member keeps access until the current period ends. Resume: Restarts billing. Cancel: Ends the subscription at the current period end.',
      },
    ],
    tips: [
      'Members can also manage their own subscription from their account page.',
      'Pausing is better than cancelling if the member plans to return.',
    ],
    relatedArticles: ['create-products', 'view-payment-history'],
  },

  {
    id: 'studio-pass-setup',
    title: 'Set up a Studio Pass',
    summary: 'Create a monthly pass that gives members access to all classes across all instructors.',
    category: 'payments',
    audience: ['owner'],
    keywords: ['pass', 'studio pass', 'unlimited', 'all access', 'monthly', 'distribution', 'instructor split'],
    featureFlag: 'extension.studio_pass',
    prerequisites: ['Feature: Studio Pass must be enabled in Settings → Features.', 'Collective Mode must be active.'],
    steps: [
      {
        title: 'Go to Passes in the sidebar',
        description: 'Click "+ Create Pass".',
      },
      {
        title: 'Set pass details',
        description: 'Name, monthly price, and optional class limit (unlimited or X per month).',
      },
      {
        title: 'Configure distribution',
        description: 'Choose semi-auto (you review before sending) or full-auto. At the end of each month, pass revenue is split among instructors based on class attendance.',
      },
    ],
    tips: [
      'Start with semi-auto to review distribution amounts before they\'re sent to instructors.',
      'Stripe fees, Klasly fees, and Studio Fee are deducted before distribution.',
      'Distributions are calculated on the 1st of each month based on previous month\'s usage.',
    ],
    relatedArticles: ['collective-overview', 'create-products'],
  },

  // ═══════════════════════════════════════
  // WAIVERS
  // ═══════════════════════════════════════

  {
    id: 'setup-waiver-template',
    title: 'Set up your waiver template',
    summary: 'Customize the waiver that members sign before their first class.',
    category: 'waivers',
    audience: ['owner', 'manager'],
    keywords: ['waiver', 'template', 'customize', 'edit', 'liability', 'agreement', 'consent'],
    steps: [
      {
        title: 'Go to Waivers',
        description: 'Click "Waivers" in the sidebar.',
      },
      {
        title: 'Edit template',
        description: 'Click "Edit Template". Choose a preset (Yoga, Fitness, Dance, etc.) or write your own. The editor supports formatting.',
      },
      {
        title: 'Preview and save',
        description: 'Preview what the member will see, then save.',
      },
    ],
    tips: [
      'You can use the presets as a starting point and customize them.',
      'Consult with a local attorney to make sure your waiver covers your liability needs.',
    ],
    relatedArticles: ['send-waiver-bulk', 'member-minor-waiver'],
  },

  {
    id: 'send-waiver-bulk',
    title: 'Send waiver requests to all members',
    summary: 'Send a signing request to all members who haven\'t signed yet.',
    category: 'waivers',
    audience: ['owner', 'manager'],
    keywords: ['waiver', 'send', 'bulk', 'all', 'unsigned', 'request', 'email'],
    steps: [
      {
        title: 'Go to Waivers',
        description: 'Click "Waivers" in the sidebar. You\'ll see a list showing who has signed and who hasn\'t.',
      },
      {
        title: 'Click "Send to All Unsigned"',
        description: 'This sends an email with a signing link to every member who hasn\'t signed yet.',
      },
    ],
    tips: [
      'You can also send to individual members by clicking their name in the list.',
      'Members sign directly from the email link — no login required.',
    ],
    relatedArticles: ['setup-waiver-template', 'member-minor-waiver'],
  },

  // ═══════════════════════════════════════
  // MESSAGING
  // ═══════════════════════════════════════

  {
    id: 'send-message-member',
    title: 'Send a message to a member',
    summary: 'Use the built-in chat to communicate with members.',
    category: 'messaging',
    audience: ['owner', 'manager'],
    keywords: ['message', 'chat', 'send', 'communicate', 'contact', 'member'],
    steps: [
      {
        title: 'Go to Messages',
        description: 'Click "Messages" in the sidebar.',
      },
      {
        title: 'Start a conversation',
        description: 'Click "New Message" and select the member. Or click an existing conversation to continue.',
      },
      {
        title: 'Type and send',
        description: 'Type your message and press Enter or click Send.',
      },
    ],
    tips: [
      'Members also receive an email notification when you send them a message.',
      'You can see read receipts — a checkmark appears when the member reads your message.',
      'A red badge on the Messages link shows unread message count.',
    ],
    relatedArticles: ['studio-announcements'],
  },

  {
    id: 'studio-announcements',
    title: 'Create studio announcements',
    summary: 'Send announcements to all instructors, members, or both.',
    category: 'messaging',
    audience: ['owner', 'manager'],
    keywords: ['announcement', 'broadcast', 'notify', 'banner', 'news', 'update'],
    steps: [
      {
        title: 'Go to Announcements',
        description: 'Click "Announcements" in the sidebar.',
      },
      {
        title: 'Create an announcement',
        description: 'Fill in the title, body, and select target roles (instructors, members, or both). Click "Create Announcement".',
      },
      {
        title: 'Manage announcements',
        description: 'You can activate/deactivate or delete announcements from the table. Deactivated announcements won\'t be shown to anyone.',
      },
    ],
    relatedArticles: ['send-message-member'],
  },

  // ═══════════════════════════════════════
  // COLLECTIVE MODE
  // ═══════════════════════════════════════

  {
    id: 'collective-overview',
    title: 'Set up Collective Mode',
    summary: 'Let instructors rent your space, run their own classes, and get paid directly.',
    category: 'collective-mode',
    audience: ['owner'],
    keywords: ['collective', 'coworking', 'airbnb', 'shared', 'rent', 'space', 'independent'],
    steps: [
      {
        title: 'Enable Collective Mode',
        description: 'Go to Settings → Features. Turn on the Collective Mode features you need: Self-Scheduling, Room Management, Instructor Billing, and Direct Payout.',
      },
      {
        title: 'Set up rooms',
        description: 'Go to Settings → Rooms. Add each room in your studio (e.g., "Main Studio", "Practitioner Room").',
      },
      {
        title: 'Define membership tiers',
        description: 'Go to Settings → Tiers. Create tiers with monthly hours and pricing (e.g., "Community - 3h/month - $60").',
      },
      {
        title: 'Set Studio Fee',
        description: 'Go to Settings → Payout. Set the percentage you take from each class booking (e.g., 10%).',
      },
      {
        title: 'Invite instructors',
        description: 'Go to Instructors → Invite. Each instructor will connect their own Stripe account and choose their tier.',
      },
    ],
    tips: [
      'Instructors get paid directly. Your Studio Fee is automatically deducted before the payment reaches them.',
      'Start with a few instructors to test the flow before inviting everyone.',
      'You can set per-instructor fee overrides if some instructors have different rates.',
    ],
    relatedArticles: ['collective-self-scheduling', 'collective-room-management', 'collective-tiers', 'invite-instructor'],
  },

  {
    id: 'invite-instructor',
    title: 'Invite an instructor',
    summary: 'Send an email invitation so an instructor can join your studio.',
    category: 'collective-mode',
    audience: ['owner', 'manager'],
    keywords: ['instructor', 'invite', 'add', 'new', 'join', 'email', 'magic link'],
    steps: [
      {
        title: 'Go to Instructors',
        description: 'Click "Instructors" in the sidebar.',
      },
      {
        title: 'Click "Invite Instructor"',
        description: 'Enter the instructor\'s name and email address.',
      },
      {
        title: 'Send the invitation',
        description: 'The instructor will receive an email with a one-click link to join. No password needed — it uses a Magic Link.',
      },
    ],
    tips: [
      'In Collective Mode, the instructor will also be prompted to connect their Stripe account.',
      'You can create an instructor without sending an invitation if you prefer to set up their profile first.',
      'You can also import instructors in bulk via CSV.',
    ],
    relatedArticles: ['collective-overview', 'assign-manager-role'],
  },

  {
    id: 'assign-manager-role',
    title: 'Assign manager permissions',
    summary: 'Invite a manager and grant fine-grained access via 15 permission toggles.',
    category: 'collective-mode',
    audience: ['owner'],
    keywords: ['manager', 'role', 'permission', 'promote', 'access', 'staff', 'class pricing', 'tutorial', 'export'],
    steps: [
      {
        title: 'Invite',
        description: 'Click "Managers" in the sidebar and click "+ Invite manager". Enter the person\'s email — they receive an invitation to join your studio.',
      },
      {
        title: 'Set permissions',
        description: 'Each manager has 15 permission toggles: Members, Classes, Instructors, Bookings, Rooms, Payments, Messages, Teach, Settings, Class Pricing, Instructor Contracts & Membership Tiers, Tutorial, Export Your Data, Billing, and Issue Refunds.',
      },
      {
        title: 'Use the permission guide',
        description: 'Click "What does each permission do?" next to the page description — this opens a guide showing exactly what each permission grants and what it does not include. Hover over each permission badge for the same hint.',
      },
    ],
    tips: [
      'Managers with the Billing permission can access the Klasly subscription, payment method, and promotion codes. Stripe Connect settings and studio deletion remain owner-only.',
      'Settings includes the Test Accounts switcher — it\'s called out with a blue badge so you can see it before toggling.',
      'Class Pricing is separate from Classes so you can allow schedule edits without price changes.',
      'Tutorial is a UX preference, not a capability — controls whether onboarding tooltips and the dashboard checklist appear for that user.',
      'Export Your Data controls whether CSV / PDF export buttons appear on Members, Bookings, Payments, etc.',
    ],
    relatedArticles: ['understanding-roles', 'invite-instructor', 'test-accounts-switcher'],
  },

  {
    id: 'collective-self-scheduling',
    title: 'Instructor self-scheduling',
    summary: 'How instructors create their own classes and manage their schedule.',
    category: 'collective-mode',
    audience: ['instructor'],
    keywords: ['self-scheduling', 'instructor', 'class', 'create', 'own', 'calendar', 'book room'],
    featureFlag: 'collective.instructor_self_scheduling',
    steps: [
      {
        title: 'Go to Schedule',
        description: 'After logging in, go to the Schedule page.',
      },
      {
        title: 'Check room availability',
        description: 'Look at the calendar to see when rooms are available. Booked times are shown in gray.',
      },
      {
        title: 'Create your class',
        description: 'Click "Create Class" or click on an empty time slot. Set the class name, price, room, time, and capacity.',
      },
      {
        title: 'Save',
        description: 'Your class will appear on the studio schedule. Members can now book it.',
      },
    ],
    tips: [
      'Your class hours count toward your monthly tier limit.',
      'You can make a session Private if it\'s for personal use or a private client.',
    ],
    relatedArticles: ['schedule-visibility', 'collective-overview'],
  },

  {
    id: 'collective-room-management',
    title: 'Book and manage rooms as an instructor',
    summary: 'How instructors book rooms and manage their room reservations.',
    category: 'collective-mode',
    audience: ['instructor'],
    keywords: ['room', 'book', 'reserve', 'cancel', 'recurring', 'calendar'],
    featureFlag: 'collective.room_management',
    steps: [
      {
        title: 'Open the Room Calendar',
        description: 'Click an empty time slot to open the session form.',
      },
      {
        title: 'Choose booking type',
        description: 'Select "Room only" for a simple reservation, or select a class template to create a class session in that room.',
      },
      {
        title: 'Set frequency',
        description: 'Choose "Single" for one date, or "Weekly" to repeat the booking for multiple weeks.',
      },
    ],
    tips: [
      'The system checks for conflicts and prevents double-booking.',
      'For recurring bookings, you can cancel individual dates if needed.',
      'If you don\'t have an active membership yet, you\'ll see a reminder to purchase one.',
    ],
    relatedArticles: ['collective-self-scheduling', 'collective-overview'],
  },

  {
    id: 'collective-tiers',
    title: 'Set up instructor contracts (hourly, flat, overage)',
    summary: 'Three contract models in one place: hourly tiers with optional overage, flat / per-class fees, and a ledger of every overage charge.',
    category: 'collective-mode',
    audience: ['owner'],
    keywords: ['tier', 'membership', 'instructor', 'billing', 'rent', 'monthly', 'hours', 'plan', 'overage', 'contract', 'flat fee', 'per class'],
    featureFlag: 'collective.instructor_billing',
    steps: [
      {
        title: 'Open Settings → Contracts',
        description: 'Three tabs: Hourly plans / Flat & per-class fees / Overage charges.',
      },
      {
        title: 'Hourly plans',
        description: 'Create subscription plans (e.g. "10h / month — $300"). For each plan, choose either: Block further bookings once the monthly limit is reached, OR Allow overage and charge per extra hour ($/hour rate you set).',
      },
      {
        title: 'Flat & per-class fees',
        description: 'For instructors who pay a simple fixed monthly amount or per-class fee. Manual settlement via the monthly invoice report.',
      },
      {
        title: 'Overage charges ledger',
        description: 'See every overage with status (pending / charged / failed). Waive any one of them — if it\'s already charged, the refund happens automatically.',
      },
      {
        title: 'Assign to instructors',
        description: 'On the instructor\'s edit page, open the Contract section and choose No contract, Hourly plan, or Flat / per-class fee. They\'re billed monthly through Stripe.',
      },
    ],
    tips: [
      'Hours are tracked in 15-minute increments automatically.',
      'When an instructor books a room that would put them over their tier, they get a confirmation modal saying "This booking will cost you $X in overage — proceed?" (explicit consent required).',
      'At month-end, overage is auto-charged to their card on file via Stripe.',
      'Instructors see "This month: 12h used of 10h, estimated overage $50" on /instructor/membership.',
    ],
    relatedArticles: ['collective-overview', 'invite-instructor', 'instructor-cancellation-hours'],
  },

  {
    id: 'room-booking-client-pass',
    title: 'Link a client to a room booking and deduct from their pass',
    summary: 'For body-therapy / Reiki / 1-on-1 sessions: pull one session from the client\'s active pass automatically.',
    category: 'collective-mode',
    audience: ['owner', 'manager', 'instructor'],
    keywords: ['room', 'booking', 'client', 'pass', 'deduct', 'session', 'body therapy', 'reiki', '1-on-1'],
    featureFlag: 'collective.room_management',
    steps: [
      {
        title: 'Add the booking',
        description: 'Rooms → + Add booking. Search the member in the Client (optional) field.',
      },
      {
        title: 'Tick "Deduct one session from this client\'s pass"',
        description: 'If they have an active pass, the checkbox appears. Hit Create — one session is automatically pulled from their active pass. The booking detail page shows who the client is and that a session was used.',
      },
      {
        title: 'Auto-reminders',
        description: 'When linked, the client gets a push notification ~1 hour before the appointment, the same way class reminders work.',
      },
    ],
    tips: [
      'For the auto-deduct to work, the pass needs to live on the client\'s account in Klasly. If you\'ve been tracking sessions outside of Klasly, import the pass first.',
      'If you cancel the booking, the session is automatically refunded back to the client\'s pass.',
      'Marking no-show does NOT auto-refund the pass — most studios charge for no-shows. Cancel the booking instead if you want to refund.',
      'Stripe checkout flow: client pays once for the pass (or recurring subscription); thereafter every linked booking ticks down their remaining count (14 → 13 → 12 …) without a separate "checkout" step at the door.',
    ],
    relatedArticles: ['manage-rooms', 'mark-no-show-late-cancel', 'studio-pass-setup'],
  },

  {
    id: 'instructor-cancellation-hours',
    title: 'Return or forfeit instructor hours on cancellation',
    summary: 'Admin cancels return hours; instructor self-cancels forfeit them. Override per session if you need to.',
    category: 'collective-mode',
    audience: ['owner', 'manager'],
    keywords: ['hours', 'returned', 'forfeited', 'cancellation', 'policy', 'instructor', 'tier'],
    featureFlag: 'collective.instructor_billing',
    steps: [
      {
        title: 'Default behavior',
        description: 'Admin cancellations (owner / manager): hours are returned to the instructor\'s monthly pool automatically — the studio cancelled, not the teacher. Instructor self-cancellations: hours are FORFEITED and still count against the monthly allowance.',
      },
      {
        title: 'Override on the cancelled tile',
        description: 'In the Upcoming Sessions list, every cancelled tile has a Return hours / Revoke hours toggle. The badge shows the current state ("Hours returned" / "Hours forfeited") and a "By teacher" / "By admin" attribution badge so you can spot self-cancels at a glance.',
      },
      {
        title: 'Effects flow through',
        description: 'Whatever you set is reflected immediately on the next tier-overage report calculation for that instructor.',
      },
    ],
    tips: [
      'This is the audit trail you need for contracted-hours calculations — every cancellation is right there with attribution.',
      'For deeper history, expand Change history on the class template (200 most recent entries).',
    ],
    relatedArticles: ['collective-tiers', 'edit-cancel-session', 'class-change-history'],
  },

  {
    id: 'owner-also-teaches',
    title: 'Teach classes as an owner or manager',
    summary: 'Enable instructor mode so you can create and teach your own classes.',
    category: 'collective-mode',
    audience: ['owner', 'manager'],
    keywords: ['owner', 'teach', 'also teach', 'instructor', 'my classes', 'my earnings'],
    steps: [
      {
        title: 'Enable instructor mode',
        description: 'Go to Settings → Studio Features and enable "I Also Teach Classes".',
      },
      {
        title: 'Start teaching',
        description: 'A "My Classes" and "My Earnings" section will appear in your sidebar. Create and manage classes you personally teach.',
      },
      {
        title: 'Connect Stripe for payouts',
        description: 'Connect your personal Stripe account to receive direct payouts for your classes.',
      },
    ],
    tips: [
      'When creating classes, your name will appear in the instructor dropdown with "(Me)" next to it.',
      'For managers, the "Teach" permission must be enabled first.',
    ],
    relatedArticles: ['collective-overview', 'assign-manager-role'],
  },

  // ═══════════════════════════════════════
  // EVENTS & RETREATS
  // ═══════════════════════════════════════

  {
    id: 'create-retreat',
    title: 'Create a retreat or event',
    summary: 'Set up a multi-day retreat with pricing options, installments, and application forms.',
    category: 'events-retreats',
    audience: ['owner', 'manager'],
    keywords: ['retreat', 'event', 'workshop', 'multi-day', 'create', 'new'],
    featureFlag: 'extension.retreat_booking',
    prerequisites: ['Feature: Events & Retreats must be enabled in Settings → Features.'],
    steps: [
      {
        title: 'Go to Events & Retreats',
        description: 'Click "Events" in the sidebar. Click "Create Event".',
      },
      {
        title: 'Fill in event details',
        description: 'Enter the name, dates, location, description, and upload an image.',
      },
      {
        title: 'Add pricing options',
        description: 'Create room options (e.g., "Private Room - $1,200", "Shared Room - $800", "Commuter - $400"). Set capacity for each option.',
      },
      {
        title: 'Add a schedule overview (optional)',
        description: 'In the Schedule step, add free-form text describing the event\'s daily agenda (e.g., "Day 1: Arrival & welcome circle. Day 2: Morning yoga, afternoon hike."). This appears above the detailed activity timeline on the public event page.',
      },
      {
        title: 'Configure payments',
        description: 'Choose "Full payment only", "Installments only" (3 equal payments), or "Both options" so each attendee picks their preferred method at checkout.',
      },
      {
        title: 'Set cancellation policy',
        description: 'Define refund tiers (e.g., "90+ days before: full refund", "60-89 days: 50%", "Less than 60 days: no refund").',
      },
      {
        title: 'Add an application form (optional)',
        description: 'Attach a custom form for dietary needs, special requests, or emergency contacts.',
      },
      {
        title: 'Publish',
        description: 'Set the status to "Published" to make it visible to members. Keep it as "Draft" to continue editing.',
      },
    ],
    tips: [
      'Published events appear as purple banners on the main schedule calendar — both the member-facing schedule and the dashboard calendar.',
      'You can create private events (not visible publicly) for corporate retreats or invite-only events.',
      'Guests can apply without a Klasly account — great for one-time retreat attendees.',
      'Installments are collected automatically. You\'ll be notified if a payment fails.',
    ],
    relatedArticles: ['manage-retreat-bookings'],
  },

  {
    id: 'manage-retreat-bookings',
    title: 'Manage retreat bookings and payments',
    summary: 'Review applications, approve or reject, and track installment payments.',
    category: 'events-retreats',
    audience: ['owner', 'manager'],
    keywords: ['retreat', 'booking', 'approve', 'reject', 'installment', 'payment', 'manage', 'refund', 'cancel'],
    featureFlag: 'extension.retreat_booking',
    steps: [
      {
        title: 'Go to the event',
        description: 'Open the event from the Events page. Click "Bookings" to see all applications.',
      },
      {
        title: 'Review applications',
        description: 'Click on an application to see their form answers. Approve or reject.',
      },
      {
        title: 'Track payments',
        description: 'Approved attendees receive a payment link. You can see who has paid, who\'s on installments, and if any payments have failed.',
      },
      {
        title: 'Handle cancellations',
        description: 'If someone cancels, Klasly calculates the refund amount based on your cancellation policy. You can adjust the amount manually before processing.',
      },
    ],
    relatedArticles: ['create-retreat'],
  },

  // ═══════════════════════════════════════
  // ANALYTICS & MARKETING
  // ═══════════════════════════════════════

  {
    id: 'view-analytics',
    title: 'View studio analytics',
    summary: 'See class utilization, popular classes, instructor revenue, and member insights.',
    category: 'analytics',
    audience: ['owner'],
    keywords: ['analytics', 'report', 'dashboard', 'stats', 'utilization', 'revenue', 'popular'],
    steps: [
      {
        title: 'Go to Analytics',
        description: 'Click "Analytics" in the sidebar.',
      },
      {
        title: 'Browse the reports',
        description: 'You\'ll see class utilization rates, popular class rankings, instructor revenue breakdowns, and member demographics.',
      },
    ],
    tips: [
      'Analytics data becomes more useful over time. Give it a few weeks of bookings to see meaningful trends.',
      'Use UTM tracking to see which marketing channels bring the most bookings.',
    ],
    relatedArticles: ['utm-tracking', 'referral-program'],
  },

  {
    id: 'utm-tracking',
    title: 'Track where your members come from (UTM)',
    summary: 'Add tracking parameters to your links to see which marketing channels work best.',
    category: 'analytics',
    audience: ['owner'],
    keywords: ['utm', 'tracking', 'source', 'marketing', 'campaign', 'traffic', 'link'],
    featureFlag: 'extension.utm_tracking',
    prerequisites: ['Feature: UTM Tracking must be enabled in Settings → Features.'],
    steps: [
      {
        title: 'Create tracked links',
        description: 'Add UTM parameters to your booking page URL. For example: app.klasly.app/book/your-studio?utm_source=instagram&utm_medium=bio&utm_campaign=spring2026',
      },
      {
        title: 'Use the links in your marketing',
        description: 'Put different links in your Instagram bio, email newsletters, Facebook posts, etc.',
      },
      {
        title: 'Check results',
        description: 'Go to Analytics → Traffic Sources to see which channels bring the most visitors and bookings. Use the Link Builder section to generate UTM links easily.',
      },
    ],
    tips: [
      'Keep utm_source simple: "instagram", "facebook", "email", "google".',
      'Use utm_campaign for specific promotions: "spring_sale", "new_member_offer".',
    ],
    relatedArticles: ['view-analytics', 'referral-program'],
  },

  {
    id: 'referral-program',
    title: 'Share your referral link',
    summary: 'Refer other studio owners. You both get 1 month free.',
    category: 'analytics',
    audience: ['owner'],
    keywords: ['referral', 'refer', 'share', 'free', 'month', 'invite', 'friend', 'recommend'],
    steps: [
      {
        title: 'Go to Settings → Referral',
        description: 'Your unique referral link is displayed at the top.',
      },
      {
        title: 'Copy and share',
        description: 'Click "Copy Link" and share it with other studio owners.',
      },
      {
        title: 'Earn rewards',
        description: 'When someone signs up through your link and makes their first payment, you both get 1 month of Klasly free. The discount is applied automatically.',
      },
    ],
    tips: [
      'There\'s no limit on referrals. Refer as many studios as you want.',
      'You can track your referrals and rewards on the same page.',
    ],
    relatedArticles: ['view-analytics'],
  },

  // ═══════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════

  {
    id: 'studio-closures',
    title: 'Mark a holiday or closure day',
    summary: 'Cancel every class on a specific day with one click — credits and pass uses are auto-refunded.',
    category: 'settings',
    audience: ['owner', 'manager'],
    keywords: ['closure', 'holiday', 'closed', 'vacation', 'break', 'cancel day', 'snow day', 'maintenance'],
    steps: [
      {
        title: 'Open Settings → Studio Closures',
        description: 'Click + Add closure.',
      },
      {
        title: 'Pick a date and label',
        description: 'Set the date and give it a label (e.g. "Independence Day", "Owner vacation"). Save.',
      },
      {
        title: 'Auto-cancel + refund',
        description: 'Every non-cancelled class session on that date is automatically cancelled and the affected bookings have their credits or pass uses refunded in one step. The reason on each cancelled session is auto-set to "Studio closed: [your label]".',
      },
    ],
    tips: [
      'You can list multiple closure days — the page shows all upcoming ones.',
      'Removing a closure later does NOT automatically restore cancelled sessions — recreate them manually if needed.',
      'Owners can always manage closures. Managers need the Settings permission.',
    ],
    relatedArticles: ['edit-cancel-session', 'bulk-edit-sessions'],
  },

  {
    id: 'multi-signature-contracts',
    title: 'Send a contract for ordered multi-signature signing',
    summary: 'Jotform-style: route a contract to multiple signers in a specific order, with a public signing link per signer.',
    category: 'settings',
    audience: ['owner', 'manager'],
    keywords: ['contract', 'sign', 'signer', 'multi', 'order', 'jotform', 'envelope', 'witness'],
    steps: [
      {
        title: 'Open Settings → Forms',
        description: 'Find the contract template and click Send for signing.',
      },
      {
        title: 'Configure the envelope',
        description: 'Set the title (defaults to the form name) and optionally tie the envelope to an instructor — when set, the signed contract automatically appears on that instructor\'s profile under "Signed contracts."',
      },
      {
        title: 'Add signers in order',
        description: 'Enter Name + Email + optional Role label ("Studio owner", "Witness", etc.) for each. Use the up/down arrows to reorder.',
      },
      {
        title: 'Send',
        description: 'Click Send to first signer. Klasly emails them a unique signing link. After they sign, the next signer is emailed automatically. Once everyone signs, you get a "fully signed" email and the envelope is sealed.',
      },
    ],
    tips: [
      'External signers (lawyers, witnesses) don\'t need a Klasly login — the signing page is a public URL secured by a one-time token.',
      'Signers can decline ("I can\'t sign this"); the studio gets notified and the envelope is voided.',
      'Resend rotates the token, so the old link becomes invalid. Void cancels the envelope entirely.',
      'Print signed copy on the envelope detail page opens a clean letter-style view — Cmd-P → Save as PDF gives you a real PDF.',
    ],
    relatedArticles: ['setup-waiver-template'],
  },

  {
    id: 'test-accounts-switcher',
    title: 'Use the Test Accounts switcher to preview as instructor or member',
    summary: 'Click the person icon (bottom-right) to instantly sign in as a test account — see your studio from every role without logging out.',
    category: 'settings',
    audience: ['owner', 'manager'],
    keywords: ['test', 'preview', 'impersonate', 'switch', 'account', 'instructor view', 'member view', 'client view'],
    steps: [
      {
        title: 'Find the person icon',
        description: 'Bottom-right of every screen (owner / manager with Settings permission). Click to open a panel with all test accounts in your studio.',
      },
      {
        title: 'Click any test account',
        description: 'You\'re instantly signed in as them. An orange banner stays at the top: "Viewing as {name} — Return to your account." One click returns you to your owner account.',
      },
      {
        title: 'Or copy credentials',
        description: 'Test account credentials are also listed on Settings → Test Accounts (with copy buttons), in case you want to log in with them in another browser.',
      },
    ],
    tips: [
      'You can only switch to accounts flagged as test accounts — real members / instructors can never be impersonated.',
      'Test accounts are blocked from real Stripe actions (they can\'t accidentally charge a real card).',
      'Every switch is recorded in an audit log.',
      'Pre-launch checklist: book a class as the test member, take attendance as the test instructor, then review the booking + payout trail back as the owner.',
    ],
    relatedArticles: ['assign-manager-role', 'studio-setup-overview'],
  },

  {
    id: 'calendar-feed-ical',
    title: 'Subscribe to your Klasly schedule from Google or Apple Calendar',
    summary: 'A per-user iCal feed — owners see everything, instructors see their classes, members see their bookings.',
    category: 'settings',
    audience: ['owner', 'manager', 'instructor', 'member'],
    keywords: ['ical', 'calendar', 'google calendar', 'apple calendar', 'subscribe', 'feed', 'sync', 'outlook'],
    steps: [
      {
        title: 'Open Settings → Calendar feed',
        description: 'Click Generate subscribe URL. Copy the URL.',
      },
      {
        title: 'Add to your calendar app',
        description: 'In Google Calendar / Apple Calendar / Outlook, paste it as a subscribed (URL) calendar. Your Klasly schedule appears alongside your personal calendar and refreshes automatically about every hour.',
      },
      {
        title: 'Revoke / regenerate',
        description: 'Revoke and regenerate your URL anytime — useful if you ever shared it by accident.',
      },
    ],
    tips: [
      'Each role sees their own scope: owners and managers see every session; instructors see classes assigned to them; members see only their confirmed bookings.',
      'Each user has their own URL — you cannot share one feed across people.',
    ],
    relatedArticles: ['create-recurring-class', 'manage-bookings'],
  },

  {
    id: 'account-settings',
    title: 'Update your name, email, password, or profile picture',
    summary: 'One page for all personal account changes — owners, managers, instructors, and members.',
    category: 'settings',
    audience: ['owner', 'manager', 'instructor', 'member'],
    keywords: ['account', 'email', 'password', 'profile picture', 'avatar', 'name', 'phone', 'change'],
    steps: [
      {
        title: 'Open the user menu',
        description: 'Click your avatar in the top-right corner and choose Account settings.',
      },
      {
        title: 'Update what you need',
        description: 'Change your name, phone, profile picture, login email (with double-confirmation links to both old and new inboxes), or password.',
      },
    ],
    tips: [
      'Display name, bio, and specialties are edited on the Profile page, not here.',
      'After an email change, Klasly notifications start going to the new address automatically — the database keeps profiles.email in sync with the auth email.',
    ],
    relatedArticles: ['understanding-roles'],
  },

  {
    id: 'manage-feature-flags',
    title: 'Turn features on or off',
    summary: 'Enable or disable optional features like Waivers, Online Classes, SOAP Notes, and more.',
    category: 'settings',
    audience: ['owner'],
    keywords: ['feature', 'flag', 'enable', 'disable', 'turn on', 'turn off', 'setting', 'option'],
    steps: [
      {
        title: 'Go to Settings → Features',
        description: 'You\'ll see a list of all optional features.',
      },
      {
        title: 'Toggle features',
        description: 'Turn on the features you want. Turn off what you don\'t need to keep your interface clean.',
      },
    ],
    tips: [
      'Turning off a feature hides it from the navigation. Your data is never deleted.',
      'You can turn features on or off at any time.',
      'Core features (Members, Scheduling, Payments, Messaging) are always enabled.',
    ],
    relatedArticles: ['studio-setup-overview'],
  },

  {
    id: 'embed-wordpress-widget',
    title: 'Embed your schedule on WordPress',
    summary: 'Add a booking calendar to your website so visitors can see classes and book directly.',
    category: 'settings',
    audience: ['owner'],
    keywords: ['widget', 'wordpress', 'embed', 'website', 'iframe', 'calendar', 'booking', 'schedule'],
    featureFlag: 'extension.embed_widget',
    prerequisites: ['Feature: Embed Widget must be enabled in Settings → Features.'],
    steps: [
      {
        title: 'Go to Settings → Widget',
        description: 'You\'ll see the embed code.',
      },
      {
        title: 'Copy the code',
        description: 'Choose "iframe" or "JavaScript" embed. Copy the code snippet.',
      },
      {
        title: 'Add to your website',
        description: 'In WordPress, edit the page where you want the schedule. Add a Custom HTML block and paste the code.',
      },
      {
        title: 'Configure (optional)',
        description: 'Set allowed domains to prevent unauthorized use. Customize the theme colors to match your website.',
      },
    ],
    tips: [
      'The widget works with any website builder — WordPress, Wix, Squarespace, or custom HTML.',
    ],
    relatedArticles: ['studio-setup-overview'],
  },

  {
    id: 'export-data',
    title: 'Export your studio data',
    summary: 'Download all your data for backup or migration.',
    category: 'settings',
    audience: ['owner'],
    keywords: ['export', 'data', 'download', 'backup', 'csv', 'json', 'migrate'],
    steps: [
      {
        title: 'Find the Export option',
        description: 'You can export Members, Instructors, Classes, Bookings, and Payments as CSV files. Look for the "Export CSV" button on each page.',
      },
      {
        title: 'Download',
        description: 'Click "Export". The file will download to your device.',
      },
    ],
    relatedArticles: [],
  },

  {
    id: 'delete-studio-account',
    title: 'Delete your studio account',
    summary: 'Permanently remove your studio and all associated data.',
    category: 'settings',
    audience: ['owner'],
    keywords: ['delete', 'account', 'remove', 'close', 'cancel', 'permanent'],
    steps: [
      {
        title: 'Go to Settings',
        description: 'Scroll to the bottom to find the "Delete Account" section.',
      },
      {
        title: 'Confirm deletion',
        description: 'Deleting your account will cancel all active Stripe subscriptions, permanently remove all studio data, and delete all associated user accounts.',
      },
    ],
    tips: [
      'This action is irreversible. Make sure to export any data you need before deleting your account.',
    ],
    relatedArticles: ['export-data'],
  },

  {
    id: 'contact-support',
    title: 'Contact support',
    summary: 'Get help from the Klasly support team.',
    category: 'settings',
    audience: ['owner'],
    keywords: ['support', 'help', 'contact', 'ticket', 'issue', 'problem', 'bug'],
    steps: [
      {
        title: 'Go to Settings → Support',
        description: 'Click "New Ticket". Describe your issue and our team will respond within the thread.',
      },
      {
        title: 'Or email us',
        description: 'You can also reach us directly at support@klasly.app.',
      },
    ],
    relatedArticles: [],
  },

  // ═══════════════════════════════════════
  // MEMBER GUIDE
  // ═══════════════════════════════════════

  {
    id: 'member-book-class',
    title: 'Book a class',
    summary: 'Find a class on the schedule and reserve your spot.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['book', 'reserve', 'class', 'schedule', 'sign up', 'register', 'join'],
    steps: [
      {
        title: 'Open the Schedule',
        description: 'After logging in, you\'ll see the class schedule. Browse by day, week, or month.',
      },
      {
        title: 'Find a class',
        description: 'Look for a class that fits your schedule. You can see the class name, instructor, time, and available spots.',
      },
      {
        title: 'Click "Book"',
        description: 'Click the class, then click "Book". If you have credits, one will be used. If not, you may be asked to purchase a plan first.',
      },
      {
        title: 'Confirmation',
        description: 'You\'ll see a confirmation message and receive a confirmation email.',
      },
    ],
    tips: [
      'If a class is full, you can join the waitlist. You\'ll be automatically booked if a spot opens up.',
      'For online classes, the Zoom/Meet link will appear after you book.',
    ],
    relatedArticles: ['member-cancel-booking', 'member-view-credits', 'member-waitlist'],
  },

  {
    id: 'member-cancel-booking',
    title: 'Cancel a booking',
    summary: 'Cancel your class reservation and get your credit back.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['cancel', 'booking', 'unbook', 'remove', 'reservation'],
    steps: [
      {
        title: 'Go to your bookings',
        description: 'Open the Schedule and find the class you booked, or go to "My Bookings" to see all upcoming bookings.',
      },
      {
        title: 'Click "Cancel Booking"',
        description: 'Click on the booked class, then click "Cancel Booking".',
      },
      {
        title: 'Confirmation',
        description: 'Your credit is refunded automatically. If someone was on the waitlist, they\'ll be moved into your spot.',
      },
    ],
    tips: [
      'Some studios may have a cancellation deadline (e.g., 24 hours before class). Check with your studio.',
    ],
    relatedArticles: ['member-book-class', 'member-view-credits'],
  },

  {
    id: 'member-view-credits',
    title: 'Check your credit balance',
    summary: 'See how many class credits you have remaining.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['credit', 'balance', 'remaining', 'left', 'how many', 'check'],
    steps: [
      {
        title: 'Go to your profile',
        description: 'Click your name or avatar in the top right corner.',
      },
      {
        title: 'View credits',
        description: 'Your current credit balance is shown on your profile page, along with your membership plan.',
      },
    ],
    tips: [
      'Each class booking uses 1 credit. Cancelling returns the credit.',
      'Monthly plan members have unlimited bookings.',
    ],
    relatedArticles: ['member-book-class', 'member-buy-credits'],
  },

  {
    id: 'member-buy-credits',
    title: 'Buy a class pack or subscription',
    summary: 'Purchase credits or start a membership plan.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['buy', 'purchase', 'credits', 'plan', 'membership', 'subscription', 'payment', 'pay'],
    steps: [
      {
        title: 'Go to Pricing',
        description: 'From the navigation, click on the Pricing or Plans section.',
      },
      {
        title: 'Choose a plan',
        description: 'Browse the available options: monthly subscription, class packs, or single drop-in.',
      },
      {
        title: 'Complete payment',
        description: 'Click "Buy" and follow the Stripe checkout. You can pay with credit card.',
      },
      {
        title: 'Credits are added instantly',
        description: 'After payment, your credits are added to your account immediately and you can start booking.',
      },
    ],
    relatedArticles: ['member-view-credits', 'member-book-class'],
  },

  {
    id: 'member-waitlist',
    title: 'Join the waitlist for a full class',
    summary: 'Get on the waitlist and be automatically booked if a spot opens.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['waitlist', 'full', 'wait', 'queue', 'no spots', 'sold out'],
    steps: [
      {
        title: 'Find the full class',
        description: 'On the schedule, you\'ll see "Full" or "Waitlist" next to the class.',
      },
      {
        title: 'Click "Join Waitlist"',
        description: 'You\'ll be added to the waitlist. Your position is shown.',
      },
      {
        title: 'Automatic booking',
        description: 'If someone cancels, you\'ll be automatically moved into the class and receive an email confirmation. A credit will be used at that time.',
      },
    ],
    tips: [
      'Waitlist bookings do not use credits until you\'re promoted.',
    ],
    relatedArticles: ['member-book-class', 'member-cancel-booking'],
  },

  {
    id: 'member-sign-waiver',
    title: 'Sign a waiver',
    summary: 'Complete the required waiver before attending your first class.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['waiver', 'sign', 'signature', 'form', 'consent', 'liability'],
    steps: [
      {
        title: 'Check your email',
        description: 'Your studio will send you an email with a link to sign the waiver.',
      },
      {
        title: 'Read the waiver',
        description: 'Click the link and read the waiver carefully.',
      },
      {
        title: 'Sign',
        description: 'Type your name as your signature and click "Sign". That\'s it — you\'re ready for class.',
      },
    ],
    tips: [
      'You only need to sign once. Your signature is saved on your profile.',
      'If you don\'t see the email, check your spam folder.',
    ],
    relatedArticles: ['member-book-class'],
  },

  {
    id: 'member-pwa-install',
    title: 'Add Klasly to your home screen',
    summary: 'Install Klasly as an app on your phone — no app store needed.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['app', 'install', 'home screen', 'pwa', 'mobile', 'phone', 'download'],
    steps: [
      {
        title: 'Open Klasly in your browser',
        description: 'Go to the Klasly URL your studio shared with you.',
      },
      {
        title: 'iPhone (Safari)',
        description: 'Tap the Share button (square with an arrow), then scroll down and tap "Add to Home Screen".',
      },
      {
        title: 'Android (Chrome)',
        description: 'Tap the three-dot menu in Chrome, then tap "Add to Home screen" or "Install app".',
      },
      {
        title: 'Done',
        description: 'Klasly will appear as an app icon on your home screen. Open it anytime to check the schedule and book classes.',
      },
    ],
    tips: [
      'The app works even with a weak internet connection — recently viewed pages are cached.',
      'No app store download needed.',
      'On iPhone, push notifications require adding Klasly to your Home Screen first (iOS 16.4+).',
    ],
    relatedArticles: ['member-book-class'],
  },

  {
    id: 'member-manage-subscription',
    title: 'Manage your subscription',
    summary: 'Pause, resume, or cancel your membership plan.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['subscription', 'pause', 'cancel', 'resume', 'plan', 'membership', 'billing'],
    steps: [
      {
        title: 'Go to your profile',
        description: 'Click your name or avatar in the navigation.',
      },
      {
        title: 'Find your subscription',
        description: 'Your current plan and next billing date are displayed.',
      },
      {
        title: 'Choose an action',
        description: 'Pause: Billing pauses after the current period. Resume: Restarts your plan. Cancel: Ends your plan at the end of the current billing period.',
      },
    ],
    relatedArticles: ['member-buy-credits', 'member-view-credits'],
  },

  {
    id: 'member-online-class',
    title: 'Join an online class',
    summary: 'Access the Zoom or Google Meet link for your booked online class.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['online', 'zoom', 'google meet', 'virtual', 'join', 'link', 'video'],
    steps: [
      {
        title: 'Book the online class',
        description: 'Online classes are marked with a camera icon on the schedule. Book as you would any other class.',
      },
      {
        title: 'Find the link',
        description: 'After booking, click on the class in the schedule — you\'ll see a "Join Online" link. The link is also included in your booking confirmation email.',
      },
    ],
    tips: [
      'The online link is only visible after you have a confirmed booking.',
      'If you\'re on the waitlist, you\'ll see the link once you\'re promoted.',
    ],
    relatedArticles: ['member-book-class'],
  },

  {
    id: 'member-studio-pass',
    title: 'Subscribe to a Studio Pass',
    summary: 'Get a monthly pass for unlimited or limited classes.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['pass', 'studio pass', 'subscribe', 'unlimited', 'monthly', 'all classes'],
    steps: [
      {
        title: 'Go to Passes',
        description: 'Click the "Passes" tab in your navigation bar.',
      },
      {
        title: 'Choose a pass',
        description: 'Browse available passes — you\'ll see the name, description, price, and class limit for each.',
      },
      {
        title: 'Subscribe',
        description: 'Click "Subscribe" and complete checkout through Stripe. Your pass will be active immediately.',
      },
      {
        title: 'Book with your pass',
        description: 'When booking classes, the button will show "Book with Pass" — no credits or payment needed.',
      },
    ],
    tips: [
      'If your pass limit is reached, you can still book using credits or pay-per-class.',
      'Class usage resets at the start of each billing period.',
      'Cancelling a pass booking returns the class to your monthly allowance.',
    ],
    relatedArticles: ['member-book-class', 'member-manage-subscription'],
  },

  {
    id: 'member-messages',
    title: 'Message your studio',
    summary: 'Send and receive messages with your studio.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['message', 'chat', 'contact', 'studio', 'reply'],
    steps: [
      {
        title: 'Go to Messages',
        description: 'Click "Messages" in the navigation menu.',
      },
      {
        title: 'Send a message',
        description: 'Type your message and press Enter or click Send. You can reply to messages from the studio.',
      },
    ],
    tips: [
      'A red badge appears on the Messages link when you have unread messages.',
    ],
    relatedArticles: ['member-book-class'],
  },

  {
    id: 'member-book-retreat',
    title: 'Book a retreat or event',
    summary: 'Sign up for a multi-day event with optional installment payments.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['retreat', 'event', 'workshop', 'book', 'installment'],
    steps: [
      {
        title: 'Find the event',
        description: 'Visit the event page shared by your studio.',
      },
      {
        title: 'Select a room option',
        description: 'Choose your preferred room or pricing tier.',
      },
      {
        title: 'Choose payment method',
        description: 'If the host enabled both options, choose between paying in full or splitting into installments. Some events include an application form.',
      },
      {
        title: 'Complete checkout',
        description: 'Enter your payment details. You\'ll receive a confirmation email.',
      },
    ],
    tips: [
      'Installment payments are charged automatically — 1/3 at booking, 1/3 after 30 days, 1/3 after 60 days.',
      'Guests can book without a Klasly account.',
    ],
    relatedArticles: ['member-book-class'],
  },

  {
    id: 'member-push-notifications',
    title: 'Enable push notifications',
    summary: 'Get reminders for upcoming classes and new messages.',
    category: 'member-guide',
    audience: ['member'],
    keywords: ['notification', 'push', 'reminder', 'alert', 'enable', 'disable'],
    steps: [
      {
        title: 'Enable when prompted',
        description: 'When you first visit your studio\'s Klasly page, you\'ll see a prompt to enable notifications. Tap "Enable Notifications".',
      },
      {
        title: 'Manage in Settings',
        description: 'Go to Settings to enable, disable, or customize which notifications you receive.',
      },
    ],
    tips: [
      'On iPhone (iOS 16.4+), push notifications only work when Klasly is added to your Home Screen via Safari.',
      'You can turn off specific notification types while keeping others on.',
    ],
    relatedArticles: ['member-pwa-install'],
  },

];

// Helper: get all articles for a category
export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  return helpArticles.filter(a => a.category === categoryId);
}

// Helper: get a single article by ID
export function getArticleById(id: string): HelpArticle | undefined {
  return helpArticles.find(a => a.id === id);
}

// Helper: search articles by query
export function searchHelpArticles(query: string): HelpArticle[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return helpArticles.filter(a =>
    a.title.toLowerCase().includes(q) ||
    a.summary.toLowerCase().includes(q) ||
    a.keywords.some(k => k.includes(q))
  );
}
