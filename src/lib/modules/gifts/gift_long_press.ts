const LONG_PRESS_MS = 500;
/** Short enough to feel like a drag, long enough that a swipe over a card still scrolls. */
export const GIFT_REORDER_LONG_PRESS_MS = 300;
const MOVEMENT_TOLERANCE_PX = 8;

let cancelActiveRecognizer: (() => void) | null = null;

/**
 * Fingers currently on the screen anywhere on the page, since a second finger cancels the press
 * even when it lands outside the pressed card.
 */
const activeTouchPointerIds = new Set<number>();
let touchTrackingInstalled = false;

function handleTouchPointerDown(event: PointerEvent) {
	if (event.pointerType !== 'touch') {
		return;
	}
	// A primary pointer starts a new gesture, so ids whose release was never seen are dropped.
	if (event.isPrimary) {
		activeTouchPointerIds.clear();
	}
	activeTouchPointerIds.add(event.pointerId);
	if (activeTouchPointerIds.size > 1) {
		cancelActiveRecognizer?.();
	}
}

function handleTouchPointerRelease(event: PointerEvent) {
	activeTouchPointerIds.delete(event.pointerId);
}

/** Capture-phase listeners see each finger before any card handler can start a press with it. */
function trackTouchPointers() {
	if (touchTrackingInstalled || typeof window === 'undefined') {
		return;
	}
	touchTrackingInstalled = true;
	window.addEventListener('pointerdown', handleTouchPointerDown, { capture: true });
	window.addEventListener('pointerup', handleTouchPointerRelease, { capture: true });
	window.addEventListener('pointercancel', handleTouchPointerRelease, { capture: true });
	// Fingers lifted while the page lost focus never report their release.
	window.addEventListener('blur', () => activeTouchPointerIds.clear());
}

/** Framework-neutral touch recognizer used by gift surfaces. */
export function createGiftLongPressRecognizer(
	onComplete: () => void,
	onPendingChange?: (pending: boolean) => void,
	durationMs = LONG_PRESS_MS,
) {
	let origin: { x: number; y: number } | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pending = false;

	trackTouchPointers();

	function setPending(next: boolean) {
		if (pending !== next) {
			pending = next;
			onPendingChange?.(next);
		}
	}

	function removeScrollListeners() {
		if (typeof document !== 'undefined') {
			document.removeEventListener('scroll', abort, true);
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('scroll', abort, true);
		}
	}

	function abort() {
		if (timer !== null) {
			clearTimeout(timer);
		}
		timer = null;
		origin = null;
		removeScrollListeners();
		if (cancelActiveRecognizer === abort) {
			cancelActiveRecognizer = null;
		}
		setPending(false);
	}

	/** A second finger makes the gesture a multi-touch one, which never long-presses. */
	function start(x: number, y: number) {
		cancelActiveRecognizer?.();
		abort();
		if (activeTouchPointerIds.size > 1) {
			return;
		}
		origin = { x, y };
		cancelActiveRecognizer = abort;
		setPending(true);
		if (typeof document !== 'undefined') {
			document.addEventListener('scroll', abort, { capture: true });
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('scroll', abort, { capture: true });
		}
		timer = setTimeout(complete, durationMs);
	}

	/**
	 * Completes a pending press at once, as when the browser fires its own long-press
	 * `contextmenu` before the timer. Returns whether a press was pending.
	 */
	function complete(): boolean {
		if (!pending) {
			return false;
		}
		abort();
		onComplete();
		return true;
	}

	function move(x: number, y: number) {
		if (origin !== null && Math.hypot(x - origin.x, y - origin.y) > MOVEMENT_TOLERANCE_PX) {
			abort();
		}
	}

	return { start, move, complete, end: abort, cancel: abort, scroll: abort };
}
