<script lang="ts">
	import GiftIcon from '@lucide/svelte/icons/gift';
	import ListIcon from '@lucide/svelte/icons/list';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import * as m from '$lib/paraglide/messages.js';

	const steps = [
		{
			icon: ListIcon,
			title: m.landing_how_step1_title(),
			description: m.landing_how_step1_description(),
		},
		{
			icon: GiftIcon,
			title: m.landing_how_step2_title(),
			description: m.landing_how_step2_description(),
		},
		{
			icon: Share2Icon,
			title: m.landing_how_step3_title(),
			description: m.landing_how_step3_description(),
		},
		{
			icon: SparklesIcon,
			title: m.landing_how_step4_title(),
			description: m.landing_how_step4_description(),
		},
	] as const;
</script>

<section
	class="border-b border-border bg-background"
	id="jak-to-funguje"
	aria-label={m.landing_how_section_label()}
>
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 py-16 md:px-8 md:py-20">
		<span class="section-eyebrow">{m.landing_how_eyebrow()}</span>
		<h2 class="section-headline">{m.landing_how_headline()}</h2>

		<div class="how-steps relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
			{#each steps as step, index (step.title)}
				<article class="flex flex-col items-center gap-4 text-center">
					<div class="step-icon-wrap">
						<span class="step-number">{index + 1}</span>
						<step.icon class="size-6" />
					</div>
					<h3 class="font-heading text-lg font-semibold">{step.title}</h3>
					<p class="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
				</article>
			{/each}
		</div>
	</div>
</section>

<style>
	.step-icon-wrap {
		position: relative;
		display: flex;
		width: 3.5rem;
		height: 3.5rem;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--border);
		border-radius: 9999px;
		background: var(--background);
		color: var(--primary);
	}

	.step-number {
		position: absolute;
		top: -0.375rem;
		right: -0.375rem;
		display: flex;
		width: 1.25rem;
		height: 1.25rem;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: var(--primary);
		color: var(--primary-foreground);
		font-size: 11px;
		font-weight: var(--weight-bold);
	}

	@media (width >= 1024px) {
		.how-steps::before {
			content: '';
			position: absolute;
			top: 28px;
			right: calc(12.5% + 28px);
			left: calc(12.5% + 28px);
			height: 2px;
			background: linear-gradient(
				90deg,
				var(--border) 0%,
				var(--primary) 40%,
				var(--primary) 60%,
				var(--border) 100%
			);
		}
	}
</style>
