<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
	import WishlistSheetAction from './WishlistSheetAction.svelte';
	import WishlistSheetBody from './WishlistSheetBody.svelte';
	import WishlistSheetHeader from './WishlistSheetHeader.svelte';
	import GiftContextActionIcon from './GiftContextActionIcon.svelte';
	import GiftContextDesktopActions from './GiftContextDesktopActions.svelte';
	import {
		RELEASE_RESERVATION_ACTION,
		giftContextActions,
		groupGiftContextActions,
		type GiftContextAction,
	} from '$lib/modules/gifts/gift_context_actions.js';
	import { normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import type {
		GiftContextOrigin,
		ReservationReleaseCapability,
	} from '$lib/modules/wishlists/wishlist_capabilities.js';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		GiftActionPlacementSnapshot,
		GiftContextCommandCallbacks,
		GiftContextFinishPolicy,
	} from './gift_context_invocation.js';
	import type {
		GiftContextChoiceAction,
		GiftContextChoiceMenu,
		GiftContextCommandEntry,
		GiftContextMenuEntry,
		GiftContextMenuGroup,
		GiftContextSubmenuEntry,
	} from './gift_context_menu.js';

	interface Choice {
		id: string;
		label: string;
	}
	interface Props extends GiftContextCommandCallbacks {
		sessionId: number;
		programmaticOpen: boolean;
		mobile: boolean;
		desktopAnchor?: HTMLButtonElement | null;
		anchorPoint?: { x: number; y: number };
		name: string;
		role: WishlistRole;
		primaryUrl: string | null;
		readOnly: boolean;
		received: boolean;
		canReserve?: boolean;
		ownsReservation?: boolean;
		canTrackPurchased?: boolean;
		purchased?: boolean;
		releaseCapability?: ReservationReleaseCapability;
		releaseLedgerCount?: number;
		origin?: GiftContextOrigin;
		priorityReady?: boolean;
		categoryReady?: boolean;
		priorityLevels: Choice[];
		categories: Choice[];
		priorityLevelId: string | null;
		categoryId: string | null;
		placementSnapshot?: GiftActionPlacementSnapshot;
		onclose: () => void;
		oncomplete: (sessionId: number) => void;
		oncopysuccess?: () => void;
		oncopyerror?: () => void;
	}
	let {
		sessionId,
		programmaticOpen,
		mobile,
		desktopAnchor = null,
		anchorPoint = { x: 0, y: 0 },
		name,
		role,
		primaryUrl,
		readOnly,
		received,
		canReserve = false,
		ownsReservation = false,
		canTrackPurchased = false,
		purchased = false,
		releaseCapability,
		releaseLedgerCount = 0,
		origin = 'card',
		priorityReady = false,
		categoryReady = false,
		priorityLevels,
		categories,
		priorityLevelId,
		categoryId,
		placementSnapshot,
		onclose,
		oncomplete,
		onfinish,
		onedit,
		onpriority,
		oncategory,
		onreceived,
		onselect,
		onreserve,
		oncancelreservation,
		onpurchased,
		onreleasereservation,
		oncopysuccess,
		oncopyerror,
	}: Props = $props();
	const safePrimaryUrl = $derived(normalizeGiftUrl(primaryUrl));
	const nativePointerAnchor = $derived({
		getBoundingClientRect: () =>
			DOMRect.fromRect({ x: anchorPoint.x, y: anchorPoint.y, width: 0, height: 0 }),
	});

	const capabilityActions = $derived(
		giftContextActions({
			role,
			primaryUrl: safePrimaryUrl,
			readOnly,
			canEdit: true,
			canReserve,
			ownsReservation,
			canTrackPurchased,
			releaseCapability,
			releaseLedgerCount,
			origin,
		}),
	);
	const actions = $derived(
		placementSnapshot === undefined
			? capabilityActions
			: capabilityActions.filter(
					(action) => !placementSnapshot.visibleDirectActions.includes(action),
				),
	);
	const disabledActions = $derived(
		new Set([
			...(placementSnapshot?.disabledActions ?? []),
			...(placementSnapshot?.pendingActions ?? []),
		]),
	);
	const choiceMenus = $derived<Record<GiftContextChoiceAction, GiftContextChoiceMenu>>({
		priority: {
			title: m.gift_priority_label(),
			ready: priorityReady,
			options: [{ id: null, label: m.gift_priority_none() }, ...priorityLevels],
			selectedId: priorityLevelId,
			choose: (id) => finish('restore-focus', () => onpriority(id)),
		},
		category: {
			title: m.gift_context_category(),
			ready: categoryReady,
			options: [{ id: null, label: m.gift_category_uncategorized() }, ...categories],
			selectedId: categoryId,
			choose: (id) => finish('restore-focus', () => oncategory(id)),
		},
	});
	const menuEntryBuilders: Record<GiftContextAction, () => GiftContextMenuEntry | undefined> = {
		open: () =>
			commandEntry('open', m.gift_context_open_link(), openLink, { href: safePrimaryUrl! }),
		copy: () => commandEntry('copy', m.gift_context_copy_link(), () => void copyLink()),
		edit: () => finishingEntry('edit', m.gift_context_edit(), 'handoff', onedit),
		received: () =>
			finishingEntry(
				'received',
				received ? m.gift_mark_unreceived() : m.gift_mark_received(),
				'restore-focus',
				onreceived,
				{ reversal: received, undo: received },
			),
		multiselect: () =>
			finishingEntry('multiselect', m.gift_context_select_multiple(), 'handoff', onselect),
		reserve: () => finishingEntry('reserve', m.reserve_button_reserve(), 'handoff', onreserve),
		'cancel-reservation': () =>
			finishingEntry(
				'cancel-reservation',
				m.reserve_button_cancel(),
				'restore-focus',
				oncancelreservation,
				{ reversal: true },
			),
		purchased: () =>
			finishingEntry(
				'purchased',
				purchased ? m.gift_mark_unbought() : m.gift_mark_bought(),
				'restore-focus',
				onpurchased,
				{ reversal: purchased, undo: purchased, pressed: purchased },
			),
		priority: () => submenuEntry('priority'),
		category: () => submenuEntry('category'),
		[RELEASE_RESERVATION_ACTION]: () =>
			finishingEntry(
				RELEASE_RESERVATION_ACTION,
				m.reserve_release_button(),
				'handoff',
				onreleasereservation,
				{ reversal: true },
			),
	};
	const menuGroups: GiftContextMenuGroup[] = $derived(
		groupGiftContextActions(actions)
			.map((group) => ({
				name: group.name,
				entries: group.actions
					.map((action) => menuEntryBuilders[action]())
					.filter((entry) => entry !== undefined),
			}))
			.filter((group) => group.entries.length > 0),
	);
	const nestedActionSurfaceClass = 'grid grid-cols-[1.25rem_minmax(0,1fr)_1.25rem]';
	const reversalSurfaceClass = 'text-status-danger-text group-hover:text-status-danger-text';
	let mobileScreen = $state<'main' | GiftContextChoiceAction>('main');
	let openedSessionId = $state(0);

	$effect(() => {
		if (programmaticOpen) {
			openedSessionId = sessionId;
		}
	});

	type CommandOptions = Partial<
		Pick<GiftContextCommandEntry, 'reversal' | 'undo' | 'pressed' | 'href'>
	>;

	function commandEntry(
		action: GiftContextCommandEntry['action'],
		label: string,
		select: () => void,
		options: CommandOptions = {},
	): GiftContextCommandEntry {
		return {
			kind: 'command',
			action,
			label,
			disabled: disabledActions.has(action),
			reversal: false,
			undo: false,
			...options,
			select,
		};
	}
	/** Omits commands whose optional callback the page did not provide. */
	function finishingEntry(
		action: GiftContextCommandEntry['action'],
		label: string,
		policy: GiftContextFinishPolicy,
		callback: (() => void) | undefined,
		options?: CommandOptions,
	) {
		if (callback === undefined) {
			return undefined;
		}
		return commandEntry(action, label, () => finish(policy, callback), options);
	}
	function submenuEntry(action: GiftContextChoiceAction): GiftContextSubmenuEntry {
		const menu = choiceMenus[action];
		return {
			kind: 'submenu',
			action,
			label: menu.ready ? menu.title : `${menu.title}: ${m.moderator_loading()}`,
			disabled: !menu.ready || disabledActions.has(action),
			menu,
		};
	}
	function finish(policy: GiftContextFinishPolicy, callback: () => void) {
		onfinish(policy, callback);
	}
	function openLink() {
		finish('restore-focus', () =>
			window.open(safePrimaryUrl!, '_blank', 'noopener,noreferrer'),
		);
	}
	async function copyLink() {
		if (safePrimaryUrl === null) {
			return;
		}
		try {
			await navigator.clipboard.writeText(safePrimaryUrl);
			oncopysuccess?.();
		} catch {
			oncopyerror?.();
		}
		onclose();
	}
	function handleOpenChange(value: boolean) {
		if (!value) {
			mobileScreen = 'main';
			onclose();
		}
	}
	function handleCloseAutoFocus(event: Event) {
		// The page session owns all completed-close focus and handoff behavior.
		event.preventDefault();
	}
