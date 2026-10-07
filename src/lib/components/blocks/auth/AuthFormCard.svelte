<script module lang="ts">
	interface AuthTabTransition {
		fromIndex: number;
		toIndex: number;
	}

	// Login and registration are separate pages, so the next card's tabs slide from the previous one.
	let pendingTabTransition: AuthTabTransition | null = null;
</script>

<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { selectionSlide } from '$lib/motion/selection_slide.js';
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

	const tabSlideStartIndex = takeTabSlideStartIndex();

	function activeTabIndex(): number {
		return tabs?.findIndex((tab) => tab.active) ?? -1;
	}

	function takeTabSlideStartIndex(): number | undefined {
		const transition = pendingTabTransition;
		pendingTabTransition = null;
		return transition?.toIndex === activeTabIndex() ? transition.fromIndex : undefined;
	}

	beforeNavigate((navigation) => {
		const destination = navigation.to?.url;
		if (tabs === undefined || destination === undefined || navigation.willUnload) {
			return;
		}
		const fromIndex = activeTabIndex();
		const toIndex = tabs.findIndex((tab) => {
			const tabUrl = new URL(tab.href, window.location.href);
			return (
				!tab.active &&
				tabUrl.origin === destination.origin &&
				tabUrl.pathname === destination.pathname
			);
		});
		if (fromIndex === -1 || toIndex === -1) {
			return;
		}
		const transition = { fromIndex, toIndex };
		pendingTabTransition = transition;
		const clearUnconsumedTransition = () => {
			if (pendingTabTransition === transition) {
				pendingTabTransition = null;
			}
		};
		navigation.complete.then(clearUnconsumedTransition, clearUnconsumedTransition);
	});
</script>

<!-- Anime-sky auth card (issue #102 REQ-16, `anime-auth.html`): sticker panel with
     the bobbing "100% zdarma" badge; login/register are tab-styled links. -->
<div class="form-panel">
	<!-- Switching tabs keeps the card in place so the sliding tab stays visible. -->
	<div class="auth-card" class:continues-tab-switch={tabSlideStartIndex !== undefined}>
		{#if tabs}
			<span class="free-sticker" aria-hidden="true">{m.auth_free_sticker()}</span>
		{/if}

		{#if tabs}
			<nav
				class="auth-tabs"
				aria-label={m.auth_tabs_label()}
				{@attach selectionSlide({
					optionSelector: 'a',
					selectedSelector: "[aria-current='page']",
					startOptionIndex: tabSlideStartIndex,
				})}
			>
				{#each tabs as tab (tab.href)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve (callers pass resolve()-built localized hrefs) -->
					<a href={tab.href} aria-current={tab.active ? 'page' : undefined}>
						{tab.label}
					</a>
				{/each}
				<span class="tab-indicator" data-slot="selection-indicator" aria-hidden="true"
				></span>
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
		color: var(--muted-foreground);
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.auth-tabs a,
	.tab-indicator {
		border-radius: 8px;
		border: 2px solid transparent;
	}

	.auth-tabs a:hover {
		color: var(--ink);
	}

	.auth-tabs a[aria-current='page'] {
		color: var(--ink);
	}

	.auth-tabs a[aria-current='page'],
	.tab-indicator {
		background: var(--card);
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
		.auth-card:not(.continues-tab-switch) {
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
