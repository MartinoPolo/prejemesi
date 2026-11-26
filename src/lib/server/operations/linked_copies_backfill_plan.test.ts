import { describe, expect, it } from 'vitest';
import {
	AMBIGUITY_REASON,
	RECEIVED_MERGE,
	formatPlanSummary,
	matchPairGifts,
	normalizeGiftLink,
	normalizeGiftName,
	parseReviewedPlan,
	type BackfillGift,
	type LinkedCopiesPlan,
} from '../../../../scripts/lib/linked-copies-plan.js';

const UPDATED_AT = new Date('2026-11-01T10:00:00.000Z');

function backfillGift(id: string, values: Partial<BackfillGift> = {}): BackfillGift {
	return {
		id,
		wishlistId: id.startsWith('occasion') ? 'occasion-list' : 'permanent-list',
		name: `Gift ${id}`,
		description: null,
		descriptionAppends: [],
		links: [],
		price: null,
		priceMax: null,
		currency: 'CZK',
		quantity: 1,
		images: [],
		categoryLabels: [],
		received: false,
		linkGroupId: null,
		updatedAt: UPDATED_AT,
		reservedUnits: 0,
		...values,
	};
}

function plannedGift(id: string) {
	return { id, name: id, updatedAt: UPDATED_AT.toISOString(), linkGroupId: null };
}

function reviewedPlan(pairs: unknown[]): unknown {
	return {
		version: 1,
		database: 'localhost:5432/test',
		owner: { id: 'owner', email: 'o@x.cz' },
		pairs,
	};
}

function reviewedPair(confirmed: boolean, matches: [string, string][]) {
	return {
		permanentWishlist: { id: 'permanent-list', shortId: 'p', title: 'Stálý' },
		occasionWishlist: { id: 'occasion-list', shortId: 'o', title: 'Vánoce' },
		confirmed,
		matches: matches.map(([occasionId, permanentId]) => ({
			occasion: plannedGift(occasionId),
			permanent: plannedGift(permanentId),
		})),
	};
}

describe('normalizeGiftName', () => {
	it('ignores case, surrounding and repeated whitespace and diacritics', () => {
		expect(normalizeGiftName('  Žluťoučký   KŮŇ ')).toBe(normalizeGiftName('zlutoucky kun'));
	});

	it('keeps different words apart', () => {
		expect(normalizeGiftName('Lego Technic')).not.toBe(normalizeGiftName('Lego City'));
	});
});

describe('normalizeGiftLink', () => {
	it('treats scheme, www, case of the host, fragments, tracking and a trailing slash as the same link', () => {
		expect(normalizeGiftLink('https://www.Alza.cz/lego/?utm_source=x#top')).toBe(
			normalizeGiftLink('http://alza.cz/lego'),
		);
	});

	it('keeps product query parameters', () => {
		expect(normalizeGiftLink('https://shop.cz/p?id=1')).not.toBe(
			normalizeGiftLink('https://shop.cz/p?id=2'),
		);
	});

	it('ignores a value that is not a URL', () => {
		expect(normalizeGiftLink('not a url')).toBeNull();
	});
});

