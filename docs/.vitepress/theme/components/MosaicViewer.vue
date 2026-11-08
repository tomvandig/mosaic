<script setup lang="ts">
/**
 * The Mosaic viewer, inline in a page.
 *
 *   <MosaicViewer example="typed-boxes" />
 *   <MosaicViewer example="s1" height="520" caption="…" />
 *   <MosaicViewer example="helmet" files />      the archive's files open beneath it
 *
 * `example` is an id from the viewer's examples/index.json. The frame loads only when it
 * scrolls into view, so a page with several of them does not fetch them all up front.
 */
import { computed } from "vue";
import { useData } from "vitepress";

const props = withDefaults(defineProps<{
    example: string;
    height?: number | string;
    files?: boolean;
    caption?: string;
}>(), {
    height: 420,
    files: false,
});

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
      :src="embedded"
      :style="{ height }"
      :title="'Mosaic viewer: ' + example"
      loading="lazy"
      allow="fullscreen"
    ></iframe>
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
