import { text, timestamp, type AnyPgColumn } from 'drizzle-orm/pg-core';

/** Required reference from a row that belongs to its parent and is removed with it. */
export function cascadingReferenceColumn(columnName: string, referencedColumn: () => AnyPgColumn) {
	return text(columnName).notNull().references(referencedColumn, { onDelete: 'cascade' });
}

/** Soft-delete marker plus creation and last-update times of an editable row. */
export function softDeletableTimestampColumns() {
	return {
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	};
}
