/**
 * Klasly メールテンプレート
 * シンプルなHTML（インラインCSS）、Klaslyブランドカラー（青系）、レスポンシブ
 */

const BRAND_COLOR = "#0074c5";
const BG_LIGHT = "#f0f7ff";
const FOOTER = "Manage your bookings at app.klasly.app";

function baseHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;color:#111827;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:white;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="margin-bottom:24px;">
        <span style="font-size:20px;font-weight:700;color:${BRAND_COLOR}">Klasly</span>
      </div>
      ${content}
      <p style="margin-top:32px;font-size:12px;color:#6b7280;">${FOOTER}</p>
    </div>
  </div>
</body>
</html>`;
}

type BookingParams = {
  memberName: string;
  className: string;
  sessionDate: string;
  startTime: string;
  studioName: string;
  isOnline?: boolean;
  onlineLink?: string | null;
};

export function bookingConfirmation(params: BookingParams) {
  const { memberName, className, sessionDate, startTime, studioName, isOnline, onlineLink } = params;
  const onlineSection = isOnline && onlineLink
    ? `<p style="margin:12px 0 0;">
        <a href="${onlineLink}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Join Online →
        </a>
      </p>`
    : isOnline
      ? `<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">📹 Online class</p>`
      : "";
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Booking Confirmed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your booking has been confirmed for:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${isOnline ? "📹 " : ""}${className}</p>
      <p style="margin:8px 0 0;font-size:14px;">${sessionDate} · ${startTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
      ${onlineSection}
    </div>
    <p style="margin:0;font-size:14px;">${isOnline ? "See you online!" : "We look forward to seeing you!"}</p>
  `;
  return {
    subject: `Booking Confirmed - ${className}`,
    html: baseHtml(content),
  };
}

export function bookingCancelled(params: BookingParams) {
  const { memberName, className, sessionDate, startTime, studioName } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Booking Cancelled</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your booking has been cancelled for:
    </p>
    <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#991b1b;">${className}</p>
      <p style="margin:8px 0 0;font-size:14px;">${sessionDate} · ${startTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
    </div>
    <p style="margin:0;font-size:14px;">You can book another class anytime.</p>
  `;
  return {
    subject: `Booking Cancelled - ${className}`,
    html: baseHtml(content),
  };
}

export function waitlistPromoted(params: BookingParams) {
  const { memberName, className, sessionDate, startTime, studioName, isOnline, onlineLink } = params;
  const onlineSection = isOnline && onlineLink
    ? `<p style="margin:12px 0 0;">
        <a href="${onlineLink}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Join Online →
        </a>
      </p>`
    : isOnline
      ? `<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">📹 Online class</p>`
      : "";
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">You're in!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Great news! A spot opened up and you've been moved from the waitlist:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${isOnline ? "📹 " : ""}${className}</p>
      <p style="margin:8px 0 0;font-size:14px;">${sessionDate} · ${startTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
      ${onlineSection}
    </div>
    <p style="margin:0;font-size:14px;">${isOnline ? "See you online!" : "See you there!"}</p>
  `;
  return {
    subject: `You're in! - ${className}`,
    html: baseHtml(content),
  };
}

type PaymentParams = {
  memberName: string;
  amount: number;
  description: string;
  studioName: string;
};

