<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { TEXT_LINK_SIZES, TextLink } from '$lib/components/base/text-link/index.js';

	const { Story } = defineMeta({
		title: 'Base/TextLink',
		component: TextLink,
		tags: ['autodocs'],
		argTypes: {
			size: {
				control: 'select',
				options: [...TEXT_LINK_SIZES],
			},
			external: { control: 'boolean' },
		},
	});
</script>

<script lang="ts">
	import type { TextLinkProps } from '$lib/components/base/text-link/text_link_variants.js';
</script>

<Story name="All Variants">
	{#snippet template(args: TextLinkProps)}
		<div class="grid grid-cols-[6rem_1fr_1fr] items-center gap-x-6 gap-y-3">
			<div></div>
			<div class="text-xs text-muted-foreground">internal</div>
			<div class="text-xs text-muted-foreground">external</div>
			{#each TEXT_LINK_SIZES as size (size)}
				<div class="text-xs text-muted-foreground">{size}</div>
				<TextLink {...args} {size} href="/my-lists">Moje seznamy</TextLink>
				<TextLink {...args} {size} href="https://www.alza.cz" external>alza.cz</TextLink>
			{/each}
		</div>
	{/snippet}
</Story>

<!-- A long label truncates while the trailing icon stays visible. -->
<Story name="Truncated External">
	{#snippet template(args: TextLinkProps)}
		<div class="w-48">
			<TextLink href="https://www.example.com/a/very/long/path" external {...args}>
				Velmi dlouhý název odkazu na obchod s dárky
			</TextLink>
		</div>
	{/snippet}
</Story>
