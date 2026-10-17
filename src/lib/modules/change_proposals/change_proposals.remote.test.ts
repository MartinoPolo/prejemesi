import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RemoteModule from '$lib/server/remote.js';

const { requestEvent, changeProposalService } = vi.hoisted(() => ({
	requestEvent: {
		locals: {} as Record<string, unknown>,
		isRemoteRequest: false,
	},
	changeProposalService: {
		applyChangeProposalRows: vi.fn(),
		discardChangeProposal: vi.fn(),
		getChangeProposalForReview: vi.fn(),
		listPendingChangeProposals: vi.fn(),
		undoChangeProposal: vi.fn(),
	},
}));

vi.mock('$app/server', () => {
	/**
	 * Runs the handler directly, marked as the remote function SvelteKit expects, and keeps the
	 * input schema SvelteKit would validate with.
	 */
	const remoteFunction =
		(type: string) =>
		(...args: unknown[]) => {
			const handler = args.at(-1) as (...handlerArgs: unknown[]) => unknown;
			return Object.assign((...callArgs: unknown[]) => handler(...callArgs), {
				__: { type },
				inputSchema: args.length > 1 ? args[0] : undefined,
			});
		};
	return {
		getRequestEvent: () => requestEvent,
		query: remoteFunction('query'),
		command: remoteFunction('command'),
	};
});

vi.mock('$lib/server/agent_access/change_proposals.js', () => changeProposalService);
vi.mock('$lib/modules/gifts/gifts.remote.js', () => ({ getGiftsByWishlistShortId: vi.fn() }));
vi.mock('$lib/server/remote.js', async (importOriginal) => ({
	...(await importOriginal<typeof RemoteModule>()),
	singleFlightRefresh: vi.fn(async () => {}),
}));

import {
	applyChangeProposal,
	discardChangeProposal,
	getChangeProposal,
	getPendingChangeProposals,
	undoChangeProposal,
} from './change_proposals.remote.js';
import * as v from 'valibot';
import { singleFlightRefresh } from '$lib/server/remote.js';
import { getGiftsByWishlistShortId } from '$lib/modules/gifts/gifts.remote.js';
import {
	ApplyChangeProposalInputSchema,
	CHANGE_PROPOSAL_MAX_ROWS,
	ChangeProposalAddressSchema,
	ChangeProposalIdInputSchema,
	PendingChangeProposalsInputSchema,
} from './types.js';

const USER = { id: 'user-1', name: 'Martin', email: 'martin@test.cz' };
const address = { wishlistShortId: 'abc123', proposalId: 'proposal-1' };
const applyInput = { proposalId: 'proposal-1', selectedRowIds: ['r1'] };

type RemoteFunction = (arg?: unknown) => Promise<unknown>;

function call(remoteFunction: unknown, arg?: unknown): Promise<unknown> {
	return Promise.resolve().then(() => (remoteFunction as RemoteFunction)(arg));
}

function signIn() {
	requestEvent.locals = { user: USER, session: { id: 'session-1', userId: USER.id } };
}

function enterDemo() {
	signIn();
	requestEvent.locals.demoSession = { id: 'demo-1', expiresAt: new Date() };
}

