<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';

	type HeroDemoPhase = 'idle' | 'approach' | 'tap' | 'reserved' | 'owner' | 'return';

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

	/* Looping hero demo: a ghost cursor reserves the first gift, the card
	   briefly flips to the owner's view (no reservation chips) to show that
	   Tereza sees nothing, then resets. Skipped under reduced motion. */
	const heroDemoPhaseSequence: readonly HeroDemoPhase[] = [
		'idle',
		'approach',
		'tap',
		'reserved',
		'owner',
		'return',
	];

	const heroDemoPhaseDurationsMs: Record<HeroDemoPhase, number> = {
		idle: 900,
		approach: 1300,
		tap: 400,
		reserved: 1700,
		owner: 2300,
		return: 1100,
	};

	// Night-sky stars (dark mode only): position + twinkle rhythm per star
	const skyStars = [
		{ left: '4%', top: '18%', size: '4px', duration: '2.6s', delay: '0s' },
		{ left: '11%', top: '65%', size: '3px', duration: '3.4s', delay: '0.7s' },
		{ left: '18%', top: '32%', size: '3px', duration: '2.9s', delay: '1.4s' },
		{ left: '26%', top: '80%', size: '4px', duration: '3.1s', delay: '0.3s' },
		{ left: '33%', top: '12%', size: '3px', duration: '2.5s', delay: '1.9s' },
		{ left: '42%', top: '48%', size: '3px', duration: '3.6s', delay: '0.9s' },
		{ left: '51%', top: '22%', size: '4px', duration: '2.7s', delay: '1.2s' },
		{ left: '60%', top: '72%', size: '3px', duration: '3.2s', delay: '0.2s' },
		{ left: '68%', top: '10%', size: '3px', duration: '2.8s', delay: '1.6s' },
		{ left: '77%', top: '38%', size: '4px', duration: '3.5s', delay: '0.5s' },
		{ left: '86%', top: '62%', size: '3px', duration: '2.6s', delay: '1.1s' },
		{ left: '94%', top: '24%', size: '4px', duration: '3s', delay: '1.8s' },
	] as const;

	let heroDemoPhase = $state<HeroDemoPhase>('idle');

	const isDemoGiftReserved = $derived(
		heroDemoPhase === 'reserved' || heroDemoPhase === 'owner' || heroDemoPhase === 'return',
	);
	const isDemoCursorAtGift = $derived(heroDemoPhase === 'approach' || heroDemoPhase === 'tap');
	const isDemoOwnerView = $derived(heroDemoPhase === 'owner');

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		let phaseTimer: ReturnType<typeof setTimeout>;
		const scheduleNextPhase = () => {
			phaseTimer = setTimeout(() => {
				const currentIndex = heroDemoPhaseSequence.indexOf(heroDemoPhase);
				heroDemoPhase =
					heroDemoPhaseSequence[(currentIndex + 1) % heroDemoPhaseSequence.length] ??
					'idle';
				scheduleNextPhase();
			}, heroDemoPhaseDurationsMs[heroDemoPhase]);
		};
		scheduleNextPhase();
		return () => clearTimeout(phaseTimer);
	});
</script>

