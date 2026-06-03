<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Select from '$lib/components/base/select/index.js';
	import type { DetectedColumn, ColumnRole } from '$lib/modules/import/detect_columns.js';
	import { COLUMN_ROLE_OPTIONS } from './import_wizard_types.js';

	interface ImportColumnMappingProps {
		columns: DetectedColumn[];
		onchange: (columns: DetectedColumn[]) => void;
	}

	let { columns, onchange }: ImportColumnMappingProps = $props();

	const ROLE_LABELS: Record<string, () => string> = {
		import_wizard_role_name: () => m.import_wizard_role_name(),
		import_wizard_role_notes: () => m.import_wizard_role_notes(),
		import_wizard_role_url: () => m.import_wizard_role_url(),
		import_wizard_role_price: () => m.import_wizard_role_price(),
		import_wizard_role_bool: () => m.import_wizard_role_bool(),
		import_wizard_role_ignore: () => m.import_wizard_role_ignore(),
	};

	function getRoleLabel(labelKey: string): string {
		return ROLE_LABELS[labelKey]?.() ?? labelKey;
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
					{getRoleLabel(
						COLUMN_ROLE_OPTIONS.find((opt) => opt.value === column.role)?.labelKey ??
							'',
					)}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						{#each COLUMN_ROLE_OPTIONS as option (option.value)}
							<Select.Item value={option.value} label={getRoleLabel(option.labelKey)}>
								{getRoleLabel(option.labelKey)}
							</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</div>
	{/each}
</div>
