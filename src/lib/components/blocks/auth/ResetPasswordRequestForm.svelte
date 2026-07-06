<script lang="ts">
	import { resolve } from '$app/paths';
	import { Input } from '$lib/components/base/input/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthFormField from '$lib/components/blocks/auth/AuthFormField.svelte';
	import AuthFooterLink from '$lib/components/blocks/auth/AuthFooterLink.svelte';
	import ErrorBanner from '$lib/components/blocks/auth/ErrorBanner.svelte';
	import AuthSuccessBanner from '$lib/components/blocks/auth/AuthSuccessBanner.svelte';
	import { authClient } from '$lib/auth_client.js';
	import { getApplicationUrl } from '$lib/config/site.js';
	import * as m from '$lib/paraglide/messages.js';

	let email = $state('');
	let emailError = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let success = $state(false);

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
			const result = await authClient.requestPasswordReset({
				email: email.trim(),
				redirectTo: getApplicationUrl(resolve('/reset-password'), window.location.origin),
			});

			if (result.error) {
				errorMessage = m.reset_request_error();
			} else {
				success = true;
			}
		} catch {
			errorMessage = m.error_generic();
		} finally {
			loading = false;
		}
	}
</script>

{#if success}
	<AuthSuccessBanner>
		<p class="success-text">{m.reset_request_success()}</p>
	</AuthSuccessBanner>
{:else}
	<ErrorBanner message={errorMessage} />

	<form onsubmit={handleSubmit} novalidate>
		<div class="form-stack">
			<AuthFormField fieldId="reset-email" label={m.email_label()} errorMessage={emailError}>
				<Input
					id="reset-email"
					type="email"
					placeholder={m.email_placeholder()}
					autocomplete="email"
					bind:value={email}
					onblur={handleEmailBlur}
					aria-invalid={emailError ? true : undefined}
					aria-describedby={emailError ? 'reset-email-error' : undefined}
					disabled={loading}
					state={emailError ? 'error' : 'default'}
				/>
			</AuthFormField>
		</div>

		<Button type="submit" class="mt-6 w-full" size="lg" disabled={loading}>
			{#if loading}
				<span class="spinner"></span>
			{/if}
			{m.reset_request_submit()}
		</Button>
	</form>
{/if}

<AuthFooterLink promptText="" linkHref={resolve('/login')} linkText={m.back_to_login()} />

<style>
	.form-stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.success-text {
		margin: 0;
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
