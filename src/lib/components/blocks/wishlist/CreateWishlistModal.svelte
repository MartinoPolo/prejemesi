<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import * as Select from '$lib/components/base/select/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import Loader from '@lucide/svelte/icons/loader';
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
		{ value: 'default', label: 'Vychozi' },
		{ value: 'christmas', label: 'Vanoce' },
		{ value: 'birthday', label: 'Narozeniny' },
		{ value: 'fun', label: 'Zabavne' },
		{ value: 'elegant', label: 'Elegantni' },
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
			errorMessage = 'Nazev je povinny';
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
			errorMessage = error instanceof Error ? error.message : 'Nepodarilo se vytvorit seznam';
			isSubmitting = false;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Novy seznam prani</Dialog.Title>
			<Dialog.Description>Zadejte nazev a volitelne dalsi udaje.</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="flex flex-col gap-4">
			<div class="flex flex-col gap-2">
				<Label for="wishlist-title">Nazev</Label>
				<Input
					id="wishlist-title"
					bind:value={title}
					placeholder="napr. Vanoce 2026"
					required
					disabled={isSubmitting}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label for="wishlist-event-date">Datum udalosti (volitelne)</Label>
				<Input
					id="wishlist-event-date"
					type="date"
					bind:value={eventDate}
					disabled={isSubmitting}
				/>
			</div>

			<div class="flex flex-col gap-2">
				<Label>Tema</Label>
				<Select.Root type="single" bind:value={theme}>
					<Select.Trigger disabled={isSubmitting}>
						{THEME_OPTIONS.find((o) => o.value === theme)?.label ?? 'Vychozi'}
					</Select.Trigger>
					<Select.Content>
						<Select.Group>
							{#each THEME_OPTIONS as option (option.value)}
								<Select.Item value={option.value} label={option.label} />
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
					Zrusit
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}
						<Loader class="animate-spin" data-icon="inline-start" />
						Vytvarim...
					{:else}
						Vytvorit
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
