import { tv } from 'tailwind-variants';

export const shareWizardVariants = tv({
	slots: {
		progressBar: 'flex items-center gap-0 px-6 pt-5',
		step: 'flex flex-shrink-0 items-center gap-2',
		connector: 'mx-2 h-[1.5px] min-w-5 flex-1 bg-border transition-colors',
		connectorDone: 'mx-2 h-[1.5px] min-w-5 flex-1 bg-primary transition-colors',
		stepDot:
			'flex size-[26px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all',
		stepDotActive:
			'bg-primary text-primary-foreground shadow-[0_0_0_3px_oklch(52.7%_0.154_150/0.28)]',
		stepDotDone: 'bg-primary text-primary-foreground',
		stepDotPending: 'border-[1.5px] border-border bg-muted text-muted-foreground',
		stepLabel: 'whitespace-nowrap text-[11px] font-medium text-muted-foreground',
		stepLabelActive: 'whitespace-nowrap text-[11px] font-semibold text-foreground',
		actions: 'flex gap-2',
		// Step 1
		confirmHero: 'flex flex-col items-center gap-3 px-0 py-5 text-center',
		warnIconWrap:
			'flex size-[72px] items-center justify-center rounded-2xl bg-[oklch(0.97_0.045_85)] text-[oklch(0.72_0.19_75)]',
		confirmTitle: 'font-heading text-xl font-bold tracking-tight text-foreground',
		confirmBodyText: 'max-w-[380px] text-sm leading-relaxed text-muted-foreground',
		previewCard: 'flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3',
		previewThumb:
			'flex size-10 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[oklch(0.28_0.06_25)] to-[oklch(0.38_0.08_15)] text-lg',
		previewName: 'text-sm font-semibold text-foreground',
		previewMeta: 'mt-0.5 text-xs text-muted-foreground',
		previewBadge:
			'flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary',
		// Step 2
		shareHeader: 'pt-2',
		shareTitle: 'font-heading text-lg font-semibold tracking-tight text-foreground',
		shareSub: 'mt-0.5 text-xs text-muted-foreground',
		sectionEyebrow:
			'mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
		copyLinkRow: 'flex items-stretch gap-2',
		linkInputWrap:
			'flex flex-1 items-center overflow-hidden rounded-md border bg-muted/50 px-3 h-11',
		linkUrlText: 'truncate text-sm text-muted-foreground',
		linkUrlDomain: 'font-semibold text-foreground',
		copiedLabel:
			'mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-[oklch(0.66_0.13_145/0.14)] px-2.5 py-0.5 text-xs font-semibold text-[oklch(0.5_0.13_145)]',
		socialButtonsList: 'flex flex-col gap-2',
		messagePreview: 'rounded-md border border-l-[3px] border-l-primary bg-muted/50 px-4 py-3',
		messagePreviewLabel:
			'mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground',
		messagePreviewText: 'text-sm text-foreground',
		// Step 3
		successHero: 'flex flex-col items-center gap-3 px-0 py-4 text-center',
		successIconWrap:
			'flex size-20 items-center justify-center rounded-2xl bg-[oklch(0.66_0.13_145/0.12)] text-[oklch(0.66_0.13_145)]',
		successTitle: 'font-heading text-2xl font-bold tracking-tight text-foreground',
		successSub: 'max-w-[360px] text-sm leading-relaxed text-muted-foreground',
		permissionsCard: 'rounded-lg border-[1.5px] border-primary/30 bg-primary/5 px-5 py-4',
		permissionsCardLabel: 'mb-3 text-[11px] font-bold uppercase tracking-wider text-primary/80',
		permissionsHeading: 'mb-3 text-sm font-semibold leading-snug text-foreground',
		permissionsList: 'mb-4 flex flex-col gap-2',
		permissionRow: 'flex items-center gap-2',
		permissionCheck:
			'flex size-[18px] flex-shrink-0 items-center justify-center rounded-full bg-[oklch(0.66_0.13_145/0.16)] text-[oklch(0.66_0.13_145)]',
		permissionText: 'text-sm leading-snug text-foreground',
		permissionsWarning:
			'flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-3',
		warnX: 'mt-0.5 flex size-[18px] flex-shrink-0 items-center justify-center rounded-full bg-destructive/14 text-destructive',
		permissionsWarningText: 'text-xs font-medium leading-relaxed text-[oklch(0.4_0.12_27)]',
	},
});
