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
    color-scheme: light;

    /* Paper, and the things you find at the edge of the sea. The greens and blues carry
       meaning -- a type, a link, a warning -- and the sand is what they sit on. */
    --bg: #f4efe4;          /* paper */
    --panel: #fbf7ee;       /* a lighter sheet of it */
    --sunk: #ede6d7;        /* where something is pressed into the page */
    --line: #e0d6c2;        /* dry sand */
    --ink: #33322d;         /* not quite black, the way ink on paper never is */
    --dim: #8c8474;         /* driftwood */
    --accent: #16867c;      /* shallow water */
    --accent-soft: #d7ebe6;
    --warn: #d1603d;        /* terracotta */
    --warn-soft: #f7e2d6;
    --sand: #e2a84c;
    --stage: #efe9dc;       /* the 3d panel, a shade off the paper around it */
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
    background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px;
  }
  button:hover:not(:disabled) {
    border-color: var(--accent); background: var(--accent-soft); color: var(--accent); cursor: pointer;
  }
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
  .tessera:hover { background: var(--sunk); }
  .tessera select { padding: 1px 4px; font-size: 11px; max-width: 130px; }
  .tessera .badge { justify-self: end; }
  .badge {
    font-size: 10px; letter-spacing: .04em; color: var(--warn);
    border: 1px solid var(--warn); background: var(--warn-soft); border-radius: 999px; padding: 0 6px;
  }
  .badge.other { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
  .group {
    display: flex; gap: 8px; align-items: center;
    padding: 6px 12px 3px; color: var(--accent); font-size: 11px;
    text-transform: uppercase; letter-spacing: .07em;
  }
  .group:not(:first-child) { border-top: 1px solid var(--line); margin-top: 4px; }
  .node {
    display: flex; align-items: center; gap: 6px; padding: 3px 12px; cursor: pointer;
    white-space: nowrap; border-left: 2px solid transparent;
  }
  .node:hover { background: var(--sunk); }
  .node[aria-selected=true] { background: var(--accent-soft); border-left-color: var(--accent); }
  .twisty { width: 12px; color: var(--dim); flex: none; }
  .twisty[data-leaf=true] { visibility: hidden; }
  .name { overflow: hidden; text-overflow: ellipsis; }
  .count { color: var(--sand); font-size: 11px; font-variant-numeric: tabular-nums; }
  .kids[hidden] { display: none; }
  .stage { flex: 1; min-height: 0; position: relative; background: var(--stage); }
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
    background: var(--sunk); border-radius: 6px; padding: 6px 8px;
    font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: var(--ink);
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

/**
 * The components the tree is built out of: a node's name, its children, and the is-a link
 * that a composed tree follows. Nothing else is looked at to draw it.
 *
 * A converted building carries far more than this -- property sets, quantity sets, every
 * IFC entity and relationship -- and asking for all of it to draw a list of names meant
 * reading every one of them out of the database, packing each into the answer, and
 * parsing it again in here. None of it is on screen until a node is clicked, and that is
 * when it is now fetched.
 */
const TREE_COMPONENTS = ["core::child", "core::inherit", "core::name"];

/**
 * The components a glb has somewhere to put: the glTF namespace, plus the transform that
 * places a node and the child link that parents it.
 *
 * Everything else rides along as extension data on the node it belongs to, which for a
 * converted building is most of the file -- and none of it is drawable. Asking for only
 * these is asking for the geometry.
 */
const GEOMETRY_COMPONENTS = [
  "khronos::gltf::buffer", "khronos::gltf::bufferView", "khronos::gltf::accessor",
  "khronos::gltf::meshPrimitive", "khronos::gltf::image", "khronos::gltf::sampler",
  "khronos::gltf::texture", "khronos::gltf::material",
  "core::transform", "core::child",
  // An SVG is drawable too, though a glb has nowhere native to put one: it rides on its
  // node as extension data and is turned into geometry in here.
  "w3c::svg",
];

const state = {
  tesserae: [],
  // Which tesserae are on show, and which version of each.
  shown: new Set(),
  version: new Map(),
  scene: null,
  selected: null,
  expanded: new Set(),
  // What a node carries, fetched when it is selected and kept for as long as the scene
  // it belongs to. Keyed by node id.
  components: new Map(),
  // The glb the tree was read from, kept so that redrawing costs nothing.
  glb: null,
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

/**
 * The glb the tree and the picture are both read from.
 *
 * The two used to be separate questions: a json scene for the hierarchy and a glb for the
 * geometry, each its own request and each its own pass over the archive. They are the same
 * question. A glb already carries the hierarchy -- that is what its nodes and their
 * children are -- so asking for it once answers both, and the bytes are parsed twice in
 * here rather than built twice over there.
 *
 * What the tree needs on top of the geometry is the names, which arrive as core::name
 * components riding in the MOSAIC_components extension. On the architectural model they
 * cost 5.2 MB against the 49.0 MB the glb was, which is the whole price of not asking a
 * second time for 64.6 MB of json.
 */
const TREE_FROM_GLB = [...GEOMETRY_COMPONENTS, "core::name"];

/** The magic and chunk type a glb starts with, as the little-endian words they are. */
const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;

/**
 * The json chunk of a glb, without a gltf loader.
 *
 * A glb is a twelve byte header and then chunks, the first of which is the document. That
 * is little enough to read here, and reading it here is what keeps the tree working on a
 * machine that cannot reach the CDN: three.js is only needed to draw.
 */
function gltfOf(bytes) {
  const view = new DataView(bytes);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("the answer is not a glb");
  }

  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== GLB_JSON_CHUNK) {
    throw new Error("the first chunk of a glb should be its json");
  }

  return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length)));
}

