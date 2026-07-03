import * as m from '$lib/paraglide/messages.js';
import { SERVER_ERROR } from './server_error_codes.js';

type TranslatorFunction = (params?: Record<string, unknown>) => string;

const TRANSLATIONS: Record<string, TranslatorFunction> = {
	[SERVER_ERROR.WISHLIST_NOT_FOUND]: () => m.server_error_wishlist_not_found(),
	[SERVER_ERROR.ONLY_OWNER_CAN_MANAGE_MODERATORS]: () =>
		m.server_error_only_owner_can_manage_moderators(),
	[SERVER_ERROR.ACCESS_DENIED]: () => m.server_error_access_denied(),
	[SERVER_ERROR.FAILED_TO_CREATE_INVITE]: () => m.server_error_failed_to_create_invite(),
	[SERVER_ERROR.INVITE_NOT_FOUND]: () => m.server_error_invite_not_found(),
	[SERVER_ERROR.INVITE_ALREADY_REVOKED]: () => m.server_error_invite_already_revoked(),
	[SERVER_ERROR.INVITE_ALREADY_USED]: () => m.server_error_invite_already_used(),
	[SERVER_ERROR.OWNER_CANNOT_ACCEPT_OWN_INVITE]: () =>
		m.server_error_owner_cannot_accept_own_invite(),
	[SERVER_ERROR.ALREADY_MODERATOR]: () => m.server_error_already_moderator(),
	[SERVER_ERROR.FAILED_TO_ASSIGN_MODERATOR]: () => m.server_error_failed_to_assign_moderator(),
	[SERVER_ERROR.MODERATOR_NOT_FOUND]: () => m.server_error_moderator_not_found(),
	[SERVER_ERROR.ALREADY_SEEING_RESERVATIONS]: () => m.server_error_already_seeing_reservations(),

	[SERVER_ERROR.GIFT_NOT_FOUND]: () => m.server_error_gift_not_found(),
	[SERVER_ERROR.CANNOT_RESERVE_ON_ARCHIVED]: () => m.server_error_cannot_reserve_on_archived(),
	[SERVER_ERROR.OWNER_CANNOT_RESERVE_OWN_GIFTS]: () =>
		m.server_error_owner_cannot_reserve_own_gifts(),
	[SERVER_ERROR.ANONYMOUS_NAME_REQUIRED]: () => m.server_error_anonymous_name_required(),
	[SERVER_ERROR.QUANTITY_MUST_BE_AT_LEAST_ONE]: () =>
		m.server_error_quantity_must_be_at_least_one(),
	[SERVER_ERROR.NOT_ENOUGH_AVAILABLE]: (params) =>
		m.server_error_not_enough_available({ available: Number(params?.available ?? 0) }),
	[SERVER_ERROR.RESERVATION_FAILED]: () => m.server_error_reservation_failed(),
	[SERVER_ERROR.RESERVATION_NOT_FOUND]: () => m.server_error_reservation_not_found(),
	[SERVER_ERROR.CANNOT_CANCEL_OTHERS_RESERVATION]: () =>
		m.server_error_cannot_cancel_others_reservation(),
	[SERVER_ERROR.ANONYMOUS_CANNOT_CANCEL_RESERVATIONS]: () =>
		m.server_error_anonymous_cannot_cancel_reservations(),
	[SERVER_ERROR.CANNOT_CANCEL_ANONYMOUS_RESERVATION]: () =>
		m.server_error_cannot_cancel_anonymous_reservation(),

	[SERVER_ERROR.OWNER_CANNOT_LIKE_OWN_GIFTS]: () => m.server_error_owner_cannot_like_own_gifts(),

	[SERVER_ERROR.FAILED_TO_CREATE_GIFT]: () => m.server_error_failed_to_create_gift(),
	[SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING]: () => m.server_error_cannot_edit_after_sharing(),
	[SERVER_ERROR.QUANTITY_CANNOT_BE_LOWERED]: () => m.server_error_quantity_cannot_be_lowered(),
	[SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING]: () => m.server_error_cannot_delete_after_sharing(),
	[SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT]: () => m.server_error_cannot_delete_reserved_gift(),
	[SERVER_ERROR.ONLY_OWNER_CAN_MARK_RECEIVED]: () =>
		m.server_error_only_owner_can_mark_received(),

	[SERVER_ERROR.FAILED_TO_CREATE_WISHLIST]: () => m.server_error_failed_to_create_wishlist(),
	[SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST]: () =>
		m.server_error_cannot_modify_archived_wishlist(),

	[SERVER_ERROR.SHEETS_LINK_INVALID]: () => m.server_error_sheets_link_invalid(),
	[SERVER_ERROR.SHEETS_LINK_NOT_A_SHEET]: () => m.server_error_sheets_link_not_a_sheet(),
	[SERVER_ERROR.SHEETS_PRIVATE]: () => m.server_error_sheets_private(),
	[SERVER_ERROR.SHEETS_FETCH_FAILED]: () => m.server_error_sheets_fetch_failed(),
};

/**
 * Extracts the error message from a thrown value. Handles both plain `Error`
 * instances and SvelteKit `HttpError` objects (which are not `Error` instances
 * but carry the message under `.body.message`).
 */
function extractMessage(thrown: unknown): string | null {
	if (thrown instanceof Error) {
		return thrown.message;
	}
	if (typeof thrown === 'object' && thrown !== null) {
		const body = (thrown as { body?: unknown }).body;
		if (typeof body === 'object' && body !== null) {
			const bodyMessage = (body as { message?: unknown }).message;
			if (typeof bodyMessage === 'string') {
				return bodyMessage;
			}
		}
		const message = (thrown as { message?: unknown }).message;
		if (typeof message === 'string') {
			return message;
		}
	}
	return null;
}

/**
 * Extracts the {@link SERVER_ERROR} code from a thrown value (handling both
 * plain-code messages and JSON-encoded `{ code, ...params }` messages), or null
 * if the thrown value carries no recognisable code. Lets callers branch on a
 * specific server error (e.g. show a tailored message) without re-parsing.
 */
export function getServerErrorCode(thrown: unknown): string | null {
	const message = extractMessage(thrown);
	if (message === null) {
		return null;
	}
	if (message.startsWith('{')) {
		try {
			const parsed = JSON.parse(message) as Record<string, unknown>;
			if (typeof parsed.code === 'string') {
				return parsed.code;
			}
		} catch {
			// Not valid JSON – fall through
		}
	}
	return message;
}

export function translateServerError(thrown: unknown, fallback?: string): string {
	const message = extractMessage(thrown);
	if (message === null) {
		return fallback ?? m.error_generic();
	}

	if (message.startsWith('{')) {
		try {
			const parsed = JSON.parse(message) as Record<string, unknown>;
			const code = parsed.code;
			if (typeof code === 'string' && code in TRANSLATIONS) {
				return TRANSLATIONS[code]!(parsed);
			}
		} catch {
			// Not valid JSON – fall through
		}
	}

	const translator = TRANSLATIONS[message];
	if (translator !== undefined) {
		return translator();
	}

	return fallback ?? m.error_generic();
}
