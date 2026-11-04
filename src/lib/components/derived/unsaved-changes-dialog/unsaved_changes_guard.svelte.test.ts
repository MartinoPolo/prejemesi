import { describe, expect, it, vi } from 'vitest';
import { createUnsavedChangesGuard } from './unsaved_changes_guard.svelte.js';

function guardWith(options: { dirty?: boolean; save?: () => Promise<boolean> } = {}) {
	const discard = vi.fn();
	const continueEditing = vi.fn();
	const save = vi.fn(options.save ?? (async () => true));
	const guard = createUnsavedChangesGuard({
		isDirty: () => options.dirty ?? true,
		save,
		discard,
		continueEditing,
	});
	return { guard, save, discard, continueEditing };
}

describe('createUnsavedChangesGuard', () => {
	it('runs the action at once when nothing is unsaved', () => {
		const { guard } = guardWith({ dirty: false });
		const action = vi.fn();
		guard.request(action);
		expect(action).toHaveBeenCalledOnce();
		expect(guard.dialogProps.open).toBe(false);
	});

	it('holds the action behind the prompt while edits are unsaved', () => {
		const { guard } = guardWith();
		const action = vi.fn();
		guard.request(action);
		expect(action).not.toHaveBeenCalled();
		expect(guard.dialogProps.open).toBe(true);
	});

	it('continues the action after a successful save', async () => {
		const { guard, save } = guardWith();
		const action = vi.fn();
		guard.request(action);
		await guard.dialogProps.onsave();
		expect(save).toHaveBeenCalledOnce();
		expect(action).toHaveBeenCalledOnce();
		expect(guard.dialogProps.open).toBe(false);
	});

	it('keeps the editor open when the save fails', async () => {
		const { guard } = guardWith({ save: async () => false });
		const action = vi.fn();
		guard.request(action);
		await guard.dialogProps.onsave();
		expect(action).not.toHaveBeenCalled();
		expect(guard.dialogProps.open).toBe(false);
	});

	it('keeps the editor open without rejecting when the save throws', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { guard } = guardWith({
			save: async () => {
				throw new Error('network down');
			},
		});
		const action = vi.fn();
		guard.request(action);
		await expect(guard.dialogProps.onsave()).resolves.toBeUndefined();
		expect(action).not.toHaveBeenCalled();
		expect(guard.dialogProps.open).toBe(false);
		consoleError.mockRestore();
	});

	it('discards the edits and continues the action', () => {
		const { guard, discard } = guardWith();
		const action = vi.fn();
		guard.request(action);
		guard.dialogProps.ondiscard();
		expect(discard).toHaveBeenCalledOnce();
		expect(action).toHaveBeenCalledOnce();
		expect(guard.dialogProps.open).toBe(false);
	});

	it('drops the action when the user keeps editing', () => {
		const { guard, continueEditing } = guardWith();
		const action = vi.fn();
		guard.request(action);
		guard.dialogProps.oncontinue();
		expect(continueEditing).toHaveBeenCalledOnce();
		expect(action).not.toHaveBeenCalled();
		expect(guard.dialogProps.open).toBe(false);
	});
});
