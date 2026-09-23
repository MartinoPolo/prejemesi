<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import { IMAGE_FIT_MODES } from '$lib/modules/images/index.js';
	import GiftCard from './GiftCard.svelte';

	type GiftCardArgs = Partial<ComponentProps<typeof GiftCard>>;

	const FOCAL_CROP_FIXTURE_IMAGE_URL = `data:image/svg+xml,${encodeURIComponent(
		"<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='#315b7d'/><polygon points='168,86 224,150 168,214 112,150' fill='#ffd166'/></svg>",
	)}`;
	const LETTERBOXED_FIXTURE_IMAGE_URL = `data:image/svg+xml,${encodeURIComponent(
		"<svg xmlns='http://www.w3.org/2000/svg' width='180' height='320'><rect width='180' height='320' fill='#315b7d'/><circle cx='90' cy='160' r='55' fill='#b8d8e8'/></svg>",
	)}`;
	const TRANSPARENT_FIXTURE_IMAGE_URL = `data:image/svg+xml,${encodeURIComponent(
		"<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><circle cx='200' cy='150' r='95' fill='#173a59'/></svg>",
	)}`;

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftCard',
		component: GiftCard,
		tags: ['autodocs'],
		argTypes: {
			role: {
				control: 'select',
				options: Object.values(WISHLIST_ROLES),
			},
		},
	});

	// ── Fixtures ────────────────────────────────────────────────────────────
	const baseGift: GiftForVisitor = {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Bezdrátová sluchátka',
		description: null,
		descriptionAppends: [],
		editedAfterShareAt: null,
		links: [{ url: 'https://www.alza.cz/sluchatka' }],
		price: 1490,
		priceMax: null,
		currency: 'CZK',
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
		likeCount: 2,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
	};

	const NOT_RESERVED: GiftForVisitor = baseGift;

	const RESERVED_BY_ME: GiftForVisitor = {
		...baseGift,
		reservedCount: 1,
		isFullyReserved: true,
		myReservationId: 'reservation-1',
	};

	const RESERVED_BY_SOMEONE_ELSE: GiftForVisitor = {
		...baseGift,
		reservedCount: 1,
		isFullyReserved: true,
	};

	const PURCHASED: GiftForVisitor = {
		...baseGift,
		reservedCount: 1,
		isFullyReserved: true,
		myReservationId: 'reservation-1',
		myReservationPurchasedAt: new Date('2026-01-02T00:00:00Z'),
	};

	const RECEIVED_RESERVED_BY_ME: GiftForVisitor = {
		...RESERVED_BY_ME,
		received: true,
		likeCount: 12,
	};

	const LOADED_IMAGE_GIFT: GiftForVisitor = {
		...baseGift,
		name: 'Geometrický motiv s načteným obrázkem',
		imageUrl: FOCAL_CROP_FIXTURE_IMAGE_URL,
		imageMeta: {
			fitMode: IMAGE_FIT_MODES.coverCrop,
			cropRect: null,
			focal: { x: 42, y: 50 },
			zoom: 1.05,
			bgColor: null,
		},
	};

	const LETTERBOXED_IMAGE_GIFT: GiftForVisitor = {
		...LOADED_IMAGE_GIFT,
		name: 'Portrét s bílou obrazovou podložkou',
		imageUrl: LETTERBOXED_FIXTURE_IMAGE_URL,
		imageMeta: {
			...LOADED_IMAGE_GIFT.imageMeta!,
			fitMode: IMAGE_FIT_MODES.containPadded,
			bgColor: '#ffffff',
		},
	};

	const TRANSPARENT_IMAGE_GIFT: GiftForVisitor = {
		...LOADED_IMAGE_GIFT,
		name: 'Průhledný obrázek s tmavým motivem',
		imageUrl: TRANSPARENT_FIXTURE_IMAGE_URL,
	};

	// Single unbroken 90-char token (issue #210/#211): no space, so the browser has no
	// break opportunity. `name`'s `line-clamp-2` implies `overflow: hidden`, which per the
	// CSS Sizing spec zeroes this grid item's automatic minimum size — so unlike the
	// reserve dialog's `giftName` (fixed by #210) or the footer's button pair (fixed by
	// #211), the card title never needed an explicit `min-w-0`: the run gets visually
	// clipped after two lines instead of dragging the card wider.
	const HOSTILE_NAME_GIFT: GiftForVisitor = {
		...RESERVED_BY_ME,
		name: 'x'.repeat(90),
	};

	// Realistic long multi-word Czech name (issue #211): wraps at word boundaries, so it
	// stresses the reservation-action layout without tripping the hostile-name issue above.
	const LONG_NAME_GIFT: GiftForVisitor = {
		...RESERVED_BY_ME,
		name: 'Bezdrátová herní myš s RGB podsvícením a vyměnitelnými tlačítky pro praváky i leváky',
	};
