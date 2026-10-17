import {
	SERVER_ERROR,
	WISHLIST_NOT_FOUND_MESSAGE,
	type ServerErrorCode,
} from '$lib/modules/errors/server_error_codes.js';

/** Codes for plain-text errors from the core, which carry no code of their own. */
const STATUS_ERROR_CODES: Partial<Record<number, ServerErrorCode>> = {
	400: SERVER_ERROR.BAD_REQUEST,
	401: SERVER_ERROR.UNAUTHORIZED,
	403: SERVER_ERROR.FORBIDDEN,
	404: SERVER_ERROR.NOT_FOUND,
	409: SERVER_ERROR.CONFLICT,
	410: SERVER_ERROR.GONE,
};

const SERVER_ERROR_CODES = new Set<string>(Object.values(SERVER_ERROR));

export function isServerErrorCode(value: unknown): value is ServerErrorCode {
	return typeof value === 'string' && SERVER_ERROR_CODES.has(value);
}

/** A core error as a code, the code's parameters and, for plain text, the original message. */
export interface ServerErrorDescription {
	code: ServerErrorCode;
	details: Record<string, unknown>;
	plainMessage?: string;
}

/** A core error message is a code, a JSON-encoded code with parameters, or plain text. */
export function describeServerError(status: number, message: string): ServerErrorDescription {
	if (isServerErrorCode(message)) {
		return { code: message, details: {} };
	}
	if (message === WISHLIST_NOT_FOUND_MESSAGE) {
		return { code: SERVER_ERROR.WISHLIST_NOT_FOUND, details: {}, plainMessage: message };
	}
	try {
		const parsed: unknown = JSON.parse(message);
		if (typeof parsed === 'object' && parsed !== null && 'code' in parsed) {
			const { code, ...details } = parsed;
			if (isServerErrorCode(code)) {
				return { code, details };
			}
		}
	} catch {
		// Plain text.
	}
	return {
		code: STATUS_ERROR_CODES[status] ?? SERVER_ERROR.REQUEST_FAILED,
		details: {},
		plainMessage: message,
	};
}
