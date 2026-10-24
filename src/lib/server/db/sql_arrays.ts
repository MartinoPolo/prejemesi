import { sql } from 'drizzle-orm';

/**
 * A `text[]` value with one bound parameter per element. Drizzle renders a plain array inside
 * `sql` as a parenthesized list, which Postgres reads as a row, not an array.
 */
export function textArraySql(values: readonly string[]) {
	if (values.length === 0) {
		return sql`'{}'::text[]`;
	}
	return sql`ARRAY[${sql.join(
		values.map((value) => sql`${value}`),
		sql`, `,
	)}]::text[]`;
}
