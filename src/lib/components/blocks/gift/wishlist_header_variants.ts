import { tv } from 'tailwind-variants';

export const wishlistHeaderVariants = tv({
	slots: {
		root: 'flex flex-col gap-4',
		bannerArea: 'group relative flex flex-col justify-end gap-3 rounded-xl px-6 py-6',
		editImageButton:
			'absolute right-4 top-4 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
		bannerOverlay: 'absolute inset-0 rounded-xl bg-gradient-to-t from-black/60 to-black/10',
		contentArea: 'relative flex flex-col gap-1',
		ownerNameOnBanner: 'font-heading text-2xl font-bold text-white',
		/** Lighter „Pro" prefix that precedes the bold recipient name on for-someone lists. */
		recipientForPrefix: 'font-heading text-2xl font-normal text-white/85',
		/** Small muted „Spravuje {name}" / „Spravují {names}" line on for-someone lists. */
		managedByLine: 'text-sm text-white/75',
		titleOnBanner: 'font-heading text-3xl font-bold tracking-tight text-white',
		descriptionOnBanner: 'max-w-2xl text-base text-white/80',
		metaRowOnBanner: 'flex flex-wrap items-center gap-3 text-sm text-white/70',
		actionRow: 'flex items-center gap-2',
		archivedBanner:
			'flex items-center gap-2 rounded-lg border border-[color-mix(in_oklch,var(--status-warning)_30%,transparent)] bg-[color-mix(in_oklch,var(--status-warning)_12%,transparent)] px-4 py-3 text-sm text-[color-mix(in_oklch,var(--status-warning)_70%,var(--foreground))]',
		sharedBanner:
			'flex items-center gap-2 rounded-lg border border-[color-mix(in_oklch,var(--status-warning)_30%,transparent)] bg-[color-mix(in_oklch,var(--status-warning)_12%,transparent)] px-4 py-3 text-sm text-[color-mix(in_oklch,var(--status-warning)_70%,var(--foreground))]',
		draftBanner:
			'flex items-center gap-2 rounded-lg border border-[color-mix(in_oklch,var(--status-info)_30%,transparent)] bg-[color-mix(in_oklch,var(--status-info)_12%,transparent)] px-4 py-3 text-sm text-status-info',
		disclosureBanner:
			'flex items-center gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 px-4 py-3 text-sm text-purple-800 dark:text-purple-200',
	},
});
