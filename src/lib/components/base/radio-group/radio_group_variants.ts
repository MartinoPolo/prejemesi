import type { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
import type { WithoutChildrenOrChild } from '$lib/utils.js';

export type RadioGroupProps = RadioGroupPrimitive.RootProps;

export type RadioGroupItemProps = WithoutChildrenOrChild<RadioGroupPrimitive.ItemProps>;
