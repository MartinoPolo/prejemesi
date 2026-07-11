<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import AppearanceMenu from '$lib/components/derived/appearance-menu/AppearanceMenu.svelte';
	import DarkModeToggle from '$lib/components/derived/dark-mode-toggle/DarkModeToggle.svelte';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
	import PaletteSwitcher from '$lib/components/derived/palette-switcher/PaletteSwitcher.svelte';
	import LogoMark from '$lib/components/blocks/navbar/LogoMark.svelte';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';

	// Desktop-only section anchors (no landing hamburger — DECISIONS.md).
	const ANCHOR_LINKS = [
		{ label: m.landing_nav_how(), href: '#jak-to-funguje' },
		{ label: m.landing_nav_benefits(), href: '#vyhody' },
	] as const;
</script>

<nav
	class="landing-nav sticky top-0 z-30 border-b-(length:--border-w) border-ink bg-card"
	aria-label={m.landing_nav_label()}
>
	<div
		class="mx-auto flex h-16 w-full max-w-[var(--content-max-width)] items-center gap-3 px-4 md:px-8"
	>
		<LogoMark />

		<div class="hidden items-center gap-1.5 md:flex">
			{#each ANCHOR_LINKS as link (link.href)}
				<a
					class="rounded-[9px] px-3.5 py-2 text-(length:--text-lg) font-medium text-ink transition-colors hover:bg-accent"
					href={link.href}
				>
					{link.label}
				</a>
			{/each}
		</div>

		<div class="ml-auto flex items-center gap-2">
			<!-- ≥768px: separate controls; below: one consolidated popover (DECISIONS.md). -->
			<div class="hidden items-center gap-1 md:flex">
				<PaletteSwitcher />
				<DarkModeToggle />
				<LanguageToggle variant="icon" />
			</div>
			<div class="md:hidden">
				<AppearanceMenu />
			</div>
			<Button intent="ghost" size="sm" href={localizeInternalHref(resolve('/login'))}
				>{m.landing_login()}</Button
			>
			<Button class="hidden sm:inline-flex" href={localizeInternalHref(resolve('/register'))}
				>{m.register()}</Button
			>
		</div>
	</div>
</nav>

<style>
	@media (width >= 1280px) {
		.landing-nav :global(.logo) {
			font-size: var(--text-2xl);
		}

		.landing-nav :global(.logo-tld) {
			font-size: var(--text-xl);
		}

		.landing-nav :global(.logo-icon-wrap) {
			width: 36px;
			height: 36px;
			border-radius: var(--radius-lg);
		}

		.landing-nav :global(.logo-icon-wrap svg) {
			width: 20px;
			height: 20px;
		}
	}
</style>
