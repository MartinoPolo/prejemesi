import * as m from '$lib/paraglide/messages.js';

/** Sharing wizard step */
export const SHARE_WIZARD_STEPS = {
	confirm: 'confirm',
	share: 'share',
	success: 'success',
} as const;

export type ShareWizardStep = (typeof SHARE_WIZARD_STEPS)[keyof typeof SHARE_WIZARD_STEPS];

/**
 * Share methods with a standard prefilled intent URL. Messenger is deliberately absent:
 * its only web intent, Facebook's Send dialog, rejects requests without a registered
 * Facebook app id, and `fb-messenger://share` works only in the mobile app, so Messenger
 * users paste the copied link, which unfurls from the page's Open Graph tags.
 */
const SHARE_PLATFORMS = {
	whatsapp: 'whatsapp',
	email: 'email',
	telegram: 'telegram',
	sms: 'sms',
} as const;

export type SharePlatform = (typeof SHARE_PLATFORMS)[keyof typeof SHARE_PLATFORMS];

/** Social platform display info */
export interface SharePlatformInfo {
	id: SharePlatform;
	label: string;
	colorClass: string;
	/** Web intents open in a new tab; `mailto:` and `sms:` hand off to an app from the current one. */
	opensInNewTab: boolean;
	buildUrl: (shareUrl: string, message: string) => string;
}

function messageWithLink(shareUrl: string, message: string): string {
	return `${message} ${shareUrl}`;
}

function buildWhatsAppUrl(shareUrl: string, message: string): string {
	return `https://wa.me/?text=${encodeURIComponent(messageWithLink(shareUrl, message))}`;
}

function buildEmailUrl(shareUrl: string, message: string): string {
	return `mailto:?subject=${encodeURIComponent(m.share_email_subject())}&body=${encodeURIComponent(messageWithLink(shareUrl, message))}`;
}

function buildTelegramUrl(shareUrl: string, message: string): string {
	return `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(message)}`;
}

// `?&body=` is the recipient-less form both iOS Messages and Android SMS apps prefill.
function buildSmsUrl(shareUrl: string, message: string): string {
	return `sms:?&body=${encodeURIComponent(messageWithLink(shareUrl, message))}`;
}

/** All available sharing platforms with metadata */
export const SHARE_PLATFORM_INFO: Record<SharePlatform, SharePlatformInfo> = {
	whatsapp: {
		id: 'whatsapp',
		label: 'WhatsApp',
		colorClass: 'bg-[#25d366]',
		opensInNewTab: true,
		buildUrl: buildWhatsAppUrl,
	},
	email: {
		id: 'email',
		// A getter so the label follows the active locale.
		get label() {
			return m.share_method_email();
		},
		colorClass: 'bg-primary',
		opensInNewTab: false,
		buildUrl: buildEmailUrl,
	},
	telegram: {
		id: 'telegram',
		label: 'Telegram',
		colorClass: 'bg-[#26a5e4]',
		opensInNewTab: true,
		buildUrl: buildTelegramUrl,
	},
	sms: {
		id: 'sms',
		label: 'SMS',
		colorClass: 'bg-[oklch(0.62_0.18_25)]',
		opensInNewTab: false,
		buildUrl: buildSmsUrl,
	},
};

/** Order of social platforms for display */
export const SHARE_PLATFORM_ORDER: SharePlatform[] = ['whatsapp', 'email', 'telegram', 'sms'];

/** Build the default sharing message for a wishlist */
export function buildShareMessage(wishlistTitle: string): string {
	return m.share_message_template({ title: wishlistTitle });
}
