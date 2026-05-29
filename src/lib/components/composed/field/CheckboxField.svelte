<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
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

<div class="flex items-center gap-2 {className ?? ''}">
	<Checkbox {id} bind:checked {onCheckedChange} />
	<Label for={id} class="font-normal">{labelText}</Label>
</div>
