/**
 * Post-share grace window (issue #83): every transition to read-only is fully reversible for
 * a debounced window after the LAST edit to that thing. Applies to (a) sharing itself – gift
 * name + delete – (b) each appended description segment, and (c) the wishlist event date.
 *
 * The SERVER is the authority (REQ-6): guards evaluate {@link isWithinGraceWindow} against a
 * server `now`. The client countdown derived from {@link graceWindowExpiresAt} is presentational.
 */

/** Length of the post-share grace window: 2 minutes after the last edit. */
export const GRACE_WINDOW_MS = 2 * 60 * 1000;

/** Coerce a timestamp (Date | ISO string | null) to epoch ms, or null when unparseable/absent. */
function toEpochMs(value: Date | string | null | undefined): number | null {
	if (value === null || value === undefined) {
		return null;
	}
	const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isNaN(ms) ? null : ms;
}

/**
 * True when `now` is still inside the 2-minute grace window opened by `lastEdit`.
 * A null/absent `lastEdit` means the thing was never editable → closed (false).
 * The boundary is exclusive: exactly 2 minutes after the last edit is already closed.
 */
export function isWithinGraceWindow(
	lastEdit: Date | string | null | undefined,
	now: Date,
): boolean {
	const lastEditMs = toEpochMs(lastEdit);
	if (lastEditMs === null) {
		return false;
	}
	return now.getTime() - lastEditMs < GRACE_WINDOW_MS;
}

/** The instant the grace window opened by `lastEdit` closes, or null when there is no window. */
export function graceWindowExpiresAt(lastEdit: Date | string | null | undefined): Date | null {
	const lastEditMs = toEpochMs(lastEdit);
	if (lastEditMs === null) {
		return null;
	}
	return new Date(lastEditMs + GRACE_WINDOW_MS);
}

/**
 * Format a remaining duration (ms) as `m:ss` for the countdown display. Negative input clamps
 * to `0:00`. Rounds up so the last partial second still reads `0:01` rather than `0:00`.
 */
export function formatGraceCountdown(remainingMs: number): string {
	const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
