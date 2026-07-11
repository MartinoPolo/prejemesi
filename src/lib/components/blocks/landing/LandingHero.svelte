<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';

	const exampleGifts = [
		{ emoji: '📗', name: m.landing_gift_book(), price: '349 Kč · alza.cz', reserved: false },
		{
			emoji: '🎧',
			name: m.landing_gift_headphones(),
			price: '2 490 Kč · mall.cz',
			reserved: true,
		},
		{
			emoji: '🕯️',
			name: m.landing_gift_candles(),
			price: '650 Kč · notino.cz',
			reserved: false,
		},
		{
			emoji: '🧴',
			name: m.landing_gift_cosmetics(),
			price: '1 890 Kč · sephora.cz',
			reserved: true,
		},
	] as const;
</script>

<section class="bg-dots relative" aria-label={m.landing_hero_section_label()}>
	<div
		class="relative z-[1] mx-auto grid max-w-[var(--content-max-width)] items-center gap-12 px-4 py-16 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24"
	>
		<div class="flex max-w-[640px] flex-col gap-6">
			<div class="hero-badges reveal flex flex-wrap items-center gap-3">
				<span class="chip chip-filled">
					<CheckIcon class="size-3.5" aria-hidden="true" />
					{m.landing_badge_no_duplicates()}
				</span>
				<span class="chip">
					<span aria-hidden="true">🎄</span>
					{m.landing_badge_occasions()}
				</span>
			</div>

			<h1 class="reveal reveal-2 text-[clamp(34px,5vw,54px)] font-semibold leading-[1.12]">
				{m.landing_hero_title()}
			</h1>

			<p class="reveal reveal-3 max-w-[46ch] text-[17px] leading-relaxed text-ink-soft">
				{m.landing_hero_description()}
			</p>

			<div class="reveal reveal-4 relative flex flex-wrap items-center gap-4">
				<Button
					size="lg"
					class="h-12 px-5 text-[16px]"
					href={localizeInternalHref(resolve('/register'))}
				>
					<GiftIcon data-icon="inline-start" />
					{m.landing_hero_cta()}
				</Button>
				<Button
					intent="secondary"
					size="lg"
					class="h-12 px-5 text-[16px]"
					href="#jak-to-funguje"
				>
					{m.landing_hero_how()}
				</Button>
				<!-- positioned via left/top + --rot (NOT transform alone) so the bob
				     animation, which overwrites the transform, keeps the rotation -->
				<svg
					class="pointer-events-none absolute -top-1.5 left-[450px] hidden w-[90px] rotate-[12deg] text-brand lg:block motion-safe:animate-bob"
					style:--rot="12deg"
					viewBox="0 0 100 60"
					aria-hidden="true"
				>
					<path
						d="M92 8 C 70 38, 40 50, 12 46"
						fill="none"
						stroke="currentColor"
						stroke-width="3.5"
						stroke-linecap="round"
					/>
					<path
						d="M24 38 L 11 46 L 22 55"
						fill="none"
						stroke="currentColor"
						stroke-width="3.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>

			<p
				class="reveal reveal-5 flex items-center gap-1.5 text-(length:--text-base) text-ink-soft"
			>
				<span aria-hidden="true">🤍</span>
				{m.landing_hero_no_card()}
			</p>
		</div>

		<div class="fan reveal reveal-3 relative mx-auto w-full max-w-[430px]" aria-hidden="true">
			<div class="fan-face p-6">
				<div class="mb-4 flex items-center justify-between gap-4">
					<div>
						<div
							class="text-(length:--text-xs) font-semibold uppercase tracking-wide text-ink-soft"
						>
							{m.landing_wishes_for()}
						</div>
						<div class="font-heading text-[19px]">{m.landing_example_name()}</div>
					</div>
					<span class="chip chip-tint">
						<span aria-hidden="true">🎂</span>
						{m.landing_birthday()}
					</span>
				</div>
				<div class="grid gap-2.5">
					{#each exampleGifts as gift (gift.name)}
						<div class="mock-row">
							<span class="mock-emoji">{gift.emoji}</span>
							<div class="min-w-0 flex-1">
								<div class="truncate text-(length:--text-base) font-semibold">
									{gift.name}
								</div>
								<div class="text-[12.5px] text-ink-soft">{gift.price}</div>
							</div>
							{#if gift.reserved}
								<span class="chip chip-filled chip-status"
									>{m.landing_status_reserved()}</span
								>
							{:else}
								<span class="chip chip-status">{m.landing_status_free()}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
			<p class="mock-note">
				<span aria-hidden="true">🤫</span>
				{m.landing_privacy_note()}
			</p>
		</div>
	</div>

	<svg
		class="pointer-events-none absolute left-[4%] top-4 w-[34px] text-brand motion-safe:animate-bob"
		style:--rot="-10deg"
		style:animation-duration="5s"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path
			d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z"
			fill="currentColor"
		/>
	</svg>
	<svg
		class="pointer-events-none absolute bottom-[120px] right-[6%] w-[22px] text-brand motion-safe:animate-bob"
		style:--rot="14deg"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path
			d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z"
			fill="currentColor"
		/>
	</svg>
</section>

<style>
	/* Chips (mockup .chip family) */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		padding: 4px 12px;
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

	.chip-tint {
		background: var(--background);
	}

	.chip-status {
		font-size: 11.5px;
		padding: 2px 9px;
	}

	.hero-badges .chip {
		transform: rotate(-1.5deg);
	}

	.hero-badges .chip:last-child {
		transform: rotate(1.2deg);
	}

	/* Fan of rotated cards behind the wishlist mock (mockup .fan/.fan-face) */
	.fan {
		z-index: 0;
	}

	.fan::before,
	.fan::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border: var(--border-w) solid var(--ink);
		transition: transform 0.28s var(--ease-spring);
	}

	.fan::before {
		transform: rotate(-1.8deg);
		background: var(--fan-back-1);
	}

	.fan::after {
		transform: rotate(1.4deg);
		background: var(--fan-back-2);
	}

	.fan:hover::before {
		transform: rotate(-3.2deg) translateY(2px);
	}

	.fan:hover::after {
		transform: rotate(2.6deg) translateY(-2px);
	}

	/* fan cards keep square corners */
	.fan-face {
		position: relative;
		background: var(--card);
		border: var(--border-w) solid var(--ink);
	}

	.mock-row {
		display: flex;
		align-items: center;
		gap: 12px;
		border: 2px solid var(--ink-faint);
		border-radius: 10px;
		padding: 9px 12px;
		background: var(--muted);
	}

	.mock-emoji {
		width: 38px;
		height: 38px;
		flex: none;
		font-size: 20px;
		display: grid;
		place-items: center;
		background: var(--background);
		border: 2px solid var(--ink);
		border-radius: 9px;
	}

	/* Sunshine sticky note hanging off the card's bottom-right corner */
	.mock-note {
		position: relative;
		margin: 18px -8px -34px auto;
		max-width: 250px;
		background: var(--note-tint);
		color: var(--note-ink);
		border: var(--border-w) solid var(--ink);
		border-radius: 12px;
		padding: 10px 14px;
		font-size: 13.5px;
		font-weight: 600;
		transform: rotate(-2deg);
		box-shadow: 4px 4px 0 var(--hard-shadow);
	}

	@media (width < 640px) {
		.mock-note {
			margin-right: 0;
		}
	}
</style>
