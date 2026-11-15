<script lang="ts">
	import GiftDetailModal from '$lib/components/blocks/gift/GiftDetailModal.svelte';
	import ReserveModal from '$lib/components/blocks/reservation/ReserveModal.svelte';
	import LoginPromptDialog from '$lib/components/blocks/auth/LoginPromptDialog.svelte';
	import { LazyDialog, lazyComponent } from '$lib/components/derived/lazy-dialog/index.js';
	import { useSharing } from '$lib/modules/sharing/sharing.context.svelte.js';
	import type {
		GiftByRole,
		GiftForVisitor,
		GiftPriorityLevel,
		CreateGiftInput,
		UpdateGiftInput,
		GiftDraftInput,
	} from '$lib/modules/gifts/types.js';
	import type { ManagedGiftCategory } from '$lib/modules/gift-categories/types.js';
	import type { ReserveGiftInput } from '$lib/modules/reservations/types.js';
	import type { GiftMoreProps } from './gift_context_invocation.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { canReserveGift } from '$lib/modules/wishlists/wishlist_capabilities.js';

	/** `GiftMoreProps` belong to the Gift viewer's footer More. */
	interface WishlistModalsProps extends GiftMoreProps {
		/** Viewer role — drives the reserve gate (recipient cannot reserve). */
		role: WishlistRole;
		/** Recipient OR správce: gates the gift editor, share wizard, správci panel, batch add. */
		canManage: boolean;
		isAuthenticated: boolean;
		redirectHref: string;
		wishlistId: string;
		demo?: boolean;
		wishlistTitle: string;
		giftCount: number;
		/** Linked recipient self-promoted to see reservation state (passed to the správci panel). */
		recipientIsModerator: boolean;
		/** Archived wishlist (issue #165): the gift detail modal's reserve action
		 *  hides unless the viewer already holds a reservation, mirroring cards. */
		isArchived: boolean;
		hideReservationState: boolean;
		// Gift detail modal
		giftModalOpen: boolean;
		giftModalMode: 'create' | 'edit';
		selectedGift: GiftByRole | null;
		priorityLevels: GiftPriorityLevel[];
		categoryOptions?: ManagedGiftCategory[];
		postShareLocked: boolean;
		canDeleteSelectedGift: boolean;
		/** When the selected gift's share grace window closes (issue #83), or null when none. */
		graceExpiresAt: Date | null;
		graceMessage: (inputs: { time: string }) => string;
		/** Reactive "now" from the page clock that keeps the grace countdown live. */
		graceNow: Date;
		/** Asked before the first change in the gift editor; false cancels the change. */
		confirmGiftChange?: () => Promise<boolean>;
		isSubmitting: boolean;
		isDeleting: boolean;
		// Reserve modal
		reserveModalOpen: boolean;
		reservingGift: GiftForVisitor | null;
		isReserving: boolean;
		// Batch add dialog
		batchAddDialogOpen: boolean;
		isBatchSubmitting: boolean;
		batchServerDuplicateCount: number;
		// Moderator panel
		moderatorPanelOpen: boolean;
		// Login prompt (anonymous like attempt)
		authPromptOpen: boolean;
		// Callbacks
		ongiftmodalclose: () => void;
		oncreate: (input: CreateGiftInput) => boolean | void | Promise<boolean | void>;
		onupdate: (input: UpdateGiftInput) => boolean | void | Promise<boolean | void>;
		ondelete: (giftId: string) => void | Promise<void>;
		/** Gift detail modal's inline reserve action (issue #165): opens the reserve
		 *  modal for quantity/anonymous identity input, distinct from `onreserve`
		 *  below (the reserve modal's own submit handler). */
		ongiftreserve: (gift: GiftForVisitor) => void;
		ongiftunreserve: (gift: GiftForVisitor) => void;
		onreservemodalclose: () => void;
		onreserve: (input: ReserveGiftInput) => void;
		/** Optional – share/self-promote already sync the page via single-flight refreshes (issue #108). */
		onshared?: () => void;
		onmoderatorselfpromoted?: () => void;
		onbatchsubmit: (drafts: GiftDraftInput[]) => void;
		onbatchdialogopenchange: (open: boolean) => void;
		onbatchresetduplicatewarning: () => void;
	}

	let {
		role,
		canManage,
		isAuthenticated,
		redirectHref,
		wishlistId,
		demo = false,
		wishlistTitle,
		giftCount,
		recipientIsModerator,
		isArchived,
		hideReservationState,
		giftModalOpen = $bindable(),
		giftModalMode,
		selectedGift,
		priorityLevels,
		categoryOptions = [],
		postShareLocked,
		canDeleteSelectedGift,
		graceExpiresAt,
		graceMessage,
		graceNow,
		confirmGiftChange,
		isSubmitting,
		isDeleting,
		reserveModalOpen = $bindable(),
		reservingGift,
		isReserving,
		batchAddDialogOpen = $bindable(),
		isBatchSubmitting,
		batchServerDuplicateCount,
		moderatorPanelOpen = $bindable(),
		authPromptOpen = $bindable(),
		ongiftmodalclose,
		oncreate,
		onupdate,
		ondelete,
		ongiftreserve,
		ongiftunreserve,
		onmore,
		moreOpen,
		moreSurface,
		onreservemodalclose,
		onreserve,
		onshared,
		onmoderatorselfpromoted,
		onbatchsubmit,
		onbatchdialogopenchange,
		onbatchresetduplicatewarning,
	}: WishlistModalsProps = $props();

	// Reservation availability: everyone except the recipient (their own surprise) may reserve.
	const canReserve = $derived(canReserveGift(role));

	const sharing = useSharing();
	// Manager-only dialogs stay out of the page chunk that every visitor downloads.
	const shareWizard = lazyComponent(
		() => import('$lib/components/blocks/sharing/ShareWizard.svelte'),
	);
	const moderatorPanel = lazyComponent(
		() => import('$lib/components/blocks/moderator/ModeratorPanel.svelte'),
	);
	const giftDraftDialog = lazyComponent(
		() => import('$lib/components/blocks/gift-draft-grid/GiftDraftDialog.svelte'),
	);
