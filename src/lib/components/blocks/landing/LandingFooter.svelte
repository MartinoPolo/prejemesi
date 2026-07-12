<script lang="ts">
	import LogoMark from '$lib/components/blocks/navbar/LogoMark.svelte';
	import GithubBrandIcon from './GithubBrandIcon.svelte';
	import * as m from '$lib/paraglide/messages.js';
</script>

<footer class="landing-footer" aria-label={m.landing_footer_label()}>
	<svg
		class="footer-doodle motion-safe:animate-bob"
		style:animation-duration="5s"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path
			d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z"
			fill="currentColor"
		/>
	</svg>
	<div
		class="mx-auto flex max-w-[var(--content-max-width)] flex-wrap items-center gap-6 px-4 py-12 md:px-8"
	>
		<LogoMark />
		<p class="footer-tagline">
			{m.landing_footer_author()}
		</p>
		<nav
			class="ml-auto flex flex-wrap items-center gap-3"
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
			<a
				href="https://github.com/MartinoPolo/prejemesi/issues"
				target="_blank"
				rel="noopener noreferrer"
				class="footer-link"
			>
				{m.landing_footer_report()}
			</a>
		</nav>
	</div>
</footer>

<style>
	.landing-footer {
		position: relative;
		overflow: hidden;
		background: var(--footer-bg);
		color: var(--footer-text);
		border-top: var(--border-w) solid var(--footer-bg);
	}

	/* Mockup footer wordmark: white text, footer-tinted mark border */
	.landing-footer :global(.logo) {
		color: #fff;
	}

	.landing-footer :global(.logo-icon-wrap) {
		border-color: var(--footer-text);
	}

	.footer-tagline {
		font-size: 14.5px;
		line-height: var(--leading-relaxed);
		opacity: 0.85;
	}

	.footer-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		border: 2px solid var(--footer-text);
		border-radius: var(--radius-btn);
		color: #fff;
		padding: 8px 14px;
		font-size: 14.5px;
		font-weight: var(--weight-semibold);
		text-decoration: none;
		transition:
			background-color var(--duration-normal) var(--ease-standard),
			transform var(--duration-normal) var(--ease-standard);
	}

	.footer-link:hover {
		background: var(--footer-hover);
		transform: translateY(-2px);
	}

	.footer-link:focus-visible {
		outline-color: var(--footer-text);
	}

	.footer-doodle {
		position: absolute;
		top: 14px;
		right: 8%;
		width: 40px;
		opacity: 0.18;
		color: var(--footer-text);
		pointer-events: none;
	}
</style>
