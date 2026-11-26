import * as v from 'valibot';
import { jsonChanged } from '../../src/lib/modules/gifts/gift_post_share.js';
import type { GiftImage } from '../../src/lib/modules/gifts/gift_images.js';
import type { DescriptionAppend, GiftLink } from '../../src/lib/modules/gifts/types.js';

/** A gift as the backfill compares it, with the reservations held across its link group. */
export interface BackfillGift {
	id: string;
	wishlistId: string;
	name: string;
	description: string | null;
	descriptionAppends: DescriptionAppend[];
	links: GiftLink[];
	price: number | null;
	priceMax: number | null;
	currency: string | null;
	quantity: number | null;
	images: GiftImage[];
	categoryLabels: string[];
	received: boolean;
	linkGroupId: string | null;
	updatedAt: Date;
	/** Active reserved units on the gift, or on every live copy of its link group. */
	reservedUnits: number;
}

/** What a plan pins of a gift, so apply can tell whether it changed since propose. */
export interface PlannedGift {
	id: string;
	name: string;
	updatedAt: string;
	linkGroupId: string | null;
}

export interface PlannedWishlist {
	id: string;
	shortId: string;
	title: string;
	occasion: string;
	status: string;
}

export interface FieldDifference {
	field: string;
	occasion: unknown;
	permanent: unknown;
}

export const RECEIVED_MERGE = {
	unchanged: 'unchanged',
	occasionBecomesReceived: 'occasionBecomesReceived',
	permanentBecomesReceived: 'permanentBecomesReceived',
} as const;
export type ReceivedMerge = (typeof RECEIVED_MERGE)[keyof typeof RECEIVED_MERGE];

/** Linked copies whose combined reservations exceed the quantity they will share. */
export interface ReservationConflict {
	occasionReservedUnits: number;
	permanentReservedUnits: number;
	sharedQuantity: number;
	bothCopiesReserved: boolean;
}

export interface ProposedMatch {
	occasion: PlannedGift;
	permanent: PlannedGift;
	sharedLinks: string[];
	differences: FieldDifference[];
	receivedMerge: ReceivedMerge;
	reservationConflict: ReservationConflict | null;
}

export const AMBIGUITY_REASON = {
	duplicateName: 'duplicateName',
	sharedLinkOnly: 'sharedLinkOnly',
	separateLinkGroups: 'separateLinkGroups',
} as const;
type AmbiguityReason = (typeof AMBIGUITY_REASON)[keyof typeof AMBIGUITY_REASON];

export interface AmbiguousCandidate {
	reason: AmbiguityReason;
	occasionGifts: PlannedGift[];
	permanentGifts: PlannedGift[];
}

export interface PlannedPair {
	permanentWishlist: PlannedWishlist;
	occasionWishlist: PlannedWishlist;
	/** Apply links only the matches of a pair someone reviewed and confirmed. */
	confirmed: boolean;
	matches: ProposedMatch[];
	ambiguous: AmbiguousCandidate[];
	alreadyLinked: number;
	unmatched: { occasion: PlannedGift[]; permanent: PlannedGift[] };
}

export interface LinkedCopiesPlan {
	version: 1;
	createdAt: string;
	/** Host and database name the plan was proposed against; apply refuses any other. */
	database: string;
	owner: { id: string; email: string; name: string };
	pairs: PlannedPair[];
	warnings: string[];
}

/** Gift names compared case-, whitespace- and diacritics-insensitively. */
export function normalizeGiftName(name: string): string {
	return name
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLocaleLowerCase('cs')
		.replace(/\s+/g, ' ')
		.trim();
}

/** A purchase link without scheme, `www.`, fragment, tracking parameters or trailing slash. */
export function normalizeGiftLink(url: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url.trim());
	} catch {
		return null;
	}
	for (const parameter of [...parsed.searchParams.keys()]) {
		if (parameter.toLowerCase().startsWith('utm_')) {
			parsed.searchParams.delete(parameter);
		}
	}
	const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
	const path = parsed.pathname.replace(/\/+$/, '');
	return `${host}${path}${parsed.search}`;
}

function normalizedLinks(backfillGift: BackfillGift): Set<string> {
	return new Set(
		backfillGift.links.flatMap((link) => {
			const normalized = normalizeGiftLink(link.url);
			return normalized === null ? [] : [normalized];
		}),
	);
}

