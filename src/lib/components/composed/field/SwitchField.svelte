<script lang="ts">
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	interface Props {
		id: string;
		label: string;
		checked?: boolean;
		onCheckedChange?: (checked: boolean) => void;
		class?: string;
	}

	let {
		id,
		label: labelText,
		checked = $bindable(false),
		onCheckedChange,
		class: className,
	}: Props = $props();
</script>

<div class="flex items-center justify-between {className ?? ''}">
	<Label for={id}>{labelText}</Label>
	<Switch {id} bind:checked {onCheckedChange} />
</div>
