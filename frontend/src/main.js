import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import "./styles/main.css";
import "highlight.js/styles/tokyo-night-dark.css";
const app = createApp(App);
app.config.errorHandler = (err, instance, info) => {
    console.error("Unhandled Vue error:", err, info);
    const event = new CustomEvent("weizhi-global-error", {
        detail: { message: err instanceof Error ? err.message : String(err), info }
    });
    window.dispatchEvent(event);
};
app.use(router).use(i18n).mount("#app");
