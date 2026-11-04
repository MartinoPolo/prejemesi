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
			'flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-brand-link',
		moderatorInfo: 'min-w-0 flex-1',
		moderatorName: 'truncate text-sm font-medium text-foreground',
		moderatorDate: 'text-xs text-muted-foreground',
		inviteRow:
			'flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5',
		inviteToken: 'flex-1 truncate font-mono text-xs text-muted-foreground',
		inviteDate: 'text-xs text-muted-foreground',
	},
});
