<script setup lang="ts">
/**
 * The Mosaic viewer, inline in a page.
 *
 *   <MosaicViewer example="typed-boxes" />
 *   <MosaicViewer example="s1" height="520" caption="…" />
 *   <MosaicViewer example="helmet" files />      the archive's files open beneath it
 *
 * `example` is an id from the viewer's examples/index.json. Nothing is fetched until the
 * reader clicks the cover: an example can be tens of megabytes, and a page holding a few
 * of them should cost nothing to open. `autoload` skips the cover.
 */
import { computed, ref } from "vue";
import { useData, withBase } from "vitepress";

const props = withDefaults(defineProps<{
    example: string;
    height?: number | string;
    files?: boolean;
    caption?: string;
    autoload?: boolean;
}>(), {
    height: 420,
    files: false,
    autoload: false,
});

const loaded = ref(props.autoload);
const backdrop = withBase("/issus.webp");

const { theme } = useData();

const query = computed(() => {
    const search = new URLSearchParams({ example: props.example });
    if (props.files) search.set("files", "1");
    return search.toString();
});

const embedded = computed(() => theme.value.viewer + "?" + query.value + "&embed");
const full = computed(() => theme.value.viewer + "?" + query.value);
const height = computed(() => {
    const value = String(props.height);
    return /^\d+$/.test(value) ? value + "px" : value;
});
</script>

<template>
  <figure class="mosaic-viewer">
    <iframe
      v-if="loaded"
      :src="embedded"
      :style="{ height }"
      :title="'Mosaic viewer: ' + example"
      allow="fullscreen"
    ></iframe>
    <button
      v-else
      type="button"
      class="cover"
      :style="{ height, '--backdrop': `url(${backdrop})` }"
      :aria-label="'Load the ' + example + ' example in the viewer'"
      @click="loaded = true"
    >
      <span class="play" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
      </span>
      <span class="label">Click to load the 3D example</span>
      <span class="name"><code>{{ example }}</code></span>
    </button>
    <figcaption>
      <span v-if="caption" class="caption">{{ caption }}</span>
      <span v-else class="caption"><code>{{ example }}</code></span>
      <a :href="full" target="_blank" rel="noopener">Open in viewer ↗</a>
    </figcaption>
  </figure>
</template>

<style scoped>
.mosaic-viewer {
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
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
  overflow: hidden;
}
/* The mosaic, faint, so the cover reads as a picture waiting rather than an empty box. */
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
.label { font-weight: 600; font-size: 15px; }
.name { font-size: 13px; color: var(--vp-c-text-2); }

figcaption {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  border-top: 1px solid var(--vp-c-divider);
}
figcaption a {
  white-space: nowrap;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
figcaption a:hover { text-decoration: underline; }

/* A viewer straight after a code group reads as that code's result. */
:global(.vp-code-group + .mosaic-viewer) { margin-top: -8px; }
</style>
