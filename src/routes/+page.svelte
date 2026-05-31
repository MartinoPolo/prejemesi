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
	import { HelpText } from '$lib/components/base/help-text/index.js';
	import { Tabs, Tab } from '$lib/components/base/tabs/index.js';
	import { Toggle } from '$lib/components/base/toggle/index.js';
	import * as ToggleGroup from '$lib/components/base/toggle-group/index.js';
	import * as Accordion from '$lib/components/base/accordion/index.js';
	import * as Collapsible from '$lib/components/base/collapsible/index.js';
	import * as Popover from '$lib/components/base/popover/index.js';
	import { Kbd, KbdGroup } from '$lib/components/base/kbd/index.js';
	import { Progress } from '$lib/components/base/progress/index.js';
	import { RadioGroup, RadioGroupItem } from '$lib/components/base/radio-group/index.js';
	import { Toast } from '$lib/components/base/toast/index.js';
	import { SimpleTooltip } from '$lib/components/base/tooltip/index.js';
	import * as InputGroup from '$lib/components/base/input-group/index.js';
	import { SearchField } from '$lib/components/base/search-field/index.js';
	import { Calendar } from '$lib/components/base/calendar/index.js';
	import Mail from '@lucide/svelte/icons/mail';
	import Loader from '@lucide/svelte/icons/loader';
	import CommandIcon from '@lucide/svelte/icons/command';
	import CheckIcon from '@lucide/svelte/icons/check';
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
	import AlignCenterIcon from '@lucide/svelte/icons/align-center';
	import AlignRightIcon from '@lucide/svelte/icons/align-right';
	import AtSignIcon from '@lucide/svelte/icons/at-sign';
	import InfoIcon from '@lucide/svelte/icons/info';

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

	// Tabs
	let activeTab = $state('overview');

	// Toggle
	let togglePressed = $state(false);

	// ToggleGroup
	let alignValue = $state('left');

	// RadioGroup
	let radioValue = $state('standard');

	// SearchField
	let searchQuery = $state('');
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
			<Badge tone="neutral" class={selectionCount.current > 0 ? '' : 'invisible'}>
				{selectionCount.current} selection{selectionCount.current === 1 ? '' : 's'} made
			</Badge>
		</section>

		<Separator />

		<!-- Buttons -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Buttons</h3>
			<div class="flex flex-wrap items-center gap-3">
				<Button>Default</Button>
				<Button intent="secondary">Secondary</Button>
				<Button intent="outline">Outline</Button>
				<Button intent="ghost">Ghost</Button>
				<Button intent="link">Link</Button>
				<Button intent="danger">Destructive</Button>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Button size="sm">Small</Button>
				<Button size="md">Default</Button>
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
				<Badge tone="neutral" badgeStyle="subtle">Subtle</Badge>
				<Badge tone="neutral" badgeStyle="outlined">Outlined</Badge>
				<Badge tone="danger">Danger</Badge>
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

		<!-- HelpText -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">HelpText</h3>
			<div class="flex flex-col gap-2">
				<HelpText state="default">This field is required.</HelpText>
				<HelpText state="error">Email address is invalid.</HelpText>
				<HelpText state="success">Username is available.</HelpText>
			</div>
		</section>

		<Separator />

		<!-- Tabs -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Tabs</h3>
			<Tabs>
				<Tab active={activeTab === 'overview'} onclick={() => (activeTab = 'overview')}>
					Overview
				</Tab>
				<Tab active={activeTab === 'activity'} onclick={() => (activeTab = 'activity')}>
					Activity
				</Tab>
				<Tab active={activeTab === 'settings'} onclick={() => (activeTab = 'settings')}>
					Settings
				</Tab>
			</Tabs>
			<p class="text-muted-foreground text-sm">Active tab: {activeTab}</p>
		</section>

		<Separator />

		<!-- Toggle -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Toggle</h3>
			<Toggle pressed={togglePressed} onPressedChange={(v) => (togglePressed = v)}>
				{togglePressed ? 'On' : 'Off'}
			</Toggle>
		</section>

		<Separator />

		<!-- ToggleGroup -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">ToggleGroup</h3>
			<ToggleGroup.Root
				type="single"
				value={alignValue}
				onValueChange={(v) => (alignValue = v ?? 'left')}
			>
				<ToggleGroup.Item value="left" aria-label="Align left">
					<AlignLeftIcon data-icon="inline-start" />
					Left
				</ToggleGroup.Item>
				<ToggleGroup.Item value="center" aria-label="Align center">
					<AlignCenterIcon data-icon="inline-start" />
					Center
				</ToggleGroup.Item>
				<ToggleGroup.Item value="right" aria-label="Align right">
					<AlignRightIcon data-icon="inline-start" />
					Right
				</ToggleGroup.Item>
			</ToggleGroup.Root>
		</section>

		<Separator />

		<!-- Accordion -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Accordion</h3>
			<div class="w-96">
				<Accordion.Root type="single" value="item-1">
					<Accordion.Item value="item-1">
						<Accordion.Trigger>What is SvelteKit?</Accordion.Trigger>
						<Accordion.Content>
							SvelteKit is a framework for building web applications with Svelte.
						</Accordion.Content>
					</Accordion.Item>
					<Accordion.Item value="item-2">
						<Accordion.Trigger>What is Tailwind CSS?</Accordion.Trigger>
						<Accordion.Content>
							Tailwind CSS is a utility-first CSS framework for rapid UI development.
						</Accordion.Content>
					</Accordion.Item>
					<Accordion.Item value="item-3">
						<Accordion.Trigger>What is Drizzle ORM?</Accordion.Trigger>
						<Accordion.Content>
							Drizzle ORM is a TypeScript ORM for SQL databases with a focus on type
							safety.
						</Accordion.Content>
					</Accordion.Item>
				</Accordion.Root>
			</div>
		</section>

		<Separator />

		<!-- Collapsible -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Collapsible</h3>
			<div class="w-80">
				<Collapsible.Root>
					<Collapsible.Trigger
						class="flex w-full items-center justify-between rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
					>
						Show details
					</Collapsible.Trigger>
					<Collapsible.Content>
						<div class="px-4 py-2 text-sm text-muted-foreground">
							This content is revealed when the collapsible is opened.
						</div>
					</Collapsible.Content>
				</Collapsible.Root>
			</div>
		</section>

		<Separator />

		<!-- Popover -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Popover</h3>
			<Popover.Root>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button intent="secondary" {...props}>
							<InfoIcon data-icon="inline-start" />
							More options
						</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-48">
					<Popover.Label>Actions</Popover.Label>
					<Popover.Item>Edit</Popover.Item>
					<Popover.Item>Duplicate</Popover.Item>
					<Popover.Divider />
					<Popover.Item>Delete</Popover.Item>
				</Popover.Content>
			</Popover.Root>
		</section>

		<Separator />

		<!-- Kbd -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Kbd</h3>
			<div class="flex flex-col gap-3">
				<div
					class="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 w-72"
				>
					<span class="text-sm text-muted-foreground">Open command palette</span>
					<KbdGroup>
						<Kbd format="lucide"><CommandIcon /></Kbd>
						<Kbd>K</Kbd>
					</KbdGroup>
				</div>
				<div
					class="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 w-72"
				>
					<span class="text-sm text-muted-foreground">Save file</span>
					<KbdGroup>
						<Kbd>Ctrl</Kbd>
						<Kbd>S</Kbd>
					</KbdGroup>
				</div>
				<div
					class="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 w-72"
				>
					<span class="text-sm text-muted-foreground">Dismiss</span>
					<Kbd>Esc</Kbd>
				</div>
			</div>
		</section>

		<Separator />

		<!-- Progress -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Progress</h3>
			<div class="w-80 space-y-3">
				<Progress value={30} max={100} />
				<Progress value={65} max={100} />
				<Progress value={100} max={100} />
			</div>
		</section>

		<Separator />

		<!-- RadioGroup -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">RadioGroup</h3>
			<RadioGroup bind:value={radioValue}>
				<label class="flex items-center gap-2 cursor-pointer">
					<RadioGroupItem value="standard" />
					<span class="text-sm">Standard</span>
				</label>
				<label class="flex items-center gap-2 cursor-pointer">
					<RadioGroupItem value="pro" />
					<span class="text-sm">Pro</span>
				</label>
				<label class="flex items-center gap-2 cursor-pointer">
					<RadioGroupItem value="enterprise" />
					<span class="text-sm">Enterprise</span>
				</label>
			</RadioGroup>
		</section>

		<Separator />

		<!-- Toast -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Toast</h3>
			<div class="max-w-sm">
				<Toast
					tone="success"
					title="Changes saved"
					body="Your profile has been updated successfully."
				>
					{#snippet icon()}<CheckIcon class="size-3.5" />{/snippet}
				</Toast>
			</div>
		</section>

		<Separator />

		<!-- Tooltip -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Tooltip</h3>
			<SimpleTooltip text="Send an email notification">
				{#snippet asChild(props)}
					<Button intent="outline" {...props}>
						<Mail data-icon="inline-start" />
						Send email
					</Button>
				{/snippet}
			</SimpleTooltip>
		</section>

		<Separator />

		<!-- InputGroup -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">InputGroup</h3>
			<div class="w-72">
				<InputGroup.Root>
					<InputGroup.Addon align="inline-start">
						<AtSignIcon />
					</InputGroup.Addon>
					<InputGroup.Input placeholder="username" />
				</InputGroup.Root>
			</div>
		</section>

		<Separator />

		<!-- SearchField -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">SearchField</h3>
			<div class="w-72">
				<SearchField bind:value={searchQuery} placeholder="Search components…" />
			</div>
		</section>

		<Separator />

		<!-- Calendar -->
		<section class="space-y-4">
			<h3 class="text-2xl font-semibold tracking-tight">Calendar</h3>
			<Calendar type="single" />
		</section>

		<!-- Footer -->
		<Separator />
		<footer class="text-muted-foreground pb-8 text-center text-sm">
			Built with SvelteKit, Tailwind CSS &amp; shadcn-svelte
		</footer>
	</div>
</main>
