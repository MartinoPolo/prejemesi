<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { WishlistHeroFrame } from '$lib/theme/wishlist_themes.js';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		frame: WishlistHeroFrame;
		/** The compact hero below 640 px or the full panel from 640 px; CSS shows one of them. */
		layout: 'mobile' | 'desktop';
		children: Snippet;
	}

	let { frame, layout, class: className, children, ...restProps }: Props = $props();
</script>

<!--
Hero frame paper (#600): Blok notebook, Dárek wrapped present, Visačka kraft tag or Pozvánka
envelope. Decorations are aria-hidden and painted beneath the content; they take the wishlist
palette, corners, border and, through `--m-*`, the motif colours when its backdrop is shown.
-->
<div
	{...restProps}
	class={['hero-frame', className]}
	data-hero-frame={frame}
	data-hero-layout={layout}
>
	<div class="hero-frame-paper" aria-hidden="true">
		{#if frame === 'gift'}
			<div class="gift-band"></div>
			<div class="gift-ribbon"></div>
		{:else if frame === 'invitation'}
			<svg class="invitation-flap" viewBox="0 0 100 10" preserveAspectRatio="none">
				<path d="M0 0 L50 10 L100 0 Z" />
			</svg>
		{/if}
	</div>
	{#if frame === 'gift' && layout === 'desktop'}
		<svg class="gift-bow" viewBox="0 0 48 30" aria-hidden="true">
			<path d="M24 17 C15 3 2 4 5 15 C8 25 19 22 24 17 Z" />
			<path d="M24 17 C33 3 46 4 43 15 C40 25 29 22 24 17 Z" />
			<circle cx="24" cy="17" r="5" />
		</svg>
	{:else if frame === 'tag'}
		{#if layout === 'desktop'}
			<svg class="tag-string" viewBox="0 0 60 70" aria-hidden="true">
				<path d="M2 68 C14 40 40 46 58 2" />
			</svg>
		{/if}
		<span class="tag-hole" aria-hidden="true"></span>
	{/if}
	{@render children()}
</div>

<style>
	.hero-frame {
		--hero-face-start: var(--space-8);
		--hero-face-end: var(--space-8);
		--hero-actions-end: var(--space-4);
		--hero-actions-top: var(--space-4);

		/* Distance from the panel's end edge to the start of the occasion emblem's lane. */
		--hero-emblem-reserve: 0px;

		/* Lane every frame keeps clear at the end of the copy, actions or not (the Dárek ribbon). */
		--hero-copy-end-minimum: 0px;
		--hero-mobile-border: max(1px, calc(var(--border-w) - 0.5px));
		--hero-mobile-start-extra: 0px;
		--hero-mobile-top-extra: 0px;
		--hero-mobile-end-extra: 0px;

		position: relative;
		isolation: isolate;
		background-color: var(--card);
		border: var(--border-w) solid var(--ink);
		border-radius: max(0px, calc(var(--radius-panel) - 2px));
		box-shadow: var(--elevation-ordinary-strong);
	}

	.hero-frame[data-hero-layout='mobile'] {
		display: none;
		overflow: hidden;
		border-width: var(--hero-mobile-border);
		box-shadow: var(--elevation-ordinary);
	}

	@media (width < 640px) {
		.hero-frame[data-hero-layout='desktop'] {
			display: none;
		}

		.hero-frame[data-hero-layout='mobile'] {
			display: block;
		}
	}

	/* Painted beneath the content (negative z inside the isolated frame), clipped to the paper. */
	.hero-frame-paper {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		border-radius: inherit;
		pointer-events: none;
	}

	/* ── Blok: punch holes, red margin line and ruled lines ── */
	.hero-frame[data-hero-frame='notebook'] {
		--hero-face-start: 116px;
		--hero-emblem-reserve: calc(8rem + 132px);
		--hero-mobile-start-extra: 34px;

		background-image:
			radial-gradient(
				circle at 34px 26px,
				var(--hole-inner) 0 5.5px,
				var(--hole-ring) 5.5px 8px,
				transparent 8.5px
			),
			linear-gradient(
				to right,
				transparent 0 84px,
				var(--margin-red) 84px 86.5px,
				transparent 86.5px
			),
			repeating-linear-gradient(transparent 0 33px, var(--rule-line) 33px 35px);
		background-size:
			100% 52px,
			100% 100%,
			100% 100%;
		background-repeat: repeat-y, no-repeat, no-repeat;
	}

	.hero-frame[data-hero-frame='notebook'][data-hero-layout='mobile'] {
		background-image:
			radial-gradient(
				circle at 17px 18px,
				var(--hole-inner) 0 4px,
				var(--hole-ring) 4px 6px,
				transparent 6.5px
			),
			linear-gradient(
				to right,
				transparent 0 32px,
				var(--margin-red) 32px 34px,
				transparent 34px
			),
			repeating-linear-gradient(transparent 0 25px, var(--rule-line) 25px 27px);
		background-size:
			100% 28px,
			100% 100%,
			100% 100%;
	}

	/* ── Dárek: striped band, vertical ribbon and bow in the motif's colours ── */
	.hero-frame[data-hero-frame='gift'] {
		--hero-gift-stripe: var(--m-a, var(--primary));
		--hero-gift-ribbon: var(--m-c, var(--brand));
		--hero-band: 18px;
		--hero-ribbon-end: 108px;
		--hero-ribbon-width: 22px;
		--hero-actions-top: calc(var(--hero-band) + var(--space-3));
		--hero-emblem-reserve: calc(var(--hero-ribbon-end) + var(--hero-ribbon-width) / 2 + 156px);
		--hero-copy-end-minimum: calc(
			var(--hero-ribbon-end) + var(--hero-ribbon-width) + var(--space-4) -
				var(--hero-face-end)
		);
	}

	.hero-frame[data-hero-frame='gift'][data-hero-layout='mobile'] {
		--hero-band: 10px;
		--hero-ribbon-end: 16px;
		--hero-ribbon-width: 12px;
		--hero-mobile-top-extra: var(--hero-band);
		--hero-mobile-end-extra: 28px;
	}

	.gift-band {
		position: absolute;
		inset-inline: 0;
		top: 0;
		height: var(--hero-band);
		background: repeating-linear-gradient(
			-45deg,
			var(--hero-gift-stripe) 0 9px,
			var(--card) 9px 18px
		);
		border-bottom: var(--border-w) solid var(--ink);
	}

	.gift-ribbon {
		position: absolute;
		inset-block: 0;
		right: var(--hero-ribbon-end);
		width: var(--hero-ribbon-width);
		background: var(--hero-gift-ribbon);
		border-inline: var(--border-w) solid var(--ink);
	}

	.gift-bow {
		position: absolute;
		top: -16px;
		right: calc(var(--hero-ribbon-end) + var(--hero-ribbon-width) / 2 - 24px);
		z-index: 1;
		width: 48px;
		height: 30px;
		overflow: visible;
		fill: var(--hero-gift-ribbon);
		stroke: var(--ink);
		stroke-width: var(--border-w);
		stroke-linejoin: round;
	}

	/* ── Visačka: kraft tag with a rounded end, punched hole and string ── */
	.hero-frame[data-hero-frame='tag'] {
		--hero-tag-end-radius: max(40px, calc(var(--radius-panel) * 4));
		--hero-face-end: 56px;
		--hero-actions-end: 56px;
		--hero-emblem-reserve: calc(56px + 6.5rem + 132px);
		--hero-mobile-end-extra: 16px;

		background-color: var(--kraft);
		border-start-end-radius: var(--hero-tag-end-radius);
		border-end-end-radius: var(--hero-tag-end-radius);
	}

	.tag-hole {
		position: absolute;
		top: 50%;
		right: 22px;
		width: 16px;
		height: 16px;
		background: var(--background);
		border: var(--border-w) solid var(--ink);
		border-radius: 50%;
		translate: 0 -50%;
	}

	[data-hero-layout='mobile'] .tag-hole {
		right: 8px;
		width: 11px;
		height: 11px;
		border-width: var(--hero-mobile-border);
	}

	/* Starts in the hole's centre and leaves the panel past its top end corner. */
	.tag-string {
		position: absolute;
		right: -30px;
		bottom: 50%;
		width: 60px;
		height: 70px;
		overflow: visible;
		fill: none;
		stroke: color-mix(in oklab, var(--kraft) 35%, var(--ink));
		stroke-width: 2;
		stroke-linecap: round;
	}

	/* ── Pozvánka: envelope flap across the top, no inset outline ── */
	.hero-frame[data-hero-frame='invitation'] {
		--hero-flap: 30px;
		--hero-emblem-reserve: calc(8rem + 168px);
	}

	.hero-frame[data-hero-frame='invitation'][data-hero-layout='mobile'] {
		--hero-flap: 18px;
		--hero-mobile-top-extra: 14px;
	}

	.invitation-flap {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: var(--hero-flap);
		overflow: visible;
		fill: var(--secondary);
		stroke: var(--ink);
		stroke-width: var(--border-w);
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.invitation-flap path {
		vector-effect: non-scaling-stroke;
	}
</style>
