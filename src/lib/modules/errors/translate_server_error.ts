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
};

export function translateServerError(thrown: unknown, fallback?: string): string {
	const message = thrown instanceof Error ? thrown.message : null;
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
			// Not valid JSON — fall through
		}
	}

	const translator = TRANSLATIONS[message];
	if (translator !== undefined) {
		return translator();
	}

	return message;
}
