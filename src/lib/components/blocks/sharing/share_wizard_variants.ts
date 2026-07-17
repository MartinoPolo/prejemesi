import { tv } from 'tailwind-variants';

/**
 * Anime-sky share wizard (issue #102 REQ-16): ink-bordered step dots with dashed
 * connectors, sticker preview card, sunny sticky-note warning hero, and the
 * brand-tinted permissions recap.
 */
export const shareWizardVariants = tv({
	slots: {
		progressBar: 'flex items-center gap-0 ps-6 pe-16 pt-5',
		step: 'flex flex-shrink-0 items-center gap-2',
		connector:
			'mx-2 min-w-5 flex-1 border-t-2 border-dashed border-ink-faint transition-colors',
		connectorDone: 'mx-2 min-w-5 flex-1 border-t-2 border-ink transition-colors',
		stepDot:
			'flex size-[26px] flex-shrink-0 items-center justify-center rounded-full border-2 border-ink text-[11px] font-bold transition-all',
		stepDotActive: 'bg-primary text-primary-foreground shadow-sticker-sm',
		stepDotDone: 'bg-primary text-primary-foreground',
		stepDotPending: 'border-ink-faint bg-surface text-ink-soft',
		stepLabel: 'whitespace-nowrap text-[11px] font-semibold text-ink-soft',
		stepLabelActive: 'whitespace-nowrap text-[11px] font-bold text-foreground',
		actions: 'flex gap-2',
		// Step 1
		confirmHero: 'flex flex-col items-center gap-3 px-0 py-5 text-center',
		warnIconWrap:
			'flex size-[72px] -rotate-3 items-center justify-center rounded-2xl border-[2.5px] border-accent-loud-foreground bg-accent-loud text-accent-loud-foreground shadow-sticker',
		confirmTitle: 'font-heading text-xl font-semibold tracking-tight text-foreground',
		confirmBodyText: 'max-w-[380px] text-sm leading-relaxed text-ink-soft',
		previewCard:
			'flex items-center gap-3 rounded-[12px] border-2 border-ink bg-surface px-4 py-3',
		previewThumb:
			'flex size-10 flex-shrink-0 -rotate-3 items-center justify-center rounded-[10px] border-2 border-ink bg-tint text-lg',
		previewName: 'font-heading text-sm font-semibold text-foreground',
		previewMeta: 'mt-0.5 text-xs text-ink-soft',
		previewBadge:
			'flex-shrink-0 rounded-full border-2 border-ink bg-card px-2.5 py-0.5 text-[11px] font-semibold text-foreground',
		// Step 2
		shareHeader: 'pt-2',
		shareTitle: 'font-heading text-lg font-semibold tracking-tight text-foreground',
		shareSub: 'mt-0.5 text-xs text-ink-soft',
		sectionEyebrow: 'mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft',
		copyLinkRow: 'flex items-stretch gap-2',
		linkInputWrap:
			'flex h-11 flex-1 items-center overflow-hidden rounded-[10px] border-2 border-ink bg-surface px-3',
		linkUrlText: 'truncate text-sm text-ink-soft',
		linkUrlDomain: 'font-bold text-foreground',
		copiedLabel:
			'mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-ink bg-[color-mix(in_oklab,var(--status-success)_14%,var(--card))] px-2.5 py-0.5 text-xs font-bold text-status-success',
		socialButtonsList: 'flex flex-col gap-2',
		messagePreview:
			'rounded-[4px] border-2 border-note-ink/40 bg-note px-4 py-3 text-note-ink shadow-sticker-sm',
		messagePreviewLabel: 'mb-1 text-[10px] font-bold uppercase tracking-wider text-note-ink/70',
		messagePreviewText: 'font-heading text-sm text-note-ink',
		// Step 3
		successHero: 'flex flex-col items-center gap-3 px-0 py-4 text-center',
		successIconWrap:
			'flex size-20 rotate-3 items-center justify-center rounded-2xl border-[2.5px] border-ink bg-tint text-primary shadow-sticker',
		successTitle: 'font-heading text-2xl font-semibold tracking-tight text-foreground',
		successSub: 'max-w-[360px] text-sm leading-relaxed text-ink-soft',
		successLinkRow: 'flex w-full min-w-0 items-center justify-center gap-1.5',
		successLinkText: 'min-w-0 truncate text-sm font-bold text-foreground',
		permissionsCard: 'rounded-panel border-[2.5px] border-ink bg-tint px-5 py-4',
		permissionsCardLabel: 'mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft',
		permissionsHeading: 'mb-3 text-sm font-semibold leading-snug text-foreground',
		permissionsList: 'mb-4 flex flex-col gap-2',
		permissionRow: 'flex items-center gap-2.5',
		permissionCheck:
			'flex size-[19px] flex-shrink-0 -rotate-3 items-center justify-center rounded-[6px] border-2 border-ink bg-primary text-primary-foreground',
		permissionText: 'text-sm leading-snug text-foreground',
		permissionsWarning:
			'flex items-start gap-2.5 rounded-[10px] border-2 border-ink bg-card px-3 py-3',
		warnX: 'mt-0.5 flex size-[18px] flex-shrink-0 items-center justify-center rounded-full border-2 border-ink bg-card text-status-danger',
		permissionsWarningText: 'text-xs font-semibold leading-relaxed text-foreground',
	},
});
