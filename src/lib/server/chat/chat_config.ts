import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { emailMatchesAdminList } from '$lib/server/admin.js';
import { createAnthropicProvider } from './anthropic_provider.js';
import { ChatProviderError, type ChatModelProvider } from './chat_model.js';
import { createFakeProvider } from './fake_provider.js';

export const CHAT_PROVIDER_KIND = {
	anthropic: 'anthropic',
	/** Scripted answers without a model: tests, local development without a key. */
	fake: 'fake',
} as const;

export type ChatProviderKind = (typeof CHAT_PROVIDER_KIND)[keyof typeof CHAT_PROVIDER_KIND];

export const DEFAULT_CHAT_MODEL = 'claude-sonnet-5-5';

/** The family allowlist: a plain-text comma-separated `CHAT_ALLOWED_EMAILS`, owned by the operator. */
export function isChatAllowedFor(email: string | null | undefined): boolean {
	return emailMatchesAdminList(email, env.CHAT_ALLOWED_EMAILS);
}

/** `CHAT_DISABLED=true` stops every new turn at once, without a deploy. */
export function isChatKillSwitchOn(): boolean {
	return env.CHAT_DISABLED?.trim().toLowerCase() === 'true';
}

/** `CHAT_PROVIDER` when set; otherwise development without a key runs the fake provider. */
export function chatProviderKind(): ChatProviderKind {
	const configured = env.CHAT_PROVIDER?.trim();
	if (configured === CHAT_PROVIDER_KIND.anthropic || configured === CHAT_PROVIDER_KIND.fake) {
		return configured;
	}
	return dev && (env.ANTHROPIC_API_KEY ?? '') === ''
		? CHAT_PROVIDER_KIND.fake
		: CHAT_PROVIDER_KIND.anthropic;
}

export function createChatProvider(): ChatModelProvider {
	if (chatProviderKind() === CHAT_PROVIDER_KIND.fake) {
		return createFakeProvider();
	}
	const apiKey = env.ANTHROPIC_API_KEY ?? '';
	if (apiKey === '') {
		throw new ChatProviderError('ANTHROPIC_API_KEY is not set', false);
	}
	const model = env.CHAT_MODEL?.trim() ?? '';
	return createAnthropicProvider({ apiKey, model: model === '' ? DEFAULT_CHAT_MODEL : model });
}
