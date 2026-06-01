<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import * as m from '$lib/paraglide/messages.js';
</script>

<div class="border-b border-border">
	<section
		class="mx-auto grid max-w-[var(--content-max-width)] items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-20"
		aria-label={m.landing_feat3_label()}
	>
		<div class="flex flex-col gap-5">
			<div class="feat-number" aria-hidden="true">03</div>
			<div class="section-eyebrow !mb-0 flex items-center gap-2">
				<PaletteIcon class="size-3.5" />
				{m.landing_feat3_eyebrow()}
			</div>
			<h2
				class="font-heading text-3xl font-extrabold leading-snug tracking-tight md:text-4xl"
			>
				{m.landing_feat3_title()}
			</h2>
			<p class="text-lg leading-relaxed text-muted-foreground">
				{m.landing_feat3_description()}
			</p>
			<ul class="flex flex-col gap-3">
				{#each [m.landing_feat3_check1(), m.landing_feat3_check2(), m.landing_feat3_check3()] as item (item)}
					<li class="flex items-start gap-3 leading-relaxed text-muted-foreground">
						<CheckIcon class="mt-0.5 size-[18px] shrink-0 text-primary" />
						{item}
					</li>
				{/each}
			</ul>
		</div>

		<!-- Visual: theme swatches -->
		<div class="feat-visual">
			<div class="mb-2 text-sm font-semibold">{m.landing_feat3_choose_theme()}</div>
			<div class="grid grid-cols-3 gap-3">
				{#each [{ name: 'default', label: m.theme_default(), emoji: '🌿', hue: '150', active: true }, { name: 'christmas', label: m.theme_christmas(), emoji: '🎄', hue: '20', active: false }, { name: 'birthday', label: m.theme_birthday(), emoji: '🎂', hue: '55', active: false }, { name: 'elegant', label: m.theme_elegant(), emoji: '💍', hue: '270', active: false }, { name: 'fun', label: m.theme_fun(), emoji: '🎉', hue: '340', active: false }, { name: 'custom', label: m.landing_feat3_custom(), emoji: '🎨', hue: '', active: false }] as theme (theme.name)}
					<div
						class="flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition-all {theme.active
							? 'border-primary shadow-[0_0_0_3px_oklch(from_var(--primary)_l_c_h_/_0.2)]'
							: theme.name === 'custom'
								? 'border-dashed border-border'
								: 'border-transparent'} {theme.hue ? 'theme-swatch' : 'bg-muted'}"
						style={theme.hue ? `--swatch-hue: ${theme.hue}deg` : ''}
					>
						<span class="text-[22px]">{theme.emoji}</span>
						<span class="text-xs font-semibold">{theme.label}</span>
					</div>
				{/each}
			</div>

			<!-- Theme preview -->
			<div class="theme-preview-card mt-4 rounded-xl p-4">
				<div class="theme-preview-title font-heading text-lg font-extrabold">
					{m.landing_feat3_preview_title()}
				</div>
				<div class="theme-preview-subtitle mt-1 text-sm">
					{m.landing_feat3_preview_subtitle()}
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

	.theme-swatch {
		background: linear-gradient(
			135deg,
			oklch(92% 0.04 var(--swatch-hue)),
			oklch(96% 0.02 var(--swatch-hue))
		);
	}

	:global(.dark) .theme-swatch {
		background: linear-gradient(
			135deg,
			oklch(25% 0.03 var(--swatch-hue)),
			oklch(30% 0.02 var(--swatch-hue))
		);
	}

	.theme-preview-card {
		background: linear-gradient(135deg, oklch(92% 0.04 150deg), oklch(96% 0.02 150deg));
	}

	:global(.dark) .theme-preview-card {
		background: linear-gradient(135deg, oklch(25% 0.03 150deg), oklch(30% 0.02 150deg));
	}

	.theme-preview-title {
		color: oklch(35% 0.08 150deg);
	}

	:global(.dark) .theme-preview-title {
		color: oklch(78% 0.06 150deg);
	}

	.theme-preview-subtitle {
		color: oklch(45% 0.06 150deg);
	}

	:global(.dark) .theme-preview-subtitle {
		color: oklch(68% 0.04 150deg);
	}
</style>
