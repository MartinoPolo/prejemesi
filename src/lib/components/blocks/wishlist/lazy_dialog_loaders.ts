import { lazyComponent } from '$lib/components/derived/lazy-dialog/index.js';

// One loader per dialog module, shared by every mount and trigger, so a chunk preloaded on
// intent or in idle time is the one the dialog renders. Manager-only and rarely opened
// dialogs stay out of the chunks every wishlist visitor downloads.

export const createWishlistModalLoader = lazyComponent(
	() => import('./CreateWishlistModal.svelte'),
);
export const giftBulkCopyDialogLoader = lazyComponent(() => import('./GiftBulkCopyDialog.svelte'));
export const wishlistSettingsModalLoader = lazyComponent(
	() => import('./WishlistSettingsModal.svelte'),
);
export const editRecipientDialogLoader = lazyComponent(
	() => import('./EditRecipientDialog.svelte'),
);
export const shareWizardLoader = lazyComponent(
	() => import('$lib/components/blocks/sharing/ShareWizard.svelte'),
);
export const moderatorPanelLoader = lazyComponent(
	() => import('$lib/components/blocks/moderator/ModeratorPanel.svelte'),
);
export const giftDraftDialogLoader = lazyComponent(
	() => import('$lib/components/blocks/gift-draft-grid/GiftDraftDialog.svelte'),
);
export const giftCategoryQuickAddDialogLoader = lazyComponent(
	() => import('$lib/components/blocks/gift/GiftCategoryQuickAddDialog.svelte'),
);
export const releaseReservationFlowLoader = lazyComponent(
	() => import('$lib/components/blocks/reservation/ReleaseReservationFlow.svelte'),
);
export const wishlistAssistantLoader = lazyComponent(
	() => import('$lib/components/blocks/chat/WishlistAssistant.svelte'),
);
