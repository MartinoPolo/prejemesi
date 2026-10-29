import { describe, expect, it, vi } from 'vitest';
import { createUploadToken, TOKEN_PURPOSES } from '$lib/server/crypto/upload_token.js';

const KEY = 'wishlist-assignment-test-signing-secret';
vi.mock('$lib/server/crypto/auth_signing_key.js', () => ({ getAuthSigningKey: () => KEY }));
vi.mock('@sveltejs/kit', () => ({
	error: (status: number, message: string) => {
		throw Object.assign(new Error(message), { status });
	},
}));

const { assertWishlistUploadAssignment } = await import('./wishlist_image_assignment.js');

async function proof(objectKey: string, userId: string) {
	return (await createUploadToken(objectKey, userId, KEY, TOKEN_PURPOSES.delete)).token;
}

function assertBanner(userId: string, objectKey: string, token: string | undefined) {
	return assertWishlistUploadAssignment(userId, objectKey, token, 'wishlist-banner');
}

describe('wishlist banner assignment proof', () => {
	it('accepts the exact wishlist-banner key uploaded by the authenticated user', async () => {
		const objectKey = 'wishlists/banners/owned.webp';
		await expect(
			assertBanner('owner', objectKey, await proof(objectKey, 'owner')),
		).resolves.toBeUndefined();
	});

	it('rejects planting another uploader’s key', async () => {
		const objectKey = 'wishlists/banners/victim.webp';
		await expect(
			assertBanner('attacker', objectKey, await proof(objectKey, 'victim')),
		).rejects.toMatchObject({ status: 403 });
	});

	it('rejects a proof issued for a different object key', async () => {
		await expect(
			assertBanner(
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
		await expect(assertBanner('owner', objectKey, token)).rejects.toMatchObject({
			status: 403,
		});
	});

	it('rejects an upload-purpose token', async () => {
		const objectKey = 'wishlists/banners/upload-token.webp';
		const token = (await createUploadToken(objectKey, 'owner', KEY, TOKEN_PURPOSES.upload))
			.token;
		await expect(assertBanner('owner', objectKey, token)).rejects.toMatchObject({
			status: 403,
		});
	});

	it('rejects a missing proof', async () => {
		await expect(
			assertBanner('owner', 'wishlists/banners/owned.webp', undefined),
		).rejects.toMatchObject({ status: 403 });
	});

	it('rejects a signed key outside the wishlist-banner prefix', async () => {
		const objectKey = 'gifts/victim.webp';
		await expect(
			assertBanner('owner', objectKey, await proof(objectKey, 'owner')),
		).rejects.toMatchObject({ status: 403 });
	});
});

describe('wishlist background assignment proof', () => {
	it('accepts a background key uploaded by the authenticated user', async () => {
		const objectKey = 'wishlists/backgrounds/owned.webp';
		await expect(
			assertWishlistUploadAssignment(
				'owner',
				objectKey,
				await proof(objectKey, 'owner'),
				'wishlist-background',
			),
		).resolves.toBeUndefined();
	});

	it('rejects a banner key assigned as the background', async () => {
		const objectKey = 'wishlists/banners/owned.webp';
		await expect(
			assertWishlistUploadAssignment(
				'owner',
				objectKey,
				await proof(objectKey, 'owner'),
				'wishlist-background',
			),
		).rejects.toMatchObject({ status: 403 });
	});
});