describe('change proposal remote functions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		requestEvent.locals = {};
	});

	it('validate their input with the proposal schemas', () => {
		const inputSchemaOf = (remoteFunction: unknown) =>
			(remoteFunction as { inputSchema: unknown }).inputSchema;

		expect(inputSchemaOf(getChangeProposal)).toBe(ChangeProposalAddressSchema);
		expect(inputSchemaOf(getPendingChangeProposals)).toBe(PendingChangeProposalsInputSchema);
		expect(inputSchemaOf(applyChangeProposal)).toBe(ApplyChangeProposalInputSchema);
		expect(inputSchemaOf(discardChangeProposal)).toBe(ChangeProposalIdInputSchema);
		expect(inputSchemaOf(undoChangeProposal)).toBe(ChangeProposalIdInputSchema);
	});

	it('accept only a bounded selection of distinct non-empty row ids', () => {
		const accepts = (selectedRowIds: unknown) =>
			v.safeParse(ApplyChangeProposalInputSchema, {
				proposalId: 'proposal-1',
				selectedRowIds,
			}).success;
		const rowIds = (count: number) =>
			Array.from({ length: count }, (_, index) => `r${index + 1}`);

		expect(accepts(['r1', 'r2'])).toBe(true);
		expect(accepts(rowIds(CHANGE_PROPOSAL_MAX_ROWS))).toBe(true);
		expect(accepts([])).toBe(false);
		expect(accepts(rowIds(CHANGE_PROPOSAL_MAX_ROWS + 1))).toBe(false);
		expect(accepts(['r1', 'r1'])).toBe(false);
		expect(accepts([''])).toBe(false);
	});

	it('require a signed-in user', async () => {
		for (const [remoteFunction, arg] of [
			[getChangeProposal, address],
			[getPendingChangeProposals, { wishlistShortId: 'abc123' }],
			[applyChangeProposal, applyInput],
			[discardChangeProposal, { proposalId: 'proposal-1' }],
			[undoChangeProposal, { proposalId: 'proposal-1' }],
		] as const) {
			await expect(call(remoteFunction, arg)).rejects.toMatchObject({ status: 401 });
		}
		for (const service of Object.values(changeProposalService)) {
			expect(service).not.toHaveBeenCalled();
		}
	});

	it('read a proposal and the pending proposals as the signed-in user', async () => {
		signIn();
		changeProposalService.getChangeProposalForReview.mockResolvedValue({ id: 'proposal-1' });
		changeProposalService.listPendingChangeProposals.mockResolvedValue([]);

		await expect(call(getChangeProposal, address)).resolves.toEqual({ id: 'proposal-1' });
		await expect(
			call(getPendingChangeProposals, { wishlistShortId: 'abc123' }),
		).resolves.toEqual([]);

		expect(changeProposalService.getChangeProposalForReview).toHaveBeenCalledWith(
			USER,
			address,
		);
		expect(changeProposalService.listPendingChangeProposals).toHaveBeenCalledWith(
			USER,
			'abc123',
		);
	});

	it('apply, discard and undo as the signed-in user and return the outcome', async () => {
		signIn();
		const conflict = { outcome: 'conflict', rows: [] };
		changeProposalService.applyChangeProposalRows.mockResolvedValue(conflict);
		changeProposalService.discardChangeProposal.mockResolvedValue({
			id: 'proposal-1',
			wishlistShortId: 'abc123',
		});
		changeProposalService.undoChangeProposal.mockResolvedValue({
			outcome: 'conflict',
			changedGifts: [],
		});

		await expect(call(applyChangeProposal, applyInput)).resolves.toBe(conflict);
		await call(discardChangeProposal, { proposalId: 'proposal-1' });
		await call(undoChangeProposal, { proposalId: 'proposal-1' });

		expect(changeProposalService.applyChangeProposalRows).toHaveBeenCalledWith(
			USER,
			'proposal-1',
			['r1'],
		);
		expect(changeProposalService.discardChangeProposal).toHaveBeenCalledWith(
			USER,
			'proposal-1',
		);
		expect(changeProposalService.undoChangeProposal).toHaveBeenCalledWith(USER, 'proposal-1');
	});

	describe('refresh after a change', () => {
		const proposal = { id: 'proposal-1', wishlistShortId: 'abc123' };

		function refreshedQueries() {
			return vi.mocked(singleFlightRefresh).mock.calls;
		}

		const proposalViews = [
			[getChangeProposal, address],
			[getPendingChangeProposals, { wishlistShortId: 'abc123' }],
		];
		const giftList = [getGiftsByWishlistShortId, 'abc123'];

		it('refreshes the proposal, the pending list and the gifts once a proposal applied', async () => {
			signIn();
			changeProposalService.applyChangeProposalRows.mockResolvedValue({
				outcome: 'applied',
				proposal,
			});

			await call(applyChangeProposal, applyInput);

			expect(refreshedQueries()).toEqual([...proposalViews, giftList]);
		});

		it('refreshes the proposal, the pending list and the gifts once a proposal was undone', async () => {
			signIn();
			changeProposalService.undoChangeProposal.mockResolvedValue({
				outcome: 'undone',
				proposal,
			});

			await call(undoChangeProposal, { proposalId: 'proposal-1' });

			expect(refreshedQueries()).toEqual([...proposalViews, giftList]);
		});

		it('refreshes the proposal views but not the unchanged gifts after a discard', async () => {
			signIn();
			changeProposalService.discardChangeProposal.mockResolvedValue(proposal);

			await call(discardChangeProposal, { proposalId: 'proposal-1' });

			expect(refreshedQueries()).toEqual(proposalViews);
		});

		it('refreshes nothing after a conflict, which changed nothing', async () => {
			signIn();
			changeProposalService.applyChangeProposalRows.mockResolvedValue({
				outcome: 'conflict',
				rows: [],
			});
			changeProposalService.undoChangeProposal.mockResolvedValue({
				outcome: 'conflict',
				changedGifts: [],
			});

			await call(applyChangeProposal, applyInput);
			await call(undoChangeProposal, { proposalId: 'proposal-1' });

			expect(singleFlightRefresh).not.toHaveBeenCalled();
		});
	});

	it('reject applying, discarding and undoing in the demo', async () => {
		enterDemo();

		await expect(call(applyChangeProposal, applyInput)).rejects.toMatchObject({ status: 403 });
		await expect(
			call(discardChangeProposal, { proposalId: 'proposal-1' }),
		).rejects.toMatchObject({ status: 403 });
		await expect(call(undoChangeProposal, { proposalId: 'proposal-1' })).rejects.toMatchObject({
			status: 403,
		});
		expect(changeProposalService.applyChangeProposalRows).not.toHaveBeenCalled();
		expect(changeProposalService.discardChangeProposal).not.toHaveBeenCalled();
		expect(changeProposalService.undoChangeProposal).not.toHaveBeenCalled();
	});
});
