import * as m from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import { czechPluralCategory } from '$lib/modules/gifts/gift_display.js';

/** One message per Czech plural category; English reuses `few` and `other` for its plural. */
export interface PluralMessages<Inputs extends { count: number } = { count: number }> {
	one: (inputs: Inputs) => string;
	few: (inputs: Inputs) => string;
	other: (inputs: Inputs) => string;
}

export function pluralCopy<Inputs extends { count: number }>(
	messages: PluralMessages<Inputs>,
	inputs: Inputs,
): string {
	return messages[czechPluralCategory(inputs.count)](inputs);
}

export function countCopy(messages: PluralMessages, count: number): string {
	return pluralCopy(messages, { count });
}

const HOUR_MILLISECONDS = 60 * 60 * 1000;
const DAY_HOURS = 24;

const DAYS: PluralMessages = {
	one: m.change_review_days_one,
	few: m.change_review_days_few,
	other: m.change_review_days_other,
};

export function formatChangeReviewDate(date: Date): string {
	return new Intl.DateTimeFormat(getLocale(), {
		day: 'numeric',
		month: 'numeric',
		year: 'numeric',
	}).format(date);
}

/** "13. 10. 2026 v 21:47" */
export function formatChangeReviewDateTime(date: Date): string {
	const time = new Intl.DateTimeFormat(getLocale(), {
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);
	return m.change_review_date_time({ date: formatChangeReviewDate(date), time });
}

/** "Platnost ještě 6 dní 11 h" while a proposal is open. */
export function changeReviewExpiryCopy(expiresAt: Date, now: Date): string {
	const remainingHours = Math.floor((expiresAt.getTime() - now.getTime()) / HOUR_MILLISECONDS);
	if (remainingHours < 1) {
		return m.change_review_expires_soon();
	}
	const days = Math.floor(remainingHours / DAY_HOURS);
	const hours = remainingHours % DAY_HOURS;
	const parts = [
		days > 0 ? countCopy(DAYS, days) : null,
		hours > 0 ? m.change_review_hours({ count: hours }) : null,
	].filter((part) => part !== null);
	return m.change_review_expires_in({ duration: parts.join(' ') });
}
