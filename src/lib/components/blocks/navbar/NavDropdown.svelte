<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Badge } from '$lib/components/base/badge/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import WishlistSlotImage from '$lib/components/blocks/wishlist/WishlistSlotImage.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils.js';
	import type { NavDropdownItem } from './navbar_types.js';

	interface NavDropdownProps {
		title: string;
		/** Trigger link target – also the header "Zobrazit vše" href. */
		viewAllHref: string;
		items: NavDropdownItem[];
		totalCount?: number;
		/** When true, partition items into open / reserved / bought sections (followed dropdown). */
		grouped?: boolean;
		/** Marks the trigger link as the current page (filled pill + aria-current). */
		active?: boolean;
		/** Render with the panel already open (Storybook/demo only – open is hover-driven). */
		defaultOpen?: boolean;
		/** Controlled open state – the navbar binds this so at most one nav dropdown is
		 *  open at a time (opening one immediately closes any sibling). */
		open?: boolean;
		footer?: Snippet;
	}

	let {
		title,
		viewAllHref,
		items = [],
		totalCount,
		grouped = false,
		active = false,
		defaultOpen = false,
		open = $bindable(false),
		footer,
	}: NavDropdownProps = $props();

	/** Grace period so the pointer can cross the offset gap between trigger and panel. */
	const CLOSE_DELAY_MS = 120;

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

	// The trigger is a real link (click navigates – settled decision), so it cannot be a
	// bits-ui DropdownMenu.Trigger (that would hijack click/Enter to toggle). Instead the
	// menu is controlled: hover opens it, and the panel anchors to the link via customAnchor.
	let triggerElement = $state<HTMLAnchorElement | null>(null);
	let contentElement = $state<HTMLElement | null>(null);
	let closeTimer: ReturnType<typeof setTimeout> | undefined;

	function cancelScheduledClose() {
		clearTimeout(closeTimer);
		closeTimer = undefined;
	}

	function openNow() {
		cancelScheduledClose();
		open = true;
	}

	function scheduleClose() {
		cancelScheduledClose();
		closeTimer = setTimeout(() => (open = false), CLOSE_DELAY_MS);
	}

	/** Hover-open is mouse-only: a touch tap should just navigate, without a panel flash. */
	function handleTriggerPointerEnter(event: PointerEvent) {
		if (event.pointerType !== 'mouse') {
			return;
		}
		openNow();
	}

	function handleTriggerPointerLeave(event: PointerEvent) {
		if (event.pointerType !== 'mouse') {
			return;
		}
		scheduleClose();
	}

	/** ArrowDown on the focused trigger opens the menu and focuses the first item
	 *  (bits-ui trigger pattern); Enter keeps its native link navigation. */
	async function handleTriggerKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowDown') {
			return;
		}
		event.preventDefault();
		openNow();
		await tick();
		contentElement?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
	}

	/** bits-ui closes on Escape; return focus to the trigger link only when it was inside
	 *  the panel (keyboard flow) – a hover-open panel must not steal focus on dismiss. */
	function handleEscapeKeydown() {
		if (contentElement !== null && contentElement.contains(document.activeElement)) {
			triggerElement?.focus();
		}
	}

	onMount(() => {
		if (defaultOpen) {
			open = true;
		}
	});

	$effect(() => () => cancelScheduledClose());
</script>

<a
	bind:this={triggerElement}
	class={cn('nav-link', active && 'is-active')}
	href={viewAllHref}
	aria-current={active ? 'page' : undefined}
	aria-haspopup="menu"
	aria-expanded={open}
	onpointerenter={handleTriggerPointerEnter}
	onpointerleave={handleTriggerPointerLeave}
	onkeydown={handleTriggerKeydown}
>
	{title}
	<ChevronDownIcon class="nav-chevron" />
