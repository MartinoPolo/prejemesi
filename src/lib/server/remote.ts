import { getRequestEvent, query, command } from '$app/server';
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

export function guardedQuery<TResult>(handler: (authContext: AuthContext) => TResult) {
	return query(() => {
		const authContext = getAuthContext();
		return handler(authContext);
	});
}

export function guardedQueryWithArgs<TArg, TResult>(
	handler: (authContext: AuthContext, arg: TArg) => TResult,
) {
	return query('unchecked', (arg: TArg) => {
		const authContext = getAuthContext();
		return handler(authContext, arg);
	});
}

export function publicQuery<TArg, TResult>(
	handler: (authContext: AuthContext | null, arg: TArg) => TResult,
) {
	return query('unchecked', (arg: TArg) => {
		const event = getRequestEvent();
		const user = event.locals.user;
		const session = event.locals.session;
		const authContext = user !== undefined && session !== undefined ? { user, session } : null;
		return handler(authContext, arg);
	});
}

export function guardedCommand<TArg, TResult>(
	handler: (authContext: AuthContext, arg: TArg) => TResult,
) {
	return command('unchecked', (arg: TArg) => {
		const authContext = getAuthContext();
		return handler(authContext, arg);
	});
}

export function guardedCommandNoArgs<TResult>(handler: (authContext: AuthContext) => TResult) {
	return command(() => {
		const authContext = getAuthContext();
		return handler(authContext);
	});
}

/**
 * A public command that does not require authentication.
 * Optionally receives user/session if logged in.
 */
export function publicCommand<TArg, TResult>(
	handler: (authContext: AuthContext | null, arg: TArg) => TResult,
) {
	return command('unchecked', (arg: TArg) => {
		const event = getRequestEvent();
		const user = event.locals.user;
		const session = event.locals.session;
		const authContext = user !== undefined && session !== undefined ? { user, session } : null;
		return handler(authContext, arg);
	});
}
