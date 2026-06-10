<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import LinkIcon from '@lucide/svelte/icons/link';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';
	import * as m from '$lib/paraglide/messages.js';
</script>

<div class="border-b border-border bg-muted">
	<section
		class="mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
		aria-label={m.landing_feat2_label()}
	>
		<!-- Visual first on desktop (reversed order) -->
		<div class="feat-visual order-2 md:order-1">
			<div class="mb-1 text-sm font-semibold">{m.landing_feat2_link_label()}</div>
			<div class="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
				<LinkIcon class="size-4 shrink-0 text-muted-foreground/70" />
				<span class="flex-1 truncate font-mono text-sm text-primary">
					prejemesi.cz/w/martina-vanocni-2026
				</span>
				<Button intent="secondary" size="sm" class="shrink-0"
					>{m.landing_feat2_copy()}</Button
				>
			</div>

			<div class="mt-1 text-sm font-semibold">{m.landing_feat2_share_via()}</div>
			<div class="grid grid-cols-4 gap-2">
				{#each [{ label: 'WhatsApp', emoji: '💬' }, { label: 'Email', emoji: '✉️' }, { label: 'Messenger', emoji: '📱' }, { label: 'Telegram', emoji: '✈️' }] as app (app.label)}
					<div
						class="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 text-xs font-medium text-muted-foreground transition-all hover:border-border hover:bg-muted"
					>
						<span class="text-[22px]">{app.emoji}</span>
						<span>{app.label}</span>
					</div>
				{/each}
			</div>

			<div
				class="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary"
			>
				<UserCheckIcon class="size-4 shrink-0" />
				{m.landing_feat2_no_account()}
			</div>
		</div>

		<!-- Text -->
		<div class="order-1 flex flex-col gap-5 md:order-2">
			<div class="feat-number" aria-hidden="true">02</div>
			<div class="section-eyebrow !mb-0 flex items-center gap-2">
				<Share2Icon class="size-3.5" />
				{m.landing_feat2_eyebrow()}
			</div>
			<h2
				class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl"
			>
				{m.landing_feat2_title()}
			</h2>
			<p class="text-lg leading-relaxed text-muted-foreground">
				{m.landing_feat2_description()}
			</p>
			<ul class="flex flex-col gap-3">
				{#each [m.landing_feat2_check1(), m.landing_feat2_check2(), m.landing_feat2_check3()] as item (item)}
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
