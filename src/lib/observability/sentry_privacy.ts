import type { BrowserOptions } from '@sentry/sveltekit';

interface SanitizableBreadcrumb {
	data?: Record<string, unknown>;
	message?: string;
}

interface SanitizableEvent {
	breadcrumbs?: SanitizableBreadcrumb[];
	contexts?: Record<string, unknown>;
	exception?: { values?: Array<{ value?: string }> };
	extra?: Record<string, unknown>;
	message?: string;
	request?: Record<string, unknown>;
	tags?: Record<string, unknown>;
	user?: unknown;
}

const SENSITIVE_KEY_PATTERN =
	/(address|authorization|cookie|credential|description|email|gifter|name|owner|password|phone|recipient|secret|session|title|token|value)/i;
const URL_KEY_PATTERN = /^(from|href|name|src|to|url)$/i;
const ALLOWED_CONTEXT_KEYS = new Set([
	'browser',
	'cloud_resource',
	'device',
	'os',
	'response',
	'runtime',
	'trace',
]);
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Z0-9._~+/=-]+/gi;
const SENSITIVE_PARAMETER_PATTERN =
	/([?&](?:authorization|code|credential|password|secret|session|token)=)[^&#\s]+/gi;

export const SENTRY_DATA_COLLECTION: NonNullable<BrowserOptions['dataCollection']> = {
	userInfo: false,
	cookies: false,
	httpHeaders: { request: false, response: false },
	httpBodies: [],
	urlQueryParams: false,
	graphQL: { document: false, variables: false },
	genAI: { inputs: false, outputs: false },
	databaseQueryData: false,
	stackFrameVariables: false,
	frameContextLines: 0,
};

function stripUrlDetails(value: string): string {
	try {
		const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(value);
		const url = new URL(value, 'https://redacted.invalid');
		return isAbsolute ? `${url.origin}${url.pathname}` : url.pathname;
	} catch {
		return sanitizeText(value);
	}
}

function sanitizeText(value: string): string {
	return value
		.replace(EMAIL_PATTERN, '[redacted-email]')
		.replace(BEARER_TOKEN_PATTERN, 'Bearer [redacted]')
		.replace(SENSITIVE_PARAMETER_PATTERN, '$1[redacted]');
}

function sanitizeUnknown(
	value: unknown,
	key?: string,
	seen = new WeakSet<object>(),
	depth = 0,
): unknown {
	if (key !== undefined && SENSITIVE_KEY_PATTERN.test(key)) {
		return '[redacted]';
	}
	if (typeof value === 'string') {
		return key !== undefined && URL_KEY_PATTERN.test(key)
			? stripUrlDetails(value)
			: sanitizeText(value);
	}
	if (depth >= 8) {
		return '[redacted-depth]';
	}
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeUnknown(item, undefined, seen, depth + 1));
	}
	if (value !== null && typeof value === 'object') {
		if (seen.has(value)) {
			return '[circular]';
		}
		seen.add(value);
		return Object.fromEntries(
			Object.entries(value).map(([entryKey, entryValue]) => [
				entryKey,
				sanitizeUnknown(entryValue, entryKey, seen, depth + 1),
			]),
		);
	}
	return value;
}

function sanitizeBreadcrumb(breadcrumb: SanitizableBreadcrumb): void {
	if (breadcrumb.message !== undefined) {
		breadcrumb.message = sanitizeText(breadcrumb.message);
	}
	if (breadcrumb.data === undefined) {
		return;
	}
	breadcrumb.data = sanitizeUnknown(breadcrumb.data) as Record<string, unknown>;
	for (const key of ['url', 'from', 'to']) {
		const value = breadcrumb.data[key];
		if (typeof value === 'string') {
			breadcrumb.data[key] = stripUrlDetails(value);
		}
	}
}

export function sanitizeSentryEvent<T>(event: T): T {
	const sanitizableEvent = event as SanitizableEvent;
	delete sanitizableEvent.user;

	if (sanitizableEvent.request !== undefined) {
		const method = sanitizableEvent.request.method;
		const url = sanitizableEvent.request.url;
		sanitizableEvent.request = {
			...(typeof method === 'string' ? { method } : {}),
			...(typeof url === 'string' ? { url: stripUrlDetails(url) } : {}),
		};
	}

	if (sanitizableEvent.message !== undefined) {
		sanitizableEvent.message = sanitizeText(sanitizableEvent.message);
	}
	for (const exception of sanitizableEvent.exception?.values ?? []) {
		if (exception.value !== undefined) {
			exception.value = sanitizeText(exception.value);
		}
	}
	for (const breadcrumb of sanitizableEvent.breadcrumbs ?? []) {
		sanitizeBreadcrumb(breadcrumb);
	}

	delete sanitizableEvent.extra;
	const replayId = sanitizableEvent.tags?.replayId;
	if (typeof replayId === 'string') {
		sanitizableEvent.tags = { replayId };
	} else {
		delete sanitizableEvent.tags;
	}
	if (sanitizableEvent.contexts !== undefined) {
		sanitizableEvent.contexts = Object.fromEntries(
			Object.entries(sanitizableEvent.contexts)
				.filter(([key]) => ALLOWED_CONTEXT_KEYS.has(key))
				.map(([key, value]) => [key, sanitizeUnknown(value)]),
		);
	}

	return event;
}

export function sanitizeSentryBreadcrumb<T>(breadcrumb: T): T {
	sanitizeBreadcrumb(breadcrumb as SanitizableBreadcrumb);
	return breadcrumb;
}

export function sanitizeSentryReplayEvent<T>(event: T): T {
	return sanitizeUnknown(event) as T;
}
