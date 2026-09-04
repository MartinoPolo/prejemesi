<script lang="ts">
	import LogoMark from '$lib/components/blocks/navbar/LogoMark.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { Snippet } from 'svelte';

	interface AuthBrandPanelProps {
		tagline: Snippet;
		features: Snippet;
	}

	let { tagline, features }: AuthBrandPanelProps = $props();
</script>

<!-- Anime-sky brand panel (issue #102 REQ-16, `anime-auth.html`): tinted notebook
     side with dot pattern, ink seam, tick-list features, and a decorative
     polaroid + sticky-note art row. On mobile it condenses to a slim header. -->
<div class="brand-panel bg-dots">
	<div class="brand-inner">
		<div class="brand-logo reveal">
			<LogoMark />
		</div>

		<h1 class="brand-tagline reveal reveal-2">
			{@render tagline()}
		</h1>

		<div class="brand-features reveal reveal-3">
			{@render features()}
		</div>

		<div class="brand-art reveal reveal-4" aria-hidden="true">
			<figure class="brand-polaroid">
				<div class="brand-polaroid-img"><span>🎂</span></div>
				<figcaption>{m.auth_polaroid_caption()}</figcaption>
			</figure>
			<p class="brand-sticky">{m.auth_sticky_note()}</p>
		</div>
	</div>

	<div class="brand-bottom">{m.auth_brand_bottom()}</div>
</div>

<style>
	.brand-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-16) var(--space-10);
		background-color: var(--tint);
		border-right: 2.5px solid var(--ink);
		overflow: hidden;
		min-height: 100dvh;
	}

	.brand-inner {
		position: relative;
		max-width: 470px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.brand-logo {
		margin-bottom: var(--space-6);
	}

	.brand-tagline {
		font-family: var(--font-head);
		font-size: clamp(28px, 3.2vw, 40px);
		font-weight: 600;
		line-height: 1.15;
		color: var(--ink);
		margin-bottom: var(--space-6);
	}

	.brand-features {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	/* alternate tick tilts like hand-placed stickers */
	.brand-features > :global(:nth-child(2n) .brand-feature-icon) {
		transform: rotate(2deg);
	}

	.brand-art {
		display: flex;
		align-items: center;
		gap: var(--space-10);
		margin-top: var(--space-10);
	}

	.brand-polaroid {
		flex: none;
		width: 150px;
		margin: 0;
		background: #fffdf6;
		border: 2px solid #4a443a;
		border-radius: 3px;
		padding: 8px 8px 0;
		transform: rotate(-4deg);
		box-shadow: var(--elevation-lifted-strong);
		position: relative;
	}

	.brand-polaroid::before {
		content: '';
		position: absolute;
		top: -12px;
		left: 50%;
		z-index: 1;
		width: 66px;
		height: 19px;
		transform: translateX(-50%) rotate(-4deg);
		background: var(--tape-bg);
		border: 1.5px solid var(--tape-border);
	}

	.brand-polaroid-img {
		height: 118px;
		display: grid;
		place-items: center;
		border: 2px solid rgb(0 0 0 / 14%);
		background:
			radial-gradient(circle at 79% 20%, #ffe79b 0 13%, transparent 14%),
			linear-gradient(180deg, #8ecdf6 0%, #cbeafc 58%, #b5e3a7 58%, #8fd08a 100%);
	}

	.brand-polaroid-img span {
		font-size: 46px;
		filter: drop-shadow(2px 3px 0 rgb(0 0 0 / 18%));
	}

	.brand-polaroid figcaption {
		font-family: var(--font-head);
		font-size: 13px;
		color: #6c6353;
		text-align: center;
		padding: 6px 4px 8px;
	}

	.brand-sticky {
		position: relative;
		background: var(--accent-loud);
		color: var(--accent-loud-foreground);
		border: 2.5px solid var(--accent-loud-foreground);
		border-radius: 4px;
		padding: 14px 18px 12px;
		font-family: var(--font-head);
		font-size: 15px;
		text-align: center;
		line-height: 1.3;
		max-width: 180px;
		transform: rotate(3deg);
		box-shadow: var(--elevation-ordinary-strong);
	}

	.brand-sticky::before {
		content: '';
		position: absolute;
		top: -12px;
		left: 50%;
		width: 62px;
		height: 18px;
		transform: translateX(-50%) rotate(-3deg);
		background: var(--tape-bg);
		border: 1.5px solid var(--tape-border);
	}

	.brand-bottom {
		position: absolute;
		bottom: var(--space-6);
		left: 0;
		right: 0;
		text-align: center;
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--muted-foreground);
		letter-spacing: var(--tracking-wide);
	}

	@media (width <= 768px) {
		/* condensed header above the form instead of a full column */
		.brand-panel {
			min-height: auto;
			border-right: none;
			border-bottom: 2.5px solid var(--ink);
			padding: var(--space-8) var(--space-4) var(--space-6);
		}

		.brand-inner {
			align-items: center;
			text-align: center;
		}

		.brand-tagline {
			font-size: 26px;
			margin-bottom: 0;
		}

		.brand-features,
		.brand-art,
		.brand-bottom {
			display: none;
		}
	}
</style>
