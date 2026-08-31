export const GIFT_CATEGORY_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** Stable, high-chroma defaults for user-created categories. */
export const CUSTOM_GIFT_CATEGORY_COLORS = [
	'#0369A1',
	'#047857',
	'#A21CAF',
	'#C2410C',
	'#4F46E5',
	'#B91C1C',
	'#0F766E',
	'#7E22CE',
	'#DB2777',
	'#EA580C',
	'#FACC15',
	'#65A30D',
	'#06B6D4',
	'#2563EB',
	'#9333EA',
	'#E11D48',
	'#92400E',
	'#6B7280',
	'#000000',
	'#FFFFFF',
] as const;

export function giftCategoryColorForIndex(index: number): string {
	const normalized = Math.max(0, Math.trunc(index));
	return CUSTOM_GIFT_CATEGORY_COLORS[normalized % CUSTOM_GIFT_CATEGORY_COLORS.length]!;
}

function rgbChannelToLinear(channel: number): number {
	const value = channel / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string): number {
	if (!GIFT_CATEGORY_COLOR_PATTERN.test(color)) {
		return 0;
	}
	const red = Number.parseInt(color.slice(1, 3), 16);
	const green = Number.parseInt(color.slice(3, 5), 16);
	const blue = Number.parseInt(color.slice(5, 7), 16);
	return (
		0.2126 * rgbChannelToLinear(red) +
		0.7152 * rgbChannelToLinear(green) +
		0.0722 * rgbChannelToLinear(blue)
	);
}

export function contrastRatio(first: string, second: string): number {
	const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
	const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
	return (lighter + 0.05) / (darker + 0.05);
}

export function foregroundForCategoryColor(color: string): '#000000' | '#FFFFFF' {
	return contrastRatio(color, '#000000') >= contrastRatio(color, '#FFFFFF')
		? '#000000'
		: '#FFFFFF';
}
