/**
 * The page `mosaic serve` puts at `/`.
 *
 * It is a string rather than a file so that it survives being bundled into the CLI's
 * single executable, where there is no directory to read from. The 3D view is three.js,
 * driven directly: the file is parsed from the bytes the endpoint answered with, every
 * mesh sharing a material is gathered into one batch, and the frame is drawn only when
 * something has moved. That is what a converted building needs -- the electrical model is
 * 79,193 separate meshes over 8,776 geometries, so it is the draw calls that cost rather
 * than the geometry, and the sharing is worth keeping.
 * three.js comes from a CDN and is imported on first draw, so the 3D
 * panel needs the machine to have internet; everything else works without it.
 *
 * Several tesserae can be on show at once, and whatever they import comes along whether
 * it was ticked or not -- a child reference that leaves one tessera and lands in another
 * is drawn as an ordinary child, marked with the tessera it is written in.
 *
 * The script below avoids template literals on purpose: this whole page is one, and a
 * `${` inside it would be read by TypeScript rather than by the browser.
 */
export const APP_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mosaic</title>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/"
  }
}
</script>
<style>
  :root {
    color-scheme: dark;
    --bg: #14161a; --panel: #1c1f26; --line: #2b303b; --ink: #e7eaf0;
    --dim: #97a0b0; --accent: #7fb3ff; --warn: #ffb86b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; height: 100vh; display: grid;
    grid-template-rows: auto 1fr;
    font: 13px/1.5 ui-sans-serif, system-ui, "Segoe UI", sans-serif;
    background: var(--bg); color: var(--ink);
  }
  header {
    display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
    padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--panel);
  }
  header h1 { font-size: 14px; margin: 0 8px 0 0; font-weight: 600; letter-spacing: .04em; }
  label { display: flex; gap: 6px; align-items: center; color: var(--dim); }
  select, button, input[type=file] { font: inherit; color: var(--ink); }
  select, button {
    background: #262b35; border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px;
  }
  button:hover:not(:disabled) { border-color: var(--accent); cursor: pointer; }
  button:disabled { opacity: .5; }
  main { display: grid; grid-template-columns: 320px 1fr 340px; min-height: 0; }
  .column { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--line); }
  section { min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--line); }
  .column > section { border-right: 0; }
  .column > section.tesserae { flex: 0 1 auto; max-height: 40%; border-bottom: 1px solid var(--line); }
  .column > section.tree { flex: 1 1 auto; }
  section:last-child { border-right: 0; }
  h2 {
    margin: 0; padding: 8px 12px; font-size: 11px; text-transform: uppercase;
    letter-spacing: .09em; color: var(--dim); border-bottom: 1px solid var(--line);
    display: flex; gap: 8px; align-items: center;
  }
  .scroll { overflow: auto; padding: 6px 0; flex: 1; }
  .tessera {
    display: grid; grid-template-columns: auto 1fr auto; gap: 6px; align-items: center;
    padding: 3px 12px; color: var(--ink); white-space: nowrap;
  }
  .tessera:hover { background: #222732; }
  .tessera select { padding: 1px 4px; font-size: 11px; max-width: 130px; }
  .tessera .badge { justify-self: end; }
  .badge {
    font-size: 10px; letter-spacing: .04em; color: var(--warn);
    border: 1px solid #4a3f2c; border-radius: 999px; padding: 0 6px;
  }
  .badge.other { color: var(--accent); border-color: #2f4a6d; }
  .group {
    display: flex; gap: 8px; align-items: center;
    padding: 6px 12px 3px; color: var(--dim); font-size: 11px;
    text-transform: uppercase; letter-spacing: .07em;
  }
  .group:not(:first-child) { border-top: 1px solid var(--line); margin-top: 4px; }
  .node {
    display: flex; align-items: center; gap: 6px; padding: 3px 12px; cursor: pointer;
    white-space: nowrap; border-left: 2px solid transparent;
  }
  .node:hover { background: #222732; }
  .node[aria-selected=true] { background: #263349; border-left-color: var(--accent); }
  .twisty { width: 12px; color: var(--dim); flex: none; }
  .twisty[data-leaf=true] { visibility: hidden; }
  .name { overflow: hidden; text-overflow: ellipsis; }
  .count { color: var(--dim); font-size: 11px; }
  .kids[hidden] { display: none; }
  .stage { flex: 1; min-height: 0; position: relative; background: #0e1014; }
  #viewer { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  .stats {
    margin-left: auto; color: var(--dim); font-size: 10px;
    text-transform: none; letter-spacing: 0; font-variant-numeric: tabular-nums;
  }
  .component { border-bottom: 1px solid var(--line); padding: 8px 12px; }
  .component .type { color: var(--accent); font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
  .component .ref { color: var(--dim); font-size: 11px; }
  pre {
    margin: 6px 0 0; white-space: pre-wrap; word-break: break-word;
    font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: #cfd6e4;
    max-height: 220px; overflow: auto;
  }
  .empty { color: var(--dim); padding: 14px 12px; }
  .warnings { color: var(--warn); padding: 6px 12px; font-size: 11px; border-top: 1px solid var(--line); }
  .status { margin-left: auto; color: var(--dim); }
  .status[data-error=true] { color: var(--warn); }
</style>
</head>
<body>
<header>
  <h1>Mosaic</h1>
  <label>upload <input id="file" type="file" accept=".tsr" multiple></label>
  <label title="Resolve inheritance before answering, the way composing does. A part whose geometry belongs to the type it is-a has none of its own until this is on.">
    <input id="compose" type="checkbox" checked> compose
  </label>
  <button id="whole">Show everything</button>
  <span class="status" id="status"></span>
</header>

<main>
  <div class="column">
    <section class="tesserae">
      <h2>Tesserae</h2>
      <div class="scroll" id="tesserae"><p class="empty">Upload a .tsr to begin.</p></div>
    </section>
    <section class="tree">
      <h2>Tree</h2>
      <div class="scroll" id="tree"><p class="empty">Tick a tessera to show it.</p></div>
      <div class="warnings" id="warnings" hidden></div>
    </section>
  </div>
  <section>
    <h2>3D <span class="stats" id="stats"></span></h2>
    <div class="stage"><canvas id="viewer"></canvas></div>
  </section>
  <section>
    <h2>Components</h2>
    <div class="scroll" id="components"><p class="empty">Select a node.</p></div>
  </section>
</main>

<script type="module">
const $ = id => document.getElementById(id);

const state = {
  tesserae: [],
  // Which tesserae are on show, and which version of each.
  shown: new Set(),
  version: new Map(),
  scene: null,
  selected: null,
  expanded: new Set(),
};

function say(message, isError = false) {
  $("status").textContent = message;
  $("status").dataset.error = String(isError);
}

async function call(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try { message = JSON.parse(text).error ?? text; } catch {}
    throw new Error(message || response.status);
  }
  return response;
}

const compose = () => $("compose").checked;

/** The versions on show, as the "tessera:version" pairs the endpoints take. */
function shownVersions() {
  const pairs = [];
  for (const tessera of state.tesserae) {
    if (!state.shown.has(tessera.id)) continue;
    const versionId = state.version.get(tessera.id);
    if (versionId) pairs.push({ tesseraId: tessera.id, versionId });
  }
  return pairs;
}

// --- what the server holds -------------------------------------------------

async function loadTesserae() {
  state.tesserae = await (await call("/app/tesserae")).json();

  for (const tessera of state.tesserae) {
    // Default to the newest version, and keep a choice that is still there.
    const versions = tessera.versions.map(version => version.versionId);
    const chosen = state.version.get(tessera.id);
    if (!chosen || !versions.includes(chosen)) state.version.set(tessera.id, versions[versions.length - 1]);
  }

  drawTesserae();
}

function drawTesserae() {
  const panel = $("tesserae");
  panel.innerHTML = "";

  if (state.tesserae.length === 0) {
    panel.innerHTML = '<p class="empty">Upload a .tsr to begin.</p>';
    return;
  }

  // What a tessera on show dragged in behind it, so an import is visible as an import.
  const imported = new Map((state.scene?.imported ?? []).map(entry => [entry.tesseraId, entry]));

  for (const tessera of state.tesserae) {
    const row = document.createElement("label");
    row.className = "tessera";
    row.title = tessera.id;

    const tick = document.createElement("input");
    tick.type = "checkbox";
    tick.checked = state.shown.has(tessera.id);
    tick.onchange = () => {
      tick.checked ? state.shown.add(tessera.id) : state.shown.delete(tessera.id);
      loadScene();
    };

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = tessera.name;

    const versions = document.createElement("select");
    for (const version of tessera.versions) {
      const option = document.createElement("option");
      option.value = version.versionId;
      option.textContent = version.message || version.versionId.slice(0, 8);
      versions.append(option);
    }
    versions.value = state.version.get(tessera.id) ?? "";
    versions.onchange = event => {
      state.version.set(tessera.id, event.target.value);
      if (state.shown.has(tessera.id) || imported.has(tessera.id)) loadScene();
    };
    versions.onclick = event => event.preventDefault();

    row.append(tick, name, versions);

    if (!state.shown.has(tessera.id) && imported.has(tessera.id)) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "via import";
      badge.title = "Something on show imports this, so it is being read too";
      row.append(badge);
    }

    panel.append(row);
  }
}

// --- the tree, out of one selection over everything on show ----------------

async function loadScene() {
  const versions = shownVersions();
  drawTesserae();

  if (versions.length === 0) {
    state.scene = null;
    state.selected = null;
    $("tree").innerHTML = '<p class="empty">Tick a tessera to show it.</p>';
    $("components").innerHTML = '<p class="empty">Select a node.</p>';
    $("warnings").hidden = true;
    say("");
    return;
  }

  say("reading…");
  try {
    const query = new URLSearchParams({
      versions: versions.map(pair => pair.tesseraId + ":" + pair.versionId).join(","),
      compose: String(compose()),
    });

    state.scene = await (await call("/app/scene?" + query)).json();
    state.selected = null;

    drawTesserae();
    drawTree();
    drawWarnings();
    $("components").innerHTML = '<p class="empty">Select a node.</p>';

    const brought = (state.scene.imported ?? []).map(entry => entry.name);
    say(state.scene.roots.length + " roots, " + Object.keys(state.scene.nodes).length + " nodes"
        + (brought.length ? " · imports: " + brought.join(", ") : ""));
  } catch (error) {
    say(String(error.message ?? error), true);
  }
}

function drawWarnings() {
  const panel = $("warnings");
  const warnings = state.scene?.warnings ?? [];

  panel.hidden = warnings.length === 0;
  panel.textContent = warnings.join(" · ");
}

function labelOf(node) {
  return node.name ?? node.id.slice(0, 8) + "…";
}

function drawTree() {
  const tree = $("tree");
  tree.innerHTML = "";

  const groups = state.scene?.versions ?? [];
  if (groups.every(group => group.roots.length === 0)) {
    tree.innerHTML = '<p class="empty">Nothing in what is on show.</p>';
    return;
  }

  const draw = (id, depth, seen, from) => {
    const node = state.scene.nodes[id];
    if (!node) return document.createDocumentFragment();

    const fragment = document.createDocumentFragment();
    const row = document.createElement("div");
    row.className = "node";
    row.style.paddingLeft = 12 + depth * 14 + "px";
    row.setAttribute("aria-selected", String(state.selected === id));
    row.title = id + (node.tessera ? " · " + node.tessera : "");

    const children = node.children ?? [];
    const open = state.expanded.has(id);

    const twisty = document.createElement("span");
    twisty.className = "twisty";
    twisty.dataset.leaf = String(children.length === 0);
    twisty.textContent = open ? "▾" : "▸";
    twisty.onclick = event => {
      event.stopPropagation();
      state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
      drawTree();
    };

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = labelOf(node);

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = node.components.length + (children.length ? " · " + children.length : "");

    row.append(twisty, name, count);

    // A node written in another tessera than the one being drawn is an import crossing.
    if (node.tessera && node.tessera !== from) {
      const badge = document.createElement("span");
      badge.className = "badge other";
      badge.textContent = node.tessera;
      row.append(badge);
    }

    row.onclick = () => select(id);
    fragment.append(row);

    // A node placed in two spots appears twice; stop if it contains itself.
    if (open && !seen.has(id)) {
      const beneath = new Set(seen).add(id);
      const kids = document.createElement("div");
      kids.className = "kids";
      for (const child of children) kids.append(draw(child, depth + 1, beneath, node.tessera ?? from));
      fragment.append(kids);
    }

    return fragment;
  };

  for (const group of groups) {
    const heading = document.createElement("div");
    heading.className = "group";
    heading.textContent = group.name;
    heading.title = group.tesseraId + " · " + group.versionId;
    tree.append(heading);

    if (group.roots.length === 0) {
      heading.insertAdjacentHTML("afterend", '<p class="empty">Nothing in this version.</p>');
      continue;
    }

    for (const root of group.roots) tree.append(draw(root, 0, new Set(), group.name));
  }
}

// --- the panels ------------------------------------------------------------

function select(id) {
  state.selected = id;
  state.expanded.add(id);
  drawTree();
  drawComponents(id);
  showNode(id);
}

function drawComponents(id) {
  const node = state.scene?.nodes[id];
  const panel = $("components");
  panel.innerHTML = "";

  if (!node) return;

  const header = document.createElement("div");
  header.className = "component";
  header.innerHTML = '<div class="type">' + labelOf(node) + '</div><div class="ref">' + node.id + "</div>";
  if (node.tessera) {
    const where = document.createElement("div");
    where.className = "ref";
    where.textContent = "in " + node.tessera;
    header.append(where);
  }
  panel.append(header);

  if (node.components.length === 0) {
    panel.insertAdjacentHTML("beforeend", '<p class="empty">This node carries nothing.</p>');
    return;
  }

  for (const component of node.components) {
    const block = document.createElement("div");
    block.className = "component";

    const type = document.createElement("div");
    type.className = "type";
    type.textContent = component.type;

    const reference = document.createElement("div");
    reference.className = "ref";
    reference.textContent = component.id + (component.index >= 0 ? " · row " + component.index : " · no value");

    block.append(type, reference);

    if (component.value !== null && component.value !== undefined) {
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(component.value, null, 2);
      block.append(pre);
    }

    panel.append(block);
  }
}

/**
 * One node in the viewer, asked for through the API's own nodes endpoint.
 *
 * The version asked is the one the node is written in, which for a node reached across an
 * import is the imported tessera rather than the one on screen. The endpoint follows that
 * version's own imports, so whatever the node points at comes with it.
 */
async function showNode(id) {
  const node = state.scene?.nodes[id];
  if (!node?.tesseraId || !node?.versionId) return;

  await intoViewer(
    "asking the api for " + labelOf(node) + "…",
    call("/Mosaic-api/tesserae/" + node.tesseraId + "/versions/" + node.versionId + "/nodes?format=glb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodes: [id], includeChildren: true, compose: compose() }),
    }));
}

/**
 * Everything on show at once.
 *
 * This one cannot go through the nodes endpoint: that endpoint answers for a single
 * version, and this is a question about several. It goes to the page's own /app/glb,
 * which is the same selection over a set of versions.
 */
async function showEverything() {
  const versions = shownVersions();
  const roots = (state.scene?.versions ?? []).flatMap(group => group.roots);
  if (versions.length === 0 || roots.length === 0) return;

  await intoViewer(
    "building a glb of everything on show…",
    call("/app/glb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ versions, nodes: roots, includeChildren: true, compose: compose() }),
    }));
}

// --- the 3D view ------------------------------------------------------------

/**
 * three.js, fetched the first time something is drawn.
 *
 * It is a dynamic import rather than a static one so that a machine with no internet
 * still gets the tree, the components and the uploads: only this panel goes dark, and it
 * says why. The specifiers resolve through the import map in the head.
 */
let stage = null;

async function viewer() {
  if (stage) return stage;

  let parts;
  try {
    parts = await Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/environments/RoomEnvironment.js"),
    ]);
  } catch (error) {
    throw new Error("the 3D view needs three.js from the CDN, which did not load: "
                    + (error.message ?? error));
  }

  stage = build(...parts);
  return stage;
}

