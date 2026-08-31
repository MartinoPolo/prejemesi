import { describe, expect, it } from 'vitest';
import { createGiftSelection, shouldExitGiftSelectionOnEscape } from './gift_selection.svelte.js';

describe('gift selection', () => {
	it('derives unchecked, indeterminate, and checked state for a visible domain', () => {
		const selection = createGiftSelection(['a', 'b', 'c']);
		selection.enter('a');
		expect(selection.snapshot(['b', 'c']).visibleState).toBe('none');
		selection.setVisible(['b', 'c'], true);
		expect(selection.snapshot(['a', 'b', 'c']).visibleState).toBe('all');
		selection.toggle('b');
		expect(selection.snapshot(['a', 'b', 'c']).visibleState).toBe('some');
	});

	it('group selection only changes that visible group and retains hidden IDs across view changes', () => {
		const selection = createGiftSelection(['hidden', 'a', 'b', 'c']);
		selection.enter('hidden');
		selection.setVisible(['a', 'b'], true);
		selection.setVisible(['a', 'b'], false);
		expect(selection.selectedIds()).toEqual(['hidden']);
		expect(selection.active).toBe(true);
	});

	it('keeps selection mode active when the last selected gift is toggled off until exit clears it', () => {
		const selection = createGiftSelection(['a']);
		selection.enter('a');

		selection.toggle('a');

		expect(selection.selectedIds()).toEqual([]);
		expect(selection.active).toBe(true);

		selection.exit();

		expect(selection.selectedIds()).toEqual([]);
		expect(selection.active).toBe(false);
	});

	it('keeps hidden gift IDs selected and prunes only IDs that no longer exist', () => {
		const selection = createGiftSelection(['a', 'b', 'c']);
		selection.enter('a');
		selection.toggle('c');

		expect(selection.snapshot(['b', 'c'])).toMatchObject({
			selectedIds: ['a', 'c'],
			hiddenIds: ['a'],
			visibleState: 'some',
		});

		selection.reconcileExisting(['b', 'c']);
		expect(selection.selectedIds()).toEqual(['c']);
		expect(selection.active).toBe(true);
	});

	it('exposes constant-time reactive membership without removing ordered snapshots', () => {
		const selection = createGiftSelection(['a', 'b']);
		selection.enter('a');

		expect(selection.isSelected('a')).toBe(true);
		expect(selection.isSelected('b')).toBe(false);
		expect(selection.selectedIds()).toEqual(['a']);

		selection.toggle('b');
		expect(selection.isSelected('b')).toBe(true);
	});
});

describe('selection Escape handling', () => {
	it('leaves selection active when an overlay already prevented Escape', () => {
		expect(
			shouldExitGiftSelectionOnEscape(
				{ key: 'Escape', defaultPrevented: true },
				{ selectionActive: true, contextOpen: false, hiddenConfirmOpen: false },
			),
		).toBe(false);
	});
});
