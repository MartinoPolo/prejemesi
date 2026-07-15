/**
 * Database seed script – creates test accounts and sample data for local development.
 *
 * Run: pnpm db:seed
 *
 * All test accounts use SEED_PASSWORD (defined below). Accounts:
 *   martin@test.cz  – Martin Novák    (primary recipient, 4 self-lists; správce of 2 for-someone lists)
 *   jana@test.cz    – Jana Dvořáková  (moderator + recipient, 3 self-lists; co-správce of Miminko)
 *   petr@test.cz    – Petr Svoboda    (active gifter with many reservations)
 *   eva@test.cz     – Eva Králová     (casual visitor, mostly likes)
 *   tomas@test.cz   – Tomáš Černý     (mostly inactive, 2 wishlists)
 *
 * For-someone lists (issue #99): Rosie (single správce Martin) + Miminko (multi správce
 * Martin + Jana) have a free-text recipient and are managed via moderatorAssignment rows.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { user, account } from './auth.schema.js';
import { wishlist, priorityLevel } from './wishlist.schema.js';
import { gift, reservation, giftLike } from './gift.schema.js';
import { moderatorAssignment } from './moderator.schema.js';
import { claimInvite } from './claim.schema.js';
import { wishlistFollower } from './follower.schema.js';
import { notification } from './notification.schema.js';

// ---------------------------------------------------------------------------
// .env loader (avoids dotenv dependency)
// ---------------------------------------------------------------------------
try {
	const content = readFileSync('.env', 'utf-8');
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const eqIdx = trimmed.indexOf('=');
		if (eqIdx === -1) {
			continue;
		}
		const key = trimmed.slice(0, eqIdx).trim();
		const value = trimmed
			.slice(eqIdx + 1)
			.trim()
			.replace(/^["']|["']$/g, '');
		if (!(key in process.env)) {
			process.env[key] = value;
		}
	}
} catch {
	/* .env not found – rely on environment */
}

const SEED_PASSWORD = ['password', '123'].join('');

function requireEnv(name: string): string {
	const value = process.env[name];
	if (value === undefined || value === '') {
		throw new Error(`${name} not set. Create a .env file or set the environment variable.`);
	}
	return value;
}

const DATABASE_URL: string = requireEnv('DATABASE_URL');

// ---------------------------------------------------------------------------
// Seed images – fetched from Unsplash on first seed, cached in .seed-uploads/
// ---------------------------------------------------------------------------
const SEED_UPLOAD_DIR = join(process.cwd(), '.seed-uploads');

const SEED_IMAGES: Record<string, string> = {
	// Wishlists
	'seed/wl-xmas2026.jpg':
		'https://images.unsplash.com/photo-1765194493212-874b062ff31a?w=800&q=80',
	'seed/wl-bday.jpg': 'https://images.unsplash.com/photo-1531956531700-dc0ee0f1f9a5?w=800&q=80',
	'seed/wl-svatek.jpg': 'https://images.unsplash.com/photo-1775138386053-5766c8c10e85?w=800&q=80',
	'seed/wl-knihy.jpg': 'https://images.unsplash.com/photo-1747913647304-9f298ff28ff4?w=800&q=80',
	// Gifts
	'seed/g-ps5.jpg': 'https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?w=800&q=80',
	'seed/g-bunda.jpg': 'https://images.unsplash.com/photo-1487793433179-ce0b55eda342?w=800&q=80',
	'seed/g-sapiens.jpg': 'https://images.unsplash.com/photo-1710578472398-1edbbd348b79?w=800&q=80',
	'seed/g-sony.jpg': 'https://images.unsplash.com/photo-1621208587196-0b2a7d2aeb03?w=800&q=80',
	'seed/g-batoh.jpg': 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800&q=80',
	'seed/g-kytara.jpg': 'https://images.unsplash.com/photo-1589131626349-2799f057b43a?w=800&q=80',
	'seed/g-parfem.jpg': 'https://images.unsplash.com/photo-1583545889266-55be2d76c6c5?w=800&q=80',
	'seed/g-catan.jpg': 'https://images.unsplash.com/photo-1606733847546-db8546099013?w=800&q=80',
	'seed/g-kindle.jpg': 'https://images.unsplash.com/photo-1455541504462-57ebb2a9cec1?w=800&q=80',
	'seed/g-puzzle.jpg': 'https://images.unsplash.com/photo-1494059980473-813e73ee784b?w=800&q=80',
	'seed/g-svicka.jpg': 'https://images.unsplash.com/photo-1574266742257-41460b7992ee?w=800&q=80',
	'seed/g-kabelka.jpg': 'https://images.unsplash.com/photo-1683921470299-b8f0f3331657?w=800&q=80',
	'seed/g-satek.jpg': 'https://images.unsplash.com/photo-1753807971479-5a51e1445b78?w=800&q=80',
	'seed/g-lego.jpg': 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=80',
	'seed/g-lampicka.jpg': 'https://images.unsplash.com/photo-1547091267-6b2be403a763?w=800&q=80',
	'seed/g-mixer.jpg': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
	'seed/g-monstera.jpg':
		'https://images.unsplash.com/photo-1503149779833-1de50ebe5f8a?w=800&q=80',
	'seed/g-dune.jpg': 'https://images.unsplash.com/photo-1710578472398-1edbbd348b79?w=800&q=80',
	'seed/g-1984.jpg': 'https://images.unsplash.com/photo-1710578472398-1edbbd348b79?w=800&q=80',
};

async function downloadSeedImages(): Promise<void> {
	const entries = Object.entries(SEED_IMAGES);
	let downloaded = 0;
	let cached = 0;

	for (const [objectKey, url] of entries) {
		const filePath = join(SEED_UPLOAD_DIR, objectKey);
		if (existsSync(filePath)) {
			cached++;
			continue;
		}
		try {
			const response = await fetch(url, { redirect: 'follow' });
			if (!response.ok) {
				console.warn(`  ⚠ Failed to fetch ${objectKey}: HTTP ${String(response.status)}`);
				continue;
			}
			const buffer = Buffer.from(await response.arrayBuffer());
			mkdirSync(dirname(filePath), { recursive: true });
			writeFileSync(filePath, buffer);
			downloaded++;
		} catch (fetchError) {
			console.warn(`  ⚠ Failed to download ${objectKey}:`, fetchError);
		}
	}

	console.log(
		`  ${String(downloaded)} downloaded, ${String(cached)} cached, ${String(entries.length)} total`,
	);
}

const SEED_IMAGE_META = { fitMode: 'auto' as const, focal: { x: 50, y: 50 }, zoom: 1 };

function giftImage(key: string) {
	return { imageKey: key, imageUrl: `/api/upload/${key}`, imageMeta: SEED_IMAGE_META };
}

// ---------------------------------------------------------------------------
// ID constants – deterministic, prefixed for easy cleanup
// ---------------------------------------------------------------------------

// Users
const MARTIN = 'seed-martin';
const JANA = 'seed-jana';
const PETR = 'seed-petr';
const EVA = 'seed-eva';
const TOMAS = 'seed-tomas';

