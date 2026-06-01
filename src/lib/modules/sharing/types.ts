import * as m from '$lib/paraglide/messages.js';

/** Sharing wizard step */
export const SHARE_WIZARD_STEPS = {
	confirm: 'confirm',
	share: 'share',
	success: 'success',
} as const;

export type ShareWizardStep = (typeof SHARE_WIZARD_STEPS)[keyof typeof SHARE_WIZARD_STEPS];

/** Social sharing platform */
export const SHARE_PLATFORMS = {
	clipboard: 'clipboard',
	whatsapp: 'whatsapp',
	email: 'email',
	messenger: 'messenger',
	telegram: 'telegram',
	sms: 'sms',
} as const;

export type SharePlatform = (typeof SHARE_PLATFORMS)[keyof typeof SHARE_PLATFORMS];

/** Social platform display info */
export interface SharePlatformInfo {
	id: SharePlatform;
	label: string;
	colorClass: string;
	buildUrl: (shareUrl: string, message: string) => string;
}

/** Build social intent URLs */
function buildWhatsAppUrl(shareUrl: string, message: string): string {
	return `https://wa.me/?text=${encodeURIComponent(message + ' ' + shareUrl)}`;
}

function buildEmailUrl(shareUrl: string, message: string): string {
	return `mailto:?subject=${encodeURIComponent(m.share_email_subject())}&body=${encodeURIComponent(message + ' ' + shareUrl)}`;
}

function buildMessengerUrl(shareUrl: string): string {
	return `https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=0&redirect_uri=${encodeURIComponent(shareUrl)}`;
}

function buildTelegramUrl(shareUrl: string, message: string): string {
	return `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(message)}`;
}

function buildSmsUrl(shareUrl: string, message: string): string {
	return `sms:?body=${encodeURIComponent(message + ' ' + shareUrl)}`;
}

/** All available sharing platforms with metadata */
export const SHARE_PLATFORM_INFO: Record<Exclude<SharePlatform, 'clipboard'>, SharePlatformInfo> = {
	whatsapp: {
		id: 'whatsapp',
		label: 'WhatsApp',
		colorClass: 'bg-[#25d366]',
		buildUrl: buildWhatsAppUrl,
	},
	email: {
		id: 'email',
		label: 'Email',
		colorClass: 'bg-primary',
		buildUrl: buildEmailUrl,
	},
	messenger: {
		id: 'messenger',
		label: 'Messenger',
		colorClass: 'bg-[#0084ff]',
		buildUrl: buildMessengerUrl,
	},
	telegram: {
		id: 'telegram',
		label: 'Telegram',
		colorClass: 'bg-[#26a5e4]',
		buildUrl: buildTelegramUrl,
	},
	sms: {
		id: 'sms',
		label: 'SMS',
		colorClass: 'bg-[oklch(0.62_0.18_25)]',
		buildUrl: buildSmsUrl,
	},
} as const;

/** Order of social platforms for display */
export const SHARE_PLATFORM_ORDER: Exclude<SharePlatform, 'clipboard'>[] = [
	'whatsapp',
	'email',
	'messenger',
	'telegram',
	'sms',
];

/** Build the default sharing message for a wishlist */
export function buildShareMessage(wishlistTitle: string): string {
	return m.share_message_template({ title: wishlistTitle });
}