export function paymentReceipt(params: PaymentParams) {
  const { memberName, amount, description, studioName } = params;
  const amountStr = `$${(amount / 100).toFixed(2)}`;
  const dateStr = new Date().toLocaleDateString("en-US");
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Payment Receipt</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Thank you for your payment.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;font-size:24px;color:${BRAND_COLOR};">${amountStr}</p>
      <p style="margin:8px 0 0;font-size:14px;">${description}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName} · ${dateStr}</p>
    </div>
  `;
  return {
    subject: `Payment Receipt - ${studioName}`,
    html: baseHtml(content),
  };
}

export function paymentFailed(params: {
  memberName: string;
  amount: number;
  studioName: string;
}) {
  const { memberName, amount, studioName } = params;
  const amountStr = `$${(amount / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#991b1b;">Payment Failed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      We were unable to process your payment of ${amountStr} for ${studioName}.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Please update your payment method to continue using our services without interruption.
    </p>
    <p style="margin:0;font-size:14px;">
      <a href="https://app.klasly.app/settings/billing" style="color:${BRAND_COLOR};font-weight:600;">Update payment method →</a>
    </p>
  `;
  return {
    subject: `Payment Failed - ${studioName}`,
    html: baseHtml(content),
  };
}

export function waiverInvite(params: {
  memberName: string;
  studioName: string;
  signUrl: string;
}) {
  const { memberName, studioName, signUrl } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Please sign the waiver</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Welcome to <strong>${studioName}</strong>! Before your first class, please review and sign our liability waiver.
    </p>
    <p style="margin:0 0 16px;">
      <a href="${signUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Sign Waiver</a>
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      This link is unique to you. Please do not share it.
    </p>
    <p style="margin:0;font-size:14px;">Thanks,<br>${studioName}</p>
  `;
  return {
    subject: `Please sign the waiver for ${studioName}`,
    html: baseHtml(content),
  };
}

export function instructorInvite(params: {
  instructorName: string;
  studioName: string;
  email: string;
  magicLinkUrl?: string | null;
}) {
  const { instructorName, studioName, email, magicLinkUrl } = params;

  const loginButton = magicLinkUrl
    ? `<p style="margin:0 0 16px;">
        <a href="${magicLinkUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Accept Invitation & Log In
        </a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
        This link expires in 24 hours. After that, use "Forgot password" on the login page to set your password.
      </p>`
    : `<p style="margin:0 0 16px;">
        <a href="https://app.klasly.app/login" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Log In
        </a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
        Use "Forgot password" on the login page to set your password.
      </p>`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">You've been invited as an instructor</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${instructorName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      You've been added as an instructor at <strong>${studioName}</strong> on Klasly.
      Click below to accept the invitation and access your schedule.
    </p>
    ${loginButton}
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
      Email: ${email}
    </p>
    <p style="margin:0;font-size:14px;">Thanks,<br>${studioName}</p>
  `;
  return {
    subject: `You've been invited as an instructor at ${studioName}`,
    html: baseHtml(content),
  };
}

export function messageNotification(params: {
  recipientName: string;
  senderName: string;
  preview: string; // 最大150文字
  studioName: string;
}) {
  const { recipientName, senderName, preview, studioName } = params;
  const truncated =
    preview.length > 150 ? preview.slice(0, 147) + "…" : preview;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">New message from ${senderName}</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${recipientName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      You have a new message from <strong>${senderName}</strong>:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid ${BRAND_COLOR};">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">${truncated}</p>
    </div>
    <p style="margin:0 0 16px;">
      <a href="https://app.klasly.app/messages" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        View Message
      </a>
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;">${studioName}</p>
  `;
  return {
    subject: `New message from ${senderName} — Klasly`,
    html: baseHtml(content),
  };
}

export function instructorPaymentNotification(params: {
  instructorName: string;
  className: string;
  sessionDate: string;
  grossAmount: number;
  studioFee: number;
  platformFee: number;
  stripeFee: number;
  instructorPayout: number;
  studioName: string;
}) {
  const {
    instructorName,
    className,
    sessionDate,
    grossAmount,
    studioFee,
    platformFee,
    stripeFee,
    instructorPayout,
    studioName,
  } = params;

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const dateStr = sessionDate || new Date().toLocaleDateString("en-US");

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">Payment Received</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${instructorName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      You've received a payment for your class:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${className}</p>
      <p style="margin:8px 0 0;font-size:14px;">${dateStr}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 0;color:#6b7280;">Class Price</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;">${fmt(grossAmount)}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 0;color:#6b7280;">Studio Fee</td>
        <td style="padding:8px 0;text-align:right;">-${fmt(studioFee)}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 0;color:#6b7280;">Platform Fee</td>
        <td style="padding:8px 0;text-align:right;">-${fmt(platformFee)}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 0;color:#6b7280;">Processing Fee</td>
        <td style="padding:8px 0;text-align:right;">-${fmt(stripeFee)}</td>
      </tr>
      <tr>
        <td style="padding:12px 0;font-weight:700;color:#059669;">Your Payout</td>
        <td style="padding:12px 0;text-align:right;font-weight:700;font-size:18px;color:#059669;">${fmt(instructorPayout)}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      Processing fees are estimated. Your payout will be deposited to your connected Stripe account.
    </p>
  `;
  return {
    subject: `Payment Received - ${className}`,
    html: baseHtml(content),
  };
}