// Wishlists
const WL_XMAS26 = 'seed-wl-xmas26';
const WL_BDAY = 'seed-wl-bday';
const WL_DRAFT = 'seed-wl-draft';
const WL_XMAS25 = 'seed-wl-xmas25';
const WL_SVATEK = 'seed-wl-svatek';
const WL_DETSKY = 'seed-wl-detsky';
const WL_JBDAY = 'seed-wl-jbday';
const WL_BYT = 'seed-wl-byt';
const WL_KNIHY = 'seed-wl-knihy';
// Lists Martin follows – give his "Sledované" dropdown the full open/reserved/bought spread.
const WL_PBDAY = 'seed-wl-pbday'; // Petr – Martin: open
const WL_KUCHYNE = 'seed-wl-kuchyne'; // Eva – Martin: open
const WL_JXMAS = 'seed-wl-jxmas'; // Jana – Martin: bought
const WL_CHATA = 'seed-wl-chata'; // Tomáš – Martin: bought
// For-someone lists (issue #99) – free-text recipient, managed via moderatorAssignment.
const WL_ROSIE = 'seed-wl-rosie'; // recipient "Rosie" (child) – single správce: Martin
const WL_MIMINKO = 'seed-wl-miminko'; // recipient "Miminko" (baby) – multi správce: Martin + Jana
// Claim-token fixture (issue #150): free-text recipient "Klára", správce Jana, with a pending
// claim invite Eva can accept — Eva has no správce history nor reservations here, so no guard trips.
const WL_KLARA = 'seed-wl-klara';
const CLAIM_KLARA = 'seed-ci-klara'; // pending claim invite on WL_KLARA (created by Jana)
const CLAIM_KLARA_TOKEN = 'seed-claim-klara-token';

// Priority level suffix helpers
const plId = (wl: string, level: 'h' | 'm' | 'l') => `seed-pl-${wl}-${level}`;

// Gift IDs
const G_PS5 = 'seed-g-ps5';
const G_BUNDA = 'seed-g-bunda';
const G_SAPIENS = 'seed-g-sapiens';
const G_SONY = 'seed-g-sony';
const G_PONOZKY = 'seed-g-ponozky';
const G_POUKAZ = 'seed-g-poukaz';
const G_BATOH = 'seed-g-batoh';
const G_ADVENT = 'seed-g-advent';
const G_KYTARA = 'seed-g-kytara';
const G_VARENI = 'seed-g-vareni';
const G_PARFEM = 'seed-g-parfem';
const G_CATAN = 'seed-g-catan';
const G_VINO = 'seed-g-vino';
const G_TEST1 = 'seed-g-test1';
const G_TEST2 = 'seed-g-test2';
const G_TEST3 = 'seed-g-test3';
const G_KINDLE = 'seed-g-kindle';
const G_MIKINA = 'seed-g-mikina';
const G_PUZZLE = 'seed-g-puzzle';
const G_REPRO = 'seed-g-repro';
const G_SVICKA = 'seed-g-svicka';
const G_STEAM = 'seed-g-steam';
const G_KABELKA = 'seed-g-kabelka';
const G_SATEK = 'seed-g-satek';
const G_RECEPTY = 'seed-g-recepty';
const G_KYTICE = 'seed-g-kytice';
const G_LEGO = 'seed-g-lego';
const G_KOBEREC = 'seed-g-koberec';
const G_LAMPICKA = 'seed-g-lampicka';
const G_SPERKOVNICE = 'seed-g-sperkovnice';
const G_MASAZ = 'seed-g-masaz';
const G_MIXER = 'seed-g-mixer';
const G_RUCNIKY = 'seed-g-rucniky';
const G_MONSTERA = 'seed-g-monstera';
const G_DUNE = 'seed-g-dune';
const G_1984 = 'seed-g-1984';
const G_HAILMARY = 'seed-g-hailmary';
const G_SAPIENS2 = 'seed-g-sapiens2';
// Gifts on the lists Martin follows (Petr/Eva/Jana/Tomáš)
const G_DRON = 'seed-g-dron';
const G_WHISKEY = 'seed-g-whiskey';
const G_HODINKY = 'seed-g-hodinky';
const G_PANEV = 'seed-g-panev';
const G_NOZE = 'seed-g-noze';
const G_KASMIR = 'seed-g-kasmir';
const G_DECKY = 'seed-g-decky';
const G_GRIL = 'seed-g-gril';
const G_SEKERA = 'seed-g-sekera';
// Gifts on the for-someone lists (Rosie / Miminko)
const G_PANENKA = 'seed-g-panenka';
const G_ODRAZEDLO = 'seed-g-odrazedlo';
const G_KNIZKA = 'seed-g-knizka';
const G_KOCAREK = 'seed-g-kocarek';
const G_DUPACKY = 'seed-g-dupacky';
const G_CHRASTITKO = 'seed-g-chrastitko';

// Date helper
const d = (iso: string) => new Date(iso);

