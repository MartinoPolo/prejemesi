const LONG_PRESS_MS = 600;
const MOVEMENT_TOLERANCE_PX = 8;

let cancelActiveRecognizer: (() => void) | null = null;

/** Framework-neutral touch recognizer used by gift surfaces. */
export function createGiftLongPressRecognizer(
	onOpen: () => void,
	onPendingChange?: (pending: boolean) => void,
) {
	let origin: { x: number; y: number } | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pending = false;

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

	function start(x: number, y: number) {
		cancelActiveRecognizer?.();
		abort();
		origin = { x, y };
		cancelActiveRecognizer = abort;
		setPending(true);
		if (typeof document !== 'undefined') {
			document.addEventListener('scroll', abort, { capture: true });
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('scroll', abort, { capture: true });
		}
		timer = setTimeout(() => {
			timer = null;
			origin = null;
			removeScrollListeners();
			if (cancelActiveRecognizer === abort) {
				cancelActiveRecognizer = null;
			}
			setPending(false);
			onOpen();
		}, LONG_PRESS_MS);
	}

	function move(x: number, y: number) {
		if (origin !== null && Math.hypot(x - origin.x, y - origin.y) > MOVEMENT_TOLERANCE_PX) {
			abort();
		}
	}

	return { start, move, end: abort, cancel: abort, scroll: abort };
}
