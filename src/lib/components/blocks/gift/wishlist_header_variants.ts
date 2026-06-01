import { tv } from 'tailwind-variants';

export const wishlistHeaderVariants = tv({
	slots: {
		root: 'flex flex-col gap-4',
		bannerArea:
			'relative flex flex-col justify-end gap-3 rounded-xl bg-cover bg-center px-6 py-6',
		bannerOverlay: 'absolute inset-0 rounded-xl bg-gradient-to-t from-black/60 to-black/10',
		contentArea: 'relative flex flex-col gap-1',
		ownerName: 'font-heading text-2xl font-bold text-primary',
		ownerNameOnBanner: 'font-heading text-2xl font-bold text-white',
		title: 'font-heading text-3xl font-bold tracking-tight text-foreground',
		titleOnBanner: 'font-heading text-3xl font-bold tracking-tight text-white',
		description: 'max-w-2xl text-base text-muted-foreground',
		descriptionOnBanner: 'max-w-2xl text-base text-white/80',
		metaRow: 'flex flex-wrap items-center gap-3 text-sm text-muted-foreground',
		metaRowOnBanner: 'flex flex-wrap items-center gap-3 text-sm text-white/70',
		actionRow: 'flex items-center gap-2',
		archivedBanner:
			'flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200',
		sharedBanner:
			'flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200',
		draftBanner:
			'flex items-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm text-blue-800 dark:text-blue-200',
		disclosureBanner:
			'flex items-center gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 px-4 py-3 text-sm text-purple-800 dark:text-purple-200',
	},
});
