<script setup lang="ts">
/**
 * Two editors on one example, side by side, sharing their moves.
 *
 *   <MosaicEditTogether />
 *   <MosaicEditTogether example="helmet" height="380" />
 *   <MosaicEditTogether example="ferrari" credit="Model: www.vecarz.com" />
 *
 * Each is the viewer with `?edit`, in a frame of its own; the frames are on the same origin,
 * so they talk over a BroadcastChannel exactly as two tabs would. Each pair gets a channel
 * of its own, so a second pair on the page -- or the same page in another tab -- does not
 * join in. Nothing loads until the reader clicks the cover.
 *
 * Under the pair is the list of changes made: each editor tells this page of every edit it
 * makes, with the part it moved and the edit's `.tsr`, and each row is coloured for the
 * editor it came from, the way that editor's window is.
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useData, withBase } from "vitepress";

const props = withDefaults(defineProps<{
    example?: string;
    height?: number | string;
    caption?: string;
    /** Who made the model, shown quietly under the caption. */
    credit?: string;
}>(), {
    example: "ferrari",
    height: 360,
});

const loaded = ref(false);
const backdrop = withBase("/issus.webp");
const { theme } = useData();

// Made in the browser, not while the page is built: every page view is its own session.
const channel = ref("");
onMounted(() => { channel.value = "docs-" + Math.random().toString(36).slice(2, 10); });

const SIDES = ["A", "B"] as const;
type Side = typeof SIDES[number];

const src = (side: Side) => {
    const search = new URLSearchParams({ example: props.example, channel: channel.value, me: side });
    return theme.value.viewer + "?" + search.toString() + "&embed&edit";
};

/** One edit made in either editor, as the change list shows it. */
interface Change {
    index: number;
    id: string;
    side: Side;
    label: string;
    /** The message in the edit section's header. */
    message: string;
    /** The edit section's timestamp, as ISO 8601. */
    time: string;
    bytes: number;
    url: string;
    file: string;
}

const changes = ref<Change[]>([]);
/** The list as shown: the newest change on top, each keeping the number it arrived with. */
const newestFirst = computed(() => [...changes.value].reverse());

const fileName = (index: number, label: string) => {
    const slug = label.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "edit";
    return `${props.example}-change-${index}-${slug}.tsr`;
};

// The editors are frames on this origin; anything else posting here is ignored, and so is
// another pair's editor, which has a channel of its own.
const onMessage = (event: MessageEvent) => {
    if (event.origin !== location.origin) return;
    const data = event.data as {
        kind?: unknown; channel?: unknown; id?: unknown; author?: unknown;
        time?: unknown; message?: unknown; label?: unknown; tsr?: unknown;
    } | null;
    if (data?.kind !== "mosaic-edit" || data.channel !== channel.value) return;
    if (!SIDES.includes(data.author as Side) || !(data.tsr instanceof Uint8Array)) return;
    if (typeof data.id !== "string" || changes.value.some(change => change.id === data.id)) return;

    const index = changes.value.length + 1;
    const label = typeof data.label === "string" ? data.label : "";
    changes.value.push({
        index,
        id: data.id,
        side: data.author as Side,
        label,
        message: typeof data.message === "string" ? data.message : "",
        time: typeof data.time === "string" ? data.time : new Date().toISOString(),
        bytes: data.tsr.byteLength,
        url: URL.createObjectURL(new Blob([data.tsr], { type: "application/zip" })),
        file: fileName(index, label),
    });
};

onMounted(() => window.addEventListener("message", onMessage));
onUnmounted(() => {
    window.removeEventListener("message", onMessage);
    for (const change of changes.value) URL.revokeObjectURL(change.url);
});

const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";

/** The time of day, to the second, in the reader's own clock; the full timestamp is its title. */
const clock = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const height = computed(() => {
    const value = String(props.height);
    return /^\d+$/.test(value) ? value + "px" : value;
});
</script>

