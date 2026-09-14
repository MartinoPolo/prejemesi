<script lang="ts">
	import '../../../app.css';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { Button } from './button/index.js';
	import { CONTROL_SIZES } from './control_sizing.js';
	import * as InputGroup from './input-group/index.js';
	import { SearchField } from './search-field/index.js';

	let searchValue = $state('Needle');
	let groupedValue = $state('Haystack');
</script>

{#each CONTROL_SIZES as size (size)}
	<div data-testid={`composed-${size}`}>
		<SearchField {size} aria-label={`Search field ${size}`} value={`Search ${size}`} />
		<Button {size} format="icon" aria-label={`Button peer ${size}`}
			><SearchIcon data-icon /></Button
		>
		<InputGroup.Root {size}>
			<InputGroup.Addon data-testid={`Input group addon ${size}`}
				><SearchIcon /></InputGroup.Addon
			>
			<InputGroup.Input aria-label={`Input group ${size}`} value={`Group ${size}`} />
			<InputGroup.Addon>
				<Button size="sm" format="icon" aria-label={`Nested button ${size}`}
					><SearchIcon data-icon /></Button
				>
			</InputGroup.Addon>
		</InputGroup.Root>
	</div>
{/each}

<div data-testid="composed-responsive">
	<SearchField aria-label="Responsive search field" bind:value={searchValue} />
	<Button format="icon" aria-label="Responsive button peer"><SearchIcon data-icon /></Button>
	<InputGroup.Root>
		<InputGroup.Addon data-testid="Responsive input group addon"
			><SearchIcon /></InputGroup.Addon
		>
		<InputGroup.Input aria-label="Responsive input group" bind:value={groupedValue} />
	</InputGroup.Root>
</div>
