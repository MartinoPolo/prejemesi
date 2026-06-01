<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { Badge } from '$lib/components/base/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { NavDropdownItem } from './navbar_types.js';

	interface NavDropdownProps {
		title: string;
		viewAllHref: string;
		items: NavDropdownItem[];
	}

	let { title, viewAllHref, items = [] }: NavDropdownProps = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<div class="nav-dropdown" role="menu" aria-label="{m.nav_recent()} — {title}">
	<div class="nav-dropdown-panel">
		{#if items.length > 0}
			<div class="nav-dropdown-header">
				<span class="nav-dropdown-title">{m.nav_recent()}</span>
				<a class="nav-dropdown-view-all" href={viewAllHref}>
					{m.nav_view_all()}
					<ArrowRight class="size-3" />
				</a>
			</div>

			{#each items as item (item.href)}
				<a class="nav-dropdown-item" href={item.href} role="menuitem">
					<span class="nav-dropdown-thumb">{item.emoji}</span>
					<span class="nav-dropdown-info">
						<span class="nav-dropdown-name">{item.name}</span>
						<span class="nav-dropdown-meta">{item.meta}</span>
					</span>
					{#if item.badgeLabel}
						<Badge
							tone={item.badgeVariant === 'shared' ? 'primary' : 'neutral'}
							badgeStyle="subtle"
							size="compact"
						>
							{item.badgeLabel}
						</Badge>
					{/if}
				</a>
			{/each}
		{:else}
			<div class="nav-dropdown-empty">
				<span class="nav-dropdown-empty-text">{m.nav_no_lists()}</span>
			</div>
		{/if}

		<div class="nav-dropdown-footer">
			<a class="nav-dropdown-footer-link" href={viewAllHref}>{m.nav_view_all()}</a>
		</div>
	</div>
</div>

<style>
	.nav-dropdown {
		position: absolute;
		top: 100%;
		left: -8px;
		width: 320px;
		padding-top: var(--space-2);
		opacity: 0;
		pointer-events: none;
		transform: translateY(-4px);
		transition:
			opacity var(--duration-normal) var(--ease-standard),
			transform var(--duration-normal) var(--ease-standard);
		z-index: var(--z-dropdown);
	}

	.nav-dropdown-panel {
		background: var(--popover);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-xl);
		overflow: hidden;
	}

	:global(.nav-item:hover) .nav-dropdown,
	:global(.nav-item.is-open) .nav-dropdown {
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0);
	}

	.nav-dropdown-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4) var(--space-2);
		border-bottom: 1px solid var(--border);
	}

	.nav-dropdown-title {
		font-size: var(--text-xs);
		font-weight: var(--weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.nav-dropdown-view-all {
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		color: var(--primary);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.nav-dropdown-view-all:hover {
		text-decoration: underline;
	}

	.nav-dropdown-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4);
		cursor: pointer;
		text-decoration: none;
		color: inherit;
		transition: background var(--duration-normal) var(--ease-standard);
	}

	.nav-dropdown-item:hover {
		background: var(--accent);
	}

	.nav-dropdown-thumb {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 17px;
		flex-shrink: 0;
		background: var(--accent);
	}

	.nav-dropdown-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.nav-dropdown-name {
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		color: var(--foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nav-dropdown-meta {
		font-size: 11px;
		color: var(--muted-foreground);
		margin-top: 1px;
	}

	.nav-dropdown-footer {
		padding: var(--space-2) var(--space-4) var(--space-3);
		border-top: 1px solid var(--border);
	}

	.nav-dropdown-footer-link {
		font-size: var(--text-sm);
		color: var(--primary);
		text-decoration: none;
		font-weight: var(--weight-medium);
	}

	.nav-dropdown-footer-link:hover {
		text-decoration: underline;
	}

	.nav-dropdown-empty {
		padding: var(--space-4);
		text-align: center;
	}

	.nav-dropdown-empty-text {
		font-size: var(--text-sm);
		color: var(--muted-foreground);
	}
</style>