<template>
  <figure class="mosaic-together">
    <div v-if="loaded" class="pair">
      <div v-for="side in SIDES" :key="side" class="window" :class="'side-' + side">
        <div class="bar">
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="label">Editor {{ side }}</span>
        </div>
        <iframe :src="src(side)" :style="{ height }" :title="'Mosaic editor ' + side + ': ' + example"></iframe>
      </div>
    </div>
    <div v-if="loaded" class="changes">
      <div class="changes-head">
        <span>Changes</span>
        <span class="count">{{ changes.length }}</span>
      </div>
      <p v-if="changes.length === 0" class="empty">No changes yet. Move a part in either editor and it shows up here.</p>
      <table v-else>
        <thead>
          <tr><th class="num">#</th><th>Author</th><th>Message</th><th>Timestamp</th><th class="num">Size</th><th>Log</th></tr>
        </thead>
        <tbody>
          <tr v-for="change in newestFirst" :key="change.id" :class="'side-' + change.side">
            <td class="num index">{{ change.index }}</td>
            <td><span class="who">{{ change.side }}</span></td>
            <td class="message" :title="change.message">{{ change.message || "(no message)" }}</td>
            <td class="time" :title="change.time">{{ clock(change.time) }}</td>
            <td class="num">{{ kb(change.bytes) }}</td>
            <td class="action">
              <a class="download" :href="change.url" :download="change.file" :title="'Download ' + change.file">
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                .tsr
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button
      v-else
      type="button"
      class="cover"
      :style="{ height: `calc(${height} + 31px)`, '--backdrop': `url(${backdrop})` }"
      :aria-label="'Load two editors on the ' + example + ' example'"
      @click="loaded = true"
    >
      <span class="play" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
      </span>
      <span class="title">Click to load two editors</span>
      <span class="name"><code>{{ example }}</code></span>
    </button>
    <figcaption>
      {{ caption ?? "Drag a part in one editor: when you let go, it moves in the other. Select a part and press Delete to remove it from both." }}
      <span v-if="credit" class="credit">{{ credit }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.mosaic-together {
  margin: 16px 0;
  /* One colour per editor: its window, and its rows in the change list. */
  --side-A: #16867c;
  --side-B: #d1603d;
}
.side-A { --side: var(--side-A); }
.side-B { --side: var(--side-B); }

/* Two separate windows with room between them, so they read as two applications rather
   than two halves of one. */
.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}
@media (max-width: 640px) {
  .pair { grid-template-columns: 1fr; gap: 20px; }
}
.window, .cover {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 6px 24px rgba(40, 30, 10, 0.12), 0 1px 3px rgba(40, 30, 10, 0.08);
}
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  padding: 0 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}
.dots { display: flex; gap: 6px; }
.dots i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--vp-c-divider);
}
.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.window[class*="side-"] { border-color: color-mix(in srgb, var(--side) 55%, var(--vp-c-divider)); }
.window[class*="side-"] .bar {
  background: color-mix(in srgb, var(--side) 14%, var(--vp-c-bg-alt));
  border-bottom-color: color-mix(in srgb, var(--side) 40%, var(--vp-c-divider));
}
.window[class*="side-"] .dots i:first-child { background: var(--side); }
.window[class*="side-"] .label { color: var(--side); }

.changes {
  margin-top: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.changes-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--vp-c-default-soft);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.empty {
  margin: 0;
  padding: 14px 12px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
/* VitePress styles every table in a page; this one is undone back to plain rows. */
.changes table {
  display: table;
  width: 100%;
  margin: 0;
  border-collapse: collapse;
  font-size: 13px;
}
.changes th, .changes td {
  padding: 6px 12px;
  border: 0;
  border-top: 1px solid var(--vp-c-divider);
  text-align: left;
}
.changes thead th {
  border-top: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
  background: transparent;
}
.changes tr { background: transparent; }
.changes tbody tr {
  background: color-mix(in srgb, var(--side) 9%, transparent);
  box-shadow: inset 3px 0 0 var(--side);
}
.changes .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.changes .index { width: 1%; color: var(--vp-c-text-2); }
.who {
  display: inline-block;
  min-width: 22px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--side);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}
.message { word-break: break-word; }
.time { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--vp-c-text-2); }
.action { width: 1%; white-space: nowrap; }
.download {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--side) 50%, var(--vp-c-divider));
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--side);
  text-decoration: none;
  background: var(--vp-c-bg);
}
.download:hover { background: color-mix(in srgb, var(--side) 12%, var(--vp-c-bg)); }
iframe {
  display: block;
  width: 100%;
  border: 0;
  background: #efe9dc;
}
.cover {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  cursor: pointer;
  color: var(--vp-c-text-1);
  background: #efe9dc;
  isolation: isolate;
}
.cover::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(color-mix(in srgb, var(--vp-c-bg-soft) 78%, transparent),
                    color-mix(in srgb, var(--vp-c-bg-soft) 78%, transparent)),
    var(--backdrop) center / cover no-repeat;
  filter: saturate(0.7);
  transition: transform 0.4s ease;
}
.cover:hover::before { transform: scale(1.03); }
.play {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  padding-left: 3px;
  border-radius: 50%;
  color: #fff;
  background: var(--vp-c-brand-1);
  box-shadow: 0 2px 10px rgba(22, 134, 124, 0.35);
  transition: transform 0.15s ease, background-color 0.15s ease;
}
.cover:hover .play { transform: scale(1.08); background: var(--vp-c-brand-2); }
.cover:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: -4px; }
.title { font-weight: 600; font-size: 15px; }
.name { font-size: 13px; color: var(--vp-c-text-2); }
/* There to say who made the model, not to be noticed. */
.credit {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
figcaption {
  margin-top: 12px;
  font-size: 13px;
  text-align: center;
  color: var(--vp-c-text-2);
}
</style>
