import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import MosaicViewer from "./components/MosaicViewer.vue";
import "./style.css";

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component("MosaicViewer", MosaicViewer);
    },
} satisfies Theme;
