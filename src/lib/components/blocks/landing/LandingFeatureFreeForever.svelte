<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import HeartIcon from '@lucide/svelte/icons/heart';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import LockIcon from '@lucide/svelte/icons/lock';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';
	import * as m from '$lib/paraglide/messages.js';
</script>

<div class="border-b border-border bg-muted">
	<section
		class="mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
		aria-label={m.landing_feat4_label()}
	>
		<!-- Visual first on desktop (reversed) -->
		<div class="feat-visual order-2 md:order-1">
			<div class="flex flex-col gap-4">
				{#each [{ icon: ShieldCheckIcon, title: m.landing_feat4_trust_free_title(), sub: m.landing_feat4_trust_free_sub() }, { icon: EyeOffIcon, title: m.landing_feat4_trust_noads_title(), sub: m.landing_feat4_trust_noads_sub() }, { icon: UserCheckIcon, title: m.landing_feat4_trust_noreg_title(), sub: m.landing_feat4_trust_noreg_sub() }, { icon: LockIcon, title: m.landing_feat4_trust_surprise_title(), sub: m.landing_feat4_trust_surprise_sub() }] as trust (trust.title)}
					<div
						class="flex items-start gap-4 rounded-xl border border-border bg-background p-4 transition-all hover:border-border hover:shadow-md"
					>
						<div
							class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
						>
							<trust.icon class="size-5" />
						</div>
						<div class="flex-1">
							<div class="font-semibold">{trust.title}</div>
							<div class="mt-0.5 text-sm leading-relaxed text-muted-foreground">
								{trust.sub}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Text -->
		<div class="order-1 flex flex-col gap-5 md:order-2">
			<div class="feat-number" aria-hidden="true">04</div>
			<div class="section-eyebrow !mb-0 flex items-center gap-2">
				<HeartIcon class="size-3.5" />
				{m.landing_feat4_eyebrow()}
			</div>
			<h2
				class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl"
			>
				{m.landing_feat4_title()}
			</h2>
			<p class="text-lg leading-relaxed text-muted-foreground">
				{m.landing_feat4_description()}
			</p>
			<ul class="flex flex-col gap-3">
				{#each [m.landing_feat4_check1(), m.landing_feat4_check2(), m.landing_feat4_check3()] as item (item)}
					<li class="flex items-start gap-3 leading-relaxed text-muted-foreground">
						<CheckIcon class="mt-0.5 size-[18px] shrink-0 text-primary" />
						{item}
					</li>
				{/each}
			</ul>
		</div>
	</section>
</div>

<style>
	.feat-number {
		font-family: var(--font-heading);
		font-size: 80px;
		font-weight: 800;
		line-height: 1;
		color: oklch(from var(--primary) l c h / 15%);
		letter-spacing: -0.04em;
		user-select: none;
	}

	.feat-visual {
		border-radius: var(--radius-3xl);
		overflow: hidden;
		background: oklch(from var(--primary) 94% 0.035 h);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-xl);
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	:global(.dark) .feat-visual {
		background: oklch(from var(--primary) 22% 0.015 h);
	}
</style>
