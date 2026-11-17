<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent, within } from 'storybook/test';
	import type { ComponentProps } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { ensureGiftLinkIds } from '$lib/modules/gifts/gift_url.js';
	import { MAX_GIFT_LINKS, type GiftLink } from '$lib/modules/gifts/types.js';
	import StoryKeyboardHints from '$lib/storybook/StoryKeyboardHints.svelte';
	import KeyboardHint from '$lib/storybook/KeyboardHint.svelte';
	import GiftLinkEditor from './GiftLinkEditor.svelte';

	type GiftLinkEditorArgs = Partial<ComponentProps<typeof GiftLinkEditor>>;

	interface PlayContext {
		canvasElement: HTMLElement;
	}

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftLinkEditor',
		component: GiftLinkEditor,
		tags: ['autodocs'],
		args: { disabled: false },
	});

	// Behaviour lives in gift_link_editor.svelte.test.ts; the one play is a smoke check.

	// ── Fixtures ────────────────────────────────────────────────────────────
	// The approved mockup's links: a custom label inside the address, a derived domain label,
	// and a custom label the address does not contain (shown as a chip).
	const MOCKUP_LINKS: GiftLink[] = [
		{ url: 'https://www.hudy.cz/osprey-talon-22-stealth-black-m-l', label: 'Hudy' },
		{ url: 'https://www.heureka.cz/?h[fraze]=osprey+talon+22' },
		{ url: 'https://www.eshop-novak.cz/batohy/osprey-talon-22', label: 'Obchod u Nováků' },
	];

	// A long custom label beside a long address proves both truncate on one line.
	const CHIP_LINKS: GiftLink[] = [
		{
			url: 'https://www.eshop-novak.cz/batohy/turisticke/osprey-talon-22-stealth-black-m-l',
			label: 'Obchod u Nováků v Českých Budějovicích',
		},
		{ url: 'https://www.alza.cz/sport/osprey-talon-22', label: 'Alza' },
	];

	// Ten distinct shops fill the gift link limit, so the paste field is disabled.
	const FULL_LINKS: GiftLink[] = Array.from({ length: MAX_GIFT_LINKS }, (_, index) => ({
		url: `https://www.obchod-${index + 1}.cz/batohy/osprey-talon-22`,
	}));

	const playExpandRow = async ({ canvasElement }: PlayContext) => {
		const canvas = within(canvasElement);
		const thirdRow = canvas.getByRole('button', { name: /eshop-novak\.cz/ });
		await userEvent.click(thirdRow);
		await expect(thirdRow).toHaveAttribute('aria-expanded', 'true');
		await expect(canvas.getByLabelText(m.gift_link_address())).toBeInTheDocument();
		await expect(canvas.getByLabelText(m.gift_link_visible_label())).toHaveValue(
			'Obchod u Nováků',
		);
		await expect(
			canvas.getByRole('button', { name: m.gift_link_remove() }),
		).toBeInTheDocument();
	};
</script>

<script lang="ts">
	let defaultLinks = $state(ensureGiftLinkIds(MOCKUP_LINKS));
	let chipLinks = $state(ensureGiftLinkIds(CHIP_LINKS));
	let expandedLinks = $state(ensureGiftLinkIds(MOCKUP_LINKS));
	let reorderLinks = $state(ensureGiftLinkIds(MOCKUP_LINKS));
	let fullLinks = $state(ensureGiftLinkIds(FULL_LINKS));
	let mobileLinks = $state(ensureGiftLinkIds(MOCKUP_LINKS));
	let emptyLinks = $state<GiftLink[]>([]);
</script>

<Story name="Default">
	{#snippet template(args: GiftLinkEditorArgs)}
		<div class="w-full max-w-[44rem]">
			<GiftLinkEditor
				{...args}
				links={defaultLinks}
				onlinkschange={(links) => (defaultLinks = links)}
			/>
		</div>
	{/snippet}
</Story>

<Story name="Custom Label Chip">
	{#snippet template(args: GiftLinkEditorArgs)}
		<div class="w-full max-w-[44rem]">
			<GiftLinkEditor
				{...args}
				links={chipLinks}
				onlinkschange={(links) => (chipLinks = links)}
			/>
		</div>
	{/snippet}
</Story>

<Story name="Expanded Row [play: row click expands fields]" play={playExpandRow}>
	{#snippet template(args: GiftLinkEditorArgs)}
		<div class="w-full max-w-[44rem]">
			<GiftLinkEditor
				{...args}
				links={expandedLinks}
				onlinkschange={(links) => (expandedLinks = links)}
			/>
		</div>
	{/snippet}
</Story>

<Story name="Keyboard Reorder">
	{#snippet template(args: GiftLinkEditorArgs)}
		<div class="w-full max-w-[44rem]">
			<StoryKeyboardHints>
				<KeyboardHint keys="↑ / ↓" action="Move the focused link (on its grip)" />
				<KeyboardHint keys="Enter / Space" action="Expand or collapse a link" />
				<KeyboardHint keys="Escape" action="Collapse the expanded link" />
				<KeyboardHint keys="Enter" action="Add the link typed in the paste field" />
			</StoryKeyboardHints>
			<GiftLinkEditor
				{...args}
				links={reorderLinks}
				onlinkschange={(links) => (reorderLinks = links)}
			/>
		</div>
	{/snippet}
</Story>

<Story name="At Limit">
	{#snippet template(args: GiftLinkEditorArgs)}
		<div class="w-full max-w-[44rem]">
			<GiftLinkEditor
				{...args}
				links={fullLinks}
				onlinkschange={(links) => (fullLinks = links)}
			/>
		</div>
	{/snippet}
</Story>

<!-- A new gift: only the paste field. -->
<Story name="Empty">
	{#snippet template(args: GiftLinkEditorArgs)}
		<div class="w-full max-w-[44rem]">
			<GiftLinkEditor
				{...args}
				links={emptyLinks}
				onlinkschange={(links) => (emptyLinks = links)}
			/>
		</div>
	{/snippet}
</Story>

<!-- Phones: 40 px rows and the expanded fields stacked. -->
<Story name="Mobile" parameters={{ viewport: { defaultViewport: 'mobile1' } }}>
	{#snippet template(args: GiftLinkEditorArgs)}
		<div class="w-full max-w-[22rem]">
			<GiftLinkEditor
				{...args}
				links={mobileLinks}
				onlinkschange={(links) => (mobileLinks = links)}
			/>
		</div>
	{/snippet}
</Story>
