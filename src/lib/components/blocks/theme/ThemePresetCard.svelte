<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Button } from '$lib/components/base/button/index.js';
	import type { ThemePresetDefinition, ThemePalette } from '$lib/modules/themes/types.js';
	import { themePresetCardVariants } from './theme_selector_variants.js';

	interface ThemePresetCardProps {
		preset: ThemePresetDefinition;
		selected: boolean;
		onclick: () => void;
	}

	let { preset, selected, onclick }: ThemePresetCardProps = $props();

	const styles = $derived(themePresetCardVariants({ selected }));
	const palette: ThemePalette = $derived(preset.palette);
</script>

<Button intent="ghost" class={styles.root()} {onclick} aria-pressed={selected}>
	<!-- Color swatches showing the palette -->
	<div class={styles.swatchRow()}>
		<div class={styles.swatch()} style:background={palette['--wishlist-primary']}></div>
		<div class={styles.swatch()} style:background={palette['--wishlist-accent']}></div>
		<div class={styles.swatch()} style:background={palette['--wishlist-surface']}></div>
		<div class={styles.swatch()} style:background={palette['--wishlist-muted']}></div>
		<div class={styles.swatch()} style:background={palette['--wishlist-border-strong']}></div>
	</div>

	<!-- Label -->
	<div class={styles.labelRow()}>
		<span class={styles.emoji()}>{preset.emoji}</span>
		<span class={styles.label()}>{preset.label()}</span>
	</div>

	<!-- Selected indicator -->
	{#if selected}
		<div class={styles.checkmark()}>
			<CheckIcon class="size-3" />
		</div>
	{/if}
</Button>
