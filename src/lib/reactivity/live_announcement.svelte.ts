import { tick } from 'svelte';

/** Text for a polite live region. */
export class LiveAnnouncement {
	current = $state('');

	/** Empties the region for one render first, so repeating the same message is announced again. */
	async announce(message: string): Promise<void> {
		this.current = '';
		await tick();
		this.current = message;
	}
}
