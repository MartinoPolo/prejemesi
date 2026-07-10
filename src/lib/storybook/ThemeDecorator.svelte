<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		DEFAULT_PALETTE,
		PALETTE_LABELS,
		PALETTE_SWATCHES,
		PALETTES,
		type Palette,
	} from '$lib/theme/palettes.js';
	import * as Tooltip from '$lib/components/base/tooltip/index.js';

	const THEME_MODES = ['light', 'dark', 'system'] as const;
	type ThemeMode = (typeof THEME_MODES)[number];

	let { children }: { children: Snippet } = $props();

	let themeMode = $state<ThemeMode>('light');
	let palette = $state<Palette>(DEFAULT_PALETTE);

	const isDark = $derived(
		themeMode === 'dark' ||
			(themeMode === 'system' &&
				typeof window !== 'undefined' &&
				window.matchMedia('(prefers-color-scheme: dark)').matches),
	);

	$effect(() => {
		const rootElement = document.documentElement;
		const previousColorScheme = rootElement.style.colorScheme;
		const hadDarkClass = rootElement.classList.contains('dark');
		const hadLightClass = rootElement.classList.contains('light');

		rootElement.classList.toggle('dark', isDark);
		rootElement.classList.toggle('light', !isDark);
		rootElement.style.colorScheme = isDark ? 'dark' : 'light';

		return () => {
			rootElement.classList.toggle('dark', hadDarkClass);
			rootElement.classList.toggle('light', hadLightClass);
			rootElement.style.colorScheme = previousColorScheme;
		};
	});
</script>

<!-- data-palette on the preview wrapper re-derives all tokens for the subtree -->
<div data-palette={palette} class="min-h-screen bg-background text-foreground">
	<div class="flex flex-col gap-4 p-4">
		<div class="flex flex-wrap items-center gap-4 border-b border-border pb-3">
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-muted-foreground">Theme:</span>
				{#each THEME_MODES as mode (mode)}
					<button
						class="rounded px-2 py-1 text-xs capitalize {themeMode === mode
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground'}"
						onclick={() => (themeMode = mode)}
					>
						{mode}
					</button>
				{/each}
			</div>
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-muted-foreground">Paleta:</span>
				{#each PALETTES as paletteOption (paletteOption)}
					<button
						type="button"
						class="size-5 rounded-full border-2 {palette === paletteOption
							? 'border-ink ring-2 ring-ring ring-offset-1'
							: 'border-ink/40'}"
						style="background: {PALETTE_SWATCHES[paletteOption]}"
						title={PALETTE_LABELS[paletteOption]}
						aria-label={PALETTE_LABELS[paletteOption]}
						onclick={() => (palette = paletteOption)}
					></button>
				{/each}
			</div>
		</div>
		<Tooltip.Provider delayDuration={600}>
			<div class="rounded-lg p-6">
				{@render children()}
			</div>
		</Tooltip.Provider>
	</div>
</div>