/**
 * The scene the tree draws, out of a glTF document.
 *
 * Nodes are keyed by their position in the glTF array rather than by the id of the Mosaic
 * node they came from, because composing writes a node per child relation: something held
 * by two parents is two nodes here, and drawing it twice is the point. The Mosaic id is
 * kept alongside, which is what the components panel goes on to ask about.
 */
function sceneFromGltf(gltf, versions) {
  const gltfNodes = gltf.nodes ?? [];
  const nodes = {};

  for (let index = 0; index < gltfNodes.length; index++) {
    const node = gltfNodes[index];
    const carried = node.extensions?.MOSAIC_components?.components ?? [];
    const named = carried.find(component => component.type === "core::name");

    nodes[String(index)] = {
      id: String(index),
      // The name of a glTF node is the id of the Mosaic node it was written from.
      nodeId: node.name ?? null,
      name: named?.name ?? null,
      children: (node.children ?? []).map(String),
      drawn: node.mesh !== undefined,
    };
  }

  const scene = gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? [];
  const roots = scene.map(String);

  return {
    // One glb is one answer over everything on show, so the tree is one group. Which
    // tessera each node came from is not written into a glb, so a node reached across an
    // import is drawn as an ordinary child here, without the badge naming where it lives.
    versions: [{
      tesseraId: versions[0]?.tesseraId ?? null,
      versionId: versions[0]?.versionId ?? null,
      name: versions.length === 1 ? (state.tesserae.find(t => t.id === versions[0].tesseraId)?.name ?? "") : "on show",
      roots,
    }],
    imported: [],
    warnings: [],
    roots,
    nodes,
  };
}

async function loadScene() {
  const versions = shownVersions();
  drawTesserae();

  if (versions.length === 0) {
    state.scene = null;
    state.selected = null;
    state.glb = null;
    $("tree").innerHTML = '<p class="empty">Tick a tessera to show it.</p>';
    $("components").innerHTML = '<p class="empty">Select a node.</p>';
    $("warnings").hidden = true;
    try { (await viewer()).clear(); } catch {}
    say("");
    return;
  }

  say("reading…");
  try {
    const response = await call("/app/glb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        versions,
        nodes: null,
        includeChildren: true,
        compose: compose(),
        componentTypes: TREE_FROM_GLB,
      }),
    });

    const bytes = await response.arrayBuffer();
    state.glb = bytes;

    state.scene = sceneFromGltf(gltfOf(bytes), versions);
    state.selected = null;
    state.components.clear();

    drawTesserae();
    drawTree();
    drawWarnings();
    $("components").innerHTML = '<p class="empty">Select a node.</p>';

    // The same bytes, drawn. Nothing is fetched twice.
    const drawing = await viewer();
    const summary = await drawing.show(bytes);

    say(state.scene.roots.length + " roots, " + Object.keys(state.scene.nodes).length + " nodes, "
        + (bytes.byteLength / 1048576).toFixed(1) + " MB of glb — " + summary.text);
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
  return node.name ?? (node.nodeId ? node.nodeId.slice(0, 8) + "…" : "node " + node.id);
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

    // How many children, and nothing about how many components: the tree is read with
    // three component types, so a count of them would be a count of what was asked for
    // rather than of what the node carries. The panel says that, once it has asked.
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = children.length ? String(children.length) : "";

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

