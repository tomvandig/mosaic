import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import MosaicViewer from "./components/MosaicViewer.vue";
import HeroCommand from "./components/HeroCommand.vue";
import "./style.css";

export default {
    extends: DefaultTheme,
    // The home page's hero gets a command line to copy, where the tagline would be.
    Layout: () => h(DefaultTheme.Layout, null, {
        "home-hero-info-after": () => h(HeroCommand),
    }),
    enhanceApp({ app }) {
        app.component("MosaicViewer", MosaicViewer);
        app.component("HeroCommand", HeroCommand);
    },
} satisfies Theme;
