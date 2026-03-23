/**
 * 構造化ログユーティリティ。
 *
 * Vercel / Edge Runtime でも動作する最小限の構造化ログ。
 * JSON 形式で出力し、Vercel の Log Drains や外部ログサービスでの
 * パース・フィルタリングを容易にする。
 *
 * @example
 * import { logger } from "@/lib/logger";
 * logger.error("Payment failed", { studioId, error: err.message });
 * logger.warn("Rate limit approaching", { ip, remaining: 5 });
 * logger.info("Booking created", { bookingId, memberId });
 */

type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function formatLog(
  level: LogLevel,
  message: string,
  payload?: LogPayload
): string {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, payload?: LogPayload): void {
  const formatted = formatLog(level, message, payload);
  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  info: (message: string, payload?: LogPayload) => log("info", message, payload),
  warn: (message: string, payload?: LogPayload) => log("warn", message, payload),
  error: (message: string, payload?: LogPayload) => log("error", message, payload),
};
