import { isNull, lte, or } from 'drizzle-orm';
import { notification } from '$lib/server/db/notification.schema.js';

/** Legacy rows are immediately visible; delayed rows become visible at their delivery time. */
export function notificationIsVisible(at: Date = new Date()) {
	return or(isNull(notification.visibleAt), lte(notification.visibleAt, at));
}
