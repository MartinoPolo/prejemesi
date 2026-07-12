<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';
</script>

<section class="bg-stripes text-center" aria-label={m.landing_cta_label()}>
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 py-16 md:px-8 md:py-24">
		<div
			class="rounded-panel border-ink bg-card relative mx-auto max-w-[720px] border-[2.5px] px-6 py-12 shadow-sticker md:px-10 md:py-16"
		>
			<span class="free-sticker motion-safe:animate-bob">
				{m.landing_cta_free_sticker()}
				<span aria-hidden="true">✨</span>
			</span>
			<h2 class="mb-4 text-[clamp(30px,4vw,42px)] font-semibold leading-[1.15]">
				{m.landing_cta_title()}
			</h2>
			<p class="mb-8 text-[17px] leading-relaxed text-ink-soft">
				{m.landing_cta_description()}
			</p>
			<Button
				size="lg"
				class="h-12 px-5 text-[16px]"
				href={localizeInternalHref(resolve('/register'))}
			>
				<GiftIcon data-icon="inline-start" />
				{m.landing_hero_cta()}
			</Button>
		</div>
	</div>
</section>

<style>
	/* Sunshine sticker pinned to the card corner, bobbing gently */
	.free-sticker {
		position: absolute;
		top: -22px;
		right: -14px;
		background: var(--accent-loud);
		color: var(--accent-loud-foreground);
		border: var(--border-w) solid var(--ink);
		border-radius: 999px;
		font-family: var(--font-head);
		font-size: 15px;
		padding: 10px 18px;
		transform: rotate(6deg);
		box-shadow: 4px 4px 0 var(--hard-shadow);

		--rot: 6deg;
	}

	@media (width < 640px) {
		.free-sticker {
			right: 4px;
		}
	}
</style>
