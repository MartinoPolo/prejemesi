<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { BACKGROUND_THEMES } from '$lib/components/base/theme/types.js';
	import { BackgroundThemePreview } from './index.js';

	const { Story } = defineMeta({
		title: 'Base/BackgroundThemePreview',
		component: BackgroundThemePreview,
		tags: ['autodocs'],
		argTypes: {
			theme: {
				control: 'select',
				options: [...BACKGROUND_THEMES],
			},
		},
	});
</script>

<Story name="All Themes">
	<div class="flex w-[640px] gap-4">
		{#each BACKGROUND_THEMES as theme (theme)}
			<div class="flex flex-1 flex-col gap-2">
				<span class="text-sm font-medium">{theme}</span>
				<BackgroundThemePreview {theme} />
			</div>
		{/each}
	</div>
</Story>
