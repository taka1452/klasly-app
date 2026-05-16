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
  /** TZ abbreviation (e.g. "PT") to display next to the start time. */
  studioTzAbbrev?: string | null;
  /** Optional admin-authored overrides (per-class beats studio-wide).
   *  Both fields support {memberName} {className} {sessionDate}
   *  {startTime} {studioName} interpolation. When body is provided,
   *  paragraphs are rendered preserving line breaks; the class details
   *  block is always appended below the custom body. */
  overrideSubject?: string | null;
  overrideBody?: string | null;
};

function interpolateBookingVars(
  template: string,
  vars: {
    memberName: string;
    className: string;
    sessionDate: string;
    startTime: string;
    studioName: string;
  }
): string {
  return template
    .replaceAll("{memberName}", vars.memberName)
    .replaceAll("{className}", vars.className)
    .replaceAll("{eventName}", vars.className)
    .replaceAll("{sessionDate}", vars.sessionDate)
    .replaceAll("{startTime}", vars.startTime)
    .replaceAll("{studioName}", vars.studioName);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function bookingConfirmation(params: BookingParams) {
  const {
    memberName,
    className,
    sessionDate,
    startTime,
    studioName,
    isOnline,
    onlineLink,
    studioTzAbbrev,
    overrideSubject,
    overrideBody,
  } = params;
  const vars = { memberName, className, sessionDate, startTime, studioName };
  const onlineSection = isOnline && onlineLink
    ? `<p style="margin:12px 0 0;">
        <a href="${onlineLink}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Join Online →
        </a>
      </p>`
    : isOnline
      ? `<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">📹 Online class</p>`
      : "";
  const tzSuffix = isOnline && studioTzAbbrev ? ` ${studioTzAbbrev}` : "";

  const customBodyHtml =
    overrideBody && overrideBody.trim()
      ? escapeHtml(interpolateBookingVars(overrideBody, vars))
          .split(/\r?\n\r?\n/)
          .map(
            (para) =>
              `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${para.replaceAll(/\r?\n/g, "<br>")}</p>`
          )
          .join("")
      : `<p style="margin:0 0 8px;font-size:15px;">Hi ${escapeHtml(memberName)},</p>
         <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Your booking has been confirmed for:</p>`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Booking Confirmed</h2>
    ${customBodyHtml}
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${isOnline ? "📹 " : ""}${escapeHtml(className)}</p>
      <p style="margin:8px 0 0;font-size:14px;">${escapeHtml(sessionDate)} · ${escapeHtml(startTime)}${tzSuffix}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${escapeHtml(studioName)}</p>
      ${onlineSection}
    </div>
    ${overrideBody ? "" : `<p style="margin:0;font-size:14px;">${isOnline ? "See you online!" : "We look forward to seeing you!"}</p>`}
  `;

  const subject =
    overrideSubject && overrideSubject.trim()
      ? interpolateBookingVars(overrideSubject, vars)
      : `Booking Confirmed - ${className}`;

  return {
    subject,
    html: baseHtml(content),
  };
}

export function instructorRoomBookingConfirmation(params: {
  instructorName: string;
  roomName: string;
  title: string;
  dates: string[]; // YYYY-MM-DD, chronological
  startTime: string;
  endTime: string;
  studioName: string;
  overage?: {
    minutes: number;
    rateCents: number | null;
    estimatedChargeCents: number | null;
  } | null;
}) {
  const {
    instructorName,
    roomName,
    title,
    dates,
    startTime,
    endTime,
    studioName,
    overage,
  } = params;
  const recurring = dates.length > 1;
  const dateList = recurring
    ? `${dates.length} sessions: ${dates[0]} → ${dates[dates.length - 1]}`
    : dates[0] ?? "";

  const overageSection = overage
    ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:12px 0;font-size:13px;color:#92400e;">
        <strong>Overage charge ${overage.estimatedChargeCents != null ? `: $${(overage.estimatedChargeCents / 100).toFixed(2)}` : " applies"}</strong><br />
        This booking puts you ${Math.floor(overage.minutes / 60)}h ${overage.minutes % 60}m over your plan's monthly allowance${overage.rateCents ? ` (billed at $${(overage.rateCents / 100).toFixed(2)}/hour)` : ""}. The amount is charged on the 1st of next month.
      </div>`
    : "";

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Room booking confirmed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${instructorName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Your studio room booking is confirmed:</p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${title}</p>
      <p style="margin:8px 0 0;font-size:14px;">${dateList}</p>
      <p style="margin:4px 0 0;font-size:14px;">${startTime} &ndash; ${endTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${roomName} &middot; ${studioName}</p>
    </div>
    ${overageSection}
    <p style="margin:0;font-size:13px;color:#6b7280;">You can manage your bookings anytime from the instructor portal.</p>
  `;
  return {
    subject: recurring
      ? `Room booking confirmed - ${dates.length} sessions - ${title}`
      : `Room booking confirmed - ${title}`,
    html: baseHtml(content),
  };
}

export function instructorRoomBookingCancelledByOwner(params: {
  instructorName: string;
  roomName: string;
  title: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  studioName: string;
  reason?: string | null;
}) {
  const {
    instructorName,
    roomName,
    title,
    bookingDate,
    startTime,
    endTime,
    studioName,
    reason,
  } = params;
  const reasonSection = reason
    ? `<p style="margin:12px 0 0;font-size:14px;"><strong>Reason:</strong> ${reason}</p>`
    : "";
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Room booking cancelled</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${instructorName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      The studio has cancelled one of your room bookings:
    </p>
    <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#991b1b;">${title}</p>
      <p style="margin:8px 0 0;font-size:14px;">${bookingDate}</p>
      <p style="margin:4px 0 0;font-size:14px;">${startTime} &ndash; ${endTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${roomName} &middot; ${studioName}</p>
      ${reasonSection}
    </div>
    <p style="margin:0;font-size:14px;">Please reach out to the studio if you have questions.</p>
  `;
  return {
    subject: `Your room booking was cancelled - ${title}`,
    html: baseHtml(content),
  };
}

/**
 * Sent to confirmed-booking members when a session's instructor changes
 * (substitution flow). Lets the member decide whether they still want to
 * attend without having to chase the studio for context.
 */
export function sessionInstructorChanged(params: {
  memberName: string;
  className: string;
  sessionDate: string;
  startTime: string;
  studioName: string;
  newInstructorName: string;
  previousInstructorName: string | null;
}) {
  const {
    memberName,
    className,
    sessionDate,
    startTime,
    studioName,
    newInstructorName,
    previousInstructorName,
  } = params;
  const swapLine = previousInstructorName
    ? `${previousInstructorName} → <strong>${newInstructorName}</strong>`
    : `Your instructor for this class is now <strong>${newInstructorName}</strong>.`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Instructor change for your class</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your booking is still confirmed — but the instructor for this session has changed.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${className}</p>
      <p style="margin:8px 0 0;font-size:14px;">${sessionDate} · ${startTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
      <p style="margin:12px 0 0;font-size:14px;">${swapLine}</p>
    </div>
    <p style="margin:0;font-size:14px;">If this doesn't work for you, you can cancel your booking anytime from your account.</p>
  `;
  return {
    subject: `Instructor change — ${className}`,
    html: baseHtml(content),
  };
}

/**
 * Session has been rescheduled (date or time changed) — let confirmed
 * members know so they can adjust their plans. Single-session granularity:
 * if a series-wide change is made, the caller fans this out per session.
 *
 * Jamie feedback 2026-04-30: "when we make those changes, can we have
 * an option to notify any bookings of the change/cancellation?"
 */
export function sessionRescheduled(params: {
  memberName: string;
  className: string;
  oldDate: string;
  oldStartTime: string;
  newDate: string;
  newStartTime: string;
  newEndTime?: string | null;
  studioName: string;
}) {
  const {
    memberName,
    className,
    oldDate,
    oldStartTime,
    newDate,
    newStartTime,
    newEndTime,
    studioName,
  } = params;
  const newWhen = `${newDate} · ${newStartTime}${newEndTime ? `–${newEndTime}` : ""}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Class rescheduled</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Your booking is still confirmed — but the date or time for this session has changed.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${className}</p>
      <p style="margin:8px 0 0;font-size:14px;color:#6b7280;text-decoration:line-through;">
        Was: ${oldDate} · ${oldStartTime}
      </p>
      <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111827;">
        Now: ${newWhen}
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">${studioName}</p>
    </div>
    <p style="margin:0;font-size:14px;">If the new time doesn't work, you can cancel your booking anytime from your account.</p>
  `;
  return {
    subject: `Class rescheduled — ${className}`,
    html: baseHtml(content),
  };
}

/**
 * Session has been cancelled by the studio. Used by the schedule edit
 * flow to optionally email confirmed bookers (default ON, owner can
 * suppress for silent fixes). Distinct from `bookingCancelled` which is
 * triggered when a single member cancels their own booking.
 */
export function sessionCancelledNotice(params: {
  memberName: string;
  className: string;
  sessionDate: string;
  startTime: string;
  studioName: string;
  reason?: string | null;
  refundedCredits?: number | null;
}) {
  const {
    memberName,
    className,
    sessionDate,
    startTime,
    studioName,
    reason,
    refundedCredits,
  } = params;
  const reasonLine = reason
    ? `<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Reason: ${reason}</p>`
    : "";
  const refundLine =
    typeof refundedCredits === "number" && refundedCredits > 0
      ? `<p style="margin:8px 0 0;font-size:14px;color:#16a34a;">${refundedCredits} credit${refundedCredits === 1 ? "" : "s"} refunded to your account.</p>`
      : "";
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Class cancelled</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      We're sorry — the studio has cancelled this session. Your booking has been removed.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${className}</p>
      <p style="margin:8px 0 0;font-size:14px;">${sessionDate} · ${startTime}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
      ${reasonLine}
      ${refundLine}
    </div>
    <p style="margin:0;font-size:14px;">Browse the schedule to book another class anytime.</p>
  `;
  return {
    subject: `Class cancelled — ${className}`,
    html: baseHtml(content),
  };
}

/**
 * "It's your turn to sign" email — sent to a signer when the previous
 * signer in a contract envelope completes their signature, or to the
 * very first signer when the envelope is created.
 *
 * Jamie feedback 2026-04-30: ordered multi-signature contracts (Jotform-
 * style). The signLink carries a single-use token tied to one signer.
 */
export function contractSignRequest(params: {
  signerName: string;
  studioName: string;
  contractTitle: string;
  roleLabel?: string | null;
  signLink: string;
  totalSigners: number;
  signOrder: number;
}) {
  const {
    signerName,
    studioName,
    contractTitle,
    roleLabel,
    signLink,
    totalSigners,
    signOrder,
  } = params;
  const positionLine =
    totalSigners > 1
      ? `You're signer <strong>${signOrder} of ${totalSigners}</strong>${roleLabel ? ` (${roleLabel})` : ""}.`
      : roleLabel
        ? `You're signing as <strong>${roleLabel}</strong>.`
        : "";
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Action needed: sign ${contractTitle}</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${signerName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      ${studioName} has sent you a contract to review and sign.
      ${positionLine}
    </p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${signLink}"
         style="display:inline-block;padding:12px 24px;background:${BRAND_COLOR};color:#fff;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
        Review &amp; sign
      </a>
    </div>
    <p style="margin:0;font-size:13px;color:#6b7280;">
      This link is unique to you. If you weren't expecting this, you can ignore the email.
    </p>
  `;
  return {
    subject: `Sign ${contractTitle} — ${studioName}`,
    html: baseHtml(content),
  };
}

/**
 * "All signers have signed" email — sent to the studio admin who
 * created the envelope once the last signer completes. Includes a
 * link back to the envelope detail page so they can download/view the
 * signed contract.
 */
export function contractSignComplete(params: {
  adminName: string;
  studioName: string;
  contractTitle: string;
  signerCount: number;
  envelopeUrl: string;
}) {
  const { adminName, studioName, contractTitle, signerCount, envelopeUrl } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${contractTitle} — fully signed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${adminName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      All ${signerCount} signer${signerCount === 1 ? "" : "s"} on the
      <strong>${contractTitle}</strong> contract have signed. The envelope
      is now sealed and accessible from ${studioName}'s dashboard.
    </p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${envelopeUrl}"
         style="display:inline-block;padding:10px 20px;background:${BRAND_COLOR};color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        View signed contract
      </a>
    </div>
  `;
  return {
    subject: `${contractTitle} signed — ${studioName}`,
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

export function memberPaymentSuccessOwnerNotice(params: {
  ownerName: string;
  memberName: string;
  memberEmail: string;
  amount: number;
  description: string;
  studioName: string;
}) {
  const { ownerName, memberName, memberEmail, amount, description, studioName } = params;
  const amountStr = `$${(amount / 100).toFixed(2)}`;
  const dateStr = new Date().toLocaleDateString("en-US");
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Payment Received</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${ownerName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      A payment has been successfully processed for your studio.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;font-size:24px;color:${BRAND_COLOR};">${amountStr}</p>
      <p style="margin:8px 0 0;font-size:14px;font-weight:600;">${memberName}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${memberEmail}</p>
      <p style="margin:8px 0 0;font-size:14px;">${description}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName} · ${dateStr}</p>
    </div>
    <p style="margin:0;font-size:14px;">
      <a href="https://app.klasly.app/dashboard/payments" style="color:${BRAND_COLOR};font-weight:600;">View payments →</a>
    </p>
  `;
  return {
    subject: `Payment Received: ${amountStr} from ${memberName} - ${studioName}`,
    html: baseHtml(content),
  };
}

export function memberPaymentFailedOwnerNotice(params: {
  ownerName: string;
  memberName: string;
  memberEmail: string;
  amount: number;
  description: string;
  studioName: string;
}) {
  const { ownerName, memberName, memberEmail, amount, description, studioName } = params;
  const amountStr = `$${(amount / 100).toFixed(2)}`;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#991b1b;">Member Payment Failed</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${ownerName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      A payment attempt has failed for one of your members.
    </p>
    <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;font-size:24px;color:#991b1b;">${amountStr}</p>
      <p style="margin:8px 0 0;font-size:14px;font-weight:600;">${memberName}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${memberEmail}</p>
      <p style="margin:8px 0 0;font-size:14px;">${description}</p>
    </div>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Stripe will automatically retry the payment. If the issue persists, you may want to reach out to the member to update their payment method.
    </p>
    <p style="margin:0;font-size:14px;">
      <a href="https://app.klasly.app/dashboard/payments" style="color:${BRAND_COLOR};font-weight:600;">View payments →</a>
    </p>
  `;
  return {
    subject: `Payment Failed: ${memberName} - ${studioName}`,
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
  /** Optional admin-authored overrides (per-event beats studio-wide).
   *  Both fields support {memberName} {eventName} {sessionDate}
   *  {startTime} {studioName} interpolation. */
  overrideSubject?: string | null;
  overrideBody?: string | null;
  studioName?: string;
}) {
  const { guestName, eventName, startDate, endDate, locationName, optionName, amountCents, cancellationPolicySummary, overrideSubject, overrideBody, studioName } = params;
  const formattedAmount = `$${(amountCents / 100).toFixed(2)}`;
  const vars = {
    memberName: guestName,
    className: eventName,
    sessionDate: startDate,
    startTime: "",
    studioName: studioName ?? "",
  };
  const customBodyHtml =
    overrideBody && overrideBody.trim()
      ? escapeHtml(interpolateBookingVars(overrideBody, vars))
          .split(/\r?\n\r?\n/)
          .map(
            (para) =>
              `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${para.replaceAll(/\r?\n/g, "<br>")}</p>`
          )
          .join("")
      : `<p style="margin:0 0 8px;font-size:15px;">Hi ${escapeHtml(guestName)},</p>
         <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Your booking has been confirmed. Here are the details:</p>`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#059669;">Booking Confirmed!</h2>
    ${customBodyHtml}
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${escapeHtml(eventName)}</p>
      <p style="margin:8px 0 0;font-size:14px;">${escapeHtml(startDate)} – ${escapeHtml(endDate)}</p>
      ${locationName ? `<p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${escapeHtml(locationName)}</p>` : ""}
      <p style="margin:8px 0 0;font-size:14px;">Option: <strong>${escapeHtml(optionName)}</strong></p>
      <p style="margin:4px 0 0;font-size:14px;font-weight:600;">Paid: ${formattedAmount}</p>
    </div>
    ${cancellationPolicySummary ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">${cancellationPolicySummary}</p>` : ""}
    ${overrideBody ? "" : `<p style="margin:0;font-size:14px;">We look forward to seeing you there!</p>`}
  `;

  const subject =
    overrideSubject && overrideSubject.trim()
      ? interpolateBookingVars(overrideSubject, vars)
      : `Booking Confirmed — ${eventName}`;

  return {
    subject,
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

/**
 * Notifies owner/managers when an instructor schedules a new class session
 * or when a member books a private appointment with an instructor.
 * `activity` summarises what happened ("scheduled a new class",
 * "received a private appointment", etc.) so one template covers both flows.
 */
export function instructorBookingStaffNotice(params: {
  recipientName: string;
  instructorName: string;
  activity: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  studioName: string;
  linkPath?: string;
}) {
  const {
    recipientName,
    instructorName,
    activity,
    title,
    date,
    startTime,
    endTime,
    location,
    studioName,
    linkPath,
  } = params;
  const path = linkPath || "/calendar";
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">New instructor booking</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${recipientName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      <strong>${instructorName}</strong> ${activity}.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${title}</p>
      <p style="margin:8px 0 0;font-size:14px;"><strong>Date:</strong> ${date}</p>
      <p style="margin:4px 0 0;font-size:14px;"><strong>Time:</strong> ${startTime}${endTime ? ` – ${endTime}` : ""}</p>
      ${location ? `<p style="margin:4px 0 0;font-size:14px;"><strong>Where:</strong> ${location}</p>` : ""}
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
    </div>
    <p style="margin:16px 0 0;">
      <a href="https://app.klasly.app${path}" style="color:${BRAND_COLOR};text-decoration:none;font-weight:600;">
        View in Klasly →
      </a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">
      You can turn these notifications off in Account settings → Notifications.
    </p>
  `;
  return {
    subject: `${instructorName} — ${title}`,
    html: baseHtml(content),
  };
}

// ============================================================
// Owner weekly summary — Monday morning recap
// ============================================================

type OwnerWeeklySummaryParams = {
  ownerName: string;
  studioName: string;
  currency: string;
  weekStart: string;
  weekEnd: string;
  revenueCents: number;
  revenueDeltaPct: number | null; // null when prior week had zero
  newMembers: number;
  cancelledMembers: number;
  topClasses: Array<{ name: string; bookings: number }>;
  topInstructor: { name: string; bookings: number } | null;
  /** Number of consecutive weeks with positive revenue growth (>=2 to display) */
  growthStreakWeeks: number;
};

function formatCurrencyCents(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

export function ownerWeeklySummary(params: OwnerWeeklySummaryParams) {
  const {
    ownerName,
    studioName,
    currency,
    weekStart,
    weekEnd,
    revenueCents,
    revenueDeltaPct,
    newMembers,
    cancelledMembers,
    topClasses,
    topInstructor,
    growthStreakWeeks,
  } = params;

  const deltaLabel =
    revenueDeltaPct === null
      ? ""
      : revenueDeltaPct >= 0
        ? `<span style="color:#059669;font-size:14px;font-weight:600;">▲ ${revenueDeltaPct.toFixed(0)}%</span>`
        : `<span style="color:#dc2626;font-size:14px;font-weight:600;">▼ ${Math.abs(revenueDeltaPct).toFixed(0)}%</span>`;

  const topClassesHtml = topClasses.length === 0
    ? `<p style="margin:0;font-size:14px;color:#6b7280;">No bookings this week.</p>`
    : topClasses
        .map(
          (c, i) =>
            `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:${i === topClasses.length - 1 ? "none" : "1px solid #e5e7eb"};">
              <span style="font-size:14px;">${i + 1}. ${c.name}</span>
              <span style="font-size:14px;color:#6b7280;">${c.bookings}</span>
            </div>`
        )
        .join("");

  const topInstructorHtml = topInstructor
    ? `<div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:13px;color:#6b7280;">Top instructor</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:${BRAND_COLOR};">${topInstructor.name}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${topInstructor.bookings} bookings</p>
      </div>`
    : "";

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Your week at ${studioName}</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">${weekStart} – ${weekEnd}</p>

    <div style="background:${BG_LIGHT};border-radius:8px;padding:20px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Revenue this week</p>
      <p style="margin:6px 0 4px;font-size:28px;font-weight:700;color:${BRAND_COLOR};">${formatCurrencyCents(revenueCents, currency)}</p>
      ${deltaLabel ? `<p style="margin:0;">${deltaLabel} <span style="font-size:13px;color:#6b7280;">vs prior week</span></p>` : ""}
      ${growthStreakWeeks >= 2 ? `<p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#b45309;">📈 ${growthStreakWeeks} weeks of growth in a row</p>` : ""}
    </div>

    <div style="display:flex;gap:12px;margin:16px 0;">
      <div style="flex:1;background:#f9fafb;border-radius:8px;padding:14px;">
        <p style="margin:0;font-size:13px;color:#6b7280;">New members</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:700;">${newMembers}</p>
      </div>
      <div style="flex:1;background:#f9fafb;border-radius:8px;padding:14px;">
        <p style="margin:0;font-size:13px;color:#6b7280;">Cancellations</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:700;">${cancelledMembers}</p>
      </div>
    </div>

    <h3 style="margin:24px 0 8px;font-size:15px;color:#111827;">Top classes</h3>
    <div>${topClassesHtml}</div>

    ${topInstructorHtml}

    <p style="margin:24px 0 0;">
      <a href="https://app.klasly.app/analytics" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Open full analytics →
      </a>
    </p>

    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">— Hi ${ownerName}, hope you have a great week.</p>
  `;

  return {
    subject: `Your weekly summary — ${studioName}`,
    html: baseHtml(content),
  };
}

// ============================================================
// Instructor monthly recap — earnings, classes, reviews
// ============================================================

type InstructorMonthlyRecapParams = {
  instructorName: string;
  monthLabel: string; // e.g. "April 2026"
  currency: string;
  earningsCents: number;
  earningsDeltaPct: number | null;
  classesTaught: number;
  uniqueStudents: number;
  averageRating: number | null;
  reviewCount: number;
  isPersonalBest: boolean;
};

export function instructorMonthlyRecap(params: InstructorMonthlyRecapParams) {
  const {
    instructorName,
    monthLabel,
    currency,
    earningsCents,
    earningsDeltaPct,
    classesTaught,
    uniqueStudents,
    averageRating,
    reviewCount,
    isPersonalBest,
  } = params;

  const deltaLabel =
    earningsDeltaPct === null
      ? ""
      : earningsDeltaPct >= 0
        ? `<span style="color:#059669;font-size:14px;font-weight:600;">▲ ${earningsDeltaPct.toFixed(0)}% vs last month</span>`
        : `<span style="color:#dc2626;font-size:14px;font-weight:600;">▼ ${Math.abs(earningsDeltaPct).toFixed(0)}% vs last month</span>`;

  const ratingHtml = averageRating !== null
    ? `<div style="background:#f9fafb;border-radius:8px;padding:14px;flex:1;">
        <p style="margin:0;font-size:13px;color:#6b7280;">Average rating</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:700;">${averageRating.toFixed(1)} ★</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${reviewCount} review${reviewCount === 1 ? "" : "s"}</p>
      </div>`
    : "";

  const personalBestBadge = isPersonalBest
    ? `<p style="margin:8px 0 0;font-size:14px;font-weight:600;color:#b45309;">🏆 Personal best month</p>`
    : "";

  const content = `
    <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">${monthLabel} recap</h2>
    <p style="margin:0 0 16px;font-size:15px;">Hi ${instructorName},</p>

    <div style="background:${BG_LIGHT};border-radius:8px;padding:20px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Earnings</p>
      <p style="margin:6px 0 4px;font-size:28px;font-weight:700;color:${BRAND_COLOR};">${formatCurrencyCents(earningsCents, currency)}</p>
      ${deltaLabel ? `<p style="margin:0;">${deltaLabel}</p>` : ""}
      ${personalBestBadge}
    </div>

    <div style="display:flex;gap:12px;margin:16px 0;">
      <div style="background:#f9fafb;border-radius:8px;padding:14px;flex:1;">
        <p style="margin:0;font-size:13px;color:#6b7280;">Classes taught</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:700;">${classesTaught}</p>
      </div>
      <div style="background:#f9fafb;border-radius:8px;padding:14px;flex:1;">
        <p style="margin:0;font-size:13px;color:#6b7280;">Unique students</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:700;">${uniqueStudents}</p>
      </div>
      ${ratingHtml}
    </div>

    <p style="margin:24px 0 0;">
      <a href="https://app.klasly.app/my-earnings" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        See full breakdown →
      </a>
    </p>

    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">Thanks for showing up for your students this month. Onwards.</p>
  `;

  return {
    subject: `${monthLabel} recap — ${formatCurrencyCents(earningsCents, currency)}`,
    html: baseHtml(content),
  };
}

// ============================================================
// Password Reset
// ============================================================

export function passwordReset(params: { resetUrl: string }) {
  const { resetUrl } = params;
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Reset your password</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      We received a request to reset your password. Click the button below to choose a new one:
    </p>
    <p style="margin:0 0 24px;">
      <a href="${resetUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
        Reset Password
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 16px;font-size:13px;color:${BRAND_COLOR};word-break:break-all;">
      ${resetUrl}
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280;">
      This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
  `;
  return {
    subject: "Reset your password — Klasly",
    html: baseHtml(content),
  };
}

// ============================================================
// Generic studio-authored message (T2-2 bulk email)
// ============================================================

export function baseStudioMessage(params: {
  memberName: string;
  studioName: string;
  subject: string;
  body: string;
}) {
  const { memberName, studioName, subject, body } = params;
  // Interpolate {memberName} {studioName} variables and convert paragraphs
  // to <p> blocks. Plain-text only — no HTML in admin-authored body.
  const interpolated = body
    .replaceAll("{memberName}", memberName)
    .replaceAll("{studioName}", studioName);
  const escaped = interpolated
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const paragraphs = escaped
    .split(/\r?\n\r?\n/)
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${p.replaceAll(/\r?\n/g, "<br>")}</p>`
    )
    .join("");
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${subject
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")}</h2>
    ${paragraphs}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">— ${studioName}</p>
  `;
  return {
    subject: subject
      .replaceAll("{memberName}", memberName)
      .replaceAll("{studioName}", studioName),
    html: baseHtml(content),
  };
}

// ============================================================
// Class booking reminder (T1-3) — sent the day before (24h) and an
// hour before. Reuses the bookingConfirmation layout for visual
// consistency but with a different headline and copy.
// ============================================================

export function classBookingReminder(params: {
  memberName: string;
  className: string;
  sessionDate: string;
  startTime: string;
  studioName: string;
  isOnline?: boolean;
  onlineLink?: string | null;
  studioTzAbbrev?: string | null;
  /** "24h" or "1h" — drives the headline only; body content is the same. */
  window: "24h" | "1h";
}) {
  const {
    memberName,
    className,
    sessionDate,
    startTime,
    studioName,
    isOnline,
    onlineLink,
    studioTzAbbrev,
    window,
  } = params;
  const headline =
    window === "24h" ? "See you tomorrow" : "Starting in about an hour";
  const subjectLead =
    window === "24h" ? "Tomorrow's class" : "Starting soon";
  const onlineSection =
    isOnline && onlineLink
      ? `<p style="margin:12px 0 0;">
          <a href="${onlineLink}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Join Online →
          </a>
        </p>`
      : isOnline
        ? `<p style="margin:8px 0 0;font-size:14px;color:#6b7280;">📹 Online class</p>`
        : "";
  const tzSuffix = isOnline && studioTzAbbrev ? ` ${studioTzAbbrev}` : "";
  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${headline}</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Quick reminder about your upcoming class:
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:${BRAND_COLOR};">${isOnline ? "📹 " : ""}${className}</p>
      <p style="margin:8px 0 0;font-size:14px;">${sessionDate} · ${startTime}${tzSuffix}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${studioName}</p>
      ${onlineSection}
    </div>
    <p style="margin:0;font-size:14px;color:#6b7280;">
      Need to cancel? Open Klasly and tap your booking before class.
    </p>
  `;
  return {
    subject: `${subjectLead} — ${className}`,
    html: baseHtml(content),
  };
}

// ============================================================
// Instructor 80% hour-usage alert (T2-3)
// ============================================================

export function instructorTier80Alert(params: {
  instructorName: string;
  studioName: string;
  tierName: string;
  usedMinutes: number;
  includedMinutes: number;
  remainingMinutes: number;
  estimatedOverageCents?: number;
  allowsOverage: boolean;
}) {
  const {
    instructorName,
    studioName,
    tierName,
    usedMinutes,
    includedMinutes,
    remainingMinutes,
    estimatedOverageCents,
    allowsOverage,
  } = params;
  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h === 0) return `${mm} min`;
    if (mm === 0) return `${h}h`;
    return `${h}h ${mm}min`;
  };
  const pct = Math.round((usedMinutes / Math.max(1, includedMinutes)) * 100);
  const overageLine = allowsOverage
    ? estimatedOverageCents !== undefined && estimatedOverageCents > 0
      ? `If you book all your scheduled classes, you'll go over the plan and be billed about <strong>$${(estimatedOverageCents / 100).toFixed(2)}</strong> on the 1st.`
      : `Booking past your remaining ${fmt(remainingMinutes)} will be billed at your plan's overage rate on the 1st.`
    : `Your plan blocks new bookings once you hit ${fmt(includedMinutes)} — make the most of the ${fmt(remainingMinutes)} you have left.`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#b45309;">You've used ${pct}% of your monthly hours</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${instructorName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      Heads-up — at ${studioName}, your <strong>${tierName}</strong> plan
      is at <strong>${fmt(usedMinutes)} / ${fmt(includedMinutes)}</strong>
      this month with <strong>${fmt(remainingMinutes)}</strong> remaining.
    </p>
    <div style="background:${BG_LIGHT};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;">${overageLine}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#6b7280;">
      You can see live usage anytime at <a href="https://app.klasly.app/instructor/membership" style="color:${BRAND_COLOR};">your membership page</a>.
    </p>
  `;
  return {
    subject: `${pct}% of ${tierName} used — ${fmt(remainingMinutes)} left`,
    html: baseHtml(content),
  };
}

// ============================================================
// Pass renewal reminder (T1-5)
// ============================================================

export function passRenewalReminder(params: {
  memberName: string;
  passName: string;
  expiresOn: string; // YYYY-MM-DD
  daysLeft: number;
  studioName: string;
  purchaseUrl: string;
}) {
  const { memberName, passName, expiresOn, daysLeft, studioName, purchaseUrl } = params;
  const headline =
    daysLeft <= 0
      ? "Your pass expires today"
      : daysLeft === 1
        ? "Your pass expires tomorrow"
        : `Your pass expires in ${daysLeft} days`;

  const content = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#b45309;">${headline}</h2>
    <p style="margin:0 0 8px;font-size:15px;">Hi ${memberName},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
      A quick heads-up — your <strong>${passName}</strong> at ${studioName}
      expires on <strong>${expiresOn}</strong>. Renew now to keep your
      bookings without interruption.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${purchaseUrl}" style="display:inline-block;background:${BRAND_COLOR};color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Renew Pass →
      </a>
    </p>
    <p style="margin:0;font-size:13px;color:#6b7280;">
      Thank you for being part of the studio!
    </p>
  `;
  return {
    subject: `${headline} — ${passName}`,
    html: baseHtml(content),
  };
}
