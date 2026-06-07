<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
</script>

<section
	class="relative overflow-hidden border-t border-border bg-background"
	aria-label={m.landing_cta_label()}
>
	<!-- Decorative blob -->
	<div
		class="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2"
		style="background: radial-gradient(ellipse, oklch(52.7% 0.154 150deg / 6%) 0%, transparent 70%)"
		aria-hidden="true"
	></div>

	<div
		class="relative z-[1] mx-auto flex max-w-[680px] flex-col items-center gap-6 px-4 py-16 text-center md:px-8 md:py-20"
	>
		<span class="section-eyebrow">{m.landing_cta_eyebrow()}</span>
		<h2 class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl">
			{m.landing_cta_title()}
		</h2>
		<p class="text-lg leading-relaxed text-muted-foreground md:text-xl">
			{m.landing_cta_description()}
		</p>
		<div class="flex flex-wrap justify-center gap-4">
			<Button size="lg" href={resolve('/register')} class="min-w-[220px]">
				{m.register()}
			</Button>
			<Button intent="secondary" size="lg" href={resolve('/login')}
				>{m.landing_login()}</Button
			>
		</div>
		<div
			class="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground/70"
		>
			<span>{m.landing_badge_free()}</span>
			<span class="opacity-35" aria-hidden="true">·</span>
			<span>{m.landing_cta_no_card()}</span>
			<span class="opacity-35" aria-hidden="true">·</span>
			<span>{m.landing_cta_surprise()}</span>
		</div>
	</div>
</section>
