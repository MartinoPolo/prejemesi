export interface UnsavedChangesGuardOptions {
	/** Whether the editor holds edits that a guarded action would lose. */
	isDirty: () => boolean;
	/** Saves the edits and resolves `true` only when everything was saved. */
	save: () => Promise<boolean>;
	/** Throws the edits away. */
	discard: () => void;
	/** Runs when the user returns to the editor instead of continuing. */
	continueEditing?: () => void;
}

/**
 * Holds an action behind the unsaved-changes prompt. The action continues after a discard or a
 * successful save; a failed or throwing save closes the prompt and keeps the editor open.
 */
export function createUnsavedChangesGuard(options: UnsavedChangesGuardOptions) {
	let open = $state(false);
	let pendingAction: (() => void) | null = null;

	function close() {
		open = false;
		pendingAction = null;
	}

	function request(action: () => void) {
		if (!options.isDirty()) {
			action();
			return;
		}
		pendingAction = action;
		open = true;
	}

	function continueEditing() {
		close();
		options.continueEditing?.();
	}

	function discardAndContinue() {
		const action = pendingAction;
		close();
		options.discard();
		action?.();
	}

	async function saveAndContinue() {
		const action = pendingAction;
		let saved = false;
		try {
			saved = await options.save();
		} catch (thrown) {
			console.error('Failed to save from the unsaved-changes prompt:', thrown);
		}
		close();
		if (saved) {
			action?.();
		}
	}

	return {
		request,
		/** Drops a held action without running it, e.g. when the editor switches to another item. */
		cancel: close,
		/** Spread onto UnsavedChangesDialog. */
		get dialogProps() {
			return {
				open,
				onsave: saveAndContinue,
				ondiscard: discardAndContinue,
				oncontinue: continueEditing,
			};
		},
	};
}
