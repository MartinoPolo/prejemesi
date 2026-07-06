<script lang="ts">
	import LogoMark from '$lib/components/blocks/navbar/LogoMark.svelte';
	import GithubBrandIcon from './GithubBrandIcon.svelte';
	import * as m from '$lib/paraglide/messages.js';
</script>

<footer class="border-t border-border bg-muted/70" aria-label={m.landing_footer_label()}>
	<div
		class="mx-auto grid max-w-[var(--content-max-width)] gap-6 px-4 py-8 md:grid-cols-[1fr_auto] md:px-8"
	>
		<div class="flex flex-col gap-3">
			<LogoMark />
			<p class="max-w-xl text-sm leading-relaxed text-muted-foreground">
				{m.landing_footer_author()}
			</p>
		</div>

		<nav
			class="flex flex-wrap items-center gap-2 md:justify-end"
			aria-label={m.landing_footer_nav_label()}
		>
			<a
				href="https://github.com/MartinoPolo/prejemesi"
				target="_blank"
				rel="noreferrer"
				class="footer-link"
			>
				<GithubBrandIcon class="size-4" />
				{m.landing_footer_github()}
			</a>
		</nav>
	</div>
</footer>

<style>
	.footer-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		border-radius: var(--radius-lg);
		color: var(--foreground);
		padding: 0.5rem 0.75rem;
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		text-decoration: none;
		transition:
			background-color var(--duration-normal) var(--ease),
			color var(--duration-normal) var(--ease);
	}

	.footer-link:hover {
		background: var(--accent);
		color: var(--accent-foreground);
	}
</style>
