import { describe, expect, it } from 'vitest';
import { WISHLIST_ROLES } from '$lib/modules/wishlists/types.js';
import { makeGift, recipientShapedGift } from './gift_ordering.test_fixtures.js';
import {
	SHARED_GIFT_AUDIENCE,
	sharedGiftAudience,
	sharedGiftBadgeNames,
	sharedGiftExplanationText,
	sharedGiftQuantityText,
} from './shared_gift_copy.js';

/** Czech list formatting keeps the conjunction „a“ with the next name by a no-break space. */
function plainSpaces(text: string): string {
	return text.replaceAll(String.fromCharCode(0xa0), ' ');
}

describe('shared gift copy (issue #737)', () => {
	it('chooses the audience from the role and the gift shape', () => {
		expect(sharedGiftAudience(makeGift(), WISHLIST_ROLES.recipient)).toBe(
			SHARED_GIFT_AUDIENCE.ownRecipient,
		);
		expect(sharedGiftAudience(makeGift(), WISHLIST_ROLES.visitor)).toBe(
			SHARED_GIFT_AUDIENCE.gifter,
		);
		expect(sharedGiftAudience(recipientShapedGift(), WISHLIST_ROLES.moderator)).toBe(
			SHARED_GIFT_AUDIENCE.otherRecipient,
		);
	});

	it('names two recipients and counts the rest on the badge, never declining names', () => {
		expect(sharedGiftBadgeNames(['Anička'])).toBe('Anička');
		expect(plainSpaces(sharedGiftBadgeNames(['Anička', 'Petr']))).toBe('Anička a Petr');
		expect(sharedGiftBadgeNames(['Anička', 'Petr', 'Eva'])).toBe('Anička, Petr a 1 další');
		expect(sharedGiftBadgeNames(['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toBe('A, B a 5 dalších');
	});

	it('tells gifters that reserving gives the gift to everyone at once', () => {
		expect(
			plainSpaces(
				sharedGiftExplanationText(
					SHARED_GIFT_AUDIENCE.gifter,
					['Tomáš', 'Anička'],
					['Anička'],
				),
			),
		).toBe(
			'Tento dárek si přejí Tomáš a Anička společně. Když ho zarezervujete, darujete ho oběma najednou, ne každému zvlášť.',
		);
		expect(
			sharedGiftExplanationText(
				SHARED_GIFT_AUDIENCE.gifter,
				['Tomáš', 'Anička', 'Petr'],
				['Anička', 'Petr'],
			),
		).toContain('darujete ho všem najednou');
	});

	it('never tells recipients anything about reserving it themselves', () => {
		const own = sharedGiftExplanationText(
			SHARED_GIFT_AUDIENCE.ownRecipient,
			['Tomáš', 'Anička'],
			['Anička'],
		);
		expect(own).toBe(
			'Tento dárek si přejete společně s: Anička. Dárci ho rezervují jednou pro vás oba.',
		);
		expect(own).not.toContain('zarezervujete');
		expect(
			sharedGiftExplanationText(
				SHARED_GIFT_AUDIENCE.otherRecipient,
				['Tomáš', 'Anička'],
				['Anička'],
			),
		).not.toContain('zarezervujete');
	});

	it('states the quantity as one shared total', () => {
		expect(sharedGiftQuantityText(3, 2, SHARED_GIFT_AUDIENCE.gifter)).toBe(
			'Počet: 3 ks celkem pro oba dohromady, ne 3 ks pro každého',
		);
		expect(sharedGiftQuantityText(3, 3, SHARED_GIFT_AUDIENCE.ownRecipient)).toBe(
			'Počet: 3 ks celkem pro všechny dohromady',
		);
		expect(sharedGiftQuantityText(1, 2, SHARED_GIFT_AUDIENCE.gifter)).toBe(
			'Počet: 1 ks pro oba dohromady',
		);
	});
});
