/** An optional email address, trimmed; null when absent or blank. */
export function optionalEmail(email: string | null | undefined): string | null {
	const trimmedEmail = email?.trim() ?? '';
	return trimmedEmail === '' ? null : trimmedEmail;
}
