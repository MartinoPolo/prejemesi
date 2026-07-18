<script lang="ts">
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
		<div class="mx-auto max-w-[640px] text-center">
			<span class="section-eyebrow">
				<span aria-hidden="true">📒</span>
				{m.landing_how_eyebrow()}
			</span>
			<h2 class="section-headline">{m.landing_how_headline()}</h2>
		</div>

		<div class="steps-grid grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
			{#each steps as step, index (step.title)}
				<article
					class="step rounded-panel border-ink bg-card border-[2.5px] p-6 shadow-sticker"
				>
					<div class="step-num font-heading mb-2.5 flex items-center gap-2.5 text-brand">
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

	.step {
		transition: transform 0.2s ease;
	}

	/* Playful alternating tilt, kept during the hover lift */
	.step:nth-child(odd) {
		transform: rotate(-0.6deg);
	}

	.step:nth-child(even) {
		transform: rotate(0.5deg);
	}

	.step:nth-child(odd):hover {
		transform: rotate(-0.6deg) translateY(-4px);
	}

	.step:nth-child(even):hover {
		transform: rotate(0.5deg) translateY(-4px);
	}

	/* Staggered pop-in on load (mockup .steps-grid reveal) */
	@media (prefers-reduced-motion: no-preference) {
		.steps-grid > * {
			animation: pop-in 0.55s cubic-bezier(0.34, 1.4, 0.64, 1) backwards;
		}

		.steps-grid > :nth-child(2) {
			animation-delay: 0.1s;
		}

		.steps-grid > :nth-child(3) {
			animation-delay: 0.2s;
		}

		.steps-grid > :nth-child(4) {
			animation-delay: 0.3s;
		}
	}
</style>
