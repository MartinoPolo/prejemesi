import * as m from '$lib/paraglide/messages.js';
import { SERVER_ERROR } from './server_error_codes.js';

type TranslatorFunction = (params?: Record<string, unknown>) => string;

const TRANSLATIONS: Record<string, TranslatorFunction> = {
	[SERVER_ERROR.WISHLIST_NOT_FOUND]: () => m.server_error_wishlist_not_found(),
	[SERVER_ERROR.ACCESS_DENIED]: () => m.server_error_access_denied(),
	[SERVER_ERROR.FAILED_TO_CREATE_INVITE]: () => m.server_error_failed_to_create_invite(),
	[SERVER_ERROR.INVITE_NOT_FOUND]: () => m.server_error_invite_not_found(),
	[SERVER_ERROR.INVITE_ALREADY_REVOKED]: () => m.server_error_invite_already_revoked(),
	[SERVER_ERROR.INVITE_ALREADY_USED]: () => m.server_error_invite_already_used(),
	[SERVER_ERROR.RECIPIENT_CANNOT_ACCEPT_OWN_INVITE]: () =>
		m.server_error_recipient_cannot_accept_own_invite(),
	[SERVER_ERROR.ALREADY_MODERATOR]: () => m.server_error_already_moderator(),
	[SERVER_ERROR.FAILED_TO_ASSIGN_MODERATOR]: () => m.server_error_failed_to_assign_moderator(),
	[SERVER_ERROR.MODERATOR_NOT_FOUND]: () => m.server_error_moderator_not_found(),
	[SERVER_ERROR.CANNOT_INVITE_ON_ARCHIVED]: () => m.server_error_cannot_invite_on_archived(),
	[SERVER_ERROR.CANNOT_REMOVE_LAST_MANAGER]: () => m.server_error_cannot_remove_last_manager(),
	[SERVER_ERROR.ALREADY_SEEING_RESERVATIONS]: () => m.server_error_already_seeing_reservations(),
	[SERVER_ERROR.CLAIM_NOT_FOR_LINKED_RECIPIENT]: () =>
		m.server_error_claim_not_for_linked_recipient(),
	[SERVER_ERROR.CLAIM_ALREADY_LINKED]: () => m.server_error_claim_already_linked(),
	[SERVER_ERROR.CLAIM_EX_MANAGER]: () => m.server_error_claim_ex_manager(),
	[SERVER_ERROR.CLAIM_HAS_RESERVATIONS]: () => m.server_error_claim_has_reservations(),

	[SERVER_ERROR.GIFT_NOT_FOUND]: () => m.server_error_gift_not_found(),
	[SERVER_ERROR.CANNOT_RESERVE_ON_ARCHIVED]: () => m.server_error_cannot_reserve_on_archived(),
	[SERVER_ERROR.RECIPIENT_CANNOT_RESERVE_OWN_GIFTS]: () =>
		m.server_error_recipient_cannot_reserve_own_gifts(),
	[SERVER_ERROR.ANONYMOUS_NAME_REQUIRED]: () => m.server_error_anonymous_name_required(),
	[SERVER_ERROR.TURNSTILE_REQUIRED]: () => m.server_error_turnstile_required(),
	[SERVER_ERROR.TURNSTILE_INVALID]: () => m.server_error_turnstile_invalid(),
	[SERVER_ERROR.TURNSTILE_EXPIRED_OR_REPLAYED]: () =>
		m.server_error_turnstile_expired_or_replayed(),
	[SERVER_ERROR.TURNSTILE_UNAVAILABLE]: () => m.server_error_turnstile_unavailable(),
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
	[SERVER_ERROR.RELEASE_REQUIRES_ADMIN]: () => m.server_error_release_requires_admin(),

	[SERVER_ERROR.RECIPIENT_CANNOT_LIKE_OWN_GIFTS]: () =>
		m.server_error_recipient_cannot_like_own_gifts(),

	[SERVER_ERROR.FAILED_TO_CREATE_GIFT]: () => m.server_error_failed_to_create_gift(),
	[SERVER_ERROR.CANNOT_EDIT_AFTER_SHARING]: () => m.server_error_cannot_edit_after_sharing(),
	[SERVER_ERROR.QUANTITY_CANNOT_BE_LOWERED]: () => m.server_error_quantity_cannot_be_lowered(),
	[SERVER_ERROR.CANNOT_DELETE_AFTER_SHARING]: () => m.server_error_cannot_delete_after_sharing(),
	[SERVER_ERROR.CANNOT_DELETE_RESERVED_GIFT]: () => m.server_error_cannot_delete_reserved_gift(),
	// Reuses the form's own range-error copy so toast and inline hint read identically.
	[SERVER_ERROR.INVALID_PRICE_RANGE]: () => m.gift_price_range_invalid(),
	[SERVER_ERROR.GIFT_CATEGORY_NOT_FOUND]: () => m.server_error_gift_category_not_found(),
	[SERVER_ERROR.GIFT_CATEGORY_PRESET_IMMUTABLE]: () =>
		m.server_error_gift_category_preset_immutable(),
	[SERVER_ERROR.GIFT_CATEGORY_LABEL_CONFLICT]: () =>
		m.server_error_gift_category_label_conflict(),
	[SERVER_ERROR.GIFT_CATEGORY_WISHLIST_MISMATCH]: () =>
		m.server_error_gift_category_wishlist_mismatch(),
	[SERVER_ERROR.GIFT_CATEGORY_REORDER_MISMATCH]: () =>
		m.server_error_gift_category_reorder_mismatch(),
	[SERVER_ERROR.GIFT_CATEGORY_REMOVAL_CONFIRMATION_MISMATCH]: () =>
		m.server_error_gift_category_removal_confirmation_mismatch(),
	[SERVER_ERROR.GIFT_CATEGORY_IMPORT_UNRESOLVED]: () =>
		m.server_error_gift_category_import_unresolved(),

	[SERVER_ERROR.RECIPIENT_RENAME_NOT_ALLOWED]: () =>
		m.server_error_recipient_rename_not_allowed(),
	[SERVER_ERROR.FAILED_TO_CREATE_WISHLIST]: () => m.server_error_failed_to_create_wishlist(),
	[SERVER_ERROR.CANNOT_MODIFY_ARCHIVED_WISHLIST]: () =>
		m.server_error_cannot_modify_archived_wishlist(),
	[SERVER_ERROR.CANNOT_REVERT_ARCHIVED]: () => m.server_error_cannot_revert_archived(),
	// Reuses the exact disabled-button copy so the toast and the UI hint read identically.
	[SERVER_ERROR.REVERT_REQUIRES_ADMIN]: () => m.wishlist_revert_reserved_admin_only(),

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
