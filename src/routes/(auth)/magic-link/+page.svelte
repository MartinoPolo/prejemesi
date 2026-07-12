<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Input } from '$lib/components/base/input/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthBrandPanel from '$lib/components/blocks/auth/AuthBrandPanel.svelte';
	import AuthBrandFeature from '$lib/components/blocks/auth/AuthBrandFeature.svelte';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import ErrorBanner from '$lib/components/blocks/auth/ErrorBanner.svelte';
	import AuthFormField from '$lib/components/blocks/auth/AuthFormField.svelte';
	import { authClient } from '$lib/auth_client.js';
	import { getLocalizedAuthCallback, localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';
	import { escapeHtml } from '$lib/utils/escape_html.js';
	import MailIcon from '@lucide/svelte/icons/mail';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import SendIcon from '@lucide/svelte/icons/send';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import TurnstileWidget from '$lib/components/blocks/security/TurnstileWidget.svelte';

	let email = $state('');
	let loading = $state(false);
	let sent = $state(false);
	let sentEmail = $state('');
	let errorMessage = $state('');
	let emailError = $state('');
	let turnstileToken = $state<string | null>(null);
	let turnstileResetSignal = $state(0);

	let callbackUrl = $derived(
		getLocalizedAuthCallback(page.url.searchParams.get('redirect'), resolve('/my-lists')),
	);

	function validateEmail(): boolean {
		if (!email.trim()) {
			emailError = m.enter_email();
			return false;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			emailError = m.enter_valid_email();
			return false;
		}
		emailError = '';
		return true;
	}

	function handleEmailBlur() {
		if (email) {
			validateEmail();
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';

		if (!validateEmail()) {
			return;
		}

		loading = true;
		try {
			const result = await authClient.signIn.magicLink(
				{
					email: email.trim(),
					callbackURL: callbackUrl,
				},
				{ headers: { 'x-captcha-response': turnstileToken ?? '' } },
			);

			if (result.error) {
				errorMessage = m.magic_error();
			} else {
				sentEmail = email.trim();
				sent = true;
			}
		} catch {
			errorMessage = m.error_generic();
		} finally {
			loading = false;
			turnstileToken = null;
			turnstileResetSignal += 1;
		}
	}

	function handleReset() {
		sent = false;
		sentEmail = '';
		email = '';
		errorMessage = '';
	}
</script>

<svelte:head>
	<title>{m.magic_title()} – Přejeme si</title>
	<meta name="description" content={m.magic_subtitle()} />
</svelte:head>

<AuthBrandPanel>
	{#snippet tagline()}
		{#if sent}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html m.auth_tagline_magic_sent()}
		{:else}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html m.auth_tagline_magic_default()}
		{/if}
	{/snippet}
	{#snippet features()}
		<AuthBrandFeature
			icon={MailIcon}
			title={m.auth_feature_no_password_title()}
			description={m.auth_feature_no_password_description()}
		/>
		<AuthBrandFeature
			icon={ClockIcon}
			title={m.auth_feature_valid_15_title()}
			description={m.auth_feature_valid_15_description()}
		/>
	{/snippet}
</AuthBrandPanel>

{#if sent}
	<AuthFormCard title="" subtitle="">
		<div class="success-state" role="status" aria-live="polite">
			<div class="success-icon-wrap" aria-hidden="true">
				<MailIcon class="size-9" />
			</div>
			<h2 class="success-title">{m.magic_sent_title()}</h2>
			<p class="success-body">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html m.magic_sent_body({ email: escapeHtml(sentEmail) })}
			</p>
			<p class="success-body mt-hint">
				{m.magic_sent_check()}<br />
				{m.magic_sent_spam()}
			</p>
			<a
				href={localizeInternalHref(resolve('/login'))}
				class="success-back"
				onclick={handleReset}
			>
				<ChevronLeftIcon class="size-3.5" />
				{m.back_to_login()}
			</a>
		</div>
	</AuthFormCard>
{:else}
	<AuthFormCard title={m.magic_title()} subtitle={m.magic_subtitle()}>
		{#if errorMessage}
			<ErrorBanner message={errorMessage} />
		{/if}

		<form onsubmit={handleSubmit} novalidate>
			<div class="form-stack">
				<AuthFormField
					fieldId="magic-email"
					label={m.email_label()}
					errorMessage={emailError}
				>
					<Input
						id="magic-email"
						type="email"
						placeholder={m.email_placeholder()}
						autocomplete="email"
						bind:value={email}
						onblur={handleEmailBlur}
						state={emailError ? 'error' : 'default'}
						aria-invalid={emailError ? true : undefined}
						aria-describedby={emailError ? 'magic-email-error' : undefined}
						disabled={loading}
					/>
				</AuthFormField>
			</div>

			{#key turnstileResetSignal}
				<TurnstileWidget bind:token={turnstileToken} />
			{/key}

			<Button
				type="submit"
				class="mt-6 w-full"
				size="lg"
				disabled={loading || turnstileToken === null}
			>
				{#if loading}
					<span class="spinner"></span>
				{:else}
					<SendIcon data-icon="inline-start" />
				{/if}
				{m.magic_submit()}
			</Button>
		</form>

		<div class="auth-footer">
			<a href={localizeInternalHref(resolve('/login'))}>
				<ChevronLeftIcon class="inline size-3.5 align-[-2px]" />
				{m.back_to_login()}
			</a>
		</div>
	</AuthFormCard>
{/if}

<style>
	.form-stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.auth-footer {
		text-align: center;
		margin-top: var(--space-6);
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		line-height: var(--leading-relaxed);
	}

	.auth-footer :global(a) {
		color: var(--muted-foreground);
		text-decoration: none;
		transition: color var(--duration-fast);
	}

	.auth-footer :global(a:hover) {
		color: var(--primary);
	}

	/* Success state */
	.success-state {
		text-align: center;
		padding: var(--space-4) 0;
	}

	.success-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		background: oklch(from var(--status-success) l c h / 12%);
		border-radius: 9999px;
		margin-bottom: var(--space-5);
		color: var(--status-success);
	}

	.success-title {
		font-family: var(--font-heading);
		font-size: var(--text-xl);
		font-weight: var(--weight-semibold);
		color: var(--foreground);
		margin-bottom: var(--space-2);
	}

	.success-body {
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		line-height: var(--leading-relaxed);
	}

	.mt-hint {
		margin-top: var(--space-3);
	}

	.success-back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: var(--space-6);
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		text-decoration: none;
		transition: color var(--duration-fast);
	}

	.success-back:hover {
		color: var(--primary);
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid oklch(from var(--primary-foreground) l c h / 35%);
		border-top-color: var(--primary-foreground);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
