<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Input } from '$lib/components/base/input/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import AuthBrandPanel from '$lib/components/blocks/auth/AuthBrandPanel.svelte';
	import AuthBrandFeature from '$lib/components/blocks/auth/AuthBrandFeature.svelte';
	import AuthFormCard from '$lib/components/blocks/auth/AuthFormCard.svelte';
	import AuthDivider from '$lib/components/blocks/auth/AuthDivider.svelte';
	import SocialLoginButtons from '$lib/components/blocks/auth/SocialLoginButtons.svelte';
	import ErrorBanner from '$lib/components/blocks/auth/ErrorBanner.svelte';
	import { authClient } from '$lib/auth_client.js';
	import * as m from '$lib/paraglide/messages.js';
	import List from '@lucide/svelte/icons/list';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import LinkIcon from '@lucide/svelte/icons/link';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let errorMessage = $state('');
	let emailError = $state('');
	let passwordError = $state('');

	let callbackUrl = $derived(page.url.searchParams.get('redirect') ?? resolve('/my-lists'));

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
		if (!password) {
			passwordError = m.enter_password();
			return false;
		}
		passwordError = '';
		return true;
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

		const emailValid = validateEmail();
		const passwordValid = validatePassword();
		if (!emailValid || !passwordValid) {
			return;
		}

		loading = true;
		try {
			const result = await authClient.signIn.email({
				email,
				password,
				callbackURL: callbackUrl,
			});

			if (result.error) {
				errorMessage = m.login_error_credentials();
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

<AuthBrandPanel>
	{#snippet tagline()}
		{@html m.auth_tagline_login()}
	{/snippet}
	{#snippet features()}
		<AuthBrandFeature
			icon={List}
			title={m.auth_feature_wishlists_title()}
			description={m.auth_feature_wishlists_description()}
		/>
		<AuthBrandFeature
			icon={EyeOff}
			title={m.auth_feature_hidden_title()}
			description={m.auth_feature_hidden_description()}
		/>
		<AuthBrandFeature
			icon={LinkIcon}
			title={m.auth_feature_sharing_title()}
			description={m.auth_feature_sharing_description()}
		/>
	{/snippet}
</AuthBrandPanel>

<AuthFormCard title={m.login_title()} subtitle={m.login_subtitle()}>
	{#if errorMessage}
		<ErrorBanner message={errorMessage} />
	{/if}

	<form onsubmit={handleSubmit} novalidate>
		<div class="form-stack">
			<div class="form-field">
				<Label for="login-email">{m.email_label()}</Label>
				<Input
					id="login-email"
					type="email"
					placeholder={m.email_placeholder()}
					autocomplete="email"
					bind:value={email}
					onblur={handleEmailBlur}
					aria-invalid={emailError ? true : undefined}
					aria-describedby={emailError ? 'login-email-error' : undefined}
					disabled={loading}
					class={emailError ? 'border-destructive! ring-destructive/20! ring-3!' : ''}
				/>
				{#if emailError}
					<span class="form-error-text" id="login-email-error">{emailError}</span>
				{/if}
			</div>

			<div class="form-field">
				<Label for="login-password">{m.password_label()}</Label>
				<div class="password-wrapper">
					<Input
						id="login-password"
						type={showPassword ? 'text' : 'password'}
						placeholder="........"
						autocomplete="current-password"
						bind:value={password}
						onblur={handlePasswordBlur}
						aria-invalid={passwordError ? true : undefined}
						aria-describedby={passwordError ? 'login-password-error' : undefined}
						disabled={loading}
						class="{passwordError
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
							<EyeOffIcon class="size-4" />
						{:else}
							<Eye class="size-4" />
						{/if}
					</button>
				</div>
				{#if passwordError}
					<span class="form-error-text" id="login-password-error">{passwordError}</span>
				{/if}
				<a href={resolve('/reset-password')} class="forgot-link"
					>{m.login_forgot_password()}</a
				>
			</div>
		</div>

		<Button type="submit" class="mt-6 w-full" size="lg" disabled={loading}>
			{#if loading}
				<span class="spinner"></span>
			{/if}
			{m.login_submit()}
		</Button>
	</form>

	<AuthDivider />

	<SocialLoginButtons
		googleLabel={m.login_google()}
		{callbackUrl}
		showMagicLink={true}
		{loading}
	/>

	<div class="auth-footer">
		{m.login_no_account()}&ensp;<a href={resolve('/register')}>{m.login_signup_link()}</a>
	</div>
</AuthFormCard>

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

	.forgot-link {
		font-size: var(--text-xs);
		color: var(--muted-foreground);
		text-decoration: none;
		text-align: right;
		display: block;
		margin-top: 2px;
		transition: color var(--duration-fast);
	}

	.forgot-link:hover {
		color: var(--primary);
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
