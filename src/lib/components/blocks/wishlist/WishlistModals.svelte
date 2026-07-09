<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import GiftDetailModal from '$lib/components/blocks/gift/GiftDetailModal.svelte';
	import { GiftDraftDialog } from '$lib/components/blocks/gift-draft-grid/index.js';
	import ReserveModal from '$lib/components/blocks/reservation/ReserveModal.svelte';
	import ShareWizard from '$lib/components/blocks/sharing/ShareWizard.svelte';
	import ThemeSelector from '$lib/components/blocks/theme/ThemeSelector.svelte';
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
	import type { WishlistTheme } from '$lib/modules/themes/types.js';
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
		// Theme dialog
		themeDialogOpen: boolean;
		activeTheme: WishlistTheme;
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
		onthemedialogopenchange: (open: boolean) => void;
		onthemepreview: (theme: WishlistTheme) => void;
		onthemesave: (theme: WishlistTheme) => void;
		onthemecancel: () => void;
		onmoderatorselfpromoted: () => void;
		onbatchsubmit: (drafts: GiftDraftInput[]) => void;
		onbatchdialogopenchange: (open: boolean) => void;
	}

	let {
		role,
		canManage,
		isAuthenticated,
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
		themeDialogOpen = $bindable(),
		activeTheme,
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
		onthemedialogopenchange,
		onthemepreview,
		onthemesave,
		onthemecancel,
		onmoderatorselfpromoted,
		onbatchsubmit,
		onbatchdialogopenchange,
	}: WishlistModalsProps = $props();

	// Reservation availability: everyone except the recipient (their own surprise) may reserve.
	const canReserve = $derived(canReserveGift(role));
</script>

<!-- Gift Detail Modal (managers only: recipient or správce).
     GiftDetailModal's legacy `isOwner` prop only gates the manager-only "mark received" button,
     so it maps to canManage in the new role model, not to the recipient specifically. -->
{#if canManage}
	<GiftDetailModal
		bind:open={giftModalOpen}
		mode={giftModalMode}
		gift={selectedGift}
		{wishlistId}
		{priorityLevels}
		isOwner={canManage}
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
{/if}

<!-- Reserve Modal (everyone who may reserve — recipient excluded, they don't spoil their surprise) -->
{#if canReserve}
	<ReserveModal
		bind:open={reserveModalOpen}
		gift={reservingGift}
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

<!-- Theme Selector Dialog (managers only) -->
{#if canManage}
	<Dialog.Root
		bind:open={themeDialogOpen}
		onOpenChange={(open) => {
			onthemedialogopenchange(open ?? false);
		}}
	>
		<Dialog.Content class="sm:max-w-lg">
			<Dialog.Header>
				<Dialog.Title>{m.theme_dialog_title()}</Dialog.Title>
				<Dialog.Description>{m.theme_dialog_description()}</Dialog.Description>
			</Dialog.Header>
			<ThemeSelector
				currentTheme={activeTheme}
				onsave={onthemesave}
				oncancel={onthemecancel}
				onpreview={onthemepreview}
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
<LoginPromptDialog bind:open={authPromptOpen} />
