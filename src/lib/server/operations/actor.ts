import { error } from '@sveltejs/kit';

/** The 401 message every signed-in-only entry point uses. */
export const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';

/** Fixed channels; agent tokens use {@link tokenChannel}. */
export const OPERATION_CHANNEL = {
	ui: 'ui',
	chatbot: 'chatbot',
} as const;

const TOKEN_CHANNEL_PREFIX = 'token:';

export type OperationChannel =
	| (typeof OPERATION_CHANNEL)[keyof typeof OPERATION_CHANNEL]
	| `${typeof TOKEN_CHANNEL_PREFIX}${string}`;

/** The real user an operation acts as, and the surface it arrived through. */
export interface OperationActor {
	userId: string;
	/** Carried so notifications name the actor without another lookup. */
	userName: string;
	channel: OperationChannel;
}

export function tokenChannel(tokenName: string): OperationChannel {
	return `${TOKEN_CHANNEL_PREFIX}${tokenName}`;
}

/** Rejects an anonymous caller with 401, the same as signed-in-only remote functions. */
export function requireOperationActor(actor: OperationActor | null): OperationActor {
	if (actor === null) {
		error(401, AUTHENTICATION_REQUIRED_MESSAGE);
	}
	return actor;
}

export function userInterfaceActor(user: { id: string; name: string }): OperationActor {
	return { userId: user.id, userName: user.name, channel: OPERATION_CHANNEL.ui };
}
