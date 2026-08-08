/**
 * Pure sorting helpers for the Přehled (/home) overview rows (issue #225).
 *
 * Extracted from the aggregated `getHomeOverview` query so the ordering rules can be
 * unit-tested without a database. Both helpers copy their input — callers keep their
 * arrays untouched.
 */

import { HOME_RECENT_CAP } from './home_overview_types.js';

type DateInput = Date | string | null;

/** The fields a category-row list needs to be ordered (REQ-6). */
export interface CategorySortable {
	eventDate: DateInput;
	lastVisitedAt: DateInput;
	createdAt: Date | string;
}

/** The fields a „Nedávné" list needs to be ordered by recency. */
export interface RecentSortable {
	lastVisitedAt: DateInput;
	/** Follow date — the cold-start fallback before any visit is recorded. */
	followDate?: DateInput;
	createdAt: Date | string;
}

function time(value: DateInput | undefined): number | null {
	if (value === null || value === undefined) {
		return null;
	}
	return new Date(value).getTime();
}

/**
 * Recency key for the „Nedávné" row: last visit, else the follow date, else creation.
 */
function recencyKey(item: RecentSortable): number {
	return time(item.lastVisitedAt) ?? time(item.followDate) ?? new Date(item.createdAt).getTime();
}

const CATEGORY_GROUP = {
	upcoming: 0,
	undated: 1,
	past: 2,
} as const;

type CategoryGroup = (typeof CATEGORY_GROUP)[keyof typeof CATEGORY_GROUP];

function categoryGroup(item: CategorySortable, nowMs: number): CategoryGroup {
	const eventMs = time(item.eventDate);
	if (eventMs === null) {
		return CATEGORY_GROUP.undated;
	}
	return eventMs >= nowMs ? CATEGORY_GROUP.upcoming : CATEGORY_GROUP.past;
}

/**
 * Category-row order (REQ-6): upcoming event date ascending, then undated lists by last
 * opened (createdAt fallback) descending, then past-dated lists last (nearest past first).
 * Archived lists are excluded upstream — this helper never sees them.
 */
export function sortCategoryRow<T extends CategorySortable>(
	items: readonly T[],
	now = new Date(),
): T[] {
	const nowMs = now.getTime();
	return [...items].sort((a, b) => {
		const groupA = categoryGroup(a, nowMs);
		const groupB = categoryGroup(b, nowMs);
		if (groupA !== groupB) {
			return groupA - groupB;
		}

		switch (groupA) {
			case CATEGORY_GROUP.upcoming:
				// Soonest event first.
				return time(a.eventDate)! - time(b.eventDate)!;
			case CATEGORY_GROUP.undated: {
				// Most recently opened first (created-date fallback).
				const keyA = time(a.lastVisitedAt) ?? new Date(a.createdAt).getTime();
				const keyB = time(b.lastVisitedAt) ?? new Date(b.createdAt).getTime();
				return keyB - keyA;
			}
			case CATEGORY_GROUP.past:
				// Nearest past first.
				return time(b.eventDate)! - time(a.eventDate)!;
		}
	});
}

/**
 * Build the „Nedávné" row: sort the merged (all-role) list by recency descending and cap
 * it. No dedup — a list may appear here AND in its category row below (DECISIONS 2026-08-07).
 */
export function buildRecentRow<T extends RecentSortable>(
	items: readonly T[],
	cap = HOME_RECENT_CAP,
): T[] {
	return [...items].sort((a, b) => recencyKey(b) - recencyKey(a)).slice(0, cap);
}
