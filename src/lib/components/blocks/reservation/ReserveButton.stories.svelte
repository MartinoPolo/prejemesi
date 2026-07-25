<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within } from 'storybook/test';
	import type { GiftForVisitor } from '$lib/modules/gifts/types.js';
	import ReserveButton from './ReserveButton.svelte';

	const { Story } = defineMeta({
		title: 'Blocks/Reservation/ReserveButton',
		component: ReserveButton,
		tags: ['autodocs'],
	});

	// ── Fixtures ────────────────────────────────────────────────────────────
	const baseGift: GiftForVisitor = {
		id: 'gift-1',
		wishlistId: 'wishlist-1',
		name: 'Bezdrátová sluchátka',
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
		likeCount: 0,
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

	// `myReservationPurchasedAt` doesn't change ReserveButton's own rendering (that's
	// PurchasedToggle's state) – the cancel button still renders identically.
	const PURCHASED: GiftForVisitor = {
		...RESERVED_BY_ME,
		myReservationPurchasedAt: new Date('2026-01-02T00:00:00Z'),
	};

	// Single unbroken 90-char token (issue #210/#211 fixture) – ReserveButton never
	// prints the gift name in its visible label (only in `aria-label`), so this story
	// verifies the accessible name still builds correctly rather than a visual overflow.
	const HOSTILE_NAME_GIFT: GiftForVisitor = { ...RESERVED_BY_ME, name: 'x'.repeat(90) };

	const LONG_NAME_GIFT: GiftForVisitor = {
		...NOT_RESERVED,
		name: 'Bezdrátová herní myš s RGB podsvícením a vyměnitelnými tlačítky pro praváky i leváky',
	};

	const playAccessibleNameSurvivesHostileName = async ({
		canvasElement,
	}: {
		canvasElement: HTMLElement;
	}) => {
		const canvas = within(canvasElement);
		const button = canvas.getByTestId('reserve-button');
		await expect(button).toHaveAccessibleName(expect.stringContaining('x'.repeat(90)));
	};
</script>

<Story name="Not Reserved">
	{#snippet template()}
		<ReserveButton gift={NOT_RESERVED} size="md" />
	{/snippet}
</Story>

<Story name="Reserved By Me [cancel action]">
	{#snippet template()}
		<ReserveButton gift={RESERVED_BY_ME} size="md" />
	{/snippet}
</Story>

<Story name="Reserved By Someone Else [disabled]">
	{#snippet template()}
		<ReserveButton gift={RESERVED_BY_SOMEONE_ELSE} size="md" />
	{/snippet}
</Story>

<Story name="Purchased [still cancellable]">
	{#snippet template()}
		<ReserveButton gift={PURCHASED} size="md" />
	{/snippet}
</Story>

<Story name="Archived, not reserved [renders nothing]">
	{#snippet template()}
		<div class="text-xs text-muted-foreground">
			(intentionally empty – ReserveButton renders nothing here)
		</div>
		<ReserveButton gift={NOT_RESERVED} isArchived size="md" />
	{/snippet}
</Story>

<Story
	name="Hostile fixture: 90-char unbroken name [play: accessible name]"
	play={playAccessibleNameSurvivesHostileName}
>
	{#snippet template()}
		<ReserveButton gift={HOSTILE_NAME_GIFT} size="md" />
	{/snippet}
</Story>

<Story name="Realistic long Czech name">
	{#snippet template()}
		<ReserveButton gift={LONG_NAME_GIFT} size="md" />
	{/snippet}
</Story>

<Story name="w-full [stacked alongside PurchasedToggle, issue #211]">
	{#snippet template()}
		<div class="flex w-40 flex-col gap-1.5">
			<ReserveButton gift={RESERVED_BY_ME} size="md" class="w-full" />
		</div>
	{/snippet}
</Story>
