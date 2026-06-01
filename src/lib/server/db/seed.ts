/**
 * Database seed script — creates test accounts and sample data for local development.
 *
 * Run: pnpm db:seed
 *
 * All test accounts use SEED_PASSWORD (defined below). Accounts:
 *   martin@test.cz  — Martin Novák    (primary owner, 4 wishlists in every state)
 *   jana@test.cz    — Jana Dvořáková  (moderator + owner, 3 wishlists)
 *   petr@test.cz    — Petr Svoboda    (active gifter with many reservations)
 *   eva@test.cz     — Eva Králová     (casual visitor, mostly likes)
 *   tomas@test.cz   — Tomáš Černý     (mostly inactive, 2 wishlists)
 */

import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { user, account } from './auth.schema.js';
import { wishlist, priorityLevel } from './wishlist.schema.js';
import { gift, reservation, giftLike } from './gift.schema.js';
import { moderatorAssignment } from './moderator.schema.js';
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
	/* .env not found — rely on environment */
}

// eslint-disable-next-line no-secrets/no-secrets -- intentional test credential
const SEED_PASSWORD = ['password', '123'].join('');

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} not set. Create a .env file or set the environment variable.`);
	}
	return value;
}

const DATABASE_URL: string = requireEnv('DATABASE_URL');

// ---------------------------------------------------------------------------
// ID constants — deterministic, prefixed for easy cleanup
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

// Date helper
const d = (iso: string) => new Date(iso);

// ---------------------------------------------------------------------------
// Cleanup — remove all seed data (respects FK order)
// ---------------------------------------------------------------------------
async function cleanup(db: ReturnType<typeof drizzle>) {
	await db.execute(sql`DELETE FROM notification WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM gift_like WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM reservation WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM gift WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM priority_level WHERE id LIKE 'seed-%'`);
	await db.execute(sql`DELETE FROM moderator_invite WHERE id LIKE 'seed-%'`);
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
				createdAt: d('2026-01-15T12:00:00Z'),
				updatedAt: d('2026-01-15T12:00:00Z'),
			},
			{
				id: PETR,
				name: 'Petr Svoboda',
				email: 'petr@test.cz',
				emailVerified: true,
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
			// Martin — active, shared, christmas
			{
				id: WL_XMAS26,
				shortId: 'xmas2026',
				ownerId: MARTIN,
				title: 'Vánoce 2026',
				description: 'Přání pod stromeček pro celou rodinu',
				eventDate: d('2026-12-24T00:00:00Z'),
				status: 'active',
				theme: 'christmas',
				sharedAt: d('2026-11-15T10:00:00Z'),
				createdAt: d('2026-11-01T09:00:00Z'),
				updatedAt: d('2026-11-20T14:00:00Z'),
			},
			// Martin — active, shared, birthday
			{
				id: WL_BDAY,
				shortId: 'bdaymart',
				ownerId: MARTIN,
				title: 'Narozeniny Martina',
				description: 'Budu mít 30! Cokoliv z tohoto seznamu mě potěší.',
				eventDate: d('2027-03-15T00:00:00Z'),
				status: 'active',
				theme: 'birthday',
				sharedAt: d('2026-02-01T08:00:00Z'),
				createdAt: d('2026-01-20T11:00:00Z'),
				updatedAt: d('2026-03-10T15:00:00Z'),
			},
			// Martin — draft
			{
				id: WL_DRAFT,
				shortId: 'draftlst',
				ownerId: MARTIN,
				title: 'Nový seznam',
				status: 'draft',
				theme: 'default',
				createdAt: d('2026-05-20T16:00:00Z'),
				updatedAt: d('2026-05-20T16:00:00Z'),
			},
			// Martin — archived, christmas
			{
				id: WL_XMAS25,
				shortId: 'xmas2025',
				ownerId: MARTIN,
				title: 'Vánoce 2025',
				eventDate: d('2025-12-24T00:00:00Z'),
				status: 'archived',
				theme: 'christmas',
				sharedAt: d('2025-11-20T10:00:00Z'),
				archivedAt: d('2025-12-26T12:00:00Z'),
				createdAt: d('2025-11-01T09:00:00Z'),
				updatedAt: d('2025-12-26T12:00:00Z'),
			},
			// Jana — active, shared, elegant
			{
				id: WL_SVATEK,
				shortId: 'svatekjn',
				ownerId: JANA,
				title: 'Přání k svátku',
				description: 'Svátek mám 24. května — nebojte se překvapit!',
				eventDate: d('2026-05-24T00:00:00Z'),
				status: 'active',
				theme: 'elegant',
				sharedAt: d('2026-04-10T09:00:00Z'),
				createdAt: d('2026-04-05T10:00:00Z'),
				updatedAt: d('2026-04-15T11:00:00Z'),
			},
			// Jana — draft, fun
			{
				id: WL_DETSKY,
				shortId: 'detskypk',
				ownerId: JANA,
				title: 'Dětský pokoj',
				description: 'Vybavení do nového pokojíčku',
				status: 'draft',
				theme: 'fun',
				createdAt: d('2026-05-10T14:00:00Z'),
				updatedAt: d('2026-05-10T14:00:00Z'),
			},
			// Jana — archived, birthday
			{
				id: WL_JBDAY,
				shortId: 'janabday',
				ownerId: JANA,
				title: 'Minulé narozeniny',
				eventDate: d('2025-06-20T00:00:00Z'),
				status: 'archived',
				theme: 'birthday',
				sharedAt: d('2025-06-01T08:00:00Z'),
				archivedAt: d('2025-07-15T12:00:00Z'),
				createdAt: d('2025-05-15T09:00:00Z'),
				updatedAt: d('2025-07-15T12:00:00Z'),
			},
			// Tomáš — archived, default
			{
				id: WL_BYT,
				shortId: 'bytovtom',
				ownerId: TOMAS,
				title: 'Výbava do bytu',
				eventDate: d('2025-10-01T00:00:00Z'),
				status: 'archived',
				theme: 'default',
				sharedAt: d('2025-09-01T10:00:00Z'),
				archivedAt: d('2026-01-15T12:00:00Z'),
				createdAt: d('2025-08-15T09:00:00Z'),
				updatedAt: d('2026-01-15T12:00:00Z'),
			},
			// Tomáš — active, shared, custom theme
			{
				id: WL_KNIHY,
				shortId: 'knihy026',
				ownerId: TOMAS,
				title: 'Knihy 2026',
				description: 'Čtení na celý rok',
				status: 'active',
				theme: 'custom',
				customThemeColor: '#4A90D9',
				sharedAt: d('2026-03-10T09:00:00Z'),
				createdAt: d('2026-03-01T11:00:00Z'),
				updatedAt: d('2026-04-20T15:00:00Z'),
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
		];
		const priorityRows = allWishlists.flatMap((wlId) => {
			const short = wlId.replace('seed-wl-', '');
			return [
				{ id: plId(short, 'h'), wishlistId: wlId, sortOrder: 0, label: 'Vysoká' },
				{ id: plId(short, 'm'), wishlistId: wlId, sortOrder: 1, label: 'Střední' },
				{ id: plId(short, 'l'), wishlistId: wlId, sortOrder: 2, label: 'Nízká' },
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
				url: 'https://www.alza.cz/playstation-5',
				price: 13990,
				currency: 'CZK',
				sortOrder: 0,
			},
			{
				id: G_BUNDA,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'm'),
				name: 'Zimní bunda North Face',
				description: 'Velikost L, černá nebo tmavě modrá',
				url: 'https://www.sportisimo.cz/north-face',
				price: 4500,
				currency: 'CZK',
				sortOrder: 1,
			},
			{
				id: G_SAPIENS,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'l'),
				name: 'Kniha — Sapiens',
				url: 'https://www.kosmas.cz/sapiens',
				price: 399,
				currency: 'CZK',
				sortOrder: 2,
			},
			{
				id: G_SONY,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'h'),
				name: 'Sluchátka Sony WH-1000XM5',
				description: 'Bezdrátová s ANC, černá barva',
				url: 'https://www.datart.cz/sony-wh1000xm5',
				price: 7990,
				currency: 'CZK',
				sortOrder: 3,
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
			},
			{
				id: G_BATOH,
				wishlistId: WL_XMAS26,
				priorityLevelId: plId('xmas26', 'l'),
				name: 'Nový batoh Osprey',
				url: 'https://www.alza.cz/osprey-batoh',
				price: 1200,
				currency: 'CZK',
				sortOrder: 6,
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
			},

			// --- Narozeniny Martina (5 gifts) ---
			{
				id: G_KYTARA,
				wishlistId: WL_BDAY,
				priorityLevelId: plId('bday', 'h'),
				name: 'Elektrická kytara Fender',
				description: 'Fender Player Stratocaster, sunburst',
				url: 'https://www.muziker.cz/fender-player',
				price: 15000,
				currency: 'CZK',
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
				url: 'https://www.notino.cz/dior-sauvage',
				price: 1800,
				currency: 'CZK',
				sortOrder: 2,
			},
			{
				id: G_CATAN,
				wishlistId: WL_BDAY,
				priorityLevelId: plId('bday', 'l'),
				name: 'Stolní hra Catan',
				url: 'https://www.bambule.cz/catan',
				price: 890,
				currency: 'CZK',
				sortOrder: 3,
			},
			{
				id: G_VINO,
				wishlistId: WL_BDAY,
				priorityLevelId: plId('bday', 'l'),
				name: 'Lahev dobrého vína',
				description: 'Červené, suché — třeba Frankovka nebo Cabernet',
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
				name: 'Puzzle 1000 dílků — Starý Prahu',
				price: 450,
				currency: 'CZK',
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
				url: 'https://www.zalando.cz/coach-kabelka',
				price: 120,
				currency: 'EUR',
				sortOrder: 0,
			},
			{
				id: G_SATEK,
				wishlistId: WL_SVATEK,
				priorityLevelId: plId('svatek', 'm'),
				name: 'Šátek Burberry',
				price: 90,
				currency: 'EUR',
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
				name: 'Noční lampička — hvězdná projekce',
				price: 600,
				currency: 'CZK',
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
				sortOrder: 2,
				received: true,
			},

			// --- Knihy 2026 / Tomáš (4 gifts) ---
			{
				id: G_DUNE,
				wishlistId: WL_KNIHY,
				priorityLevelId: plId('knihy', 'h'),
				name: 'Dune — Frank Herbert',
				url: 'https://www.kosmas.cz/dune',
				price: 350,
				currency: 'CZK',
				sortOrder: 0,
			},
			{
				id: G_1984,
				wishlistId: WL_KNIHY,
				priorityLevelId: plId('knihy', 'h'),
				name: '1984 — George Orwell',
				url: 'https://www.kosmas.cz/1984',
				price: 280,
				currency: 'CZK',
				sortOrder: 1,
			},
			{
				id: G_HAILMARY,
				wishlistId: WL_KNIHY,
				priorityLevelId: plId('knihy', 'm'),
				name: 'Projekt Hail Mary — Andy Weir',
				url: 'https://www.kosmas.cz/hail-mary',
				price: 420,
				currency: 'CZK',
				sortOrder: 2,
			},
			{
				id: G_SAPIENS2,
				wishlistId: WL_KNIHY,
				priorityLevelId: plId('knihy', 'l'),
				name: 'Sapiens — ilustrovaná edice',
				url: 'https://www.kosmas.cz/sapiens-ilustrovana',
				price: 590,
				currency: 'CZK',
				sortOrder: 3,
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

			// Jana — Přání k svátku
			{ id: 'seed-r-13', giftId: G_KABELKA, userId: MARTIN, quantity: 1 },
			{ id: 'seed-r-14', giftId: G_RECEPTY, userId: EVA, quantity: 1 },

			// Jana — Minulé narozeniny (archived)
			{ id: 'seed-r-15', giftId: G_SPERKOVNICE, userId: MARTIN, quantity: 1 },
			{ id: 'seed-r-16', giftId: G_MASAZ, userId: EVA, quantity: 1 },

			// Tomáš — Výbava do bytu (archived)
			{ id: 'seed-r-17', giftId: G_MIXER, userId: JANA, quantity: 1 },
			{ id: 'seed-r-18', giftId: G_RUCNIKY, userId: PETR, quantity: 1 },
			{ id: 'seed-r-19', giftId: G_MONSTERA, userId: EVA, quantity: 1 },

			// Tomáš — Knihy 2026
			{ id: 'seed-r-20', giftId: G_DUNE, userId: MARTIN, quantity: 1 },
			{ id: 'seed-r-21', giftId: G_1984, userId: JANA, quantity: 1 },
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

			// Jana — Přání k svátku
			{ id: 'seed-lk-8', giftId: G_KABELKA, userId: EVA },
			{ id: 'seed-lk-9', giftId: G_SATEK, userId: MARTIN },

			// Tomáš — Knihy
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
				assignedAt: d('2026-11-16T10:00:00Z'),
			},
			{
				id: 'seed-ma-2',
				wishlistId: WL_KNIHY,
				userId: MARTIN,
				assignedAt: d('2026-03-12T11:00:00Z'),
			},
		]);

		// ---------------------------------------------------------------
		// Followers
		// ---------------------------------------------------------------
		console.log('Seeding followers...');
		await db.insert(wishlistFollower).values([
			// Vánoce 2026 — all active
			{ wishlistId: WL_XMAS26, userId: JANA, createdAt: d('2026-11-15T12:00:00Z') },
			{ wishlistId: WL_XMAS26, userId: PETR, createdAt: d('2026-11-16T09:00:00Z') },
			{ wishlistId: WL_XMAS26, userId: EVA, createdAt: d('2026-11-17T14:00:00Z') },

			// Narozeniny — Eva unfollowed
			{ wishlistId: WL_BDAY, userId: JANA, createdAt: d('2026-02-02T10:00:00Z') },
			{ wishlistId: WL_BDAY, userId: PETR, createdAt: d('2026-02-03T11:00:00Z') },
			{
				wishlistId: WL_BDAY,
				userId: EVA,
				createdAt: d('2026-02-05T09:00:00Z'),
				unfollowedAt: d('2026-03-20T10:00:00Z'),
			},

			// Vánoce 2025 (archived) — all active
			{ wishlistId: WL_XMAS25, userId: JANA, createdAt: d('2025-11-21T10:00:00Z') },
			{ wishlistId: WL_XMAS25, userId: PETR, createdAt: d('2025-11-22T12:00:00Z') },
			{ wishlistId: WL_XMAS25, userId: EVA, createdAt: d('2025-11-25T14:00:00Z') },

			// Jana — Přání k svátku — Petr unfollowed
			{ wishlistId: WL_SVATEK, userId: MARTIN, createdAt: d('2026-04-11T10:00:00Z') },
			{ wishlistId: WL_SVATEK, userId: EVA, createdAt: d('2026-04-12T09:00:00Z') },
			{
				wishlistId: WL_SVATEK,
				userId: PETR,
				createdAt: d('2026-04-13T11:00:00Z'),
				unfollowedAt: d('2026-04-20T15:00:00Z'),
			},

			// Tomáš — Knihy 2026
			{ wishlistId: WL_KNIHY, userId: MARTIN, createdAt: d('2026-03-11T10:00:00Z') },
			{ wishlistId: WL_KNIHY, userId: JANA, createdAt: d('2026-03-12T12:00:00Z') },

			// Tomáš — Výbava do bytu (archived)
			{ wishlistId: WL_BYT, userId: JANA, createdAt: d('2025-09-02T10:00:00Z') },
			{ wishlistId: WL_BYT, userId: PETR, createdAt: d('2025-09-05T11:00:00Z') },
			{ wishlistId: WL_BYT, userId: EVA, createdAt: d('2025-09-08T14:00:00Z') },

			// Jana — Minulé narozeniny (archived)
			{ wishlistId: WL_JBDAY, userId: MARTIN, createdAt: d('2025-06-02T10:00:00Z') },
			{ wishlistId: WL_JBDAY, userId: EVA, createdAt: d('2025-06-05T12:00:00Z') },
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
				createdAt: d('2026-11-18T10:00:00Z'),
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
				createdAt: d('2026-11-20T14:00:00Z'),
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
				createdAt: d('2026-11-18T10:05:00Z'),
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
				type: 'gift_edited',
				wishlistId: WL_XMAS26,
				giftId: G_PONOZKY,
				actorName: 'Jana Dvořáková',
				actorId: JANA,
				read: false,
				createdAt: d('2026-11-22T16:00:00Z'),
			},
			{
				id: 'seed-n-6',
				userId: MARTIN,
				type: 'moderator_joined',
				wishlistId: WL_XMAS26,
				actorId: JANA,
				actorName: 'Jana Dvořáková',
				read: true,
				createdAt: d('2026-11-16T10:30:00Z'),
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

		console.log('');
		console.log('Seed complete! Test accounts:');
		console.log('  martin@test.cz  — Martin Novák');
		console.log('  jana@test.cz    — Jana Dvořáková');
		console.log('  petr@test.cz    — Petr Svoboda');
		console.log('  eva@test.cz     — Eva Králová');
		console.log('  tomas@test.cz   — Tomáš Černý');
		console.log(`  Login with: ${SEED_PASSWORD}`);
	} finally {
		await client.end();
	}
}

seed().catch((error) => {
	console.error('Seed failed:', error);
	process.exit(1);
});