function build(THREE, orbit, gltf, environment) {
  const canvas = $("viewer");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // The look the model-viewer element was set to, kept, so changing the renderer does not
  // silently restyle every model.
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

  const controls = new orbit.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Image-based lighting, generated once. It is what gives the PBR materials somewhere to
  // reflect, and unlike a shadow map it costs nothing per frame -- which is the trade this
  // renderer makes throughout: pay at load, not at 60 Hz.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new environment.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // The environment on its own lights every face equally, so anything with a direction to
  // it -- a sloped roof, a reveal, a beam seen end on -- flattens out. One key light across
  // it puts that back. It does little for a model whose materials are already near white,
  // which a converted building's often are, and a lot for one that is not. Neither light
  // casts a shadow: a shadow map over a whole building is the sort of per-frame cost this
  // renderer exists to avoid.
  scene.environmentIntensity = 0.55;

  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1, 2, 1.5);
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2e36, 0.45));

  // The model lives in here, so emptying it cannot take the lights with it.
  const content = new THREE.Group();
  scene.add(content);

  const loader = new gltf.GLTFLoader();

  // --- drawing only when something moved ------------------------------------
  // The old element rotated the model forever, so it redrew sixty times a second whether
  // or not anything had changed. Nothing here draws until it has to.
  let pending = true;
  const invalidate = () => { pending = true; };
  controls.addEventListener("change", invalidate);

  function frame() {
    requestAnimationFrame(frame);
    controls.update();
    if (!pending) return;
    pending = false;

    renderer.render(scene, camera);
    $("stats").textContent = renderer.info.render.calls + " draws · "
      + renderer.info.render.triangles.toLocaleString() + " triangles";
  }

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;

    renderer.setSize(box.width, box.height, false);
    camera.aspect = box.width / box.height;
    camera.updateProjectionMatrix();
    invalidate();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  frame();

  // --- what is on screen now -------------------------------------------------

  function release(object) {
    object.traverse(one => {
      // A batch owns more than its geometry: the instance matrices live in a texture of
      // their own, megabytes of it on a building, and disposing the geometry alone would
      // leave that behind on every reload.
      if (one.isBatchedMesh) one.dispose();
      if (one.geometry) one.geometry.dispose();
      for (const material of [].concat(one.material ?? [])) {
        for (const value of Object.values(material)) {
          if (value && value.isTexture) value.dispose();
        }
        material.dispose();
      }
    });
  }

  function clear() {
    for (const child of [...content.children]) {
      content.remove(child);
      release(child);
    }
    invalidate();
  }

  /**
   * The whole file rebuilt as one batch per material.
   *
   * This is the change that matters for a big model. A converted building arrives as tens
   * of thousands of separate meshes -- 79,193 of them in the electrical model -- and every
   * one is a draw call, which is what a browser actually chokes on; the triangles are few
   * enough by comparison that the GPU would not notice them.
   *
   * The obvious fix is to merge everything sharing a material into one buffer, and it is a
   * trap on these files. They point many nodes at one mesh -- 79,193 placements of 8,776
   * geometries -- so baking every placement into its own copy turns 28 MB of geometry into
   * 760 MB. A BatchedMesh holds each distinct geometry once and each placement as a matrix
   * instead: the same seventeen draw calls, still 28 MB.
   *
   * It raycasts per instance too, so picking a node out of the picture stays possible,
   * which merging would have taken away.
   */
  function collapse(root) {
    root.updateMatrixWorld(true);

    // A batch holds one material and one attribute layout, so what could not share one is
    // keyed apart rather than attempted and caught.
    const groups = new Map();
    const awkward = [];
    let instances = 0;

    root.traverse(object => {
      if (!object.isMesh || !object.geometry) return;
      instances++;

      if (object.isSkinnedMesh || object.morphTargetInfluences || Array.isArray(object.material)) {
        awkward.push(object);
        return;
      }

      const attributes = Object.keys(object.geometry.attributes).sort().join(",");
      const key = object.material.uuid + "|" + attributes + "|" + (object.geometry.index ? "indexed" : "flat");

      let group = groups.get(key);
      if (!group) {
        group = { material: object.material, meshes: [] };
        groups.set(key, group);
      }
      group.meshes.push(object);
    });

    const out = new THREE.Group();

    for (const group of groups.values()) {
      // A batch is told up front how much it will hold, and that is the size of the
      // distinct geometries rather than the size of every placement of them.
      const distinct = new Map();
      let vertices = 0;
      let indices = 0;

      for (const mesh of group.meshes) {
        if (distinct.has(mesh.geometry.uuid)) continue;
        distinct.set(mesh.geometry.uuid, mesh.geometry);
        vertices += mesh.geometry.attributes.position.count;
        indices += mesh.geometry.index ? mesh.geometry.index.count : 0;
      }

      try {
        const batch = new THREE.BatchedMesh(group.meshes.length, vertices, indices, group.material);

        const ids = new Map();
        for (const [uuid, geometry] of distinct) ids.set(uuid, batch.addGeometry(geometry));
        for (const mesh of group.meshes) {
          batch.setMatrixAt(batch.addInstance(ids.get(mesh.geometry.uuid)), mesh.matrixWorld);
        }

        // Culling every instance is javascript that runs on each frame the camera moves,
        // and it buys back less than it costs when the whole building is usually in shot.
        // The batch as a whole is still culled, on the bounds computed below.
        batch.perObjectFrustumCulled = false;
        batch.sortObjects = group.material.transparent === true;

        batch.computeBoundingBox();
        batch.computeBoundingSphere();

        out.add(batch);
      } catch (error) {
        // A batch that refuses is one this file does not fit. Drawing those meshes one at
        // a time is slow; dropping them would be wrong.
        for (const mesh of group.meshes) {
          out.add(new THREE.Mesh(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), mesh.material));
        }
      }
    }

    for (const mesh of awkward) {
      out.add(new THREE.Mesh(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), mesh.material));
    }

    // A batch copies what it is handed and everything else here was cloned, so the file's
    // own buffers are finished with.
    root.traverse(object => { if (object.isMesh && object.geometry) object.geometry.dispose(); });

    out.userData.summary = instances.toLocaleString() + " meshes in " + out.children.length
      + (out.children.length === 1 ? " draw" : " draws");

    return out;
  }

  /** Puts the camera where the whole model is in shot, and the clip planes around it. */
  function look(at) {
    // A batch carries its own bounds: its buffers hold each distinct geometry once, at the
    // origin, so measuring it the ordinary way would measure the wrong shape entirely.
    // Everything else here had its world matrix baked in, so its geometry is already
    // where it belongs.
    const box = new THREE.Box3();

    at.traverse(object => {
      if (object.isBatchedMesh) {
        if (object.boundingBox) box.union(object.boundingBox);
      } else if (object.isMesh && object.geometry) {
        object.geometry.computeBoundingBox();
        box.union(object.geometry.boundingBox);
      }
    });

    if (box.isEmpty()) return;

    const middle = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-4);

    // A building is tens of metres across and a fitting is millimetres; near and far have
    // to follow the model rather than stay at the defaults, or one of the two z-fights.
    camera.near = radius / 1000;
    camera.far = radius * 100;

    const away = radius / Math.sin((camera.fov / 2) * Math.PI / 180);
    camera.position.copy(middle).add(new THREE.Vector3(1, 0.55, 1).normalize().multiplyScalar(away));
    camera.updateProjectionMatrix();

    controls.target.copy(middle);
    controls.update();
  }

  async function show(bytes) {
    // Parsing a few hundred megabytes blocks the thread, so let the status line paint
    // before it starts rather than after it has finished.
    await new Promise(resolve => requestAnimationFrame(resolve));

    // What was on screen goes before the next file is parsed rather than after. Two
    // buildings will not both fit -- the point of this renderer is the big ones -- and a
    // parse that fails leaves an empty view saying so, which beats a stale one that lies.
    clear();

    const file = await new Promise((resolve, reject) => loader.parse(bytes, "", resolve, reject));
    const drawn = collapse(file.scene);
    content.add(drawn);
    look(drawn);
    invalidate();

    return drawn.userData.summary;
  }

  return { show, clear };
}