</script>

{#snippet sheetEntry(entry: GiftContextMenuEntry)}
	{#if entry.kind === 'submenu'}<WishlistSheetAction
			surfaceClass={nestedActionSurfaceClass}
			disabled={entry.disabled}
			onclick={() => (mobileScreen = entry.action)}
			><GiftContextActionIcon action={entry.action} />{entry.label}<ChevronRightIcon
				aria-hidden="true"
			/></WishlistSheetAction
		>{:else if entry.href !== undefined}<WishlistSheetAction
			href={entry.href}
			disabled={entry.disabled}
			target="_blank"
			rel="external noopener noreferrer"
			onclick={onclose}
			><GiftContextActionIcon action={entry.action} />{entry.label}</WishlistSheetAction
		>{:else}<WishlistSheetAction
			aria-pressed={entry.pressed}
			disabled={entry.disabled}
			surfaceClass={entry.reversal === true ? reversalSurfaceClass : undefined}
			onclick={entry.select}
			><GiftContextActionIcon
				action={entry.action}
				undo={entry.undo}
			/>{entry.label}</WishlistSheetAction
		>{/if}
{/snippet}

{#snippet sheetMainScreen()}
	{#each menuGroups as group, groupIndex (group.name)}
		{#if groupIndex > 0}<Separator class="my-1" />{/if}
		{#each group.entries as entry (entry.action)}{@render sheetEntry(entry)}{/each}
	{/each}
{/snippet}

{#snippet sheetChoiceScreen(menu: GiftContextChoiceMenu)}
	<WishlistSheetAction onclick={() => (mobileScreen = 'main')}
		><ChevronLeftIcon />{m.gift_context_back()}</WishlistSheetAction
	>
	{#each menu.options as option (option.id)}
		<WishlistSheetAction onclick={() => menu.choose(option.id)}>
			<span class="flex size-5 shrink-0 items-center justify-center"
				>{#if menu.selectedId === option.id}<CheckIcon class="size-4" />{/if}</span
			>{option.label}
		</WishlistSheetAction>
	{/each}
{/snippet}

{#if mobile}
	<Sheet.Root
		open={programmaticOpen}
		onOpenChange={handleOpenChange}
		onOpenChangeComplete={(value) => {
			if (value === false) oncomplete(openedSessionId);
		}}
	>
		<WishlistBottomSheet onCloseAutoFocus={handleCloseAutoFocus}>
			<WishlistSheetHeader>
				<Sheet.Title
					>{mobileScreen === 'main' ? name : choiceMenus[mobileScreen].title}</Sheet.Title
				>
				<Sheet.Description>{m.gift_context_actions_description()}</Sheet.Description>
			</WishlistSheetHeader>
			<WishlistSheetBody class="flex flex-col" data-mobile-screen={mobileScreen}>
				{#if mobileScreen === 'main'}
					{@render sheetMainScreen()}
				{:else}
					{@render sheetChoiceScreen(choiceMenus[mobileScreen])}
				{/if}
			</WishlistSheetBody>
		</WishlistBottomSheet>
	</Sheet.Root>
{:else}
	<!-- Keep both desktop content hosts mounted through their complete close lifecycle. -->
	<DropdownMenu.Root
		open={programmaticOpen}
		onOpenChange={handleOpenChange}
		onOpenChangeComplete={(value) => {
			if (value === false) oncomplete(openedSessionId);
		}}
	>
		<DropdownMenu.Content
			class="w-64"
			customAnchor={desktopAnchor}
			onCloseAutoFocus={handleCloseAutoFocus}
		>
			<GiftContextDesktopActions kind="dropdown" groups={menuGroups} />
		</DropdownMenu.Content>
	</DropdownMenu.Root>
	<ContextMenu.Content
		class="w-64"
		customAnchor={nativePointerAnchor}
		onCloseAutoFocus={(event) => {
			// Native context invocation preserves the browser/context-menu focus contract.
			event.preventDefault();
		}}
	>
		<GiftContextDesktopActions kind="context" groups={menuGroups} />
	</ContextMenu.Content>
{/if}
