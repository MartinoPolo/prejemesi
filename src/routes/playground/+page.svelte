<script lang="ts">
	import DarkModeToggle from '$lib/components/DarkModeToggle.svelte';
	import {
		StatusBadge,
		STATUS_BADGE_STATUSES,
	} from '$lib/components/derived/status-badge/index.js';
	import { Button } from '$lib/components/base/button/index.js';
	import { Badge } from '$lib/components/base/badge/index.js';
	import { Separator } from '$lib/components/base/separator/index.js';
	import { Input } from '$lib/components/base/input/index.js';
	import { Textarea } from '$lib/components/base/textarea/index.js';
	import { Label } from '$lib/components/base/label/index.js';
	import { Checkbox } from '$lib/components/base/checkbox/index.js';
	import { Switch } from '$lib/components/base/switch/index.js';
	import * as Card from '$lib/components/base/card/index.js';
	import * as Alert from '$lib/components/base/alert/index.js';
	import Mail from '@lucide/svelte/icons/mail';
	import Loader from '@lucide/svelte/icons/loader';
	import Info from '@lucide/svelte/icons/info';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
</script>

<main class="min-h-screen bg-background text-foreground">
	<header class="border-b border-border">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
			<h1 class="text-xl font-bold tracking-tight">Component Playground</h1>
			<DarkModeToggle />
		</div>
	</header>

	<div class="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-12">
		<section class="flex flex-col gap-3 text-center">
			<h2 class="text-4xl font-extrabold tracking-tight">Component Showcase</h2>
			<p class="text-lg text-muted-foreground">
				shadcn-svelte components with a green theme, light &amp; dark mode support.
			</p>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
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
				<Button size="icon" aria-label="Send email"><Mail data-icon /></Button>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Button disabled>Disabled</Button>
				<Button disabled>
					<Loader class="animate-spin" data-icon="inline-start" />
					Loading...
				</Button>
			</div>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Badges</h3>
			<div class="flex flex-wrap items-center gap-3">
				<Badge>Default</Badge>
				<Badge tone="neutral" badgeStyle="subtle">Secondary</Badge>
				<Badge tone="neutral" badgeStyle="outlined">Outline</Badge>
				<Badge tone="danger">Destructive</Badge>
			</div>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Status Badges</h3>
			<div class="flex flex-wrap items-center gap-3">
				{#each STATUS_BADGE_STATUSES as status (status)}
					<StatusBadge {status}>{status}</StatusBadge>
				{/each}
			</div>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Cards &amp; Form Elements</h3>
			<div class="grid gap-6 md:grid-cols-2">
				<Card.Root>
					<Card.Header>
						<Card.Title>Text Inputs</Card.Title>
						<Card.Description>Standard input fields and textarea.</Card.Description>
					</Card.Header>
					<Card.Content class="flex flex-col gap-4">
						<div class="flex flex-col gap-2">
							<Label for="name">Name</Label>
							<Input id="name" placeholder="Enter your name" />
						</div>
						<div class="flex flex-col gap-2">
							<Label for="email">Email</Label>
							<Input id="email" type="email" placeholder="you@example.com" />
						</div>
						<div class="flex flex-col gap-2">
							<Label for="bio">Bio</Label>
							<Textarea id="bio" placeholder="Tell us about yourself…" />
						</div>
					</Card.Content>
					<Card.Footer>
						<Button class="w-full">Submit</Button>
					</Card.Footer>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>Controls</Card.Title>
						<Card.Description>Switches and checkboxes.</Card.Description>
					</Card.Header>
					<Card.Content class="flex flex-col gap-6">
						<div class="flex items-center justify-between">
							<Label for="notifications">Enable notifications</Label>
							<Switch id="notifications" />
						</div>
						<div class="flex items-center justify-between">
							<Label for="marketing">Marketing emails</Label>
							<Switch id="marketing" />
						</div>
						<Separator />
						<div class="flex flex-col gap-3">
							<span class="text-sm font-medium">Interests</span>
							<div class="flex items-center gap-2">
								<Checkbox id="frontend" />
								<Label for="frontend" class="font-normal">Frontend</Label>
							</div>
							<div class="flex items-center gap-2">
								<Checkbox id="backend" />
								<Label for="backend" class="font-normal">Backend</Label>
							</div>
							<div class="flex items-center gap-2">
								<Checkbox id="devops" />
								<Label for="devops" class="font-normal">DevOps</Label>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</section>

		<Separator />

		<section class="flex flex-col gap-4">
			<h3 class="text-2xl font-semibold tracking-tight">Alerts</h3>
			<div class="flex flex-col gap-3">
				<Alert.Root>
					<Info size={16} />
					<Alert.Title>Information</Alert.Title>
					<Alert.Description
						>This is an informational alert using the default variant.</Alert.Description
					>
				</Alert.Root>
				<Alert.Root tone="destructive">
					<TriangleAlert size={16} />
					<Alert.Title>Error</Alert.Title>
					<Alert.Description
						>Something went wrong. Please try again later.</Alert.Description
					>
				</Alert.Root>
				<Alert.Root class="border-primary/50 text-primary [&>svg]:text-primary">
					<CircleCheck size={16} />
					<Alert.Title>Success</Alert.Title>
					<Alert.Description>Your changes have been saved successfully.</Alert.Description
					>
				</Alert.Root>
			</div>
		</section>

		<Separator />
		<footer class="pb-8 text-center text-sm text-muted-foreground">
			Built with SvelteKit, Tailwind CSS &amp; shadcn-svelte
		</footer>
	</div>
</main>
