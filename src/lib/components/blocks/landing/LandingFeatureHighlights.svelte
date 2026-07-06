<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import LinkIcon from '@lucide/svelte/icons/link';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import UserCheckIcon from '@lucide/svelte/icons/user-check';
	import BrandShareIcon from './BrandShareIcon.svelte';
	import * as m from '$lib/paraglide/messages.js';

	const shareApps = [
		{ platform: 'whatsapp', label: 'WhatsApp', colorClass: 'text-[#25d366]' },
		{ platform: 'email', label: 'Email', colorClass: 'text-primary' },
		{ platform: 'messenger', label: 'Messenger', colorClass: 'text-[#0084ff]' },
		{ platform: 'telegram', label: 'Telegram', colorClass: 'text-[#26a5e4]' },
	] as const;

	const themeSwatches = [
		{ name: 'default', label: m.theme_default(), emoji: '🌿', hue: '150deg', active: true },
		{ name: 'christmas', label: m.theme_christmas(), emoji: '🎄', hue: '25deg', active: false },
		{ name: 'birthday', label: m.theme_birthday(), emoji: '🎂', hue: '55deg', active: false },
		{ name: 'elegant', label: m.theme_elegant(), emoji: '💍', hue: '270deg', active: false },
		{ name: 'fun', label: m.theme_fun(), emoji: '🎉', hue: '340deg', active: false },
		{ name: 'custom', label: m.landing_feat3_custom(), emoji: '🎨', hue: '205deg', active: false },
	] as const;
</script>

