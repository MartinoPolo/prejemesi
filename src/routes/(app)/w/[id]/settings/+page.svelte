<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import * as Card from '$lib/components/base/card/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { toastSuccess, toastError } from '$lib/components/base/toast/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { WishlistCropEditor } from '$lib/components/blocks/wishlist/index.js';
	import ThemeSelector from '$lib/components/blocks/theme/ThemeSelector.svelte';
	import {
		getWishlistByShortId,
		updateWishlist,
	} from '$lib/modules/wishlists/wishlists.remote.js';
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

	const shortId = $derived(page.params.id!);

	// svelte-ignore state_referenced_locally
	const initial = await getWishlistByShortId(shortId);
	let wishlist = $state(initial);

	const isOwner = $derived(wishlist.role === 'owner');
	const themeEmoji = $derived(getThemePreset(wishlist.theme as DashboardWishlistTheme).emoji);
	const currentTheme = $derived(toWishlistTheme(wishlist.theme, wishlist.customThemeColor));

	let savingImage = $state(false);

	async function refresh() {
		await getWishlistByShortId(shortId).refresh();
		wishlist = await getWishlistByShortId(shortId);
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
	{:else}
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
