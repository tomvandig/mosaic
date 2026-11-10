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
 */
import { computed, onMounted, ref } from "vue";
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

const src = computed(() => {
    const search = new URLSearchParams({ example: props.example, channel: channel.value });
    return theme.value.viewer + "?" + search.toString() + "&embed&edit";
});

const height = computed(() => {
    const value = String(props.height);
    return /^\d+$/.test(value) ? value + "px" : value;
});
</script>

<template>
  <figure class="mosaic-together">
    <div v-if="loaded" class="pair">
      <div v-for="side in ['A', 'B']" :key="side" class="window">
        <div class="bar">
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="label">Editor {{ side }}</span>
        </div>
        <iframe :src="src" :style="{ height }" :title="'Mosaic editor ' + side + ': ' + example"></iframe>
      </div>
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
      {{ caption ?? "Drag a part in one editor: when you let go, it moves in the other." }}
      <span v-if="credit" class="credit">{{ credit }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.mosaic-together { margin: 16px 0; }

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
