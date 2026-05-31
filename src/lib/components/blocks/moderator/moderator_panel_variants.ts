import { tv } from 'tailwind-variants';

export const moderatorPanelVariants = tv({
	slots: {
		section: 'flex flex-col gap-3',
		sectionTitle: 'text-sm font-medium text-foreground',
		sectionDescription: 'text-xs text-muted-foreground',
		emptyText: 'text-sm text-muted-foreground italic',
		moderatorRow:
			'flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors',
		moderatorAvatar:
			'flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary',
		moderatorInfo: 'min-w-0 flex-1',
		moderatorName: 'truncate text-sm font-medium text-foreground',
		moderatorDate: 'text-xs text-muted-foreground',
		inviteRow:
			'flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5',
		inviteToken: 'flex-1 truncate font-mono text-xs text-muted-foreground',
		inviteDate: 'text-xs text-muted-foreground',
		selfPromoteWarning:
			'flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800',
		selfPromoteTitle: 'font-medium',
		selfPromoteDescription: 'text-xs',
		disclosureBanner:
			'flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800',
	},
});
