/**
 * Linked copies are one recipient's copies of a gift (issue #742); a shared gift is one gift on
 * wishlists of different recipients (issue #737).
 */
export const GIFT_LINK_GROUP_KIND = {
	linkedCopies: 'linked_copies',
	sharedAcrossRecipients: 'shared_across_recipients',
} as const;

export type GiftLinkGroupKind = (typeof GIFT_LINK_GROUP_KIND)[keyof typeof GIFT_LINK_GROUP_KIND];
