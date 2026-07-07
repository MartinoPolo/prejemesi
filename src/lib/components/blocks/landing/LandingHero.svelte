<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import LockIcon from '@lucide/svelte/icons/lock';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';
</script>

<section
	class="hero-surface relative overflow-hidden border-b border-border"
	aria-label={m.landing_hero_section_label()}
>
	<div
		class="relative z-[1] mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:py-24"
	>
		<div class="flex max-w-[640px] flex-col gap-6">
			<div class="flex flex-wrap items-center gap-3">
				<span
					class="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
				>
					<CheckIcon class="size-3" />
					{m.landing_badge_no_duplicates()}
				</span>
				<span
					class="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground"
				>
					{m.landing_badge_occasions()}
				</span>
			</div>

			<h1 class="font-heading text-4xl font-extrabold leading-tight md:text-5xl md:leading-[1.05] lg:text-6xl">
				{m.landing_hero_title()}
			</h1>

			<p class="max-w-[520px] text-lg leading-relaxed text-muted-foreground md:text-xl">
				{m.landing_hero_description()}
			</p>

			<div class="flex flex-wrap items-center gap-4">
				<Button size="lg" href={localizeInternalHref(resolve('/register'))}>
					<GiftIcon data-icon="inline-start" />
					{m.landing_hero_cta()}
				</Button>
				<a
					href="#jak-to-funguje"
					class="inline-flex items-center gap-1.5 px-2 font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					{m.landing_hero_how()}
					<ArrowDownIcon class="size-4" />
				</a>
			</div>

			<p class="text-sm text-muted-foreground/70">
				{m.landing_hero_no_card()}
			</p>
		</div>

		<div class="hero-scene relative" aria-hidden="true">
			<div class="wishlist-card overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
				<div class="hero-card-header border-b border-border px-5 pb-5 pt-6">
					<div class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
						{m.landing_wishes_for()}
					</div>
					<div class="font-heading text-2xl font-bold">{m.landing_example_name()}</div>
					<div class="mt-3 flex items-center gap-3">
						<span class="hero-badge-event rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
							{m.landing_birthday()}
						</span>
						<span
							class="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
						>
							{m.landing_wishes_count({ count: 8 })}
						</span>
					</div>
				</div>

				{#each [{ emoji: '📗', hue: '150', name: m.landing_gift_book(), price: '349 Kč · alza.cz', status: 'free' }, { emoji: '🎧', hue: '200', name: m.landing_gift_headphones(), price: '2 490 Kč · mall.cz', status: 'reserved' }, { emoji: '🕯️', hue: '60', name: m.landing_gift_candles(), price: '650 Kč · notino.cz', status: 'free' }, { emoji: '🧴', hue: '330', name: m.landing_gift_cosmetics(), price: '1 890 Kč · sephora.cz', status: 'reserved' }] as gift (gift.name)}
					<div class="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0">
						<div
							class="gift-icon-bg flex size-11 shrink-0 items-center justify-center rounded-xl text-[22px]"
							style={`--gift-hue: ${gift.hue}deg`}
						>
							{gift.emoji}
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-semibold">{gift.name}</div>
							<div class="mt-0.5 text-xs text-muted-foreground/70">{gift.price}</div>
						</div>
						{#if gift.status === 'free'}
							<span
								class="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
							>
								{m.landing_status_free()}
							</span>
						{:else}
							<span class="hero-badge-reserved shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
								{m.landing_status_reserved()}
							</span>
						{/if}
					</div>
				{/each}
			</div>

			<div class="privacy-note rounded-2xl bg-primary px-4 py-3 text-sm font-semibold leading-snug text-primary-foreground shadow-lg">
				<LockIcon class="mb-2 size-5" />
				{m.landing_privacy_note()}
			</div>
		</div>
	</div>
</section>

<style>
	.hero-surface {
		background:
			linear-gradient(90deg, oklch(99% 0.006 95deg / 96%), oklch(96% 0.018 145deg / 92%)),
			repeating-linear-gradient(
				6deg,
				oklch(87% 0.035 75deg / 24%) 0 1px,
				transparent 1px 18px
			);
	}

	:global(.dark) .hero-surface {
		background:
			linear-gradient(90deg, oklch(15.3% 0.006 107deg / 97%), oklch(18% 0.018 150deg / 92%)),
			repeating-linear-gradient(
				6deg,
				oklch(36% 0.035 75deg / 16%) 0 1px,
				transparent 1px 18px
			);
	}

	.hero-scene {
		min-height: 27rem;
		display: grid;
		align-items: center;
	}

	.hero-scene::before {
		content: '';
		position: absolute;
		inset: 2rem 0 0 3rem;
		border-radius: var(--radius-2xl);
		background:
			linear-gradient(135deg, oklch(72% 0.045 72deg), oklch(58% 0.04 64deg)),
			repeating-linear-gradient(
				90deg,
				oklch(45% 0.045 70deg / 16%) 0 1px,
				transparent 1px 32px
			);
		transform: rotate(2deg);
		box-shadow: inset 0 1px 0 oklch(100% 0 0deg / 35%);
	}

	.wishlist-card {
		position: relative;
		z-index: 1;
		max-width: 34rem;
		transform: rotate(-1.5deg);
	}

	.privacy-note {
		position: absolute;
		z-index: 2;
		right: 0.75rem;
		bottom: 1rem;
		max-width: 12.5rem;
		box-shadow: 0 8px 24px oklch(52.7% 0.154 150deg / 28%);
	}

	.hero-card-header {
		background: linear-gradient(135deg, oklch(97% 0.016 150deg), oklch(99% 0.006 150deg));
	}

	.hero-badge-event {
		background: oklch(94% 0.05 60deg);
		color: oklch(42% 0.09 60deg);
	}

	.gift-icon-bg {
		background: oklch(94% 0.04 var(--gift-hue));
	}

	.hero-badge-reserved {
		background: oklch(90% 0.05 200deg / 35%);
		color: oklch(38% 0.1 200deg);
	}

	:global(.dark) .hero-card-header {
		background: linear-gradient(135deg, oklch(22% 0.02 150deg), oklch(18% 0.01 150deg));
	}

	:global(.dark) .hero-badge-event {
		background: oklch(30% 0.04 60deg);
		color: oklch(78% 0.08 60deg);
	}

	:global(.dark) .gift-icon-bg {
		background: oklch(30% 0.03 var(--gift-hue));
	}

	:global(.dark) .hero-badge-reserved {
		background: oklch(30% 0.06 200deg / 40%);
		color: oklch(72% 0.08 200deg);
	}

	:global(.dark) .hero-scene::before {
		background:
			linear-gradient(135deg, oklch(30% 0.035 72deg), oklch(23% 0.035 64deg)),
			repeating-linear-gradient(
				90deg,
				oklch(65% 0.04 75deg / 10%) 0 1px,
				transparent 1px 32px
			);
		box-shadow: inset 0 1px 0 oklch(100% 0 0deg / 8%);
	}

	:global(.dark) .wishlist-card {
		box-shadow:
			0 24px 56px oklch(0% 0 0deg / 36%),
			0 8px 16px oklch(0% 0 0deg / 20%);
	}

	:global(.dark) .privacy-note {
		box-shadow: 0 8px 24px oklch(0% 0 0deg / 32%);
	}

	@media (width >= 1024px) {
		.wishlist-card {
			margin-left: auto;
		}
	}

	@media (width < 640px) {
		.hero-scene {
			min-height: auto;
		}

		.hero-scene::before {
			inset: 1rem 0 0 1rem;
		}

		.wishlist-card {
			transform: none;
		}

		.privacy-note {
			position: relative;
			right: auto;
			bottom: auto;
			margin: -1.25rem 1rem 0 auto;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.wishlist-card {
			animation: hero-card-enter 720ms ease-out both;
		}

		.privacy-note {
			animation: hero-note-enter 840ms ease-out 120ms both;
		}
	}

	@keyframes hero-card-enter {
		from {
			opacity: 0;
			transform: translateY(16px) rotate(-1.5deg);
		}
	}

	@keyframes hero-note-enter {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}

	@media (width < 640px) {
		@keyframes hero-card-enter {
			from {
				opacity: 0;
				transform: translateY(16px);
			}
		}
	}
</style>
