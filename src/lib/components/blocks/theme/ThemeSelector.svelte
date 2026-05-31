<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import type { ThemePresetName, WishlistTheme } from '$lib/modules/themes/types.js';
	import { isCustomTheme, THEME_PRESET_NAMES } from '$lib/modules/themes/types.js';
	import { THEME_PRESETS, THEME_PRESET_LIST } from '$lib/modules/themes/theme_presets.js';
	import { hexToOklch, deriveOklchPalette } from '$lib/modules/themes/oklch_palette.js';
	import ThemePresetCard from './ThemePresetCard.svelte';
	import { themeSelectorVariants } from './theme_selector_variants.js';

	interface ThemeSelectorProps {
		currentTheme: WishlistTheme;
		onsave: (theme: WishlistTheme) => void;
		oncancel: () => void;
		onpreview?: (theme: WishlistTheme) => void;
	}

	let { currentTheme, onsave, oncancel, onpreview }: ThemeSelectorProps = $props();

	const styles = themeSelectorVariants();

	// Internal editing state — initialized from currentTheme, then user-managed
	let selectedPreset = $state<ThemePresetName | 'custom'>('default');
	let customColorHex = $state('#6366f1');
	let customOklch = $state<string | null>(null);

	// Reset internal state when currentTheme changes (e.g., on re-open)
	$effect.pre(() => {
		const theme = currentTheme;
		selectedPreset = isCustomTheme(theme) ? 'custom' : theme;
		customOklch = isCustomTheme(theme) ? theme.color : null;
	});

	const selectedTheme = $derived.by((): WishlistTheme => {
		if (selectedPreset === 'custom' && customOklch !== null) {
			return { color: customOklch };
		}
		if (selectedPreset in THEME_PRESET_NAMES) {
			return selectedPreset as ThemePresetName;
		}
		return 'default';
	});

	const customPaletteValid = $derived.by(() => {
		if (customOklch === null) {
			return false;
		}
		return deriveOklchPalette(customOklch) !== null;
	});

	const canSave = $derived(
		selectedPreset !== 'custom' || (customOklch !== null && customPaletteValid),
	);

	function handlePresetSelect(presetName: ThemePresetName) {
		selectedPreset = presetName;
		onpreview?.(presetName);
	}

	function handleCustomSelect() {
		selectedPreset = 'custom';
		if (customOklch !== null) {
			onpreview?.({ color: customOklch });
		}
	}

	function handleColorInput(event: Event) {
		const input = event.target as HTMLInputElement;
		customColorHex = input.value;
		const oklch = hexToOklch(input.value);
		if (oklch !== null) {
			customOklch = oklch;
			if (selectedPreset === 'custom') {
				onpreview?.({ color: oklch });
			}
		}
	}

	function handleSave() {
		onsave(selectedTheme);
	}
</script>

<div class={styles.root()}>
	<p class={styles.title()}>Motiv seznamu</p>

	<!-- Preset grid -->
	<div class={styles.presetGrid()}>
		{#each THEME_PRESET_LIST as presetName (presetName)}
			<ThemePresetCard
				preset={THEME_PRESETS[presetName]}
				selected={selectedPreset === presetName}
				onclick={() => handlePresetSelect(presetName)}
			/>
		{/each}
	</div>

	<!-- Custom color section -->
	<div class={styles.customSection()}>
		<button
			type="button"
			class="flex items-center gap-2 text-left"
			onclick={handleCustomSelect}
		>
			<span class="text-base">✨</span>
			<span class={styles.customLabel()}>Vlastni barva</span>
			{#if selectedPreset === 'custom'}
				<span class="ml-auto text-xs font-medium text-primary">Vybrano</span>
			{/if}
		</button>

		{#if selectedPreset === 'custom'}
			<div class={styles.customInputRow()}>
				<input
					type="color"
					class={styles.colorInput()}
					value={customColorHex}
					oninput={handleColorInput}
					aria-label="Vybrat vlastni barvu"
				/>
				<span class={styles.colorPreview()}>
					{customOklch ?? 'Vyberte barvu'}
				</span>
			</div>

			{#if customOklch !== null && customPaletteValid}
				{@const palette = deriveOklchPalette(customOklch)}
				{#if palette !== null}
					<div class="flex h-8 overflow-hidden rounded-lg">
						<div class="flex-1" style:background={palette['--wishlist-primary']}></div>
						<div class="flex-1" style:background={palette['--wishlist-accent']}></div>
						<div class="flex-1" style:background={palette['--wishlist-surface']}></div>
						<div class="flex-1" style:background={palette['--wishlist-muted']}></div>
						<div
							class="flex-1"
							style:background={palette['--wishlist-border-strong']}
						></div>
					</div>
				{/if}
			{/if}
		{/if}
	</div>

	<!-- Footer actions -->
	<div class={styles.footer()}>
		<Button intent="outline" size="sm" onclick={oncancel}>Zrusit</Button>
		<Button size="sm" disabled={!canSave} onclick={handleSave}>Ulozit motiv</Button>
	</div>
</div>
