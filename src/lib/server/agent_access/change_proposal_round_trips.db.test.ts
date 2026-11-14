import {
	DB_READY,
	MANAGER_ID,
	createGiftFixture,
	createWishlistFixture,
	readGift,
	removeFixtureRows,
	seedFixtureUsers,
} from '$lib/server/operations/operations.db.test-setup.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as v from 'valibot';
import net from 'node:net';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { resolveDatabaseUrl } from '$lib/config/runtime_environment.js';
import { rememberDatabaseBinding } from '$lib/server/db/index.js';
import { CreateAccessTokenInputSchema } from '$lib/modules/access_tokens/types.js';
import { CHANGE_PROPOSAL_OUTCOME } from '$lib/modules/change_proposals/types.js';
import { authenticateAccessToken, createAccessToken } from './access_tokens.js';
import { submitChangeProposal } from './change_proposal_api.js';
import { applyRows } from './change_proposals.db.test-setup.js';

/** Long enough that statements sent together reach the server as one flight. */
const ONE_WAY_DELAY_MS = 10;

const POSTGRES_PROTOCOL_VERSION = 196608;
const STARTUP_PACKET = 'startup';
/** Client messages the server answers with exactly one ReadyForQuery: Sync and simple Query. */
const REQUEST_ENDING_MESSAGES = new Set(['S', 'Q']);
const READY_FOR_QUERY = 'Z';

/**
 * Reads the type of each complete PostgreSQL protocol message in one direction of a connection,
 * across chunk boundaries. The client's first message, the startup packet, has no type byte.
 */
function messageTypeReader({ startsWithStartupPacket }: { startsWithStartupPacket: boolean }) {
	let unread = Buffer.alloc(0);
	let expectsStartupPacket = startsWithStartupPacket;
	return (chunk: Buffer): string[] => {
		unread = Buffer.concat([unread, chunk]);
		const types: string[] = [];
		for (;;) {
			const lengthOffset = expectsStartupPacket ? 0 : 1;
			if (unread.length < lengthOffset + 4) {
				return types;
			}
			const messageEnd = lengthOffset + unread.readUInt32BE(lengthOffset);
			if (unread.length < messageEnd) {
				return types;
			}
			if (expectsStartupPacket && unread.readUInt32BE(4) !== POSTGRES_PROTOCOL_VERSION) {
				throw new Error('The round trip proxy needs an unencrypted PostgreSQL connection');
			}
			types.push(expectsStartupPacket ? STARTUP_PACKET : String.fromCharCode(unread[0]));
			unread = unread.subarray(messageEnd);
			expectsStartupPacket = false;
		}
	};
}

/**
 * A TCP proxy in front of the test database that delays traffic like a remote database and counts
 * round trips: client flights sent after the client last received a response. It reads the
 * protocol to hand the client a response only once the server has answered every request in
 * flight. Otherwise a busy server that spreads one flight's answers over more than the delay makes
 * the client follow up in several flights, and the count would measure the server's pace.
 */
