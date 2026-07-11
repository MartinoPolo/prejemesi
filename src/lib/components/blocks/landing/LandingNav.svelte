<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import DarkModeToggle from '$lib/components/derived/dark-mode-toggle/DarkModeToggle.svelte';
	import LanguageToggle from '$lib/components/derived/language-toggle/LanguageToggle.svelte';
	import PaletteSwitcher from '$lib/components/derived/palette-switcher/PaletteSwitcher.svelte';
	import LogoMark from '$lib/components/blocks/navbar/LogoMark.svelte';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';
</script>

<nav
	class="landing-nav sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur-lg"
	aria-label={m.landing_nav_label()}
>
	<div
		class="mx-auto flex h-16 w-full max-w-[var(--content-max-width)] items-center justify-between px-4 md:px-8"
	>
		<LogoMark />
		<div class="flex items-center gap-2">
			<PaletteSwitcher />
			<DarkModeToggle />
			<LanguageToggle variant="icon" />
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
