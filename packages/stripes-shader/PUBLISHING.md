# Publishing (manual — requires your GitHub Packages auth)

1. Authenticate to GitHub Packages: add to `~/.npmrc`:
   `//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT` (PAT with `write:packages`)
2. Build: `pir --filter @necatikcl/stripes-shader build`
3. Publish: `cd packages/stripes-shader && pnpm publish` (uses `publishConfig.registry`).
   - For a real release, FIRST swap `src/assets/BerkeleyMonoTrial-Regular.otf` for your LICENSED font file.
     Consumers: add `@necatikcl:registry=https://npm.pkg.github.com` (+ auth) to their `.npmrc`, then
     `npm i @necatikcl/stripes-shader pixi.js react react-dom` and `<StripesShader src=… config={…} />`.
