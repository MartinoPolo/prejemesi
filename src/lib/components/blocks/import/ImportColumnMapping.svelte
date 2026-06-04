<script lang="ts">
	import * as Select from '$lib/components/base/select/index.js';
	import type { DetectedColumn, ColumnRole } from '$lib/modules/import/detect_columns.js';
	import { COLUMN_ROLE_OPTIONS } from './import_wizard_types.js';

	interface ImportColumnMappingProps {
		columns: DetectedColumn[];
		onchange: (columns: DetectedColumn[]) => void;
	}

	let { columns, onchange }: ImportColumnMappingProps = $props();

	function getRoleLabel(role: ColumnRole): string {
		return COLUMN_ROLE_OPTIONS.find((opt) => opt.value === role)?.label() ?? role;
	}

	function handleRoleChange(columnIndex: number, newRole: ColumnRole) {
		const updated = columns.map((col) =>
			col.index === columnIndex ? { ...col, role: newRole } : col,
		);
		onchange(updated);
	}
</script>

<div class="flex gap-2 overflow-x-auto pb-2">
	{#each columns as column (column.index)}
		<div class="flex min-w-[120px] flex-1 flex-col gap-1">
			{#if column.headerLabel}
				<span class="text-muted-foreground truncate text-xs" title={column.headerLabel}>
					{column.headerLabel}
				</span>
			{/if}
			<Select.Root
				type="single"
				value={column.role}
				onValueChange={(value) => {
					if (value !== undefined && value !== '') {
						handleRoleChange(column.index, value as ColumnRole);
					}
				}}
			>
				<Select.Trigger size="sm" class={column.role === 'name' ? 'border-primary' : ''}>
					{getRoleLabel(column.role)}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						{#each COLUMN_ROLE_OPTIONS as option (option.value)}
							<Select.Item value={option.value} label={option.label()}>
								{option.label()}
							</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/each}
</div>
