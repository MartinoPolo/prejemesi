import { tv } from 'tailwind-variants';

export const releaseReservationDialogVariants = tv({
	slots: {
		// max-h + overflow-y keep the ledger reachable on a short mobile viewport (the fix
		// pattern from #203); min-w-0 stops an unbreakable gifter name from widening the grid.
		body: 'flex max-h-[60vh] min-w-0 flex-col gap-2 overflow-y-auto',
		row: 'flex min-w-0 items-center gap-3 rounded-[12px] border-2 border-ink bg-surface p-3',
		rowInfo: 'flex min-w-0 flex-1 flex-col',
		// break-words: anonymous names are user-supplied and may be one unbroken token.
		rowName: 'font-heading text-sm font-semibold break-words text-foreground',
		rowMeta: 'text-xs font-semibold text-muted-foreground',
		rowBlockedReason: 'text-xs text-muted-foreground',
		rowAction: 'flex flex-none flex-col items-end gap-1',
		confirmBody: 'min-w-0 text-sm break-words text-muted-foreground',
	},
});
