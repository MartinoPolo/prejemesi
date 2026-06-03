<script lang="ts">
	interface GoogleSheetsIconProps {
		class?: string;
	}

	let { class: className = 'size-4' }: GoogleSheetsIconProps = $props();
</script>

<svg viewBox="0 0 24 24" fill="none" class={className} aria-hidden="true">
	<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#0F9D58" />
	<path d="M14 2v6h6" fill="#87CEAC" />
	<path d="M8 13h8v6H8z" fill="white" />
	<path d="M8 13h8v1.5H8zm0 3h8v1.5H8z" fill="#0F9D58" opacity="0.4" />
	<path d="M12 13v6" stroke="#0F9D58" stroke-width="0.5" opacity="0.4" />
</svg>
