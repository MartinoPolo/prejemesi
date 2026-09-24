<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import { GIFT_SECTION_KINDS, type GiftSection } from '$lib/modules/gifts/gift_ordering.js';
	import { GIFT_VIEW_MODES, type GiftForVisitor } from '$lib/modules/gifts/types.js';
	import { IMAGE_FIT_MODES } from '$lib/modules/images/index.js';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import WishlistGiftDisplayTestHost from './WishlistGiftDisplayTestHost.svelte';

	type DisplayArgs = Partial<ComponentProps<typeof WishlistGiftDisplayTestHost>>;

	const transparentImage = `data:image/svg+xml,${encodeURIComponent(
		"<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><circle cx='200' cy='150' r='104' fill='#275c73'/><circle cx='200' cy='150' r='72' fill='#b7d8cf'/><circle cx='200' cy='150' r='40' fill='#275c73'/></svg>",
	)}`;
	const baseGift: GiftForVisitor = {
		id: 'fixture-gift',
		wishlistId: 'fixture-wishlist',
		name: 'Dárek',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [],
		price: null,
		priceMax: null,
		currency: null,
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		quantity: 1,
		sortOrder: 0,
		received: false,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		priorityLevelId: null,
		priorityLabel: null,
		prioritySortOrder: null,
		categoryId: null,
		category: null,
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
	};

	const gifts: GiftForVisitor[] = [
		{
			...baseGift,
			id: 'headphones',
			name: 'Bezdrátová sluchátka s potlačením hluku',
			description: 'Na cestování vlakem i každodenní poslech.',
			imageUrl: '/demo/v1/headphones.jpg',
			links: [{ url: 'https://example.com/sluchatka', label: 'Obchod se sluchátky' }],
			price: 2490,
			currency: 'CZK',
			categoryId: 'electronics',
			category: {
				id: 'electronics',
				presetKey: null,
				customLabel: 'Elektronika',
				color: '#0369A1',
				sortOrder: 0,
			},
			priorityLevelId: 'high',
			priorityLabel: 'Vysoka',
			prioritySortOrder: 0,
			likeCount: 3,
		},
		{
			...baseGift,
			id: 'teapot',
			name: 'Keramická konvice na čaj',
			imageUrl: '/demo/v1/teapot.jpg',
			imageMeta: {
				fitMode: IMAGE_FIT_MODES.containPadded,
				bgColor: '#ffffff',
			},
			price: 890,
			currency: 'CZK',
		},
		{
			...baseGift,
			id: 'transparent',
			name: 'Ručně malovaná keramická mísa',
			imageUrl: transparentImage,
			priorityLevelId: 'medium',
			priorityLabel: 'Stredni',
			prioritySortOrder: 1,
		},
		{
			...baseGift,
			id: 'placeholder',
			name: 'Poukaz na společný výlet',
			description: 'Místo nechte na překvapení.',
			quantity: 2,
		},
		{
			...baseGift,
			id: 'reserved',
			name: 'Batoh na víkendové výlety',
			imageUrl: '/demo/v1/backpack.jpg',
			categoryId: 'travel',
			category: {
				id: 'travel',
				presetKey: null,
				customLabel: 'Cestování',
				color: '#0369A1',
				sortOrder: 1,
			},
			priorityLevelId: 'high',
			priorityLabel: 'Vysoka',
			prioritySortOrder: 0,
			reservedCount: 1,
			isFullyReserved: true,
			reserverNames: ['Jana Nováková'],
		},
		{
			...baseGift,
			id: 'purchased',
			name: 'Sada akvarelových barev a štětců',
			imageUrl: '/demo/v1/watercolours.jpg',
			reservedCount: 1,
			isFullyReserved: true,
			myReservationId: 'my-reservation',
			myReservationPurchasedAt: new Date('2026-01-02T00:00:00Z'),
		},
		{
			...baseGift,
			id: 'received',
			name: 'Pokojová rostlina v květináči',
			imageUrl: '/demo/v1/plant-book.jpg',
			received: true,
		},
	];

	const sections: GiftSection[] = [
		{
			kind: GIFT_SECTION_KINDS.ownReservation,
			key: 'own-reservation',
			label: 'Vaše rezervace',
			gifts: [gifts[5]!],
		},
		{
			kind: GIFT_SECTION_KINDS.available,
			key: 'available',
			label: null,
			gifts: gifts.slice(0, 5),
		},
		{
			kind: GIFT_SECTION_KINDS.received,
			key: 'received',
			label: 'Darované',
			gifts: [gifts[6]!],
		},
	];

	const displayProps: ComponentProps<typeof WishlistGiftDisplayTestHost> = {
		sections,
		role: WISHLIST_ROLES.moderator,
		isArchived: false,
		hideReservationState: false,
		viewMode: GIFT_VIEW_MODES.card,
		isEmpty: false,
		isFilteredEmpty: false,
		reorderMode: false,
		onedit: () => {},
		onreserve: () => {},
		onunreserve: () => {},
		onreceived: () => {},
		onaddgift: () => {},
		onclearfilters: () => {},
		onreorderpreview: () => {},
		onreordercommit: () => {},
		onreordercancel: () => {},
		hascontextactions: () => true,
		oncontextactions: () => true,
	};

	const { Story } = defineMeta({
		title: 'Blocks/Wishlist/WishlistGiftDisplay',
		component: WishlistGiftDisplayTestHost,
		tags: ['autodocs'],
		args: displayProps,
	});
</script>

<Story name="Grid">
	{#snippet template(args: DisplayArgs)}
		<div class="mx-auto w-full max-w-[1200px] px-3 py-4 sm:px-4">
			<WishlistGiftDisplayTestHost
				{...displayProps}
				{...args}
				viewMode={GIFT_VIEW_MODES.card}
			/>
		</div>
	{/snippet}
</Story>

<Story name="List">
	{#snippet template(args: DisplayArgs)}
		<div class="mx-auto w-full max-w-[1200px] px-3 py-4 sm:px-4">
			<WishlistGiftDisplayTestHost
				{...displayProps}
				{...args}
				viewMode={GIFT_VIEW_MODES.list}
			/>
		</div>
	{/snippet}
</Story>
