<script lang="ts">
	import { setSharingContext } from '$lib/modules/sharing/sharing.context.svelte.js';
	import type { ShareWizardStep } from '$lib/modules/sharing/types.js';
	import ShareWizard from './ShareWizard.svelte';

	interface Props {
		step: ShareWizardStep;
	}

	let { step }: Props = $props();

	const sharing = setSharingContext(
		() => 'abc123',
		() => true,
	);
	sharing.openWizard();
	$effect.pre(() => {
		sharing.goToStep(step);
	});
</script>

<ShareWizard wishlistId="wishlist-1" wishlistTitle="Narozeniny" giftCount={3} />
