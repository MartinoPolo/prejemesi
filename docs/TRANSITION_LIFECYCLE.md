# Overlay transition lifecycle

Investigation for [issue #378](https://github.com/MartinoPolo/prejemesi/issues/378).

## Dropdown exit rebound

Frame-by-frame Chromium reproduction confirmed the same exit rebound when hovering between desktop
Display categories and when dismissing root or nested dropdowns outside. The outgoing node remains
connected with `data-state="closed"` and `data-ending-style`; its opacity fades toward zero, returns
to one when the CSS animation finishes, then the node is removed. The animation's computed fill mode
was `none`.

The controlled submenu callbacks switched directly from the outgoing category to its sibling while
the root remained open. A shared-state race was not supported by this reproduction. Keep that
coordination and the existing viewport-containment patch intact.

Exit styling must retain the final animation frame until Presence removes the node. Closed surfaces
must not intercept pointer input. Scope this behavior to the affected surface slots in app-owned
CSS, not to every animation in the application; preserve normal durations, easing, and positioning.

## Dialogs and related sheets

Wishlist settings content and overlays reproduce the same exit rebound on clean Escape/outside
closure and on the dirty-state guard's Continue editing and Discard paths. Those confirmation
workflows remain intact; their visual exit endpoints need the same targeted styling correction.

The mobile Display sheet instead unmounts immediately, with no detected opacity rebound under normal
or reduced motion. Preserve that existing dismissal behavior in this fix rather than redesigning its
mounting and scroll-restoration lifecycle without evidence of the reported flash.

## Gift identity during close

The gift dialog's close-request handler called its parent's cleanup immediately. That cleanup
cleared `selectedGift` while the dialog was still visible during its exit, replacing the read-only
gift content with an empty form. Browser frame and mutation sampling reproduced that content
substitution.

Logical closing must update `open` immediately, but gift cleanup belongs to the completed-close
notification. A reopened dialog must not be cleared by an obsolete close completion.

## Regression evidence

Settled visibility assertions miss this defect. Browser coverage must sample the outgoing node's
computed opacity across animation completion and through removal, rejecting an opacity rebound.
Repeated sibling hover and outside dismissal exercise different paths through the same lifecycle.
Reduced-motion coverage must exercise dismissal without normal-motion animation.

Local investigation artifacts are kept under `.local/issue-378/`: `desktop-timeline.json`,
`transition-frames.tsv`, and compositor contact sheets. These are diagnostic artifacts, not
committed application assets. Compositor capture complements the animation-frame trace; a static
screenshot alone cannot establish temporal correctness.

After-fix compositor captures and frame traces under `.local/issue-378/after/` confirmed monotonic
normal-motion exits for submenu switching, outside dismissal, clean settings closure, and dirty
confirmation workflows. Gift detail retained its content through the fade. Reduced-motion surfaces
removed directly without a rebound; related mobile sheets retained their existing behavior.

Repeatable coverage lives in `tests/e2e/dropdown-transitions.spec.ts`,
`tests/e2e/overlay-transitions.spec.ts`, and `tests/e2e/settings-transitions.spec.ts`. Run these
alongside `dropdown-viewport.spec.ts`, `hover-stability.spec.ts`, and the existing
mobile-sheet/settings/gift regressions. When using an already running development server, set
`PLAYWRIGHT_EXTERNAL_SERVER=1` and align `MPX_APP_PORT` and `PLAYWRIGHT_BASE_URL` with its local
origin.