function toPlannedGift(backfillGift: BackfillGift): PlannedGift {
	return {
		id: backfillGift.id,
		name: backfillGift.name,
		updatedAt: backfillGift.updatedAt.toISOString(),
		linkGroupId: backfillGift.linkGroupId,
	};
}

const COMPARED_SYNCED_FIELDS = [
	'name',
	'description',
	'descriptionAppends',
	'links',
	'price',
	'priceMax',
	'currency',
	'quantity',
	'images',
	'categoryLabels',
] as const satisfies readonly (keyof BackfillGift)[];

/** The synced values the permanent copy takes over from the occasion copy. */
function syncedFieldDifferences(
	occasionGift: BackfillGift,
	permanentGift: BackfillGift,
): FieldDifference[] {
	return COMPARED_SYNCED_FIELDS.filter((field) =>
		jsonChanged(occasionGift[field], permanentGift[field]),
	).map((field) => ({
		field,
		occasion: occasionGift[field],
		permanent: permanentGift[field],
	}));
}

export function receivedMerge(
	occasionGift: BackfillGift,
	permanentGift: BackfillGift,
): ReceivedMerge {
	if (occasionGift.received === permanentGift.received) {
		return RECEIVED_MERGE.unchanged;
	}
	return occasionGift.received
		? RECEIVED_MERGE.permanentBecomesReceived
		: RECEIVED_MERGE.occasionBecomesReceived;
}

/** The linked copies share the occasion copy's quantity and all of both copies' reservations. */
export function reservationConflict(
	occasionGift: Pick<BackfillGift, 'quantity' | 'reservedUnits'>,
	permanentGift: Pick<BackfillGift, 'reservedUnits'>,
): ReservationConflict | null {
	const sharedQuantity = occasionGift.quantity ?? 1;
	if (occasionGift.reservedUnits + permanentGift.reservedUnits <= sharedQuantity) {
		return null;
	}
	return {
		occasionReservedUnits: occasionGift.reservedUnits,
		permanentReservedUnits: permanentGift.reservedUnits,
		sharedQuantity,
		bothCopiesReserved: occasionGift.reservedUnits > 0 && permanentGift.reservedUnits > 0,
	};
}

function proposedMatch(occasionGift: BackfillGift, permanentGift: BackfillGift): ProposedMatch {
	const permanentLinks = normalizedLinks(permanentGift);
	return {
		occasion: toPlannedGift(occasionGift),
		permanent: toPlannedGift(permanentGift),
		sharedLinks: [...normalizedLinks(occasionGift)].filter((link) => permanentLinks.has(link)),
		differences: syncedFieldDifferences(occasionGift, permanentGift),
		receivedMerge: receivedMerge(occasionGift, permanentGift),
		reservationConflict: reservationConflict(occasionGift, permanentGift),
	};
}

function groupByNormalizedName(gifts: readonly BackfillGift[]): Map<string, BackfillGift[]> {
	const giftsByName = new Map<string, BackfillGift[]>();
	for (const backfillGift of gifts) {
		const key = normalizeGiftName(backfillGift.name);
		giftsByName.set(key, [...(giftsByName.get(key) ?? []), backfillGift]);
	}
	return giftsByName;
}

function isInSeparateLinkGroups(occasionGift: BackfillGift, permanentGift: BackfillGift): boolean {
	return (
		occasionGift.linkGroupId !== null &&
		permanentGift.linkGroupId !== null &&
		occasionGift.linkGroupId !== permanentGift.linkGroupId
	);
}

/**
 * Matches one list pair's gifts: a name found exactly once on each list is a confident match;
 * repeated names, copies already in two different link groups and gifts sharing only a link stay
 * ambiguous and unlinked. Gifts already linked to each other are left out.
 */
