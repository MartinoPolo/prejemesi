<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import BookmarkIcon from '@lucide/svelte/icons/bookmark';
	import BookmarkXIcon from '@lucide/svelte/icons/bookmark-x';
	import ShoppingBagIcon from '@lucide/svelte/icons/shopping-bag';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import * as ContextMenu from '$lib/components/base/context-menu/index.js';
	import * as DropdownMenu from '$lib/components/base/dropdown-menu/index.js';
	import * as Sheet from '$lib/components/base/sheet/index.js';
	import WishlistBottomSheet from './WishlistBottomSheet.svelte';
	import WishlistSheetAction from './WishlistSheetAction.svelte';
	import WishlistSheetBody from './WishlistSheetBody.svelte';
	import WishlistSheetHeader from './WishlistSheetHeader.svelte';
	import GiftContextDesktopActions from './GiftContextDesktopActions.svelte';
	import {
		RELEASE_RESERVATION_ACTION,
		giftContextActions,
		type GiftContextOrigin,
	} from '$lib/modules/gifts/gift_context_actions.js';
	import { normalizeGiftUrl } from '$lib/modules/gifts/gift_url.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import type { ReservationReleaseCapability } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		GiftActionPlacementSnapshot,
		GiftContextCommandCallbacks,
		GiftContextFinishPolicy,
	} from './gift_context_invocation.js';

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
	const nestedActionSurfaceClass = 'grid grid-cols-[1.25rem_minmax(0,1fr)_1.25rem]';
	const reversalSurfaceClass = 'text-status-danger-text group-hover:text-status-danger-text';
	let mobileScreen = $state<'main' | 'priority' | 'category'>('main');
	let openedSessionId = $state(0);

	$effect(() => {
		if (programmaticOpen) {
			openedSessionId = sessionId;
		}
	});

	function has(action: (typeof actions)[number]) {
		return actions.includes(action);
	}
	function isDisabled(action: (typeof actions)[number]) {
		return disabledActions.has(action);
	}
	function finish(policy: GiftContextFinishPolicy, callback: () => void) {
		onfinish(policy, callback);
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

{#snippet icon(
	action:
		| 'open'
		| 'copy'
		| 'edit'
		| 'received'
		| 'multiselect'
		| 'reserve'
		| 'cancel-reservation'
		| 'purchased'
		| 'release-reservation',
)}
	{#if action === 'open'}<ExternalLinkIcon />{:else if action === 'copy'}<CopyIcon
		/>{:else if action === 'edit'}<PencilIcon
		/>{:else if action === 'received' && received}<Undo2Icon
			aria-hidden="true"
		/>{:else if action === 'received'}<CheckIcon
			aria-hidden="true"
		/>{:else if action === 'reserve'}<BookmarkIcon
		/>{:else if action === 'cancel-reservation'}<BookmarkXIcon
			aria-hidden="true"
		/>{:else if action === 'purchased' && purchased}<Undo2Icon
			aria-hidden="true"
		/>{:else if action === 'purchased'}<ShoppingBagIcon
			aria-hidden="true"
		/>{:else if action === RELEASE_RESERVATION_ACTION}<KeyRoundIcon
			aria-hidden="true"
		/>{:else}<ListChecksIcon />{/if}
{/snippet}

{#snippet desktopActions(kind: 'context' | 'dropdown')}
	<GiftContextDesktopActions
		{kind}
		{actions}
		{disabledActions}
		{safePrimaryUrl}
		{received}
		{purchased}
		{priorityReady}
		{categoryReady}
		{priorityLevels}
		{categories}
		{priorityLevelId}
		{categoryId}
		onfinish={finish}
		oncopy={() => void copyLink()}
		{onedit}
		{onpriority}
		{oncategory}
		{onreceived}
		{onselect}
		{onreserve}
		{oncancelreservation}
		{onpurchased}
		{onreleasereservation}
	/>
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
					>{mobileScreen === 'main'
						? name
						: mobileScreen === 'priority'
							? m.gift_priority_label()
							: m.gift_context_category()}</Sheet.Title
				>
				<Sheet.Description>{m.gift_context_actions_description()}</Sheet.Description>
			</WishlistSheetHeader>
			<WishlistSheetBody class="flex flex-col" data-mobile-screen={mobileScreen}>
				{#if mobileScreen !== 'main'}
					<WishlistSheetAction onclick={() => (mobileScreen = 'main')}
						><ChevronLeftIcon />{m.gift_context_back()}</WishlistSheetAction
					>
					{#each [{ id: null, label: mobileScreen === 'priority' ? m.gift_priority_none() : m.gift_category_uncategorized() }, ...(mobileScreen === 'priority' ? priorityLevels : categories)] as choice (choice.id)}
						<WishlistSheetAction
							onclick={() =>
								finish('restore-focus', () =>
									mobileScreen === 'priority'
										? onpriority(choice.id)
										: oncategory(choice.id),
								)}
						>
							<span class="flex size-5 shrink-0 items-center justify-center"
								>{#if (mobileScreen === 'priority' ? priorityLevelId : categoryId) === choice.id}<CheckIcon
										class="size-4"
									/>{/if}</span
							>{choice.label}
						</WishlistSheetAction>
					{/each}
				{:else}
					{#if has('open')}<WishlistSheetAction
							href={safePrimaryUrl!}
							disabled={isDisabled('open')}
							target="_blank"
							rel="external noopener noreferrer"
							onclick={onclose}
							>{@render icon('open')}{m.gift_context_open_link()}</WishlistSheetAction
						>{/if}
					{#if has('copy')}<WishlistSheetAction
							disabled={isDisabled('copy')}
							onclick={copyLink}
							>{@render icon('copy')}{m.gift_context_copy_link()}</WishlistSheetAction
						>{/if}
					{#if has('edit')}<WishlistSheetAction
							disabled={isDisabled('edit')}
							onclick={() => finish('handoff', onedit)}
							>{@render icon('edit')}{m.gift_context_edit()}</WishlistSheetAction
						>{/if}
					{#if has('priority')}<WishlistSheetAction
							indent
							surfaceClass={nestedActionSurfaceClass}
							disabled={!priorityReady || isDisabled('priority')}
							onclick={() => (mobileScreen = 'priority')}
							>{priorityReady
								? m.gift_priority_label()
								: `${m.gift_priority_label()}: ${m.moderator_loading()}`}<ChevronRightIcon
								aria-hidden="true"
							/></WishlistSheetAction
						>{/if}
					{#if has('category')}<WishlistSheetAction
							indent
							surfaceClass={nestedActionSurfaceClass}
							disabled={!categoryReady || isDisabled('category')}
							onclick={() => (mobileScreen = 'category')}
							>{categoryReady
								? m.gift_context_category()
								: `${m.gift_context_category()}: ${m.moderator_loading()}`}<ChevronRightIcon
								aria-hidden="true"
							/></WishlistSheetAction
						>{/if}
					{#if has('received')}<WishlistSheetAction
							disabled={isDisabled('received')}
							surfaceClass={received ? reversalSurfaceClass : undefined}
							onclick={() => finish('restore-focus', onreceived)}
							>{@render icon('received')}{received
								? m.gift_mark_unreceived()
								: m.gift_mark_received()}</WishlistSheetAction
						>{/if}
					{#if has('multiselect')}<WishlistSheetAction
							disabled={isDisabled('multiselect')}
							onclick={() => finish('handoff', onselect)}
							>{@render icon(
								'multiselect',
							)}{m.gift_context_select_multiple()}</WishlistSheetAction
						>{/if}
					{#if has('reserve') && onreserve}<WishlistSheetAction
							disabled={isDisabled('reserve')}
							onclick={() => finish('handoff', onreserve)}
							>{@render icon(
								'reserve',
							)}{m.reserve_button_reserve()}</WishlistSheetAction
						>{/if}
					{#if has('cancel-reservation') && oncancelreservation}<WishlistSheetAction
							disabled={isDisabled('cancel-reservation')}
							surfaceClass={reversalSurfaceClass}
							onclick={() => finish('restore-focus', oncancelreservation)}
							>{@render icon(
								'cancel-reservation',
							)}{m.reserve_button_cancel()}</WishlistSheetAction
						>{/if}
					{#if has('purchased') && onpurchased}<WishlistSheetAction
							aria-pressed={purchased}
							disabled={isDisabled('purchased')}
							surfaceClass={purchased ? reversalSurfaceClass : undefined}
							onclick={() => finish('restore-focus', onpurchased)}
							>{@render icon('purchased')}{purchased
								? m.gift_mark_unbought()
								: m.gift_mark_bought()}</WishlistSheetAction
						>{/if}
					{#if has(RELEASE_RESERVATION_ACTION) && onreleasereservation}<WishlistSheetAction
							disabled={isDisabled(RELEASE_RESERVATION_ACTION)}
							surfaceClass={reversalSurfaceClass}
							onclick={() => finish('handoff', onreleasereservation)}
							>{@render icon(
								RELEASE_RESERVATION_ACTION,
							)}{m.reserve_release_button()}</WishlistSheetAction
						>{/if}
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
			{@render desktopActions('dropdown')}
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
		{@render desktopActions('context')}
	</ContextMenu.Content>
{/if}