<section class="border-b border-border bg-muted/55" aria-label={m.landing_features_headline()}>
	<div class="mx-auto max-w-[var(--content-max-width)] px-4 py-12 md:px-8 md:py-16">
		<div class="mb-8 max-w-2xl">
			<span class="section-eyebrow">{m.landing_features_eyebrow()}</span>
			<h2 class="section-headline !mb-0">{m.landing_features_headline()}</h2>
		</div>

		<div class="grid min-w-0 gap-4 lg:grid-cols-3">
			<article class="highlight-panel">
				<div class="highlight-panel-header">
					<EyeOffIcon class="size-5 text-primary" />
					<div>
						<h3 class="highlight-title">{m.landing_feat1_title()}</h3>
						<p class="highlight-copy">{m.landing_feat1_description()}</p>
					</div>
				</div>

				<div class="rounded-2xl border border-border bg-background p-3">
					<div class="mb-3 flex items-center justify-between gap-3">
						<span class="view-pill">{m.landing_feat1_owner_view()}</span>
						<span class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
							<ShieldCheckIcon class="size-3.5" />
							{m.landing_feat1_hidden_note()}
						</span>
					</div>
					<div class="flex items-center gap-3 rounded-xl border border-border bg-muted/60 p-3">
						<div class="gift-preview-icon">🎧</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-semibold">{m.landing_gift_headphones()}</div>
							<div class="text-xs text-muted-foreground">7 490 Kč · alza.cz</div>
						</div>
						<span class="blurred-status" aria-hidden="true">{m.landing_feat1_hidden()}</span>
					</div>
					<div class="mt-3 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 p-3">
						<div class="gift-preview-icon gift-preview-icon-warm">📖</div>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-semibold">Sapiens</div>
							<div class="text-xs text-muted-foreground">399 Kč</div>
						</div>
						<span class="static-action-pill">{m.landing_status_reserved()}</span>
					</div>
				</div>
			</article>

			<article class="highlight-panel">
				<div class="highlight-panel-header">
					<LinkIcon class="size-5 text-primary" />
					<div>
						<h3 class="highlight-title">{m.landing_feat2_title()}</h3>
						<p class="highlight-copy">{m.landing_feat2_description()}</p>
					</div>
				</div>

				<div class="rounded-2xl border border-border bg-background p-3">
					<div class="mb-3 flex items-center gap-2 rounded-xl bg-muted/70 p-3">
						<LinkIcon class="size-4 shrink-0 text-muted-foreground" />
						<span class="min-w-0 flex-1 truncate font-mono text-xs text-primary">
							prejemesi.cz/w/martina-vanocni-2026
						</span>
						<span class="static-copy-pill">
							<CheckIcon class="size-3.5" />
							{m.landing_feat2_link_ready()}
						</span>
					</div>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
						{#each shareApps as app (app.platform)}
							<div class="share-chip">
								<BrandShareIcon platform={app.platform} class={`size-5 ${app.colorClass}`} />
								<span>{app.label}</span>
							</div>
						{/each}
					</div>
					<div class="mt-3 flex items-center gap-2 text-sm font-medium text-primary">
						<UserCheckIcon class="size-4 shrink-0" />
						{m.landing_feat2_no_account()}
					</div>
				</div>
			</article>

			<article class="highlight-panel">
				<div class="highlight-panel-header">
					<PaletteIcon class="size-5 text-primary" />
					<div>
						<h3 class="highlight-title">{m.landing_feat3_title()}</h3>
						<p class="highlight-copy">{m.landing_feat3_description()}</p>
					</div>
				</div>

				<div class="rounded-2xl border border-border bg-background p-3">
					<div class="grid grid-cols-3 gap-2">
						{#each themeSwatches as theme (theme.name)}
							<div
								class="theme-swatch rounded-xl border p-3"
								class:theme-swatch-active={theme.active}
								style={`--theme-hue: ${theme.hue}`}
							>
								<span class="text-[22px] leading-none">{theme.emoji}</span>
								<span class="mt-2 block truncate text-xs font-semibold">{theme.label}</span>
							</div>
						{/each}
					</div>
					<div class="mt-3 rounded-2xl bg-[oklch(92%_0.04_150deg)] p-4 dark:bg-[oklch(25%_0.03_150deg)]">
						<div class="font-heading text-lg font-extrabold text-[oklch(35%_0.08_150deg)] dark:text-[oklch(78%_0.06_150deg)]">
							{m.landing_feat3_preview_title()}
						</div>
						<div class="mt-1 text-sm text-[oklch(45%_0.06_150deg)] dark:text-[oklch(70%_0.04_150deg)]">
							{m.landing_feat3_preview_subtitle()}
						</div>
					</div>
				</div>
			</article>
		</div>
	</div>
</section>

<style>
	.highlight-panel {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-2xl);
		background: color-mix(in oklch, var(--background) 88%, var(--primary) 4%);
		padding: var(--space-5);
		box-shadow: var(--shadow-md);
	}

	.highlight-panel-header {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.highlight-title {
		font-family: var(--font-heading);
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
		line-height: var(--leading-tight);
	}

	.highlight-copy {
		margin-top: var(--space-1);
		color: var(--muted-foreground);
		font-size: var(--text-sm);
		line-height: var(--leading-normal);
	}

	.view-pill,
	.static-action-pill,
	.static-copy-pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		border-radius: 9999px;
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		line-height: 1;
		white-space: nowrap;
	}

	.view-pill {
		border: 1px solid var(--border);
		background: var(--muted);
		color: var(--muted-foreground);
		padding: 0.375rem 0.625rem;
		text-transform: uppercase;
		letter-spacing: var(--tracking-wider);
		font-size: 10px;
	}

	.static-action-pill {
		background: oklch(from var(--primary) l c h / 12%);
		color: var(--primary);
		padding: 0.45rem 0.625rem;
	}

	.static-copy-pill {
		background: var(--background);
		color: var(--primary);
		padding: 0.4rem 0.55rem;
	}

	.blurred-status {
		border: 1px solid oklch(from var(--primary) l c h / 28%);
		border-radius: 9999px;
		color: var(--primary);
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		padding: 0.35rem 0.625rem;
		filter: blur(4px);
		user-select: none;
	}

	.gift-preview-icon {
		display: flex;
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-xl);
		background: oklch(91% 0.04 220deg);
		font-size: 1.2rem;
	}

	.gift-preview-icon-warm {
		background: oklch(92% 0.05 55deg);
	}

	.share-chip {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--muted);
		padding: var(--space-3);
		color: var(--muted-foreground);
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
	}

	.theme-swatch {
		border-color: var(--border);
		background: linear-gradient(
			135deg,
			oklch(94% 0.04 var(--theme-hue)),
			oklch(98% 0.015 var(--theme-hue))
		);
	}

	.theme-swatch-active {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px oklch(from var(--primary) l c h / 18%);
	}

	:global(.dark) .theme-swatch {
		background: linear-gradient(
			135deg,
			oklch(26% 0.03 var(--theme-hue)),
			oklch(20% 0.015 var(--theme-hue))
		);
	}
</style>
