<script lang="ts">
	import { Toaster } from 'svelte-sonner';
</script>

<!-- Floating page controls reserve room through the --toast-offset-* properties. -->
<Toaster
	position="bottom-right"
	expand={false}
	richColors={false}
	offset={{
		right: 'var(--toast-offset-right, 24px)',
		bottom: 'var(--toast-offset-bottom, 24px)',
	}}
	mobileOffset={{ bottom: 'var(--toast-mobile-offset-bottom, 16px)' }}
/>

<style>
	/* Toasts stack above modal overlays, which block the page instead of <body> pointer-events
	   (base Dialog and Sheet content), so they stay inert while a modal is open, as before. */
	:global(
		body:has(> [data-slot='dialog-overlay'], > [data-slot='sheet-overlay'])
			[data-sonner-toaster]
	) {
		pointer-events: none;
	}
</style>
