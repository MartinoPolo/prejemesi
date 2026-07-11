<script lang="ts">
	import BrandShareIcon from './BrandShareIcon.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import { PALETTE_LABELS, PALETTE_SWATCHES, type Palette } from '$lib/theme/palettes.js';

	const shareApps = [
		{ platform: 'whatsapp', label: 'WhatsApp' },
		{ platform: 'messenger', label: 'Messenger' },
		{ platform: 'telegram', label: 'Telegram' },
		{ platform: 'email', label: 'Email' },
	] as const;

	// A representative sample of the 10 curated palettes (Redesign 2026) — the
	// single theming system that replaced the old preset+custom themes.
	const PALETTE_SAMPLE = [
		'sky',
		'sakura',
		'honey',
		'mint',
		'grape',
		'ruby',
	] as const satisfies Palette[];
	const themeSwatches = PALETTE_SAMPLE.map((name) => ({
		name,
		label: PALETTE_LABELS[name],
		color: PALETTE_SWATCHES[name],
	}));
</script>

<section class="bg-dots scroll-mt-16" id="vyhody" aria-label={m.landing_features_headline()}>
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 py-16 md:px-8 md:py-24">
		<div class="mx-auto max-w-[640px] text-center">
			<span class="section-eyebrow">
				<span aria-hidden="true">⭐</span>
				{m.landing_features_eyebrow()}
			</span>
			<h2 class="section-headline">{m.landing_features_headline()}</h2>
		</div>

		<div class="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-3">
			<article class="feature rounded-panel border-ink bg-card border-[2.5px] shadow-sticker">
				<h3 class="text-xl font-semibold">
					<span aria-hidden="true">🙈</span>
					{m.landing_feat1_title()}
				</h3>
				<p class="text-(length:--text-lg) leading-relaxed text-ink-soft">
					{m.landing_feat1_description()}
				</p>
				<div class="feature-demo">
					<div class="peek-row">
						<span class="peek-label">{m.landing_feat1_owner_view()}</span>
						<span class="peek-gift">
							<span aria-hidden="true">🎧</span>
							<span class="truncate">{m.landing_gift_headphones()}</span>
							<span class="chip chip-hidden">{m.landing_status_reserved()}</span>
						</span>
					</div>
					<div class="peek-row">
						<span class="peek-label">{m.landing_feat1_gifter_view()}</span>
						<span class="peek-gift">
							<span aria-hidden="true">🎧</span>
							<span class="truncate">{m.landing_gift_headphones()}</span>
							<span class="chip chip-filled">{m.landing_status_reserved()}</span>
						</span>
					</div>
				</div>
			</article>

			<article class="feature rounded-panel border-ink bg-card border-[2.5px] shadow-sticker">
				<h3 class="text-xl font-semibold">
					<span aria-hidden="true">🔗</span>
					{m.landing_feat2_title()}
				</h3>
				<p class="text-(length:--text-lg) leading-relaxed text-ink-soft">
					{m.landing_feat2_description()}
				</p>
				<div class="feature-demo">
					<div class="share-pill">
						<span class="truncate">prejemesi.cz/w/martina-vanocni-2026</span>
						<span class="share-pill-copy">{m.landing_feat2_copy()}</span>
					</div>
					<div class="flex justify-center gap-2.5">
						{#each shareApps as app (app.platform)}
							<SimpleTooltip text={app.label} side="top">
								{#snippet asChild(triggerProps)}
									<span {...triggerProps} class="share-icon">
										<BrandShareIcon platform={app.platform} class="size-5" />
										<span class="sr-only">{app.label}</span>
									</span>
								{/snippet}
							</SimpleTooltip>
						{/each}
					</div>
					<div
						class="flex items-center justify-center gap-2 text-(length:--text-base) font-semibold text-brand"
					>
						<span aria-hidden="true">🤍</span>
						{m.landing_feat2_no_account()}
					</div>
				</div>
			</article>

			<article class="feature rounded-panel border-ink bg-card border-[2.5px] shadow-sticker">
				<h3 class="text-xl font-semibold">
					<span aria-hidden="true">🎨</span>
					{m.landing_feat3_title()}
				</h3>
				<p class="text-(length:--text-lg) leading-relaxed text-ink-soft">
					{m.landing_feat3_description()}
				</p>
				<div class="feature-demo">
					<div class="flex flex-wrap gap-2">
						{#each themeSwatches as theme (theme.name)}
							<span class="theme-swatch">
								<span
									class="theme-swatch-dot"
									style="background: {theme.color}"
									aria-hidden="true"
								></span>
								{theme.label}
							</span>
						{/each}
					</div>
				</div>
			</article>
		</div>
	</div>
</section>

<style>
	.feature {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: var(--space-4);
		padding: 24px;
	}

	.feature-demo {
		margin-top: auto;
		background: var(--background);
		border: 2px solid var(--ink);
		border-radius: 12px;
		padding: 14px;
		display: grid;
		gap: 10px;
	}

	.peek-row {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		flex-wrap: wrap;
	}

	.peek-label {
		font-weight: 700;
		flex: none;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.peek-gift {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--card);
		border: 2px solid var(--ink);
		border-radius: 8px;
		padding: 6px 10px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		margin-left: auto;
		font-size: 10.5px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 999px;
		border: 2px solid var(--ink);
		background: var(--card);
		color: var(--ink);
		white-space: nowrap;
	}

	.chip-filled {
		background: var(--primary);
		color: var(--primary-foreground);
	}

	/* The owner's view: the status exists but is unreadable */
	.chip-hidden {
		filter: blur(3.5px);
		opacity: 0.75;
	}

	.share-pill {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--card);
		border: 2px solid var(--ink);
		border-radius: 999px;
		padding: 8px 8px 8px 16px;
		font-size: 13.5px;
		font-weight: 600;
		flex-wrap: wrap;
	}

	.share-pill-copy {
		margin-left: auto;
		border: 2px solid var(--ink);
		background: var(--primary);
		color: var(--primary-foreground);
		font-size: 12px;
		font-weight: 700;
		padding: 4px 12px;
		border-radius: 999px;
	}

	.share-icon {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--card);
		border: 2px solid var(--ink);
		display: grid;
		place-items: center;
		color: var(--ink);
		transition:
			transform 0.18s ease,
			background-color 0.18s ease;
	}

	.share-icon:hover {
		transform: translateY(-3px) rotate(-4deg);
		background: var(--tint);
	}

	.theme-swatch {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		padding: 6px 12px;
		background: var(--card);
		border: 2px solid var(--ink);
		border-radius: 10px;
		transition: transform 0.15s ease;
	}

	.theme-swatch:hover {
		transform: rotate(-2deg) scale(1.05);
	}

	.theme-swatch-dot {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid var(--ink);
		border-radius: 50%;
	}

	/* Staggered pop-in on load (mockup .features-grid reveal) */
	@media (prefers-reduced-motion: no-preference) {
		.feature {
			animation: pop-in 0.55s cubic-bezier(0.34, 1.4, 0.64, 1) backwards;
		}

		.feature:nth-child(2) {
			animation-delay: 0.1s;
		}

		.feature:nth-child(3) {
			animation-delay: 0.2s;
		}
	}
</style>
