<script lang="ts">
	import { revealOnView } from '$lib/motion/reveal_on_view.js';
	import * as m from '$lib/paraglide/messages.js';

	const steps = [
		{
			emoji: '📝',
			title: m.landing_how_step1_title(),
			description: m.landing_how_step1_description(),
		},
		{
			emoji: '🎁',
			title: m.landing_how_step2_title(),
			description: m.landing_how_step2_description(),
		},
		{
			emoji: '🔗',
			title: m.landing_how_step3_title(),
			description: m.landing_how_step3_description(),
		},
		{
			emoji: '🤫',
			title: m.landing_how_step4_title(),
			description: m.landing_how_step4_description(),
		},
	] as const;
</script>

<section
	class="bg-ruled scroll-mt-16"
	id="jak-to-funguje"
	aria-label={m.landing_how_section_label()}
>
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 py-16 md:px-8 md:py-24">
		<div class="reveal mx-auto max-w-[640px] text-center" {@attach revealOnView}>
			<span class="section-eyebrow">
				<span aria-hidden="true">📒</span>
				{m.landing_how_eyebrow()}
			</span>
			<h2 class="section-headline">{m.landing_how_headline()}</h2>
		</div>

		<div class="steps-grid grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
			{#each steps as step, index (step.title)}
				<article
					class="step rounded-panel border-edge bg-card border-[2.5px] p-6 shadow-sticker"
					{@attach revealOnView}
				>
					<div
						class="step-num font-heading mb-2.5 flex items-center gap-2.5 text-brand-link"
					>
						{index + 1}.
						<span aria-hidden="true">{step.emoji}</span>
					</div>
					<h3 class="mb-2 text-[19px] font-semibold">{step.title}</h3>
					<p class="text-(length:--text-lg) leading-relaxed text-muted-foreground">
						{step.description}
					</p>
				</article>
			{/each}
		</div>
	</div>
</section>

<style>
	.step-num {
		font-size: 34px;
		font-weight: 700;
	}

	/* Playful alternating tilt on `rotate`, so the pop-in and hover lift on `transform` keep it */
	.step {
		transition: transform 0.2s ease;
	}

	.step:nth-child(odd) {
		rotate: -0.6deg;
	}

	.step:nth-child(even) {
		rotate: 0.5deg;
	}

	@media (hover: hover) and (prefers-reduced-motion: no-preference) {
		.step:hover {
			transform: translateY(-4px);
		}
	}

	/* Cards pop in one reveal step apart, after the section heading */
	@media (prefers-reduced-motion: no-preference) {
		.steps-grid > * {
			animation: var(--animate-pop-in);
			animation-delay: var(--duration-reveal-stagger);
		}

		.steps-grid > :nth-child(2) {
			animation-delay: calc(var(--duration-reveal-stagger) * 2);
		}

		.steps-grid > :nth-child(3) {
			animation-delay: calc(var(--duration-reveal-stagger) * 3);
		}

		.steps-grid > :nth-child(4) {
			animation-delay: calc(var(--duration-reveal-stagger) * 4);
		}
	}
</style>