/**
 * What a node carries, read the first time it is asked for and kept afterwards.
 *
 * The tree was read with only the three component types it draws, so this is where the
 * rest of a node -- its property sets, its quantities, whatever else it was given -- is
 * read: for the one node being looked at, rather than for every node in the building
 * against the chance that one of them is clicked.
 */
async function componentsOf(id) {
  if (state.components.has(id)) return state.components.get(id);

  const versions = shownVersions();
  const node = state.scene?.nodes[id];
  if (versions.length === 0 || !node?.nodeId) return [];

  // The tree knows a node by its place in the glb; the archive knows it by its id.
  const query = new URLSearchParams({
    versions: versions.map(pair => pair.tesseraId + ":" + pair.versionId).join(","),
    compose: String(compose()),
    nodes: node.nodeId,
    children: "false",
  });

  const answer = await (await call("/app/scene?" + query)).json();
  const carried = answer.nodes?.[node.nodeId]?.components ?? [];

  state.components.set(id, carried);
  return carried;
}

async function drawComponents(id) {
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

  const waiting = document.createElement("p");
  waiting.className = "empty";
  waiting.textContent = "reading what it carries…";
  panel.append(waiting);

  let carried;
  try {
    carried = await componentsOf(id);
  } catch (error) {
    waiting.textContent = String(error.message ?? error);
    return;
  }

  // Something else may have been clicked while that was in flight, and the panel is
  // about whatever is selected now rather than about what was selected when it was asked.
  if (state.selected !== id) return;
  waiting.remove();

  if (carried.length === 0) {
    panel.insertAdjacentHTML("beforeend", '<p class="empty">This node carries nothing.</p>');
    return;
  }

  for (const component of carried) {
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
 * One node on its own, asked for through the API's own nodes endpoint.
 *
 * Everything on show is already drawn, so this is for narrowing to one part of it. It is
 * a fresh selection rather than a filter of what is loaded: the answer follows the
 * version's imports, so whatever the node points at comes with it.
 */
async function showNode(id) {
  const node = state.scene?.nodes[id];
  const [version] = shownVersions();
  if (!node?.nodeId || !version) return;

  await intoViewer(
    "asking the api for " + labelOf(node) + "…",
    call("/Mosaic-api/tesserae/" + version.tesseraId + "/versions/" + version.versionId + "/nodes?format=glb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodes: [node.nodeId], includeChildren: true, compose: compose(),
        componentTypes: GEOMETRY_COMPONENTS,
      }),
    }));
}

/**
 * Everything on show, again.
 *
 * The bytes are the ones the tree was read from, so this asks for nothing: it draws what
 * is already here, which is what "everything" means once a node has been looked at alone.
 */
async function showEverything() {
  if (!state.glb) return;

  say("drawing " + (state.glb.byteLength / 1048576).toFixed(1) + " MB of glb…");
  try {
    const summary = await (await viewer()).show(state.glb);
    say(Object.keys(state.scene?.nodes ?? {}).length + " nodes — " + summary.text);
  } catch (error) {
    say(String(error.message ?? error), true);
  }
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
      import("three/addons/utils/BufferGeometryUtils.js"),
      import("three/addons/loaders/SVGLoader.js"),
    ]);
  } catch (error) {
    throw new Error("the 3D view needs three.js from the CDN, which did not load: "
                    + (error.message ?? error));
  }

  stage = build(...parts);
  return stage;
}

