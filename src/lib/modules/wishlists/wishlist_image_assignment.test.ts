import { describe, expect, it, vi } from 'vitest';
import { createUploadToken, TOKEN_PURPOSES } from '$lib/server/crypto/upload_token.js';

const KEY = 'wishlist-assignment-test-signing-secret';
vi.mock('$lib/server/crypto/auth_signing_key.js', () => ({ getAuthSigningKey: () => KEY }));
vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		throw Object.assign(new Error(message), { status });
	},
}));

const { assertWishlistBannerAssignment } = await import('./wishlist_image_assignment.js');

async function proof(objectKey: string, userId: string) {
	return (await createUploadToken(objectKey, userId, KEY, TOKEN_PURPOSES.delete)).token;
}

describe('wishlist banner assignment proof', () => {
	it('accepts the exact wishlist-banner key uploaded by the authenticated user', async () => {
		const objectKey = 'wishlists/banners/owned.webp';
		await expect(
			assertWishlistBannerAssignment('owner', objectKey, await proof(objectKey, 'owner')),
		).resolves.toBeUndefined();
	});

	it('rejects planting another uploader’s key', async () => {
		const objectKey = 'wishlists/banners/victim.webp';
		await expect(
			assertWishlistBannerAssignment('attacker', objectKey, await proof(objectKey, 'victim')),
		).rejects.toMatchObject({ status: 403 });
	});

	it('rejects a proof issued for a different object key', async () => {
		await expect(
			assertWishlistBannerAssignment(
				'owner',
				'wishlists/banners/planted.webp',
				await proof('wishlists/banners/owned.webp', 'owner'),
			),
		).rejects.toMatchObject({ status: 403 });
	});

	it('rejects an expired proof', async () => {
		const objectKey = 'wishlists/banners/expired.webp';
		const token = (await createUploadToken(objectKey, 'owner', KEY, TOKEN_PURPOSES.delete, -1))
			.token;
		await expect(
			assertWishlistBannerAssignment('owner', objectKey, token),
		).rejects.toMatchObject({ status: 403 });
	});

	it('rejects an upload-purpose token', async () => {
		const objectKey = 'wishlists/banners/upload-token.webp';
		const token = (await createUploadToken(objectKey, 'owner', KEY, TOKEN_PURPOSES.upload))
			.token;
		await expect(
			assertWishlistBannerAssignment('owner', objectKey, token),
		).rejects.toMatchObject({ status: 403 });
	});

	it('rejects a signed key outside the wishlist-banner prefix', async () => {
		const objectKey = 'gifts/victim.webp';
		await expect(
			assertWishlistBannerAssignment('owner', objectKey, await proof(objectKey, 'owner')),
		).rejects.toMatchObject({ status: 403 });
	});
});
