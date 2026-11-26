<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import { expect, userEvent, waitFor, within } from 'storybook/test';
	import type { LinkedGiftCopy } from '$lib/modules/gifts/types.js';
	import GiftLinkChip from './GiftLinkChip.svelte';

	type GiftLinkChipArgs = Partial<ComponentProps<typeof GiftLinkChip>>;

	interface PlayContext {
		canvasElement: HTMLElement;
	}

	// One copy per list status, so the popover shows every status badge.
	const LINKED_COPIES: LinkedGiftCopy[] = [
		{
			giftId: 'copy-birthday',
			wishlistId: 'wishlist-birthday',
			wishlistShortId: 'narozeniny',
			wishlistTitle: 'Narozeniny 2027',
			occasion: 'birthday',
			status: 'active',
			editsFrozenFrom: null,
		},
		{
			giftId: 'copy-christmas',
			wishlistId: 'wishlist-christmas',
			wishlistShortId: 'vanoce',
			wishlistTitle: 'Vánoce 2026',
			occasion: 'christmas',
			status: 'draft',
			editsFrozenFrom: null,
		},
		{
			giftId: 'copy-archived',
			wishlistId: 'wishlist-archived',
			wishlistShortId: 'archiv',
			// A long unbroken title proves the row truncates instead of widening the popover.
			wishlistTitle:
				'PřáníčkaprobabičkuadědečkanachalupěkdyžpřijedemenavánoceaodjedemeažpoSilvestru',
			occasion: 'other',
			status: 'archived',
			editsFrozenFrom: null,
		},
	];

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftLinkChip',
		component: GiftLinkChip,
		tags: ['autodocs'],
		args: { linkedCopies: LINKED_COPIES, interactive: true, oneditlinkedcopies: () => {} },
	});

	async function playOpensLinkedLists({ canvasElement }: PlayContext) {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const chip = canvasElement.querySelector<HTMLElement>('[data-slot="gift-link-chip"]')!;
		await user.click(chip);
		await waitFor(() => expect(chip).toHaveAttribute('aria-expanded', 'true'));
		const popover = within(document.body).getByRole('dialog', { name: 'Také na seznamech' });
		await expect(within(popover).getAllByRole('link')).toHaveLength(LINKED_COPIES.length);
	}
</script>

<Story name="All States">
	{#snippet template(args: GiftLinkChipArgs)}
		<div class="flex items-center gap-6">
			{#each [true, false] as interactive (interactive)}
				<div class="grid justify-items-start gap-1">
					<span class="text-xs text-muted-foreground">
						{interactive ? 'interactive' : 'static'}
					</span>
					<GiftLinkChip {...args} linkedCopies={LINKED_COPIES} {interactive} />
				</div>
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Popover [play: opens linked lists]" play={playOpensLinkedLists}>
	{#snippet template(args: GiftLinkChipArgs)}
		<GiftLinkChip linkedCopies={LINKED_COPIES} {...args} />
	{/snippet}
</Story>

<Story name="Without Edit Action" args={{ oneditlinkedcopies: undefined }}>
	{#snippet template(args: GiftLinkChipArgs)}
		<GiftLinkChip linkedCopies={LINKED_COPIES} {...args} />
	{/snippet}
</Story>