async function startRoundTripProxy(databaseUrl: URL) {
	let roundTrips = 0;
	const delayedWriter = (to: net.Socket) => {
		let previous = Promise.resolve();
		return {
			write(chunk: Buffer) {
				const arrival = new Promise((resolve) => setTimeout(resolve, ONE_WAY_DELAY_MS));
				previous = previous.then(() => arrival).then(() => void to.write(chunk));
			},
			end: () => void previous.then(() => to.end()),
		};
	};
	const server = net.createServer((client) => {
		const database = net.connect(Number(databaseUrl.port || 5432), databaseUrl.hostname);
		const toDatabase = delayedWriter(database);
		const toClient = delayedWriter(client);
		const requestMessageTypes = messageTypeReader({ startsWithStartupPacket: true });
		const responseMessageTypes = messageTypeReader({ startsWithStartupPacket: false });
		let awaitingResponse = false;
		let sessionStarted = false;
		let unansweredRequests = 0;
		let heldResponse: Buffer[] = [];
		client.on('data', (chunk: Buffer) => {
			if (!awaitingResponse) {
				roundTrips += 1;
				awaitingResponse = true;
			}
			unansweredRequests += requestMessageTypes(chunk).filter((type) =>
				REQUEST_ENDING_MESSAGES.has(type),
			).length;
			toDatabase.write(chunk);
		});
		database.on('data', (chunk: Buffer) => {
			for (const type of responseMessageTypes(chunk)) {
				if (type !== READY_FOR_QUERY) {
					continue;
				}
				// The startup exchange ends with a ReadyForQuery that answers no request.
				if (sessionStarted) {
					unansweredRequests -= 1;
				} else {
					sessionStarted = true;
				}
			}
			heldResponse.push(chunk);
			if (unansweredRequests === 0) {
				toClient.write(Buffer.concat(heldResponse));
				heldResponse = [];
				awaitingResponse = false;
			}
		});
		client.on('end', toDatabase.end);
		database.on('end', () => {
			// A server closing mid-request still owes the client its last messages, such as an error.
			if (heldResponse.length > 0) {
				toClient.write(Buffer.concat(heldResponse));
			}
			toClient.end();
		});
		client.on('error', () => database.destroy());
		database.on('error', () => client.destroy());
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (address === null || typeof address === 'string') {
		throw new Error('Proxy has no port');
	}
	const proxiedUrl = new URL(databaseUrl);
	proxiedUrl.hostname = '127.0.0.1';
	proxiedUrl.port = String(address.port);
	return {
		url: proxiedUrl.toString(),
		/** Round trips since the previous call. */
		takeRoundTrips() {
			const counted = roundTrips;
			roundTrips = 0;
			return counted;
		},
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
}

async function giftUpdateProposalFixture(rowCount: number) {
	const wishlist = await createWishlistFixture({
		sharedAt: new Date(Date.now() - 60 * 60 * 1000),
	});
	const giftIds: string[] = [];
	for (let index = 0; index < rowCount; index += 1) {
		giftIds.push(await createGiftFixture(wishlist.id));
	}
	return {
		wishlistShortId: wishlist.shortId,
		operations: giftIds.map((id, index) => ({
			operation: 'updateGift',
			input: { id, price: 100 + index, description: `Popis ${index}` },
		})),
	};
}

describe.skipIf(!DB_READY)('change proposal round trips', () => {
	let proxy: Awaited<ReturnType<typeof startRoundTripProxy>> | undefined;
	beforeAll(seedFixtureUsers);
	afterAll(async () => {
		await removeFixtureRows();
		await proxy?.close();
	});

	it(
		'submits and applies gift edits in round trips that do not grow with the row count',
		{ timeout: 60_000 },
		async () => {
			const { value } = await createAccessToken(
				MANAGER_ID,
				v.parse(CreateAccessTokenInputSchema, {
					name: 'Claude',
					scopes: ['gifts:write'],
					wishlistIds: null,
				}),
			);
			const token = await authenticateAccessToken(`Bearer ${value}`);
			const small = await giftUpdateProposalFixture(5);
			const large = await giftUpdateProposalFixture(40);
			const databaseUrl = resolveDatabaseUrl(env);
			if (databaseUrl === undefined) {
				throw new Error('DB_READY without a database URL');
			}
			proxy = await startRoundTripProxy(new URL(databaseUrl));
			const proxied = proxy;
			// Hyperdrive's connection string wins over DATABASE_URL, so every later query goes through it.
			rememberDatabaseBinding({
				platform: { env: { HYPERDRIVE: { connectionString: proxied.url } } },
			} as unknown as RequestEvent);

			const measure = async (
				proposal: Awaited<ReturnType<typeof giftUpdateProposalFixture>>,
			) => {
				proxied.takeRoundTrips();
				const submitted = await submitChangeProposal(token, proposal);
				const submitRoundTrips = proxied.takeRoundTrips();
				const applied = await applyRows(
					{ id: MANAGER_ID, name: 'Manager' },
					submitted.id,
					submitted.rows.map((row) => row.rowId),
				);
				expect(applied.outcome).toBe(CHANGE_PROPOSAL_OUTCOME.applied);
				const applyRoundTrips = proxied.takeRoundTrips();
				for (const { input } of proposal.operations) {
					expect((await readGift(input.id)).price).toBe(input.price);
				}
				return { submit: submitRoundTrips, apply: applyRoundTrips };
			};
			// Warms the connection, as the first request on a pooled connection would.
			await measure(await giftUpdateProposalFixture(2));
			const smallRoundTrips = await measure(small);
			const largeRoundTrips = await measure(large);

			// Row by row, each further gift edit would add several round trips to both.
			const extraRows = large.operations.length - small.operations.length;
			expect(largeRoundTrips.submit - smallRoundTrips.submit).toBeLessThan(extraRows / 4);
			expect(largeRoundTrips.apply - smallRoundTrips.apply).toBeLessThan(extraRows / 4);
		},
	);
});