</a>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Content
		bind:ref={contentElement}
		customAnchor={triggerElement}
		align="start"
		alignOffset={-8}
		sideOffset={8}
		preventScroll={false}
		class="w-80 overflow-hidden p-0"
		aria-label="{m.nav_recent()} – {title}"
		onpointerenter={cancelScheduledClose}
		onpointerleave={scheduleClose}
		onOpenAutoFocus={(event) => event.preventDefault()}
		onCloseAutoFocus={(event) => event.preventDefault()}
		onEscapeKeydown={handleEscapeKeydown}
	>
		{#if items.length > 0}
			<div class="flex items-center justify-between px-4 pt-3 pb-2">
				<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
					{m.nav_recent()}
				</span>
				<a
					class="inline-flex items-center gap-1 text-xs font-medium text-primary no-underline hover:underline"
					href={viewAllHref}
				>
					{m.nav_view_all()}
					{#if totalCount !== undefined}
						<span class="font-normal text-muted-foreground">({totalCount})</span>
					{/if}
					<ArrowRightIcon class="size-3" />
				</a>
			</div>
			<DropdownMenu.Separator class="mx-0" />

			<div class="p-1.5">
				{#if sections}
					{#each sections as section, i (section.key)}
						{#if i > 0}
							<DropdownMenu.Separator />
						{/if}
						<DropdownMenu.Group>
							<DropdownMenu.GroupHeading
								class="block px-3 pt-2 pb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								{section.label}
							</DropdownMenu.GroupHeading>
							{#each section.items as item (item.href)}
								{@render itemRow(item)}
							{/each}
						</DropdownMenu.Group>
					{/each}
				{:else}
					{#each items as item (item.href)}
						{@render itemRow(item)}
					{/each}
				{/if}
			</div>
		{:else}
			<div class="p-4 text-center">
				<span class="text-sm text-muted-foreground">{m.nav_no_lists()}</span>
			</div>
		{/if}

		{#if footer}
			<DropdownMenu.Separator class="mx-0" />
			<div class="px-4 pt-2 pb-3 text-sm">
				{@render footer()}
			</div>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>

{#snippet itemRow(item: NavDropdownItem)}
	<DropdownMenu.Item textValue={item.name}>
		{#snippet child({ props })}
			<a
				{...props}
				href={item.href}
				class={cn(
					props.class as string,
					'group',
					item.resolution && 'opacity-60 focus:opacity-85',
				)}
			>
				<!-- Thumb rests on --accent (a subtle tint against the popover panel); on focus/hover
				     the row itself turns --accent, so the thumb flips to --popover to stay legible. -->
				<span
					class="group relative flex size-[34px] shrink-0 items-center justify-center rounded-md bg-accent text-[17px] group-focus:bg-popover"
				>
					{#if item.imageUrl}
						<WishlistSlotImage
							class="absolute inset-0 overflow-hidden rounded-md"
							src={item.imageUrl}
							frame={item.imageFrame}
							themeEmoji={item.emoji}
							alt={item.name}
							variant="thumbnail"
						/>
					{:else}
						{item.emoji}
					{/if}
					{#if item.resolution === 'bought'}
						<span
							class="absolute -right-[3px] -bottom-[3px] flex size-[15px] items-center justify-center rounded-full border-[1.5px] border-popover bg-primary text-primary-foreground"
						>
							<CheckIcon class="size-2.5" />
						</span>
					{/if}
				</span>
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="truncate text-sm font-medium text-foreground">{item.name}</span>
					<span
						class="mt-px flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
					>
						<span class="truncate">{item.meta}</span>
						{#if item.countdown}
							<span aria-hidden="true">·</span>
							<span class="shrink-0 font-medium text-foreground"
								>{item.countdown}</span
							>
						{/if}
					</span>
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
		{/snippet}
	</DropdownMenu.Item>
{/snippet}

<style>
	/* Mockup pill states: hover = subtle surface pill, active = filled pill
	   with an ink border (no underline). The dropdown panel content below uses the shared
	   DropdownMenu.* components + design-system Tailwind tokens instead of custom CSS. */
	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: var(--size-control-md);
		padding: 0 var(--space-3);
		border-radius: 9px;
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
		color: var(--muted-foreground);
		text-decoration: none;
		border: 2px solid transparent;
		background: transparent;
		cursor: pointer;
		font-family: var(--font-sans);
		transition:
			background var(--duration-normal) var(--ease-standard),
			color var(--duration-normal) var(--ease-standard);
		white-space: nowrap;
	}

	.nav-link:hover {
		background: var(--accent);
		color: var(--foreground);
	}

	.nav-link.is-active {
		background: var(--accent);
		color: var(--foreground);
		border-color: var(--ink);
	}

	.nav-link:hover :global(.nav-chevron),
	.nav-link[aria-expanded='true'] :global(.nav-chevron) {
		transform: rotate(180deg);
	}

	:global(.nav-chevron) {
		opacity: 0.55;
		transition: transform var(--duration-slow) var(--ease-standard);
		flex-shrink: 0;
		width: 14px;
		height: 14px;
	}
</style>
