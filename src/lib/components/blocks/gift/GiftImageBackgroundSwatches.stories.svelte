<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import type { ComponentProps } from 'svelte';
	import GiftImageBackgroundSwatches from './GiftImageBackgroundSwatches.svelte';

	type GiftImageBackgroundSwatchesArgs = Partial<
		ComponentProps<typeof GiftImageBackgroundSwatches>
	>;

	const { Story } = defineMeta({
		title: 'Blocks/Gift/GiftImageBackgroundSwatches',
		component: GiftImageBackgroundSwatches,
		args: { label: 'Pozadí obrázku 1', disabled: false, onchange: () => {} },
	});

	// `null` is the default dotted mat; `#123456` is a historical fill no option matches.
	const FILLS = [null, '#ffffff', '#000000', '#123456'] as const;
</script>

<Story name="All Variants">
	{#snippet template(args: GiftImageBackgroundSwatchesArgs)}
		<div class="grid grid-cols-[auto_auto_auto] items-center gap-x-6 gap-y-3">
			<span></span>
			<span class="text-xs text-muted-foreground">Desktop</span>
			<span class="text-xs text-muted-foreground">Phone (compact)</span>
			{#each FILLS as fill (fill)}
				<span class="text-xs text-muted-foreground">{fill ?? 'default'}</span>
				{#each [false, true] as compact (compact)}
					<GiftImageBackgroundSwatches
						{...args}
						value={fill}
						disabled={args.disabled ?? false}
						{compact}
						label="Pozadí obrázku 1"
						onchange={() => {}}
					/>
				{/each}
			{/each}
		</div>
	{/snippet}
</Story>

<Story name="Disabled" args={{ disabled: true }}>
	{#snippet template(args: GiftImageBackgroundSwatchesArgs)}
		<GiftImageBackgroundSwatches
			{...args}
			value={args.value ?? null}
			label="Pozadí obrázku 1"
			disabled={args.disabled ?? true}
			onchange={() => {}}
		/>
	{/snippet}
</Story>
