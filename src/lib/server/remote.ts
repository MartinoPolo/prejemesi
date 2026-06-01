import { getRequestEvent, query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import type { User, Session } from 'better-auth';
import type { StandardSchemaV1 } from '@standard-schema/spec';

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

export function guardedQueryWithArgs<TSchema extends StandardSchemaV1, TResult>(
	schema: TSchema,
	handler: (authContext: AuthContext, arg: StandardSchemaV1.InferOutput<TSchema>) => TResult,
) {
	return query(schema, (arg: StandardSchemaV1.InferOutput<TSchema>) => {
		const authContext = getAuthContext();
		return handler(authContext, arg);
	});
}

export function publicQuery<TSchema extends StandardSchemaV1, TResult>(
	schema: TSchema,
	handler: (
		authContext: AuthContext | null,
		arg: StandardSchemaV1.InferOutput<TSchema>,
	) => TResult,
) {
	return query(schema, (arg: StandardSchemaV1.InferOutput<TSchema>) => {
		const event = getRequestEvent();
		const user = event.locals.user;
		const session = event.locals.session;
		const authContext = user !== undefined && session !== undefined ? { user, session } : null;
		return handler(authContext, arg);
	});
}

export function guardedCommand<TSchema extends StandardSchemaV1, TResult>(
	schema: TSchema,
	handler: (authContext: AuthContext, arg: StandardSchemaV1.InferOutput<TSchema>) => TResult,
) {
	return command(schema, (arg: StandardSchemaV1.InferOutput<TSchema>) => {
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

export function publicCommand<TSchema extends StandardSchemaV1, TResult>(
	schema: TSchema,
	handler: (
		authContext: AuthContext | null,
		arg: StandardSchemaV1.InferOutput<TSchema>,
	) => TResult,
) {
	return command(schema, (arg: StandardSchemaV1.InferOutput<TSchema>) => {
		const event = getRequestEvent();
		const user = event.locals.user;
		const session = event.locals.session;
		const authContext = user !== undefined && session !== undefined ? { user, session } : null;
		return handler(authContext, arg);
	});
}
