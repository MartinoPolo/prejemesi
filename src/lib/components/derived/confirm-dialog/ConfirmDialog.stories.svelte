<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn, screen, userEvent, waitFor, within, type Mock } from 'storybook/test';
	import { CONFIRM_INTENTS, ConfirmDialog } from './index.js';

	function runForAMoment() {
		return new Promise<void>((resolve) => setTimeout(resolve, 400));
	}

	/**
	 * One confirm dialog for every "are you sure?" question. The confirm is the dialog's one solid
	 * button, rightmost: `primary-destructive` (solid red) when it discards or deletes anything,
	 * `primary` when it is safe. The confirm label
	 * names the action and carries no icon; while the action runs it shows a spinner and both
	 * buttons lock.
	 */
	const { Story } = defineMeta({
		title: 'Derived/ConfirmDialog',
		component: ConfirmDialog,
		tags: ['autodocs'],
		args: {
			title: 'Smazat seznam „Narozeniny“?',
			description:
				'Tato akce je nevratná. Seznam, jeho dárky a obrázky budou trvale smazány.',
			confirmLabel: 'Smazat seznam',
			pendingLabel: 'Mažu…',
			confirmIntent: 'primary-destructive',
			onconfirm: fn(runForAMoment),
		},
		argTypes: {
			confirmIntent: { control: 'select', options: [...CONFIRM_INTENTS] },
		},
	});

	const playConfirmRuns = async ({
		args,
		canvasElement,
	}: {
		args: { onconfirm: () => unknown };
		canvasElement: HTMLElement;
	}) => {
		await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open' }));
		const dialog = await screen.findByRole('dialog');
		// The entrance animation starts fully transparent.
		await waitFor(() =>
			expect(
				dialog
					.getAnimations({ subtree: true })
					.every((animation) => animation.playState === 'finished'),
			).toBe(true),
		);
		const dialogScope = within(dialog);
		await expect(dialogScope.getByRole('button', { name: 'Zavřít' })).toBeVisible();
		const confirmButton = dialogScope.getByRole('button', { name: 'Smazat seznam' });
		await expect(confirmButton.querySelector('[data-slot="spinner"]')).toBeNull();

		// The play finishes the action itself, so a slow runner cannot miss the running state.
		let finishAction = () => {};
		(args.onconfirm as Mock<() => Promise<void>>).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finishAction = resolve;
				}),
		);
		await userEvent.click(confirmButton);
		const runningButton = await dialogScope.findByRole('button', { name: 'Mažu…' });
		await expect(runningButton).toBeDisabled();
		await expect(runningButton.querySelector('[data-slot="spinner"]')).not.toBeNull();
		await expect(dialogScope.getByRole('button', { name: 'Zrušit' })).toBeDisabled();

		finishAction();
		await waitFor(() =>
			expect(dialogScope.getByRole('button', { name: 'Smazat seznam' })).toBeEnabled(),
		);
		const cancelButton = dialogScope.getByRole('button', { name: 'Zrušit' });
		const confirmRect = dialogScope
			.getByRole('button', { name: 'Smazat seznam' })
			.getBoundingClientRect();
		const cancelRect = cancelButton.getBoundingClientRect();
		if (window.innerWidth >= 640) {
			await expect(cancelRect.top).toBe(confirmRect.top);
			await expect(cancelRect.right).toBeLessThanOrEqual(confirmRect.left);
		} else {
			await expect(confirmRect.bottom).toBeLessThanOrEqual(cancelRect.top);
		}
		await userEvent.click(cancelButton);
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';

	let irreversibleOpen = $state(false);
	let wideDiscardOpen = $state(false);
	let safeOpen = $state(false);
</script>

<Story name="Irreversible" play={playConfirmRuns}>
	{#snippet template(args)}
		<Button onclick={() => (irreversibleOpen = true)}>Open</Button>
		<ConfirmDialog {...args} bind:open={irreversibleOpen} />
	{/snippet}
</Story>

<Story
	name="Wide Discard"
	args={{
		title: 'Zavřít bez zkopírování?',
		description: 'Token už nezobrazíme. Pokud si ho neuložíte, vytvořte později nový.',
		confirmLabel: 'Přesto zavřít',
		cancelLabel: 'Zpět',
		pendingLabel: undefined,
		confirmIntent: 'primary-destructive',
		size: 'lg',
	}}
>
	{#snippet template(args)}
		<Button onclick={() => (wideDiscardOpen = true)}>Open</Button>
		<ConfirmDialog {...args} bind:open={wideDiscardOpen} />
	{/snippet}
</Story>

<Story
	name="Safe With Body"
	args={{
		title: 'Výběr obsahuje skryté dárky',
		description: 'Akce se týká i 2 dárků, které aktuální filtr skrývá.',
		confirmLabel: 'Pokračovat',
		pendingLabel: undefined,
		confirmIntent: 'primary',
	}}
>
	{#snippet template(args)}
		<Button onclick={() => (safeOpen = true)}>Open</Button>
		<ConfirmDialog {...args} bind:open={safeOpen} onconfirm={() => (safeOpen = false)}>
			<p class="text-sm">Extra body content, such as a field the action needs, goes here.</p>
		</ConfirmDialog>
	{/snippet}
</Story>
