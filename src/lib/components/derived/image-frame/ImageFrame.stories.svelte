<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { ImageFrame } from './index.js';

	const { Story } = defineMeta({
		title: 'Derived/ImageFrame',
		component: ImageFrame,
		tags: ['autodocs'],
	});

	/** Deterministic inline SVG so stories render without network access. */
	function svg(width: number, height: number, fill: string): string {
		const doc = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'><rect width='100%' height='100%' fill='${fill}'/><circle cx='50%' cy='50%' r='${Math.min(width, height) * 0.3}' fill='rgba(255,255,255,0.55)'/></svg>`;
		return `data:image/svg+xml,${encodeURIComponent(doc)}`;
	}

	const NORMAL = svg(400, 300, '#3b5168'); // 4:3
	const TALL = svg(180, 420, '#8a4b3a'); // ~9:21
	const WIDE = svg(640, 180, '#2f6f7a'); // ~32:9
	const TINY = svg(48, 48, '#6b5ba8'); // tiny icon
	const BROKEN = 'https://example.invalid/missing.png';
</script>

<!-- ── Three fit modes on the same source (REQ-1, REQ-2) ── -->
<Story name="Fit – auto">
	{#snippet template()}
		<ImageFrame class="h-40 w-60" src={NORMAL} alt="Sony sluchátka" fitMode="auto" />
	{/snippet}
</Story>

<Story name="Fit – contain-padded">
	{#snippet template()}
		<ImageFrame
			class="h-40 w-60"
			src={NORMAL}
			alt="Sony sluchátka"
			fitMode="contain-padded"
			tokenScope="wishlist"
		/>
	{/snippet}
</Story>

<Story name="Fit – cover-crop">
	{#snippet template()}
		<ImageFrame class="h-40 w-60" src={NORMAL} alt="Sony sluchátka" fitMode="cover-crop" />
	{/snippet}
</Story>

<Story name="Fit modes – side by side">
	{#snippet template()}
		<div class="flex gap-4">
			<div class="flex flex-col gap-1">
				<ImageFrame class="h-36 w-48" src={NORMAL} alt="auto" fitMode="auto" />
				<span class="text-foreground-subtle text-xs">auto</span>
			</div>
			<div class="flex flex-col gap-1">
				<ImageFrame
					class="h-36 w-48"
					src={NORMAL}
					alt="contain-padded"
					fitMode="contain-padded"
					tokenScope="wishlist"
				/>
				<span class="text-foreground-subtle text-xs">contain-padded</span>
			</div>
			<div class="flex flex-col gap-1">
				<ImageFrame class="h-36 w-48" src={NORMAL} alt="cover-crop" fitMode="cover-crop" />
				<span class="text-foreground-subtle text-xs">cover-crop</span>
			</div>
		</div>
	{/snippet}
</Story>

<!-- ── Background-fill priority (REQ-3) ── -->
<Story name="Fill tier 1 – extracted color">
	{#snippet template()}
		<ImageFrame
			class="h-32 w-48"
			src={TALL}
			alt="Plakát"
			fitMode="contain-padded"
			fillColor="oklch(0.58 0.13 25)"
		/>
	{/snippet}
</Story>

<Story name="Fill tier 2 – wishlist token">
	{#snippet template()}
		<ImageFrame
			class="h-32 w-48"
			src={TALL}
			alt="Plakát"
			fitMode="contain-padded"
			tokenScope="wishlist"
		/>
	{/snippet}
</Story>

<Story name="Fill tier 3 – global surface">
	{#snippet template()}
		<ImageFrame
			class="h-32 w-48"
			src={TALL}
			alt="Plakát"
			fitMode="contain-padded"
			tokenScope="global"
		/>
	{/snippet}
</Story>

<!-- ── Extreme aspect ratios contained by auto (REQ-2) ── -->
<Story name="Extreme ratios">
	{#snippet template()}
		<div class="flex gap-4">
			<ImageFrame
				class="h-32 w-32"
				src={TALL}
				alt="Vysoký plakát 9:21"
				tokenScope="wishlist"
			/>
			<ImageFrame class="h-32 w-32" src={WIDE} alt="Panorama 32:9" tokenScope="wishlist" />
			<ImageFrame class="h-32 w-32" src={TINY} alt="Maličká ikona" tokenScope="wishlist" />
			<ImageFrame class="h-32 w-32" src={NORMAL} alt="Normální 4:3" tokenScope="wishlist" />
		</div>
	{/snippet}
</Story>

<!-- ── States: empty / error / interactive ── -->
<Story name="Empty fallback">
	{#snippet template()}
		<ImageFrame
			class="h-40 w-60"
			src={null}
			alt=""
			fallbackEmoji="🎁"
			fallbackLabel="Bez obrázku"
		/>
	{/snippet}
</Story>

<Story name="Loading skeleton">
	{#snippet template()}
		<ImageFrame class="h-40 w-60" alt="Načítání" loading />
	{/snippet}
</Story>

<Story name="Error falls back gracefully">
	{#snippet template()}
		<ImageFrame class="h-40 w-60" src={BROKEN} alt="Rozbitý odkaz" fallbackEmoji="🎂" />
	{/snippet}
</Story>

<Story name="Interactive (focus ring)">
	{#snippet template()}
		<ImageFrame class="h-40 w-60" src={NORMAL} alt="Otevřít editor ořezu" interactive />
	{/snippet}
</Story>

<!-- ── Shapes ── -->
<Story name="Avatar – circle cover-crop">
	{#snippet template()}
		<ImageFrame
			class="size-24"
			src={NORMAL}
			alt="Avatar"
			shape="circle"
			fitMode="cover-crop"
			focal={{ x: 50, y: 35 }}
		/>
	{/snippet}
</Story>

<!-- ── Preset vs custom wishlist palette (REQ-4, REQ-5) ── -->
<Story name="Palette – preset (Birthday)">
	{#snippet template()}
		<div
			class="w-60"
			style:--wishlist-surface="oklch(0.985 0.01 330)"
			style:--wishlist-image-frame="oklch(0.95 0.016 330)"
			style:--wishlist-icon="oklch(0.56 0.16 330)"
		>
			<div class="flex gap-4">
				<ImageFrame
					class="h-32 w-32"
					src={null}
					alt=""
					tokenScope="wishlist"
					fallbackEmoji="🎂"
					fallbackLabel="Narozeniny"
				/>
				<ImageFrame
					class="h-32 w-32"
					src={TALL}
					alt="Plakát"
					fitMode="contain-padded"
					tokenScope="wishlist"
				/>
			</div>
		</div>
	{/snippet}
</Story>

<Story name="Palette – custom (OKLCH hue 275)">
	{#snippet template()}
		<div
			class="w-60"
			style:--wishlist-surface="oklch(0.985 0.008 275)"
			style:--wishlist-image-frame="oklch(0.95 0.014 275)"
			style:--wishlist-icon="oklch(0.55 0.13 275)"
		>
			<div class="flex gap-4">
				<ImageFrame
					class="h-32 w-32"
					src={null}
					alt=""
					tokenScope="wishlist"
					fallbackEmoji="✨"
					fallbackLabel="Vlastní"
				/>
				<ImageFrame
					class="h-32 w-32"
					src={WIDE}
					alt="Panorama"
					fitMode="contain-padded"
					tokenScope="wishlist"
				/>
			</div>
		</div>
	{/snippet}
</Story>
