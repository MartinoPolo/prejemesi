import { describe, expect, it } from 'vitest';
import * as claimInviteOperations from './claim_invite_operations.js';
import * as giftBulkOperations from './gift_bulk_operations.js';
import * as giftGroupingOperations from './gift_grouping_operations.js';
import * as giftLikeOperations from './gift_like_operations.js';
import * as giftMutationOperations from './gift_mutation_operations.js';
import * as giftReadOperations from './gift_read_operations.js';
import * as giftUndoOperations from './gift_undo_operations.js';
import * as importOperations from './import_operations.js';
import * as managerInvitationOperations from './manager_invitation_operations.js';
import * as reservationOperations from './reservation_operations.js';
import * as reservationReadOperations from './reservation_read_operations.js';
import * as wishlistDetailOperations from './wishlist_detail_operations.js';
import * as wishlistFollowOperations from './wishlist_follow_operations.js';
import * as wishlistLifecycleOperations from './wishlist_lifecycle_operations.js';
import * as wishlistReadOperations from './wishlist_read_operations.js';
import { OPERATION_EXPOSURE, OPERATION_KIND } from './operation.js';
import { OPERATION_REGISTRY } from './registry.js';

const operationModules = [
	giftReadOperations,
	giftMutationOperations,
	giftBulkOperations,
	giftUndoOperations,
	giftGroupingOperations,
	importOperations,
	wishlistDetailOperations,
	wishlistLifecycleOperations,
	reservationOperations,
	reservationReadOperations,
	managerInvitationOperations,
	claimInviteOperations,
	wishlistReadOperations,
	wishlistFollowOperations,
	giftLikeOperations,
];

describe('operation registry', () => {
	it('registers every operation under its own name', () => {
		for (const [name, operation] of Object.entries(OPERATION_REGISTRY)) {
			expect(operation.name).toBe(name);
		}
	});

	it('gives every operation a kind, an exposure and a validating input schema', () => {
		for (const operation of Object.values(OPERATION_REGISTRY)) {
			expect(Object.values(OPERATION_KIND)).toContain(operation.kind);
			expect(Object.values(OPERATION_EXPOSURE)).toContain(operation.exposure);
			expect(operation.input).toHaveProperty('~standard');
		}
	});

	it('keeps lifecycle, reservation release, správce administration beyond inviting, claim links, personal follows and likes, restoring the order a proposal replaced and the inline category quick-add with the human user', () => {
		const humanOnlyNames = Object.values(OPERATION_REGISTRY)
			.filter((operation) => operation.exposure === OPERATION_EXPOSURE.humanOnly)
			.map((operation) => operation.name)
			.sort();
		expect(humanOnlyNames).toEqual(
			[
				'archiveWishlist',
				'deleteWishlist',
				'flipRecipientToFreeText',
				'revertWishlistToDraft',
				'shareWishlist',
				'unreserveGift',
				'readReservationLedger',
				'readWishlistModerators',
				'acceptModeratorInvite',
				'revokeModeratorInvite',
				'removeModerator',
				'selfPromoteToModerator',
				'readClaimInvites',
				'generateClaimInviteLink',
				'acceptClaimInvite',
				'revokeClaimInvite',
				'followWishlist',
				'unfollowWishlist',
				'refollowWishlist',
				'recordWishlistVisit',
				'toggleGiftLike',
				'restoreGiftOrder',
				'createGiftCategory',
			].sort(),
		);
	});

	it('lets agents reserve where the user may and invite managers', () => {
		for (const operationName of [
			'reserveGift',
			'cancelOwnReservation',
			'setReservationPurchased',
			'generateModeratorInviteLink',
		] as const) {
			expect(OPERATION_REGISTRY[operationName].exposure).toBe(OPERATION_EXPOSURE.agent);
		}
	});

	it('lets agents list and read wishlists and the categories they manage', () => {
		for (const operationName of [
			'readAccessibleWishlists',
			'readWishlist',
			'readGiftCategories',
			'readGiftCategorySettingsRows',
		] as const) {
			expect(OPERATION_REGISTRY[operationName].exposure).toBe(OPERATION_EXPOSURE.agent);
		}
	});

	it('contains every exported operation, so generated agent surfaces miss none', () => {
		const registered = new Set<unknown>(Object.values(OPERATION_REGISTRY));
		const exported = operationModules.flatMap((module) =>
			Object.entries(module)
				.filter(([exportName]) => exportName.endsWith('Operation'))
				.map(([, value]) => value),
		);
		expect(exported.length).toBeGreaterThan(0);
		for (const operation of exported) {
			expect(registered.has(operation)).toBe(true);
		}
	});
});
