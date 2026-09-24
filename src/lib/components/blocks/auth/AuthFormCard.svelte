<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { Snippet } from 'svelte';

	interface AuthTab {
		label: string;
		href: string;
		active: boolean;
	}

	interface AuthFormCardProps {
		title: string;
		subtitle: string;
		/** Login/register switcher rendered as mockup-style tabs (links, so routes stay). */
		tabs?: AuthTab[];
		children: Snippet;
	}

	let { title, subtitle, tabs, children }: AuthFormCardProps = $props();
</script>

<!-- Anime-sky auth card (issue #102 REQ-16, `anime-auth.html`): sticker panel with
     the bobbing "100% zdarma" badge; login/register are tab-styled links. -->
<div class="form-panel">
	<div class="auth-card">
		{#if tabs}
			<span class="free-sticker" aria-hidden="true">{m.auth_free_sticker()}</span>
		{/if}

		{#if tabs}
			<nav class="auth-tabs" aria-label={m.auth_tabs_label()}>
				{#each tabs as tab (tab.href)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve (callers pass resolve()-built localized hrefs) -->
					<a href={tab.href} aria-current={tab.active ? 'page' : undefined}>
						{tab.label}
					</a>
				{/each}
			</nav>
		{/if}

		<h1 class="form-heading">{title}</h1>
		<p class="form-subheading">{subtitle}</p>
		{@render children()}
	</div>
</div>

<style>
	.form-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-12) var(--space-6);
		background: var(--background);
		overflow-y: auto;
		min-height: 100dvh;
	}

	.auth-card {
		position: relative;
		width: min(440px, 100%);
		padding: var(--space-8);
		background: var(--card);
		border: 2.5px solid var(--ink);
		border-radius: var(--radius-panel);
		box-shadow: var(--shadow-sticker);
	}

	.free-sticker {
		--rot: 6deg;

		position: absolute;
		top: -20px;
		right: -12px;
		z-index: 2;
		background: var(--accent-loud);
		color: var(--accent-loud-foreground);
		border: 2.5px solid var(--ink);
		border-radius: 999px;
		font-family: var(--font-head);
		font-size: 14px;
		padding: 8px 15px;
		transform: rotate(var(--rot));
		box-shadow: var(--shadow-sticker);
	}

	.auth-tabs {
		display: flex;
		gap: 4px;
		padding: 5px;
		background: var(--surface);
		border: 2.5px solid var(--ink);
		border-radius: 12px;
		margin-bottom: var(--space-6);
	}

	.auth-tabs a {
		flex: 1;
		padding: 9px 14px;
		font-size: 15px;
		font-weight: 600;
		text-align: center;
		text-decoration: none;
		border-radius: 8px;
		color: var(--muted-foreground);
		border: 2px solid transparent;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.auth-tabs a:hover {
		color: var(--ink);
	}

	.auth-tabs a[aria-current='page'] {
		background: var(--card);
		color: var(--ink);
		border-color: var(--ink);
		box-shadow: var(--elevation-compact);
	}

	.form-heading {
		font-family: var(--font-head);
		font-size: 25px;
		font-weight: 600;
		color: var(--ink);
		margin-bottom: var(--space-1);
		line-height: var(--leading-tight);
	}

	.form-subheading {
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		margin-bottom: var(--space-6);
		line-height: var(--leading-relaxed);
	}

	@media (prefers-reduced-motion: no-preference) {
		.auth-card {
			animation: pop-in 0.55s cubic-bezier(0.34, 1.4, 0.64, 1) 0.12s backwards;
		}

		.free-sticker {
			animation: var(--animate-bob);
		}
	}

	@media (width <= 768px) {
		.form-panel {
			padding: var(--space-10) var(--space-4) var(--space-12);
			min-height: auto;
			justify-content: flex-start;
		}

		.free-sticker {
			right: 6px;
			top: -16px;
		}
	}
</style>