async function intoViewer(saying, pending) {
  say(saying);
  try {
    const response = await pending;
    const bytes = await response.arrayBuffer();

    const nodes = response.headers.get("x-mosaic-nodes");
    const meshes = response.headers.get("x-mosaic-meshes");

    // A selection can be all links and no geometry, which looks like a broken viewer
    // rather than what it is: a part drawing its type's mesh, with compose turned off.
    if (meshes === "0") {
      try { (await viewer()).clear(); } catch {}
      say((nodes ? nodes + " nodes, " : "") + "no geometry in the answer"
          + (compose() ? "" : " — tick compose if it comes from a type"), true);
      return;
    }

    const drawing = await viewer();
    say("drawing " + (bytes.byteLength / 1048576).toFixed(1) + " MB of glb…");
    const summary = await drawing.show(bytes);

    say((nodes ? nodes + " nodes, " : "") + (meshes ? meshes + " meshes, " : "")
        + bytes.byteLength + " bytes of glb — " + summary);
  } catch (error) {
    say(String(error.message ?? error), true);
  }
}

// --- wiring ----------------------------------------------------------------

$("file").onchange = async event => {
  const files = [...event.target.files];
  let last;

  for (const file of files) {
    say("uploading " + file.name + "…");
    try {
      const response = await call("/app/upload?name=" + encodeURIComponent(file.name), {
        method: "POST", body: await file.arrayBuffer(),
      });
      last = await response.json();
      if (last.state !== "OK") throw new Error(last.state + ": " + (last.validationErrors ?? []).join("; "));

      // Whatever was just uploaded is what you want to look at.
      state.shown.add(last.tesseraId);
      state.version.set(last.tesseraId, last.versionId);
    } catch (error) {
      say(file.name + ": " + (error.message ?? error), true);
      return;
    }
  }

  event.target.value = "";
  await loadTesserae();
  if (last) await loadScene();
};

$("compose").onchange = async () => {
  const selected = state.selected;
  await loadScene();
  if (selected && state.scene?.nodes[selected]) select(selected);
};

$("whole").onclick = () => showEverything();

await loadTesserae();
</script>
</body>
</html>
`;
