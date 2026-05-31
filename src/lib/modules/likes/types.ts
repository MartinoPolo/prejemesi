import type { giftLike } from '$lib/server/db/gift.schema.js';

/** Full gift like row from DB */
export type GiftLike = typeof giftLike.$inferSelect;

/** Input for toggling a like */
export interface ToggleLikeInput {
	giftId: string;
}

/** Result of toggling a like */
export interface ToggleLikeResult {
	liked: boolean;
	likeCount: number;
}
