import { demoSessionId } from '$lib/server/demo/scope.js';
import { CHAT_AVAILABILITY, type ChatAvailability } from '$lib/modules/chat/types.js';
import { isChatAllowedFor, isChatKillSwitchOn } from './chat_config.js';
import { countUserMessagesSince } from './chat_store.js';
import { CHAT_LIMITS, chatDayStart } from './limits.js';

/** Every demo visitor gets the scripted chat; elsewhere it exists only for the family allowlist. */
export function isChatOfferedTo(email: string): boolean {
	return demoSessionId() !== null || isChatAllowedFor(email);
}

/**
 * Whether the assistant takes a new message from the user now. It gates new turns only:
 * history stays readable, and proposals already made apply through the review endpoints.
 */
export async function chatAvailability(
	user: { id: string; email: string },
	now = new Date(),
): Promise<ChatAvailability> {
	if (demoSessionId() !== null) {
		return CHAT_AVAILABILITY.demo;
	}
	if (!isChatAllowedFor(user.email)) {
		return CHAT_AVAILABILITY.notAllowed;
	}
	if (isChatKillSwitchOn()) {
		return CHAT_AVAILABILITY.disabled;
	}
	const dayStart = chatDayStart(now);
	const [everyonesMessages, usersMessages] = await Promise.all([
		countUserMessagesSince(dayStart, null),
		countUserMessagesSince(dayStart, user.id),
	]);
	if (everyonesMessages >= CHAT_LIMITS.globalMessagesPerDay) {
		return CHAT_AVAILABILITY.disabled;
	}
	if (usersMessages >= CHAT_LIMITS.userMessagesPerDay) {
		return CHAT_AVAILABILITY.dailyCapReached;
	}
	return CHAT_AVAILABILITY.available;
}
