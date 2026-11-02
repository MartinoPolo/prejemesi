<script lang="ts">
	import type { Component } from 'svelte';
	import type { WishlistHeroFrame } from '$lib/theme/wishlist_themes.js';
	import OccasionCountdownText from './OccasionCountdownText.svelte';

	interface Props {
		frame: WishlistHeroFrame;
		/** The displayed occasion's icon, shared with the header's meta line and chip. */
		occasionIcon: Component;
		/** Occasion label, or null for Jiná, which names nothing worth showing. */
		occasionLabel: string | null;
		/** „za 12 dní", „proběhlo" once the event passed, or null without an event date. */
		countdownLabel: string | null;
	}

	let { frame, occasionIcon: OccasionIcon, occasionLabel, countdownLabel }: Props = $props();

	const hasText = $derived(occasionLabel !== null || countdownLabel !== null);
</script>

<!--
The occasion emblem from 960 px: a postage stamp on Blok and Visačka, a kraft tag
hanging from the Dárek bow, a wax seal with a countdown pill on Pozvánka. Its text is the
occasion for screen readers at that width; below it the header's meta line takes over.
-->
{#snippet emblemText()}
	{#if occasionLabel !== null}
		<span class="emblem-occasion">{occasionLabel}</span>
	{/if}
	{#if countdownLabel !== null}
		<span class="emblem-countdown">{countdownLabel}</span>
	{/if}
{/snippet}

{#snippet waxSeal()}
	<div class="seal" aria-hidden="true">
		<svg class="seal-wax" viewBox="0 0 84 84">
			<path
				d="M76.0 42.0 Q86.4 53.9 71.4 59.0 Q74.5 74.5 59.0 71.4 Q53.9 86.4 42.0 76.0 Q30.1 86.4 25.0 71.4 Q9.5 74.5 12.6 59.0 Q-2.4 53.9 8.0 42.0 Q-2.4 30.1 12.6 25.0 Q9.5 9.5 25.0 12.6 Q30.1 -2.4 42.0 8.0 Q53.9 -2.4 59.0 12.6 Q74.5 9.5 71.4 25.0 Q86.4 30.1 76.0 42.0 Z"
			/>
			<circle class="seal-ring" cx="42" cy="42" r="24" />
		</svg>
		<OccasionIcon class="seal-icon" />
	</div>
{/snippet}

{#if frame === 'invitation'}
	<div class="hero-emblem seal-emblem" data-testid="wishlist-hero-seal">
		{@render waxSeal()}
		{#if hasText}
			<p class="seal-pill rounded-full">
				<OccasionCountdownText {occasionLabel} {countdownLabel} />
			</p>
		{/if}
	</div>
{:else if hasText && frame === 'gift'}
	<div class="hero-emblem gift-tag-anchor" data-testid="wishlist-hero-tag">
		<svg class="gift-tag-string" viewBox="0 0 92 58" aria-hidden="true">
			<path d="M90 2 C70 10 40 20 2 56" />
		</svg>
		<p class="gift-tag">
			<OccasionIcon class="gift-tag-icon" aria-hidden="true" />
			{@render emblemText()}
		</p>
	</div>
{:else if hasText}
	<p class="hero-emblem stamp" data-testid="wishlist-hero-stamp">
		<OccasionIcon class="stamp-icon" aria-hidden="true" />
		{@render emblemText()}
	</p>
{/if}

<style>
	.hero-emblem {
		position: absolute;
		z-index: 1;
		display: none;
		margin: 0;
		color: var(--ink);
	}

	@media (width >= 960px) {
		.hero-emblem {
			display: flex;
		}
	}

	/* ── Postage stamp in the former sticky-note slot ── */
	.stamp {
		--stamp-width: 132px;

		top: -12px;
		right: calc(var(--hero-emblem-reserve) - var(--stamp-width));
		box-sizing: border-box;
		width: var(--stamp-width);
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 14px 12px 12px;
		text-align: center;
		background: var(--card);
		border: var(--border-w) solid var(--ink);
		border-radius: 3px;
		outline: 1.5px dashed color-mix(in oklab, var(--ink) 60%, transparent);
		outline-offset: -8px;
		box-shadow: var(--elevation-ordinary-strong);
		rotate: 4deg;
	}

	.stamp :global(.stamp-icon) {
		width: 24px;
		height: 24px;
		color: var(--brand);
	}

	.emblem-occasion {
		font-family: var(--font-head);
		font-size: 16px;
		font-weight: 600;
		line-height: 1.2;
	}

	.emblem-countdown {
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.3;
		color: var(--muted-foreground);
	}

	/* ── Dárek: kraft tag on a string from the bow at the ribbon's top ── */
	.gift-tag-anchor {
		top: 4px;
		right: calc(var(--hero-ribbon-end) + var(--hero-ribbon-width) / 2);
		width: 150px;
		height: 1px;
		pointer-events: none;
	}

	.gift-tag-string {
		position: absolute;
		top: 0;
		right: 0;
		width: 92px;
		height: 58px;
		overflow: visible;
		fill: none;
		stroke: color-mix(in oklab, var(--kraft) 35%, var(--ink));
		stroke-width: 2;
		stroke-linecap: round;
	}

	.gift-tag {
		position: absolute;
		top: 46px;
		left: 4px;
		box-sizing: border-box;
		display: flex;
		width: 112px;
		margin: 0;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 24px 10px 12px;
		text-align: center;
		background: var(--kraft);
		border: var(--border-w) solid var(--ink);
		border-radius: 6px;
		box-shadow: var(--elevation-ordinary-strong);
		transform-origin: 50% 10px;
		rotate: -6deg;
		pointer-events: auto;
	}

	/* Punched hole the string runs through */
	.gift-tag::before {
		content: '';
		position: absolute;
		top: 5px;
		left: 50%;
		width: 10px;
		height: 10px;
		background: var(--card);
		border: 1.5px solid var(--ink);
		border-radius: 50%;
		translate: -50% 0;
	}

	.gift-tag :global(.gift-tag-icon) {
		width: 22px;
		height: 22px;
		color: var(--brand);
	}

	/* ── Pozvánka: wax seal in the primary colour, countdown on a pill below ── */
	.seal-emblem {
		--seal-column-width: 168px;

		top: calc(var(--hero-flap) + var(--space-3));
		right: calc(var(--hero-emblem-reserve) - var(--seal-column-width));
		width: var(--seal-column-width);
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
	}

	.seal {
		position: relative;
		display: grid;
		width: 76px;
		height: 76px;
		place-items: center;
		rotate: -8deg;
	}

	.seal-wax {
		position: absolute;
		inset: 0;
		overflow: visible;
		fill: var(--primary);
		stroke: color-mix(in oklab, var(--primary) 70%, var(--ink));
		stroke-width: 1.5;
	}

	.seal-ring {
		fill: none;
		stroke: color-mix(in oklab, var(--primary-foreground) 55%, transparent);
		stroke-width: 1.5;
		stroke-dasharray: 3 3;
	}

	.seal :global(.seal-icon) {
		position: relative;
		width: 28px;
		height: 28px;
		color: var(--primary-foreground);
	}

	.seal-pill {
		margin: 0;
		padding: 3px 10px;
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.4;
		white-space: nowrap;
		background: var(--card);
		border: var(--border-w) solid var(--ink);
	}
</style>