export function welcomeMember(params: {
  memberName: string;
  studioName: string;
  magicLinkUrl?: string | null;
}) {
  const { memberName, studioName, magicLinkUrl } = params;
  const loginButton = magicLinkUrl
    ? `<p style="margin:0 0 16px;">
        <a href="${magicLinkUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Log in to view schedule & book classes
        </a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
        This link expires in 24 hours. After that, use "Forgot password" on the login page to set your password.
      </p>`
    : `<p style="margin:0 0 16px;">
        <a href="https://app.klasly.app/login" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Log in
        </a>
      </p>`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Welcome!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Welcome to <strong>${studioName}</strong>! We're excited to have you.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      You can log in to view the schedule and book classes:
    </p>
    ${loginButton}
  `;
  return {
    subject: `Welcome to ${studioName}!`,
    html: baseHtml(content),
  };
}

export function guardianWaiverInvite(params: {
  memberName: string;
  studioName: string;
  signUrl: string;
}) {
  const { memberName, studioName, signUrl } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Waiver Signature Required</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi,</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      <strong>${studioName}</strong> requires a guardian signature for <strong>${memberName}</strong> to participate in classes.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      As ${memberName}'s parent or legal guardian, please review and sign the waiver:
    </p>
    <p style="margin:0 0 16px;">
      <a href="${signUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Sign Waiver</a>
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      If you have any questions, please contact the studio directly.
    </p>
    <p style="margin:0;font-size:14px;">Thank you,<br>${studioName}</p>
  `;
  return {
    subject: `Waiver Signature Required for ${memberName} - ${studioName}`,
    html: baseHtml(content),
  };
}

// ============================================================
// Events & Retreats
// ============================================================

type EventBookingParams = {
  guestName: string;
  eventName: string;
  startDate: string;
  endDate: string;
  locationName: string | null;
  totalAmount: number; // cents
  paymentType: "full" | "installment";
  nextPaymentInfo?: string;
};

