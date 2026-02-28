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
  tempPassword?: string;
}) {
  const { instructorName, studioName, email, tempPassword } = params;
  const passwordLine = tempPassword
    ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Temporary password: ${tempPassword}</p><p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Please change it after your first login.</p>`
    : `<p style="margin:0 0 16px;font-size:14px;color:#6b7280;">Please set your password after your first login (use &quot;Forgot password&quot; if needed).</p>`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">You've been added as an instructor</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${instructorName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      You've been added as an instructor at <strong>${studioName}</strong> on Klasly.
    </p>
    <p style="margin:0 0 16px;">
      <a href="https://app.klasly.app/login" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Log in here</a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
      Email: ${email}
    </p>
    ${passwordLine}
    <p style="margin:0;font-size:14px;">Thanks,<br>${studioName}</p>
  `;
  return {
    subject: `You've been added as an instructor on ${studioName}`,
    html: baseHtml(content),
  };
}

export function welcomeMember(params: { memberName: string; studioName: string }) {
  const { memberName, studioName } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Welcome!</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Welcome to <strong>${studioName}</strong>! We're excited to have you.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      You can log in to view the schedule and book classes:
    </p>
    <p style="margin:0;">
      <a href="https://app.klasly.app/login" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Log in</a>
    </p>
  `;
  return {
    subject: `Welcome to ${studioName}!`,
    html: baseHtml(content),
  };
}
