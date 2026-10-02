/**
 * Side-aware margin that extends each Bits UI floating wrapper by the depth clearance. Floating UI
 * measures the wrapper, so the trigger shadow stays clear of the menu border while flip, shift,
 * and the available-size caps keep accounting for the extra distance after a live depth change.
 */
export const floatingDepthClearance =
	'data-[side=bottom]:mt-(--depth-clearance) data-[side=top]:mb-(--depth-clearance) data-[side=left]:mr-(--depth-clearance) data-[side=right]:ml-(--depth-clearance)';
