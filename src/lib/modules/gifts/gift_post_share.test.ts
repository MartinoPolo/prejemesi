import { describe, it, expect } from 'vitest';
import { computePreShareOwnerEdit, type PreShareGiftSnapshot } from './gift_post_share.js';
import type { UpdateGiftInput } from './types.js';

const NOW = new Date('2024-02-01T12:00:00.000Z');

function makeCurrent(overrides: Partial<PreShareGiftSnapshot> = {}): PreShareGiftSnapshot {
	return {
		name: 'Camera',
		description: null,
		descriptionAppends: [],
		quantity: 3,
		price: 1000,
		currency: 'CZK',
		imageUrl: null,
		imageKey: null,
		imageMeta: null,
		links: [],
		priorityLevelId: null,
		...overrides,
	};
}

function makeInput(overrides: Partial<UpdateGiftInput> = {}): UpdateGiftInput {
	return { id: 'gift-1', ...overrides };
}

describe('computePreShareOwnerEdit', () => {
	describe('name', () => {
		it('ignores name when unchanged (never writes name)', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ name: 'Camera' }),
				makeInput({ name: 'Camera' }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect('name' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(false);
		});

		it('ignores absent name', () => {
			const outcome = computePreShareOwnerEdit(makeCurrent(), makeInput(), NOW);
			expect(outcome.rejection).toBeNull();
			expect('name' in outcome.updateData).toBe(false);
		});

		it('rejects with 403 CANNOT_EDIT_AFTER_SHARING when name changes', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ name: 'Camera' }),
				makeInput({ name: 'New Camera' }),
				NOW,
			);
			expect(outcome.rejection).toEqual({ status: 403, code: 'CANNOT_EDIT_AFTER_SHARING' });
		});
	});

	describe('quantity', () => {
		it('allows raising quantity and writes it', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ quantity: 3 }),
				makeInput({ quantity: 5 }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.updateData.quantity).toBe(5);
			expect(outcome.changed).toBe(true);
		});

		it('treats equal quantity as no change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ quantity: 3 }),
				makeInput({ quantity: 3 }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.changed).toBe(false);
		});

		it('rejects with 400 QUANTITY_CANNOT_BE_LOWERED when lowering', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ quantity: 3 }),
				makeInput({ quantity: 1 }),
				NOW,
			);
			expect(outcome.rejection).toEqual({ status: 400, code: 'QUANTITY_CANNOT_BE_LOWERED' });
		});

		it('uses default quantity of 1 when current quantity is null', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ quantity: null }),
				makeInput({ quantity: 1 }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.changed).toBe(false);
		});
	});

	describe('description append engine', () => {
		it('appends a timestamped segment when base description is non-empty', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original description', descriptionAppends: [] }),
				makeInput({ description: 'blue variant' }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			// Original base untouched
			expect('description' in outcome.updateData).toBe(false);
			expect(outcome.updateData.descriptionAppends).toEqual([
				{ text: 'blue variant', addedAt: NOW.toISOString() },
			]);
			expect(outcome.changed).toBe(true);
		});

		it('preserves existing appends and adds the new one', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					description: 'Original',
					descriptionAppends: [{ text: 'first', addedAt: '2024-01-01T00:00:00.000Z' }],
				}),
				makeInput({ description: 'second' }),
				NOW,
			);
			expect(outcome.updateData.descriptionAppends).toEqual([
				{ text: 'first', addedAt: '2024-01-01T00:00:00.000Z' },
				{ text: 'second', addedAt: NOW.toISOString() },
			]);
		});

		it('fills the main description when base is null (empty-at-share, no append)', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: null }),
				makeInput({ description: 'now has text' }),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.updateData.description).toBe('now has text');
			expect('descriptionAppends' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(true);
		});

		it('fills the main description when base is whitespace-only', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: '   ' }),
				makeInput({ description: 'now has text' }),
				NOW,
			);
			expect(outcome.updateData.description).toBe('now has text');
			expect('descriptionAppends' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(true);
		});

		it('is a no-op when input description is undefined', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original' }),
				makeInput(),
				NOW,
			);
			expect('description' in outcome.updateData).toBe(false);
			expect('descriptionAppends' in outcome.updateData).toBe(false);
		});

		it('is a no-op when input description is null', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original' }),
				makeInput({ description: null }),
				NOW,
			);
			expect('description' in outcome.updateData).toBe(false);
			expect('descriptionAppends' in outcome.updateData).toBe(false);
		});

		it('is a no-op when input description is empty/whitespace', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: 'Original' }),
				makeInput({ description: '   ' }),
				NOW,
			);
			expect('description' in outcome.updateData).toBe(false);
			expect('descriptionAppends' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(false);
		});

		it('never clears the frozen base when input description is empty and base is empty', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ description: null }),
				makeInput({ description: '' }),
				NOW,
			);
			expect('description' in outcome.updateData).toBe(false);
			expect(outcome.changed).toBe(false);
		});
	});

	describe('image / links / price / currency / priority', () => {
		it('detects price change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ price: 1000 }),
				makeInput({ price: 1500 }),
				NOW,
			);
			expect(outcome.updateData.price).toBe(1500);
			expect(outcome.changed).toBe(true);
		});

		it('detects currency change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ currency: 'CZK' }),
				makeInput({ currency: 'EUR' }),
				NOW,
			);
			expect(outcome.updateData.currency).toBe('EUR');
			expect(outcome.changed).toBe(true);
		});

		it('detects priorityLevelId change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ priorityLevelId: null }),
				makeInput({ priorityLevelId: 'prio-1' }),
				NOW,
			);
			expect(outcome.updateData.priorityLevelId).toBe('prio-1');
			expect(outcome.changed).toBe(true);
		});

		it('detects imageUrl/imageKey change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ imageUrl: null, imageKey: null }),
				makeInput({ imageUrl: 'https://img/x.jpg', imageKey: 'gifts/x.jpg' }),
				NOW,
			);
			expect(outcome.updateData.imageUrl).toBe('https://img/x.jpg');
			expect(outcome.updateData.imageKey).toBe('gifts/x.jpg');
			expect(outcome.changed).toBe(true);
		});

		it('detects imageMeta change via JSON compare', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ imageMeta: null }),
				makeInput({ imageMeta: { fitMode: 'cover-crop' } }),
				NOW,
			);
			expect(outcome.updateData.imageMeta).toEqual({ fitMode: 'cover-crop' });
			expect(outcome.changed).toBe(true);
		});

		it('detects links change after normalization', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ links: [] }),
				makeInput({ links: [{ url: ' https://example.com/path ' }] }),
				NOW,
			);
			expect(outcome.updateData.links).toEqual([{ url: 'https://example.com/path' }]);
			expect(outcome.changed).toBe(true);
		});

		it('treats normalized-identical links as no change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ links: [{ url: 'https://example.com/path' }] }),
				makeInput({ links: [{ url: ' https://example.com/path ' }] }),
				NOW,
			);
			expect(outcome.changed).toBe(false);
		});

		it('treats identical price/currency/priority as no change', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ price: 1000, currency: 'CZK', priorityLevelId: 'prio-1' }),
				makeInput({ price: 1000, currency: 'CZK', priorityLevelId: 'prio-1' }),
				NOW,
			);
			expect(outcome.changed).toBe(false);
		});
	});

	describe('idempotency', () => {
		it('changed=false when nothing differs', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({
					name: 'Camera',
					description: 'Original',
					quantity: 3,
					price: 1000,
					currency: 'CZK',
					links: [{ url: 'https://example.com/' }],
				}),
				makeInput({
					name: 'Camera',
					quantity: 3,
					price: 1000,
					currency: 'CZK',
					links: [{ url: 'https://example.com' }],
				}),
				NOW,
			);
			expect(outcome.rejection).toBeNull();
			expect(outcome.changed).toBe(false);
		});
	});

	describe('rejection short-circuits before building updateData', () => {
		it('returns rejection without writing other allowed fields', () => {
			const outcome = computePreShareOwnerEdit(
				makeCurrent({ name: 'Camera', price: 1000 }),
				makeInput({ name: 'New Name', price: 2000 }),
				NOW,
			);
			expect(outcome.rejection).toEqual({ status: 403, code: 'CANNOT_EDIT_AFTER_SHARING' });
			// Short-circuit: no allowed field is written and nothing is flagged as changed,
			// even though price was also supplied.
			expect(outcome.updateData).toEqual({});
			expect(outcome.changed).toBe(false);
		});
	});
});
