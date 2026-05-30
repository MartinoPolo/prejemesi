<script lang="ts">
	import DarkModeToggle from '$lib/components/DarkModeToggle.svelte';
	import LabeledSelect from '$lib/components/derived/LabeledSelect.svelte';
	import SwitchField from '$lib/components/derived/field/SwitchField.svelte';
	import CheckboxField from '$lib/components/derived/field/CheckboxField.svelte';
	import FormField from '$lib/components/derived/field/FormField.svelte';
	import SectionCard from '$lib/components/derived/SectionCard.svelte';
	import InfoAlert from '$lib/components/derived/alert/InfoAlert.svelte';
	import ErrorAlert from '$lib/components/derived/alert/ErrorAlert.svelte';
	import SuccessAlert from '$lib/components/derived/alert/SuccessAlert.svelte';
	import { useShowcaseForm, type Interests } from '$lib/context/showcase_form.context.svelte';
	import { Button } from '$lib/components/base/button/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import Mail from '@lucide/svelte/icons/mail';
	import Loader from '@lucide/svelte/icons/loader';

	const { framework, role, interests, selectionCount } = useShowcaseForm();

	const frameworks = [
		{ value: 'sveltekit', label: 'SvelteKit' },
		{ value: 'nextjs', label: 'Next.js' },
		{ value: 'nuxt', label: 'Nuxt' },
		{ value: 'remix', label: 'Remix' },
	] as const;

	const roles = [
		{ value: 'admin', label: 'Admin' },
		{ value: 'editor', label: 'Editor' },
		{ value: 'viewer', label: 'Viewer' },
	] as const;

	// Checkbox helpers — update interest immutably
	function toggleInterest(key: keyof Interests) {
		const prev = interests.current;
		interests.current = { ...prev, [key]: !prev[key] };
	}
</script>

<main class="min-h-screen bg-background text-foreground">
	<!-- Header -->
	<header class="border-b border-border">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
			<h1 class="text-xl font-bold tracking-tight">SvelteKit Template</h1>
			<DarkModeToggle />
		</div>
	</header>

	<div class="mx-auto max-w-5xl space-y-12 px-6 py-12">
		<!-- Hero -->
		<section class="space-y-3 text-center">
			<h2 class="text-4xl font-extrabold tracking-tight">Component Showcase</h2>
			<p class="text-muted-foreground text-lg">
				shadcn-svelte components with a green theme, light &amp; dark mode support.
			</p>
			<Badge variant="secondary" class={selectionCount.current > 0 ? '' : 'invisible'}>
				{selectionCount.current} selection{selectionCount.current === 1 ? '' : 's'} made
			</Badge>
		</section>

		<Separator />

		<!-- Buttons -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Buttons</h3>
			<div class="flex flex-wrap items-center gap-3">
				<Button>Default</Button>
				<Button variant="secondary">Secondary</Button>
				<Button variant="outline">Outline</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="link">Link</Button>
				<Button variant="destructive">Destructive</Button>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Button size="sm">Small</Button>
				<Button size="default">Default</Button>
				<Button size="lg">Large</Button>
				<Button size="icon" aria-label="Send email"><Mail size={16} /></Button>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Button disabled>Disabled</Button>
				<Button>
					<Loader class="animate-spin" size={16} />
					Loading...
				</Button>
			</div>
		</section>

		<Separator />

		<!-- Badges -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Badges</h3>
			<div class="flex flex-wrap items-center gap-3">
				<Badge>Default</Badge>
				<Badge variant="secondary">Secondary</Badge>
				<Badge variant="outline">Outline</Badge>
				<Badge variant="destructive">Destructive</Badge>
			</div>
		</section>

		<Separator />

		<!-- Cards & Form Elements -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Cards &amp; Form Elements</h3>
			<div class="grid gap-6 md:grid-cols-2">
				<!-- Input Card -->
				<SectionCard
					title="Text Inputs"
					description="Standard input fields and textarea."
					contentClass="space-y-4"
				>
					<FormField id="name" label="Name" placeholder="Enter your name" />
					<FormField
						id="email"
						label="Email"
						type="email"
						placeholder="you@example.com"
					/>
					<FormField
						id="bio"
						label="Bio"
						multiline
						placeholder="Tell us about yourself…"
					/>
					{#snippet footer()}
						<Button class="w-full">Submit</Button>
					{/snippet}
				</SectionCard>

				<!-- Select & Controls Card -->
				<SectionCard
					title="Select &amp; Controls"
					description="Dropdowns, switches, and checkboxes."
					contentClass="space-y-6"
				>
					<LabeledSelect
						label="Framework"
						options={frameworks}
						value={framework.current}
						onValueChange={(v) => {
							framework.current = v as typeof framework.current;
						}}
						placeholder="Select a framework"
					/>
					<LabeledSelect
						label="Role"
						options={roles}
						value={role.current}
						onValueChange={(v) => {
							role.current = v as typeof role.current;
						}}
						placeholder="Select a role"
					/>
					<Separator />
					<SwitchField id="notifications" label="Enable notifications" />
					<SwitchField id="marketing" label="Marketing emails" />
					<Separator />
					<div class="flex flex-col gap-3">
						<span class="text-sm font-medium">Interests</span>
						<CheckboxField
							id="frontend"
							label="Frontend"
							checked={interests.current.frontend}
							onCheckedChange={() => toggleInterest('frontend')}
						/>
						<CheckboxField
							id="backend"
							label="Backend"
							checked={interests.current.backend}
							onCheckedChange={() => toggleInterest('backend')}
						/>
						<CheckboxField
							id="devops"
							label="DevOps"
							checked={interests.current.devops}
							onCheckedChange={() => toggleInterest('devops')}
						/>
					</div>
				</SectionCard>
			</div>
		</section>

		<Separator />

		<!-- Alerts -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Alerts</h3>
			<div class="space-y-3">
				<InfoAlert>This is an informational alert using the default variant.</InfoAlert>
				<ErrorAlert>Something went wrong. Please try again later.</ErrorAlert>
				<SuccessAlert>Your changes have been saved successfully.</SuccessAlert>
			</div>
		</section>

		<!-- Footer -->
		<Separator />
		<footer class="text-muted-foreground pb-8 text-center text-sm">
			Built with SvelteKit, Tailwind CSS &amp; shadcn-svelte
		</footer>
	</div>
</main>
