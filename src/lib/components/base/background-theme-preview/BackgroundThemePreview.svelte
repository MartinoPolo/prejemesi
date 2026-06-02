<script lang="ts" module>
	import type { BackgroundTheme } from '$lib/components/base/theme/types.js';

	interface PreviewTones {
		background: string;
		surface: string;
	}

	/**
	 * Literal preview colors — intentionally NOT semantic CSS custom properties.
	 * Each tile must always render BOTH the light AND dark appearance of a theme
	 * regardless of the page's current color mode, so the values are locked to
	 * `src/palette-colors.css` + `src/app.css`. Update both together if the
	 * palette changes.
	 */
	const PREVIEW_TONES = {
		default: {
			light: { background: 'oklch(100% 0 0)', surface: 'oklch(96.7% 0.001 286deg)' },
			dark: {
				background: 'oklch(15.3% 0.006 107.1deg)',
				surface: 'oklch(27.4% 0.006 286deg)',
			},
		},
		'golden-hour': {
			light: { background: 'oklch(98.5% 0.006 80deg)', surface: 'oklch(96.5% 0.01 80deg)' },
			dark: { background: 'oklch(15.5% 0.02 60deg)', surface: 'oklch(22.5% 0.024 60deg)' },
		},
		twilight: {
			light: { background: 'oklch(98.5% 0.006 210deg)', surface: 'oklch(96.5% 0.01 210deg)' },
			dark: { background: 'oklch(15.5% 0.02 225deg)', surface: 'oklch(22.5% 0.024 225deg)' },
		},
	} as const satisfies Record<BackgroundTheme, { light: PreviewTones; dark: PreviewTones }>;
</script>

<script lang="ts">
	interface BackgroundThemePreviewProps {
		theme?: BackgroundTheme;
	}

	let { theme = 'default' }: BackgroundThemePreviewProps = $props();

	const tones = $derived(PREVIEW_TONES[theme] ?? PREVIEW_TONES.default);
</script>

<!-- Decorative: the accessible name is carried by the option label, not this tile. -->
<div class="preview" aria-hidden="true">
	<div
		class="pv pv-light"
		style:--pv-bg={tones.light.background}
		style:--pv-surface={tones.light.surface}
	>
		<div class="pv-surface">
			<div class="pv-line pv-line-wide"></div>
			<div class="pv-line pv-line-narrow"></div>
			<div class="pv-chip"></div>
		</div>
	</div>
	<div
		class="pv pv-dark"
		style:--pv-bg={tones.dark.background}
		style:--pv-surface={tones.dark.surface}
	>
		<div class="pv-surface">
			<div class="pv-line pv-line-wide"></div>
			<div class="pv-line pv-line-narrow"></div>
			<div class="pv-chip"></div>
		</div>
	</div>
</div>

<style>
	.preview {
		display: grid;
		grid-template-columns: 1fr 1fr;
		overflow: hidden;
		border: 1px solid oklch(85% 0.004 107deg);
		border-radius: var(--radius-md);
	}

	.pv {
		height: 72px;
		padding: 10px;
		background: var(--pv-bg);
	}

	.pv-surface {
		height: 100%;
		padding: 8px;
		border-radius: 6px;
		background: var(--pv-surface);
	}

	.pv-line {
		height: 6px;
		margin-bottom: 5px;
		border-radius: 3px;
	}

	.pv-line-wide {
		width: 70%;
	}

	.pv-line-narrow {
		width: 45%;
	}

	.pv-chip {
		width: 26px;
		height: 10px;
		margin-top: 8px;
		border-radius: 3px;
	}

	/* Shared light-half line/chip tones (constant across themes). */
	.pv-light .pv-line {
		background: oklch(82% 0.01 107deg);
	}

	.pv-light .pv-chip {
		background: oklch(52.7% 0.154 150deg);
	}

	/* Shared dark-half line/chip tones (constant across themes). */
	.pv-dark .pv-line {
		background: oklch(45% 0.01 107deg);
	}

	.pv-dark .pv-chip {
		background: oklch(57% 0.155 151deg);
	}
</style>
