import { text, type AnyPgColumn } from 'drizzle-orm/pg-core';

/** Required reference from a row that belongs to its parent and is removed with it. */
export function cascadingReferenceColumn(columnName: string, referencedColumn: () => AnyPgColumn) {
	return text(columnName).notNull().references(referencedColumn, { onDelete: 'cascade' });
}
