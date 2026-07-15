<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import EmptyState from '$lib/components/blocks/dashboard/EmptyState.svelte';
</script>

<!-- Friendly „Seznam se připravuje" page shown to non-managers on a DRAFT list (issue #150):
     a never-shared draft or one reverted from active. The same /w/<id> URL revives its full
     view for everyone once a manager (re-)shares the list. -->
<EmptyState
	emoji="🛠️"
	title={m.wishlist_preparing_title()}
	description={m.wishlist_preparing_description()}
/>
