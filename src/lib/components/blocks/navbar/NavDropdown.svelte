<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { Badge } from '$lib/components/base/badge/index.js';
	import WishlistSlotImage from '$lib/components/blocks/wishlist/WishlistSlotImage.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import type { NavDropdownItem } from './navbar_types.js';

	interface NavDropdownProps {
		title: string;
		viewAllHref: string;
		items: NavDropdownItem[];
		totalCount?: number;
		/** When true, partition items into open / reserved / bought sections (followed dropdown). */
		grouped?: boolean;
		footer?: Snippet;
	}

	let {
		title,
		viewAllHref,
		items = [],
		totalCount,
		grouped = false,
		footer,
	}: NavDropdownProps = $props();

	const SECTION_KEYS = ['open', 'reserved', 'bought'] as const;
	type SectionKey = (typeof SECTION_KEYS)[number];

	const SECTION_LABELS: Record<SectionKey, () => string> = {
		open: m.nav_section_open,
		reserved: m.nav_section_reserved,
		bought: m.nav_section_bought,
	};

	function sectionKeyOf(item: NavDropdownItem): SectionKey {
		return item.resolution ?? 'open';
	}

	// Items arrive already sorted action-first with recency preserved within each state, so
	// filtering per section keeps the original ordering intact. Empty sections are dropped.
	const sections = $derived(
		grouped
			? SECTION_KEYS.map((key) => ({
					key,
					label: SECTION_LABELS[key](),
					items: items.filter((item) => sectionKeyOf(item) === key),
				})).filter((section) => section.items.length > 0)
			: null,
	);
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<div class="nav-dropdown" role="menu" aria-label="{m.nav_recent()} — {title}">
	<div class="nav-dropdown-panel">
		{#if items.length > 0}
			<div class="nav-dropdown-header">
				<span class="nav-dropdown-title">{m.nav_recent()}</span>
				<a class="nav-dropdown-view-all" href={viewAllHref}>
					{m.nav_view_all()}
					{#if totalCount !== undefined}
						<span class="nav-dropdown-count">({totalCount})</span>
					{/if}
					<ArrowRightIcon class="size-3" />
				</a>
			</div>

			{#if sections}
				{#each sections as section (section.key)}
					<div class="nav-dropdown-section">
						<span class="nav-dropdown-section-label">{section.label}</span>
						{#each section.items as item (item.href)}
							{@render itemRow(item)}
						{/each}
					</div>
				{/each}
			{:else}
				{#each items as item (item.href)}
					{@render itemRow(item)}
				{/each}
			{/if}
		{:else}
			<div class="nav-dropdown-empty">
				<span class="nav-dropdown-empty-text">{m.nav_no_lists()}</span>
			</div>
		{/if}

		{#if footer}
			<div class="nav-dropdown-footer">
				{@render footer()}
			</div>
		{/if}
	</div>
</div>

{#snippet itemRow(item: NavDropdownItem)}
	<a
		class={cn('nav-dropdown-item', item.resolution && 'is-resolved')}
		href={item.href}
		role="menuitem"
	>
		<span class="nav-dropdown-thumb">
			{#if item.imageUrl}
				<WishlistSlotImage
					class="nav-dropdown-thumb-image"
					src={item.imageUrl}
					frame={item.imageFrame}
					themeEmoji={item.emoji}
					alt={item.name}
				/>
			{:else}
				{item.emoji}
			{/if}
			{#if item.resolution === 'bought'}
				<span class="nav-dropdown-thumb-check"><CheckIcon class="size-2.5" /></span>
			{/if}
		</span>
		<span class="nav-dropdown-info">
			<span class="nav-dropdown-name">{item.name}</span>
			<span class="nav-dropdown-meta">
				<span class="nav-dropdown-meta-text">{item.meta}</span>
				{#if item.countdown}
					<span class="nav-dropdown-countdown">{item.countdown}</span>
				{/if}
			</span>
		</span>
		{#if item.badgeLabel}
			<Badge
				tone={item.badgeVariant === 'shared' ? 'primary' : 'neutral'}
				badgeStyle="subtle"
				size="compact"
				class={item.badgeVariant === 'shared' ? undefined : 'nav-dropdown-badge-neutral'}
			>
				{item.badgeLabel}
			</Badge>
		{/if}
	</a>
{/snippet}

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

	.nav-dropdown-count {
		color: var(--muted-foreground);
		font-weight: var(--weight-normal);
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
		position: relative;
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

	/* On hover the row adopts --accent, the thumb's own background — flip the thumb
	   to the panel surface so it stays distinct instead of melting into the row. */
	.nav-dropdown-item:hover .nav-dropdown-thumb {
		background: var(--popover);
	}

	/* Custom cover image fills the thumb, clipped to its rounded corners. Clipping the
	   image (not the thumb) keeps the bought-check overlay, which sits outside the box,
	   visible. */
	.nav-dropdown-thumb :global(.nav-dropdown-thumb-image) {
		position: absolute;
		inset: 0;
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	/* Subtle neutral badge fills with --surface-2, which matches the hovered row's
	   --accent — lift it onto the panel surface so it stays legible. (The "shared"
	   primary badge uses a translucent tint that already reads on either surface.) */
	.nav-dropdown-item:hover :global(.nav-dropdown-badge-neutral) {
		background: var(--popover);
	}

	/* Followed-list category groups: a faint divider + whitespace cleanly separates
	   "needs a gift" from "reserved" from "bought". */
	.nav-dropdown-section:not(:first-of-type) {
		margin-top: var(--space-1);
		border-top: 1px solid var(--border);
	}

	.nav-dropdown-section-label {
		display: block;
		padding: var(--space-2) var(--space-4) 2px;
		font-size: 10px;
		font-weight: var(--weight-semibold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	/* Resolved (gifter already reserved): de-emphasised so action-needed lists stand out. */
	.nav-dropdown-item.is-resolved {
		opacity: 0.6;
	}

	.nav-dropdown-item.is-resolved:hover {
		opacity: 0.85;
	}

	.nav-dropdown-thumb-check {
		position: absolute;
		right: -3px;
		bottom: -3px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 15px;
		height: 15px;
		border-radius: 9999px;
		background: var(--primary);
		color: var(--primary-foreground);
		border: 1.5px solid var(--popover);
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
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: var(--muted-foreground);
		margin-top: 1px;
		min-width: 0;
	}

	.nav-dropdown-meta-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Event countdown: kept readable against the muted owner/theme text so it draws the eye. */
	.nav-dropdown-countdown {
		flex-shrink: 0;
		font-weight: var(--weight-medium);
		color: var(--foreground);
	}

	.nav-dropdown-countdown::before {
		content: '·';
		margin-right: 5px;
		color: var(--muted-foreground);
		font-weight: var(--weight-normal);
	}

	.nav-dropdown-footer {
		padding: var(--space-2) var(--space-4) var(--space-3);
		border-top: 1px solid var(--border);
		font-size: var(--text-sm);
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
