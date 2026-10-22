# BioPhi369 · The Biological Computer

## v0.5 · Digital Twin Laboratory (bounded experimental motion)

Fifth generation builds on Reality Check rather than replacing or weakening it:

- **Deterministic 30-second timeline**: play, pause, reset, scrub and choose playback speed (0.25–2×). Visual poses are derived from rest geometry and time; playback does not rewrite design documents or GLB rest geometry.
- **Coupled-look preview** for annotated gear-to-gear connections, only when rough parallel-Y axis, common Y plane, nominal visual center separation and compatible tooth count / primitive size conditions all pass. Signed external-tooth ratio propagation through a graph is deterministic. Contradictory odd cycles **fail closed to independent RPMs** and show a warning. Other parts stay at zero in coupled preview, never magically become driven.
- **Independent RPM mode** retains the v0.3 concept behavior when the user wants independent rotations.
- **Explicit mesh-surface screening** on the assembled *rest pose* using world-transformed triangles from the real procedurally generated THREE meshes. Includes box broad-phase, triangle-edge crossing narrow-phase, strict geometry/comparison limits and an INCONCLUSIVE outcome when a pair cannot be verified. **Does not detect all collisions**: parallel/coplanar, full containment and moving swept intersections may be missed; no guarantee of safety.
- **Reality Ledger** generates user-triggered `SIMULATED / UNVERIFIED` model receipts with selected gear driver, graph eligibility, cautions and mesh-screen counts. Kept in separate browser-local storage, capped to 60 entries; JSON download and local deletion. Never logs a "physical test pass" on a model-based prediction.
- Added unit tests for gear graph consistency, missing/ineligible links, time bounds, sequential rotations, odd cycles and receipts. The interactive WebGL scene and browser download must still be smoke tested in desktop/mobile browsers.

**Evidence rule:** These are reproducible visual and approximate geometric tools, not validated digital-twin physics. No torque, collision-free certification, mesh-to-mesh complete intersection guarantee, deformation, loads, friction, tooth engagement or manufacturing tolerances. The visual shapes use arbitrary scene units. No personal information or neural data is collected.

### v0.5 modules

- `src/digitalTwin.js`: pure deterministic motion and receipt schema.
- `src/digitalTwinUI.js`: timeline and local Reality Ledger interaction.
- `src/meshInspection.js`: deliberately bounded, incomplete triangle-surface intersection screening.
- `tests/digitalTwin.test.mjs`: motion and provenance negative controls.

## v0.4 · Reality Check Lab

New **heuristic inspection** inside Engineering Bridge. Preserves all earlier modes and design-document compatibility.

- Automatically screens **rest-pose** component pairs using conservative bounding-sphere envelopes for non-gear combinations. The sphere proxy can generate false positives and cannot prove mesh contact or clearance. Linked gear pairs use separate center-spacing checks because intended tooth flank contact can overlap bounding spheres.
- For annotated gear–gear links, displays a **signed external-gear tooth ratio and follower RPM preview** (`follower RPM = -driver RPM × driver teeth / follower teeth`). A direct click applies that numerical suggestion only; it does *not* mechanically couple motion.
- Flags nonparallel-looking gear axes, Y-plane offsets, approximate visual pitch distances, scale-versus-teeth inconsistencies and independent RPM mismatch. All approximations use arbitrary units and are **not involute-gear calculations**.
- Provides **Align X/Y/Z**, **Place beside**, and **Nominal gear pitch** snaps for a selected part relative to another component. All actions are explicit, reversible through manual adjustment / saved assembly states, and enforce the same position bounds as the editor. The center-distance pitch snap assumes parallel Y-axis gears in the rest pose.
- Displays caution and information findings in accessible selectable rows, plus counts of inspected parts and part pairs.
- New deterministic and negative-control Node tests in `tests/realityCheck.test.mjs`.

**Safety and evidence firewall:** There is no real physics engine, 3D collision mesh checker, swept-volume simulation, force/torque analysis, manufacturing tolerance solver, validated gear tooth module/pitch diameter model, clearance certification, or safety verdict. **Zero findings never means safe.** Visual inspection is only an early design aid; real mechanisms require measured geometry and independent engineering verification. The app performs no cognition measurements.

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