function build(THREE, orbit, gltf, environment, utils, svg) {
  const canvas = $("viewer");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // A converted building is nearly all white surfaces -- the architectural model's two
  // materials are #f6f7f4 and #94979c, both fully rough. Under a neutral curve everything
  // facing the light lands on the ceiling of the range at once and the model reads as a
  // silhouette. AgX rolls the highlights off instead of clipping them, which is what keeps
  // a white wall in sun distinguishable from a white wall in shade.
  renderer.toneMapping = THREE.AgXToneMapping ?? THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  // Against a dark panel the model had to be bright to be seen. Against paper the opposite
  // holds: a white building lit to the top of the range is the same value as the page it
  // sits on. Exposed down, the lit faces land clearly under the paper and the shadows have
  // somewhere to go.
  renderer.toneMappingExposure = 0.82;

  // Shadows are the one per-frame cost this renderer takes on, and they buy the most: with
  // no cast shadow a floor slab and the floor below it are the same white. The scene draws
  // in a couple of dozen calls, so the depth pass is a couple of dozen more, and only on a
  // frame that redraws at all.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // A shadow is only as dark as the light that fills it, so most of the strength comes
  // from the rig below. What the map itself decides is how sharp the edge is.
  renderer.shadowMap.autoUpdate = true;

  const scene = new THREE.Scene();

  // The same paper the page is on. It is read off the stylesheet rather than written
  // twice, so the panel and the page cannot drift apart.
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim();
  scene.background = new THREE.Color(paper || "#efe9dc");

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

  // The environment lights every face equally, which is what makes an unlit model legible
  // and also what makes it flat: with nothing but ambient light a wall, the roof above it
  // and the slab below are the same value. It is turned down to a fill, and the shape comes
  // from the key light instead.
  //
  // How dark a shadow goes is decided here rather than in the shadow map: a shadow is the
  // absence of the key, so what is left in it is whatever the fill puts there. These are
  // set low against a strong key for that reason.
  scene.environmentIntensity = 0.22;

  // Warm key, cool fill, which is the oldest trick there is for reading form: the two sides
  // of an edge differ in hue as well as in brightness, so the edge survives even where the
  // brightness has nowhere left to go. Against paper the cool fill also keeps the shadows
  // from going muddy -- they read as blue-grey rather than as dirt.
  const key = new THREE.DirectionalLight(0xfff1dc, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);

  /**
   * The ground, which is there to catch shadows and for nothing else.
   *
   * A lit material cannot be the same colour as the background, however carefully the
   * colour is copied across: what a MeshStandardMaterial draws is its colour times the
   * light falling on it, and with a key light at three and a half that lands nowhere near
   * the paper it was meant to match. A ShadowMaterial draws only the shadow and is clear
   * everywhere else, so what shows through it is the background itself -- the right colour
   * by construction rather than by agreement, and it stays right if the paper changes.
   *
   * Where it sits is decided in look(), with the model, because a floor eleven storeys up
   * and a helmet on the origin do not share a ground.
   */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({ opacity: 0.28 }));

  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight(0xcfe0f2, 0x9a8f7d, 0.34));

  // The model lives in here, so emptying it cannot take the lights with it.
  const content = new THREE.Group();
  scene.add(content);

  const loader = new gltf.GLTFLoader();
  const svgLoader = new svg.SVGLoader();

  /**
   * How far two faces have to turn away from each other before the line between them is
   * drawn. A drawing shows the edges of things, not the triangles they are made of: a flat
   * wall is one surface however it was tessellated, and only where it turns -- a corner, a
   * reveal, the lip of a slab -- is there a line to draw.
   */
  const EDGE_ANGLE = 30;

  /**
   * Past this many placed segments the edges are left off.
   *
   * Edges are computed once per distinct geometry but drawn once per placement, so a file
   * that points many nodes at one mesh multiplies them: the electrical model's 332,602
   * distinct segments become 6,478,240 placed ones, which is 148 MB of lines wrapped around
   * 28 MB of building. Below the budget they are worth their weight; above it the drawing
   * costs more than the thing it is drawn on, and the model is better off without.
   */
  const EDGE_BUDGET = 4000000;

  /** Dark grey rather than black: a line that reads as drawn rather than as a hole. */
  const EDGE_COLOUR = 0x5f5a54;

  // --- ambient occlusion ----------------------------------------------------
  // A key light separates surfaces that face different ways, and a converted building is
  // mostly surfaces that face the same way: one wall of a stairwell is the same white as
  // the wall opposite. What tells them apart is how enclosed they are, which is what
  // occlusion measures -- the crease where a slab meets a wall goes dark, the open face
  // stays light, and the model reads as having an inside.

  // --- drawing only when something moved ------------------------------------
  // The old element rotated the model forever, so it redrew sixty times a second whether
  // or not anything had changed. Nothing here draws until it has to.
  let pending = true;
  // What the last model came to, kept for the readout. The renderer's own count includes
  // the shadow pass, which draws the whole scene a second time, so reading it would say a
  // building of thirty-one batches took sixty-two draws.
  let drawn = 0;
  let triangles = 0;
  const invalidate = () => { pending = true; };
  controls.addEventListener("change", invalidate);

  function frame() {
    requestAnimationFrame(frame);
    controls.update();
    if (!pending) return;
    pending = false;

    renderer.render(scene, camera);

    // The count includes the depth pass and the fullscreen passes, so what is reported is
    // the geometry: one draw per batch, which is the number worth watching.
    $("stats").textContent = drawn + (drawn === 1 ? " draw · " : " draws · ")
      + triangles.toLocaleString() + " triangles";
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
   * The drawings a node carries, as geometry.
   *
   * An SVG arrives whole, as the markup it was written as, because that is what it is --
   * a description of a drawing rather than a mesh taken apart into buffers. Turning it
   * into triangles is this renderer's business and nobody else's, so it happens here, at
   * the last moment, with three's own reader.
   *
   * SVG counts y downwards and a scene counts it up, so the whole thing is flipped once
   * rather than every path being corrected.
   */
  function drawingsOn(object) {
    const carried = object.userData?.gltfExtensions?.MOSAIC_components?.components ?? [];
    const drawings = carried.filter(component => component.type === "w3c::svg" && component.value?.svg);
    if (drawings.length === 0) return null;

    // Everything of one colour is gathered and merged, for the same reason the meshes are:
    // a real drawing is not a handful of shapes. A floor plan of this building is 56,798
    // paths, which one mesh apiece makes 77,259 draw calls -- and it is 38 colours, which
    // merged makes 38. What a drawing has a lot of is paths, not palettes.
    const groups = new Map();

    const gather = (geometry, colour, opacity) => {
      if (!geometry || !geometry.attributes.position || geometry.attributes.position.count === 0) return;

      // Merging needs one attribute layout, so what could not merge is kept apart.
      const layout = Object.keys(geometry.attributes).sort().join(",");
      const key = colour.getHexString() + "|" + opacity.toFixed(3) + "|" + layout
        + "|" + (geometry.index ? "indexed" : "flat");

      let group = groups.get(key);
      if (!group) {
        group = { colour, opacity, pieces: [] };
        groups.set(key, group);
      }
      group.pieces.push(geometry);
    };

    for (const drawing of drawings) {
      let parsed;
      try {
        parsed = svgLoader.parse(drawing.value.svg);
      } catch (error) {
        // A drawing that will not parse is one drawing, not the whole model: it is said
        // once and the rest of the file is still worth showing.
        console.warn("mosaic: an svg on " + (object.name ?? "a node") + " could not be read:",
                     error.message ?? error);
        continue;
      }

      for (const path of parsed.paths) {
        // A fill and a stroke are different drawings of the same path; both are wanted.
        const style = path.userData?.style ?? {};

        if (style.fill !== undefined && style.fill !== "none") {
          for (const shape of svg.SVGLoader.createShapes(path)) {
            gather(new THREE.ShapeGeometry(shape), path.color, style.fillOpacity ?? 1);
          }
        }

        if (style.stroke !== undefined && style.stroke !== "none") {
          const colour = new THREE.Color().setStyle(style.stroke);
          for (const piece of path.subPaths) {
            gather(svg.SVGLoader.pointsToStroke(piece.getPoints(), style), colour, style.strokeOpacity ?? 1);
          }
        }
      }
    }

    const group = new THREE.Group();

    for (const { colour, opacity, pieces } of groups.values()) {
      const merged = pieces.length === 1 ? pieces[0] : utils.mergeGeometries(pieces);
      if (!merged) continue;
      if (pieces.length > 1) for (const piece of pieces) piece.dispose();

      group.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({
        color: colour,
        side: THREE.DoubleSide,
        // A drawing is a drawing: it is the colour it says it is, not the colour the
        // lighting would make of it.
        toneMapped: false,
        transparent: opacity < 1,
        opacity,
      })));
    }

    if (group.children.length === 0) return null;

    // Flipped, then placed where its node is.
    group.scale.y = -1;
    group.applyMatrix4(object.matrixWorld);

    return group;
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

    // A drawing hangs off a node that carries no mesh at all, so this pass is its own.
    const drawings = [];
    root.updateMatrixWorld(true);
    root.traverse(object => {
      const drawn = drawingsOn(object);
      if (drawn) drawings.push(drawn);
    });

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

        // A building shadows itself: the slab over a room, the fin beside a window. There
        // is nothing else in the scene for it to fall on.
        batch.castShadow = true;
        batch.receiveShadow = true;

        out.add(batch);
      } catch (error) {
        // A batch that refuses is one this file does not fit. Drawing those meshes one at
        // a time is slow; dropping them would be wrong.
        for (const mesh of group.meshes) {
          const one = new THREE.Mesh(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), mesh.material);
          one.castShadow = true;
          one.receiveShadow = true;
          out.add(one);
        }
      }
    }

    for (const mesh of awkward) {
      const one = new THREE.Mesh(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), mesh.material);
      one.castShadow = true;
      one.receiveShadow = true;
      out.add(one);
    }

    for (const drawing of drawings) out.add(drawing);

    // --- the edges ----------------------------------------------------------
    // Computed per distinct geometry and then placed, which is the same economy the batches
    // make: the same box seen nine times is one set of edges and nine placements of it.
    const edgesOf = new Map();
    let placed = 0;

    for (const mesh of [...groups.values()].flatMap(group => group.meshes).concat(awkward)) {
      let edges = edgesOf.get(mesh.geometry.uuid);
      if (edges === undefined) {
        edges = new THREE.EdgesGeometry(mesh.geometry, EDGE_ANGLE);
        edgesOf.set(mesh.geometry.uuid, edges);
      }
      placed += edges.attributes.position.count / 2;
    }

    let drawnEdges = 0;
    if (placed > 0 && placed <= EDGE_BUDGET) {
      const baked = [];
      for (const mesh of [...groups.values()].flatMap(group => group.meshes).concat(awkward)) {
        const edges = edgesOf.get(mesh.geometry.uuid);
        if (!edges || edges.attributes.position.count === 0) continue;
        baked.push(edges.clone().applyMatrix4(mesh.matrixWorld));
      }

      // One buffer for every line in the model, so the whole drawing is a single call.
      const merged = baked.length === 1 ? baked[0] : utils.mergeGeometries(baked);
      if (baked.length > 1) for (const one of baked) one.dispose();

      if (merged) {
        const lines = new THREE.LineSegments(merged, new THREE.LineBasicMaterial({
          color: EDGE_COLOUR,
          // Not tone mapped: the line is a drawn mark at a chosen weight, and it should be
          // that weight whatever the exposure is doing to the surfaces underneath it.
          toneMapped: false,
        }));
        lines.frustumCulled = false;
        out.add(lines);
        drawnEdges = Math.round(merged.attributes.position.count / 2);
      }
    }

    for (const edges of edgesOf.values()) edges.dispose();

    // The faces are pushed back a hair so the lines sit on them rather than fight them.
    for (const group of groups.values()) {
      group.material.polygonOffset = true;
      group.material.polygonOffsetFactor = 1;
      group.material.polygonOffsetUnits = 1;
    }

    // A batch copies what it is handed and everything else here was cloned, so the file's
    // own buffers are finished with.
    root.traverse(object => { if (object.isMesh && object.geometry) object.geometry.dispose(); });

    // Counted here, where the instances are still to hand: a batch draws its geometry once
    // per placement, which is not something the object can be asked afterwards.
    let drawnTriangles = 0;
    for (const group of groups.values()) {
      for (const mesh of group.meshes) {
        const geometry = mesh.geometry;
        const count = geometry.index ? geometry.index.count : (geometry.attributes.position?.count ?? 0);
        drawnTriangles += count / 3;
      }
    }

    // A drawing is triangles too, once it has been turned into some: they are counted
    // here rather than left out, or the card would call a floor plan empty.
    for (const drawing of drawings) {
      drawing.traverse(one => {
        if (!one.isMesh || !one.geometry) return;
        const geometry = one.geometry;
        const count = geometry.index ? geometry.index.count : (geometry.attributes.position?.count ?? 0);
        drawnTriangles += count / 3;
      });
    }

    out.userData.triangles = Math.round(drawnTriangles);
    out.userData.summary = instances.toLocaleString() + " meshes in " + out.children.length
      + (out.children.length === 1 ? " draw" : " draws")
      + (drawnEdges > 0 ? " · " + drawnEdges.toLocaleString() + " edges"
         : placed > EDGE_BUDGET ? " · edges left off, " + Math.round(placed).toLocaleString() + " is too many"
         : "")
      + (drawings.length > 0
         ? " · " + drawings.length + (drawings.length === 1 ? " drawing" : " drawings")
         : "");

    return out;
  }

  /** Puts the camera where the whole model is in shot, and the clip planes around it. */
  function look(at) {
    // A batch carries its own bounds: its buffers hold each distinct geometry once, at the
    // origin, so measuring it the ordinary way would measure the wrong shape entirely.
    // Everything else here had its world matrix baked in, so its geometry is already
    // where it belongs.
    const box = new THREE.Box3();
    at.updateMatrixWorld(true);

    at.traverse(object => {
      if (object.isBatchedMesh) {
        if (object.boundingBox) box.union(object.boundingBox);
      } else if (object.isMesh && object.geometry) {
        object.geometry.computeBoundingBox();
        // Through the object's own matrix, which is identity for anything whose placement
        // was baked in and is not for a drawing: an svg is positioned by the group it is
        // in, so measuring its geometry where it sits in the file would put it at the
        // origin and leave the camera looking at the wrong place.
        box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
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

    // The key light is placed on the model rather than on the world, so its shadow camera
    // covers exactly what is being looked at. An orthographic box any bigger than the model
    // spends its texels on empty space, and the shadow goes soft and blocky.
    key.target.position.copy(middle);

    // Lower than overhead: at this elevation a shadow is about as long as the thing that
    // casts it, which is what gives a row of columns or a stand of trees any depth. Raise
    // the middle number to lift the sun and shorten them.
    key.position.copy(middle).add(new THREE.Vector3(-0.7, 0.62, 0.5).normalize().multiplyScalar(radius * 2.5));

    // Under the model, and wide enough that a shadow has somewhere to fall. It is clear
    // except where it is shadowed, so its size costs nothing to look at.
    ground.position.set(middle.x, 36, middle.z);
    ground.scale.set(radius * 12, radius * 12, 1);

    // Wider than the model, because a low sun throws a shadow well past it, and a shadow
    // that leaves this box is a shadow that stops in mid air.
    const reach = radius * 2;
    const frustum = key.shadow.camera;
    frustum.left = -reach;
    frustum.right = reach;
    frustum.top = reach;
    frustum.bottom = -reach;
    frustum.near = radius * 0.1;
    frustum.far = radius * 6;
    frustum.updateProjectionMatrix();

    // Both biases scale with the model: a building is tens of metres and a fitting is
    // millimetres, and a bias that suits one stripes or detaches the other.
    key.shadow.normalBias = radius * 0.01;
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
    const model = collapse(file.scene);
    content.add(model);
    look(model);

    // What the card counts is draws, and a drawing is a group of them rather than one.
    drawn = 0;
    model.traverse(one => { if (one.isMesh || one.isLine || one.isLineSegments) drawn++; });
    triangles = model.userData.triangles ?? 0;
    invalidate();

    return { text: model.userData.summary, drawn };
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

    const drawing = await viewer();
    say("drawing " + (bytes.byteLength / 1048576).toFixed(1) + " MB of glb…");
    const summary = await drawing.show(bytes);

    // A selection can be all links and no geometry, which looks like a broken viewer
    // rather than what it is: a part drawing its type's mesh, with compose turned off.
    // What decides it is what came out of the drawing, not what the meshes header said --
    // an SVG is drawable and is not a mesh, so a file can have none and still show.
    if (summary.drawn === 0) {
      say((nodes ? nodes + " nodes, " : "") + "nothing to draw in the answer"
          + (compose() ? "" : " — tick compose if it comes from a type"), true);
      return;
    }

    say((nodes ? nodes + " nodes, " : "") + (meshes ? meshes + " meshes, " : "")
        + bytes.byteLength + " bytes of glb — " + summary.text);
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
