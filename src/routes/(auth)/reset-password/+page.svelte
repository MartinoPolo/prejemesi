<script lang="ts">
	import { page } from '$app/state';
	import AuthBrandPanel from '$lib/components/blocks/auth/AuthBrandPanel.svelte';
	import AuthBrandFeature from '$lib/components/blocks/auth/AuthBrandFeature.svelte';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import ResetPasswordRequestForm from '$lib/components/blocks/auth/ResetPasswordRequestForm.svelte';
	import ResetPasswordSetForm from '$lib/components/blocks/auth/ResetPasswordSetForm.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import MailIcon from '@lucide/svelte/icons/mail';

	let token = $derived(page.url.searchParams.get('token'));
</script>

<AuthBrandPanel>
	{#snippet tagline()}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html m.auth_tagline_reset()}
	{/snippet}
	{#snippet features()}
		<AuthBrandFeature
			icon={ShieldCheckIcon}
			title={m.auth_feature_secure_title()}
			description={m.auth_feature_secure_description()}
		/>
		<AuthBrandFeature
			icon={KeyRoundIcon}
			title={m.auth_feature_strong_pw_title()}
			description={m.auth_feature_strong_pw_description()}
		/>
		<AuthBrandFeature
			icon={MailIcon}
			title={m.auth_feature_email_verify_title()}
			description={m.auth_feature_email_verify_description()}
		/>
	{/snippet}
</AuthBrandPanel>

{#if token}
	<AuthFormCard title={m.reset_set_title()} subtitle={m.reset_set_subtitle()}>
		<ResetPasswordSetForm {token} />
	</AuthFormCard>
{:else}
	<AuthFormCard title={m.reset_request_title()} subtitle={m.reset_request_subtitle()}>
		<ResetPasswordRequestForm />
	</AuthFormCard>
{/if}