</script>

<!-- Gift detail opens in edit mode for managers and read-only mode for everyone else. -->
<GiftDetailModal
	bind:open={giftModalOpen}
	mode={giftModalMode}
	gift={selectedGift}
	{wishlistId}
	{demo}
	{priorityLevels}
	{categoryOptions}
	canCreateCategory={canManage && !isArchived}
	{role}
	readOnly={!canManage}
	{isArchived}
	{hideReservationState}
	{postShareLocked}
	canDelete={canDeleteSelectedGift}
	{graceExpiresAt}
	{graceMessage}
	{graceNow}
	confirmChange={confirmGiftChange}
	{isSubmitting}
	{isDeleting}
	{oncreate}
	{onupdate}
	{ondelete}
	onreserve={ongiftreserve}
	onunreserve={ongiftunreserve}
	{onmore}
	{moreOpen}
	{moreSurface}
	onclose={ongiftmodalclose}
/>

<!-- Reserve Modal (everyone who may reserve — recipient excluded, they don't spoil their surprise) -->
{#if canReserve && !hideReservationState}
	<ReserveModal
		bind:open={reserveModalOpen}
		gift={reservingGift}
		{redirectHref}
		{isAuthenticated}
		isSubmitting={isReserving}
		{onreserve}
		onclose={onreservemodalclose}
	/>
{/if}

<!-- Share Wizard (managers only) -->
{#if canManage && !demo}
	<LazyDialog open={sharing.wizardOpen.current} loader={shareWizard} preloadWhenIdle>
		{#snippet children(ShareWizard)}
			<ShareWizard {wishlistId} {wishlistTitle} {giftCount} {onshared} />
		{/snippet}
	</LazyDialog>
{/if}

<!-- Správci panel (managers only) -->
{#if canManage && !demo}
	<LazyDialog open={moderatorPanelOpen} loader={moderatorPanel} preloadWhenIdle>
		{#snippet children(ModeratorPanel)}
			<ModeratorPanel
				{wishlistId}
				{recipientIsModerator}
				bind:open={moderatorPanelOpen}
				onselfpromoted={onmoderatorselfpromoted}
			/>
		{/snippet}
	</LazyDialog>
{/if}

<!-- Batch Add Gifts Dialog (managers only) -->
{#if canManage}
	<LazyDialog open={batchAddDialogOpen} loader={giftDraftDialog} preloadWhenIdle>
		{#snippet children(GiftDraftDialog)}
			<GiftDraftDialog
				bind:open={batchAddDialogOpen}
				{wishlistTitle}
				isSubmitting={isBatchSubmitting}
				priorityAvailable={priorityLevels.length >= 2}
				{categoryOptions}
				serverDuplicateCount={batchServerDuplicateCount}
				onsubmit={onbatchsubmit}
				onresetduplicatewarning={onbatchresetduplicatewarning}
				onOpenChange={onbatchdialogopenchange}
			/>
		{/snippet}
	</LazyDialog>
{/if}

<!-- Login prompt (shown when an anonymous visitor taps the like heart) -->
<LoginPromptDialog bind:open={authPromptOpen} {redirectHref} />
