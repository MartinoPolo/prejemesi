<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import { WishlistCropEditor } from '$lib/components/blocks/wishlist/index.js';
	import ThemeSelector from '$lib/components/blocks/theme/ThemeSelector.svelte';
	import {
		getWishlistByShortId,
		updateWishlist,
	} from '$lib/modules/wishlists/wishlists.remote.js';
	import { refreshWishlistDashboards } from '$lib/modules/wishlists/dashboard_refresh.js';
	import {
		getThemePreset,
		type WishlistTheme as DashboardWishlistTheme,
	} from '$lib/modules/wishlists/wishlist_theme.js';
	import {
		isCustomTheme,
		toWishlistTheme,
		type WishlistTheme,
	} from '$lib/modules/themes/types.js';
	import type { WishlistImageSlots } from '$lib/modules/images/index.js';

	/** Format a stored event date as a `yyyy-mm-dd` string for `<input type="date">`. */
	function toDateInputValue(value: Date | string | null): string {
		if (value === null) {
			return '';
		}
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) {
			return '';
		}
		return date.toISOString().slice(0, 10);
	}

	const shortId = $derived(page.params.id!);

	// svelte-ignore state_referenced_locally (intentional one-time seed; the form owns its edit state thereafter)
	const initial = await getWishlistByShortId(shortId);
	let wishlist = $state(initial);

	const isOwner = $derived(wishlist.role === 'owner');
	const isArchived = $derived(wishlist.status === 'archived');
	const isShared = $derived(wishlist.sharedAt !== null);
	const themeEmoji = $derived(getThemePreset(wishlist.theme as DashboardWishlistTheme).emoji);
	const currentTheme = $derived(toWishlistTheme(wishlist.theme, wishlist.customThemeColor));

	let detailsTitle = $state(initial.title);
	let detailsDescription = $state(initial.description ?? '');
	let detailsEventDate = $state(toDateInputValue(initial.eventDate));
	let detailsError = $state('');
	let savingDetails = $state(false);
	let savingImage = $state(false);

	async function refresh() {
		await getWishlistByShortId(shortId).refresh();
		wishlist = await getWishlistByShortId(shortId);
		await refreshWishlistDashboards();
	}

	async function handleDetailsSave(event: SubmitEvent) {
		event.preventDefault();

		const trimmedTitle = detailsTitle.trim();
		if (trimmedTitle === '') {
			detailsError = m.wishlist_name_required();
			return;
		}

		detailsError = '';
		savingDetails = true;
		try {
			const trimmedDescription = detailsDescription.trim();
			await updateWishlist({
				id: wishlist.id,
				title: trimmedTitle,
				description: trimmedDescription === '' ? null : trimmedDescription,
				// Event date is locked once the wishlist is shared (server drops it silently).
				...(isShared
					? {}
					: { eventDate: detailsEventDate === '' ? null : new Date(detailsEventDate) }),
			});
			await refresh();
			// Re-seed the form from the canonical server values (server trims/normalizes).
			detailsTitle = wishlist.title;
			detailsDescription = wishlist.description ?? '';
			detailsEventDate = toDateInputValue(wishlist.eventDate);
			toastSuccess(m.toast_wishlist_details_saved());
		} catch (thrown) {
			console.error('Failed to save wishlist details:', thrown);
			toastError(m.toast_wishlist_details_save_error());
		} finally {
			savingDetails = false;
		}
	}

	async function handleImageSave(next: {
		imageKey: string | null;
		imageSlots: WishlistImageSlots | null;
	}) {
		savingImage = true;
		try {
			await updateWishlist({
				id: wishlist.id,
				imageKey: next.imageKey,
				imageSlots: next.imageSlots,
			});
			await refresh();
			toastSuccess(m.toast_wishlist_image_saved());
		} catch (thrown) {
			console.error('Failed to save wishlist image:', thrown);
			toastError(m.toast_wishlist_image_save_error());
		} finally {
			savingImage = false;
		}
	}

	async function handleThemeSave(theme: WishlistTheme) {
		try {
			const themePreset = isCustomTheme(theme) ? 'custom' : theme;
			const customThemeColor = isCustomTheme(theme) ? theme.color : null;
			await updateWishlist({ id: wishlist.id, theme: themePreset, customThemeColor });
			await refresh();
			toastSuccess(m.toast_theme_saved());
		} catch (thrown) {
			console.error('Failed to save theme:', thrown);
			toastError(m.toast_theme_save_error());
		}
	}

	function goBack() {
		void goto(resolve('/(app)/w/[id]', { id: shortId }));
	}
</script>

<svelte:head>
	<title>{m.wishlist_settings_title()} — Darecky</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
	<div class="flex items-center gap-3">
		<Button
			intent="ghost"
			size="icon-sm"
			aria-label={m.wishlist_settings_back()}
			onclick={goBack}
		>
			<ArrowLeftIcon />
		</Button>
		<div class="flex flex-col">
			<h1 class="font-heading text-2xl font-bold">{m.wishlist_settings_title()}</h1>
			<p class="text-sm text-muted-foreground">{wishlist.title}</p>
		</div>
	</div>

	{#if !isOwner}
		<Alert.Root tone="warning">
			<Alert.Description>{m.wishlist_settings_owner_only()}</Alert.Description>
		</Alert.Root>
	{:else if isArchived}
		<Alert.Root tone="warning">
			<Alert.Description>{m.wishlist_settings_archived_readonly()}</Alert.Description>
		</Alert.Root>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.wishlist_settings_details_section()}</Card.Title>
				<Card.Description>{m.wishlist_settings_details_hint()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<form onsubmit={handleDetailsSave} class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<Label for="wishlist-title">{m.wishlist_name_label()}</Label>
						<Input
							id="wishlist-title"
							bind:value={detailsTitle}
							placeholder={m.wishlist_name_placeholder()}
							required
							disabled={savingDetails}
						/>
					</div>

					<div class="flex flex-col gap-2">
						<Label for="wishlist-description">{m.wishlist_description_label()}</Label>
						<Textarea
							id="wishlist-description"
							bind:value={detailsDescription}
							placeholder={m.wishlist_description_placeholder()}
							disabled={savingDetails}
						/>
					</div>

					<div class="flex flex-col gap-2">
						<Label for="wishlist-event-date">{m.wishlist_event_date_label()}</Label>
						<Input
							id="wishlist-event-date"
							type="date"
							bind:value={detailsEventDate}
							disabled={savingDetails || isShared}
						/>
						{#if isShared}
							<p class="text-sm text-muted-foreground">
								{m.wishlist_event_date_locked_hint()}
							</p>
						{/if}
					</div>

					{#if detailsError !== ''}
						<p class="text-destructive text-sm">{detailsError}</p>
					{/if}

					<div class="flex justify-end">
						<Button type="submit" disabled={savingDetails}>
							{#if savingDetails}
								<LoaderIcon class="animate-spin" data-icon="inline-start" />
							{/if}
							{m.save()}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>{m.wishlist_settings_image_section()}</Card.Title>
				<Card.Description>{m.wishlist_settings_image_hint()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<WishlistCropEditor
					imageKey={wishlist.imageKey}
					imageSlots={wishlist.imageSlots}
					{themeEmoji}
					title={wishlist.title}
					isSaving={savingImage}
					onsave={handleImageSave}
				/>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>{m.wishlist_settings_theme_section()}</Card.Title>
				<Card.Description>{m.wishlist_settings_theme_hint()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<ThemeSelector {currentTheme} onsave={handleThemeSave} oncancel={goBack} />
			</Card.Content>
		</Card.Root>
	{/if}
</div>
