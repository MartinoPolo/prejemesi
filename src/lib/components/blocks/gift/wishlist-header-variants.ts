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
			'flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800',
		sharedBanner:
			'flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800',
		draftBanner:
			'flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800',
		disclosureBanner:
			'flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800',
	},
});
