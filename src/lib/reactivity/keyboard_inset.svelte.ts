/**
 * Browser toolbars collapsing or hiding change either viewport by less than this, so they never
 * count as an on-screen keyboard.
 */
const KEYBOARD_OPEN_MIN_INSET_PX = 120;

const NON_TEXT_INPUT_TYPES = new Set([
	'button',
	'checkbox',
	'color',
	'file',
	'hidden',
	'image',
	'radio',
	'range',
	'reset',
	'submit',
]);

function isTextEditable(element: Element | null): element is HTMLElement {
	if (element instanceof HTMLTextAreaElement) {
		return !element.readOnly;
	}
	if (element instanceof HTMLInputElement) {
		return !element.readOnly && !NON_TEXT_INPUT_TYPES.has(element.type);
	}
	return element instanceof HTMLElement && element.isContentEditable;
}

function scrollAncestors(element: HTMLElement): HTMLElement[] {
	const ancestors: HTMLElement[] = [];
	for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
		if (
			parent.scrollHeight > parent.clientHeight &&
			/auto|scroll/.test(getComputedStyle(parent).overflowY)
		) {
			ancestors.push(parent);
		}
	}
	return ancestors;
}

/**
 * The on-screen keyboard, measured from the viewports because keyboard heights differ across
 * devices and change while open. iOS Safari shrinks only the visual viewport. Android browsers
 * follow the viewport meta's `interactive-widget=resizes-content` and shrink the layout viewport
 * itself, the only model in which Brave reports the true visible height
 * (brave/brave-browser#60074). The keyboard is the layout viewport's shrink plus the visual
 * inset. While it is open the root carries `data-keyboard="open"` with `--keyboard-inset` (the
 * visual inset above the layout viewport's bottom, zero when the layout viewport shrinks),
 * `--visual-viewport-top` and `--visual-viewport-height`, so bottom-anchored surfaces sit on the
 * keyboard.
 */
class KeyboardInset {
	open = $state(false);
	/** The visible height above the keyboard, in CSS pixels. */
	visibleHeight = $state(0);
	#savedScroll: [HTMLElement, number][] = [];
	#focused: HTMLElement | null = null;
	#frame = 0;
	/** The layout viewport's height at the last measure without a focused field or keyboard. */
	#keyboardFreeLayoutHeight = 0;
	#layoutWidth = 0;

	start(): () => void {
		const viewport = window.visualViewport;
		if (!viewport) {
			return () => {};
		}
		const schedule = () => {
			cancelAnimationFrame(this.#frame);
			this.#frame = requestAnimationFrame(() => this.#measure(viewport));
		};
		viewport.addEventListener('resize', schedule);
		viewport.addEventListener('scroll', schedule);
		window.addEventListener('resize', schedule);
		document.addEventListener('focusin', schedule);
		document.addEventListener('focusout', schedule);
		schedule();
		return () => {
			cancelAnimationFrame(this.#frame);
			viewport.removeEventListener('resize', schedule);
			viewport.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
			document.removeEventListener('focusin', schedule);
			document.removeEventListener('focusout', schedule);
			this.#close();
		};
	}

	#measure(viewport: VisualViewport) {
		const focused = document.activeElement;
		// Without a focused field no keyboard is open, so toolbar and window resizes track; a
		// rotation changes the width and the keyboard-free height together.
		if (!isTextEditable(focused) || window.innerWidth !== this.#layoutWidth) {
			this.#layoutWidth = window.innerWidth;
			this.#keyboardFreeLayoutHeight = window.innerHeight;
		}
		// A desktop window resized while a field is focused shrinks the layout viewport too.
		const layoutShrink = window.matchMedia('(pointer: coarse)').matches
			? Math.max(0, this.#keyboardFreeLayoutHeight - window.innerHeight)
			: 0;
		const inset = window.innerHeight - viewport.height - viewport.offsetTop;
		// A pinch zoom shrinks the visual viewport too; leave zoomed layouts to the browser.
		const unzoomed = Math.abs(viewport.scale - 1) < 0.01;
		if (
			!unzoomed ||
			!isTextEditable(focused) ||
			layoutShrink + inset <= KEYBOARD_OPEN_MIN_INSET_PX
		) {
			this.#close();
			return;
		}
		const opening = !this.open;
		if (opening) {
			this.#savedScroll = scrollAncestors(focused).map((element) => [
				element,
				element.scrollTop,
			]);
		}
		const resized = Math.abs(viewport.height - this.visibleHeight) >= 1;
		const refocused = focused !== this.#focused;
		this.#focused = focused;
		this.#open(viewport, inset);
		// Only on a change, so typing never fights the user's own scrolling.
		if (opening || resized || refocused) {
			// The form's submit first, then the field, so both end up above the keyboard when they fit.
			const submit = focused.closest('form')?.querySelector('[type="submit"]');
			requestAnimationFrame(() => {
				submit?.scrollIntoView({ block: 'nearest' });
				focused.scrollIntoView({ block: 'nearest' });
			});
		}
	}

	#open(viewport: VisualViewport, inset: number) {
		const root = document.documentElement;
		this.open = true;
		this.visibleHeight = viewport.height;
		root.dataset.keyboard = 'open';
		root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
		root.style.setProperty('--visual-viewport-top', `${Math.round(viewport.offsetTop)}px`);
		root.style.setProperty('--visual-viewport-height', `${Math.round(viewport.height)}px`);
	}

	#close() {
		if (!this.open) {
			return;
		}
		const root = document.documentElement;
		this.open = false;
		this.#focused = null;
		delete root.dataset.keyboard;
		root.style.removeProperty('--keyboard-inset');
		root.style.removeProperty('--visual-viewport-top');
		root.style.removeProperty('--visual-viewport-height');
		// Compact chrome returns on close, so the scroll positions from before typing return too.
		const saved = this.#savedScroll;
		this.#savedScroll = [];
		requestAnimationFrame(() => {
			for (const [element, scrollTop] of saved) {
				element.scrollTop = scrollTop;
			}
		});
	}
}

export const keyboardInset = new KeyboardInset();

/**
 * Keeps the focused field, and so the on-screen keyboard, when a control is tapped while typing.
 */
export function keepFocusOnPress(event: PointerEvent) {
	event.preventDefault();
}
