<script lang="ts">
	import GiftIcon from '@lucide/svelte/icons/gift';
	import ListIcon from '@lucide/svelte/icons/list';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import * as m from '$lib/paraglide/messages.js';
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
			{#each [{ icon: ListIcon, title: m.landing_how_step1_title(), description: m.landing_how_step1_description() }, { icon: GiftIcon, title: m.landing_how_step2_title(), description: m.landing_how_step2_description() }, { icon: Share2Icon, title: m.landing_how_step3_title(), description: m.landing_how_step3_description() }, { icon: SparklesIcon, title: m.landing_how_step4_title(), description: m.landing_how_step4_description() }] as step, index (step.title)}
				<div class="flex flex-col items-center gap-4 text-center">
					<div
						class="group relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background text-primary transition-all hover:border-primary hover:bg-[color-mix(in_oklab,var(--primary)_10%,var(--background))]"
					>
						<span
							class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
						>
							{index + 1}
						</span>
						<step.icon class="size-6" />
					</div>
					<div class="font-heading text-lg font-semibold tracking-snug">{step.title}</div>
					<div class="text-sm leading-relaxed text-muted-foreground">
						{step.description}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	@media (width >= 1024px) {
		.how-steps::before {
			content: '';
			position: absolute;
			top: 28px;
			left: calc(12.5% + 28px);
			right: calc(12.5% + 28px);
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
