/** Marks the document once the root layout has hydrated; returns the unmark cleanup. */
export function markAppHydrated(): () => void {
	document.documentElement.dataset.appHydrated = 'true';
	return () => {
		delete document.documentElement.dataset.appHydrated;
	};
}

/** True for components created after hydration, whose markup the server did not render. */
export function appHydrated(): boolean {
	return (
		typeof document !== 'undefined' && document.documentElement.dataset.appHydrated === 'true'
	);
}
