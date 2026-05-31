<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { resolve } from '$app/paths';
	import { wishlistCardVariants, STATUS_DOT_CLASSES } from './wishlist-card-variants.js';
	import { getThemePreset, type WishlistTheme } from '$lib/modules/wishlists/wishlist-theme.js';
	import { WISHLIST_STATUS_LABELS } from '$lib/modules/wishlists/dashboard-types.js';
	import type { Wishlist } from '$lib/modules/wishlists/types.js';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import CheckIcon from '@lucide/svelte/icons/check';
	import type { Snippet } from 'svelte';

	interface WishlistCardProps {
		wishlist: Wishlist;
		/** Owner name, displayed for moderated/followed cards */
		ownerName?: string;
		/** Reservation progress for moderator cards */
		reservationProgress?: { reserved: number; total: number };
		/** Available gifts count for followed cards */
		availableGifts?: number;
		/** Own reservation count for followed cards */
		myReservations?: number;
		/** Extra content rendered below the meta row */
		extraContent?: Snippet;
		/** Action buttons */
		actions?: Snippet;
		class?: string;
	}

	let {
		wishlist: wishlistData,
		ownerName,
		reservationProgress,
		availableGifts,
		myReservations,
		extraContent,
		actions,
		class: className,
	}: WishlistCardProps = $props();

	const isArchived = $derived(wishlistData.status === 'archived');
	const theme = $derived(getThemePreset(wishlistData.theme as WishlistTheme));
	const variants = $derived(wishlistCardVariants({ archived: isArchived }));
	const statusLabel = $derived(WISHLIST_STATUS_LABELS[wishlistData.status]);
	const statusDotClass = $derived(STATUS_DOT_CLASSES[wishlistData.status]);

	function getOwnerInitials(name: string): string {
		return name
			.split(' ')
			.map((part) => part[0])
			.filter(Boolean)
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function formatDate(date: Date | null): string {
		if (date === null) {
			return '';
		}
		return new Intl.DateTimeFormat('cs-CZ', {
			day: 'numeric',
			month: 'numeric',
			year: 'numeric',
		}).format(new Date(date));
	}
</script>

<a
	href={resolve('/w/[id]', { id: wishlistData.shortId })}
	class={cn(variants.root(), className)}
	aria-label={wishlistData.title}
>
	<!-- Banner -->
	<div class={variants.banner()} style:background={theme.gradient} aria-hidden="true">
		<span class={variants.bannerEmoji()}>{theme.emoji}</span>
		<div class={variants.bannerOverlay()}></div>
		<div class={variants.bannerTitle()}>{wishlistData.title}</div>
		<div class={variants.statusBadge()} aria-label="Stav: {statusLabel}">
			<span class={cn(variants.statusDot(), statusDotClass)}></span>
			{statusLabel}
		</div>
	</div>

	<!-- Body -->
	<div class={variants.body()}>
		{#if ownerName}
			<div class={variants.ownerRow()}>
				<div class={variants.ownerAvatar()}>{getOwnerInitials(ownerName)}</div>
				<span>{ownerName}</span>
				<span class={variants.ownerLabel()}>· vlastník</span>
			</div>
		{/if}

		{#if reservationProgress}
			<div class={variants.progressWrap()}>
				<div class={variants.progressLabelRow()}>
					<span>Průběh rezervací</span>
					<span class={variants.progressValue()}>
						{reservationProgress.reserved} / {reservationProgress.total} rezervováno
					</span>
				</div>
				<div class={variants.progressTrack()}>
					<div
						class={variants.progressFill()}
						style:width="{reservationProgress.total > 0
							? (reservationProgress.reserved / reservationProgress.total) * 100
							: 0}%"
					></div>
				</div>
			</div>
		{/if}

		{#if availableGifts !== undefined}
			<div class={variants.metaRow()}>
				<span class={variants.availableCount()}>
					<GiftIcon class="inline size-3.5 align-middle" />
					Dostupných: {availableGifts} přání
				</span>
				{#if myReservations !== undefined && myReservations > 0}
					<span class={variants.reservationChip()}>
						<CheckIcon class="size-3" />
						Moje rezervace: {myReservations}
					</span>
				{:else if myReservations !== undefined}
					<span class="text-xs text-muted-foreground/60">žádné moje rezervace</span>
				{/if}
			</div>
		{/if}

		<div class={variants.metaRow()}>
			<span class={variants.themeBadge()}>{theme.emoji} {theme.label}</span>
			<span class={variants.metaText()}>
				{#if reservationProgress}
					{reservationProgress.total} přání celkem
				{:else if wishlistData.createdAt}
					Vytvořeno {formatDate(wishlistData.createdAt)}
				{/if}
			</span>
		</div>

		{#if extraContent}
			{@render extraContent()}
		{/if}

		{#if actions}
			<div class={variants.divider()}></div>
			<div class={variants.actions()}>
				{@render actions()}
			</div>
		{/if}
	</div>
</a>
