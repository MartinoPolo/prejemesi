<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
	import { UnsavedChangesDialog } from './index.js';

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
			ondiscard: fn(),
			oncontinue: fn(),
		},
	});

	const playActionsInOrder = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open' }));
		const dialog = await screen.findByRole('dialog', { name: 'Máte neuložené změny' });
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

		await userEvent.click(saveButton);
		await waitFor(() => expect(saveButton).toBeDisabled());
		await expect(saveButton.querySelector('[data-slot="spinner"]')).not.toBeNull();
		await expect(discardButton).toBeDisabled();
		await expect(continueButton).toBeDisabled();
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';

	let open = $state(false);

	function saveForAMoment() {
		return new Promise<void>((resolve) =>
			setTimeout(() => {
				open = false;
				resolve();
			}, 400),
		);
	}
</script>

<Story name="Default" play={playActionsInOrder}>
	{#snippet template(args)}
		<Button onclick={() => (open = true)}>Open</Button>
		<UnsavedChangesDialog
			{...args}
			{open}
			onsave={saveForAMoment}
			ondiscard={() => (open = false)}
			oncontinue={() => (open = false)}
		/>
	{/snippet}
</Story>
