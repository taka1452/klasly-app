"use client";

/**
 * Honeypot hidden field for bot protection.
 * Bots auto-fill all fields; humans never see this.
 * The field name is intentionally misleading ("website") to lure bots.
 */
export default function HoneypotField() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden" }} tabIndex={-1}>
      <label htmlFor="website">Website</label>
      <input
        type="text"
        id="website"
        name="website"
        autoComplete="off"
        tabIndex={-1}
      />
    </div>
  );
}
