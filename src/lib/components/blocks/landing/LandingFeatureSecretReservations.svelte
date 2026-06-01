<script lang="ts">
	import { Button } from '$lib/components/base/button/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import LockIcon from '@lucide/svelte/icons/lock';
	import * as m from '$lib/paraglide/messages.js';
</script>

<div class="border-b border-border">
	<section
		class="mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
		aria-label={m.landing_feat1_label()}
	>
		<div class="flex flex-col gap-5">
			<div class="feat-number" aria-hidden="true">01</div>
			<div class="section-eyebrow !mb-0 flex items-center gap-2">
				<EyeOffIcon class="size-3.5" />
				{m.landing_feat1_eyebrow()}
			</div>
			<h2
				class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl"
			>
				{m.landing_feat1_title()}
			</h2>
			<p class="text-lg leading-relaxed text-muted-foreground">
				{m.landing_feat1_description()}
			</p>
			<ul class="flex flex-col gap-3">
				{#each [m.landing_feat1_check1(), m.landing_feat1_check2(), m.landing_feat1_check3()] as item (item)}
					<li class="flex items-start gap-3 leading-relaxed text-muted-foreground">
						<CheckIcon class="mt-0.5 size-[18px] shrink-0 text-primary" />
						{item}
					</li>
				{/each}
			</ul>
		</div>

		<!-- Visual: owner vs. gifter view -->
		<div class="feat-visual">
			<div class="mb-1 text-sm font-semibold">{m.landing_feat1_visual_title()}</div>

			<!-- Owner view -->
			<div class="flex flex-col gap-2">
				<span class="view-label">{m.landing_feat1_owner_view()}</span>
				{#each [{ emoji: '🎧', name: m.landing_gift_headphones(), sub: '7 490 Kč · alza.cz' }, { emoji: '📖', name: 'Sapiens — Y.N. Harari', sub: '399 Kč' }] as gift (gift.name)}
					<div
						class="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
					>
						<div
							class="feat-emoji-icon flex size-10 shrink-0 items-center justify-center rounded-md text-xl"
							style="

--icon-hue: 240deg"
						>
							{gift.emoji}
						</div>
						<div class="flex-1">
							<div class="text-sm font-semibold">{gift.name}</div>
							<div class="mt-0.5 text-xs text-muted-foreground/70">{gift.sub}</div>
						</div>
						<span
							class="feat-status-badge shrink-0 select-none rounded-full border px-2.5 py-0.5 text-[11px] font-medium blur-[5px]"
							aria-hidden="true"
						>
							{m.landing_feat1_hidden()}
						</span>
					</div>
				{/each}
				<div
					class="flex items-center justify-center gap-1.5 p-2 text-xs text-muted-foreground/70"
				>
					<LockIcon class="size-3.5" />
					{m.landing_feat1_hidden_note()}
				</div>
			</div>

			<!-- Gifter view -->
			<div class="mt-2 flex flex-col gap-2">
				<span class="view-label view-label-visitor">{m.landing_feat1_gifter_view()}</span>
				<div
					class="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
				>
					<div
						class="feat-emoji-icon flex size-10 shrink-0 items-center justify-center rounded-md text-xl"
						style="

--icon-hue: 240deg"
					>
						🎧
					</div>
					<div class="flex-1">
						<div class="text-sm font-semibold">{m.landing_gift_headphones()}</div>
						<div class="mt-0.5 text-xs text-muted-foreground/70">
							7 490 Kč · alza.cz
						</div>
					</div>
					<span
						class="feat-status-badge shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
					>
						{m.landing_status_reserved()}
					</span>
				</div>
				<div
					class="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
				>
					<div
						class="feat-emoji-icon flex size-10 shrink-0 items-center justify-center rounded-md text-xl"
						style="

--icon-hue: 55deg"
					>
						📖
					</div>
					<div class="flex-1">
						<div class="text-sm font-semibold">Sapiens — Y.N. Harari</div>
						<div class="mt-0.5 text-xs text-muted-foreground/70">399 Kč</div>
					</div>
					<Button size="sm" class="shrink-0">{m.landing_feat1_reserve_button()}</Button>
				</div>
			</div>
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

	.view-label {
		font-size: 10px;
		font-weight: var(--weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted-foreground);
		background: var(--muted);
		border: 1px solid var(--border);
		padding: 4px 10px;
		border-radius: var(--radius-full);
		display: inline-block;
		width: fit-content;
	}

	.view-label-visitor {
		color: var(--primary);
		background: oklch(from var(--primary) l c h / 10%);
		border-color: oklch(from var(--primary) l c h / 25%);
	}

	.feat-emoji-icon {
		background: linear-gradient(
			135deg,
			oklch(92% 0.03 var(--icon-hue)),
			oklch(95% 0.02 var(--icon-hue))
		);
	}

	:global(.dark) .feat-emoji-icon {
		background: linear-gradient(
			135deg,
			oklch(25% 0.02 var(--icon-hue)),
			oklch(30% 0.03 var(--icon-hue))
		);
	}

	.feat-status-badge {
		background: oklch(62% 0.13 145deg / 14%);
		color: oklch(62% 0.13 145deg);
		border-color: oklch(62% 0.13 145deg / 28%);
	}

	:global(.dark) .feat-status-badge {
		background: oklch(62% 0.13 145deg / 20%);
		color: oklch(72% 0.1 145deg);
		border-color: oklch(62% 0.13 145deg / 35%);
	}
</style>
