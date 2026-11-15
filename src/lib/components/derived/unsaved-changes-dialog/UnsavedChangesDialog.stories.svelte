<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, screen, userEvent, waitFor, within, type Mock } from 'storybook/test';
	import { UnsavedChangesDialog } from './index.js';

	function saveForAMoment() {
		return new Promise<void>((resolve) => setTimeout(resolve, 400));
	}

	/**
	 * The one guard for leaving an editor with unsaved changes. Its actions are always, left to
	 * right on desktop: „Pokračovat v úpravách“ (outline), „Zahodit“ (red outline) and „Uložit a
	 * pokračovat“ (primary, with a spinner while saving). Phones stack them with Save on top.
	 * The caller continues the interrupted action only after a successful save.
	 */
	const { Story } = defineMeta({
		title: 'Derived/UnsavedChangesDialog',
		component: UnsavedChangesDialog,
		tags: ['autodocs'],
		args: {
			onsave: fn(saveForAMoment),
			ondiscard: fn(),
			oncontinue: fn(),
		},
	});

	const playActionsInOrder = async ({
		args,
		canvasElement,
	}: {
		args: { onsave: () => unknown };
		canvasElement: HTMLElement;
	}) => {
		await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open' }));
		const dialog = await screen.findByRole('dialog', { name: 'Máte neuložené změny' });
		// The action rows are measured only once the entrance animation has settled.
		await waitFor(() =>
			expect(
				dialog
					.getAnimations({ subtree: true })
					.every((animation) => animation.playState === 'finished'),
			).toBe(true),
		);
		const dialogScope = within(dialog);
		const continueButton = dialogScope.getByRole('button', { name: 'Pokračovat v úpravách' });
		const discardButton = dialogScope.getByRole('button', { name: 'Zahodit' });
		const saveButton = dialogScope.getByRole('button', { name: 'Uložit a pokračovat' });
		const [continueRect, discardRect, saveRect] = [
			continueButton,
			discardButton,
			saveButton,
		].map((button) => button.getBoundingClientRect());
		if (window.innerWidth >= 640) {
			await expect(discardRect.top).toBe(continueRect.top);
			await expect(saveRect.top).toBe(continueRect.top);
			await expect(continueRect.right).toBeLessThanOrEqual(discardRect.left);
			await expect(discardRect.right).toBeLessThanOrEqual(saveRect.left);
		} else {
			await expect(saveRect.bottom).toBeLessThanOrEqual(discardRect.top);
			await expect(discardRect.bottom).toBeLessThanOrEqual(continueRect.top);
		}

		// The play finishes the save itself, so a slow runner cannot miss the saving state.
		let finishSave = () => {};
		(args.onsave as Mock<() => Promise<void>>).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finishSave = resolve;
				}),
		);
		await userEvent.click(saveButton);
		await waitFor(() => expect(saveButton).toBeDisabled());
		await expect(saveButton.querySelector('[data-slot="spinner"]')).not.toBeNull();
		await expect(discardButton).toBeDisabled();
		await expect(continueButton).toBeDisabled();

		finishSave();
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';

	let open = $state(false);
</script>

<Story name="Default" play={playActionsInOrder}>
	{#snippet template(args)}
		<Button onclick={() => (open = true)}>Open</Button>
		<UnsavedChangesDialog
			{...args}
			{open}
			onsave={async () => {
				await args.onsave();
				open = false;
			}}
			ondiscard={() => (open = false)}
			oncontinue={() => (open = false)}
		/>
	{/snippet}
</Story>
