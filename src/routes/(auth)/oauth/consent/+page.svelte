<script lang="ts">
	import type { PageProps } from './$types';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthBrandPanel from '$lib/components/blocks/auth/AuthBrandPanel.svelte';
	import AuthBrandFeature from '$lib/components/blocks/auth/AuthBrandFeature.svelte';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import OauthConsentForm from '$lib/components/blocks/access-tokens/OauthConsentForm.svelte';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import UnplugIcon from '@lucide/svelte/icons/unplug';

	let { data, form }: PageProps = $props();

	const notice = $derived.by(() => {
		if (form?.error !== undefined) {
			return { title: m.oauth_consent_page_title(), description: m.oauth_consent_failed() };
		}
		if (data.state === 'demo') {
			return {
				title: m.oauth_consent_demo_title(),
				description: m.oauth_consent_demo_description(),
			};
		}
		if (data.state === 'invalid') {
			return {
				title: m.oauth_consent_invalid_title(),
				description: m.oauth_consent_invalid_description(),
			};
		}
		return null;
	});
</script>

<svelte:head>
	<title>{m.oauth_consent_page_title()} – Přejeme si</title>
</svelte:head>

<AuthBrandPanel>
	{#snippet tagline()}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html m.oauth_consent_tagline()}
	{/snippet}
	{#snippet features()}
		<AuthBrandFeature
			icon={ShieldCheckIcon}
			title={m.oauth_consent_feature_scopes_title()}
			description={m.oauth_consent_feature_scopes_description()}
		/>
		<AuthBrandFeature
			icon={ListChecksIcon}
			title={m.oauth_consent_feature_review_title()}
			description={m.oauth_consent_feature_review_description()}
		/>
		<AuthBrandFeature
			icon={UnplugIcon}
			title={m.oauth_consent_feature_revoke_title()}
			description={m.oauth_consent_feature_revoke_description()}
		/>
	{/snippet}
</AuthBrandPanel>

{#if notice !== null}
	<AuthFormCard title={notice.title} subtitle={notice.description}>
		<Button href={localizeInternalHref(resolve('/home'))} intent="secondary" size="lg">
			{m.oauth_consent_home()}
		</Button>
	</AuthFormCard>
{:else if data.state === 'ready'}
	<AuthFormCard
		title={m.oauth_consent_title({ name: data.consent.client.name })}
		subtitle={m.oauth_consent_subtitle()}
	>
		<OauthConsentForm
			consent={data.consent}
			oauthQuery={data.oauthQuery}
			accountEmail={data.account.email}
		/>
	</AuthFormCard>
{/if}
