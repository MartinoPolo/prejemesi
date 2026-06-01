<script lang="ts">
	import { resolve } from '$app/paths';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import * as m from '$lib/paraglide/messages.js';
</script>

<footer class="border-t border-border bg-muted" aria-label={m.landing_footer_label()}>
	<div
		class="mx-auto flex max-w-[var(--content-max-width)] flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between md:px-8"
	>
		<!-- Logo -->
		<a
			class="flex items-center gap-2 font-heading font-bold text-primary no-underline hover:opacity-80"
			href={resolve('/')}
			aria-label={m.landing_footer_homepage()}
		>
			<span
				class="flex size-6 items-center justify-center rounded-sm bg-primary/10 text-primary"
			>
				<GiftIcon class="size-3.5" />
			</span>
			<span>darecky<span class="font-medium opacity-40">.cz</span></span>
		</a>

		<!-- Links -->
		<nav class="flex items-center gap-1" aria-label={m.landing_footer_nav_label()}>
			<a
				href={resolve('/login')}
				class="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground no-underline transition-all hover:bg-accent hover:text-foreground"
			>
				{m.landing_login()}
			</a>
			<span class="text-sm text-border" aria-hidden="true">·</span>
			<a
				href={resolve('/register')}
				class="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground no-underline transition-all hover:bg-accent hover:text-foreground"
			>
				{m.landing_footer_create_account()}
			</a>
		</nav>

		<!-- Copyright -->
		<div class="text-sm text-muted-foreground/70">
			&copy; {new Date().getFullYear()} Darecky
		</div>
	</div>
</footer>
