// ── Relative Time Formatting ───────────────────────────────────────────────

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('cs', { numeric: 'auto' });

const TIME_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
	{ amount: 60, unit: 'second' },
	{ amount: 60, unit: 'minute' },
	{ amount: 24, unit: 'hour' },
	{ amount: 7, unit: 'day' },
	{ amount: 4.34524, unit: 'week' },
	{ amount: 12, unit: 'month' },
	{ amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

export function formatRelativeTime(date: Date): string {
	let durationSeconds = (date.getTime() - Date.now()) / 1000;

	for (const division of TIME_DIVISIONS) {
		if (Math.abs(durationSeconds) < division.amount) {
			return RELATIVE_TIME_FORMATTER.format(Math.round(durationSeconds), division.unit);
		}
		durationSeconds /= division.amount;
	}

	return RELATIVE_TIME_FORMATTER.format(Math.round(durationSeconds), 'year');
}
