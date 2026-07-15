<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import GiftDetailModal from '$lib/components/blocks/gift/GiftDetailModal.svelte';
	import { GiftDraftDialog } from '$lib/components/blocks/gift-draft-grid/index.js';
	import ReserveModal from '$lib/components/blocks/reservation/ReserveModal.svelte';
	import ShareWizard from '$lib/components/blocks/sharing/ShareWizard.svelte';
	import WishlistPalettePicker from '$lib/components/blocks/wishlist/WishlistPalettePicker.svelte';
	import ModeratorPanel from '$lib/components/blocks/moderator/ModeratorPanel.svelte';
	import LoginPromptDialog from '$lib/components/blocks/auth/LoginPromptDialog.svelte';
	import type {
		GiftByRole,
		GiftForVisitor,
		GiftPriorityLevel,
		CreateGiftInput,
		UpdateGiftInput,
		GiftDraftInput,
	} from '$lib/modules/gifts/types.js';
	import type { Palette } from '$lib/theme/palettes.js';
	import type { ReserveGiftInput } from '$lib/modules/reservations/types.js';
	import type { WishlistRole } from '$lib/modules/wishlists/types.js';
	import { canReserveGift } from '$lib/modules/wishlists/wishlist_capabilities.js';
	import * as m from '$lib/paraglide/messages.js';

	interface WishlistModalsProps {
		/** Viewer role — drives the reserve gate (recipient cannot reserve). */
		role: WishlistRole;
		/** Recipient OR správce: gates the gift editor, share wizard, theme, správci panel, batch add. */
		canManage: boolean;
		isAuthenticated: boolean;
		redirectHref: string;
		wishlistId: string;
		wishlistTitle: string;
		giftCount: number;
		/** Linked recipient self-promoted to see reservation state (passed to the správci panel). */
		recipientIsModerator: boolean;
		// Gift detail modal
		giftModalOpen: boolean;
		giftModalMode: 'create' | 'edit';
		selectedGift: GiftByRole | null;
		priorityLevels: GiftPriorityLevel[];
		postShareLocked: boolean;
		canDeleteSelectedGift: boolean;
		/** When the selected gift's share grace window closes (issue #83), or null when none. */
		graceExpiresAt: Date | null;
		graceMessage: (inputs: { time: string }) => string;
		/** Reactive "now" from the page clock that keeps the grace countdown live. */
		graceNow: Date;
		isSubmitting: boolean;
		isDeleting: boolean;
		// Reserve modal
		reserveModalOpen: boolean;
		reservingGift: GiftForVisitor | null;
		isReserving: boolean;
		// Palette dialog (issue #102 REQ-5)
		paletteDialogOpen: boolean;
		wishlistPalette: Palette;
		// Batch add dialog
		batchAddDialogOpen: boolean;
		isBatchSubmitting: boolean;
		// Moderator panel
		moderatorPanelOpen: boolean;
		// Login prompt (anonymous like attempt)
		authPromptOpen: boolean;
		// Callbacks
		ongiftmodalclose: () => void;
		oncreate: (input: CreateGiftInput) => void;
		onupdate: (input: UpdateGiftInput) => void;
		ondelete: (giftId: string) => void;
		onreceived: (giftId: string, received: boolean) => void;
		onreservemodalclose: () => void;
		onreserve: (input: ReserveGiftInput) => void;
		onshared: () => void;
		onpaletteselect: (palette: Palette) => void;
		onmoderatorselfpromoted: () => void;
		onbatchsubmit: (drafts: GiftDraftInput[]) => void;
		onbatchdialogopenchange: (open: boolean) => void;
	}

	let {
		role,
		canManage,
		isAuthenticated,
		redirectHref,
		wishlistId,
		wishlistTitle,
		giftCount,
		recipientIsModerator,
		giftModalOpen = $bindable(),
		giftModalMode,
		selectedGift,
		priorityLevels,
		postShareLocked,
		canDeleteSelectedGift,
		graceExpiresAt,
		graceMessage,
		graceNow,
		isSubmitting,
		isDeleting,
		reserveModalOpen = $bindable(),
		reservingGift,
		isReserving,
		paletteDialogOpen = $bindable(),
		wishlistPalette,
		batchAddDialogOpen = $bindable(),
		isBatchSubmitting,
		moderatorPanelOpen = $bindable(),
		authPromptOpen = $bindable(),
		ongiftmodalclose,
		oncreate,
		onupdate,
		ondelete,
		onreceived,
		onreservemodalclose,
		onreserve,
		onshared,
		onpaletteselect,
		onmoderatorselfpromoted,
		onbatchsubmit,
		onbatchdialogopenchange,
	}: WishlistModalsProps = $props();

	// Reservation availability: everyone except the recipient (their own surprise) may reserve.
	const canReserve = $derived(canReserveGift(role));
</script>

<!-- Gift Detail Modal (issue #125: opens for every role — edit mode for managers, read-only
     for everyone else). GiftDetailModal's legacy `isOwner` prop only gates the manager-only
     "mark received" button, so it maps to canManage in the new role model, not to the
     recipient specifically. -->
<GiftDetailModal
	bind:open={giftModalOpen}
	mode={giftModalMode}
	gift={selectedGift}
	{wishlistId}
	{priorityLevels}
	isOwner={canManage}
	{role}
	readOnly={!canManage}
	{postShareLocked}
	canDelete={canDeleteSelectedGift}
	{graceExpiresAt}
	{graceMessage}
	{graceNow}
	{isSubmitting}
	{isDeleting}
	{oncreate}
	{onupdate}
	{ondelete}
	{onreceived}
	onclose={ongiftmodalclose}
/>

<!-- Reserve Modal (everyone who may reserve — recipient excluded, they don't spoil their surprise) -->
{#if canReserve}
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
{#if canManage}
	<ShareWizard {wishlistId} {wishlistTitle} {giftCount} {onshared} />
{/if}

<!-- Wishlist palette dialog (managers only, issue #102 REQ-5): replaces the old
     theme-preset/custom-color picker with the 10-palette swatch grid. -->
{#if canManage}
	<Dialog.Root bind:open={paletteDialogOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>{m.wishlist_palette_dialog_title()}</Dialog.Title>
				<Dialog.Description>{m.wishlist_palette_dialog_description()}</Dialog.Description>
			</Dialog.Header>
			<WishlistPalettePicker
				{wishlistId}
				palette={wishlistPalette}
				onselect={onpaletteselect}
			/>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- Správci panel (managers only) -->
{#if canManage}
	<ModeratorPanel
		{wishlistId}
		{recipientIsModerator}
		bind:open={moderatorPanelOpen}
		onselfpromoted={onmoderatorselfpromoted}
	/>
{/if}

<!-- Batch Add Gifts Dialog (managers only) -->
{#if canManage}
	<GiftDraftDialog
		bind:open={batchAddDialogOpen}
		{wishlistTitle}
		isSubmitting={isBatchSubmitting}
		priorityAvailable={priorityLevels.length >= 2}
		onsubmit={onbatchsubmit}
		onOpenChange={onbatchdialogopenchange}
	/>
{/if}

<!-- Login prompt (shown when an anonymous visitor taps the like heart) -->
<LoginPromptDialog bind:open={authPromptOpen} {redirectHref} />
