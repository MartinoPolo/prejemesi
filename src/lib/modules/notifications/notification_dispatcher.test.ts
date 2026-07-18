import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	NOTIFICATION_TYPE,
	type NotificationPreferences,
} from './types.js';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/server/db/index.js', () => ({ getDb: vi.fn() }));
vi.mock('$lib/server/email.js', () => ({
	renderActionEmailParts: vi.fn(() => ({ html: '<html></html>', text: 'text' })),
	sendEmail: vi.fn(async () => undefined),
}));

import { dispatchNotification } from './notification_dispatcher.js';
import { getDb } from '$lib/server/db/index.js';
import { sendEmail, renderActionEmailParts } from '$lib/server/email.js';

const mockGetDb = vi.mocked(getDb);
const mockSendEmail = vi.mocked(sendEmail);
const mockRenderActionEmailParts = vi.mocked(renderActionEmailParts);

interface MockUserRow {
	id: string;
	email: string;
	preferredLocale?: 'cs' | 'en' | null;
	notificationPreferences: NotificationPreferences | null;
}

/**
 * Minimal recording db: returns the given user rows for the recipient query, records
 * the values passed to insert().values(), and resolves insert/update chains.
 * Called with no `wishlistId` so the wishlist-context select is skipped.
 */
function makeDispatcherDb(userRows: MockUserRow[]) {
	const insertedValues: Array<{ userId: string }> = [];

	const db = {
		select: () => ({
			from: () => ({
				where: () => Promise.resolve(userRows),
			}),
		}),
		insert: () => ({
			values: (rows: Array<{ userId: string }>) => {
				insertedValues.push(...rows);
				return {
					returning: () =>
						Promise.resolve(
							rows.map((row, i) => ({ id: `notif-${i}`, userId: row.userId })),
						),
				};
			},
		}),
		update: () => ({
			set: () => ({
				where: () => Promise.resolve(undefined),
			}),
		}),
	};

	return { db: db as unknown as ReturnType<typeof getDb>, insertedValues };
}

function makeWishlistDispatcherDb(
	userRows: MockUserRow[],
	wishlistRow: { title: string; shortId: string },
) {
	let selectCount = 0;

	const db = {
		select: () => {
			const rows = selectCount++ === 0 ? [wishlistRow] : userRows;
			const query = Promise.resolve(rows);
			return {
				from: () => ({
					where: () => Object.assign(query, { limit: () => Promise.resolve(rows) }),
				}),
			};
		},
		insert: () => ({
			values: (rows: Array<{ userId: string }>) => ({
				returning: () =>
					Promise.resolve(
						rows.map((row, index) => ({ id: `notif-${index}`, userId: row.userId })),
					),
			}),
		}),
		update: () => ({
			set: () => ({
				where: () => Promise.resolve(undefined),
			}),
		}),
	};

	return db as unknown as ReturnType<typeof getDb>;
}