</script>

<script lang="ts">
	import { setLikesContext } from '$lib/modules/likes/likes.context.svelte.js';
	import { setGiftsContext } from '$lib/modules/gifts/gifts.context.svelte.js';
	import { setReservationsContext } from '$lib/modules/reservations/reservations.context.svelte.js';
	import { RESERVATION_RELEASE_CAPABILITY } from '$lib/modules/wishlists/wishlist_capabilities.js';

	// GiftCard's footer reads `useLikes()`/`useGifts()`/`useReservations()`, which only the
	// real wishlist page provides. Stand in with minimal contexts so every story below can render.
	setLikesContext(
		() => [],
		() => true,
		() => {},
	);
	setGiftsContext(
		() => 'gift-card-story',
		() => [],
		() => WISHLIST_ROLES.visitor,
		() => false,
		() => true,
		() => [],
	);
	// No release reach in isolation: these harnesses exercise the card/row itself, not the
	// administrator override (see ReleaseReservationTestHost.svelte for that flow).
	setReservationsContext(
		() => RESERVATION_RELEASE_CAPABILITY.none,
		() => [],
		async () => false,
	);
</script>

<Story
	name="Loaded Image Seam Regression"
	args={{ gift: LOADED_IMAGE_GIFT, role: WISHLIST_ROLES.visitor }}
>
	{#snippet template(args: GiftCardArgs)}
		<div class="w-72">
			<GiftCard gift={LOADED_IMAGE_GIFT} role={WISHLIST_ROLES.visitor} {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Letterboxed Image"
	args={{ gift: LETTERBOXED_IMAGE_GIFT, role: WISHLIST_ROLES.visitor }}
>
	{#snippet template(args: GiftCardArgs)}
		<div class="w-72">
			<GiftCard gift={LETTERBOXED_IMAGE_GIFT} role={WISHLIST_ROLES.visitor} {...args} />
		</div>
	{/snippet}
</Story>

<Story
	name="Transparent Image"
	args={{ gift: TRANSPARENT_IMAGE_GIFT, role: WISHLIST_ROLES.visitor }}
>
	{#snippet template(args: GiftCardArgs)}
		<div class="w-72">
			<GiftCard gift={TRANSPARENT_IMAGE_GIFT} role={WISHLIST_ROLES.visitor} {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Not Reserved">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={NOT_RESERVED} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Reserved By Me [both actions]">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={RESERVED_BY_ME} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Reserved By Someone Else">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={RESERVED_BY_SOMEONE_ELSE} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Purchased">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={PURCHASED} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Narrow Received + Reserved + Like">
	{#snippet template()}
		<div class="w-36">
			<GiftCard gift={RECEIVED_RESERVED_BY_ME} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Hostile fixture: 90-char unbroken name [contained by line-clamp]">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={HOSTILE_NAME_GIFT} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>

<Story name="Realistic long Czech name">
	{#snippet template()}
		<div class="w-72">
			<GiftCard gift={LONG_NAME_GIFT} role={WISHLIST_ROLES.visitor} />
		</div>
	{/snippet}
</Story>
