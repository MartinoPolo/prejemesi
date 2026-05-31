import { env } from '$env/dynamic/private';
import { Resend } from 'resend';
import { NOTIFICATION_MESSAGES, type NotificationType } from '$lib/modules/notifications/types.js';

// ── Resend Client ───────────────────────────────────────────────────────────

function getResendClient(): Resend | null {
	const apiKey = env.RESEND_API_KEY;
	if (apiKey === undefined || apiKey === '') {
		return null;
	}
	return new Resend(apiKey);
}

function getSenderAddress(): string {
	return env.RESEND_FROM_EMAIL ?? 'Darecky <noreply@darecky.cz>';
}

// ── Send Email ──────────────────────────────────────────────────────────────

export async function sendNotificationEmail(
	to: string,
	subject: string,
	htmlBody: string,
): Promise<boolean> {
	const client = getResendClient();

	if (client === null) {
		console.log(`[DEV] Email to ${to}: ${subject}`);
		console.log(`[DEV] Body: ${htmlBody.slice(0, 200)}...`);
		return false;
	}

	try {
		await client.emails.send({
			from: getSenderAddress(),
			to,
			subject,
			html: htmlBody,
		});
		return true;
	} catch (error) {
		console.error('[Notifications] Failed to send email:', error);
		return false;
	}
}

// ── Email Templates ─────────────────────────────────────────────────────────

function wrapEmailTemplate(content: string): string {
	return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
    .container { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { font-size: 20px; font-weight: 700; color: #7c3aed; margin-bottom: 24px; }
    h1 { font-size: 18px; color: #18181b; margin: 0 0 12px; }
    p { font-size: 14px; color: #52525b; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; padding: 10px 20px; background: #7c3aed; color: #fff !important; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500; }
    .footer { text-align: center; font-size: 12px; color: #a1a1aa; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">🎁 Dárečky</div>
      ${content}
    </div>
    <div class="footer">
      <p>Tuto zprávu jste obdrželi z Dárečky. Pokud ji nechcete dostávat, upravte si nastavení oznámení.</p>
    </div>
  </div>
</body>
</html>`;
}

interface EmailTemplateData {
	wishlistTitle?: string;
	giftName?: string;
	actorName?: string;
	appUrl?: string;
}

export function buildNotificationEmail(
	type: NotificationType,
	data: EmailTemplateData,
): { subject: string; html: string } {
	const baseUrl = data.appUrl ?? 'https://darecky.cz';
	const message = NOTIFICATION_MESSAGES[type];

	const templates: Record<NotificationType, () => { subject: string; content: string }> = {
		liked_gift_reserved: () => ({
			subject: `${message} – ${data.giftName ?? 'Dárek'}`,
			content: `
				<h1>${message}</h1>
				<p>Dárek <strong>${data.giftName ?? ''}</strong> ze seznamu <strong>${data.wishlistTitle ?? ''}</strong> byl právě rezervován někým jiným.</p>
				<p>Zvažte výběr jiného dárku.</p>
				<a href="${baseUrl}" class="btn">Zobrazit seznam</a>
			`,
		}),
		reserved_gift_edited: () => ({
			subject: `${message} – ${data.giftName ?? 'Dárek'}`,
			content: `
				<h1>${message}</h1>
				<p>Dárek <strong>${data.giftName ?? ''}</strong>, který jste rezervovali, byl upraven.</p>
				<p>Zkontrolujte prosím, zda změny neovlivní váš výběr.</p>
				<a href="${baseUrl}" class="btn">Zobrazit dárek</a>
			`,
		}),
		wishlist_archived: () => ({
			subject: `${message} – ${data.wishlistTitle ?? 'Seznam'}`,
			content: `
				<h1>${message}</h1>
				<p>Seznam <strong>${data.wishlistTitle ?? ''}</strong> byl archivován.</p>
				<p>Seznam je nyní v režimu pouze pro čtení.</p>
				<a href="${baseUrl}" class="btn">Zobrazit seznam</a>
			`,
		}),
		owner_self_promoted: () => ({
			subject: `${message} – ${data.wishlistTitle ?? 'Seznam'}`,
			content: `
				<h1>${message}</h1>
				<p>Vlastník seznamu <strong>${data.wishlistTitle ?? ''}</strong> si aktivoval zobrazení rezervací.</p>
				<p>Vlastník nyní může vidět, kdo co rezervoval.</p>
				<a href="${baseUrl}" class="btn">Zobrazit seznam</a>
			`,
		}),
		moderator_invited: () => ({
			subject: `Pozvánka ke správě seznamu – ${data.wishlistTitle ?? 'Seznam'}`,
			content: `
				<h1>${message}</h1>
				<p>${data.actorName ?? 'Někdo'} vás pozval ke správě seznamu <strong>${data.wishlistTitle ?? ''}</strong>.</p>
				<a href="${baseUrl}" class="btn">Přijmout pozvánku</a>
			`,
		}),
		new_gift_added: () => ({
			subject: `${message} – ${data.wishlistTitle ?? 'Seznam'}`,
			content: `
				<h1>${message}</h1>
				<p>Na seznamu <strong>${data.wishlistTitle ?? ''}</strong> byl přidán nový dárek.</p>
				<a href="${baseUrl}" class="btn">Zobrazit seznam</a>
			`,
		}),
		gift_reserved: () => ({
			subject: `${message} – ${data.wishlistTitle ?? 'Seznam'}`,
			content: `
				<h1>${message}</h1>
				<p>Dárek na seznamu <strong>${data.wishlistTitle ?? ''}</strong> byl právě rezervován.</p>
				<a href="${baseUrl}" class="btn">Zobrazit seznam</a>
			`,
		}),
	};

	const template = templates[type]();
	return {
		subject: template.subject,
		html: wrapEmailTemplate(template.content),
	};
}
