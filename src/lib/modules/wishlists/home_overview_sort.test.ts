import { describe, it, expect } from 'vitest';
import {
	sortCategoryRow,
	buildRecentRow,
	type CategorySortable,
	type RecentSortable,
} from './home_overview_sort.js';

const NOW = new Date('2026-08-07T12:00:00Z');

function category(
	id: string,
	fields: Partial<CategorySortable> = {},
): CategorySortable & { id: string } {
	return {
		id,
		eventDate: null,
		lastVisitedAt: null,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		...fields,
	};
}

function recent(id: string, fields: Partial<RecentSortable> = {}): RecentSortable & { id: string } {
	return {
		id,
		lastVisitedAt: null,
		followDate: null,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		...fields,
	};
}

describe('sortCategoryRow', () => {
	it('orders upcoming event dates ascending, ahead of everything else', () => {
		const soon = category('soon', { eventDate: new Date('2026-09-01T00:00:00Z') });
		const later = category('later', { eventDate: new Date('2026-12-01T00:00:00Z') });
		const undated = category('undated');

		const result = sortCategoryRow([undated, later, soon], NOW).map((row) => row.id);

		expect(result.slice(0, 2)).toEqual(['soon', 'later']);
	});

	it('places undated lists after upcoming ones, ordered by lastVisitedAt descending', () => {
		const dated = category('dated', { eventDate: new Date('2026-09-01T00:00:00Z') });
		const visitedOld = category('old', { lastVisitedAt: new Date('2026-05-01T00:00:00Z') });
		const visitedRecent = category('recent', {
			lastVisitedAt: new Date('2026-07-01T00:00:00Z'),
		});

		const result = sortCategoryRow([visitedOld, dated, visitedRecent], NOW).map(
			(row) => row.id,
		);

		expect(result).toEqual(['dated', 'recent', 'old']);
	});

	it('falls back to createdAt for undated lists that were never visited', () => {
		const olderCreated = category('older', {
			createdAt: new Date('2026-01-01T00:00:00Z'),
		});
		const newerCreated = category('newer', {
			createdAt: new Date('2026-06-01T00:00:00Z'),
		});

		const result = sortCategoryRow([olderCreated, newerCreated], NOW).map((row) => row.id);

		expect(result).toEqual(['newer', 'older']);
	});

	it('pushes past-dated lists to the very end, after undated ones', () => {
		const past = category('past', { eventDate: new Date('2026-01-01T00:00:00Z') });
		const upcoming = category('upcoming', { eventDate: new Date('2026-09-01T00:00:00Z') });
		const undated = category('undated', { lastVisitedAt: new Date('2026-07-01T00:00:00Z') });

		const result = sortCategoryRow([past, undated, upcoming], NOW).map((row) => row.id);

		expect(result).toEqual(['upcoming', 'undated', 'past']);
	});

	it('does not mutate the input array', () => {
		const input = [
			category('a', { eventDate: new Date('2026-12-01T00:00:00Z') }),
			category('b', { eventDate: new Date('2026-09-01T00:00:00Z') }),
		];
		const snapshot = input.map((row) => row.id);

		sortCategoryRow(input, NOW);

		expect(input.map((row) => row.id)).toEqual(snapshot);
	});
});

describe('buildRecentRow', () => {
	it('orders by lastVisitedAt descending', () => {
		const rows = [
			recent('old', { lastVisitedAt: new Date('2026-05-01T00:00:00Z') }),
			recent('newest', { lastVisitedAt: new Date('2026-08-01T00:00:00Z') }),
			recent('mid', { lastVisitedAt: new Date('2026-07-01T00:00:00Z') }),
		];

		expect(buildRecentRow(rows).map((row) => row.id)).toEqual(['newest', 'mid', 'old']);
	});

	it('falls back to the follow date when a list has never been visited', () => {
		const visited = recent('visited', { lastVisitedAt: new Date('2026-06-01T00:00:00Z') });
		const followedLater = recent('followed', {
			lastVisitedAt: null,
			followDate: new Date('2026-07-15T00:00:00Z'),
		});

		expect(buildRecentRow([visited, followedLater]).map((row) => row.id)).toEqual([
			'followed',
			'visited',
		]);
	});

	it('falls back to createdAt when neither visit nor follow date exists', () => {
		const a = recent('a', { createdAt: new Date('2026-02-01T00:00:00Z') });
		const b = recent('b', { createdAt: new Date('2026-04-01T00:00:00Z') });

		expect(buildRecentRow([a, b]).map((row) => row.id)).toEqual(['b', 'a']);
	});

	it('caps the row at six items by default', () => {
		const rows = Array.from({ length: 10 }, (_unused, index) =>
			recent(`w${index}`, {
				lastVisitedAt: new Date(2026, 0, index + 1),
			}),
		);

		expect(buildRecentRow(rows)).toHaveLength(6);
	});

	it('keeps duplicates across roles (no dedup)', () => {
		const rows = [
			recent('dup', { lastVisitedAt: new Date('2026-08-01T00:00:00Z') }),
			recent('dup', { lastVisitedAt: new Date('2026-07-01T00:00:00Z') }),
		];

		expect(buildRecentRow(rows)).toHaveLength(2);
	});

	it('does not mutate the input array', () => {
		const input = [
			recent('a', { lastVisitedAt: new Date('2026-05-01T00:00:00Z') }),
			recent('b', { lastVisitedAt: new Date('2026-08-01T00:00:00Z') }),
		];
		const snapshot = input.map((row) => row.id);

		buildRecentRow(input);

		expect(input.map((row) => row.id)).toEqual(snapshot);
	});
});
