# BioPhi369 · The Biological Computer

## v0.3 · Imagination-to-Engineering Bridge

**New fourth mode: Engineering Bridge.** Turn an imagined assembly into individually editable, exportable **concept geometry** while preserving all of v0.1 and v0.2.

- Procedural 3D **gear, ring, shaft, block and bubble** primitives. Select via raycast or the accessible component tree; add/duplicate/delete, name and adjust position XYZ, rotation XYZ, scale and visual RPM. Up to 24 components.
- Connect two parts with a labeled *visual relationship* and remove links. **Links are not joints, motor constraints or gear-contact calculations.**
- Play an independent per-component rotation preview, rotate/zoom the assembly and control the global exploded view. Independent RPM values are assigned by the user; **no torque, inertia, collision, tooth meshing, tolerance or physical performance is computed**.
- Save up to 12 whole-assembly keyframes, play snapshots in order, load snapshots, and clear frames. This is a stepped configuration sequencer, not continuous mechanical motion interpolation.
- Browser-local autosave plus robust, bounded **JSON import/export** for editable project state and **binary glTF (.GLB) mesh export** for use in compatible 3D tools, including Blender. The GLB exports the **unexploded rest pose**, not animation or visual link annotations. Frame data remains in JSON.
- Zero new npm dependencies: Three.js GLTFExporter is loaded from the already pinned CDN only when the user requests a GLB. WebGL and GLB export require a compatible browser and network access.

**Engineering ethics:** Editable mesh geometry is not a manufacturable CAD solid. Mesh scale is in arbitrary scene units. Treat all prototypes as artistic concepts until real dimensional constraints, collision, forces, materials, fabrication tolerances and independent verification are applied. The application is not a neuroscience measuring instrument. No user designs are transmitted to any server.

**Versioned document source:** `src/assemblyData.js` (validated model, no executable import), `src/assemblyScene.js` (3D geometry and GLB export), `src/assemblyUI.js` (local-first editing and recording), `tests/assemblyData.test.mjs` (exact constraints, controls and replay).

## v0.2 · CFD Imagination Workbench

**What is new:**

- Three procedural bounded point-field geometries (spiral cloud, twisting lattice, nested bubble shells) with density, twist, depth and rotation controls.
- Switch the schematic exploded object between a hardware view and a software dependency-graph view.
- Inspect left/right/both schematic hemispheres without claiming a left-CPU/right-GPU division.
- Capture up to **24 named keyframes**, review them, replay them in order (1.5 seconds per frame), delete or clear them.
- Keyframes are saved in browser localStorage when available; users can **export/import a versioned JSON recording**. Import validates shape, bounds, length and date fields and rejects oversized files (>100 KB). Import replaces the local recording; nothing is sent to a server.
- Separate deterministic geometry and schema tests, with no WebGL or third-party package needed for Node CI.

**Boundaries:** A CFD rendering is an interactive visualization design aid, **not direct observation of mental imagery**, EEG, a brain scan, or a physical CFD (computational fluid dynamics) solver. Software blocks are illustrative relationships, not a live program execution or a dependency parser. Playback switches between saved settings; it does not export video. Both cerebral hemispheres participate in many cognitive functions. The biological UI uses computer hardware terms as metaphors only.


A mobile-friendly, interactive, three-dimensional **schematic** of brain networks, designed around a playful question: *What if the mind's visualization process felt like opening a machine?*

**Live site after Pages deployment:** https://michaelwave369.github.io/BioPhi369/

## Version 0.1 · Existing foundations

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
- src/cfdEngine.js and src/cfdState.js: geometric workbench and serializable control contract.
- src/cfdUI.js: local-only recorder and browser control surface.
- scripts/build.mjs, tests/*.test.mjs: offline build, deterministic point test, schema checks and research-boundary assertions.
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
