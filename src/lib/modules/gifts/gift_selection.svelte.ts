import { SvelteSet } from 'svelte/reactivity';

type SelectionState = 'none' | 'some' | 'all';

interface GiftSelectionSnapshot {
	selectedIds: string[];
	hiddenIds: string[];
	visibleState: SelectionState;
}

interface EscapeSelectionState {
	selectionActive: boolean;
	contextOpen: boolean;
	hiddenConfirmOpen: boolean;
}

export function shouldExitGiftSelectionOnEscape(
	event: Pick<KeyboardEvent, 'key' | 'defaultPrevented'>,
	state: EscapeSelectionState,
): boolean {
	return (
		event.key === 'Escape' &&
		!event.defaultPrevented &&
		state.selectionActive &&
		!state.contextOpen &&
		!state.hiddenConfirmOpen
	);
}

/** ID-based selection state that deliberately outlives presentation changes. */
export function createGiftSelection(initialExistingIds: Iterable<string> = []) {
	const selected = new SvelteSet<string>();
	let existing = new SvelteSet(initialExistingIds);
	let active = $state(false);

	function selectedIds() {
		return [...selected];
	}

	function isSelected(id: string) {
		return selected.has(id);
	}

	function enter(triggeringGiftId: string) {
		active = true;
		selected.add(triggeringGiftId);
	}

	function exit() {
		active = false;
		selected.clear();
	}

	function toggle(id: string) {
		if (selected.has(id)) {
			selected.delete(id);
		} else {
			selected.add(id);
		}
	}

	function setVisible(visibleIds: Iterable<string>, checked: boolean) {
		for (const id of visibleIds) {
			if (checked) {
				selected.add(id);
			} else {
				selected.delete(id);
			}
		}
	}

	function reconcileExisting(ids: Iterable<string>) {
		existing = new SvelteSet(ids);
		// Preserve the reactive SvelteSet instance. Replacing it leaves existing derived readers
		// subscribed to the old set, so entering selection can render an active toolbar with count 0.
		for (const id of selected) {
			if (!existing.has(id)) {
				selected.delete(id);
			}
		}
	}

	function snapshot(visibleIds: Iterable<string>): GiftSelectionSnapshot {
		const visible = new SvelteSet(visibleIds);
		const visibleSelected = [...visible].filter((id) => selected.has(id)).length;
		return {
			selectedIds: selectedIds(),
			hiddenIds: [...selected].filter((id) => !visible.has(id)),
			visibleState:
				visibleSelected === 0
					? 'none'
					: visibleSelected === visible.size && visible.size > 0
						? 'all'
						: 'some',
		};
	}

	return {
		get active() {
			return active;
		},
		selectedIds,
		isSelected,
		enter,
		exit,
		toggle,
		setVisible,
		reconcileExisting,
		snapshot,
	};
}
