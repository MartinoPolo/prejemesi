// Gives an existing staging user an email/password sign-in, e.g. to act as a Google-only account
// without its Google login. Touches only STAGING_DATABASE_URL, read from the
// environment or the gitignored .env.staging. Prints a generated password unless one is passed.
// Usage: pnpm exec tsx scripts/set-staging-password.ts <email> [password] (see docs/STAGING.md)
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import postgres from 'postgres';

const [email, suppliedPassword] = process.argv.slice(2);
if (email === undefined) {
	throw new Error('Usage: tsx scripts/set-staging-password.ts <email> [password]');
}

try {
	process.loadEnvFile('.env.staging');
} catch {
	// The variable may come from the environment instead.
}
const databaseUrl = process.env.STAGING_DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
	throw new Error('STAGING_DATABASE_URL is not set (env or .env.staging).');
}

const password = suppliedPassword ?? randomBytes(12).toString('base64url');
const passwordHash = await hashPassword(password);
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 30 });

try {
	const users = await sql<{ id: string }[]>`
		update "user" set email_verified = true where lower(email) = lower(${email}) returning id
	`;
	const userId = users[0]?.id;
	if (userId === undefined) {
		throw new Error(`No staging user with email ${email}.`);
	}
	const updated = await sql`
		update account set password = ${passwordHash}, updated_at = now()
		where user_id = ${userId} and provider_id = 'credential'
	`;
	if (updated.count === 0) {
		await sql`
			insert into account (id, account_id, provider_id, user_id, password)
			values (${randomUUID()}, ${userId}, 'credential', ${userId}, ${passwordHash})
		`;
	}
	console.log(
		`Staging sign-in for ${email}: ${suppliedPassword === undefined ? password : '(as supplied)'}`,
	);
} finally {
	await sql.end({ timeout: 5 });
}