/** Defaults with a single type's entry overridden. */
function prefsWith(
	type: (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE],
	entry: { email: boolean; inApp: boolean },
): NotificationPreferences {
	return { ...DEFAULT_NOTIFICATION_PREFERENCES, [type]: entry };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('dispatchNotification – honoring per-user preferences', () => {
	it('inserts in-app rows only for users with in-app enabled', async () => {
		const type = NOTIFICATION_TYPE.RESERVED_GIFT_EDITED; // email-capable type
		const { db, insertedValues } = makeDispatcherDb([
			{ id: 'u-default', email: 'a@test.cz', notificationPreferences: null }, // default: inApp true
			{
				id: 'u-no-inapp',
				email: 'b@test.cz',
				notificationPreferences: prefsWith(type, { email: true, inApp: false }),
			},
		]);
		mockGetDb.mockReturnValue(db);

		await dispatchNotification({ type, targetUserIds: ['u-default', 'u-no-inapp'] });

		expect(insertedValues.map((row) => row.userId)).toEqual(['u-default']);
	});

	it('emails only users with email enabled (for email-capable types)', async () => {
		const type = NOTIFICATION_TYPE.RESERVED_GIFT_EDITED;
		const { db } = makeDispatcherDb([
			{ id: 'u-default', email: 'yes@test.cz', notificationPreferences: null }, // default: email true
			{
				id: 'u-no-email',
				email: 'no@test.cz',
				notificationPreferences: prefsWith(type, { email: false, inApp: true }),
			},
		]);
		mockGetDb.mockReturnValue(db);

		await dispatchNotification({ type, targetUserIds: ['u-default', 'u-no-email'] });

		const emailed = mockSendEmail.mock.calls.map((call) => call[0].to);
		expect(emailed).toEqual(['yes@test.cz']);
	});

	it('emails an email-only user even though no in-app row exists for them', async () => {
		const type = NOTIFICATION_TYPE.RESERVED_GIFT_EDITED;
		const { db, insertedValues } = makeDispatcherDb([
			{
				id: 'u-email-only',
				email: 'mail@test.cz',
				notificationPreferences: prefsWith(type, { email: true, inApp: false }),
			},
		]);
		mockGetDb.mockReturnValue(db);

		await dispatchNotification({ type, targetUserIds: ['u-email-only'] });

		expect(insertedValues).toHaveLength(0);
		expect(mockSendEmail.mock.calls.map((call) => call[0].to)).toEqual(['mail@test.cz']);
	});

	it('never emails for in-app-only types, even if a user enabled email', async () => {
		const type = NOTIFICATION_TYPE.NEW_GIFT_ADDED; // not in EMAIL_NOTIFICATION_TYPES
		const { db } = makeDispatcherDb([
			{
				id: 'u',
				email: 'u@test.cz',
				notificationPreferences: prefsWith(type, { email: true, inApp: true }),
			},
		]);
		mockGetDb.mockReturnValue(db);

		await dispatchNotification({ type, targetUserIds: ['u'] });

		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it('treats NULL preferences as the product defaults', async () => {
		const type = NOTIFICATION_TYPE.WISHLIST_ARCHIVED; // default email+inApp true
		const { db, insertedValues } = makeDispatcherDb([
			{ id: 'u', email: 'u@test.cz', notificationPreferences: null },
		]);
		mockGetDb.mockReturnValue(db);

		await dispatchNotification({ type, targetUserIds: ['u'] });

		expect(insertedValues.map((row) => row.userId)).toEqual(['u']);
		expect(mockSendEmail.mock.calls.map((call) => call[0].to)).toEqual(['u@test.cz']);
	});

	it('backfills a type absent from an older partial stored row (no undefined crash)', async () => {
		// A row saved before this type existed omits its key. Dispatch must fall back to the
		// default entry for the missing type instead of reading `undefined.inApp`.
		const type = NOTIFICATION_TYPE.RESERVATION_CANCELLED; // default email+inApp true
		const partialStored = Object.fromEntries(
			Object.entries(DEFAULT_NOTIFICATION_PREFERENCES).filter(([key]) => key !== type),
		);
		// Cast: the stored JSONB is partial at runtime but typed complete (the bug's root cause).
		const { db, insertedValues } = makeDispatcherDb([
			{
				id: 'u',
				email: 'u@test.cz',
				notificationPreferences: partialStored as unknown as NotificationPreferences,
			},
		]);
		mockGetDb.mockReturnValue(db);

		await dispatchNotification({ type, targetUserIds: ['u'] });

		expect(insertedValues.map((row) => row.userId)).toEqual(['u']);
		expect(mockSendEmail.mock.calls.map((call) => call[0].to)).toEqual(['u@test.cz']);
	});
});

describe('dispatchNotification – urlPathOverride', () => {
	it('when urlPathOverride is set, email CTA url is origin + override path (not plain wishlist url)', async () => {
		const type = NOTIFICATION_TYPE.MODERATOR_INVITED;
		const overridePath = '/w/short-abc/invite/tok-xyz';
		const testEmail = 'invitee@example.com';

		// Minimal db: wishlist context returns null (no wishlistId), email-recipient query is empty.
		const db = {
			select: () => ({
				from: () => ({
					where: () => {
						const query = Promise.resolve([]);
						return Object.assign(query, { limit: () => Promise.resolve([]) });
					},
				}),
			}),
			insert: () => ({
				values: (rows: Array<{ userId: string }>) => ({
					returning: () =>
						Promise.resolve(
							rows.map((row, i) => ({ id: `n-${i}`, userId: row.userId })),
						),
				}),
			}),
			update: () => ({
				set: () => ({
					where: () => Promise.resolve(undefined),
				}),
			}),
		};
		mockGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

		await dispatchNotification({
			type,
			targetEmails: [testEmail],
			urlPathOverride: overridePath,
		});

		expect(mockSendEmail).toHaveBeenCalledOnce();
		// The url passed to renderActionEmailParts must be origin + overridePath
		expect(mockRenderActionEmailParts).toHaveBeenCalledWith(
			expect.objectContaining({ url: `http://localhost:5173${overridePath}` }),
		);
	});
});

describe('dispatchNotification email locale', () => {
	const type = NOTIFICATION_TYPE.WISHLIST_ARCHIVED;
	const wishlistRow = { title: "Rosie's birthday", shortId: 'rosie-birthday' };

	it("renders email copy and the wishlist URL in a registered recipient's preferred locale", async () => {
		const db = makeWishlistDispatcherDb(
			[
				{
					id: 'english-recipient',
					email: 'english@example.com',
					preferredLocale: 'en',
					notificationPreferences: null,
				},
			],
			wishlistRow,
		);
		mockGetDb.mockReturnValue(db);

		await dispatchNotification({
			type,
			targetUserIds: ['english-recipient'],
			wishlistId: 'wishlist-id',
			actorName: 'Martin',
		});

		expect(mockSendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'english@example.com',
				subject: 'List was archived',
			}),
		);
		expect(mockRenderActionEmailParts).toHaveBeenCalledWith(
			expect.objectContaining({
				heading: 'List was archived',
				body: expect.stringContaining("Wishlist: Rosie's birthday"),
				buttonLabel: 'Open wishlist',
				copyLinkText: 'Or copy this link into your browser:',
				url: 'http://localhost:5173/en/w/rosie-birthday',
			}),
		);
	});

	it('falls back to Czech for recipients without a stored locale and email-only recipients', async () => {
		const db = makeWishlistDispatcherDb(
			[
				{
					id: 'default-recipient',
					email: 'default@example.com',
					preferredLocale: null,
					notificationPreferences: null,
				},
			],
			wishlistRow,
		);
		mockGetDb.mockReturnValue(db);

		await dispatchNotification({
			type,
			targetUserIds: ['default-recipient'],
			targetEmails: ['anonymous@example.com'],
			wishlistId: 'wishlist-id',
		});

		expect(mockSendEmail).toHaveBeenCalledTimes(2);
		expect(mockRenderActionEmailParts).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				heading: 'Seznam byl archivován',
				body: expect.stringContaining("Seznam přání: Rosie's birthday"),
				buttonLabel: 'Otevřít seznam',
				copyLinkText: 'Nebo zkopírujte tento odkaz do prohlížeče:',
				url: 'http://localhost:5173/w/rosie-birthday',
			}),
		);
		expect(mockRenderActionEmailParts).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				heading: 'Seznam byl archivován',
				url: 'http://localhost:5173/w/rosie-birthday',
			}),
		);
	});

	it('uses the stored locale when an existing recipient is addressed by email only', async () => {
		const db = makeWishlistDispatcherDb(
			[
				{
					id: 'english-invitee',
					email: 'invitee@example.com',
					preferredLocale: 'en',
					notificationPreferences: null,
				},
			],
			wishlistRow,
		);
		mockGetDb.mockReturnValue(db);

		await dispatchNotification({
			type: NOTIFICATION_TYPE.MODERATOR_INVITED,
			targetEmails: ['invitee@example.com'],
			wishlistId: 'wishlist-id',
			urlPathOverride: '/w/rosie-birthday/invite/token',
		});

		expect(mockSendEmail).toHaveBeenCalledOnce();
		expect(mockRenderActionEmailParts).toHaveBeenCalledWith(
			expect.objectContaining({
				buttonLabel: 'Open wishlist',
				url: 'http://localhost:5173/en/w/rosie-birthday/invite/token',
			}),
		);
	});
});