describe('matchPairGifts', () => {
	it('matches a name found once on each list and reports what the permanent copy takes over', () => {
		const result = matchPairGifts(
			[backfillGift('occasion-lego', { name: 'LEGO  Technic', price: 1200, received: true })],
			[backfillGift('permanent-lego', { name: 'lego technic', price: 999 })],
		);

		expect(result.matches).toHaveLength(1);
		const [match] = result.matches;
		expect(match?.occasion.id).toBe('occasion-lego');
		expect(match?.permanent.id).toBe('permanent-lego');
		expect(match?.differences.map((difference) => difference.field)).toEqual(['name', 'price']);
		expect(match?.receivedMerge).toBe(RECEIVED_MERGE.permanentBecomesReceived);
		expect(result.ambiguous).toEqual([]);
	});

	it('flags a shared link on a name match', () => {
		const links = [{ url: 'https://www.alza.cz/kolo' }];
		const [match] = matchPairGifts(
			[backfillGift('occasion-kolo', { name: 'Kolo', links })],
			[
				backfillGift('permanent-kolo', {
					name: 'Kolo',
					links: [{ url: 'https://alza.cz/kolo/' }],
				}),
			],
		).matches;

		expect(match?.sharedLinks).toEqual(['alza.cz/kolo']);
	});

	it('leaves a repeated name ambiguous and unlinked', () => {
		const result = matchPairGifts(
			[
				backfillGift('occasion-a', { name: 'Ponožky' }),
				backfillGift('occasion-b', { name: 'ponozky' }),
			],
			[backfillGift('permanent-a', { name: 'Ponožky' })],
		);

		expect(result.matches).toEqual([]);
		expect(result.ambiguous).toEqual([
			expect.objectContaining({
				reason: AMBIGUITY_REASON.duplicateName,
				occasionGifts: [
					expect.objectContaining({ id: 'occasion-a' }),
					expect.objectContaining({ id: 'occasion-b' }),
				],
				permanentGifts: [expect.objectContaining({ id: 'permanent-a' })],
			}),
		]);
	});

	it('leaves gifts that share only a link ambiguous', () => {
		const links = [{ url: 'https://shop.cz/hrnek' }];
		const result = matchPairGifts(
			[backfillGift('occasion-mug', { name: 'Hrnek s kočkou', links })],
			[backfillGift('permanent-mug', { name: 'Kočičí hrnek', links })],
		);

		expect(result.matches).toEqual([]);
		expect(result.ambiguous).toEqual([
			expect.objectContaining({ reason: AMBIGUITY_REASON.sharedLinkOnly }),
		]);
	});

	it('leaves copies already in two different link groups ambiguous', () => {
		const result = matchPairGifts(
			[backfillGift('occasion-book', { name: 'Kniha', linkGroupId: 'group-a' })],
			[backfillGift('permanent-book', { name: 'Kniha', linkGroupId: 'group-b' })],
		);

		expect(result.matches).toEqual([]);
		expect(result.ambiguous).toEqual([
			expect.objectContaining({ reason: AMBIGUITY_REASON.separateLinkGroups }),
		]);
	});

	it('skips gifts already linked to each other and matches a copy linked elsewhere', () => {
		const result = matchPairGifts(
			[
				backfillGift('occasion-linked', { name: 'Hra', linkGroupId: 'group-a' }),
				backfillGift('occasion-elsewhere', { name: 'Míč', linkGroupId: 'group-c' }),
			],
			[
				backfillGift('permanent-linked', { name: 'Hra', linkGroupId: 'group-a' }),
				backfillGift('permanent-ball', { name: 'Míč' }),
			],
		);

		expect(result.alreadyLinked).toBe(1);
		expect(result.matches.map((match) => match.occasion.id)).toEqual(['occasion-elsewhere']);
	});

	it('lists gifts without any candidate as unmatched', () => {
		const result = matchPairGifts(
			[backfillGift('occasion-only', { name: 'Šála' })],
			[backfillGift('permanent-only', { name: 'Čepice' })],
		);

		expect(result.unmatched.occasion.map((gift) => gift.id)).toEqual(['occasion-only']);
		expect(result.unmatched.permanent.map((gift) => gift.id)).toEqual(['permanent-only']);
	});

	it('reports a double reservation when both copies together exceed the shared quantity', () => {
		const [match] = matchPairGifts(
			[backfillGift('occasion-lego', { name: 'Lego', quantity: 1, reservedUnits: 1 })],
			[backfillGift('permanent-lego', { name: 'Lego', quantity: 2, reservedUnits: 1 })],
		).matches;

		expect(match?.reservationConflict).toEqual({
			occasionReservedUnits: 1,
			permanentReservedUnits: 1,
			sharedQuantity: 1,
			bothCopiesReserved: true,
		});
	});

	it('reports no conflict while the reservations fit the shared quantity', () => {
		const [match] = matchPairGifts(
			[backfillGift('occasion-lego', { name: 'Lego', quantity: 2, reservedUnits: 1 })],
			[backfillGift('permanent-lego', { name: 'Lego', reservedUnits: 1 })],
		).matches;

		expect(match?.reservationConflict).toBeNull();
	});
});

describe('parseReviewedPlan', () => {
	it('accepts a reviewed plan', () => {
		const plan = parseReviewedPlan(
			reviewedPlan([reviewedPair(true, [['occasion-a', 'permanent-a']])]),
		);

		expect(plan.pairs[0]?.matches[0]?.occasion.id).toBe('occasion-a');
	});

	it('rejects a gift in two confirmed matches', () => {
		expect(() =>
			parseReviewedPlan(
				reviewedPlan([
					reviewedPair(true, [
						['occasion-a', 'permanent-a'],
						['occasion-b', 'permanent-a'],
					]),
				]),
			),
		).toThrow('gift permanent-a is in 2 confirmed matches');
	});

	it('ignores repeated gifts in pairs left unconfirmed', () => {
		expect(() =>
			parseReviewedPlan(
				reviewedPlan([
					reviewedPair(true, [['occasion-a', 'permanent-a']]),
					reviewedPair(false, [['occasion-b', 'permanent-a']]),
				]),
			),
		).not.toThrow();
	});

	it('rejects a match without the pinned gift state', () => {
		const pair = reviewedPair(true, []);
		expect(() =>
			parseReviewedPlan(
				reviewedPlan([
					{ ...pair, matches: [{ occasion: { id: 'a' }, permanent: plannedGift('b') }] },
				]),
			),
		).toThrow('Invalid plan');
	});

	it('rejects a plan of another version', () => {
		expect(() => parseReviewedPlan({ ...(reviewedPlan([]) as object), version: 2 })).toThrow(
			'Invalid plan',
		);
	});
});

describe('formatPlanSummary', () => {
	it('names each pair, its matches and the ambiguous candidates', () => {
		const plan: LinkedCopiesPlan = {
			version: 1,
			createdAt: UPDATED_AT.toISOString(),
			database: 'localhost:5432/test',
			owner: { id: 'owner', email: 'owner@test.cz', name: 'Owner' },
			pairs: [
				{
					permanentWishlist: {
						id: 'p',
						shortId: 'p1',
						title: 'Stálý',
						occasion: 'permanent',
						status: 'active',
					},
					occasionWishlist: {
						id: 'o',
						shortId: 'o1',
						title: 'Vánoce',
						occasion: 'christmas',
						status: 'active',
					},
					confirmed: false,
					...matchPairGifts(
						[
							backfillGift('occasion-lego', { name: 'Lego' }),
							backfillGift('occasion-a', { name: 'Ponožky' }),
							backfillGift('occasion-b', { name: 'Ponožky' }),
						],
						[
							backfillGift('permanent-lego', { name: 'Lego' }),
							backfillGift('permanent-a', { name: 'Ponožky' }),
						],
					),
				},
			],
			warnings: [],
		};

		const summary = formatPlanSummary(plan);

		expect(summary).toContain('„Stálý“ (p1) → „Vánoce“ (o1)');
		expect(summary).toContain('Lego  ⇐  Lego');
		expect(summary).toContain('? duplicateName: Ponožky | Ponožky  ⇔  Ponožky');
	});
});
