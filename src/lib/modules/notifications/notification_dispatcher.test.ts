import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	NOTIFICATION_TYPE,
	type NotificationPreferences,
} from './types.js';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/server/db/index.js', () => ({ getDb: vi.fn() }));
vi.mock('$lib/server/email.js', () => ({
	renderActionEmail: vi.fn(() => '<html></html>'),
	sendEmail: vi.fn(async () => undefined),
}));

import { dispatchNotification } from './notification_dispatcher.js';
import { getDb } from '$lib/server/db/index.js';
import { sendEmail } from '$lib/server/email.js';

const mockGetDb = vi.mocked(getDb);
const mockSendEmail = vi.mocked(sendEmail);

interface MockUserRow {
	id: string;
	email: string;
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

describe('dispatchNotification — honoring per-user preferences', () => {
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
});
