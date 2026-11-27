<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import { GIFT_LINK_GROUP_KIND } from '$lib/modules/gifts/gift_link_group_kind.js';
	import type { GiftForVisitor, SharedGiftMember } from '$lib/modules/gifts/types.js';
	import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
	import GiftSharedBadge from './GiftSharedBadge.svelte';
	import { BASE_STORY_GIFT } from './gift_comparison_fixtures.js';

	type GiftSharedBadgeArgs = Partial<ComponentProps<typeof GiftSharedBadge>>;

	interface PlayContext {
		canvasElement: HTMLElement;
	}

	const ANICKA: SharedGiftMember = {
		recipientDisplayName: 'Anička',
		recipientImage: null,
		giftId: 'gift-anicka',
		wishlistId: 'wishlist-anicka',
		wishlistShortId: 'anicka-vanoce',
		wishlistTitle: 'Aniččiny Vánoce',
	};

	// A visitor sees who else wishes for the gift, never which list it is on.
	const PETR: SharedGiftMember = {
		recipientDisplayName: 'Petr',
		recipientImage: null,
		giftId: null,
		wishlistId: null,
		wishlistShortId: null,
		wishlistTitle: null,
	};

	const EVA: SharedGiftMember = { ...PETR, recipientDisplayName: 'Eva' };

	function sharedGift(sharedWith: SharedGiftMember[], quantity: number): GiftForVisitor {
		return {
			...BASE_STORY_GIFT,
			linkGroupKind: GIFT_LINK_GROUP_KIND.sharedAcrossRecipients,
			sharedWith,
			quantity,
			reservedCount: 1,
		};
	}

	const PAIR = sharedGift([ANICKA], 3);
	const GROUP = sharedGift([ANICKA, PETR, EVA], 1);

	const BADGE_STATES = [
		{
			label: 'Dárce, dva obdarovaní',
			gift: PAIR,
			role: WISHLIST_ROLES.visitor,
			compact: false,
			interactive: true,
		},
		{
			label: 'Správce, skupina',
			gift: GROUP,
			role: WISHLIST_ROLES.moderator,
			compact: false,
			interactive: true,
		},
		{
			label: 'Obdarovaný',
			gift: PAIR,
			role: WISHLIST_ROLES.recipient,
			compact: false,
			interactive: true,
		},
		{
			label: 'Kompaktní (Carousel)',
			gift: GROUP,
			role: WISHLIST_ROLES.visitor,
			compact: true,
			interactive: true,
		},
		{
			label: 'Výběr nebo řazení',
			gift: GROUP,
			role: WISHLIST_ROLES.visitor,
			compact: false,
			interactive: false,
		},
	];

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftSharedBadge',
		component: GiftSharedBadge,
		tags: ['autodocs'],
		args: {
			gift: PAIR,
			role: WISHLIST_ROLES.visitor,
			compact: false,
			interactive: true,
		},
	});

	async function playOpensExplanation({ canvasElement }: PlayContext) {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const badge = canvasElement.querySelector<HTMLElement>('[data-slot="gift-shared-badge"]')!;
		await user.click(badge);
		await waitFor(() => expect(badge).toHaveAttribute('aria-expanded', 'true'));
		const popover = within(document.body).getByRole('dialog', { name: 'Společné přání' });
		await expect(
			within(popover).getByTestId('gift-shared-explanation-quantity'),
		).toHaveTextContent('Počet: 3 ks celkem pro oba dohromady, ne 3 ks pro každého');
	}
</script>

<Story name="All States">
	{#snippet template(args: GiftSharedBadgeArgs)}
		<div class="grid justify-items-start gap-3">
			{#each BADGE_STATES as variant (variant.label)}
				<div class="grid justify-items-start gap-1">
					<span class="text-xs text-muted-foreground">{variant.label}</span>
					<GiftSharedBadge
						{...args}
						gift={variant.gift}
						role={variant.role}
						compact={variant.compact}
						interactive={variant.interactive}
					/>
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Gifter Explanation [play: opens shared quantity]" play={playOpensExplanation}>
	{#snippet template(args: GiftSharedBadgeArgs)}
		<GiftSharedBadge gift={PAIR} role={WISHLIST_ROLES.visitor} {...args} />
	{/snippet}
</Story>
