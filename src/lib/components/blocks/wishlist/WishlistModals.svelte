<script lang="ts">
	import * as Dialog from '$lib/components/base/dialog/index.js';
	import GiftDetailModal from '$lib/components/blocks/gift/GiftDetailModal.svelte';
	import ReserveModal from '$lib/components/blocks/reservation/ReserveModal.svelte';
	import ShareWizard from '$lib/components/blocks/sharing/ShareWizard.svelte';
	import ThemeSelector from '$lib/components/blocks/theme/ThemeSelector.svelte';
	import ModeratorPanel from '$lib/components/blocks/moderator/ModeratorPanel.svelte';
	import type {
		GiftByRole,
		GiftForVisitor,
		GiftPriorityLevel,
		CreateGiftInput,
		UpdateGiftInput,
	} from '$lib/modules/gifts/types.js';
	import type { WishlistTheme } from '$lib/modules/themes/types.js';
	import type { ReserveGiftInput } from '$lib/modules/reservations/types.js';

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
		canEditSelectedGift: boolean;
		canDeleteSelectedGift: boolean;
		isSubmitting: boolean;
		isDeleting: boolean;
		// Reserve modal
		reserveModalOpen: boolean;
		reservingGift: GiftForVisitor | null;
		isReserving: boolean;
		// Theme dialog
		themeDialogOpen: boolean;
		activeTheme: WishlistTheme;
		// Moderator panel
		moderatorPanelOpen: boolean;
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
		canEditSelectedGift,
		canDeleteSelectedGift,
		isSubmitting,
		isDeleting,
		reserveModalOpen = $bindable(),
		reservingGift,
		isReserving,
		themeDialogOpen = $bindable(),
		activeTheme,
		moderatorPanelOpen = $bindable(),
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
		canEdit={canEditSelectedGift}
		canDelete={canDeleteSelectedGift}
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
				<Dialog.Title>Motiv seznamu</Dialog.Title>
				<Dialog.Description
					>Zvolte prednastaveny motiv nebo vlastni barvu.</Dialog.Description
				>
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
