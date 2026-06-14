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
	import * as m from '$lib/paraglide/messages.js';

	interface WishlistModalsProps {
		isOwner: boolean;
		isOwnerOrModerator: boolean;
		isAuthenticated: boolean;
		wishlistId: string;
		wishlistTitle: string;
		giftCount: number;
		ownerIsModerator: boolean;
		// Gift detail modal
		giftModalOpen: boolean;
		giftModalMode: 'create' | 'edit';
		selectedGift: GiftByRole | null;
		priorityLevels: GiftPriorityLevel[];
		postShareLocked: boolean;
		canDeleteSelectedGift: boolean;
		/** When the selected gift's share grace window closes (issue #83), or null when none. */
		graceExpiresAt: Date | null;
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
		isOwner,
		isOwnerOrModerator,
		isAuthenticated,
		wishlistId,
		wishlistTitle,
		giftCount,
		ownerIsModerator,
		giftModalOpen = $bindable(),
		giftModalMode,
		selectedGift,
		priorityLevels,
		postShareLocked,
		canDeleteSelectedGift,
		graceExpiresAt,
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
</script>

<!-- Gift Detail Modal (owner/moderator only) -->
{#if isOwnerOrModerator}
	<GiftDetailModal
		bind:open={giftModalOpen}
		mode={giftModalMode}
		gift={selectedGift}
		{wishlistId}
		{priorityLevels}
		{isOwner}
		{postShareLocked}
		canDelete={canDeleteSelectedGift}
		{graceExpiresAt}
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

<!-- Reserve Modal (visitor/moderator only, hidden for owner) -->
{#if !isOwner}
	<ReserveModal
		bind:open={reserveModalOpen}
		gift={reservingGift}
		{isAuthenticated}
		isSubmitting={isReserving}
		{onreserve}
		onclose={onreservemodalclose}
	/>
{/if}

<!-- Share Wizard (owner only) -->
{#if isOwner}
	<ShareWizard {wishlistId} {wishlistTitle} {giftCount} {onshared} />
{/if}

<!-- Theme Selector Dialog (owner only) -->
{#if isOwner}
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

<!-- Moderator Panel (owner only) -->
{#if isOwner}
	<ModeratorPanel
		{wishlistId}
		{ownerIsModerator}
		bind:open={moderatorPanelOpen}
		onselfpromoted={onmoderatorselfpromoted}
	/>
{/if}

<!-- Batch Add Gifts Dialog (owner/moderator only) -->
{#if isOwnerOrModerator}
	<GiftDraftDialog
		bind:open={batchAddDialogOpen}
		{wishlistTitle}
		isSubmitting={isBatchSubmitting}
		onsubmit={onbatchsubmit}
		onOpenChange={onbatchdialogopenchange}
	/>
{/if}

<!-- Login prompt (shown when an anonymous visitor taps the like heart) -->
<LoginPromptDialog bind:open={authPromptOpen} />
