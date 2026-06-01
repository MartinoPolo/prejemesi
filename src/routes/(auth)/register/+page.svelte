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
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import UsersIcon from '@lucide/svelte/icons/users';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let errorMessage = $state('');
	let nameError = $state('');
	let emailError = $state('');
	let passwordError = $state('');

	let callbackUrl = $derived(page.url.searchParams.get('redirect') ?? resolve('/my-lists'));

	let passwordStrength = $derived.by(() => {
		if (!password) {
			return 0;
		}
		let score = 0;
		if (password.length >= 8) {
			score++;
		}
		if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
			score++;
		}
		if (/\d/.test(password)) {
			score++;
		}
		if (/[^a-zA-Z0-9]/.test(password)) {
			score++;
		}
		return score;
	});

	let strengthLabel = $derived.by(() => {
		if (!password) {
			return '';
		}
		if (passwordStrength <= 1) {
			return m.register_strength_weak();
		}
		if (passwordStrength === 2) {
			return m.register_strength_fair();
		}
		if (passwordStrength === 3) {
			return m.register_strength_good();
		}
		return m.register_strength_strong();
	});

	let strengthColor = $derived.by(() => {
		if (passwordStrength <= 1) {
			return 'var(--destructive)';
		}
		if (passwordStrength === 2) {
			return 'var(--status-warning)';
		}
		return 'var(--status-success)';
	});

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
	{#if errorMessage}
		<ErrorBanner message={errorMessage} />
	{/if}

	<form onsubmit={handleSubmit} novalidate>
		<div class="form-stack">
			<div class="form-field">
				<Label for="reg-name">{m.register_name_label()}</Label>
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
					class={nameError ? 'border-destructive! ring-destructive/20! ring-3!' : ''}
				/>
				{#if nameError}
					<span class="form-error-text" id="reg-name-error">{nameError}</span>
				{/if}
			</div>

			<div class="form-field">
				<Label for="reg-email">{m.email_label()}</Label>
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
					class={emailError ? 'border-destructive! ring-destructive/20! ring-3!' : ''}
				/>
				{#if emailError}
					<span class="form-error-text" id="reg-email-error">{emailError}</span>
				{/if}
			</div>

			<div class="form-field">
				<Label for="reg-password">{m.password_label()}</Label>
				<div class="password-wrapper">
					<Input
						id="reg-password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="new-password"
						bind:value={password}
						onblur={handlePasswordBlur}
						aria-invalid={passwordError ? true : undefined}
						aria-describedby={passwordError ? 'reg-password-error' : undefined}
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
							<EyeIcon class="size-4" />
						{/if}
					</button>
				</div>
				{#if password}
					<div
						class="strength-bar"
						role="progressbar"
						aria-label={m.register_strength_label({ label: strengthLabel })}
					>
						{#each [0, 1, 2, 3] as index (index)}
							<div
								class="strength-segment"
								style:background={index < passwordStrength
									? strengthColor
									: undefined}
							></div>
						{/each}
					</div>
					<span class="form-helper-text" style:color={strengthColor}>{strengthLabel}</span
					>
				{/if}
				{#if passwordError}
					<span class="form-error-text" id="reg-password-error">{passwordError}</span>
				{/if}
			</div>
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

	<div class="auth-footer">
		{m.register_has_account()}&ensp;<a href={resolve('/login')}>{m.register_login_link()}</a>
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

	.form-helper-text {
		font-size: var(--text-xs);
	}

	.strength-bar {
		display: flex;
		gap: 4px;
		margin-top: 2px;
	}

	.strength-segment {
		flex: 1;
		height: 3px;
		border-radius: 2px;
		background: var(--border);
		transition: background var(--duration-normal);
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
