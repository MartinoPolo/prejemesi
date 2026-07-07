<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AuthBrandPanel from '$lib/components/blocks/auth/AuthBrandPanel.svelte';
	import AuthBrandFeature from '$lib/components/blocks/auth/AuthBrandFeature.svelte';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import RegisterForm from '$lib/components/blocks/auth/RegisterForm.svelte';
	import { getLocalizedAuthCallback } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import UsersIcon from '@lucide/svelte/icons/users';

	let callbackUrl = $derived(
		getLocalizedAuthCallback(page.url.searchParams.get('redirect'), resolve('/my-lists')),
	);
</script>

<svelte:head>
	<title>{m.register_title()} – Přejeme si</title>
	<meta name="description" content={m.register_subtitle()} />
</svelte:head>

<AuthBrandPanel>
	{#snippet tagline()}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html m.auth_tagline_register()}
	{/snippet}
	{#snippet features()}
		<AuthBrandFeature
			icon={CircleCheckIcon}
			title={m.auth_feature_free_title()}
			description={m.auth_feature_free_description()}
		/>
		<AuthBrandFeature
			icon={ClockIcon}
			title={m.auth_feature_quick_title()}
			description={m.auth_feature_quick_description()}
		/>
		<AuthBrandFeature
			icon={UsersIcon}
			title={m.auth_feature_family_title()}
			description={m.auth_feature_family_description()}
		/>
	{/snippet}
</AuthBrandPanel>

<AuthFormCard title={m.register_title()} subtitle={m.register_subtitle()}>
	<RegisterForm {callbackUrl} />
</AuthFormCard>
