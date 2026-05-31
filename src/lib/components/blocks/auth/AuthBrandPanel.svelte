<script lang="ts">
	import { resolve } from '$app/paths';
	import Gift from '@lucide/svelte/icons/gift';
	import type { Snippet } from 'svelte';

	interface AuthBrandPanelProps {
		tagline: Snippet;
		features: Snippet;
	}

	let { tagline, features }: AuthBrandPanelProps = $props();
</script>

<div class="brand-panel">
	<div class="brand-content">
		<a class="brand-logo" href={resolve('/')} aria-label="Darecky — domovska stranka">
			<span class="brand-logo-icon" aria-hidden="true">
				<Gift class="size-[26px]" />
			</span>
			<span class="brand-logo-wordmark">
				darecky<span class="brand-logo-tld">.cz</span>
			</span>
		</a>

		<div class="brand-illustration" aria-hidden="true">
			<svg width="180" height="180" viewBox="0 0 180 180" fill="none">
				<ellipse cx="90" cy="168" rx="60" ry="9" fill="oklch(0.3 0.08 150)" opacity="0.2" />
				<rect
					x="24"
					y="92"
					width="132"
					height="72"
					rx="10"
					fill="oklch(0.99 0 0)"
					opacity="0.96"
				/>
				<rect x="16" y="72" width="148" height="26" rx="7" fill="oklch(0.99 0 0)" />
				<rect x="82" y="72" width="16" height="92" rx="4" fill="oklch(0.78 0.14 32)" />
				<rect x="16" y="79" width="148" height="12" rx="4" fill="oklch(0.78 0.14 32)" />
				<path
					d="M90 70 C76 50, 48 50, 55 64 C62 74, 80 68, 90 70Z"
					fill="oklch(0.72 0.18 27)"
				/>
				<path
					d="M90 70 C104 50, 132 50, 125 64 C118 74, 100 68, 90 70Z"
					fill="oklch(0.72 0.18 27)"
				/>
				<circle cx="90" cy="70" r="8" fill="oklch(0.80 0.20 30)" />
				<circle cx="40" cy="40" r="3.5" fill="oklch(0.99 0 0)" opacity="0.55" />
				<circle cx="148" cy="30" r="2.5" fill="oklch(0.99 0 0)" opacity="0.45" />
				<circle cx="162" cy="108" r="3" fill="oklch(0.99 0 0)" opacity="0.35" />
				<circle cx="18" cy="122" r="2" fill="oklch(0.99 0 0)" opacity="0.4" />
			</svg>
		</div>

		<p class="brand-tagline">
			{@render tagline()}
		</p>

		<div class="brand-features">
			{@render features()}
		</div>
	</div>

	<div class="brand-bottom">Zdarma navzdy &middot; Bez reklam</div>
</div>

<style>
	.brand-panel {
		background: linear-gradient(160deg, var(--primary) 0%, oklch(38% 0.12 150deg) 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-16) var(--space-12);
		position: relative;
		overflow: hidden;
		min-height: 100dvh;
	}

	.brand-panel::before {
		content: '';
		position: absolute;
		top: -100px;
		right: -100px;
		width: 360px;
		height: 360px;
		border-radius: 50%;
		background: oklch(from white l c h / 8%);
		pointer-events: none;
	}

	.brand-panel::after {
		content: '';
		position: absolute;
		bottom: -60px;
		left: -60px;
		width: 240px;
		height: 240px;
		border-radius: 50%;
		background: oklch(from white l c h / 6%);
		pointer-events: none;
	}

	.brand-content {
		position: relative;
		z-index: 1;
		text-align: center;
		max-width: 340px;
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		justify-content: center;
	}

	.brand-logo {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		text-decoration: none;
		margin-bottom: var(--space-8);
	}

	.brand-logo-icon {
		width: 44px;
		height: 44px;
		background: oklch(from white l c h / 18%);
		border-radius: var(--radius-lg);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		flex-shrink: 0;
		backdrop-filter: blur(4px);
	}

	.brand-logo-wordmark {
		font-family: var(--font-heading);
		font-size: var(--text-3xl);
		font-weight: var(--weight-bold);
		color: white;
		letter-spacing: var(--tracking-tight);
		line-height: 1;
	}

	.brand-logo-tld {
		opacity: 0.45;
		font-weight: var(--weight-medium);
		font-size: var(--text-2xl);
	}

	.brand-illustration {
		margin-bottom: var(--space-8);
	}

	.brand-tagline {
		font-family: var(--font-heading);
		font-size: var(--text-xl);
		font-weight: var(--weight-semibold);
		color: white;
		line-height: var(--leading-snug);
		letter-spacing: var(--tracking-snug);
		margin-bottom: var(--space-8);
		text-align: center;
	}

	.brand-features {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: 100%;
		margin-bottom: var(--space-10);
	}

	.brand-bottom {
		position: absolute;
		bottom: var(--space-6);
		left: 0;
		right: 0;
		text-align: center;
		font-size: var(--text-xs);
		color: oklch(from white l c h / 65%);
		letter-spacing: var(--tracking-wide);
	}

	@media (width <= 768px) {
		.brand-panel {
			display: none;
		}
	}
</style>
