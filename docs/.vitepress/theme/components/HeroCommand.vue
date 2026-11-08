<script setup lang="ts">
/**
 * A command line under the hero title, with a button that copies it.
 */
import { ref } from "vue";

const props = withDefaults(defineProps<{ command?: string }>(), {
    command: "npx @tomvandig/mosaic pack https://tomvandig.github.io/mosaic/dist/docs/models/DamagedHelmet.glb",
});

const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy() {
    try {
        await navigator.clipboard.writeText(props.command);
    } catch {
        // No clipboard API (an insecure context, an old browser): select the text instead,
        // so a Ctrl+C still gets it.
        const text = document.querySelector(".hero-command code");
        if (text) {
            const range = document.createRange();
            range.selectNodeContents(text);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
        return;
    }
    copied.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied.value = false), 1600);
}
</script>

<template>
  <div class="hero-command">
    <span class="prompt" aria-hidden="true">$</span>
    <code>{{ command }}</code>
    <button
      type="button"
      class="copy"
      :class="{ copied }"
      :aria-label="copied ? 'Copied' : 'Copy command'"
      :title="copied ? 'Copied' : 'Copy'"
      @click="copy"
    >
      <svg v-if="!copied" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4"
          stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.hero-command {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  margin-top: 20px;
  padding: 8px 8px 8px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: color-mix(in srgb, var(--mosaic-panel) 94%, transparent);
  box-shadow: 0 1px 2px rgba(51, 50, 45, 0.08);
  font-family: var(--vp-font-family-mono);
  font-size: 15px;
}
.prompt {
  color: var(--vp-c-text-3);
  user-select: none;
}
code {
  overflow-x: auto;
  white-space: nowrap;
  color: var(--vp-c-text-1);
  background: none;
  padding: 0;
  font-size: inherit;
}
.copy {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 1px solid transparent;
  color: var(--vp-c-text-2);
  transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}
.copy:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-divider);
}
.copy.copied {
  color: var(--vp-c-brand-1);
}

@media (max-width: 959px) {
  /* The hero centres its text on narrow screens. */
  .hero-command { margin-left: auto; margin-right: auto; }
}
</style>
