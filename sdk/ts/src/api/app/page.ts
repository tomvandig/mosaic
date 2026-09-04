/**
 * The page `mosaic serve` puts at `/`.
 *
 * It is a string rather than a file so that it survives being bundled into the CLI's
 * single executable, where there is no directory to read from. The 3D view is
 * `<model-viewer>`, Google's glTF viewer element, which brings PBR materials, textures
 * and image-based lighting with it -- that is the "default viewer, extended" rather than
 * a renderer written here. It is loaded from a CDN, so the 3D panel needs the machine to
 * have internet; everything else works without it.
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
  main { display: grid; grid-template-columns: 300px 1fr 340px; min-height: 0; }
  section { min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--line); }
  section:last-child { border-right: 0; }
  h2 {
    margin: 0; padding: 8px 12px; font-size: 11px; text-transform: uppercase;
    letter-spacing: .09em; color: var(--dim); border-bottom: 1px solid var(--line);
  }
  .scroll { overflow: auto; padding: 6px 0; flex: 1; }
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
  .status { margin-left: auto; color: var(--dim); }
  .status[data-error=true] { color: var(--warn); }
</style>
</head>
<body>
<header>
  <h1>Mosaic</h1>
  <label>upload <input id="file" type="file" accept=".tsr" multiple></label>
  <label>tessera
    <select id="tessera"></select>
  </label>
  <label>version
    <select id="version"></select>
  </label>
  <label title="Resolve inheritance before answering, the way composing does">
    <input id="compose" type="checkbox"> compose
  </label>
  <button id="whole">Show whole version</button>
  <span class="status" id="status"></span>
</header>

<main>
  <section>
    <h2>Tree</h2>
    <div class="scroll" id="tree"><p class="empty">Upload a .tsr to begin.</p></div>
  </section>
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
const state = { scene: null, selected: null, expanded: new Set() };

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

// --- what the server holds -------------------------------------------------

async function loadTesserae(pick) {
  const tesserae = await (await call("/app/tesserae")).json();
  const select = $("tessera");
  select.innerHTML = "";

  for (const tessera of tesserae) {
    const option = document.createElement("option");
    option.value = tessera.id;
    option.textContent = tessera.name + " (" + tessera.versions.length + ")";
    select.append(option);
  }

  if (pick) select.value = pick;
  state.tesserae = tesserae;
  loadVersions();
}

function loadVersions(pick) {
  const tessera = state.tesserae?.find(candidate => candidate.id === $("tessera").value);
  const select = $("version");
  select.innerHTML = "";

  for (const version of tessera?.versions ?? []) {
    const option = document.createElement("option");
    option.value = version.versionId;
    option.textContent = version.message || version.versionId.slice(0, 8);
    select.append(option);
  }

  if (pick) select.value = pick;
  if (select.value) loadScene();
}

// --- the tree, out of one selection ---------------------------------------

async function loadScene() {
  const tesseraId = $("tessera").value;
  const versionId = $("version").value;
  if (!tesseraId || !versionId) return;

  say("reading…");
  try {
    const query = new URLSearchParams({ tesseraId, versionId, compose: String(compose()) });
    state.scene = await (await call("/app/scene?" + query)).json();
    state.selected = null;

    drawTree();
    $("components").innerHTML = '<p class="empty">Select a node.</p>';
    say(state.scene.roots.length + " roots, " + Object.keys(state.scene.nodes).length + " nodes");
  } catch (error) {
    say(String(error.message ?? error), true);
  }
}

function labelOf(node) {
  return node.name ?? node.id.slice(0, 8) + "…";
}

function drawTree() {
  const tree = $("tree");
  tree.innerHTML = "";

  if (!state.scene?.roots.length) {
    tree.innerHTML = '<p class="empty">Nothing in this version.</p>';
    return;
  }

  const draw = (id, depth, seen) => {
    const node = state.scene.nodes[id];
    if (!node) return document.createDocumentFragment();

    const fragment = document.createDocumentFragment();
    const row = document.createElement("div");
    row.className = "node";
    row.style.paddingLeft = 12 + depth * 14 + "px";
    row.setAttribute("aria-selected", String(state.selected === id));
    row.title = id;

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
    row.onclick = () => select(id);
    fragment.append(row);

    // A node placed in two spots appears twice; stop if it contains itself.
    if (open && !seen.has(id)) {
      const beneath = new Set(seen).add(id);
      const kids = document.createElement("div");
      kids.className = "kids";
      for (const child of children) kids.append(draw(child, depth + 1, beneath));
      fragment.append(kids);
    }

    return fragment;
  };

  for (const root of state.scene.roots) tree.append(draw(root, 0, new Set()));
}

// --- the panels ------------------------------------------------------------

function select(id) {
  state.selected = id;
  state.expanded.add(id);
  drawTree();
  drawComponents(id);
  show([id]);
}

function drawComponents(id) {
  const node = state.scene?.nodes[id];
  const panel = $("components");
  panel.innerHTML = "";

  if (!node) return;

  const header = document.createElement("div");
  header.className = "component";
  header.innerHTML = '<div class="type">' + labelOf(node) + '</div><div class="ref">' + node.id + "</div>";
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

/** Asks the real API for a GLB of these nodes and puts it in the viewer. */
async function show(nodes) {
  const tesseraId = $("tessera").value;
  const versionId = $("version").value;
  if (!tesseraId || !versionId || nodes.length === 0) return;

  say("building glb…");
  try {
    const response = await call(
      "/Mosaic-api/tesserae/" + tesseraId + "/versions/" + versionId + "/nodes?format=glb",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodes, includeChildren: true, compose: compose() }),
      });

    const blob = await response.blob();
    const viewer = $("viewer");
    if (viewer.dataset.url) URL.revokeObjectURL(viewer.dataset.url);
    viewer.dataset.url = URL.createObjectURL(blob);
    viewer.src = viewer.dataset.url;

    say(response.headers.get("x-mosaic-nodes") + " nodes, " + blob.size + " bytes of glb");
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
    } catch (error) {
      say(file.name + ": " + (error.message ?? error), true);
      return;
    }
  }

  event.target.value = "";
  await loadTesserae(last?.tesseraId);
  if (last) { $("version").value = last.versionId; loadScene(); }
};

$("tessera").onchange = () => loadVersions();
$("version").onchange = () => loadScene();
$("compose").onchange = () => { loadScene(); if (state.selected) show([state.selected]); };
$("whole").onclick = () => { if (state.scene) show(state.scene.roots); };

loadTesserae();
</script>
</body>
</html>
`;
