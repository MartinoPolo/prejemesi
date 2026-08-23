export interface DuplicateAwareImportState<Draft> {
	acknowledgeDuplicates: boolean;
	duplicateCount: number;
	retainedDrafts: Draft[] | null;
}

export type DuplicateAwareImportResult<Gift> =
	| { status: 'duplicate-warning'; duplicateIndexes: number[] }
	| { status: 'created'; gifts: Gift[] };

export function createDuplicateAwareImportState<Draft>(): DuplicateAwareImportState<Draft> {
	return {
		acknowledgeDuplicates: false,
		duplicateCount: 0,
		retainedDrafts: null,
	};
}

export function resetDuplicateAwareImportState<Draft>(): DuplicateAwareImportState<Draft> {
	return createDuplicateAwareImportState<Draft>();
}

export async function submitDuplicateAwareImport<Draft, Gift>(input: {
	command(request: {
		wishlistId: string;
		gifts: Draft[];
		acknowledgeDuplicates: boolean;
	}): Promise<DuplicateAwareImportResult<Gift>>;
	wishlistId: string;
	drafts: Draft[];
	state: DuplicateAwareImportState<Draft>;
}): Promise<{
	result: DuplicateAwareImportResult<Gift>;
	state: DuplicateAwareImportState<Draft>;
}> {
	const drafts = input.state.acknowledgeDuplicates
		? (input.state.retainedDrafts ?? input.drafts)
		: input.drafts;
	const result = await input.command({
		wishlistId: input.wishlistId,
		gifts: drafts,
		acknowledgeDuplicates: input.state.acknowledgeDuplicates,
	});
	if (result.status === 'duplicate-warning') {
		return {
			result,
			state: {
				acknowledgeDuplicates: true,
				duplicateCount: result.duplicateIndexes.length,
				retainedDrafts: drafts,
			},
		};
	}
	return { result, state: resetDuplicateAwareImportState<Draft>() };
}
