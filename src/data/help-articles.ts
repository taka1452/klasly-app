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
    summary: 'Link your Stripe account so members can pay online.',
    category: 'getting-started',
    audience: ['owner'],
    keywords: ['stripe', 'payment', 'connect', 'bank', 'money', 'payout'],
    steps: [
      {
        title: 'Go to Settings → Payments',
        description: 'Click "Connect Stripe" in the Payments section.',
      },
      {
        title: 'Complete Stripe onboarding',
        description: 'You\'ll be redirected to Stripe to enter your business information, bank account, and identity verification. This typically takes about 5 minutes.',
      },
      {
        title: 'Return to Klasly',
        description: 'After completing Stripe onboarding, you\'ll be redirected back. You\'ll see a green "Connected" badge.',
      },
    ],
    tips: [
      'You need a bank account and government ID to complete Stripe setup.',
      'Stripe may take 1-2 business days to verify your account. You can still set up classes in the meantime.',
      'Klasly charges a 0.5% platform fee on each transaction. Stripe\'s own processing fees also apply.',
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
    relatedArticles: ['studio-setup-overview'],
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
    summary: 'Change the time, instructor, or cancel a specific session without affecting the whole class.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['session', 'edit', 'cancel', 'change', 'time', 'reschedule', 'delete'],
    steps: [
      {
        title: 'Go to Schedule',
        description: 'Open the Schedule page. You can use the day, week, or month view.',
      },
      {
        title: 'Click on the session',
        description: 'Click the session you want to edit. A detail panel will open.',
      },
      {
        title: 'Edit or Cancel',
        description: 'To edit: Change the time, instructor, or room, then save. To cancel: Click "Cancel Session". Members who booked will receive a cancellation email automatically.',
      },
    ],
    tips: [
      'Cancelling a session refunds credits to booked members automatically.',
      'If you only need to swap the instructor, you can do it without cancelling.',
      'Editing a session time sends a notification email to all booked members.',
      'Sessions are color-coded: Blue = normal, Violet = private, Amber = fully booked, Gray = cancelled.',
    ],
    relatedArticles: ['create-recurring-class', 'schedule-visibility'],
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
        description: 'Select "Online" for fully virtual, or "Hybrid" if the class is sometimes in-person and sometimes online.',
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
      'For Hybrid classes, you can toggle individual sessions between in-person and online.',
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
    summary: 'See who booked a session, manage waitlists, and handle drop-in attendance.',
    category: 'classes-scheduling',
    audience: ['owner', 'manager'],
    keywords: ['booking', 'attendance', 'waitlist', 'drop-in', 'confirm', 'cancel booking'],
    steps: [
      {
        title: 'Go to Bookings',
        description: 'Click "Bookings" in the sidebar, then click on a session.',
      },
      {
        title: 'View confirmed and waitlisted members',
        description: 'You\'ll see confirmed members with reserved spots and waitlisted members waiting for a spot to open.',
      },
      {
        title: 'Cancel a booking',
        description: 'Click the cancel button next to a member\'s booking. Their credit will be returned automatically.',
      },
      {
        title: 'Record drop-in attendance',
        description: 'Click the "Drop-in" tab, search for the member, and click "Add". Their credit will be deducted automatically.',
      },
    ],
    tips: [
      'When a confirmed member cancels, the first person on the waitlist is automatically promoted.',
      'Waitlist bookings do not consume credits. Credits are only deducted when promoted to confirmed.',
      'Drop-in attendees are listed separately and counted in total attendance.',
    ],
    relatedArticles: ['edit-cancel-session', 'create-recurring-class'],
  },

  {
    id: 'manage-rooms',
    title: 'Set up and manage rooms',
    summary: 'Define your studio spaces so instructors can book them.',
    category: 'classes-scheduling',
    audience: ['owner'],
    keywords: ['room', 'space', 'studio', 'practitioner', 'setup', 'manage', 'timeline'],
    featureFlag: 'collective.room_management',
    steps: [
      {
        title: 'Go to Rooms',
        description: 'Click "Rooms" in the sidebar. The default view shows a Room Usage timeline for the day.',
      },
      {
        title: 'Click "Manage Rooms"',
        description: 'Click "+ Add room" and enter name, capacity, and description.',
      },
      {
        title: 'Assign rooms to classes',
        description: 'When creating or editing a class, select a room from the dropdown.',
      },
    ],
    tips: [
      'Room bookings appear on the Schedule calendar in teal with a "Room" badge.',
      'Double-booking is prevented automatically.',
      'If you also teach classes (owner-instructor), a "Book Room" tab appears on the Rooms page.',
    ],
    relatedArticles: ['collective-overview', 'collective-self-scheduling'],
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
    keywords: ['member', 'add', 'new', 'create', 'register', 'sign up'],
    steps: [
      {
        title: 'Go to Members',
        description: 'Click "Members" in the sidebar.',
      },
      {
        title: 'Click "Add Member"',
        description: 'Enter the member\'s name, email address, and phone number (optional).',
      },
      {
        title: 'Set their plan (optional)',
        description: 'Assign a membership plan or add credits manually.',
      },
      {
        title: 'Save',
        description: 'The member will receive a welcome email with a link to set their password.',
      },
    ],
    tips: [
      'To add many members at once, use CSV Import instead.',
      'Members can also sign up themselves through your booking page or widget.',
    ],
    relatedArticles: ['import-members-csv', 'manage-member-credits', 'member-minor-waiver'],
  },

  {
    id: 'import-members-csv',
    title: 'Import members from CSV',
    summary: 'Add many members at once by uploading a spreadsheet.',
    category: 'members',
    audience: ['owner', 'manager'],
    keywords: ['csv', 'import', 'bulk', 'members', 'upload', 'spreadsheet', 'migrate', 'transfer'],
    steps: [
      {
        title: 'Download the template',
        description: 'Go to Members → Import CSV. Click "Download Template".',
      },
      {
        title: 'Fill in your data',
        description: 'Open in Excel or Google Sheets. Fill in name, email, and optionally phone and plan for each member.',
      },
      {
        title: 'Upload and preview',
        description: 'Upload the CSV file. Review the preview to check for errors.',
      },
      {
        title: 'Import',
        description: 'Click "Import". Each member will receive a welcome email.',
      },
    ],
    tips: [
      'Great for migrating from another platform — export your member list from your old tool and reformat it to match the template.',
      'Duplicate emails are skipped automatically.',
      'The import will skip rows with invalid email addresses and show you which rows were skipped.',
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
    title: 'Assign manager permissions to an instructor',
    summary: 'Give an instructor elevated access to help manage the studio.',
    category: 'collective-mode',
    audience: ['owner'],
    keywords: ['manager', 'role', 'permission', 'promote', 'access', 'staff'],
    steps: [
      {
        title: 'Go to Managers',
        description: 'Click "Managers" in the sidebar and click "+ Invite manager".',
      },
      {
        title: 'Set permissions',
        description: 'Each manager has 8 permission toggles: Members, Classes, Instructors, Bookings, Rooms, Payments, Messages, and Teach.',
      },
    ],
    tips: [
      'Managers cannot change Stripe settings, billing, or delete the studio.',
      'You can have multiple managers.',
      'Managers with "Teach" permission can also create and teach their own classes.',
    ],
    relatedArticles: ['understanding-roles', 'invite-instructor'],
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
    title: 'Set up instructor membership tiers',
    summary: 'Create monthly plans that instructors pay to use your space.',
    category: 'collective-mode',
    audience: ['owner'],
    keywords: ['tier', 'membership', 'instructor', 'billing', 'rent', 'monthly', 'hours', 'plan', 'overage'],
    featureFlag: 'collective.instructor_billing',
    steps: [
      {
        title: 'Go to Settings → Tiers',
        description: 'Click "Create Tier".',
      },
      {
        title: 'Set tier details',
        description: 'Enter the tier name, monthly price, and included hours. You can create multiple tiers for different rooms or usage levels.',
      },
      {
        title: 'Configure overage (optional)',
        description: 'Choose "Allow overage with hourly charge" and set the rate, or "Block scheduling when limit is reached".',
      },
      {
        title: 'Assign to instructors',
        description: 'When inviting or editing an instructor, assign them to a tier. They\'ll be billed monthly through Stripe.',
      },
    ],
    tips: [
      'Hours are tracked in 15-minute increments automatically.',
      'If an instructor exceeds their tier hours, overage fees apply automatically.',
      'Instructors are warned when they approach 90% of their monthly limit.',
      'You can waive overage charges before they\'re processed.',
    ],
    relatedArticles: ['collective-overview', 'invite-instructor'],
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
        title: 'Configure payments',
        description: 'Choose whether to require a deposit. Enable installments to let attendees pay in 3 parts.',
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
        description: 'Pay in full or select installments (3 payments). Some events include an application form.',
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