// ---------------------------------------------------------------------------
// Cleanup – remove all seed data (respects FK order)
// ---------------------------------------------------------------------------
async function cleanup(db: ReturnType<typeof drizzle>) {
	await db.execute(sql`
		DELETE FROM notification
		WHERE id LIKE 'seed-%'
			OR user_id LIKE 'seed-%'
			OR actor_id LIKE 'seed-%'
			OR wishlist_id LIKE 'seed-%'
			OR gift_id LIKE 'seed-%'
	`);
	await db.execute(sql`DELETE FROM gift_like WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM reservation WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM gift WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM priority_level WHERE id LIKE 'seed-%'`);
	// moderator_invite FKs to user have no ON DELETE action, so invites created
	// at runtime BY seed users (non-seed ids) must be matched via FK columns or
	// they block the final user delete. Other tables cascade from user/wishlist.
	await db.execute(sql`
		DELETE FROM moderator_invite
		WHERE id LIKE 'seed-%'
			OR wishlist_id LIKE 'seed-%'
			OR created_by_user_id LIKE 'seed-%'
			OR used_by_user_id LIKE 'seed-%'
	`);
	// claim_invite FKs to user have no ON DELETE action (same as moderator_invite): match via
	// FK columns too so runtime-created invites don't block the final user delete.
	await db.execute(sql`
		DELETE FROM claim_invite
		WHERE id LIKE 'seed-%'
			OR wishlist_id LIKE 'seed-%'
			OR created_by_user_id LIKE 'seed-%'
			OR used_by_user_id LIKE 'seed-%'
	`);
	await db.execute(sql`DELETE FROM moderator_assignment WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM wishlist_follower WHERE wishlist_id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM wishlist WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM session WHERE user_id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM account WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM verification WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM "user" WHERE id LIKE 'seed-%'`);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
async function seed() {
	const client = postgres(DATABASE_URL, { prepare: false });
	const db = drizzle(client);

	try {
		console.log('Cleaning existing seed data...');
		await cleanup(db);

		const pwHash = await hashPassword(SEED_PASSWORD);

		// ---------------------------------------------------------------
		// Users
		// ---------------------------------------------------------------
		console.log('Seeding users...');
		await db.insert(user).values([
			{
				id: MARTIN,
				name: 'Martin Novák',
				email: 'martin@test.cz',
				emailVerified: true,
				createdAt: d('2026-01-10T08:00:00Z'),
				updatedAt: d('2026-01-10T08:00:00Z'),
			},
			{
				id: JANA,
				name: 'Jana Dvořáková',
				email: 'jana@test.cz',
				emailVerified: true,
				appBackgroundTheme: 'golden-hour',
				createdAt: d('2026-01-15T12:00:00Z'),
				updatedAt: d('2026-01-15T12:00:00Z'),
			},
			{
				id: PETR,
				name: 'Petr Svoboda',
				email: 'petr@test.cz',
				emailVerified: true,
				appBackgroundTheme: 'twilight',
				createdAt: d('2026-02-01T09:00:00Z'),
				updatedAt: d('2026-02-01T09:00:00Z'),
			},
			{
				id: EVA,
				name: 'Eva Králová',
				email: 'eva@test.cz',
				emailVerified: true,
				createdAt: d('2026-02-20T14:00:00Z'),
				updatedAt: d('2026-02-20T14:00:00Z'),
			},
			{
				id: TOMAS,
				name: 'Tomáš Černý',
				email: 'tomas@test.cz',
				emailVerified: true,
				createdAt: d('2025-08-01T10:00:00Z'),
				updatedAt: d('2025-08-01T10:00:00Z'),
			},
		]);

		// ---------------------------------------------------------------
		// Accounts (BetterAuth credential provider)
		// ---------------------------------------------------------------
		await db.insert(account).values(
			[MARTIN, JANA, PETR, EVA, TOMAS].map((userId) => ({
				id: `seed-acc-${userId.replace('seed-', '')}`,
				accountId: userId,
				providerId: 'credential',
				userId,
				password: pwHash,
				createdAt: d('2026-01-10T08:00:00Z'),
				updatedAt: d('2026-01-10T08:00:00Z'),
			})),
		);

		// ---------------------------------------------------------------
		// Wishlists
		// ---------------------------------------------------------------
		console.log('Seeding wishlists...');
		await db.insert(wishlist).values([
			// Martin – active, shared, christmas
			{
				id: WL_XMAS26,
				shortId: 'xmas2026',
				recipientUserId: MARTIN,
				recipientName: null,
				// Linked recipient self-promoted to also see reservation state (disclosure only,
				// not a management right). Exercises the recipientIsModerator surface.
				recipientIsModerator: true,
				title: 'Vánoce 2026',
				description: 'Přání pod stromeček pro celou rodinu',
				eventDate: d('2026-12-24T00:00:00Z'),
				status: 'active',
				theme: 'christmas',
				palette: 'ruby',
				sharedAt: d('2026-06-15T10:00:00Z'),
				imageKey: 'seed/wl-xmas2026.jpg',
				imageSlots: {
					card: { fitMode: 'cover-crop', focal: { x: 50, y: 40 }, zoom: 1 },
					thumbnail: { fitMode: 'cover-crop', focal: { x: 50, y: 50 }, zoom: 1 },
					banner: { fitMode: 'cover-crop', focal: { x: 50, y: 30 }, zoom: 1 },
					social: { fitMode: 'contain-padded' },
				},
				createdAt: d('2026-06-01T09:00:00Z'),
				updatedAt: d('2026-06-22T14:00:00Z'),
			},
			// Martin – active, shared, birthday
			{
				id: WL_BDAY,
				shortId: 'bdaymart',
				recipientUserId: MARTIN,
				recipientName: null,
				title: 'Narozeniny Martina',
				description: 'Budu mít 30! Cokoliv z tohoto seznamu mě potěší.',
				eventDate: d('2027-03-15T00:00:00Z'),
				status: 'active',
				theme: 'birthday',
				palette: 'sakura',
				sharedAt: d('2026-02-01T08:00:00Z'),
				imageKey: 'seed/wl-bday.jpg',
				imageSlots: {
					card: { fitMode: 'cover-crop', focal: { x: 50, y: 45 }, zoom: 1 },
					thumbnail: { fitMode: 'cover-crop', focal: { x: 50, y: 50 }, zoom: 1 },
					banner: { fitMode: 'cover-crop', focal: { x: 50, y: 35 }, zoom: 1 },
					social: { fitMode: 'contain-padded' },
				},
				createdAt: d('2026-01-20T11:00:00Z'),
				updatedAt: d('2026-03-10T15:00:00Z'),
			},
			// Martin – draft
			{
				id: WL_DRAFT,
				shortId: 'draftlst',
				recipientUserId: MARTIN,
				recipientName: null,
				title: 'Nový seznam',
				status: 'draft',
				theme: 'default',
				palette: 'sky',
				createdAt: d('2026-05-20T16:00:00Z'),
				updatedAt: d('2026-05-20T16:00:00Z'),
			},
			// Martin – archived, christmas
			{
				id: WL_XMAS25,
				shortId: 'xmas2025',
				recipientUserId: MARTIN,
				recipientName: null,
				title: 'Vánoce 2025',
				eventDate: d('2025-12-24T00:00:00Z'),
				status: 'archived',
				theme: 'christmas',
				palette: 'ruby',
				sharedAt: d('2025-11-20T10:00:00Z'),
				archivedAt: d('2025-12-26T12:00:00Z'),
				createdAt: d('2025-11-01T09:00:00Z'),
				updatedAt: d('2025-12-26T12:00:00Z'),
			},
			// Jana – active, shared, elegant
			{
				id: WL_SVATEK,
				shortId: 'svatekjn',
				recipientUserId: JANA,
				recipientName: null,
				title: 'Přání k svátku',
				description: 'Svátek mám 24. května – nebojte se překvapit!',
				eventDate: d('2026-05-24T00:00:00Z'),
				status: 'active',
				theme: 'elegant',
				palette: 'graphite',
				sharedAt: d('2026-04-10T09:00:00Z'),
				imageKey: 'seed/wl-svatek.jpg',
				imageSlots: {
					card: { fitMode: 'cover-crop', focal: { x: 50, y: 50 }, zoom: 1 },
					thumbnail: { fitMode: 'cover-crop', focal: { x: 50, y: 50 }, zoom: 1 },
					banner: { fitMode: 'cover-crop', focal: { x: 50, y: 40 }, zoom: 1 },
					social: { fitMode: 'contain-padded' },
				},
				createdAt: d('2026-04-05T10:00:00Z'),
				updatedAt: d('2026-04-15T11:00:00Z'),
			},
			// Jana – draft, fun
			{
				id: WL_DETSKY,
				shortId: 'detskypk',
				recipientUserId: JANA,
				recipientName: null,
				title: 'Dětský pokoj',
				description: 'Vybavení do nového pokojíčku',
				status: 'draft',
				theme: 'fun',
				palette: 'honey',
				createdAt: d('2026-05-10T14:00:00Z'),
				updatedAt: d('2026-05-10T14:00:00Z'),
			},
			// Jana – archived, birthday
			{
				id: WL_JBDAY,
				shortId: 'janabday',
				recipientUserId: JANA,
				recipientName: null,
				title: 'Minulé narozeniny',
				eventDate: d('2025-06-20T00:00:00Z'),
				status: 'archived',
				theme: 'birthday',
				palette: 'sakura',
				sharedAt: d('2025-06-01T08:00:00Z'),
				archivedAt: d('2025-07-15T12:00:00Z'),
				createdAt: d('2025-05-15T09:00:00Z'),
				updatedAt: d('2025-07-15T12:00:00Z'),
			},
			// Tomáš – archived, default
			{
				id: WL_BYT,
				shortId: 'bytovtom',
				recipientUserId: TOMAS,
				recipientName: null,
				title: 'Výbava do bytu',
				eventDate: d('2025-10-01T00:00:00Z'),
				status: 'archived',
				theme: 'default',
				palette: 'mint',
				sharedAt: d('2025-09-01T10:00:00Z'),
				archivedAt: d('2026-01-15T12:00:00Z'),
				createdAt: d('2025-08-15T09:00:00Z'),
				updatedAt: d('2026-01-15T12:00:00Z'),
			},
			// Tomáš – active, shared, custom theme
			{
				id: WL_KNIHY,
				shortId: 'knihy026',
				recipientUserId: TOMAS,
				recipientName: null,
				title: 'Knihy 2026',
				description: 'Čtení na celý rok',
				status: 'active',
				theme: 'custom',
				customThemeColor: '#4A90D9',
				palette: 'sky',
				sharedAt: d('2026-03-10T09:00:00Z'),
				imageKey: 'seed/wl-knihy.jpg',
				imageSlots: {
					card: { fitMode: 'cover-crop', focal: { x: 50, y: 50 }, zoom: 1 },
					thumbnail: { fitMode: 'cover-crop', focal: { x: 50, y: 50 }, zoom: 1 },
					banner: { fitMode: 'cover-crop', focal: { x: 50, y: 45 }, zoom: 1 },
					social: { fitMode: 'contain-padded' },
				},
				createdAt: d('2026-03-01T11:00:00Z'),
				updatedAt: d('2026-04-20T15:00:00Z'),
			},
			// Petr – active, birthday. Martin follows, reserves nothing → OPEN.
			{
				id: WL_PBDAY,
				shortId: 'petrbday',
				recipientUserId: PETR,
				recipientName: null,
				title: 'Petrovy narozeniny',
				description: 'Třicítka se blíží!',
				eventDate: d('2026-07-15T00:00:00Z'),
				status: 'active',
				theme: 'birthday',
				palette: 'sakura',
				sharedAt: d('2026-05-20T09:00:00Z'),
				createdAt: d('2026-05-18T11:00:00Z'),
				updatedAt: d('2026-06-05T15:00:00Z'),
			},
			// Eva – active, fun. Martin follows, reserves nothing → OPEN.
			{
				id: WL_KUCHYNE,
				shortId: 'kuchyne1',
				recipientUserId: EVA,
				recipientName: null,
				title: 'Vybavení kuchyně',
				description: 'Stěhujeme se – pomozte nám zařídit kuchyni.',
				eventDate: d('2026-09-01T00:00:00Z'),
				status: 'active',
				theme: 'fun',
				palette: 'honey',
				sharedAt: d('2026-05-25T09:00:00Z'),
				createdAt: d('2026-05-22T11:00:00Z'),
				updatedAt: d('2026-06-02T15:00:00Z'),
			},
			// Jana – active, christmas. Martin reserves + marks bought → BOUGHT.
			{
				id: WL_JXMAS,
				shortId: 'janaxm26',
				recipientUserId: JANA,
				recipientName: null,
				title: 'Janiny Vánoce 2026',
				description: 'Letošní přání pod stromeček',
				eventDate: d('2026-12-24T00:00:00Z'),
				status: 'active',
				theme: 'christmas',
				palette: 'ruby',
				sharedAt: d('2026-05-15T09:00:00Z'),
				createdAt: d('2026-05-12T11:00:00Z'),
				updatedAt: d('2026-05-30T15:00:00Z'),
			},
			// Tomáš – active, default, event soon (countdown). Martin reserves + bought → BOUGHT.
			{
				id: WL_CHATA,
				shortId: 'chatatom',
				recipientUserId: TOMAS,
				recipientName: null,
				title: 'Na chatu',
				description: 'Vychytávky na víkendovou chalupu',
				eventDate: d('2026-06-20T00:00:00Z'),
				status: 'active',
				theme: 'default',
				palette: 'ocean',
				sharedAt: d('2026-05-28T09:00:00Z'),
				createdAt: d('2026-05-26T11:00:00Z'),
				updatedAt: d('2026-06-06T15:00:00Z'),
			},
			// --- For-someone lists (issue #99) ---
			// Free-text recipient (recipientName set, recipientUserId null). Management comes
			// ONLY from moderatorAssignment rows (seeded below). Exercises the „Pro {recipient}"
			// header and the orphan guard (cannot remove the last správce).
			// Rosie – single správce (Martin). Active, shared, fun theme.
			{
				id: WL_ROSIE,
				shortId: 'rosiewl1',
				recipientUserId: null,
				recipientName: 'Rosie',
				title: 'Rosčiny narozeniny',
				description: 'Dárky pro Rosie k pátým narozeninám',
				eventDate: d('2026-08-30T00:00:00Z'),
				status: 'active',
				theme: 'fun',
				palette: 'honey',
				sharedAt: d('2026-06-10T09:00:00Z'),
				createdAt: d('2026-06-08T11:00:00Z'),
				updatedAt: d('2026-06-12T15:00:00Z'),
			},
			// Miminko – multi správce (Martin + Jana). Active, shared, elegant theme.
			// Two moderatorAssignment rows exercise the plural „Spravují {names}" header.
			{
				id: WL_MIMINKO,
				shortId: 'miminko1',
				recipientUserId: null,
				recipientName: 'Miminko',
				title: 'Výbavička pro miminko',
				description: 'Seznam pro čekané miminko – spravují oba rodiče',
				eventDate: d('2026-10-15T00:00:00Z'),
				status: 'active',
				theme: 'elegant',
				palette: 'graphite',
				sharedAt: d('2026-06-18T09:00:00Z'),
				createdAt: d('2026-06-15T11:00:00Z'),
				updatedAt: d('2026-06-20T15:00:00Z'),
			},
			// Klára – claim-token fixture (issue #150). Free-text recipient, single správce (Jana),
			// active + shared. A pending claim invite (seeded below) lets Eva link her account and
			// take the list over (no správce history / reservations → guards pass).
			{
				id: WL_KLARA,
				shortId: 'klarawl1',
				recipientUserId: null,
				recipientName: 'Klára',
				title: 'Klářin adventní seznam',
				description: 'Seznam přání pro Kláru – čeká na propojení jejího účtu',
				eventDate: d('2026-12-24T00:00:00Z'),
				status: 'active',
				theme: 'christmas',
				palette: 'sky',
				sharedAt: d('2026-06-22T09:00:00Z'),
				createdAt: d('2026-06-20T11:00:00Z'),
				updatedAt: d('2026-06-22T15:00:00Z'),
			},
		]);

		// ---------------------------------------------------------------
		// Priority levels (3 per wishlist)
		// ---------------------------------------------------------------
		console.log('Seeding priority levels...');
		const allWishlists = [
			WL_XMAS26,
			WL_BDAY,
			WL_DRAFT,
			WL_XMAS25,
			WL_SVATEK,
			WL_DETSKY,
			WL_JBDAY,
			WL_BYT,
			WL_KNIHY,
			WL_PBDAY,
			WL_KUCHYNE,
			WL_JXMAS,
			WL_CHATA,
			WL_ROSIE,
			WL_MIMINKO,
			WL_KLARA,
		];
		const priorityRows = allWishlists.flatMap((wlId) => {
			const short = wlId.replace('seed-wl-', '');
			// Labels are stable i18n KEYS (ASCII), localized for display via getPriorityDisplay/
			// PRIORITY_DISPLAY. Must match DEFAULT_PRIORITY_LEVELS – diacritic labels (e.g. "Vysoká")
			// would not match the display map and would render without a priority badge.
			return [
				{ id: plId(short, 'h'), wishlistId: wlId, sortOrder: 0, label: 'Vysoka' },
				{ id: plId(short, 'm'), wishlistId: wlId, sortOrder: 1, label: 'Stredni' },
				{ id: plId(short, 'l'), wishlistId: wlId, sortOrder: 2, label: 'Nizka' },
			];
		});
		await db.insert(priorityLevel).values(priorityRows);

		// ---------------------------------------------------------------
		// Gifts
		// ---------------------------------------------------------------
		console.log('Seeding gifts...');
		await db.insert(gift).values([
			// --- Vánoce 2026 (8 gifts) ---
			{
				id: G_PS5,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'h'),
				name: 'PlayStation 5',
				description: 'Nejnovější verze, s mechanikou na disky',
				links: [
					{ url: 'https://www.alza.cz/playstation-5' },
					{ url: 'https://www.datart.cz/playstation-5', label: 'Datart' },
				],
				price: 13990,
				currency: 'CZK',
				...giftImage('seed/g-ps5.jpg'),
				sortOrder: 0,
				createdAt: d('2026-06-05T09:00:00Z'),
				updatedAt: d('2026-06-05T09:00:00Z'),
			},
			{
				id: G_BUNDA,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'm'),
				name: 'Zimní bunda North Face',
				description: 'Velikost L, černá nebo tmavě modrá',
				links: [{ url: 'https://www.sportisimo.cz/north-face' }],
				price: 4500,
				currency: 'CZK',
				...giftImage('seed/g-bunda.jpg'),
				sortOrder: 1,
				createdAt: d('2026-06-06T09:00:00Z'),
				updatedAt: d('2026-06-06T09:00:00Z'),
			},
			{
				id: G_SAPIENS,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'l'),
				name: 'Kniha – Sapiens',
				links: [{ url: 'https://www.kosmas.cz/sapiens' }],
				price: 399,
				currency: 'CZK',
				...giftImage('seed/g-sapiens.jpg'),
				sortOrder: 2,
				createdAt: d('2026-06-08T09:00:00Z'),
				updatedAt: d('2026-06-08T09:00:00Z'),
			},
			{
				id: G_SONY,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'h'),
				name: 'Sluchátka Sony WH-1000XM5',
				description: 'Bezdrátová s ANC, černá barva',
				links: [{ url: 'https://www.datart.cz/sony-wh1000xm5' }],
				price: 7990,
				currency: 'CZK',
				...giftImage('seed/g-sony.jpg'),
				sortOrder: 3,
				createdAt: d('2026-06-10T09:00:00Z'),
				updatedAt: d('2026-06-10T09:00:00Z'),
			},
			{
				id: G_PONOZKY,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'l'),
				name: 'Ponožky z merino vlny',
				description: 'Velikost 42–44, jakákoliv barva',
				price: 590,
				currency: 'CZK',
				quantity: 3,
				sortOrder: 4,
				createdAt: d('2026-06-16T09:00:00Z'),
				updatedAt: d('2026-06-16T09:00:00Z'),
			},
			{
				id: G_POUKAZ,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'm'),
				name: 'Dárkový poukaz do restaurace',
				description: 'Ideálně La Degustation nebo Alcron',
				price: 2000,
				currency: 'CZK',
				sortOrder: 5,
				createdAt: d('2026-06-17T09:00:00Z'),
				updatedAt: d('2026-06-17T09:00:00Z'),
			},
			{
				id: G_BATOH,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'l'),
				name: 'Nový batoh Osprey',
				links: [{ url: 'https://www.alza.cz/osprey-batoh' }],
				price: 1200,
				currency: 'CZK',
				...giftImage('seed/g-batoh.jpg'),
				sortOrder: 6,
				createdAt: d('2026-06-18T09:00:00Z'),
				updatedAt: d('2026-06-18T09:00:00Z'),
			},
			{
				id: G_ADVENT,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'l'),
				name: 'Čokoládový adventní kalendář',
				price: 350,
				currency: 'CZK',
				sortOrder: 7,
				received: true,
				createdAt: d('2026-06-20T09:00:00Z'),
				updatedAt: d('2026-06-20T09:00:00Z'),
			},

			// --- Narozeniny Martina (5 gifts) ---
			{
				id: G_KYTARA,
				wishlistId: WL_BDAY,
				priorityLevelId: plId('bday', 'h'),
				name: 'Elektrická kytara Fender',
				description: 'Fender Player Stratocaster, sunburst',
				links: [{ url: 'https://www.muziker.cz/fender-player' }],
				price: 15000,
				currency: 'CZK',
				...giftImage('seed/g-kytara.jpg'),
				sortOrder: 0,
			},
			{
				id: G_VARENI,
				wishlistId: WL_BDAY,
				priorityLevelId: plId('bday', 'm'),
				name: 'Kurz vaření',
				description: 'Italská kuchyně pro dva',
				price: 2500,
				currency: 'CZK',
				sortOrder: 1,
			},
			{
				id: G_PARFEM,
				wishlistId: WL_BDAY,
				priorityLevelId: plId('bday', 'm'),
				name: 'Pánský parfém',
				description: 'Dior Sauvage nebo Bleu de Chanel',
				links: [{ url: 'https://www.notino.cz/dior-sauvage' }],
				price: 1800,
				currency: 'CZK',
				...giftImage('seed/g-parfem.jpg'),
				sortOrder: 2,
			},
			{
				id: G_CATAN,
				wishlistId: WL_BDAY,
				priorityLevelId: plId('bday', 'l'),
				name: 'Stolní hra Catan',
				links: [{ url: 'https://www.bambule.cz/catan' }],
				price: 890,
				currency: 'CZK',
				...giftImage('seed/g-catan.jpg'),
				sortOrder: 3,
			},
			{
				id: G_VINO,
				wishlistId: WL_BDAY,
				priorityLevelId: plId('bday', 'l'),
				name: 'Lahev dobrého vína',
				description: 'Červené, suché – třeba Frankovka nebo Cabernet',
				price: 500,
				currency: 'CZK',
				quantity: 2,
				sortOrder: 4,
			},

			// --- Nový seznam / draft (3 gifts) ---
			{
				id: G_TEST1,
				wishlistId: WL_DRAFT,
				priorityLevelId: plId('draft', 'm'),
				name: 'Zatím nevím co přesně',
				sortOrder: 0,
			},
			{
				id: G_TEST2,
				wishlistId: WL_DRAFT,
				priorityLevelId: plId('draft', 'l'),
				name: 'Nová klávesnice',
				price: 100,
				currency: 'CZK',
				sortOrder: 1,
			},
			{
				id: G_TEST3,
				wishlistId: WL_DRAFT,
				priorityLevelId: plId('draft', 'h'),
				name: 'Luxusní pero Montblanc',
				price: 200,
				currency: 'EUR',
				sortOrder: 2,
			},

			// --- Vánoce 2025 / archived (6 gifts) ---
			{
				id: G_KINDLE,
				wishlistId: WL_XMAS25,
				priorityLevelId: plId('xmas25', 'h'),
				name: 'Kindle Paperwhite',
				price: 3490,
				currency: 'CZK',
				...giftImage('seed/g-kindle.jpg'),
				sortOrder: 0,
				received: true,
			},
			{
				id: G_MIKINA,
				wishlistId: WL_XMAS25,
				priorityLevelId: plId('xmas25', 'm'),
				name: 'Mikina Adidas',
				price: 1800,
				currency: 'CZK',
				sortOrder: 1,
				received: true,
			},
			{
				id: G_PUZZLE,
				wishlistId: WL_XMAS25,
				priorityLevelId: plId('xmas25', 'l'),
				name: 'Puzzle 1000 dílků – Starý Prahu',
				price: 450,
				currency: 'CZK',
				...giftImage('seed/g-puzzle.jpg'),
				sortOrder: 2,
				received: true,
			},
			{
				id: G_REPRO,
				wishlistId: WL_XMAS25,
				priorityLevelId: plId('xmas25', 'm'),
				name: 'Bluetooth reproduktor',
				price: 2200,
				currency: 'CZK',
				sortOrder: 3,
				received: false,
			},
			{
				id: G_SVICKA,
				wishlistId: WL_XMAS25,
				priorityLevelId: plId('xmas25', 'l'),
				name: 'Svíčka Yankee Candle',
				price: 550,
				currency: 'CZK',
				...giftImage('seed/g-svicka.jpg'),
				sortOrder: 4,
				received: true,
			},
			{
				id: G_STEAM,
				wishlistId: WL_XMAS25,
				priorityLevelId: plId('xmas25', 'm'),
				name: 'Dárkový poukaz Steam',
				price: 1000,
				currency: 'CZK',
				sortOrder: 5,
				received: true,
			},

			// --- Přání k svátku / Jana (4 gifts) ---
			{
				id: G_KABELKA,
				wishlistId: WL_SVATEK,
				priorityLevelId: plId('svatek', 'h'),
				name: 'Kabelka Coach',
				links: [{ url: 'https://www.zalando.cz/coach-kabelka' }],
				price: 120,
				currency: 'EUR',
				...giftImage('seed/g-kabelka.jpg'),
				sortOrder: 0,
			},
			{
				id: G_SATEK,
				wishlistId: WL_SVATEK,
				priorityLevelId: plId('svatek', 'm'),
				name: 'Šátek Burberry',
				price: 90,
				currency: 'EUR',
				...giftImage('seed/g-satek.jpg'),
				sortOrder: 1,
			},
			{
				id: G_RECEPTY,
				wishlistId: WL_SVATEK,
				priorityLevelId: plId('svatek', 'l'),
				name: 'Kniha receptů',
				description: 'Kuchařka od Zdeňka Pohlreicha',
				price: 350,
				currency: 'CZK',
				sortOrder: 2,
			},
			{
				id: G_KYTICE,
				wishlistId: WL_SVATEK,
				priorityLevelId: plId('svatek', 'l'),
				name: 'Květinová kytice',
				description: 'Pivoňky nebo tulipány',
				price: 800,
				currency: 'CZK',
				sortOrder: 3,
			},

			// --- Dětský pokoj / Jana draft (3 gifts) ---
			{
				id: G_LEGO,
				wishlistId: WL_DETSKY,
				priorityLevelId: plId('detsky', 'h'),
				name: 'LEGO City Hasičská stanice',
				price: 1500,
				currency: 'CZK',
				...giftImage('seed/g-lego.jpg'),
				sortOrder: 0,
			},
			{
				id: G_KOBEREC,
				wishlistId: WL_DETSKY,
				priorityLevelId: plId('detsky', 'm'),
				name: 'Dětský koberec s mapou světa',
				price: 2000,
				currency: 'CZK',
				sortOrder: 1,
			},
			{
				id: G_LAMPICKA,
				wishlistId: WL_DETSKY,
				priorityLevelId: plId('detsky', 'l'),
				name: 'Noční lampička – hvězdná projekce',
				price: 600,
				currency: 'CZK',
				...giftImage('seed/g-lampicka.jpg'),
				sortOrder: 2,
			},

			// --- Minulé narozeniny / Jana archived (2 gifts) ---
			{
				id: G_SPERKOVNICE,
				wishlistId: WL_JBDAY,
				name: 'Šperkovnice',
				price: 1500,
				currency: 'CZK',
				sortOrder: 0,
				received: true,
			},
			{
				id: G_MASAZ,
				wishlistId: WL_JBDAY,
				name: 'Masážní poukaz',
				price: 800,
				currency: 'CZK',
				sortOrder: 1,
				received: true,
			},

			// --- Výbava do bytu / Tomáš archived (3 gifts) ---
			{
				id: G_MIXER,
				wishlistId: WL_BYT,
				name: 'Mixér KitchenAid',
				price: 8990,
				currency: 'CZK',
				...giftImage('seed/g-mixer.jpg'),
				sortOrder: 0,
				received: true,
			},
			{
				id: G_RUCNIKY,
				wishlistId: WL_BYT,
				name: 'Sada ručníků',
				price: 1200,
				currency: 'CZK',
				sortOrder: 1,
				received: true,
			},
			{
				id: G_MONSTERA,
				wishlistId: WL_BYT,
				name: 'Rostlina Monstera',
				price: 450,
				currency: 'CZK',
				...giftImage('seed/g-monstera.jpg'),
				sortOrder: 2,
				received: true,
			},

			// --- Knihy 2026 / Tomáš (4 gifts) ---
			{
				id: G_DUNE,
				wishlistId: WL_KNIHY,
				priorityLevelId: plId('knihy', 'h'),
				name: 'Dune – Frank Herbert',
				links: [{ url: 'https://www.kosmas.cz/dune' }],
				price: 350,
				currency: 'CZK',
				...giftImage('seed/g-dune.jpg'),
				sortOrder: 0,
			},
			{
				id: G_1984,
				wishlistId: WL_KNIHY,
				priorityLevelId: plId('knihy', 'h'),
				name: '1984 – George Orwell',
				links: [{ url: 'https://www.kosmas.cz/1984' }],
				price: 280,
				currency: 'CZK',
				...giftImage('seed/g-1984.jpg'),
				sortOrder: 1,
			},
			{
				id: G_HAILMARY,
				wishlistId: WL_KNIHY,
				priorityLevelId: plId('knihy', 'm'),
				name: 'Projekt Hail Mary – Andy Weir',
				links: [{ url: 'https://www.kosmas.cz/hail-mary' }],
				price: 420,
				currency: 'CZK',
				sortOrder: 2,
			},
			{
				id: G_SAPIENS2,
				wishlistId: WL_KNIHY,
				priorityLevelId: plId('knihy', 'l'),
				name: 'Sapiens – ilustrovaná edice',
				links: [{ url: 'https://www.kosmas.cz/sapiens-ilustrovana' }],
				price: 590,
				currency: 'CZK',
				sortOrder: 3,
			},

			// --- Petrovy narozeniny / Petr (3 gifts, 2 free) ---
			{
				id: G_DRON,
				wishlistId: WL_PBDAY,
				priorityLevelId: plId('pbday', 'h'),
				name: 'Dron DJI Mini 4',
				price: 12990,
				currency: 'CZK',
				sortOrder: 0,
			},
			{
				id: G_HODINKY,
				wishlistId: WL_PBDAY,
				priorityLevelId: plId('pbday', 'm'),
				name: 'Chytré hodinky Garmin',
				price: 8500,
				currency: 'CZK',
				sortOrder: 1,
			},
			{
				id: G_WHISKEY,
				wishlistId: WL_PBDAY,
				priorityLevelId: plId('pbday', 'l'),
				name: 'Lahev single malt whisky',
				price: 1500,
				currency: 'CZK',
				sortOrder: 2,
			},

			// --- Vybavení kuchyně / Eva (2 gifts, both free) ---
			{
				id: G_PANEV,
				wishlistId: WL_KUCHYNE,
				priorityLevelId: plId('kuchyne', 'h'),
				name: 'Litinová pánev Le Creuset',
				price: 3200,
				currency: 'CZK',
				sortOrder: 0,
			},
			{
				id: G_NOZE,
				wishlistId: WL_KUCHYNE,
				priorityLevelId: plId('kuchyne', 'm'),
				name: 'Sada kuchyňských nožů',
				price: 2400,
				currency: 'CZK',
				sortOrder: 1,
			},

			// --- Janiny Vánoce 2026 / Jana (2 gifts) ---
			{
				id: G_KASMIR,
				wishlistId: WL_JXMAS,
				priorityLevelId: plId('jxmas', 'h'),
				name: 'Kašmírový svetr',
				price: 2900,
				currency: 'CZK',
				sortOrder: 0,
			},
			{
				id: G_DECKY,
				wishlistId: WL_JXMAS,
				priorityLevelId: plId('jxmas', 'l'),
				name: 'Hřejivá deka',
				price: 800,
				currency: 'CZK',
				sortOrder: 1,
			},

			// --- Na chatu / Tomáš (2 gifts) ---
			{
				id: G_GRIL,
				wishlistId: WL_CHATA,
				priorityLevelId: plId('chata', 'h'),
				name: 'Přenosný gril Weber',
				price: 4500,
				currency: 'CZK',
				sortOrder: 0,
			},
			{
				id: G_SEKERA,
				wishlistId: WL_CHATA,
				priorityLevelId: plId('chata', 'l'),
				name: 'Štípací sekera Fiskars',
				price: 950,
				currency: 'CZK',
				sortOrder: 1,
			},

			// --- Rosčiny narozeniny / for-someone (Rosie), 3 gifts ---
			{
				id: G_PANENKA,
				wishlistId: WL_ROSIE,
				priorityLevelId: plId('rosie', 'h'),
				name: 'Panenka s oblečky',
				description: 'Rosie si přeje panenku, kterou lze převlékat',
				price: 890,
				currency: 'CZK',
				sortOrder: 0,
			},
			{
				id: G_ODRAZEDLO,
				wishlistId: WL_ROSIE,
				priorityLevelId: plId('rosie', 'm'),
				name: 'Dřevěné odrážedlo',
				price: 1200,
				currency: 'CZK',
				sortOrder: 1,
			},
			{
				id: G_KNIZKA,
				wishlistId: WL_ROSIE,
				priorityLevelId: plId('rosie', 'l'),
				name: 'Obrázková knížka pohádek',
				price: 350,
				currency: 'CZK',
				sortOrder: 2,
			},

			// --- Výbavička pro miminko / for-someone (Miminko), 3 gifts ---
			{
				id: G_KOCAREK,
				wishlistId: WL_MIMINKO,
				priorityLevelId: plId('miminko', 'h'),
				name: 'Kočárek 3v1',
				description: 'Kombinovaný kočárek – korba, sportovní i autosedačka',
				price: 18990,
				currency: 'CZK',
				sortOrder: 0,
			},
			{
				id: G_DUPACKY,
				wishlistId: WL_MIMINKO,
				priorityLevelId: plId('miminko', 'm'),
				name: 'Sada dupaček',
				description: 'Velikost 56–68, neutrální barvy',
				price: 900,
				currency: 'CZK',
				quantity: 3,
				sortOrder: 1,
			},
			{
				id: G_CHRASTITKO,
				wishlistId: WL_MIMINKO,
				priorityLevelId: plId('miminko', 'l'),
				name: 'Chrastítko',
				price: 250,
				currency: 'CZK',
				sortOrder: 2,
			},
		]);

		// ---------------------------------------------------------------
		// Reservations
		// ---------------------------------------------------------------
		console.log('Seeding reservations...');
		await db.insert(reservation).values([
			// Vánoce 2026
			{ id: 'seed-r-1', giftId: G_PS5, userId: PETR, quantity: 1 },
			{ id: 'seed-r-2', giftId: G_SONY, userId: JANA, quantity: 1 },
			{
				id: 'seed-r-3',
				giftId: G_PONOZKY,
				anonymousName: 'Babička Marie',
				quantity: 2,
			},
			{ id: 'seed-r-4', giftId: G_ADVENT, userId: EVA, quantity: 1 },
			{
				id: 'seed-r-5',
				giftId: G_BATOH,
				anonymousName: 'Strýček Josef',
				anonymousEmail: 'josef@example.cz',
				quantity: 1,
			},

			// Narozeniny Martina
			{ id: 'seed-r-6', giftId: G_CATAN, userId: EVA, quantity: 1 },
			{ id: 'seed-r-7', giftId: G_VINO, userId: PETR, quantity: 1 },

			// Vánoce 2025 (archived)
			{ id: 'seed-r-8', giftId: G_KINDLE, userId: JANA, quantity: 1 },
			{ id: 'seed-r-9', giftId: G_MIKINA, userId: PETR, quantity: 1 },
			{ id: 'seed-r-10', giftId: G_PUZZLE, userId: EVA, quantity: 1 },
			{
				id: 'seed-r-11',
				giftId: G_SVICKA,
				anonymousName: 'Babička Marie',
				quantity: 1,
			},
			{ id: 'seed-r-12', giftId: G_STEAM, userId: PETR, quantity: 1 },

			// Jana – Přání k svátku
			{ id: 'seed-r-13', giftId: G_KABELKA, userId: MARTIN, quantity: 1 },
			{ id: 'seed-r-14', giftId: G_RECEPTY, userId: EVA, quantity: 1 },

			// Jana – Minulé narozeniny (archived)
			{ id: 'seed-r-15', giftId: G_SPERKOVNICE, userId: MARTIN, quantity: 1 },
			{ id: 'seed-r-16', giftId: G_MASAZ, userId: EVA, quantity: 1 },

			// Tomáš – Výbava do bytu (archived)
			{ id: 'seed-r-17', giftId: G_MIXER, userId: JANA, quantity: 1 },
			{ id: 'seed-r-18', giftId: G_RUCNIKY, userId: PETR, quantity: 1 },
			{ id: 'seed-r-19', giftId: G_MONSTERA, userId: EVA, quantity: 1 },

			// Tomáš – Knihy 2026 (Martin's reservation here stays unbought → "reserved")
			{ id: 'seed-r-20', giftId: G_DUNE, userId: MARTIN, quantity: 1 },
			{ id: 'seed-r-21', giftId: G_1984, userId: JANA, quantity: 1 },

			// Petrovy narozeniny – Eva reserves one (Martin reserves nothing → list stays "open")
			{ id: 'seed-r-22', giftId: G_HODINKY, userId: EVA, quantity: 1 },

			// Martin's bought lists: he reserved AND marked purchased → "bought" section.
			{
				id: 'seed-r-23',
				giftId: G_KASMIR,
				userId: MARTIN,
				quantity: 1,
				purchasedAt: d('2026-06-01T10:00:00Z'),
			},
			{
				id: 'seed-r-24',
				giftId: G_GRIL,
				userId: MARTIN,
				quantity: 1,
				purchasedAt: d('2026-06-05T14:00:00Z'),
			},

			// For-someone lists (issue #99) – gifters reserve on Rosie/Miminko so the správce
			// surfaces render reservation state. Martin (Rosie's správce) does NOT reserve here.
			{ id: 'seed-r-25', giftId: G_PANENKA, userId: EVA, quantity: 1 },
			{
				id: 'seed-r-26',
				giftId: G_DUPACKY,
				anonymousName: 'Teta Klára',
				quantity: 2,
			},
			{ id: 'seed-r-27', giftId: G_KOCAREK, userId: PETR, quantity: 1 },
		]);

		// ---------------------------------------------------------------
		// Likes
		// ---------------------------------------------------------------
		console.log('Seeding likes...');
		await db.insert(giftLike).values([
			// Vánoce 2026
			{ id: 'seed-lk-1', giftId: G_PS5, userId: JANA },
			{ id: 'seed-lk-2', giftId: G_PS5, userId: EVA },
			{ id: 'seed-lk-3', giftId: G_SONY, userId: PETR },
			{ id: 'seed-lk-4', giftId: G_BUNDA, userId: EVA },

			// Narozeniny Martina
			{ id: 'seed-lk-5', giftId: G_KYTARA, userId: JANA },
			{ id: 'seed-lk-6', giftId: G_KYTARA, userId: PETR },
			{ id: 'seed-lk-7', giftId: G_VARENI, userId: EVA },

			// Jana – Přání k svátku
			{ id: 'seed-lk-8', giftId: G_KABELKA, userId: EVA },
			{ id: 'seed-lk-9', giftId: G_SATEK, userId: MARTIN },

			// Tomáš – Knihy
			{ id: 'seed-lk-10', giftId: G_DUNE, userId: JANA },
		]);

		// ---------------------------------------------------------------
		// Moderator assignments
		// ---------------------------------------------------------------
		console.log('Seeding moderators...');
		await db.insert(moderatorAssignment).values([
			{
				id: 'seed-ma-1',
				wishlistId: WL_XMAS26,
				userId: JANA,
				assignedAt: d('2026-06-16T10:00:00Z'),
			},
			{
				id: 'seed-ma-2',
				wishlistId: WL_KNIHY,
				userId: MARTIN,
				assignedAt: d('2026-03-12T11:00:00Z'),
			},
			// For-someone lists (issue #99): management comes ONLY from these rows (no linked
			// recipient). Rosie – single správce (Martin). Header „Pro Rosie".
			{
				id: 'seed-ma-3',
				wishlistId: WL_ROSIE,
				userId: MARTIN,
				assignedAt: d('2026-06-08T11:00:00Z'),
			},
			// Miminko – multi správce (Martin + Jana). Two rows exercise the plural
			// „Spravují {names}" header and the orphan guard (cannot remove the last správce).
			{
				id: 'seed-ma-4',
				wishlistId: WL_MIMINKO,
				userId: MARTIN,
				assignedAt: d('2026-06-15T11:00:00Z'),
			},
			{
				id: 'seed-ma-5',
				wishlistId: WL_MIMINKO,
				userId: JANA,
				assignedAt: d('2026-06-16T09:00:00Z'),
			},
			// Klára – single správce (Jana). The claim invite below lets Eva take it over.
			{
				id: 'seed-ma-6',
				wishlistId: WL_KLARA,
				userId: JANA,
				assignedAt: d('2026-06-20T11:00:00Z'),
			},
		]);

		// ---------------------------------------------------------------
		// Claim invites (issue #150) – pending „Pozvat obdarovaného" link
		// ---------------------------------------------------------------
		console.log('Seeding claim invites...');
		await db.insert(claimInvite).values([
			// Pending claim link on Klára's list, created by správce Jana. Eva can open
			// /w/klarawl1/claim/<token>, sign in, and link her account as the recipient.
			{
				id: CLAIM_KLARA,
				wishlistId: WL_KLARA,
				token: CLAIM_KLARA_TOKEN,
				createdByUserId: JANA,
				createdAt: d('2026-06-23T09:00:00Z'),
			},
		]);

		// ---------------------------------------------------------------
		// Followers
		// ---------------------------------------------------------------
		console.log('Seeding followers...');
		await db.insert(wishlistFollower).values([
			// Vánoce 2026 – all active
			{ wishlistId: WL_XMAS26, userId: JANA, createdAt: d('2026-06-15T12:00:00Z') },
			{ wishlistId: WL_XMAS26, userId: PETR, createdAt: d('2026-06-16T09:00:00Z') },
			{ wishlistId: WL_XMAS26, userId: EVA, createdAt: d('2026-06-17T14:00:00Z') },

			// Narozeniny – Eva unfollowed
			{ wishlistId: WL_BDAY, userId: JANA, createdAt: d('2026-02-02T10:00:00Z') },
			{ wishlistId: WL_BDAY, userId: PETR, createdAt: d('2026-02-03T11:00:00Z') },
			{
				wishlistId: WL_BDAY,
				userId: EVA,
				createdAt: d('2026-02-05T09:00:00Z'),
				unfollowedAt: d('2026-03-20T10:00:00Z'),
			},

			// Vánoce 2025 (archived) – all active
			{ wishlistId: WL_XMAS25, userId: JANA, createdAt: d('2025-11-21T10:00:00Z') },
			{ wishlistId: WL_XMAS25, userId: PETR, createdAt: d('2025-11-22T12:00:00Z') },
			{ wishlistId: WL_XMAS25, userId: EVA, createdAt: d('2025-11-25T14:00:00Z') },

			// Jana – Přání k svátku – Petr unfollowed
			{ wishlistId: WL_SVATEK, userId: MARTIN, createdAt: d('2026-04-11T10:00:00Z') },
			{ wishlistId: WL_SVATEK, userId: EVA, createdAt: d('2026-04-12T09:00:00Z') },
			{
				wishlistId: WL_SVATEK,
				userId: PETR,
				createdAt: d('2026-04-13T11:00:00Z'),
				unfollowedAt: d('2026-04-20T15:00:00Z'),
			},

			// Tomáš – Knihy 2026
			{ wishlistId: WL_KNIHY, userId: MARTIN, createdAt: d('2026-03-11T10:00:00Z') },
			{ wishlistId: WL_KNIHY, userId: JANA, createdAt: d('2026-03-12T12:00:00Z') },

			// Tomáš – Výbava do bytu (archived)
			{ wishlistId: WL_BYT, userId: JANA, createdAt: d('2025-09-02T10:00:00Z') },
			{ wishlistId: WL_BYT, userId: PETR, createdAt: d('2025-09-05T11:00:00Z') },
			{ wishlistId: WL_BYT, userId: EVA, createdAt: d('2025-09-08T14:00:00Z') },

			// Jana – Minulé narozeniny (archived)
			{ wishlistId: WL_JBDAY, userId: MARTIN, createdAt: d('2025-06-02T10:00:00Z') },
			{ wishlistId: WL_JBDAY, userId: EVA, createdAt: d('2025-06-05T12:00:00Z') },

			// Martin's followed spread – open (Petr, Eva), bought (Jana, Tomáš).
			// Combined with WL_SVATEK + WL_KNIHY (reserved), this gives all three sections + truncation.
			{ wishlistId: WL_PBDAY, userId: MARTIN, createdAt: d('2026-05-21T10:00:00Z') },
			{ wishlistId: WL_PBDAY, userId: EVA, createdAt: d('2026-05-22T11:00:00Z') },
			{ wishlistId: WL_KUCHYNE, userId: MARTIN, createdAt: d('2026-05-26T10:00:00Z') },
			{ wishlistId: WL_JXMAS, userId: MARTIN, createdAt: d('2026-05-16T10:00:00Z') },
			{ wishlistId: WL_CHATA, userId: MARTIN, createdAt: d('2026-05-29T10:00:00Z') },
		]);

		// ---------------------------------------------------------------
		// Notifications
		// ---------------------------------------------------------------
		console.log('Seeding notifications...');
		await db.insert(notification).values([
			{
				id: 'seed-n-1',
				userId: MARTIN,
				type: 'gift_reserved',
				wishlistId: WL_XMAS26,
				giftId: G_PS5,
				actorId: PETR,
				actorName: 'Petr Svoboda',
				read: true,
				createdAt: d('2026-06-18T10:00:00Z'),
			},
			{
				id: 'seed-n-2',
				userId: MARTIN,
				type: 'gift_reserved',
				wishlistId: WL_XMAS26,
				giftId: G_SONY,
				actorId: JANA,
				actorName: 'Jana Dvořáková',
				read: false,
				createdAt: d('2026-06-20T14:00:00Z'),
			},
			{
				id: 'seed-n-3',
				userId: EVA,
				type: 'liked_gift_reserved',
				wishlistId: WL_XMAS26,
				giftId: G_PS5,
				actorId: PETR,
				actorName: 'Petr Svoboda',
				read: false,
				createdAt: d('2026-06-18T10:05:00Z'),
			},
			{
				id: 'seed-n-4',
				userId: JANA,
				type: 'wishlist_archived',
				wishlistId: WL_XMAS25,
				actorId: MARTIN,
				actorName: 'Martin Novák',
				read: true,
				createdAt: d('2025-12-26T12:00:00Z'),
			},
			{
				id: 'seed-n-5',
				userId: PETR,
				type: 'reserved_gift_edited',
				wishlistId: WL_XMAS26,
				giftId: G_PONOZKY,
				actorName: 'Jana Dvořáková',
				actorId: JANA,
				read: false,
				createdAt: d('2026-06-22T16:00:00Z'),
			},
			{
				id: 'seed-n-6',
				userId: MARTIN,
				type: 'moderator_invited',
				wishlistId: WL_XMAS26,
				actorId: JANA,
				actorName: 'Jana Dvořáková',
				read: true,
				createdAt: d('2026-06-16T10:30:00Z'),
			},
			{
				id: 'seed-n-7',
				userId: JANA,
				type: 'wishlist_archived',
				wishlistId: WL_BYT,
				actorId: TOMAS,
				actorName: 'Tomáš Černý',
				read: false,
				createdAt: d('2026-01-15T12:05:00Z'),
			},
			{
				id: 'seed-n-8',
				userId: EVA,
				type: 'gift_reserved',
				wishlistId: WL_SVATEK,
				giftId: G_KABELKA,
				actorId: MARTIN,
				actorName: 'Martin Novák',
				read: false,
				createdAt: d('2026-04-15T11:00:00Z'),
			},
		]);

		console.log('Downloading seed images...');
		await downloadSeedImages();

		console.log('');
		console.log('Seed complete! Test accounts:');
		console.log('  martin@test.cz  – Martin Novák');
		console.log('  jana@test.cz    – Jana Dvořáková');
		console.log('  petr@test.cz    – Petr Svoboda');
		console.log('  eva@test.cz     – Eva Králová');
		console.log('  tomas@test.cz   – Tomáš Černý');
		console.log(`  Login with: ${SEED_PASSWORD}`);
	} finally {
		await client.end();
	}
}

seed().catch((error) => {
	console.error('Seed failed:', error);
	process.exit(1);
});