export function matchPairGifts(
	occasionGifts: readonly BackfillGift[],
	permanentGifts: readonly BackfillGift[],
): Pick<PlannedPair, 'matches' | 'ambiguous' | 'alreadyLinked' | 'unmatched'> {
	const permanentLinkGroupIds = new Set(permanentGifts.map((gift) => gift.linkGroupId));
	const linkedGroupIds = new Set(
		occasionGifts
			.map((gift) => gift.linkGroupId)
			.filter(
				(linkGroupId) => linkGroupId !== null && permanentLinkGroupIds.has(linkGroupId),
			),
	);
	const isAlreadyLinked = (backfillGift: BackfillGift) =>
		backfillGift.linkGroupId !== null && linkedGroupIds.has(backfillGift.linkGroupId);
	const occasionCandidates = occasionGifts.filter((gift) => !isAlreadyLinked(gift));
	const permanentCandidates = permanentGifts.filter((gift) => !isAlreadyLinked(gift));

	const matches: ProposedMatch[] = [];
	const ambiguous: AmbiguousCandidate[] = [];
	const settledGiftIds = new Set<string>();
	const permanentByName = groupByNormalizedName(permanentCandidates);
	for (const [name, occasionNamed] of groupByNormalizedName(occasionCandidates)) {
		const permanentNamed = permanentByName.get(name) ?? [];
		if (permanentNamed.length === 0) {
			continue;
		}
		[...occasionNamed, ...permanentNamed].forEach((gift) => settledGiftIds.add(gift.id));
		const [occasionGift] = occasionNamed;
		const [permanentGift] = permanentNamed;
		const isOneToOne = occasionNamed.length === 1 && permanentNamed.length === 1;
		if (
			isOneToOne &&
			occasionGift !== undefined &&
			permanentGift !== undefined &&
			!isInSeparateLinkGroups(occasionGift, permanentGift)
		) {
			matches.push(proposedMatch(occasionGift, permanentGift));
			continue;
		}
		ambiguous.push({
			reason: isOneToOne
				? AMBIGUITY_REASON.separateLinkGroups
				: AMBIGUITY_REASON.duplicateName,
			occasionGifts: occasionNamed.map(toPlannedGift),
			permanentGifts: permanentNamed.map(toPlannedGift),
		});
	}

	const unsettled = (gift: BackfillGift) => !settledGiftIds.has(gift.id);
	const linkCandidates = permanentCandidates.filter(unsettled);
	for (const occasionGift of occasionCandidates.filter(unsettled)) {
		const occasionLinks = normalizedLinks(occasionGift);
		const sharingLink = linkCandidates.filter((permanentGift) =>
			[...normalizedLinks(permanentGift)].some((link) => occasionLinks.has(link)),
		);
		if (sharingLink.length === 0) {
			continue;
		}
		[occasionGift, ...sharingLink].forEach((gift) => settledGiftIds.add(gift.id));
		ambiguous.push({
			reason: AMBIGUITY_REASON.sharedLinkOnly,
			occasionGifts: [toPlannedGift(occasionGift)],
			permanentGifts: sharingLink.map(toPlannedGift),
		});
	}

	return {
		matches,
		ambiguous,
		alreadyLinked: occasionGifts.filter(isAlreadyLinked).length,
		unmatched: {
			occasion: occasionCandidates.filter(unsettled).map(toPlannedGift),
			permanent: permanentCandidates.filter(unsettled).map(toPlannedGift),
		},
	};
}

/** Gifts matched in more than one pair: linking the first pair moves them into a group the next pair sees. */
export function giftsMatchedInSeveralPairs(pairs: readonly PlannedPair[]): string[] {
	const pairCountByGiftId = new Map<string, number>();
	for (const pair of pairs) {
		for (const match of pair.matches) {
			for (const giftId of [match.occasion.id, match.permanent.id]) {
				pairCountByGiftId.set(giftId, (pairCountByGiftId.get(giftId) ?? 0) + 1);
			}
		}
	}
	return [...pairCountByGiftId]
		.filter(([, pairCount]) => pairCount > 1)
		.map(([giftId]) => giftId);
}

const PlannedGiftSchema = v.object({
	id: v.pipe(v.string(), v.nonEmpty()),
	name: v.string(),
	updatedAt: v.pipe(v.string(), v.isoTimestamp()),
	linkGroupId: v.nullable(v.string()),
});

const PlannedWishlistSchema = v.looseObject({
	id: v.pipe(v.string(), v.nonEmpty()),
	shortId: v.string(),
	title: v.string(),
});

const PlanSchema = v.looseObject({
	version: v.literal(1),
	database: v.pipe(v.string(), v.nonEmpty()),
	owner: v.looseObject({ id: v.pipe(v.string(), v.nonEmpty()), email: v.string() }),
	pairs: v.array(
		v.looseObject({
			permanentWishlist: PlannedWishlistSchema,
			occasionWishlist: PlannedWishlistSchema,
			confirmed: v.boolean(),
			matches: v.array(
				v.looseObject({ occasion: PlannedGiftSchema, permanent: PlannedGiftSchema }),
			),
		}),
	),
});

