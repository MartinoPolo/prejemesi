<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import LockIcon from '@lucide/svelte/icons/lock';
	import * as m from '$lib/paraglide/messages.js';
</script>

<section
	class="hero-gradient relative overflow-hidden border-b border-border"
	aria-label={m.landing_hero_section_label()}
>
	<!-- Decorative blob -->
	<div
		class="pointer-events-none absolute -right-24 -top-28 h-[600px] w-[600px] rounded-full opacity-70"
		style="background: radial-gradient(ellipse, oklch(52.7% 0.154 150deg / 7%) 0%, transparent 70%)"
		aria-hidden="true"
	></div>

	<div
		class="relative z-[1] mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
	>
		<!-- Text column -->
		<div class="flex flex-col gap-6">
			<div class="flex flex-wrap items-center gap-3">
				<span
					class="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
				>
					<CheckIcon class="size-3" />
					{m.landing_badge_free()}
				</span>
				<span
					class="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground"
				>
					{m.landing_badge_occasions()}
				</span>
			</div>

			<h1
				class="font-heading text-4xl font-extrabold leading-tight tracking-tight md:text-5xl md:leading-[1.05]"
			>
				{m.landing_hero_title()}
			</h1>

			<p class="max-w-[520px] text-lg leading-relaxed text-muted-foreground md:text-xl">
				{m.landing_hero_description()}
			</p>

			<div class="flex flex-wrap items-center gap-4">
				<Button size="lg" href={resolve('/register')}>
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

		<!-- Visual column – floating wishlist card -->
		<div class="relative">
			<div class="overflow-hidden rounded-3xl border border-border bg-background shadow-xl">
				<!-- Card header -->
				<div class="hero-card-header border-b border-border px-6 pb-5 pt-6">
					<div
						class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70"
					>
						{m.landing_wishes_for()}
					</div>
					<div class="font-heading text-2xl font-bold">{m.landing_example_name()}</div>
					<div class="mt-3 flex items-center gap-3">
						<span
							class="hero-badge-event rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
						>
							{m.landing_birthday()}
						</span>
						<span
							class="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
						>
							{m.landing_wishes_count({ count: 8 })}
						</span>
					</div>
				</div>

				<!-- Gift rows -->
				{#each [{ emoji: '📗', hue: '150', name: m.landing_gift_book(), price: '349 Kč · alza.cz', status: 'free' }, { emoji: '🎧', hue: '200', name: m.landing_gift_headphones(), price: '2 490 Kč · mall.cz', status: 'reserved' }, { emoji: '🕯️', hue: '60', name: m.landing_gift_candles(), price: '650 Kč · notino.cz', status: 'free' }, { emoji: '🧴', hue: '330', name: m.landing_gift_cosmetics(), price: '1 890 Kč · sephora.cz', status: 'reserved' }] as gift (gift.name)}
					<div
						class="flex items-center gap-4 border-b border-border px-6 py-3.5 last:border-b-0"
					>
						<div
							class="gift-icon-bg flex size-11 shrink-0 items-center justify-center rounded-lg text-[22px]"
							style="

--gift-hue: {gift.hue}deg"
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
							<span
								class="hero-badge-reserved shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
							>
								{m.landing_status_reserved()}
							</span>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Floating note -->
			<div
				class="absolute -bottom-5 -right-3 max-w-[210px] rounded-2xl bg-primary px-5 py-4 text-sm font-semibold leading-snug text-primary-foreground shadow-lg md:-right-6"
				aria-hidden="true"
				style="box-shadow: 0 8px 24px oklch(52.7% 0.154 150deg / 40%)"
			>
				<LockIcon class="mb-2 size-5" />
				{m.landing_privacy_note()}
			</div>
		</div>
	</div>
</section>

<style>
	.hero-gradient {
		background: linear-gradient(
			160deg,
			oklch(98.8% 0.004 150deg) 0%,
			oklch(96% 0.016 150deg) 50%,
			oklch(98.5% 0.006 150deg) 100%
		);
	}

	:global(.dark) .hero-gradient {
		background: linear-gradient(
			160deg,
			oklch(15.3% 0.006 107deg) 0%,
			oklch(18% 0.012 150deg) 50%,
			oklch(15.3% 0.006 107deg) 100%
		);
	}

	.hero-card-header {
		background: linear-gradient(135deg, oklch(97% 0.016 150deg), oklch(99% 0.006 150deg));
	}

	:global(.dark) .hero-card-header {
		background: linear-gradient(135deg, oklch(22% 0.02 150deg), oklch(18% 0.01 150deg));
	}

	.hero-badge-event {
		background: oklch(94% 0.05 60deg);
		color: oklch(42% 0.09 60deg);
	}

	:global(.dark) .hero-badge-event {
		background: oklch(30% 0.04 60deg);
		color: oklch(78% 0.08 60deg);
	}

	/* Gift icon background – uses --gift-hue custom property */
	.gift-icon-bg {
		background: oklch(94% 0.04 var(--gift-hue));
	}

	:global(.dark) .gift-icon-bg {
		background: oklch(30% 0.03 var(--gift-hue));
	}

	.hero-badge-reserved {
		background: oklch(90% 0.05 200deg / 35%);
		color: oklch(38% 0.1 200deg);
	}

	:global(.dark) .hero-badge-reserved {
		background: oklch(30% 0.06 200deg / 40%);
		color: oklch(72% 0.08 200deg);
	}
</style>
