import { describe, expect, it } from 'vitest';
import {
	isOwnerSharedGiftDeleteGraceOpen,
	ownerSharedGiftDeleteGraceExpiresAt,
	preShareOwnerFullEditGraceExpiresAt,
} from './gift_deletion_rules.js';
import { GRACE_WINDOW_MS } from '$lib/modules/sharing/grace_window.js';

const SHARED_AT = new Date('2026-07-02T12:00:00.000Z');
const BEFORE_SHARING = new Date('2026-07-02T11:00:00.000Z');
const AFTER_SHARING = new Date('2026-07-02T12:10:00.000Z');

describe('gift deletion grace rules', () => {
	it('opens pre-share gift delete grace from the wishlist sharedAt timestamp', () => {
		const expiresAt = ownerSharedGiftDeleteGraceExpiresAt({
			wishlistSharedAt: SHARED_AT,
			giftCreatedAt: BEFORE_SHARING,
		});

		expect(expiresAt).toEqual(new Date(SHARED_AT.getTime() + GRACE_WINDOW_MS));
		expect(
			isOwnerSharedGiftDeleteGraceOpen(
				{ wishlistSharedAt: SHARED_AT, giftCreatedAt: BEFORE_SHARING },
				new Date(SHARED_AT.getTime() + 60_000),
			),
		).toBe(true);
	});

	it('opens post-share gift delete grace from the gift creation timestamp', () => {
		const expiresAt = ownerSharedGiftDeleteGraceExpiresAt({
			wishlistSharedAt: SHARED_AT,
			giftCreatedAt: AFTER_SHARING,
		});

		expect(expiresAt).toEqual(new Date(AFTER_SHARING.getTime() + GRACE_WINDOW_MS));
		expect(
			isOwnerSharedGiftDeleteGraceOpen(
				{ wishlistSharedAt: SHARED_AT, giftCreatedAt: AFTER_SHARING },
				new Date(AFTER_SHARING.getTime() + 60_000),
			),
		).toBe(true);
	});

	it('does not open full-edit grace for gifts created after sharing', () => {
		expect(
			preShareOwnerFullEditGraceExpiresAt({
				wishlistSharedAt: SHARED_AT,
				giftCreatedAt: AFTER_SHARING,
			}),
		).toBeNull();
	});

	it('closes post-share gift delete grace exactly at the two-minute boundary', () => {
		expect(
			isOwnerSharedGiftDeleteGraceOpen(
				{ wishlistSharedAt: SHARED_AT, giftCreatedAt: AFTER_SHARING },
				new Date(AFTER_SHARING.getTime() + GRACE_WINDOW_MS),
			),
		).toBe(false);
	});
});
