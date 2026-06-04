/**
 * Derive a wishlist title from an import filename.
 *
 * Strips `.csv`/`.tsv` extensions. If `" - "` is present, takes the segment
 * after the last occurrence (Google Sheets exports prepend the sheet name).
 * Returns empty string for paste/Sheets sources (no filename).
 */
export function deriveWishlistTitle(filename: string): string {
	let name = filename.trim();

	// Strip known extensions
	name = name.replace(/\.(csv|tsv)$/i, '');

	// Take the segment after the last " - "
	const dashIndex = name.lastIndexOf(' - ');
	if (dashIndex !== -1) {
		name = name.slice(dashIndex + 3);
	}

	return name.trim();
}