/** The parts of a reviewed plan apply relies on. */
export type ReviewedPlan = v.InferOutput<typeof PlanSchema>;
export type ReviewedPair = ReviewedPlan['pairs'][number];
export type ReviewedMatch = ReviewedPair['matches'][number];

/**
 * Parses a reviewed plan file and rejects one apply could not run safely: a malformed entry, a
 * pair of one wishlist with itself, or a gift in more than one confirmed match.
 */
export function parseReviewedPlan(planJson: unknown): ReviewedPlan {
	const parsed = v.safeParse(PlanSchema, planJson);
	if (!parsed.success) {
		const issues = parsed.issues.map(
			(issue) => `${v.getDotPath(issue) ?? '(plan)'}: ${issue.message}`,
		);
		throw new Error(`Invalid plan:\n  ${issues.join('\n  ')}`);
	}
	const problems: string[] = [];
	const matchCountByGiftId = new Map<string, number>();
	parsed.output.pairs.forEach((pair, pairIndex) => {
		if (pair.permanentWishlist.id === pair.occasionWishlist.id) {
			problems.push(`pairs.${pairIndex}: both sides are the same wishlist`);
		}
		if (!pair.confirmed) {
			return;
		}
		for (const match of pair.matches) {
			for (const giftId of [match.occasion.id, match.permanent.id]) {
				matchCountByGiftId.set(giftId, (matchCountByGiftId.get(giftId) ?? 0) + 1);
			}
		}
	});
	for (const [giftId, matchCount] of matchCountByGiftId) {
		if (matchCount > 1) {
			problems.push(`gift ${giftId} is in ${matchCount} confirmed matches`);
		}
	}
	if (problems.length > 0) {
		throw new Error(`Invalid plan:\n  ${problems.join('\n  ')}`);
	}
	return parsed.output;
}

function describeWishlist(plannedWishlist: Pick<PlannedWishlist, 'title' | 'shortId'>): string {
	return `„${plannedWishlist.title}“ (${plannedWishlist.shortId})`;
}

function describeMatch(match: ProposedMatch): string[] {
	const notes = [
		...(match.sharedLinks.length > 0 ? ['same link'] : []),
		...(match.differences.length > 0
			? [`takes ${match.differences.map((difference) => difference.field).join(', ')}`]
			: []),
		...(match.receivedMerge === RECEIVED_MERGE.unchanged ? [] : [match.receivedMerge]),
	];
	const conflict = match.reservationConflict;
	return [
		`    ${match.occasion.name}  ⇐  ${match.permanent.name}${notes.length > 0 ? `  [${notes.join('; ')}]` : ''}`,
		...(conflict === null
			? []
			: [
					`      ! reserved ${conflict.occasionReservedUnits} + ${conflict.permanentReservedUnits} of ${conflict.sharedQuantity}${conflict.bothCopiesReserved ? ' (double reservation)' : ''}`,
				]),
	];
}

/** A readable overview of a proposed plan for the reviewing session. */
export function formatPlanSummary(plan: LinkedCopiesPlan): string {
	const lines = [
		`Linked gift copies plan for ${plan.owner.email} on ${plan.database}`,
		`${plan.pairs.length} wishlist pair(s)`,
	];
	for (const pair of plan.pairs) {
		lines.push(
			'',
			`${describeWishlist(pair.permanentWishlist)} → ${describeWishlist(pair.occasionWishlist)} [${pair.occasionWishlist.occasion}, ${pair.occasionWishlist.status}]`,
			`  ${pair.matches.length} match(es), ${pair.ambiguous.length} ambiguous, ${pair.alreadyLinked} already linked, unmatched ${pair.unmatched.occasion.length} occasion / ${pair.unmatched.permanent.length} permanent`,
			...pair.matches.flatMap(describeMatch),
			...pair.ambiguous.map(
				(candidate) =>
					`    ? ${candidate.reason}: ${candidate.occasionGifts.map((gift) => gift.name).join(' | ')}  ⇔  ${candidate.permanentGifts.map((gift) => gift.name).join(' | ')}`,
			),
		);
	}
	if (plan.warnings.length > 0) {
		lines.push('', 'Warnings:', ...plan.warnings.map((warning) => `  ${warning}`));
	}
	return lines.join('\n');
}
