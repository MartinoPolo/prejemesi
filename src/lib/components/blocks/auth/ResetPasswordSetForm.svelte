<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthFormField from '$lib/components/blocks/auth/AuthFormField.svelte';
	import AuthPasswordInput from '$lib/components/blocks/auth/AuthPasswordInput.svelte';
	import AuthFooterLink from '$lib/components/blocks/auth/AuthFooterLink.svelte';
	import ErrorBanner from '$lib/components/blocks/auth/ErrorBanner.svelte';
	import AuthSuccessBanner from '$lib/components/blocks/auth/AuthSuccessBanner.svelte';
	import { authClient } from '$lib/auth_client.js';
	import { localizeInternalHref } from '$lib/i18n/locale.js';
	import * as m from '$lib/paraglide/messages.js';

	interface ResetPasswordSetFormProps {
		token: string;
	}

	let { token }: ResetPasswordSetFormProps = $props();

	let newPassword = $state('');
	let confirmPassword = $state('');
	let newPasswordError = $state('');
	let confirmPasswordError = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let success = $state(false);

	function validateNewPassword(): boolean {
		if (newPassword.length < 8) {
			newPasswordError = m.settings_password_min_length();
			return false;
		}
		newPasswordError = '';
		return true;
	}

	function validateConfirmPassword(): boolean {
		if (!confirmPassword) {
			confirmPasswordError = m.reset_confirm_required();
			return false;
		}
		if (confirmPassword !== newPassword) {
			confirmPasswordError = m.reset_passwords_mismatch();
			return false;
		}
		confirmPasswordError = '';
		return true;
	}

	function handleNewPasswordBlur() {
		if (newPassword) {
			validateNewPassword();
		}
	}

	function handleConfirmPasswordBlur() {
		if (confirmPassword) {
			validateConfirmPassword();
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';

		const passwordValid = validateNewPassword();
		const confirmValid = validateConfirmPassword();
		if (!passwordValid || !confirmValid) {
			return;
		}

		loading = true;
		try {
			const result = await authClient.resetPassword({ newPassword, token });

			if (result.error) {
				errorMessage = m.reset_set_error();
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
		<p class="success-text">{m.reset_success()}</p>
		<a href={localizeInternalHref(resolve('/login'))} class="success-link"
			>{m.reset_success_link()}</a
		>
	</AuthSuccessBanner>
{:else}
	<ErrorBanner message={errorMessage} />

	<form onsubmit={handleSubmit} novalidate>
		<div class="form-stack">
			<AuthFormField
				fieldId="reset-new-password"
				label={m.reset_new_password_label()}
				errorMessage={newPasswordError}
			>
				<AuthPasswordInput
					fieldId="reset-new-password"
					bind:value={newPassword}
					autocomplete="new-password"
					hasError={!!newPasswordError}
					errorDescribedById={newPasswordError ? 'reset-new-password-error' : undefined}
					disabled={loading}
					onblur={handleNewPasswordBlur}
				/>
			</AuthFormField>

			<AuthFormField
				fieldId="reset-confirm-password"
				label={m.reset_confirm_password_label()}
				errorMessage={confirmPasswordError}
			>
				<AuthPasswordInput
					fieldId="reset-confirm-password"
					bind:value={confirmPassword}
					autocomplete="new-password"
					hasError={!!confirmPasswordError}
					errorDescribedById={confirmPasswordError
						? 'reset-confirm-password-error'
						: undefined}
					disabled={loading}
					onblur={handleConfirmPasswordBlur}
				/>
			</AuthFormField>
		</div>

		<Button type="submit" class="mt-6 w-full" size="lg" disabled={loading}>
			{#if loading}
				<span class="spinner"></span>
			{/if}
			{m.reset_submit()}
		</Button>
	</form>

	<AuthFooterLink
		promptText=""
		linkHref={localizeInternalHref(resolve('/login'))}
		linkText={m.back_to_login()}
	/>
{/if}

<style>
	.form-stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.success-text {
		margin: 0;
	}

	.success-link {
		display: inline-block;
		margin-top: var(--space-2);
		color: var(--primary);
		text-decoration: none;
		font-weight: var(--weight-semibold);
	}

	.success-link:hover {
		text-decoration: underline;
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
