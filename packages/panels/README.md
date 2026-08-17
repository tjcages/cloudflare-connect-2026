# @tjcages/panels

Vendored development build of [`tjcages/shader-panel`](https://github.com/tjcages/shader-panel) at commit `58c5e90`.

The Connect hero imports the explicit `@tjcages/panels/dev` entry so its tuning panel remains available in production-mode branch previews. Replace this vendor directory with the published package once `@tjcages/panels` is released.

Local patch: the backdrop blur is applied to the rounded panel surface instead of its square portal wrapper so page colors cannot bleed outside the panel corners.
