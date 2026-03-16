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
};

export function bookingConfirmation(params: BookingParams) {
  const { memberName, className, sessionDate, startTime, studioName } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Booking Confirmed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your booking has been confirmed for:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${className}</p>
      <p style="margin:8px 0 0;font-size:14px;">${sessionDate} · ${startTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
    </div>
    <p style="margin:0;font-size:14px;">We look forward to seeing you!</p>
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
  const { memberName, className, sessionDate, startTime, studioName } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">You're in!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Great news! A spot opened up and you've been moved from the waitlist:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${className}</p>
      <p style="margin:8px 0 0;font-size:14px;">${sessionDate} · ${startTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
    </div>
    <p style="margin:0;font-size:14px;">See you there!</p>
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