export function eventBookingConfirmation(params: EventBookingParams) {
  const {
    guestName,
    eventName,
    startDate,
    endDate,
    locationName,
    totalAmount,
    paymentType,
    nextPaymentInfo,
  } = params;
  const formattedAmount = `$${(totalAmount / 100).toFixed(2)}`;
  const nextPaymentSection = nextPaymentInfo
    ? `<p style="margin:12px 0 0;font-size:14px;color:#b45309;font-weight:600;">📅 ${nextPaymentInfo}</p>`
    : "";
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Booking Confirmed!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${guestName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your booking has been confirmed. Here are the details:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${eventName}</p>
      <p style="margin:8px 0 0;font-size:14px;">${startDate} – ${endDate}</p>
      ${locationName ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${locationName}</p>` : ""}
      <p style="margin:8px 0 0;font-size:14px;font-weight:600;">Total: ${formattedAmount}${paymentType === "installment" ? " (installment plan)" : ""}</p>
      ${nextPaymentSection}
    </div>
    <p style="margin:0;font-size:14px;">We look forward to seeing you there!</p>
  `;
  return {
    subject: `Booking Confirmed - ${eventName}`,
    html: baseHtml(content),
  };
}

type InstallmentReminderParams = {
  guestName: string;
  eventName: string;
  amount: number; // cents
  dueDate: string;
};

export function installmentReminder(params: InstallmentReminderParams) {
  const { guestName, eventName, amount, dueDate } = params;
  const formattedAmount = `$${(amount / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Payment Reminder</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${guestName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      This is a reminder that your next payment for <strong>${eventName}</strong> will be charged soon.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">Amount: ${formattedAmount}</p>
      <p style="margin:8px 0 0;font-size:14px;">Date: ${dueDate}</p>
    </div>
    <p style="margin:0;font-size:14px;">No action is needed — the payment will be processed automatically.</p>
  `;
  return {
    subject: `Payment Reminder - ${eventName}`,
    html: baseHtml(content),
  };
}

type InstallmentFailedParams = {
  guestName: string;
  eventName: string;
  amount: number; // cents
};

export function installmentPaymentFailed(params: InstallmentFailedParams) {
  const { guestName, eventName, amount } = params;
  const formattedAmount = `$${(amount / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Payment Failed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${guestName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      We were unable to process your payment of <strong>${formattedAmount}</strong> for <strong>${eventName}</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:14px;">
      Please ensure your payment method is up to date. We will retry the payment automatically.
    </p>
    <p style="margin:0;font-size:14px;">If you have any questions, please contact the studio.</p>
  `;
  return {
    subject: `Payment Failed - ${eventName}`,
    html: baseHtml(content),
  };
}

type EventBookingCancelledParams = {
  guestName: string;
  eventName: string;
  startDate: string;
  endDate: string;
  locationName: string | null;
  refundAmountCents: number;
};

export function eventBookingCancelled(params: EventBookingCancelledParams) {
  const { guestName, eventName, startDate, endDate, locationName, refundAmountCents } = params;
  const refundSection = refundAmountCents > 0
    ? `<p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#059669;">Refund: $${(refundAmountCents / 100).toFixed(2)}</p>
       <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">The refund will be processed to your original payment method. It may take 5–10 business days to appear.</p>`
    : `<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">No refund is applicable for this cancellation.</p>`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Booking Cancelled</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${guestName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your booking for the following event has been cancelled:
    </p>
    <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#991b1b;">${eventName}</p>
      <p style="margin:8px 0 0;font-size:14px;">${startDate} – ${endDate}</p>
      ${locationName ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${locationName}</p>` : ""}
      ${refundSection}
    </div>
    <p style="margin:0;font-size:14px;">If you have any questions, please contact the studio.</p>
  `;
  return {
    subject: `Booking Cancelled - ${eventName}`,
    html: baseHtml(content),
  };
}

type OwnerInstallmentFailedParams = {
  ownerName: string;
  guestName: string;
  guestEmail: string;
  eventName: string;
  amount: number; // cents
  failCount: number;
};

export function ownerInstallmentFailedNotification(params: OwnerInstallmentFailedParams) {
  const { ownerName, guestName, guestEmail, eventName, amount, failCount } = params;
  const formattedAmount = `$${(amount / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Installment Payment Failed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${ownerName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      An installment payment has failed ${failCount} time(s) for the following booking:
    </p>
    <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#991b1b;">${eventName}</p>
      <p style="margin:8px 0 0;font-size:14px;">Guest: ${guestName} (${guestEmail})</p>
      <p style="margin:4px 0 0;font-size:14px;">Amount: ${formattedAmount}</p>
      <p style="margin:4px 0 0;font-size:14px;">Failed attempts: ${failCount}</p>
    </div>
    <p style="margin:0;font-size:14px;">Please review this booking in your dashboard.</p>
  `;
  return {
    subject: `⚠️ Payment Failed - ${guestName} - ${eventName}`,
    html: baseHtml(content),
  };
}

export function eventBookingConfirmedFull(params: {
  guestName: string;
  eventName: string;
  startDate: string;
  endDate: string;
  locationName: string | null;
  optionName: string;
  amountCents: number;
  cancellationPolicySummary: string;
}) {
  const { guestName, eventName, startDate, endDate, locationName, optionName, amountCents, cancellationPolicySummary } = params;
  const formattedAmount = `$${(amountCents / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">Booking Confirmed!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${guestName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your booking has been confirmed. Here are the details:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${eventName}</p>
      <p style="margin:8px 0 0;font-size:14px;">${startDate} – ${endDate}</p>
      ${locationName ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${locationName}</p>` : ""}
      <p style="margin:8px 0 0;font-size:14px;">Option: <strong>${optionName}</strong></p>
      <p style="margin:4px 0 0;font-size:14px;font-weight:600;">Paid: ${formattedAmount}</p>
    </div>
    ${cancellationPolicySummary ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">${cancellationPolicySummary}</p>` : ""}
    <p style="margin:0;font-size:14px;">We look forward to seeing you there!</p>
  `;
  return {
    subject: `Booking Confirmed — ${eventName}`,
    html: baseHtml(content),
  };
}

export function eventBookingConfirmedInstallment(params: {
  guestName: string;
  eventName: string;
  startDate: string;
  endDate: string;
  locationName: string | null;
  optionName: string;
  totalAmountCents: number;
  paidAmountCents: number;
  nextPaymentDate: string;
  nextPaymentAmountCents: number;
  remainingInstallments: number;
  cancellationPolicySummary: string;
}) {
  const {
    guestName, eventName, startDate, endDate, locationName, optionName,
    totalAmountCents, paidAmountCents, nextPaymentDate, nextPaymentAmountCents,
    remainingInstallments, cancellationPolicySummary,
  } = params;
  const fmtTotal = `$${(totalAmountCents / 100).toFixed(2)}`;
  const fmtPaid = `$${(paidAmountCents / 100).toFixed(2)}`;
  const fmtNext = `$${(nextPaymentAmountCents / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">Booking Confirmed!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${guestName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your booking has been confirmed with an installment plan.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${eventName}</p>
      <p style="margin:8px 0 0;font-size:14px;">${startDate} – ${endDate}</p>
      ${locationName ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${locationName}</p>` : ""}
      <p style="margin:8px 0 0;font-size:14px;">Option: <strong>${optionName}</strong></p>
      <p style="margin:4px 0 0;font-size:14px;">Total: ${fmtTotal} · Paid today: ${fmtPaid}</p>
    </div>
    <div style="background:#fffbeb;border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid #f59e0b;">
      <p style="margin:0;font-weight:600;color:#b45309;">📅 Next Payment</p>
      <p style="margin:8px 0 0;font-size:14px;">${fmtNext} on ${nextPaymentDate}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${remainingInstallments} payment(s) remaining</p>
    </div>
    ${cancellationPolicySummary ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">${cancellationPolicySummary}</p>` : ""}
    <p style="margin:0;font-size:14px;">Future payments will be charged automatically to your card.</p>
  `;
  return {
    subject: `Booking Confirmed — ${eventName}`,
    html: baseHtml(content),
  };
}

export function eventPaymentCompleted(params: {
  guestName: string;
  eventName: string;
  startDate: string;
  endDate: string;
  locationName: string | null;
  totalAmountCents: number;
}) {
  const { guestName, eventName, startDate, endDate, locationName, totalAmountCents } = params;
  const fmtTotal = `$${(totalAmountCents / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">Payment Complete!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${guestName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      All payments for your booking have been completed. You're all set!
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${eventName}</p>
      <p style="margin:8px 0 0;font-size:14px;">${startDate} – ${endDate}</p>
      ${locationName ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${locationName}</p>` : ""}
      <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#059669;">Total Paid: ${fmtTotal} ✓</p>
    </div>
    <p style="margin:0;font-size:14px;">We look forward to seeing you there!</p>
  `;
  return {
    subject: `Payment Complete — ${eventName}`,
    html: baseHtml(content),
  };
}

// ============================================================
// Event Waitlist
// ============================================================

export function eventWaitlistConfirmation(params: {
  guestName: string;
  eventName: string;
  optionName: string;
  startDate: string;
  endDate: string;
}) {
  const { guestName, eventName, optionName, startDate, endDate } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:${BRAND_COLOR};">Waitlist Confirmed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${guestName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      You've been added to the waitlist for:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${eventName}</p>
      <p style="margin:8px 0 0;font-size:14px;">${optionName}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${startDate} – ${endDate}</p>
    </div>
    <p style="margin:0;font-size:14px;line-height:1.5;">
      We'll notify you by email if a spot opens up. No payment is required until you're promoted from the waitlist.
    </p>
  `;
  return baseHtml(content);
}

export function eventWaitlistPromoted(params: {
  guestName: string;
  eventName: string;
  optionName: string;
  startDate: string;
  endDate: string;
}) {
  const { guestName, eventName, optionName, startDate, endDate } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">You're in!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${guestName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Great news! A spot opened up and you've been moved from the waitlist:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${eventName}</p>
      <p style="margin:8px 0 0;font-size:14px;">${optionName}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${startDate} – ${endDate}</p>
    </div>
    <p style="margin:0;font-size:14px;line-height:1.5;">
      Your booking is now confirmed. The event organizer will contact you regarding payment details.
    </p>
  `;
  return baseHtml(content);
}

// ============================================================
// Pass Distribution
// ============================================================

export function passDistributionReview(params: {
  ownerName: string;
  month: string;
  totalRevenue: number;
  instructorCount: number;
  distributableAmount: number;
  dashboardUrl: string;
}) {
  const { ownerName, month, totalRevenue, instructorCount, distributableAmount, dashboardUrl } = params;
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:${BRAND_COLOR};">Pass Distribution Ready for Review</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${ownerName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      The pass distribution for <strong>${month}</strong> has been calculated and is ready for your review.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;">Total Revenue: <strong>${fmt(totalRevenue)}</strong></p>
      <p style="margin:8px 0 0;font-size:14px;">Instructors: <strong>${instructorCount}</strong></p>
      <p style="margin:8px 0 0;font-size:14px;">Distributable Amount: <strong style="color:#059669;">${fmt(distributableAmount)}</strong></p>
    </div>
    <p style="margin:0 0 16px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Review &amp; Approve
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#9ca3af;">Payouts will not be sent until you approve them.</p>
  `;
  return {
    subject: `Pass Distribution Ready for Review — ${month}`,
    html: baseHtml(content),
  };
}

export function passDistributionPaid(params: {
  instructorName: string;
  month: string;
  payoutAmount: number;
  classCount: number;
  sharePercent: string;
}) {
  const { instructorName, month, payoutAmount, classCount, sharePercent } = params;
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">Payout Received</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${instructorName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your payout of <strong style="color:#059669;">${fmt(payoutAmount)}</strong> has been sent to your Stripe account.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">Pass Distribution — ${month}</p>
      <p style="margin:8px 0 0;font-size:14px;">Classes taught to pass holders: <strong>${classCount}</strong></p>
      <p style="margin:4px 0 0;font-size:14px;">Your share: <strong>${sharePercent}</strong></p>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">The payout will appear in your connected Stripe account within 1-2 business days.</p>
  `;
  return {
    subject: `Payout Received — ${month}`,
    html: baseHtml(content),
  };
}

export function passDistributionFailed(params: {
  ownerName: string;
  instructorName: string;
  month: string;
  payoutAmount: number;
  errorMessage: string;
}) {
  const { ownerName, instructorName, month, payoutAmount, errorMessage } = params;
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#dc2626;">Payout Failed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${ownerName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      The pass payout for <strong>${instructorName}</strong> (${month}) could not be processed.
    </p>
    <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#991b1b;">Amount: ${fmt(payoutAmount)}</p>
      <p style="margin:8px 0 0;font-size:14px;">Error: ${errorMessage}</p>
    </div>
    <p style="margin:0;font-size:14px;">Please check the instructor&apos;s Stripe Connect account status and retry.</p>
  `;
  return {
    subject: `Payout Failed — ${instructorName} — ${month}`,
    html: baseHtml(content),
  };
}

export function ownerNewBookingNotification(params: {
  ownerName: string;
  guestName: string;
  eventName: string;
  optionName: string;
  amountCents: number;
  paymentType: string;
}) {
  const { ownerName, guestName, eventName, optionName, amountCents, paymentType } = params;
  const fmtAmount = `$${(amountCents / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:${BRAND_COLOR};">New Event Booking</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${ownerName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      A new booking has been received:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${eventName}</p>
      <p style="margin:8px 0 0;font-size:14px;">Guest: <strong>${guestName}</strong></p>
      <p style="margin:4px 0 0;font-size:14px;">Option: ${optionName}</p>
      <p style="margin:4px 0 0;font-size:14px;">Amount: ${fmtAmount} (${paymentType})</p>
    </div>
    <p style="margin:0;">
      <a href="https://app.klasly.app/events" style="color:${BRAND_COLOR};font-weight:600;font-size:14px;">View in Dashboard →</a>
    </p>
  `;
  return {
    subject: `New Booking: ${guestName} — ${eventName}`,
    html: baseHtml(content),
  };
}

// ============================================================
// Referral Program
// ============================================================

/** ① 紹介サインアップ通知（紹介者宛） */
export function referralSignup(params: {
  referrerStudioName: string;
  newStudioName: string;
}) {
  const { referrerStudioName, newStudioName } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:${BRAND_COLOR};">Someone signed up with your referral!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${referrerStudioName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      <strong>${newStudioName}</strong> just signed up through your referral link.
      You'll both get 1 month free when they make their first payment.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#6b7280;">Keep sharing your link to earn more free months!</p>
    </div>
  `;
  return {
    subject: "Someone signed up with your referral!",
    html: baseHtml(content),
  };
}

/** ② 紹介成立 — 紹介者宛 */
export function referralRewardReferrer(params: {
  referrerStudioName: string;
  newStudioName: string;
}) {
  const { referrerStudioName, newStudioName } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">You earned 1 month free!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${referrerStudioName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      <strong>${newStudioName}</strong> just made their first payment.
      Your next month of Klasly is free!
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;font-size:24px;color:#059669;">$0</p>
      <p style="margin:8px 0 0;font-size:14px;">Your next billing cycle</p>
    </div>
    <p style="margin:0;font-size:14px;color:#6b7280;">The discount will be applied to your next billing cycle automatically.</p>
  `;
  return {
    subject: "You earned 1 month free!",
    html: baseHtml(content),
  };
}

/** ③ 紹介成立 — 被紹介者宛 */
export function referralRewardReferred(params: {
  referrerStudioName: string;
  newStudioName: string;
}) {
  const { referrerStudioName, newStudioName } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">Welcome! Your first month is free</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${newStudioName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Thanks to <strong>${referrerStudioName}</strong>'s referral, your next month of Klasly is free!
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;font-size:24px;color:#059669;">$0</p>
      <p style="margin:8px 0 0;font-size:14px;">Your next billing cycle</p>
    </div>
    <p style="margin:0;font-size:14px;color:#6b7280;">The discount will be applied to your next billing cycle automatically.</p>
  `;
  return {
    subject: "Welcome! Your first month is free",
    html: baseHtml(content),
  };
}

// ========================================
// Tier Overage Notifications
// ========================================

export function tierOverageWarning(params: {
  instructorName: string;
  studioName: string;
  usedTime: string;
  limitTime: string;
  overageRate: string | null;
}) {
  const { instructorName, studioName, usedTime, limitTime, overageRate } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">You're approaching your monthly hour limit</h2>
    <p style="margin:0 0 12px;font-size:14px;color:#374151;">
      Hi ${instructorName},
    </p>
    <div style="background:#fef3c7;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;font-size:16px;color:#92400e;">
        ${usedTime} used of ${limitTime}
      </p>
    </div>
    <p style="margin:0 0 12px;font-size:14px;color:#374151;">
      You've used most of your monthly hours at ${studioName}.
      ${overageRate ? `Additional hours beyond your limit will be charged at ${overageRate}/hour at the end of the month.` : ""}
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      Contact the studio if you'd like to upgrade your membership tier.
    </p>
  `;
  return {
    subject: "You're approaching your monthly hour limit",
    html: baseHtml(content),
  };
}

export function tierOverageCharged(params: {
  instructorName: string;
  studioName: string;
  month: string;
  overageTime: string;
  rate: string;
  totalCharge: string;
}) {
  const { instructorName, studioName, month, overageTime, rate, totalCharge } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Overage Charge &mdash; ${month}</h2>
    <p style="margin:0 0 12px;font-size:14px;color:#374151;">
      Hi ${instructorName},
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:#374151;">
      You used more than your included hours at ${studioName} in ${month}. Here's a summary:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#374151;">Overage: <strong>${overageTime}</strong></p>
      <p style="margin:8px 0 0;font-size:14px;color:#374151;">Rate: <strong>${rate}/hour</strong></p>
      <p style="margin:8px 0 0;font-weight:600;font-size:20px;color:${BRAND_COLOR};">${totalCharge}</p>
    </div>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      This has been charged to your payment method on file.
    </p>
  `;
  return {
    subject: `Overage Charge — ${month}`,
    html: baseHtml(content),
  };
}

export function tierOverageChargeFailed(params: {
  ownerName: string;
  instructorName: string;
  month: string;
  totalCharge: string;
  failureReason: string;
}) {
  const { ownerName, instructorName, month, totalCharge, failureReason } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Overage Charge Failed &mdash; ${instructorName}</h2>
    <p style="margin:0 0 12px;font-size:14px;color:#374151;">
      Hi ${ownerName},
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:#374151;">
      We were unable to charge ${instructorName} for their overage hours in ${month}.
    </p>
    <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#991b1b;">Amount: <strong>${totalCharge}</strong></p>
      <p style="margin:8px 0 0;font-size:14px;color:#991b1b;">Reason: ${failureReason}</p>
    </div>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      Please follow up with the instructor to resolve the payment manually.
    </p>
  `;
  return {
    subject: `Overage Charge Failed — ${instructorName}`,
    html: baseHtml(content),
  };
}

// ============================================================
// Admin notifications
// ============================================================

export function newStudioSignupAdmin(params: {
  studioName: string;
  ownerEmail: string;
  createdAt: string;
}): { subject: string; html: string } {
  const { studioName, ownerEmail, createdAt } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:${BRAND_COLOR};">🆕 New Studio Signup</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      A new studio has been created on Klasly.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${studioName}</p>
      <p style="margin:8px 0 0;font-size:14px;">Owner: ${ownerEmail}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">Created: ${createdAt}</p>
    </div>
  `;
  return {
    subject: `🆕 New signup: ${studioName}`,
    html: baseHtml(content),
  };
}

// ============================================
// Appointment templates
// ============================================

type AppointmentParams = {
  memberName: string;
  instructorName: string;
  appointmentType: string;
  date: string;
  startTime: string;
  studioName: string;
};

export function appointmentConfirmation(params: AppointmentParams) {
  const { memberName, instructorName, appointmentType, date, startTime, studioName } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Appointment Confirmed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your appointment has been confirmed:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${appointmentType}</p>
      <p style="margin:8px 0 0;font-size:14px;">with ${instructorName}</p>
      <p style="margin:4px 0 0;font-size:14px;">${date} · ${startTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
    </div>
    <p style="margin:0;font-size:14px;">We look forward to seeing you!</p>
  `;
  return {
    subject: `Appointment Confirmed - ${appointmentType}`,
    html: baseHtml(content),
  };
}

export function appointmentCancelled(params: AppointmentParams & { cancelledBy: string }) {
  const { memberName, instructorName, appointmentType, date, startTime, studioName, cancelledBy } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#991b1b;">Appointment Cancelled</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your appointment has been cancelled${cancelledBy ? ` by ${cancelledBy}` : ""}:
    </p>
    <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#991b1b;">${appointmentType}</p>
      <p style="margin:8px 0 0;font-size:14px;">with ${instructorName}</p>
      <p style="margin:4px 0 0;font-size:14px;">${date} · ${startTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
    </div>
    <p style="margin:0;font-size:14px;">You can book another appointment anytime.</p>
  `;
  return {
    subject: `Appointment Cancelled - ${appointmentType}`,
    html: baseHtml(content),
  };
}

// ── Instructor Room Booking Notification ──

export function instructorRoomBooking(params: {
  recipientName: string;
  instructorName: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  title?: string | null;
  studioName: string;
}) {
  const { recipientName, instructorName, roomName, date, startTime, endTime, title, studioName } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">New Room Booking</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${recipientName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      <strong>${instructorName}</strong> has booked <strong>${roomName}</strong>.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      ${title ? `<p style="margin:0 0 4px;font-weight:600;color:#111827;">${title}</p>` : ""}
      <p style="margin:0;font-size:14px;"><strong>Date:</strong> ${date}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Time:</strong> ${startTime} – ${endTime}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Room:</strong> ${roomName}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
    </div>
    <p style="margin:16px 0 0;">
      <a href="https://app.klasly.app/bookings" style="color:${BRAND_COLOR};text-decoration:none;font-weight:600;">
        View in Klasly →
      </a>
    </p>
  `;
  return {
    subject: `${instructorName} booked ${roomName}`,
    html: baseHtml(content),
  };
}
