<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
	import * as Dialog from './index.js';

	const { Story } = defineMeta({
		title: 'Base/Dialog',
		component: Dialog.Content,
		tags: ['autodocs'],
		argTypes: {
			size: { control: 'select', options: [...Dialog.DIALOG_CONTENT_SIZES] },
			layout: { control: 'select', options: [...Dialog.DIALOG_CONTENT_LAYOUTS] },
		},
	});

	const playStepBackAndForth = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open' }));
		const dialog = await screen.findByRole('dialog');
		await waitFor(() =>
			expect(within(dialog).getByRole('button', { name: 'Delete gift' })).toBeVisible(),
		);
		await userEvent.click(within(dialog).getByRole('button', { name: 'Adjust framing' }));
		await userEvent.click(await within(dialog).findByRole('button', { name: 'Back' }));
		await expect(within(dialog).getByRole('heading', { name: 'Edit gift' })).toBeVisible();
		await expect(within(dialog).queryByRole('button', { name: 'Back' })).toBeNull();
	};

	const playOpenScrollDialog = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await userEvent.click(within(canvasElement).getByRole('button', { name: 'Open' }));
		const dialog = await screen.findByRole('dialog');
		const body = dialog.querySelector<HTMLElement>('[data-slot="dialog-body"]')!;
		await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
		await waitFor(() =>
			expect(within(dialog).getByRole('button', { name: 'Create' })).toBeVisible(),
		);
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Stepper } from '$lib/components/derived/stepper/index.js';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	let framingStepOpen = $state(false);
</script>

<Story name="Confirm">
	{#snippet template()}
		<Dialog.Root>
			<Dialog.Trigger>
				{#snippet child({ props })}<Button {...props}>Open</Button>{/snippet}
			</Dialog.Trigger>
			<Dialog.Content size="md">
				<Dialog.Header>
					<Dialog.Title>Release the reservation?</Dialog.Title>
					<Dialog.Description>
						Others will be able to reserve this gift again.
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Dialog.Close>
						{#snippet child({ props })}
							<Button intent="outline" {...props}>Keep reservation</Button>
						{/snippet}
					</Dialog.Close>
					<Button intent="danger">Release</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{/snippet}
</Story>

<Story name="Scroll Layout" play={playOpenScrollDialog}>
	{#snippet template()}
		<Dialog.Root>
			<Dialog.Trigger>
				{#snippet child({ props })}<Button {...props}>Open</Button>{/snippet}
			</Dialog.Trigger>
			<Dialog.Content layout="scroll">
				<Dialog.Header>
					<Dialog.Title>New wishlist</Dialog.Title>
					<Dialog.Description>Enter a name and optional details.</Dialog.Description>
				</Dialog.Header>
				<form onsubmit={(event) => event.preventDefault()}>
					<Dialog.Body class="space-y-4">
						{#each { length: 12 }, index (index)}
							<div class="flex flex-col gap-2">
								<Label for="story-field-{index}">Field {index + 1}</Label>
								<Input id="story-field-{index}" />
							</div>
						{/each}
					</Dialog.Body>
					<Dialog.Footer>
						<Dialog.Close>
							{#snippet child({ props })}
								<Button intent="outline" size="lg" {...props}>Cancel</Button>
							{/snippet}
						</Dialog.Close>
						<Button type="submit" size="lg">Create</Button>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	{/snippet}
</Story>

<Story name="Scroll Layout With Divided Header">
	{#snippet template()}
		<Dialog.Root>
			<Dialog.Trigger>
				{#snippet child({ props })}<Button {...props}>Open</Button>{/snippet}
			</Dialog.Trigger>
			<Dialog.Content layout="scroll">
				<Dialog.Header divided>
					<Dialog.Title>New access token</Dialog.Title>
					<Stepper
						stepLabels={['Basics', 'Permissions', 'Token']}
						currentStepIndex={1}
						label="Steps"
					/>
				</Dialog.Header>
				<Dialog.Body class="space-y-3">
					{#each { length: 30 }, index (index)}
						<p>Permission row {index + 1}</p>
					{/each}
				</Dialog.Body>
				<Dialog.Footer>
					<Button intent="outline" size="lg">Back</Button>
					<Button size="lg">Continue</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{/snippet}
</Story>

<Story
	name="Steps With Back And Footer Lead [play: back returns to the first step]"
	play={playStepBackAndForth}
>
	{#snippet template()}
		<Dialog.Root onOpenChange={() => (framingStepOpen = false)}>
			<Dialog.Trigger>
				{#snippet child({ props })}<Button {...props}>Open</Button>{/snippet}
			</Dialog.Trigger>
			<Dialog.Content layout="scroll">
				<Dialog.Header>
					{#if framingStepOpen}
						<Dialog.Back label="Back" onclick={() => (framingStepOpen = false)} />
						<Dialog.Title>Adjust framing</Dialog.Title>
					{:else}
						<Dialog.Title>Edit gift</Dialog.Title>
					{/if}
				</Dialog.Header>
				<Dialog.Body class="space-y-3">
					{#if framingStepOpen}
						<p>Drag the photo to choose what the card shows.</p>
					{:else}
						<p>Name, price and links of the gift.</p>
						<Button intent="outline" onclick={() => (framingStepOpen = true)}>
							Adjust framing
						</Button>
					{/if}
				</Dialog.Body>
				<Dialog.Footer>
					{#snippet lead()}
						{#if framingStepOpen}
							<p class="text-muted-foreground text-xs">
								Changes apply when you save.
							</p>
						{:else}
							<Button intent="danger" size="lg">
								<TrashIcon data-icon="inline-start" />Delete gift
							</Button>
						{/if}
					{/snippet}
					<Dialog.Close>
						{#snippet child({ props })}
							<Button intent="outline" size="lg" {...props}>Cancel</Button>
						{/snippet}
					</Dialog.Close>
					<Button size="lg">Save</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{/snippet}
</Story>
