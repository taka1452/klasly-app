/**
 * Walkthrough-video URLs shown inside `<EmptyState />` cards on key list
 * pages (~30–60 second tutorials). Any iframe-embeddable URL works:
 *   - Mux:     https://stream.mux.com/<PLAYBACK_ID>
 *   - Bunny:   https://iframe.mediadelivery.net/embed/<LIB>/<VIDEO_ID>
 *   - YouTube: https://www.youtube.com/embed/<VIDEO_ID>
 *
 * Leave a key as `null` until the video is recorded — `EmptyState` simply
 * skips the player when no URL is set. Adding a video later is a one-line
 * change here, no per-page edits required.
 */
export const EMPTY_STATE_VIDEOS = {
  members: null,
  classes: null,
  passes: null,
  events: null,
  bookings: null,
  calendar: null,
  instructors: null,
} as const satisfies Record<string, string | null>;

export type EmptyStateVideoKey = keyof typeof EMPTY_STATE_VIDEOS;

export function getEmptyStateVideo(key: EmptyStateVideoKey): string | undefined {
  return EMPTY_STATE_VIDEOS[key] ?? undefined;
}
