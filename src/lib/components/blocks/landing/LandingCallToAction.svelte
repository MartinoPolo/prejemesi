<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import * as m from '$lib/paraglide/messages.js';
</script>

<section class="border-b border-border bg-background" aria-label={m.landing_cta_label()}>
	<div
		class="mx-auto flex max-w-[var(--content-max-width)] flex-col items-start justify-between gap-6 px-4 py-10 md:flex-row md:items-center md:px-8 md:py-12"
	>
		<div class="max-w-2xl">
			<span class="section-eyebrow">{m.landing_cta_eyebrow()}</span>
			<h2 class="section-headline !mb-0">{m.landing_cta_title()}</h2>
			<p class="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">
				{m.landing_cta_description()}
			</p>
		</div>

		<Button size="lg" href={resolve('/register')} class="w-full sm:w-auto">
			<GiftIcon data-icon="inline-start" />
			{m.landing_hero_cta()}
		</Button>
	</div>
</section>