<section class="bg-dots relative" aria-label={m.landing_hero_section_label()}>
	<!-- Living sky: drifting clouds (light) / twinkling stars (dark) -->
	<div class="sky-layer" aria-hidden="true">
		<svg class="sky-cloud sky-cloud-1" viewBox="0 0 200 70">
			<ellipse cx="48" cy="48" rx="42" ry="17" />
			<ellipse cx="98" cy="36" rx="40" ry="23" />
			<ellipse cx="150" cy="48" rx="44" ry="17" />
			<ellipse cx="100" cy="53" rx="72" ry="14" />
		</svg>
		<svg class="sky-cloud sky-cloud-2" viewBox="0 0 200 70">
			<ellipse cx="48" cy="48" rx="42" ry="17" />
			<ellipse cx="98" cy="36" rx="40" ry="23" />
			<ellipse cx="150" cy="48" rx="44" ry="17" />
			<ellipse cx="100" cy="53" rx="72" ry="14" />
		</svg>
		<svg class="sky-cloud sky-cloud-3" viewBox="0 0 200 70">
			<ellipse cx="48" cy="48" rx="42" ry="17" />
			<ellipse cx="98" cy="36" rx="40" ry="23" />
			<ellipse cx="150" cy="48" rx="44" ry="17" />
			<ellipse cx="100" cy="53" rx="72" ry="14" />
		</svg>
		{#each skyStars as star (star.left)}
			<span
				class="sky-star"
				style:left={star.left}
				style:top={star.top}
				style:--star-size={star.size}
				style:--twinkle-duration={star.duration}
				style:--twinkle-delay={star.delay}
			></span>
		{/each}
		<span class="sky-shooting-star"></span>
	</div>

	<div
		class="relative z-[1] mx-auto grid max-w-[var(--content-max-width)] grid-cols-1 items-center gap-12 px-4 py-16 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24"
	>
		<div class="flex min-w-0 max-w-[640px] flex-col gap-6">
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

		<div
			class="fan reveal reveal-3 relative mx-auto w-full max-w-[430px]"
			class:demo-cursor-active={isDemoCursorAtGift}
			class:demo-tap-active={heroDemoPhase === 'tap'}
			class:demo-owner-active={isDemoOwnerView}
			aria-hidden="true"
		>
			<div class="fan-face p-6">
				<span class="demo-owner-sticker chip">
					<span aria-hidden="true">👀</span>
					{m.landing_demo_owner_view()}
				</span>
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
				<div class="grid grid-cols-1 gap-2.5">
					{#each exampleGifts as gift, giftIndex (gift.name)}
						{@const isDemoTargetGift = giftIndex === 0}
						<div class="mock-row" class:demo-target-row={isDemoTargetGift}>
							<span class="mock-emoji">{gift.emoji}</span>
							<div class="min-w-0 flex-1">
								<div class="truncate text-(length:--text-base) font-semibold">
									{gift.name}
								</div>
								<div class="text-[12.5px] text-ink-soft">{gift.price}</div>
							</div>
							{#if isDemoTargetGift}
								<span class="demo-chip-slot">
									{#if isDemoGiftReserved}
										<span class="chip chip-filled chip-status demo-chip-pop"
											>{m.landing_status_reserved()}</span
										>
									{:else}
										<span class="chip chip-status"
											>{m.landing_status_free()}</span
										>
									{/if}
									{#if heroDemoPhase === 'reserved'}
										<span class="demo-burst">
											<span></span><span></span><span></span><span
											></span><span></span><span></span>
										</span>
									{/if}
								</span>
								<svg class="demo-cursor" viewBox="0 0 24 24">
									<path
										d="M6 3 L18 13 L12.5 13.6 L15.5 20 L12.8 21.2 L10 15 L6 18.5 Z"
										fill="var(--card)"
										stroke="currentColor"
										stroke-width="2"
										stroke-linejoin="round"
									/>
								</svg>
							{:else if gift.reserved}
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
		transition:
			opacity 0.35s ease,
			transform 0.35s ease;
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

	/* ── Living hero demo ─────────────────────────────────────
	   Beats driven by fan-level classes (demo-cursor-active,
	   demo-tap-active, demo-owner-active); transform/opacity only. */
	.demo-target-row {
		position: relative;
	}

	.demo-chip-slot {
		position: relative;
		display: inline-flex;
		flex: none;
	}

	/* Ghost cursor: parks below the card, drifts in to tap the chip */
	.demo-cursor {
		position: absolute;
		right: 38px;
		top: 22px;
		z-index: 1;
		width: 26px;
		color: var(--ink);
		opacity: 0;
		transform: translate(90px, 110px) rotate(18deg);
		transform-origin: 5px 4px;
		filter: drop-shadow(2px 2px 0 var(--hard-shadow));
		pointer-events: none;
		transition:
			transform 1.15s var(--ease-standard),
			opacity 0.45s ease;
	}

	.demo-cursor-active .demo-cursor {
		opacity: 1;
		transform: translate(0, 0) rotate(0deg);
	}

	.demo-tap-active .demo-cursor {
		transition:
			transform 0.16s var(--ease-standard),
			opacity 0.45s ease;
		transform: translate(0, 0) rotate(0deg) scale(0.82);
	}

	/* Owner view: reservation chips vanish, sticker + note explain why */
	.demo-owner-active .chip-status {
		opacity: 0;
		transform: scale(0.8);
	}

	.demo-owner-sticker {
		position: absolute;
		top: -13px;
		left: 50%;
		z-index: 2;
		background: var(--accent-loud);
		color: var(--accent-loud-foreground);
		box-shadow: 3px 3px 0 var(--hard-shadow);
		opacity: 0;
		transform: translate(-50%, 8px) rotate(-2deg) scale(0.7);
		transition:
			transform 0.45s var(--ease-spring),
			opacity 0.3s ease;
	}

	.demo-owner-active .demo-owner-sticker {
		opacity: 1;
		transform: translate(-50%, 0) rotate(-2deg) scale(1);
	}

	/* Confetti burst when the chip springs to "Rezervováno" */
	.demo-burst {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.demo-burst span {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--accent-loud);
		box-shadow: 1.5px 1.5px 0 var(--hard-shadow);
		opacity: 0;
	}

	.demo-burst span:nth-child(1) {
		--spark-x: -38px;
		--spark-y: -30px;
	}

	.demo-burst span:nth-child(2) {
		--spark-x: 30px;
		--spark-y: -34px;

		background: var(--brand);
	}

	.demo-burst span:nth-child(3) {
		--spark-x: 50px;
		--spark-y: -20px;
	}

	.demo-burst span:nth-child(4) {
		--spark-x: -50px;
		--spark-y: 18px;

		background: var(--brand);
	}

	.demo-burst span:nth-child(5) {
		--spark-x: -16px;
		--spark-y: 34px;
	}

	.demo-burst span:nth-child(6) {
		--spark-x: 22px;
		--spark-y: 32px;

		background: var(--brand);
	}

	@media (prefers-reduced-motion: no-preference) {
		.demo-chip-pop {
			animation: demo-chip-pop 0.5s var(--ease-spring) backwards;
		}

		.demo-burst span {
			animation: demo-spark 0.8s ease-out forwards;
		}

		.demo-owner-active .mock-note {
			animation: demo-note-wiggle 1s ease-in-out 0.35s;
		}
	}

	@keyframes demo-chip-pop {
		from {
			transform: scale(0.4) rotate(-6deg);
		}

		to {
			transform: scale(1) rotate(0deg);
		}
	}

	@keyframes demo-spark {
		0% {
			opacity: 1;
			transform: translate(
					calc(-50% + var(--spark-x) * 0.4),
					calc(-50% + var(--spark-y) * 0.4)
				)
				scale(1);
		}

		60% {
			opacity: 0.9;
		}

		100% {
			opacity: 0;
			transform: translate(calc(-50% + var(--spark-x)), calc(-50% + var(--spark-y)))
				scale(0.3);
		}
	}

	@keyframes demo-note-wiggle {
		0%,
		100% {
			transform: rotate(-2deg);
		}

		25% {
			transform: rotate(1.6deg) scale(1.04);
		}

		55% {
			transform: rotate(-4.2deg);
		}

		80% {
			transform: rotate(-0.6deg);
		}
	}

	/* ── Living sky (behind hero content only) ───────────────── */
	.sky-layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	/* Light mode: soft clouds drifting at different speeds (parallax) */
	.sky-cloud {
		position: absolute;
		left: -240px;
		color: #fff;
		fill: currentcolor;
	}

	:global(.dark) .sky-cloud {
		display: none;
	}

	.sky-cloud-1 {
		top: 9%;
		width: 210px;
		opacity: 0.75;
	}

	.sky-cloud-2 {
		top: 36%;
		width: 150px;
		opacity: 0.55;
	}

	.sky-cloud-3 {
		top: 64%;
		width: 115px;
		opacity: 0.4;
	}

	/* Dark mode: twinkling stars + an occasional shooting star */
	.sky-star {
		position: absolute;
		display: none;
		width: var(--star-size, 3px);
		height: var(--star-size, 3px);
		border-radius: 999px;
		background: #fff;
		box-shadow: 0 0 6px rgb(255 255 255 / 60%);
		opacity: 0.35;
	}

	:global(.dark) .sky-star {
		display: block;
	}

	.sky-shooting-star {
		position: absolute;
		top: 14%;
		right: 6%;
		display: none;
		width: 110px;
		height: 2px;
		border-radius: 999px;
		background: linear-gradient(90deg, #fff, transparent);
		opacity: 0;
		transform: rotate(-32deg);
	}

	:global(.dark) .sky-shooting-star {
		display: block;
	}

	@media (prefers-reduced-motion: no-preference) {
		.sky-cloud-1 {
			animation: sky-cloud-drift 75s linear -18s infinite;
		}

		.sky-cloud-2 {
			animation: sky-cloud-drift 105s linear -63s infinite;
		}

		.sky-cloud-3 {
			animation: sky-cloud-drift 135s linear -108s infinite;
		}

		.sky-star {
			animation: sky-star-twinkle var(--twinkle-duration, 2.8s) ease-in-out
				var(--twinkle-delay, 0s) infinite alternate;
		}

		.sky-shooting-star {
			animation: sky-shooting-star 13s linear 3s infinite;
		}
	}

	@keyframes sky-cloud-drift {
		from {
			transform: translateX(0);
		}

		to {
			transform: translateX(calc(100vw + 480px));
		}
	}

	@keyframes sky-star-twinkle {
		from {
			opacity: 0.15;
			transform: scale(0.75);
		}

		to {
			opacity: 0.95;
			transform: scale(1.2);
		}
	}

	@keyframes sky-shooting-star {
		0% {
			opacity: 0;
			transform: rotate(-32deg) translateX(0);
		}

		1.5% {
			opacity: 0.9;
		}

		7% {
			opacity: 0;
			transform: rotate(-32deg) translateX(-300px);
		}

		100% {
			opacity: 0;
			transform: rotate(-32deg) translateX(-300px);
		}
	}
</style>
