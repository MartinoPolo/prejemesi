/**
 * Remote-function endpoint ids, computed the same way SvelteKit does.
 *
 * SvelteKit exposes each `*.remote.ts` export at
 * `POST|GET ${base}/_app/remote/${hash(relativeFilePath)}/${exportName}` where
 * `hash` is kit's djb2-xor/base36 of the posix path relative to the project
 * root (see @sveltejs/kit src/exports/vite/index.js + src/utils/hash.js).
 * The hash depends only on the file path, so it is stable across builds and
 * identical for dev, preview, and production. The smoke profile validates the
 * ids against a live server, so a kit scheme change fails loudly.
 */

/** Port of @sveltejs/kit's `hash()` (djb2-xor, base36) for string inputs. */
export function sveltekitHash(value: string): string {
	let hash = 5381;
	let i = value.length;
	while (i) {
		hash = (hash * 33) ^ value.charCodeAt(--i);
	}
	return (hash >>> 0).toString(36);
}

function remoteId(relativeFilePath: string, exportName: string): string {
	return `${sveltekitHash(relativeFilePath)}/${exportName}`;
}

const RESERVATIONS_REMOTE_FILE = 'src/lib/modules/reservations/reservations.remote.ts';
const GIFTS_REMOTE_FILE = 'src/lib/modules/gifts/gifts.remote.ts';

export const REMOTE_ENDPOINT_ID = {
	reserveGift: remoteId(RESERVATIONS_REMOTE_FILE, 'reserveGift'),
	unreserveGift: remoteId(RESERVATIONS_REMOTE_FILE, 'unreserveGift'),
	createGift: remoteId(GIFTS_REMOTE_FILE, 'createGift'),
} as const;
