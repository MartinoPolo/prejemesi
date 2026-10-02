import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDemoCatalog } from './catalog.js';

for (const locale of ['cs', 'en'] as const) {
	describe(`${locale} demo catalog`, () => {
		it('provides varied starting lists across roles, occasions and lifecycle states', () => {
			const wishlists = getDemoCatalog(locale);
			expect(wishlists).toHaveLength(8);
			expect(wishlists.map(({ key }) => key)).toEqual([
				...new Set(wishlists.map(({ key }) => key)),
			]);
			expect(wishlists.filter(({ role }) => role === 'own')).toHaveLength(3);
			expect(wishlists.filter(({ role }) => role === 'managed')).toHaveLength(2);
			expect(wishlists.filter(({ role }) => role === 'followed')).toHaveLength(3);
			expect(wishlists.filter(({ status }) => status === 'draft')).toHaveLength(1);
			expect(wishlists.filter(({ status }) => status === 'archived')).toHaveLength(1);
			expect(new Set(wishlists.map(({ occasion }) => occasion))).toEqual(
				new Set(['ongoing', 'birthday', 'christmas']),
			);
			for (const wishlist of wishlists) {
				expect(wishlist.title.trim()).not.toBe('');
				expect(wishlist.description.trim()).not.toBe('');
				expect(wishlist.recipientName.trim()).not.toBe('');
				expect(wishlist.gifts).toHaveLength(15);
				expect(new Set(wishlist.gifts.map(({ name }) => name)).size).toBe(15);
			}
			const signatures = wishlists.map(({ gifts }) =>
				gifts.map(({ name }) => name).join('|'),
			);
			expect(new Set(signatures).size).toBe(8);
		});

		it('uses reviewed local images, relevant links, prices and plausible gift states', () => {
			const wishlists = getDemoCatalog(locale);
			const gifts = wishlists.flatMap(({ gifts }) => gifts);
			expect(gifts.filter(({ priority }) => priority === 'medium').length).toBeGreaterThan(
				75,
			);
			expect(gifts.filter(({ state }) => state === 'available').length).toBeGreaterThan(90);
			expect(gifts.some(({ state }) => state === 'reserved')).toBe(true);
			expect(gifts.some(({ state }) => state === 'received')).toBe(true);
			const imageSubjects = new Map<string, string>();
			for (const gift of gifts) {
				const previousSubject = imageSubjects.get(gift.imageUrl);
				if (previousSubject !== undefined) {
					expect(gift.name).toBe(previousSubject);
				}
				imageSubjects.set(gift.imageUrl, gift.name);
				expect(gift.name.trim()).not.toBe('');
				expect(gift.description.trim()).not.toBe('');
				expect(gift.category.trim()).not.toBe('');
				expect(gift.price).toBeGreaterThan(0);
				expect(Number.isFinite(gift.price)).toBe(true);
				expect(new URL(gift.url).protocol).toBe('https:');
				expect(gift.imageUrl).toMatch(/^\/demo\//);
				expect(existsSync(join('static', gift.imageUrl))).toBe(true);
			}
			for (const wishlist of wishlists.filter(({ status }) => status === 'draft')) {
				expect(wishlist.gifts.every(({ state }) => state === 'available')).toBe(true);
			}
		});
	});
}

it('localizes curated copy without changing identities and returns independent editable values', () => {
	const czech = getDemoCatalog('cs');
	const english = getDemoCatalog('en');
	expect(czech.map(({ key }) => key)).toEqual(english.map(({ key }) => key));
	expect(czech.map(({ title }) => title)).not.toEqual(english.map(({ title }) => title));
	for (let index = 0; index < czech.length; index += 1) {
		const csList = czech[index]!;
		const enList = english[index]!;
		expect(csList.recipientName).toBe(enList.recipientName);
		expect(csList.gifts.map(({ imageUrl }) => imageUrl)).toEqual(
			enList.gifts.map(({ imageUrl }) => imageUrl),
		);
		expect(csList.gifts.map(({ description }) => description)).not.toEqual(
			enList.gifts.map(({ description }) => description),
		);
	}
	czech[0]!.gifts[0]!.name = 'Edited';
	czech[0]!.gifts.pop();
	expect(getDemoCatalog('cs')[0]!.gifts).toHaveLength(15);
	expect(getDemoCatalog('cs')[0]!.gifts[0]!.name).not.toBe('Edited');
});
