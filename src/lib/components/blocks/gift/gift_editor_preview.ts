import type { PublicGiftCategory } from '$lib/modules/gift-categories/types.js';
import type { GiftImage } from '$lib/modules/gifts/gift_images.js';
import type { DescriptionAppend, GiftForVisitor, GiftLink } from '$lib/modules/gifts/types.js';

/** A preview id distinct from every real gift, so the preview never touches a real card's state. */
const EDITOR_PREVIEW_GIFT_ID = 'gift-editor-preview';

export interface GiftEditorPreviewValues {
	wishlistId: string;
	name: string;
	description: string | null;
	descriptionAppends: DescriptionAppend[];
	links: GiftLink[];
	price: number | null;
	priceMax: number | null;
	currency: string;
	quantity: number | null;
	priorityLabel: string | null;
	categories: PublicGiftCategory[];
	/** The gallery in the order the preview shows it; the first image is the one shown. */
	images: GiftImage[];
}

/**
 * The gift as an available, unreserved visitor sees it, built from the editor's live values. It
 * carries no likes or reservations, so the preview never reveals them to a recipient.
 */
export function giftEditorPreview(values: GiftEditorPreviewValues): GiftForVisitor {
	const shownImage = values.images[0] ?? null;
	return {
		id: EDITOR_PREVIEW_GIFT_ID,
		wishlistId: values.wishlistId,
		name: values.name,
		description: values.description,
		descriptionAppends: values.descriptionAppends,
		editedAfterShareAt: null,
		links: values.links,
		price: values.price,
		priceMax: values.priceMax,
		currency: values.currency,
		imageUrl: shownImage?.imageUrl ?? null,
		imageKey: shownImage?.imageKey ?? null,
		imageMeta: shownImage?.imageMeta ?? null,
		images: values.images,
		quantity: values.quantity,
		sortOrder: 0,
		received: false,
		createdAt: new Date(0),
		priorityLevelId: null,
		priorityLabel: values.priorityLabel,
		prioritySortOrder: null,
		categoryIds: values.categories.map((category) => category.id),
		categories: values.categories,
		likeCount: 0,
		reservedCount: 0,
		isFullyReserved: false,
		reserverNames: [],
		myReservationId: null,
		myReservationPurchasedAt: null,
		myReservationQuantity: 0,
		myReservationOnLinkedCopy: false,
		reservedOnLinkedCopiesCount: 0,
		linkedCopies: [],
		linkGroupKind: null,
		sharedWith: [],
	};
}
