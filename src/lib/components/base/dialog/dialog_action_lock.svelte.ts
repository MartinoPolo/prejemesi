export interface DialogActionLockOptions {
	/** Busy state owned by the caller, such as a mutation it runs itself. */
	pending: () => boolean;
	/** The dialog content element that keeps focus while its buttons are disabled. */
	content: () => HTMLElement | null;
}

/**
 * Locks a dialog while its primary action runs, either caller-owned (`pending`) or the awaited
 * action itself. A rejected action leaves the dialog open, since the caller reports its own errors.
 */
export function createDialogActionLock(options: DialogActionLockOptions) {
	let running = $state(false);
	const busy = $derived(options.pending() || running);
	let buttonFocusedBeforeLock: HTMLButtonElement | null = null;

	// Disabling the focused button would drop focus to the page behind the modal.
	$effect.pre(() => {
		const content = options.content();
		if (!busy || content === null) {
			return;
		}
		const focused = document.activeElement;
		if (focused instanceof HTMLButtonElement && content.contains(focused)) {
			buttonFocusedBeforeLock = focused;
			content.focus();
		}
	});

	$effect(() => {
		if (busy || buttonFocusedBeforeLock === null) {
			return;
		}
		const button = buttonFocusedBeforeLock;
		buttonFocusedBeforeLock = null;
		if (
			document.activeElement === options.content() &&
			button.isConnected &&
			!button.disabled
		) {
			button.focus();
		}
	});

	async function run(action: () => unknown) {
		if (busy) {
			return;
		}
		running = true;
		try {
			await action();
		} catch (thrown) {
			console.error('Dialog action failed:', thrown);
		} finally {
			running = false;
		}
	}

	return {
		get busy() {
			return busy;
		},
		run,
	};
}
