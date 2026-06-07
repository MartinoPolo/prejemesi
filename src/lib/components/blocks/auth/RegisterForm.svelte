<script lang="ts">
	import { goto } from '$app/navigation';
	import { Input } from '$lib/components/base/input/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthFormField from '$lib/components/blocks/auth/AuthFormField.svelte';
	import AuthPasswordInput from '$lib/components/blocks/auth/AuthPasswordInput.svelte';
	import RegisterPasswordStrengthBar from '$lib/components/blocks/auth/RegisterPasswordStrengthBar.svelte';
	import AuthDivider from '$lib/components/blocks/auth/AuthDivider.svelte';
	import SocialLoginButtons from '$lib/components/blocks/auth/SocialLoginButtons.svelte';
	import ErrorBanner from '$lib/components/blocks/auth/ErrorBanner.svelte';
	import AuthFooterLink from '$lib/components/blocks/auth/AuthFooterLink.svelte';
	import { authClient } from '$lib/auth_client.js';
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';

	interface RegisterFormProps {
		callbackUrl: string;
	}

	let { callbackUrl }: RegisterFormProps = $props();

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let nameError = $state('');
	let emailError = $state('');
	let passwordError = $state('');

	function validateName(): boolean {
		if (name.trim().length < 2) {
			nameError = m.register_name_error();
			return false;
		}
		nameError = '';
		return true;
	}

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

	function validatePassword(): boolean {
		if (password.length < 8) {
			passwordError = m.register_password_min();
			return false;
		}
		passwordError = '';
		return true;
	}

	function handleNameBlur() {
		if (name) {
			validateName();
		}
	}

	function handleEmailBlur() {
		if (email) {
			validateEmail();
		}
	}

	function handlePasswordBlur() {
		if (password) {
			validatePassword();
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';

		const nameValid = validateName();
		const emailValid = validateEmail();
		const passwordValid = validatePassword();
		if (!nameValid || !emailValid || !passwordValid) {
			return;
		}

		loading = true;
		try {
			const result = await authClient.signUp.email({
				name: name.trim(),
				email: email.trim(),
				password,
				callbackURL: callbackUrl,
			});

			if (result.error) {
				if (
					result.error.message?.includes('already exists') === true ||
					result.error.message?.includes('already') === true
				) {
					errorMessage = m.register_error_exists();
				} else {
					errorMessage = m.register_error_failed();
				}
			} else {
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(callbackUrl);
			}
		} catch {
			errorMessage = m.error_generic();
		} finally {
			loading = false;
		}
	}
</script>

{#if errorMessage}
	<ErrorBanner message={errorMessage} />
{/if}

<form onsubmit={handleSubmit} novalidate>
	<div class="form-stack">
		<AuthFormField fieldId="reg-name" label={m.register_name_label()} errorMessage={nameError}>
			<Input
				id="reg-name"
				type="text"
				placeholder={m.register_name_placeholder()}
				autocomplete="name"
				bind:value={name}
				onblur={handleNameBlur}
				aria-invalid={nameError ? true : undefined}
				aria-describedby={nameError ? 'reg-name-error' : undefined}
				disabled={loading}
				state={nameError ? 'error' : 'default'}
			/>
		</AuthFormField>

		<AuthFormField fieldId="reg-email" label={m.email_label()} errorMessage={emailError}>
			<Input
				id="reg-email"
				type="email"
				placeholder={m.email_placeholder()}
				autocomplete="email"
				bind:value={email}
				onblur={handleEmailBlur}
				aria-invalid={emailError ? true : undefined}
				aria-describedby={emailError ? 'reg-email-error' : undefined}
				disabled={loading}
				state={emailError ? 'error' : 'default'}
			/>
		</AuthFormField>

		<AuthFormField
			fieldId="reg-password"
			label={m.password_label()}
			errorMessage={passwordError}
		>
			<AuthPasswordInput
				fieldId="reg-password"
				bind:value={password}
				autocomplete="new-password"
				hasError={!!passwordError}
				errorDescribedById={passwordError ? 'reg-password-error' : undefined}
				disabled={loading}
				onblur={handlePasswordBlur}
			/>
			<RegisterPasswordStrengthBar {password} />
		</AuthFormField>
	</div>

	<Button type="submit" class="mt-6 w-full" size="lg" disabled={loading}>
		{#if loading}
			<span class="spinner"></span>
		{/if}
		{m.register_submit()}
	</Button>
</form>

<AuthDivider />

<SocialLoginButtons googleLabel={m.register_google()} {callbackUrl} {loading} />

<AuthFooterLink
	promptText={m.register_has_account()}
	linkHref={resolve('/login')}
	linkText={m.register_login_link()}
/>

<style>
	.form-stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
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
