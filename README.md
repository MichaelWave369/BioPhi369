# BioPhi369 · The Biological Computer

A mobile-friendly, interactive, three-dimensional **schematic** of brain networks, designed around a playful question: *What if the mind's visualization process felt like opening a machine?*

**Live site after Pages deployment:** https://michaelwave369.github.io/BioPhi369/

## Version 0.1 · What works

- Rotate and zoom an original procedural 3D brain-network model in the browser.
- Choose one of ten brain structures; inspect what it does, its computer metaphor, and exactly where that metaphor breaks.
- Expand the components into an exploded view using the slider.
- Switch between **Anatomy atlas**, **Computer analogy**, and **CFD workshop**.
- CFD mode uses a mechanical sketch with rotating parts to illustrate mental visualization and spatial transformation, **not** to assert a literal GPU or a specific mental mechanism.
- Pause motion; reset the view; browse the content without WebGL.
- Responsive controls with native buttons and semantic text content.

## Scientific boundaries

The brain is not a motherboard. Both hemispheres support numerous, overlapping functions and exchange information. The pineal gland secretes melatonin as part of the body's timing system; it is **not memory/RAM**. Working memory depends on distributed networks, including frontal and parietal systems. The 3D shapes are **illustrative, not MRI-derived, not anatomically precise, and not diagnostic**.

The CPU, GPU, router and RAM labels are analogies only. Their purpose is to prompt discussion, not to imply the existence of dedicated computer parts in the brain.

## Architecture

A dependency-free static application (no build framework), with Three.js 0.180.0 and OrbitControls loaded as pinned ES modules from jsDelivr at runtime. The visual scene is procedurally authored from mathematical shapes and is not an external brain scan or a copyrighted model.

- index.html: semantic app shell and JavaScript import map.
- styles.css: responsive layout and visual system.
- src/brainData.js: source-of-truth research labels and analogy boundaries.
- src/scene.js: WebGL scene, interaction, exploded layout and motion.
- src/app.js: accessible controls and detail-panel state.
- scripts/build.mjs, tests/*.test.mjs: offline build and quality checks.
- .github/workflows/: Node quality gate and static GitHub Pages deployment.

## Local development

A modern browser, internet connection for the pinned Three.js import, and any static HTTP server are sufficient. For example, from the repository root run:

    python3 -m http.server 4173

Then visit http://localhost:4173.

Run the dependency-free tests and static export:

    npm test
    npm run build

GitHub Pages runs deployment from the default branch after merging. The CDN-based 3D view needs connectivity, but text descriptions remain visible if Three.js cannot load.

## Next research milestones

1. Add source citations per structure with clearly dated review.
2. Add a structured "imagined vs engineered" comparison lab with explicit tests.
3. Optional offline, vendored 3D rendering dependency and anatomically reviewed model.
4. Add annotation export for user-created notes only after consent and privacy design.

**Ledger above ego.** A compelling visualization is not evidence by itself.
