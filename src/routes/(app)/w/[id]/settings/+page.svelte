<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import { WISHLIST_SETTINGS_TABS } from '$lib/components/blocks/wishlist/wishlist_settings_modal_types.js';
	import { WISHLIST_SETTINGS_QUERY_PARAM } from '$lib/modules/wishlists/wishlist_query_params.js';

	// The standalone settings page became a modal on the wishlist page (UX rework).
	// Old deep links redirect to /w/<id>?settings=<tab>; the legacy #image fragment maps
	// to the image tab. The hash never reaches the server, so this must run client-side.
	onMount(() => {
		const tab =
			page.url.hash === '#image'
				? WISHLIST_SETTINGS_TABS.image
				: WISHLIST_SETTINGS_TABS.details;
		const wishlistHref = localizeInternalHref(
			resolve('/(app)/w/[id]', { id: page.params.id! }),
		);
		void goto(`${wishlistHref}?${WISHLIST_SETTINGS_QUERY_PARAM}=${tab}`, {
			replaceState: true,
		});
	});
</script>
