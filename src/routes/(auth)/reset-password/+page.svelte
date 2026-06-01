<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthBrandPanel from '$lib/components/blocks/auth/AuthBrandPanel.svelte';
	import AuthBrandFeature from '$lib/components/blocks/auth/AuthBrandFeature.svelte';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import ErrorBanner from '$lib/components/blocks/auth/ErrorBanner.svelte';
	import { authClient } from '$lib/auth_client.js';
	import * as m from '$lib/paraglide/messages.js';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Mail from '@lucide/svelte/icons/mail';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import CircleCheck from '@lucide/svelte/icons/circle-check';

	let token = $derived(page.url.searchParams.get('token'));

	// Request step state
	let email = $state('');
	let emailError = $state('');
	let requestLoading = $state(false);
	let requestError = $state('');
	let requestSuccess = $state(false);

	// Reset step state
	let newPassword = $state('');
	let confirmPassword = $state('');
	let newPasswordError = $state('');
	let confirmPasswordError = $state('');
	let resetLoading = $state(false);
	let resetError = $state('');
	let resetSuccess = $state(false);
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

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

	function handleEmailBlur() {
		if (email) {
			validateEmail();
		}
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

	async function handleRequestSubmit(event: SubmitEvent) {
		event.preventDefault();
		requestError = '';

		if (!validateEmail()) {
			return;
		}

		requestLoading = true;
		try {
			const result = await authClient.requestPasswordReset({
				email: email.trim(),
				redirectTo: window.location.origin + resolve('/reset-password'),
			});

			if (result.error) {
				requestError = m.reset_request_error();
			} else {
				requestSuccess = true;
			}
		} catch {
			requestError = m.error_generic();
		} finally {
			requestLoading = false;
		}
	}

	async function handleResetSubmit(event: SubmitEvent) {
		event.preventDefault();
		resetError = '';

		const passwordValid = validateNewPassword();
		const confirmValid = validateConfirmPassword();
		if (!passwordValid || !confirmValid) {
			return;
		}

		if (token == null || token === '') {
			resetError = m.reset_token_missing();
			return;
		}

		resetLoading = true;
		try {
			const result = await authClient.resetPassword({
				newPassword,
				token,
			});

			if (result.error) {
				resetError = m.reset_set_error();
			} else {
				resetSuccess = true;
			}
		} catch {
			resetError = m.error_generic();
		} finally {
			resetLoading = false;
		}
	}
</script>

<AuthBrandPanel>
	{#snippet tagline()}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html m.auth_tagline_reset()}
	{/snippet}
	{#snippet features()}
		<AuthBrandFeature
			icon={ShieldCheck}
			title={m.auth_feature_secure_title()}
			description={m.auth_feature_secure_description()}
		/>
		<AuthBrandFeature
			icon={KeyRound}
			title={m.auth_feature_strong_pw_title()}
			description={m.auth_feature_strong_pw_description()}
		/>
		<AuthBrandFeature
			icon={Mail}
			title={m.auth_feature_email_verify_title()}
			description={m.auth_feature_email_verify_description()}
		/>
	{/snippet}
</AuthBrandPanel>

{#if token}
	<AuthFormCard title={m.reset_set_title()} subtitle={m.reset_set_subtitle()}>
		{#if resetSuccess}
			<div class="success-banner" role="status">
				<CircleCheck class="success-icon" />
				<div>
					<p class="success-text">{m.reset_success()}</p>
					<a href={resolve('/login')} class="success-link">{m.reset_success_link()}</a>
				</div>
			</div>
		{:else}
			{#if resetError}
				<ErrorBanner message={resetError} />
			{/if}

			<form onsubmit={handleResetSubmit} novalidate>
				<div class="form-stack">
					<div class="form-field">
						<Label for="reset-new-password">{m.reset_new_password_label()}</Label>
						<div class="password-wrapper">
							<Input
								id="reset-new-password"
								type={showPassword ? 'text' : 'password'}
								autocomplete="new-password"
								bind:value={newPassword}
								onblur={handleNewPasswordBlur}
								aria-invalid={newPasswordError ? true : undefined}
								aria-describedby={newPasswordError
									? 'reset-new-password-error'
									: undefined}
								disabled={resetLoading}
								class="{newPasswordError
									? 'border-destructive! ring-destructive/20! ring-3!'
									: ''} pr-11!"
							/>
							<button
								class="password-toggle"
								type="button"
								aria-label={showPassword ? m.hide_password() : m.show_password()}
								onclick={() => (showPassword = !showPassword)}
								tabindex={-1}
							>
								{#if showPassword}
									<EyeOff class="size-4" />
								{:else}
									<Eye class="size-4" />
								{/if}
							</button>
						</div>
						{#if newPasswordError}
							<span class="form-error-text" id="reset-new-password-error"
								>{newPasswordError}</span
							>
						{/if}
					</div>

					<div class="form-field">
						<Label for="reset-confirm-password"
							>{m.reset_confirm_password_label()}</Label
						>
						<div class="password-wrapper">
							<Input
								id="reset-confirm-password"
								type={showConfirmPassword ? 'text' : 'password'}
								autocomplete="new-password"
								bind:value={confirmPassword}
								onblur={handleConfirmPasswordBlur}
								aria-invalid={confirmPasswordError ? true : undefined}
								aria-describedby={confirmPasswordError
									? 'reset-confirm-password-error'
									: undefined}
								disabled={resetLoading}
								class="{confirmPasswordError
									? 'border-destructive! ring-destructive/20! ring-3!'
									: ''} pr-11!"
							/>
							<button
								class="password-toggle"
								type="button"
								aria-label={showConfirmPassword
									? m.hide_password()
									: m.show_password()}
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
								tabindex={-1}
							>
								{#if showConfirmPassword}
									<EyeOff class="size-4" />
								{:else}
									<Eye class="size-4" />
								{/if}
							</button>
						</div>
						{#if confirmPasswordError}
							<span class="form-error-text" id="reset-confirm-password-error"
								>{confirmPasswordError}</span
							>
						{/if}
					</div>
				</div>

				<Button type="submit" class="mt-6 w-full" size="lg" disabled={resetLoading}>
					{#if resetLoading}
						<span class="spinner"></span>
					{/if}
					{m.reset_submit()}
				</Button>
			</form>

			<div class="auth-footer">
				<a href={resolve('/login')}>{m.back_to_login()}</a>
			</div>
		{/if}
	</AuthFormCard>
{:else}
	<AuthFormCard title={m.reset_request_title()} subtitle={m.reset_request_subtitle()}>
		{#if requestSuccess}
			<div class="success-banner" role="status">
				<CircleCheck class="success-icon" />
				<div>
					<p class="success-text">{m.reset_request_success()}</p>
				</div>
			</div>
		{:else}
			{#if requestError}
				<ErrorBanner message={requestError} />
			{/if}

			<form onsubmit={handleRequestSubmit} novalidate>
				<div class="form-stack">
					<div class="form-field">
						<Label for="reset-email">{m.email_label()}</Label>
						<Input
							id="reset-email"
							type="email"
							placeholder={m.email_placeholder()}
							autocomplete="email"
							bind:value={email}
							onblur={handleEmailBlur}
							aria-invalid={emailError ? true : undefined}
							aria-describedby={emailError ? 'reset-email-error' : undefined}
							disabled={requestLoading}
							class={emailError
								? 'border-destructive! ring-destructive/20! ring-3!'
								: ''}
						/>
						{#if emailError}
							<span class="form-error-text" id="reset-email-error">{emailError}</span>
						{/if}
					</div>
				</div>

				<Button type="submit" class="mt-6 w-full" size="lg" disabled={requestLoading}>
					{#if requestLoading}
						<span class="spinner"></span>
					{/if}
					{m.reset_request_submit()}
				</Button>
			</form>
		{/if}

		<div class="auth-footer">
			<a href={resolve('/login')}>{m.back_to_login()}</a>
		</div>
	</AuthFormCard>
{/if}

<style>
	.form-stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.password-wrapper {
		position: relative;
	}

	.password-toggle {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		border-radius: var(--radius-sm);
		transition: color var(--duration-fast);
		line-height: 1;
	}

	.password-toggle:hover {
		color: var(--foreground);
	}

	.form-error-text {
		font-size: var(--text-xs);
		color: var(--destructive);
		display: flex;
		align-items: center;
		gap: 4px;
		line-height: var(--leading-snug);
	}

	.success-banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		background: oklch(from var(--status-success) l c h / 8%);
		border: 1px solid oklch(from var(--status-success) l c h / 28%);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-5);
		font-size: var(--text-sm);
		color: var(--status-success);
		line-height: var(--leading-snug);
	}

	.success-banner :global(.success-icon) {
		flex-shrink: 0;
		width: 16px;
		height: 16px;
		margin-top: 1px;
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

	.auth-footer {
		text-align: center;
		margin-top: var(--space-6);
		font-size: var(--text-sm);
		color: var(--muted-foreground);
		line-height: var(--leading-relaxed);
	}

	.auth-footer :global(a) {
		color: var(--primary);
		text-decoration: none;
		font-weight: var(--weight-semibold);
	}

	.auth-footer :global(a:hover) {
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
