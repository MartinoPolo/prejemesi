import { getRequestEvent, query, command, form } from '$app/server';
import { error } from '@sveltejs/kit';
import type { User, Session } from 'better-auth';

interface AuthContext {
	user: User;
	session: Session;
}

function getAuthContext(): AuthContext {
	const event = getRequestEvent();
	const user = event.locals.user;
	const session = event.locals.session;

	if (user === undefined || session === undefined) {
		error(401, 'Authentication required');
	}

	return { user, session };
}

export function guardedQuery<TResult>(
	handler: (authContext: AuthContext) => TResult,
): () => TResult {
	return query(() => {
		const authContext = getAuthContext();
		return handler(authContext);
	});
}

export function guardedQueryWithArgs<TArgs extends unknown[], TResult>(
	handler: (authContext: AuthContext, ...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
	return query('unchecked', (...args: TArgs) => {
		const authContext = getAuthContext();
		return handler(authContext, ...args);
	});
}

export function publicQuery<TArgs extends unknown[], TResult>(
	handler: (authContext: AuthContext | null, ...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
	return query('unchecked', (...args: TArgs) => {
		const event = getRequestEvent();
		const user = event.locals.user;
		const session = event.locals.session;
		const authContext = user !== undefined && session !== undefined ? { user, session } : null;
		return handler(authContext, ...args);
	});
}

export function guardedCommand<TArgs extends unknown[], TResult>(
	handler: (authContext: AuthContext, ...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
	return command('unchecked', (...args: TArgs) => {
		const authContext = getAuthContext();
		return handler(authContext, ...args);
	});
}

export function guardedForm(handler: (authContext: AuthContext, formData: FormData) => unknown) {
	return form(async (formData: FormData) => {
		const authContext = getAuthContext();
		return handler(authContext, formData);
	});
}

/**
 * A public command that does not require authentication.
 * Optionally receives user/session if logged in.
 */
export function publicCommand<TArgs extends unknown[], TResult>(
	handler: (authContext: AuthContext | null, ...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
	return command('unchecked', (...args: TArgs) => {
		const event = getRequestEvent();
		const user = event.locals.user;
		const session = event.locals.session;
		const authContext = user !== undefined && session !== undefined ? { user, session } : null;
		return handler(authContext, ...args);
	});
}
