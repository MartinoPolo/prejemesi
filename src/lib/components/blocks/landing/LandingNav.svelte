<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import DarkModeToggle from '$lib/components/derived/dark-mode-toggle/DarkModeToggle.svelte';
	import LogoMark from '$lib/components/blocks/navbar/LogoMark.svelte';
	import * as m from '$lib/paraglide/messages.js';
</script>

<nav
	class="sticky top-0 z-30 flex h-[var(--nav-height)] items-center justify-between border-b border-border bg-background/92 px-6 backdrop-blur-lg md:px-8"
	aria-label={m.landing_nav_label()}
>
	<LogoMark />
	<div class="flex items-center gap-2">
		<DarkModeToggle />
		<Button intent="ghost" href={resolve('/login')}>{m.landing_login()}</Button>
		<Button href={resolve('/register')}>{m.landing_get_started()}</Button>
	</div>
</nav>
