<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import { createWishlist } from '$lib/modules/wishlists/wishlists.remote.js';

	interface CreateWishlistModalProps {
		open: boolean;
	}

	let { open = $bindable(false) }: CreateWishlistModalProps = $props();

	let title = $state('');
	let eventDate = $state('');
	let theme = $state<string>('default');
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	const THEME_OPTIONS = [
		{ value: 'default', label: () => m.theme_default() },
		{ value: 'christmas', label: () => m.theme_christmas() },
		{ value: 'birthday', label: () => m.theme_birthday() },
		{ value: 'fun', label: () => m.theme_fun() },
		{ value: 'elegant', label: () => m.theme_elegant() },
	] as const;

	function resetForm() {
		title = '';
		eventDate = '';
		theme = 'default';
		errorMessage = '';
		isSubmitting = false;
	}

	function handleOpenChange(nextOpen: boolean) {
		open = nextOpen;
		if (!nextOpen) {
			resetForm();
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		const trimmedTitle = title.trim();
		if (trimmedTitle === '') {
			errorMessage = m.wishlist_name_required();
			return;
		}

		isSubmitting = true;
		errorMessage = '';

		try {
			const created = await createWishlist({
				title: trimmedTitle,
				eventDate: eventDate !== '' ? new Date(eventDate) : null,
				theme: theme as 'default' | 'christmas' | 'birthday' | 'fun' | 'elegant',
			});

			open = false;
			resetForm();
			await goto(resolve('/(app)/w/[id]', { id: created.shortId }));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : m.wishlist_create_error();
			isSubmitting = false;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.wishlist_create_title()}</Dialog.Title>
			<Dialog.Description>{m.wishlist_create_description()}</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="flex flex-col gap-4">
			<div class="flex flex-col gap-2">
				<Label for="wishlist-title">{m.wishlist_name_label()}</Label>
				<Input
					id="wishlist-title"
					bind:value={title}
					placeholder={m.wishlist_name_placeholder()}
					required
					disabled={isSubmitting}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="wishlist-event-date">{m.wishlist_event_date_label()}</Label>
				<Input
					id="wishlist-event-date"
					type="date"
					bind:value={eventDate}
					disabled={isSubmitting}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label>{m.wishlist_theme_label()}</Label>
				<Select.Root type="single" bind:value={theme}>
					<Select.Trigger disabled={isSubmitting}>
						{THEME_OPTIONS.find((o) => o.value === theme)?.label() ?? m.theme_default()}
					</Select.Trigger>
					<Select.Content>
						<Select.Group>
							{#each THEME_OPTIONS as option (option.value)}
								<Select.Item value={option.value} label={option.label()} />
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>

			{#if errorMessage !== ''}
				<p class="text-destructive text-sm">{errorMessage}</p>
			{/if}

			<Dialog.Footer>
				<Button
					type="button"
					intent="outline"
					onclick={() => handleOpenChange(false)}
					disabled={isSubmitting}
				>
					{m.cancel()}
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}
						<LoaderIcon class="animate-spin" data-icon="inline-start" />
						{m.creating()}
					{:else}
						{m.create()}
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
