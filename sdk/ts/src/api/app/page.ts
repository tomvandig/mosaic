/**
 * The page `mosaic serve` puts at `/`.
 *
 * It is a string rather than a file so that it survives being bundled into the CLI's
 * single executable, where there is no directory to read from. The 3D view is
 * `<model-viewer>`, Google's glTF viewer element, which brings PBR materials, textures
 * and image-based lighting with it -- that is the "default viewer, extended" rather than
 * a renderer written here. It is loaded from a CDN, so the 3D panel needs the machine to
 * have internet; everything else works without it.
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
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
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
  model-viewer { width: 100%; height: 100%; background: #0e1014; }
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
  <label title="Resolve inheritance before answering, the way composing does">
    <input id="compose" type="checkbox"> compose
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
    <h2>3D</h2>
    <model-viewer id="viewer" camera-controls auto-rotate shadow-intensity="1"
                  environment-image="neutral" exposure="1.1" tone-mapping="neutral"></model-viewer>
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

async function intoViewer(saying, pending) {
  say(saying);
  try {
    const response = await pending;
    const blob = await response.blob();

    const viewer = $("viewer");
    if (viewer.dataset.url) URL.revokeObjectURL(viewer.dataset.url);
    viewer.dataset.url = URL.createObjectURL(blob);
    viewer.src = viewer.dataset.url;

    const nodes = response.headers.get("x-mosaic-nodes");
    say((nodes ? nodes + " nodes, " : "") + blob.size + " bytes of glb");
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
