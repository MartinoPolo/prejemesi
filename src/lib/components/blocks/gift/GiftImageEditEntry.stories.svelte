<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import GiftImageEditEntry from './GiftImageEditEntry.svelte';
	import { PAINTED_GIFT_IMAGE_URL } from './gift_comparison_fixtures.js';

	type GiftImageEditEntryArgs = Partial<ComponentProps<typeof GiftImageEditEntry>>;

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftImageEditEntry',
		component: GiftImageEditEntry,
		args: { onclick: () => {} },
	});

	// The card's wide 4:3 photo widens the sticker into the labelled pill on hover or focus;
	// the narrow list thumbnail keeps the icon-only sticker.
	const ENTRY_SIZES = [
		{ name: 'Card (expandable)', boxClass: 'aspect-4/3 w-72', expandable: true },
		{ name: 'List thumbnail', boxClass: 'size-24', expandable: false },
	] as const;
</script>

<Story name="All Variants">
	{#snippet template(args: GiftImageEditEntryArgs)}
		<div class="flex flex-wrap items-start gap-6">
			{#each ENTRY_SIZES as entrySize (entrySize.name)}
				{#each [false, true] as disabled (disabled)}
					<div class="flex flex-col gap-1">
						<span class="text-xs text-muted-foreground">
							{entrySize.name}{disabled ? ' · disabled' : ''}
						</span>
						<div class="relative overflow-hidden rounded-panel {entrySize.boxClass}">
							<img
								src={PAINTED_GIFT_IMAGE_URL}
								alt=""
								class="size-full object-cover"
							/>
							<GiftImageEditEntry
								{...args}
								expandable={entrySize.expandable}
								{disabled}
								onclick={() => {}}
							/>
						</div>
					</div>
				{/each}
			{/each}
		</div>
	{/snippet}
</Story>
