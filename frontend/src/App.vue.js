/// <reference types="../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
// i18n refactor completed
import { computed, ref, onMounted, onBeforeUnmount, nextTick, provide, watch } from "vue";
import { useI18n } from "vue-i18n";
import { marked } from "marked";
import hljs from "highlight.js";
import AppBackground from './components/layout/AppBackground.vue';
import FloatingSidebar from './components/layout/FloatingSidebar.vue';
import FloatingMainPanel from './components/layout/FloatingMainPanel.vue';
import TranslationView from './components/chat/TranslationView.vue';
import { systemApi, settingsApi, chatApi, deepSeekApi, openaiApi, geminiApi, imageApi, ttsApi, dataManagementApi, documentApi } from "./utils/api";
import { resolveApiUrl } from "./utils/urlUtils";
import { Terminal, Send, Trash2, Cpu, Image as ImageIcon, Volume2, FileText, RefreshCw, BookOpen, Activity, FolderOpen, Star, Download, X, ChevronDown, ChevronUp, Square, Copy, Check } from "lucide-vue-next";
const logs = ref([]);
const logEntries = ref([]);
const logLevel = ref("");
const logQuery = ref("");
const logLoading = ref(false);
const logContainer = ref(null);
const { t, locale } = useI18n();
const setLang = (lang) => {
    locale.value = lang;
    localStorage.setItem("weizhi.locale", lang);
};
const currentTheme = ref("midnight");
const setTheme = (theme) => {
    currentTheme.value = theme;
    localStorage.setItem("weizhi.theme", theme);
    document.body.className = theme === "midnight" ? "" : `theme-${theme}`;
};
const activeProvider = ref("minimax");
const activeView = ref("home");
const minimaxMessages = ref([]);
const deepSeekMessages = ref([]);
const openaiMessages = ref([]);
const geminiMessages = ref([]);
const chatSessions = ref([]);
const activeSessionIds = ref({ minimax: "", deepseek: "", openai: "", gemini: "" });
const taskQueue = ref([]);
const notifications = ref([]);
const inputText = ref("");
const geminiMode = ref("auto");
const selectedGeminiModel = ref("auto");
const showModelDropdown = ref(false);
const selectModel = (modelId) => {
    selectedGeminiModel.value = modelId;
    showModelDropdown.value = false;
};
const closeModelDropdown = () => {
    showModelDropdown.value = false;
};
const formatModelInfo = (id) => {
    const lowercaseId = id.toLowerCase();
    let displayName = id;
    let badgeText = "Pro";
    let badgeClass = "badge-pro";
    let description = "通用大语言模型";
    // ── Claude ──────────────────────────────────────────────────────
    if (lowercaseId.includes("claude-opus-4") || lowercaseId.includes("claude-4-opus")) {
        displayName = "Claude Opus 4";
        badgeText = "Opus";
        badgeClass = "badge-thinking";
        description = "顶级推理 / 复杂任务旗舰";
    }
    else if (lowercaseId.includes("claude-opus")) {
        displayName = "Claude Opus";
        badgeText = "Opus";
        badgeClass = "badge-thinking";
        description = "高阶逻辑 / 复杂推理";
    }
    else if (lowercaseId.includes("claude-sonnet-4") || lowercaseId.includes("claude-4-sonnet")
        || lowercaseId.includes("claude-3-5-sonnet-20241022")) {
        displayName = "Claude Sonnet 4";
        badgeText = "Sonnet";
        badgeClass = "badge-thinking";
        description = "高阶逻辑 / 复杂编程";
    }
    else if (lowercaseId.includes("claude-3-5-sonnet-20240620") || lowercaseId.includes("claude-sonnet-3")) {
        displayName = "Claude Sonnet 3.5";
        badgeText = "Sonnet";
        badgeClass = "badge-thinking";
        description = "复杂逻辑与推理";
    }
    else if (lowercaseId.includes("claude-sonnet")) {
        displayName = "Claude Sonnet";
        badgeText = "Sonnet";
        badgeClass = "badge-thinking";
        description = "高阶逻辑 / 复杂推理";
    }
    else if (lowercaseId.includes("claude-haiku-4") || lowercaseId.includes("claude-4-haiku")) {
        displayName = "Claude Haiku 4";
        badgeText = "Fast";
        badgeClass = "badge-fast";
        description = "极速日常问答 (新版)";
    }
    else if (lowercaseId.includes("claude-3-5-haiku") || lowercaseId.includes("claude-haiku-3")) {
        displayName = "Claude Haiku 3.5";
        badgeText = "Fast";
        badgeClass = "badge-fast";
        description = "极速日常问答";
    }
    else if (lowercaseId.includes("claude-haiku")) {
        displayName = "Claude Haiku";
        badgeText = "Fast";
        badgeClass = "badge-fast";
        description = "极速日常问答";
    }
    else if (lowercaseId.includes("claude-3-7")) {
        displayName = "Claude 3.7";
        badgeText = "Pro";
        badgeClass = "badge-pro";
        description = "高阶综合推理";
    }
    else if (lowercaseId.includes("claude-3-opus")) {
        displayName = "Claude 3 Opus";
        badgeText = "Opus";
        badgeClass = "badge-opus";
        description = "高阶推理 / 复杂分析";
    }
    else if (lowercaseId.includes("claude-3-haiku")) {
        displayName = "Claude 3 Haiku";
        badgeText = "Fast";
        badgeClass = "badge-fast";
        description = "经典极速问答";
    }
    else if (lowercaseId.includes("claude-3-sonnet")) {
        displayName = "Claude 3 Sonnet";
        badgeText = "Sonnet";
        badgeClass = "badge-thinking";
        description = "经典综合推理";
        // ── DeepSeek ──────────────────────────────────────────────────────
    }
    else if (lowercaseId.includes("deepseek-reasoner") || lowercaseId.includes("deepseek-r1")) {
        displayName = "DeepSeek R1";
        badgeText = "Thinking";
        badgeClass = "badge-thinking";
        description = "深度思考与长链推理";
    }
    else if (lowercaseId.includes("deepseek-chat") || lowercaseId.includes("deepseek-v3")) {
        displayName = "DeepSeek V3 / Chat";
        badgeText = "Pro";
        badgeClass = "badge-pro";
        description = "极高性价比综合分析";
        // ── GPT / OpenAI ──────────────────────────────────────────────────
    }
    else if (lowercaseId.includes("o1-mini") || lowercaseId === "o1-mini") {
        displayName = "GPT o1 Mini";
        badgeText = "Think";
        badgeClass = "badge-thinking";
        description = "轻量推理模型";
    }
    else if (lowercaseId.startsWith("o1") || lowercaseId === "o1") {
        displayName = "GPT o1";
        badgeText = "Think";
        badgeClass = "badge-thinking";
        description = "深度推理旗舰";
    }
    else if (lowercaseId.startsWith("o3-mini") || lowercaseId === "o3-mini") {
        displayName = "GPT o3 Mini";
        badgeText = "Think";
        badgeClass = "badge-thinking";
        description = "高效推理模型";
    }
    else if (lowercaseId.startsWith("o3") || lowercaseId === "o3") {
        displayName = "GPT o3";
        badgeText = "Think";
        badgeClass = "badge-thinking";
        description = "高阶推理旗舰";
    }
    else if (lowercaseId.startsWith("o4-mini")) {
        displayName = "GPT o4 Mini";
        badgeText = "Think";
        badgeClass = "badge-thinking";
        description = "新一代轻量推理";
    }
    else if (lowercaseId.startsWith("o4")) {
        displayName = "GPT o4";
        badgeText = "Think";
        badgeClass = "badge-thinking";
        description = "新一代旗舰推理";
    }
    else if (lowercaseId.includes("gpt-4o-mini")) {
        displayName = "GPT-4o Mini";
        badgeText = "Fast";
        badgeClass = "badge-fast";
        description = "高性价比极速文本响应";
    }
    else if (lowercaseId.includes("gpt-4o")) {
        displayName = "GPT-4o";
        badgeText = "Pro";
        badgeClass = "badge-pro";
        description = "强力多模态 / 综合问答";
    }
    else if (lowercaseId.includes("gpt-4.1-mini")) {
        displayName = "GPT-4.1 Mini";
        badgeText = "Fast";
        badgeClass = "badge-fast";
        description = "高性价比新版";
    }
    else if (lowercaseId.includes("gpt-4.1")) {
        displayName = "GPT-4.1";
        badgeText = "Pro";
        badgeClass = "badge-pro";
        description = "新版综合旗舰";
    }
    else if (lowercaseId.includes("gpt-4-turbo")) {
        displayName = "GPT-4 Turbo";
        badgeText = "Pro";
        badgeClass = "badge-pro";
        description = "强力综合推理";
    }
    else if (lowercaseId.includes("gpt-4")) {
        displayName = "GPT-4";
        badgeText = "Pro";
        badgeClass = "badge-pro";
        description = "经典强力模型";
    }
    else if (lowercaseId.includes("gpt-3.5")) {
        displayName = "GPT-3.5";
        badgeText = "Fast";
        badgeClass = "badge-fast";
        description = "高性价比快速响应";
        // ── Gemini ──────────────────────────────────────────────────────
    }
    else if (lowercaseId.includes("gemini-3.1-pro-high") || lowercaseId.includes("gemini-3-pro") || lowercaseId.includes("gemini-1.5-pro")) {
        displayName = "Gemini Pro";
        badgeText = "Pro";
        badgeClass = "badge-pro";
        description = "大容量多模态分析";
    }
    else if (lowercaseId.includes("gemini-2.5-pro") || lowercaseId.includes("gemini-2.5")) {
        displayName = "Gemini 2.5 Pro";
        badgeText = "Pro";
        badgeClass = "badge-pro";
        description = "新一代多模态旗舰";
    }
    else if (lowercaseId.includes("gemini-2.0")) {
        displayName = "Gemini 2.0";
        badgeText = "Pro";
        badgeClass = "badge-pro";
        description = "多模态推理";
    }
    else if (lowercaseId.includes("gemini-3-flash") || lowercaseId.includes("gemini-1.5-flash")) {
        displayName = "Gemini Flash";
        badgeText = "Fast";
        badgeClass = "badge-fast";
        description = "日常多模态极速问答";
    }
    else if (lowercaseId.includes("gemini-2.5-flash")) {
        displayName = "Gemini 2.5 Flash";
        badgeText = "Fast";
        badgeClass = "badge-fast";
        description = "新一代极速多模态";
    }
    else {
        // Generic fallback: format ID as readable name
        // e.g. "gpt-oss-120b-medium" → "Gpt Oss 120b"
        displayName = id
            .replace(/[-_]/g, ' ')
            .split(' ')
            .slice(0, 3) // take first 3 words max
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        badgeText = "AI";
        badgeClass = "badge-pro";
        description = "中转自定义模型";
    }
    return { displayName, badgeText, badgeClass, description };
};
const isThinking = ref(false);
const chatAbortController = ref(null);
const copiedIndex = ref(null);
const chatContainer = ref(null);
const expandedThinks = ref({});
const toggleThink = (key) => {
    expandedThinks.value[key] = !expandedThinks.value[key];
};
// Custom renderer to add copy buttons and language headers to code blocks!
const markedRenderer = new marked.Renderer();
markedRenderer.code = (arg1, arg2) => {
    let text = "";
    let lang = "";
    if (typeof arg1 === "object" && arg1 !== null) {
        text = arg1.text || "";
        lang = arg1.lang || "";
    }
    else {
        text = String(arg1 || "");
        lang = String(arg2 || "");
    }
    const language = lang || "plaintext";
    const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
    const highlighted = hljs.highlight(text, { language: validLanguage }).value;
    return `
    <div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-lang">${validLanguage}</span>
        <button class="code-copy-btn" onclick="window.weizhiCopyCode(this)">
          <svg class="copy-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span class="copy-text">复制</span>
        </button>
      </div>
      <pre class="hljs"><code class="language-${validLanguage}">${highlighted}</code></pre>
    </div>
  `;
};
// Set options
marked.setOptions({
    renderer: markedRenderer,
    gfm: true,
    breaks: true
});
// Register code copy handler globally
window.weizhiCopyCode = (btn) => {
    const pre = btn.parentElement?.nextElementSibling;
    if (!pre)
        return;
    const code = pre.querySelector("code")?.innerText || "";
    navigator.clipboard.writeText(code).then(() => {
        const textSpan = btn.querySelector(".copy-text");
        if (textSpan)
            textSpan.textContent = "已复制";
        btn.classList.add("copied");
        setTimeout(() => {
            if (textSpan)
                textSpan.textContent = "复制";
            btn.classList.remove("copied");
        }, 2000);
    });
};
const renderMarkdown = (text) => {
    if (!text)
        return "";
    try {
        return marked.parse(text);
    }
    catch (err) {
        console.error("Failed to parse markdown:", err);
        return text;
    }
};
const parseMessageContent = (content) => {
    if (!content)
        return [];
    const blocks = [];
    let remaining = content;
    while (remaining) {
        const thinkStart = remaining.indexOf("<think>");
        if (thinkStart !== -1) {
            if (thinkStart > 0) {
                blocks.push({
                    type: "text",
                    content: remaining.substring(0, thinkStart)
                });
            }
            const thinkEnd = remaining.indexOf("</think>", thinkStart + 7);
            if (thinkEnd !== -1) {
                blocks.push({
                    type: "think",
                    content: remaining.substring(thinkStart + 7, thinkEnd)
                });
                remaining = remaining.substring(thinkEnd + 8);
            }
            else {
                blocks.push({
                    type: "think",
                    content: remaining.substring(thinkStart + 7)
                });
                remaining = "";
            }
        }
        else {
            blocks.push({
                type: "text",
                content: remaining
            });
            remaining = "";
        }
    }
    return blocks;
};
const imageHistories = ref([]);
const ttsHistories = ref([]);
const documents = ref([]);
const selectedDocIds = ref([]);
const voices = ref([]);
const activeVoiceTab = ref("中文男声");
const isChineseFemale = (v) => {
    if (v.category !== "中文")
        return false;
    const str = (v.name + " " + (v.description || "") + " " + v.voiceId).toLowerCase();
    return /female|girl|woman|lady|miss|aunt|sister|女|姐|妹|奶|婶|妈|shaonv|yujie|chengshu|tianmei|xiaoling|mengmei|xuemei|xuejie|\(f\)|小琪/i.test(str);
};
const voiceTabs = ["中文男声", "中文女声", "日文", "英文", "备选音色"];
const voiceTabCounts = computed(() => {
    return {
        "中文男声": voices.value.filter(v => v.category === "中文" && !isChineseFemale(v)).length,
        "中文女声": voices.value.filter(v => isChineseFemale(v)).length,
        "日文": voices.value.filter(v => v.category === "日文").length,
        "英文": voices.value.filter(v => v.category === "英文").length,
        "备选音色": voices.value.filter(v => v.category !== "中文" && v.category !== "日文" && v.category !== "英文").length,
    };
});
const filteredVoices = computed(() => {
    if (activeVoiceTab.value === "中文男声") {
        return voices.value.filter(v => v.category === "中文" && !isChineseFemale(v));
    }
    else if (activeVoiceTab.value === "中文女声") {
        return voices.value.filter(v => isChineseFemale(v));
    }
    else if (activeVoiceTab.value === "日文") {
        return voices.value.filter(v => v.category === "日文");
    }
    else if (activeVoiceTab.value === "英文") {
        return voices.value.filter(v => v.category === "英文");
    }
    else {
        // 备选音色
        return voices.value.filter(v => v.category !== "中文" && v.category !== "日文" && v.category !== "英文");
    }
});
const previewText = ref(t("home.previewText"));
const previewVoiceId = ref("male-qn-qingse");
const previewFormat = ref("mp3");
const previewSpeed = ref(1);
const previewVol = ref(1);
const previewPitch = ref(0);
const previewSampleRate = ref(32000);
const previewBitrate = ref(128000);
const previewAudioUrl = ref("");
const generateAudioUrl = ref("");
const previewLoading = ref(false);
const generateLoading = ref(false);
const shortExamples = computed(() => [
    { label: t("speech.exShort1"), text: t("speech.exShort1Text") },
    { label: t("speech.exShort2"), text: t("speech.exShort2Text") },
    { label: t("speech.exShort3"), text: t("speech.exShort3Text") },
    { label: t("speech.exShort4"), text: t("speech.exShort4Text") },
    { label: t("speech.exShort5"), text: t("speech.exShort5Text") },
    { label: t("speech.exShort6"), text: t("speech.exShort6Text") },
    { label: t("speech.exShort7"), text: t("speech.exShort7Text") },
    { label: t("speech.exShort8"), text: t("speech.exShort8Text") }
]);
const longExamples = computed(() => [
    { label: t("speech.exLong1"), text: t("speech.exLong1Text") },
    { label: t("speech.exLong2"), text: t("speech.exLong2Text") },
    { label: t("speech.exLong3"), text: t("speech.exLong3Text") },
    { label: t("speech.exLong4"), text: t("speech.exLong4Text") },
    { label: t("speech.exLong5"), text: t("speech.exLong5Text") },
    { label: t("speech.exLong6"), text: t("speech.exLong6Text") }
]);
const deepSeekBalance = ref(null);
const deepSeekUsage = ref(null);
const accountLoading = ref(false);
const settingsLoading = ref(false);
const settingsState = ref({});
const geminiCapabilities = ref(null);
const geminiProbeLoading = ref(false);
const uploadedFiles = ref([]);
const fileInput = ref(null);
const isUploading = ref(false);
const dataManagementStatus = ref(null);
const dataManagementLoading = ref(false);
const selectedDataMode = ref("json");
const connectionTestResult = ref(null);
const dataFileCards = computed(() => {
    const json = dataManagementStatus.value?.json || {};
    return [
        { key: "settings", label: t("dataManagement.settingsFile"), info: json.settings || {} },
        { key: "imageHistory", label: t("dataManagement.imageHistory"), info: json.imageHistory || {} },
        { key: "ttsHistory", label: t("dataManagement.ttsHistory"), info: json.ttsHistory || {} }
    ];
});
const postgresqlInfo = computed(() => dataManagementStatus.value?.postgresql || {});
const settingsDraft = ref({
    minimax: { apiKey: "", model: "" },
    deepseek: { apiKey: "", model: "" },
    openai: { apiKey: "", baseUrl: "", model: "" },
    gemini: { apiKey: "", baseUrl: "", model: "" }
});
const sidebarWidth = ref(248);
const chatInputHeight = ref(null);
const textareaRef = ref(null);
const adjustTextareaHeight = () => {
    if (chatInputHeight.value)
        return; // If manually resized, don't override with auto-grow
    nextTick(() => {
        const el = textareaRef.value;
        if (el) {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
        }
    });
};
watch(inputText, adjustTextareaHeight);
const systemHealth = ref(t("chat.unknown"));
const promptTemplates = ref([
    { id: "image-detail", title: t("prompt.imageDetailTitle"), provider: "MiniMax", content: t("prompt.imageDetailContent") },
    { id: "tts-polish", title: t("prompt.ttsPolishTitle"), provider: "MiniMax", content: t("prompt.ttsPolishContent") },
    { id: "reasoning", title: t("prompt.reasoningTitle"), provider: "DeepSeek", content: t("prompt.reasoningContent") }
]);
const promptDraft = ref({ title: "", content: "", provider: "通用" });
const favorites = ref([]);
const selectedAsset = ref(null);
const activeAssetTab = ref('all');
const selectedAssetKeys = ref([]);
watch([activeAssetTab, activeView], () => {
    selectedAssetKeys.value = [];
});
let logEventSource = null;
let resizing = null;
const providerMeta = {
    minimax: {
        label: "MiniMax",
        subtitle: t("chat.minimaxSubtitle"),
        accent: "red",
        emptyTitle: t("chat.minimaxEmptyTitle"),
        emptyDesc: t("chat.minimaxEmptyDesc")
    },
    deepseek: {
        label: "DeepSeek",
        subtitle: t("chat.deepseekSubtitle"),
        accent: "blue",
        emptyTitle: t("chat.deepseekEmptyTitle"),
        emptyDesc: t("chat.deepseekEmptyDesc")
    },
    openai: {
        label: "OpenAI",
        subtitle: t("chat.openaiSubtitle"),
        emptyTitle: t("chat.openaiEmptyTitle"),
        emptyDesc: t("chat.openaiEmptyDesc")
    },
    gemini: {
        label: "Gemini",
        subtitle: t("chat.geminiSubtitle"),
        accent: "purple",
        emptyTitle: t("chat.geminiEmptyTitle"),
        emptyDesc: t("chat.geminiEmptyDesc")
    }
};
const messages = computed(() => {
    if (activeProvider.value === "minimax")
        return minimaxMessages.value;
    if (activeProvider.value === "deepseek")
        return deepSeekMessages.value;
    if (activeProvider.value === "openai")
        return openaiMessages.value;
    return geminiMessages.value;
});
const activeMeta = computed(() => providerMeta[activeProvider.value]);
const minimaxModels = computed(() => settingsState.value?.minimax?.models || []);
const deepSeekModels = computed(() => settingsState.value?.deepseek?.models || []);
const openaiModels = computed(() => settingsState.value?.openai?.models || []);
const geminiModels = computed(() => settingsState.value?.gemini?.models || []);
const availableGeminiModels = computed(() => {
    if (!geminiCapabilities.value || !geminiCapabilities.value.models) {
        return settingsState.value?.gemini?.models || [];
    }
    // Filter to only available, non-thinking, non-image models
    const available = geminiCapabilities.value.models.filter((m) => {
        if (!m.available)
            return false;
        const lower = m.id.toLowerCase();
        // Exclude pure thinking variants (they are same model, just different mode)
        if (lower.endsWith('-thinking'))
            return false;
        // Exclude image models from text chat selector
        if (lower.includes('image'))
            return false;
        return true;
    });
    // Deduplicate by displayName: keep the shortest (cleanest) model ID per name
    const seen = new Map();
    for (const m of available) {
        const name = formatModelInfo(m.id).displayName;
        if (!seen.has(name)) {
            seen.set(name, m);
        }
        else {
            // Prefer shorter (simpler) ID
            if (m.id.length < seen.get(name).id.length) {
                seen.set(name, m);
            }
        }
    }
    return Array.from(seen.values());
});
const isGeminiImageAvailable = computed(() => {
    if (!geminiCapabilities.value || !geminiCapabilities.value.models)
        return false;
    return geminiCapabilities.value.models.some((m) => m.available && (m.id.includes("image") || m.id === "gemini-3-pro-image"));
});
const minimaxSubViews = ["speech", "translation", "imageHistory", "ttsHistory"];
const showMiniMaxSubnav = computed(() => activeProvider.value === "minimax" && (activeView.value === "chat" || minimaxSubViews.includes(activeView.value)));
const providerSessions = computed(() => chatSessions.value.filter(session => session.provider === activeProvider.value));
const sessionSummaries = computed(() => chatSessions.value
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(session => ({
    ...session,
    subtitle: providerMeta[session.provider].subtitle,
    count: session.messages.length,
    last: session.messages.at(-1)?.content || t("chat.noDialog")
})));
const dashboardStats = computed(() => [
    { label: t("dashboard.sessions"), value: chatSessions.value.length, detail: t("dashboard.sessionsDetail") },
    { label: t("dashboard.tasks"), value: taskQueue.value.length, detail: `${taskQueue.value.filter(task => task.status === "running").length} ${t("dashboard.tasksDetail")}` },
    { label: t("dashboard.assets"), value: assetItems.value.length, detail: t("dashboard.assetsDetail") },
    { label: t("dashboard.favorites"), value: favorites.value.length, detail: t("dashboard.favoritesDetail") }
]);
const apiStatusCards = computed(() => [
    {
        name: "Backend",
        status: systemHealth.value === "ok" ? t("apiStatus.statusOk") : t("apiStatus.statusPending"),
        detail: `${t("apiStatus.healthCheck")}${systemHealth.value}`
    },
    {
        name: "MiniMax",
        status: settingsState.value?.minimax?.apiKeyConfigured ? t("apiStatus.configured") : t("apiStatus.notConfigured"),
        detail: `${settingsState.value?.minimax?.model || t("apiStatus.noModel")} · ${settingsState.value?.minimax?.apiKeyMasked || t("apiStatus.noKey")}`
    },
    {
        name: "DeepSeek",
        status: settingsState.value?.deepseek?.apiKeyConfigured ? t("apiStatus.configured") : t("apiStatus.notConfigured"),
        detail: `${settingsState.value?.deepseek?.model || t("apiStatus.noModel")} · ${deepSeekBalance.value?.isAvailable ? t("apiStatus.balanceAvailable") : t("apiStatus.balancePending")}`
    }
]);
const assetItems = computed(() => [
    ...imageHistories.value.map(item => ({
        id: String(item.id),
        type: "image",
        title: item.prompt || t("history.defaultImagePrompt"),
        subtitle: item.createdAt || "",
        url: String(item.url || "")
    })),
    ...ttsHistories.value
        .filter(item => !item.preview && item.source !== 'translation')
        .map(item => ({
        id: String(item.id),
        type: "audio",
        title: item.text || t("history.defaultTtsText"),
        subtitle: `${item.voiceId || "voice"} · ${item.format || "audio"} · tts`,
        url: String(item.audioUrl || "")
    })),
    ...documents.value.map(item => ({
        id: String(item.id),
        type: "document",
        title: item.name,
        subtitle: `${item.type.toUpperCase()} · ${(item.sizeBytes / 1024).toFixed(1)} KB · ${(item.chunks?.length) || 0} 分片`,
        url: String(item.url || "")
    }))
]);
const filteredAssetItems = computed(() => {
    if (activeAssetTab.value === 'image') {
        return assetItems.value.filter(item => item.type === 'image');
    }
    if (activeAssetTab.value === 'audio') {
        return assetItems.value.filter(item => item.type === 'audio');
    }
    if (activeAssetTab.value === 'document') {
        return assetItems.value.filter(item => item.type === 'document');
    }
    return assetItems.value;
});
const diagnosticCards = computed(() => [
    { name: t("diagnostics.backendHealth"), value: systemHealth.value, detail: t("diagnostics.backendHealthDetail") },
    { name: t("diagnostics.sessionCount"), value: `${chatSessions.value.length} ${t("diagnostics.unitItem")}`, detail: t("diagnostics.sessionCountDetail") },
    { name: t("diagnostics.taskQueue"), value: `${taskQueue.value.length} ${t("diagnostics.unitItem")}`, detail: `${taskQueue.value.filter(task => task.status === "running").length} ${t("dashboard.tasksDetail")}` },
    { name: t("diagnostics.logCache"), value: `${logEntries.value.length} ${t("diagnostics.unitCount")}`, detail: t("diagnostics.logCacheDetail") },
    { name: t("diagnostics.imageAssets"), value: `${imageHistories.value.length} ${t("diagnostics.unitItem")}`, detail: t("diagnostics.imageAssetsDetail") },
    { name: t("diagnostics.ttsAssets"), value: `${ttsHistories.value.length} ${t("diagnostics.unitItem")}`, detail: t("diagnostics.ttsAssetsDetail") },
    { name: t("diagnostics.templateCount"), value: `${promptTemplates.value.length} ${t("diagnostics.unitItem")}`, detail: t("diagnostics.templateCountDetail") },
    { name: t("diagnostics.favoriteCount"), value: `${favorites.value.length} ${t("diagnostics.unitItem")}`, detail: t("diagnostics.favoriteCountDetail") }
]);
const unreadNotificationCount = computed(() => notifications.value.filter(item => !item.read).length);
const recentNotifications = computed(() => notifications.value.slice(0, 3));
const addLog = (msg) => {
    logs.value.push(msg);
    if (logs.value.length > 200)
        logs.value.shift();
    nextTick(() => {
        if (logContainer.value)
            logContainer.value.scrollTop = logContainer.value.scrollHeight;
    });
};
const saveNotifications = () => {
    localStorage.setItem("weizhi.notifications", JSON.stringify(notifications.value));
};
const addNotification = (level, title, message) => {
    notifications.value.unshift({
        id: `notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        level,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false
    });
    notifications.value = notifications.value.slice(0, 80);
    saveNotifications();
};
const markNotificationsRead = () => {
    notifications.value.forEach(item => item.read = true);
    saveNotifications();
};
const removeNotification = (id) => {
    notifications.value = notifications.value.filter(item => item.id !== id);
    saveNotifications();
};
const loadLogEntries = async () => {
    logLoading.value = true;
    try {
        const res = await systemApi.logs({
            level: logLevel.value || undefined,
            query: logQuery.value.trim() || undefined,
            limit: 300
        });
        logEntries.value = res.data?.logs || [];
    }
    catch (err) {
        addLog("Log history load failed: " + (err?.message || "unknown error"));
    }
    finally {
        logLoading.value = false;
    }
};
const clearLogEntries = async () => {
    try {
        await systemApi.clearLogs();
        logs.value = [];
        logEntries.value = [];
    }
    catch (err) {
        addLog("Log clear failed: " + (err?.message || "unknown error"));
    }
};
const formatLogTime = (value) => {
    if (!value)
        return "--";
    return new Date(value).toLocaleTimeString("zh-CN", { hour12: false });
};
const logLevelClass = (level) => `level-${String(level || "info").toLowerCase()}`;
const mediaUrl = (url) => resolveApiUrl(url);
const loadHistories = async () => {
    const sortDesc = (a, b) => {
        const parseTime = (dateStr) => {
            if (!dateStr)
                return 0;
            // Normalizing high precision timestamp strings (e.g. 2026-05-22T13:06:50.989640Z) to 3 decimal places
            // to avoid NaN or invalid parses in standard Javascript Date engines.
            const normalized = dateStr.replace(/(\.\d{3})\d+/, '$1');
            const t = new Date(normalized).getTime();
            return isNaN(t) ? 0 : t;
        };
        return parseTime(b.createdAt) - parseTime(a.createdAt);
    };
    await Promise.all([
        (async () => {
            try {
                const imageRes = await imageApi.history();
                imageHistories.value = (imageRes.data?.histories || []).sort(sortDesc);
            }
            catch (err) {
                addLog("Failed to load image history: " + (err?.message || "unknown error"));
            }
        })(),
        (async () => {
            try {
                const ttsRes = await ttsApi.history();
                ttsHistories.value = (ttsRes.data?.histories || []).sort(sortDesc);
            }
            catch (err) {
                addLog("Failed to load TTS history: " + (err?.message || "unknown error"));
            }
        })(),
        (async () => {
            try {
                const docRes = await documentApi.list();
                documents.value = (docRes.data || []).sort((a, b) => b.uploadTime - a.uploadTime);
            }
            catch (err) {
                addLog("Failed to load RAG documents: " + (err?.message || "unknown error"));
            }
        })()
    ]);
};
const scrollChatToBottom = () => {
    nextTick(() => {
        if (chatContainer.value)
            chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    });
};
const loadVoices = async () => {
    const res = await ttsApi.voices();
    voices.value = res.data?.voices || [];
    if (!voices.value.find(v => v.voiceId === previewVoiceId.value) && voices.value[0]) {
        previewVoiceId.value = voices.value[0].voiceId;
    }
};
const loadDeepSeekAccount = async () => {
    accountLoading.value = true;
    try {
        const [balanceRes, usageRes] = await Promise.all([deepSeekApi.balance(), deepSeekApi.usage()]);
        deepSeekBalance.value = balanceRes.data;
        deepSeekUsage.value = usageRes.data?.usage || null;
    }
    catch (err) {
        addLog("DeepSeek account load failed: " + (err?.message || "unknown error"));
    }
    finally {
        accountLoading.value = false;
    }
};
const defaultSession = (provider) => {
    const now = new Date().toISOString();
    return {
        id: `${provider}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        provider,
        title: provider === "minimax" ? t("chat.minimaxDefaultName") : provider === "deepseek" ? t("chat.deepseekDefaultName") : provider === "openai" ? t("chat.openaiDefaultName") : t("chat.geminiDefaultName"),
        createdAt: now,
        updatedAt: now,
        messages: []
    };
};
const saveSessions = () => {
    localStorage.setItem("weizhi.chatSessions", JSON.stringify(chatSessions.value));
    localStorage.setItem("weizhi.activeSessionIds", JSON.stringify(activeSessionIds.value));
};
const syncMessagesFromSession = (provider) => {
    const session = chatSessions.value.find(item => item.id === activeSessionIds.value[provider]);
    if (provider === "minimax")
        minimaxMessages.value = session ? [...session.messages] : [];
    else if (provider === "deepseek")
        deepSeekMessages.value = session ? [...session.messages] : [];
    else if (provider === "openai")
        openaiMessages.value = session ? [...session.messages] : [];
    else
        geminiMessages.value = session ? [...session.messages] : [];
};
const saveActiveSession = (provider) => {
    const session = chatSessions.value.find(item => item.id === activeSessionIds.value[provider]);
    if (!session)
        return;
    session.messages = provider === "minimax"
        ? [...minimaxMessages.value]
        : provider === "deepseek"
            ? [...deepSeekMessages.value]
            : provider === "openai"
                ? [...openaiMessages.value]
                : [...geminiMessages.value];
    session.updatedAt = new Date().toISOString();
    const firstUserMessage = session.messages.find(item => item.role === "user")?.content;
    if (firstUserMessage && session.title.endsWith(t("chat.minimaxDefaultName").split(" ")[1] || t("chat.minimaxDefaultName"))) {
        session.title = firstUserMessage.slice(0, 18);
    }
    saveSessions();
};
const ensureSessions = () => {
    if (!chatSessions.value.some(session => session.provider === "minimax")) {
        const session = defaultSession("minimax");
        chatSessions.value.push(session);
        activeSessionIds.value.minimax = session.id;
    }
    if (!chatSessions.value.some(session => session.provider === "deepseek")) {
        const session = defaultSession("deepseek");
        chatSessions.value.push(session);
        activeSessionIds.value.deepseek = session.id;
    }
    if (!chatSessions.value.some(session => session.provider === "openai")) {
        const session = defaultSession("openai");
        chatSessions.value.push(session);
        activeSessionIds.value.openai = session.id;
    }
    if (!chatSessions.value.some(session => session.provider === "gemini")) {
        const session = defaultSession("gemini");
        chatSessions.value.push(session);
        activeSessionIds.value.gemini = session.id;
    }
    ["minimax", "deepseek", "openai", "gemini"].forEach(provider => {
        const currentActiveId = activeSessionIds.value[provider];
        const activeSession = chatSessions.value.find(session => session.id === currentActiveId);
        // If active session does not exist, or if its provider does not match, reset it to the first session of this provider
        if (!activeSession || activeSession.provider !== provider) {
            const matchingSession = chatSessions.value.find(session => session.provider === provider);
            if (matchingSession) {
                activeSessionIds.value[provider] = matchingSession.id;
            }
            else {
                const newSession = defaultSession(provider);
                chatSessions.value.push(newSession);
                activeSessionIds.value[provider] = newSession.id;
            }
        }
        syncMessagesFromSession(provider);
    });
    saveSessions();
};
const createSession = (provider = activeProvider.value) => {
    const session = defaultSession(provider);
    session.title = provider === "minimax"
        ? t("chat.newMinimaxName")
        : provider === "deepseek"
            ? t("chat.newDeepseekName")
            : provider === "openai"
                ? t("chat.newOpenAIName")
                : t("chat.newGeminiName");
    chatSessions.value.unshift(session);
    activeSessionIds.value[provider] = session.id;
    activeProvider.value = provider;
    activeView.value = "chat";
    syncMessagesFromSession(provider);
    saveSessions();
};
const openSession = (session) => {
    activeSessionIds.value[session.provider] = session.id;
    activeProvider.value = session.provider;
    activeView.value = "chat";
    syncMessagesFromSession(session.provider);
    saveSessions();
    scrollChatToBottom();
};
const renameSession = (session) => {
    const title = window.prompt(t("chat.sessionNamePrompt"), session.title);
    if (!title?.trim())
        return;
    session.title = title.trim();
    session.updatedAt = new Date().toISOString();
    saveSessions();
};
const deleteSession = (session) => {
    chatSessions.value = chatSessions.value.filter(item => item.id !== session.id);
    if (activeSessionIds.value[session.provider] === session.id) {
        const next = chatSessions.value.find(item => item.provider === session.provider) || defaultSession(session.provider);
        if (!chatSessions.value.find(item => item.id === next.id))
            chatSessions.value.push(next);
        activeSessionIds.value[session.provider] = next.id;
        syncMessagesFromSession(session.provider);
    }
    saveSessions();
};
const saveTasks = () => {
    localStorage.setItem("weizhi.taskQueue", JSON.stringify(taskQueue.value));
};
const createTask = (title, provider, detail) => {
    const task = {
        id: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        provider,
        status: "running",
        createdAt: new Date().toISOString(),
        detail
    };
    taskQueue.value.unshift(task);
    saveTasks();
    return task;
};
const finishTask = (task, status, detail) => {
    task.status = status;
    if (detail)
        task.detail = detail;
    if (status === "success")
        addNotification("success", task.title, detail || t("tasks.taskSuccess"));
    if (status === "failed")
        addNotification("error", task.title, detail || t("tasks.taskFailed"));
    saveTasks();
};
const clearFinishedTasks = () => {
    taskQueue.value = taskQueue.value.filter(task => task.status === "running" || task.status === "pending");
    saveTasks();
};
const loadSettings = async () => {
    settingsLoading.value = true;
    try {
        const res = await settingsApi.get();
        settingsState.value = res.data || {};
        settingsDraft.value.minimax.model = settingsState.value?.minimax?.model || "";
        settingsDraft.value.deepseek.model = settingsState.value?.deepseek?.model || "";
        settingsDraft.value.minimax.apiKey = "";
        settingsDraft.value.deepseek.apiKey = "";
        settingsDraft.value.openai.model = settingsState.value?.openai?.model || "";
        settingsDraft.value.openai.baseUrl = settingsState.value?.openai?.baseUrl || "";
        settingsDraft.value.openai.apiKey = "";
        settingsDraft.value.gemini.model = settingsState.value?.gemini?.model || "";
        settingsDraft.value.gemini.baseUrl = settingsState.value?.gemini?.baseUrl || "";
        settingsDraft.value.gemini.apiKey = "";
        if (settingsState.value?.gemini?.model) {
            selectedGeminiModel.value = settingsState.value.gemini.model;
        }
    }
    catch (err) {
        addLog("Settings load failed: " + (err?.message || "unknown error"));
    }
    finally {
        settingsLoading.value = false;
    }
};
const refreshProviderModels = async (provider) => {
    const res = await settingsApi.models(provider);
    settingsState.value = {
        ...settingsState.value,
        [provider]: {
            ...(settingsState.value?.[provider] || {}),
            models: res.data || []
        }
    };
};
const saveProviderSettings = async (provider) => {
    settingsLoading.value = true;
    try {
        const draft = settingsDraft.value[provider];
        const payload = { model: draft.model };
        if (draft.apiKey.trim())
            payload.apiKey = draft.apiKey.trim();
        if (draft.baseUrl && draft.baseUrl.trim())
            payload.baseUrl = draft.baseUrl.trim();
        const res = await settingsApi.update(provider, payload);
        settingsState.value = { ...settingsState.value, [provider]: res.data };
        if (provider === "gemini" && res.data?.model) {
            selectedGeminiModel.value = res.data.model;
        }
        draft.apiKey = "";
        addLog(`${provider} settings saved.`);
        addNotification("success", t("settings.saveSuccess"), `${providerMeta[provider].label} ${t("settings.saveSuccessDesc")}`);
        if (provider === "deepseek")
            await loadDeepSeekAccount();
    }
    catch (err) {
        addNotification("error", t("settings.saveFailed"), err?.message || "unknown error");
        addLog("Settings save failed: " + (err?.message || "unknown error"));
    }
    finally {
        settingsLoading.value = false;
    }
};
const openDeepSeekUsage = () => {
    window.open("https://platform.deepseek.com/usage", "_blank");
};
const loadGeminiCapabilities = async () => {
    try {
        // First: quickly load cached capabilities to populate the UI fast
        const res = await geminiApi.capabilities();
        geminiCapabilities.value = res.data;
    }
    catch (err) {
        addLog("加载 Gemini 能力失败：" + (err?.message || "未知错误"));
    }
    // Then: trigger a background probe to get fresh availability data
    // (silent mode — no task log, just updates the list)
    handleGeminiProbe(true);
};
const handleGeminiProbe = async (silent = false) => {
    if (geminiProbeLoading.value)
        return;
    geminiProbeLoading.value = true;
    const task = silent ? null : createTask("检测 Gemini 中转模型", "gemini", "开始探测本地中转站的所有候选模型可用性...");
    try {
        const res = await geminiApi.probe();
        geminiCapabilities.value = res.data;
        if (task) {
            finishTask(task, "success", "Gemini 中转模型探测完成。可用模型数：" + (res.data?.models?.filter((m) => m.available)?.length || 0));
        }
    }
    catch (err) {
        if (task) {
            finishTask(task, "failed", err?.message || "探测失败");
            addLog("探测 Gemini 模型失败：" + (err?.message || "未知错误"));
        }
    }
    finally {
        geminiProbeLoading.value = false;
    }
};
const triggerFileUpload = () => {
    console.log("triggerFileUpload called, fileInput.value is:", fileInput.value);
    if (fileInput.value) {
        fileInput.value.click();
    }
    else {
        alert("上传控件未初始化，请稍后重试或检查控制台。");
    }
};
const handleFileUpload = async (event) => {
    const target = event.target;
    if (!target.files || !target.files[0]) {
        console.log("handleFileUpload: No file selected.");
        return;
    }
    const file = target.files[0];
    console.log("handleFileUpload: Selected file:", file.name, file.size, file.type);
    isUploading.value = true;
    addLog("开始上传多模态附件：" + file.name + " (" + file.size + " 字节)");
    const task = createTask("上传多模态附件", "gemini", "正在上传文件：" + file.name);
    try {
        const res = await systemApi.upload(file);
        console.log("handleFileUpload: Upload response received:", res.data);
        if (res.data && res.data.success) {
            if (res.data.type === 'document') {
                finishTask(task, "success", "成功上传并解析本地文档：" + file.name);
                addNotification("success", "已导入知识库", file.name);
                addLog("文档已成功导入 RAG 知识库：" + file.name + ", ID: " + res.data.id);
                alert("文档《" + file.name + "》已成功导入本地知识库，已为您自动勾选关联！");
                await loadHistories();
                if (res.data.id && !selectedDocIds.value.includes(res.data.id)) {
                    selectedDocIds.value.push(res.data.id);
                }
            }
            else {
                uploadedFiles.value.push({
                    url: res.data.url,
                    type: res.data.type,
                    name: res.data.name
                });
                finishTask(task, "success", "成功上传文件：" + file.name);
                addNotification("success", "上传成功", file.name);
                addLog("多模态附件上传成功：" + file.name + ", URL: " + res.data.url);
                alert("文件《" + file.name + "》上传成功，已放入发送队列！");
            }
        }
        else {
            throw new Error(res.data?.message || "接口返回失败");
        }
    }
    catch (err) {
        const errMsg = err?.response?.data?.message || err?.message || "网络请求失败";
        console.error("handleFileUpload: Upload error:", err);
        finishTask(task, "failed", errMsg);
        addNotification("error", "上传失败", errMsg);
        addLog("上传附件失败：" + errMsg);
        alert("上传失败原因: " + errMsg);
    }
    finally {
        isUploading.value = false;
        target.value = "";
    }
};
const removeUploadedFile = (index) => {
    uploadedFiles.value.splice(index, 1);
};
const loadApiStatus = async () => {
    try {
        const healthRes = await systemApi.getHealth();
        systemHealth.value = String(healthRes.data || "unknown");
    }
    catch {
        systemHealth.value = t("apiStatus.statusError");
    }
    await Promise.all([loadSettings(), loadDeepSeekAccount(), loadGeminiCapabilities()]);
};
const persistTtsUrls = () => {
    try {
        localStorage.setItem("weizhi.previewAudioUrl", previewAudioUrl.value);
        localStorage.setItem("weizhi.generateAudioUrl", generateAudioUrl.value);
    }
    catch { /* quota exceeded — non-critical */ }
};
const handlePreview = async () => {
    if (!previewText.value.trim())
        return;
    if (previewLoading.value)
        return;
    const task = createTask(t("speech.taskPreview"), "minimax", previewText.value.trim().slice(0, 80));
    previewLoading.value = true;
    try {
        const res = await ttsApi.preview({
            text: previewText.value.trim(),
            voiceId: previewVoiceId.value,
            model: "speech-2.8-hd",
            format: previewFormat.value,
            speed: previewSpeed.value,
            vol: previewVol.value,
            pitch: previewPitch.value,
            sampleRate: previewSampleRate.value,
            bitrate: previewBitrate.value
        });
        if (res.data?.audioUrl) {
            const raw = mediaUrl(res.data.audioUrl);
            previewAudioUrl.value = `${raw}${raw.includes("?") ? "&" : "?"}t=${Date.now()}`;
            persistTtsUrls();
        }
        try {
            await loadHistories();
        }
        catch { /* history refresh is non-critical */ }
        finishTask(task, "success", t("speech.previewSuccess"));
    }
    catch (err) {
        finishTask(task, "failed", err?.message || t("speech.previewFailed"));
        addLog("TTS preview failed: " + (err?.message || "unknown error"));
    }
    finally {
        previewLoading.value = false;
    }
};
const handleGenerateTts = async () => {
    if (!previewText.value.trim())
        return;
    if (generateLoading.value)
        return;
    const task = createTask(t("speech.taskGenerate"), "minimax", previewText.value.trim().slice(0, 80));
    generateLoading.value = true;
    try {
        const res = await ttsApi.generate({
            text: previewText.value.trim(),
            voiceId: previewVoiceId.value,
            model: "speech-2.8-hd",
            format: previewFormat.value,
            speed: previewSpeed.value,
            vol: previewVol.value,
            pitch: previewPitch.value,
            sampleRate: previewSampleRate.value,
            bitrate: previewBitrate.value
        });
        if (res.data?.audioUrl) {
            const raw = mediaUrl(res.data.audioUrl);
            generateAudioUrl.value = `${raw}${raw.includes("?") ? "&" : "?"}t=${Date.now()}`;
            persistTtsUrls();
        }
        try {
            await loadHistories();
        }
        catch { /* history refresh is non-critical */ }
        finishTask(task, "success", t("speech.generateSuccess"));
    }
    catch (err) {
        finishTask(task, "failed", err?.message || t("speech.generateFailed"));
        addLog("TTS generate failed: " + (err?.message || "unknown error"));
    }
    finally {
        generateLoading.value = false;
    }
};
const deleteImageHistory = async (id) => {
    await imageApi.deleteHistory(id);
    await loadHistories();
};
const clearImageHistory = async () => {
    await imageApi.clearHistory();
    await loadHistories();
};
const deleteTtsHistory = async (id) => {
    await ttsApi.deleteHistory(id);
    await loadHistories();
};
const clearTtsHistory = async () => {
    await ttsApi.clearHistory();
    await loadHistories();
};
const saveFavorites = () => {
    localStorage.setItem("weizhi.favorites", JSON.stringify(favorites.value));
};
const isFavorite = (id) => favorites.value.some(item => item.id === id);
const addFavorite = (item) => {
    if (isFavorite(item.id))
        return;
    favorites.value.unshift(item);
    saveFavorites();
    addNotification("success", t("favorites.addSuccess"), item.title);
};
const removeFavorite = (id) => {
    favorites.value = favorites.value.filter(item => item.id !== id);
    saveFavorites();
};
const favoriteMessage = (message, index) => {
    addFavorite({
        id: `${activeProvider.value}-message-${index}`,
        type: "text",
        title: `${activeMeta.value.label} ${message.role === "user" ? t("chat.userMessage") : t("chat.aiReply")}`,
        subtitle: new Date().toLocaleString("zh-CN", { hour12: false }),
        content: message.content
    });
};
const favoriteAsset = (asset) => {
    addFavorite({
        id: `${asset.type}-${asset.id}`,
        type: asset.type,
        title: asset.title,
        subtitle: asset.subtitle,
        url: asset.url
    });
};
const openAssetDetail = (asset) => {
    selectedAsset.value = asset;
};
const closeAssetDetail = () => {
    selectedAsset.value = null;
};
const downloadAsset = (asset) => {
    const url = mediaUrl(asset.url);
    const link = document.createElement("a");
    link.href = url;
    link.download = url.split("/").pop() || `${asset.type}-${asset.id}`;
    link.target = "_blank";
    link.click();
    addNotification("success", t("assets.downloadStart"), link.download);
};
const deleteAsset = async (asset) => {
    if (confirm(t("assets.deleteConfirm") || "确定删除该素材吗？此操作不可恢复。")) {
        try {
            if (asset.type === 'image') {
                await imageApi.deleteHistory(asset.id);
            }
            else if (asset.type === 'document') {
                await documentApi.delete(asset.id);
            }
            else {
                await ttsApi.deleteHistory(asset.id);
            }
            addNotification("success", t("chat.deleteSuccess") || "删除成功", "");
            const key = `${asset.type}-${asset.id}`;
            const idx = selectedAssetKeys.value.indexOf(key);
            if (idx > -1)
                selectedAssetKeys.value.splice(idx, 1);
            await loadHistories();
        }
        catch (err) {
            addNotification("error", t("chat.deleteFailed") || "删除失败", err.message);
        }
    }
};
const toggleSelectAsset = (key) => {
    const index = selectedAssetKeys.value.indexOf(key);
    if (index > -1) {
        selectedAssetKeys.value.splice(index, 1);
    }
    else {
        selectedAssetKeys.value.push(key);
    }
};
const isAllSelected = computed(() => {
    if (filteredAssetItems.value.length === 0)
        return false;
    return filteredAssetItems.value.every(item => selectedAssetKeys.value.includes(`${item.type}-${item.id}`));
});
const toggleSelectAll = () => {
    if (isAllSelected.value) {
        const filteredKeys = filteredAssetItems.value.map(item => `${item.type}-${item.id}`);
        selectedAssetKeys.value = selectedAssetKeys.value.filter(key => !filteredKeys.includes(key));
    }
    else {
        filteredAssetItems.value.forEach(item => {
            const key = `${item.type}-${item.id}`;
            if (!selectedAssetKeys.value.includes(key)) {
                selectedAssetKeys.value.push(key);
            }
        });
    }
};
const deleteSelectedAssets = async () => {
    const count = selectedAssetKeys.value.length;
    if (count === 0)
        return;
    if (confirm(t("assets.deleteBatchConfirm", { count }) || `确定删除选中的 ${count} 个素材吗？此操作不可恢复。`)) {
        let successCount = 0;
        let failCount = 0;
        const promises = selectedAssetKeys.value.map(async (key) => {
            const dashIdx = key.indexOf('-');
            const type = key.substring(0, dashIdx);
            const id = key.substring(dashIdx + 1);
            try {
                if (type === 'image') {
                    await imageApi.deleteHistory(id);
                }
                else if (type === 'document') {
                    await documentApi.delete(id);
                }
                else {
                    await ttsApi.deleteHistory(id);
                }
                successCount++;
            }
            catch (err) {
                failCount++;
            }
        });
        await Promise.all(promises);
        selectedAssetKeys.value = [];
        await loadHistories();
        if (failCount === 0) {
            addNotification("success", t("chat.deleteSuccess") || "删除成功", `成功删除 ${successCount} 个素材`);
        }
        else {
            addNotification("warning", t("chat.deletePartial") || "部分删除成功", `成功: ${successCount}, 失败: ${failCount}`);
        }
    }
};
const downloadSelectedAssets = () => {
    const count = selectedAssetKeys.value.length;
    if (count === 0)
        return;
    const selectedItems = filteredAssetItems.value.filter(item => selectedAssetKeys.value.includes(`${item.type}-${item.id}`));
    selectedItems.forEach((item, i) => {
        setTimeout(() => {
            downloadAsset(item);
        }, i * 250);
    });
    addNotification("success", t("assets.downloadStart"), `正在批量下载 ${count} 个素材`);
};
const downloadTextFile = (filename, content, type = "application/json") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    addNotification("success", t("exports.success"), filename);
};
const exportJson = (scope) => {
    const data = {
        exportedAt: new Date().toISOString(),
        scope,
        chats: scope === "all" || scope === "chat" ? chatSessions.value : undefined,
        media: scope === "all" || scope === "media" ? { images: imageHistories.value, audios: ttsHistories.value } : undefined,
        logs: scope === "all" || scope === "logs" ? logEntries.value : undefined,
        favorites: scope === "all" || scope === "favorites" ? favorites.value : undefined,
        prompts: scope === "all" || scope === "prompts" ? promptTemplates.value : undefined
    };
    downloadTextFile(`weizhi-${scope}-${Date.now()}.json`, JSON.stringify(data, null, 2));
};
const exportMarkdown = () => {
    const lines = [
        "# Weizhi Agent Export",
        "",
        `Exported at: ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
        "",
        "## MiniMax Chat",
        ...chatSessions.value.filter(item => item.provider === "minimax").flatMap(session => [`### ${session.title}`, ...session.messages.map(item => `- **${item.role}**: ${item.content}`)]),
        "",
        "## DeepSeek Chat",
        ...chatSessions.value.filter(item => item.provider === "deepseek").flatMap(session => [`### ${session.title}`, ...session.messages.map(item => `- **${item.role}**: ${item.content}`)]),
        "## OpenAI Chat",
        ...chatSessions.value.filter(item => item.provider === "openai").flatMap(session => [`### ${session.title}`, ...session.messages.map(item => `- **${item.role}**: ${item.content}`)]),
        "",
        "## Gemini Chat",
        ...chatSessions.value.filter(item => item.provider === "gemini").flatMap(session => [`### ${session.title}`, ...session.messages.map(item => `- **${item.role}**: ${item.content}`)]),
        "",
        "## Favorites",
        ...favorites.value.map(item => `- **${item.title}** (${item.type}) ${item.content || item.url || ""}`)
    ];
    downloadTextFile(`weizhi-export-${Date.now()}.md`, lines.join("\n"), "text/markdown");
};
const persistLayout = () => {
    localStorage.setItem("weizhi.layout", JSON.stringify({
        sidebarWidth: sidebarWidth.value,
        chatInputHeight: chatInputHeight.value
    }));
};
const restoreLayout = () => {
    try {
        const raw = localStorage.getItem("weizhi.layout");
        if (!raw)
            return;
        const data = JSON.parse(raw);
        if (typeof data.sidebarWidth === "number")
            sidebarWidth.value = Math.min(420, Math.max(180, data.sidebarWidth));
        if (typeof data.chatInputHeight === "number")
            chatInputHeight.value = Math.min(600, Math.max(90, data.chatInputHeight));
    }
    catch {
        // Ignore invalid local storage state.
    }
};
const startResize = (target, event) => {
    resizing = target;
    event.preventDefault();
    document.body.classList.add("is-resizing");
    if (target === "chatInput") {
        const inputContainerEl = document.querySelector(".input-container");
        if (inputContainerEl && chatInputHeight.value === null) {
            chatInputHeight.value = inputContainerEl.offsetHeight;
        }
    }
    window.addEventListener("mousemove", resizeLayout);
    window.addEventListener("mouseup", stopResize);
};
const resizeLayout = (event) => {
    if (!resizing)
        return;
    if (resizing === "sidebar") {
        sidebarWidth.value = Math.min(420, Math.max(180, event.clientX));
    }
    else if (resizing === "chatInput") {
        const rawHeight = window.innerHeight - event.clientY;
        const maxHeight = Math.min(600, window.innerHeight * 0.6);
        chatInputHeight.value = Math.min(maxHeight, Math.max(90, rawHeight));
    }
};
const stopResize = () => {
    if (resizing)
        persistLayout();
    resizing = null;
    document.body.classList.remove("is-resizing");
    window.removeEventListener("mousemove", resizeLayout);
    window.removeEventListener("mouseup", stopResize);
};
const handleGlobalError = (event) => {
    const customEvt = event;
    const errorMsg = customEvt.detail?.message || "Unknown error";
    addNotification("error", t("notifications.systemError"), errorMsg);
};
onMounted(async () => {
    restoreLayout();
    logEventSource = systemApi.streamLogs();
    logEventSource.onmessage = async (event) => {
        addLog(event.data);
        await loadLogEntries();
    };
    logEventSource.onerror = () => addLog("Log stream disconnected or encountered an error.");
    addLog("System Initialized. Log stream connected.");
    await loadLogEntries();
    await Promise.all([loadHistories(), loadVoices()]);
    await Promise.all([loadDeepSeekAccount(), loadSettings(), loadGeminiCapabilities()]);
    try {
        const storedSessions = localStorage.getItem("weizhi.chatSessions");
        if (storedSessions)
            chatSessions.value = JSON.parse(storedSessions);
        const storedActive = localStorage.getItem("weizhi.activeSessionIds");
        if (storedActive)
            activeSessionIds.value = { ...activeSessionIds.value, ...JSON.parse(storedActive) };
    }
    catch {
        // Fall back to default local sessions.
    }
    ensureSessions();
    try {
        const storedTasks = localStorage.getItem("weizhi.taskQueue");
        if (storedTasks)
            taskQueue.value = JSON.parse(storedTasks);
    }
    catch {
        // Keep task queue empty if local storage is invalid.
    }
    try {
        const storedNotifications = localStorage.getItem("weizhi.notifications");
        if (storedNotifications)
            notifications.value = JSON.parse(storedNotifications);
    }
    catch {
        // Keep notifications empty if local storage is invalid.
    }
    try {
        const storedPrompts = localStorage.getItem("weizhi.promptTemplates");
        if (storedPrompts)
            promptTemplates.value = JSON.parse(storedPrompts);
    }
    catch {
        // Keep built-in templates if local prompt storage is invalid.
    }
    try {
        const storedFavorites = localStorage.getItem("weizhi.favorites");
        if (storedFavorites)
            favorites.value = JSON.parse(storedFavorites);
    }
    catch {
        // Keep favorites empty if local storage is invalid.
    }
    // Restore last TTS audio URLs so the speech page shows results after refresh
    try {
        const storedPreviewUrl = localStorage.getItem("weizhi.previewAudioUrl");
        if (storedPreviewUrl)
            previewAudioUrl.value = storedPreviewUrl;
        const storedGenerateUrl = localStorage.getItem("weizhi.generateAudioUrl");
        if (storedGenerateUrl)
            generateAudioUrl.value = storedGenerateUrl;
    }
    catch {
        // Non-critical — audio URLs will just be empty.
    }
    try {
        const storedTheme = localStorage.getItem("weizhi.theme");
        if (["light", "obsidian", "midnight", "green", "pink"].includes(storedTheme)) {
            setTheme(storedTheme);
        }
    }
    catch { }
    window.addEventListener("click", closeModelDropdown);
    window.addEventListener("weizhi-global-error", handleGlobalError);
    // 启动程序自动探测可用模型
    handleGeminiProbe();
});
onBeforeUnmount(() => {
    if (logEventSource)
        logEventSource.close();
    window.removeEventListener("click", closeModelDropdown);
    window.removeEventListener("weizhi-global-error", handleGlobalError);
    stopResize();
});
const handleSend = async () => {
    if ((!inputText.value.trim() && uploadedFiles.value.length === 0) || isThinking.value)
        return;
    let userMsg = inputText.value.trim();
    const mediaItems = uploadedFiles.value.map(file => ({
        type: file.type,
        url: file.url
    }));
    if (uploadedFiles.value.length > 0) {
        const mediaTags = uploadedFiles.value.map(file => {
            if (file.type === "image") {
                return `\n![${file.name}](${file.url})`;
            }
            else {
                return `\n[语音](${file.url})`;
            }
        }).join("");
        userMsg += mediaTags;
    }
    // Clear uploaded files state
    uploadedFiles.value = [];
    const provider = activeProvider.value;
    const task = createTask(`${providerMeta[provider].label} ${t("chat.qaTask")}`, provider, userMsg.slice(0, 80));
    const targetMessages = provider === "minimax"
        ? minimaxMessages.value
        : provider === "deepseek"
            ? deepSeekMessages.value
            : provider === "openai"
                ? openaiMessages.value
                : geminiMessages.value;
    targetMessages.push({ role: "user", content: userMsg, media: mediaItems });
    saveActiveSession(provider);
    scrollChatToBottom();
    inputText.value = "";
    isThinking.value = true;
    // Initialize abort controller
    chatAbortController.value = new AbortController();
    const options = { signal: chatAbortController.value.signal };
    // Helper to check if this is an image prompt (which cannot be streamed and must use blocking endpoint)
    const isImagePrompt = (input) => {
        const s = input.toLowerCase();
        const questionMarkers = ["为什么", "怎么", "如何", "啥", "什么", "吗", "?", "？", "why", "how", "what"];
        if (s.includes("/api/images/files/") || s.includes("图片已生成"))
            return false;
        if (questionMarkers.some(marker => s.includes(marker)))
            return false;
        return (s.includes("生成") || s.includes("画") || s.includes("创建") || s.includes("draw") || s.includes("create"))
            && (s.includes("图片") || s.includes("图像") || s.includes("照片") || s.includes("image") || s.includes("picture"));
    };
    if (isImagePrompt(userMsg)) {
        // Fallback to standard blocking endpoint for image generation
        const request = provider === "deepseek"
            ? deepSeekApi.ask(userMsg, targetMessages.slice(0, -1).map((message) => ({ role: message.role, content: message.content })), options)
            : provider === "openai"
                ? openaiApi.ask(userMsg, targetMessages.slice(0, -1).map((message) => ({ role: message.role, content: message.content })), options)
                : provider === "gemini"
                    ? geminiApi.ask(userMsg, targetMessages.slice(0, -1).map((message) => ({ role: message.role, content: message.content })), geminiMode.value, selectedDocIds.value, selectedGeminiModel.value, options)
                    : chatApi.ask(userMsg, targetMessages.slice(0, -1).map((message) => ({ role: message.role, content: message.content })), options);
        request.then(async (res) => {
            const payload = res.data;
            const content = typeof payload?.text === "string" ? payload.text : (typeof payload === "string" ? payload : JSON.stringify(payload));
            const media = Array.isArray(payload?.media) ? payload.media : [];
            targetMessages.push({ role: "assistant", content, media });
            if (provider === "deepseek" && payload?.metadata?.localUsage) {
                deepSeekUsage.value = payload.metadata.localUsage;
            }
            scrollChatToBottom();
            try {
                await loadHistories();
            }
            catch { /* non-critical */ }
            saveActiveSession(provider);
            finishTask(task, "success", t("chat.qaSuccess"));
        }).catch(err => {
            if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED" || err?.message === "canceled") {
                finishTask(task, "failed", t("chat.qaAborted"));
                return;
            }
            finishTask(task, "failed", err?.message || t("chat.qaFailed"));
            addLog("Error calling AI: " + err.message);
        }).finally(() => {
            isThinking.value = false;
            chatAbortController.value = null;
        });
    }
    else {
        // Use Server-Sent Events (SSE) streaming endpoint
        const url = provider === "deepseek"
            ? deepSeekApi.streamUrl()
            : provider === "openai"
                ? openaiApi.streamUrl()
                : provider === "gemini"
                    ? geminiApi.streamUrl()
                    : chatApi.streamUrl();
        // Push an initial empty assistant message block
        const assistantMsg = ref({ role: "assistant", content: "", media: [] });
        targetMessages.push(assistantMsg.value);
        scrollChatToBottom();
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: targetMessages.slice(0, -1).map(x => ({ role: x.role, content: x.content })),
                    mode: provider === "gemini" ? geminiMode.value : undefined,
                    documentIds: provider === "gemini" ? selectedDocIds.value : undefined,
                    model: provider === "gemini" ? selectedGeminiModel.value : undefined
                }),
                signal: chatAbortController.value.signal
            });
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            const reader = response.body ? response.body.getReader() : null;
            if (!reader)
                throw new Error("ReadableStream not supported on response");
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let currentEvent = "message";
            let inReasoningBlock = false;
            let rafScrollPending = false;
            const throttledScroll = () => {
                if (!rafScrollPending) {
                    rafScrollPending = true;
                    requestAnimationFrame(() => {
                        scrollChatToBottom();
                        rafScrollPending = false;
                    });
                }
            };
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Save partial line to buffer
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) {
                        currentEvent = "message";
                        continue;
                    }
                    if (trimmed.startsWith("event:")) {
                        currentEvent = trimmed.substring(6).trim();
                    }
                    else if (trimmed.startsWith("data:")) {
                        const rawToken = line.substring(5);
                        const dataToken = rawToken === "" ? "\n" : rawToken;
                        if (dataToken.trim() === "[DONE]")
                            break;
                        if (currentEvent === "error") {
                            assistantMsg.value.content += "\n[Error: " + dataToken.trim() + "]";
                        }
                        else if (currentEvent === "reasoning") {
                            // Properly accumulate reasoning tokens inside a single <think> block
                            if (!inReasoningBlock) {
                                assistantMsg.value.content += "<think>\n";
                                inReasoningBlock = true;
                            }
                            assistantMsg.value.content += dataToken;
                        }
                        else {
                            // First non-reasoning token: close the reasoning block if open
                            if (inReasoningBlock) {
                                assistantMsg.value.content += "\n</think>\n\n";
                                inReasoningBlock = false;
                            }
                            if (currentEvent === "media") {
                                try {
                                    const mediaPayload = JSON.parse(dataToken.trim());
                                    if (mediaPayload?.type && mediaPayload?.url) {
                                        assistantMsg.value.media = [...(assistantMsg.value.media || []), { type: mediaPayload.type, url: mediaPayload.url }];
                                    }
                                }
                                catch {
                                    assistantMsg.value.content += dataToken;
                                }
                            }
                            else {
                                // Preserve spaces and newlines
                                assistantMsg.value.content += dataToken;
                            }
                        }
                        throttledScroll();
                    }
                    else if (trimmed.startsWith("error:")) {
                        assistantMsg.value.content += "\n[Error: " + trimmed.substring(6).trim() + "]";
                        throttledScroll();
                    }
                }
            }
            // Close any unclosed reasoning block (edge case: stream ended mid-think)
            if (inReasoningBlock) {
                assistantMsg.value.content += "\n</think>\n\n";
            }
            saveActiveSession(provider);
            finishTask(task, "success", t("chat.qaSuccess"));
        }
        catch (err) {
            if (err?.name === "AbortError" || chatAbortController.value === null) {
                finishTask(task, "failed", t("chat.qaAborted"));
                return;
            }
            finishTask(task, "failed", err?.message || t("chat.qaFailed"));
            assistantMsg.value.content += "\n[Stream Error: " + (err?.message || "connection closed") + "]";
            addLog("Error streaming from AI: " + err.message);
        }
        finally {
            isThinking.value = false;
            chatAbortController.value = null;
        }
    }
};
const handleStop = () => {
    if (chatAbortController.value) {
        chatAbortController.value.abort();
        chatAbortController.value = null;
    }
    isThinking.value = false;
    addNotification("info", t("chat.qaAborted"), "");
    addLog("AI generation aborted by user");
};
const copyToClipboard = (text, index) => {
    if (!text)
        return;
    navigator.clipboard.writeText(text).then(() => {
        copiedIndex.value = index;
        setTimeout(() => {
            if (copiedIndex.value === index) {
                copiedIndex.value = null;
            }
        }, 2000);
    }).catch(err => {
        console.error("Failed to copy text: ", err);
    });
};
const switchProvider = (provider) => {
    activeView.value = "chat";
    activeProvider.value = provider;
    syncMessagesFromSession(provider);
    scrollChatToBottom();
};
const openHome = () => {
    activeView.value = "home";
};
const openSpeech = async () => {
    activeProvider.value = "minimax";
    activeView.value = "speech";
    await Promise.all([loadVoices(), loadHistories()]);
};
const openMiniMaxHistory = async (view) => {
    activeProvider.value = "minimax";
    activeView.value = view;
    await loadHistories();
};
const openLogs = async () => {
    activeView.value = "logs";
    await loadLogEntries();
};
const openApiStatus = async () => {
    activeView.value = "apiStatus";
    await loadApiStatus();
};
const openDiagnostics = async () => {
    activeView.value = "diagnostics";
    await Promise.all([loadApiStatus(), loadHistories(), loadLogEntries()]);
};
const openAssets = async () => {
    activeView.value = "assets";
    await loadHistories();
};
const openExports = async () => {
    activeView.value = "exports";
    await Promise.all([loadHistories(), loadLogEntries()]);
};
const openSettings = () => {
    activeView.value = "settings";
    loadSettings();
};
const loadDataManagementStatus = async () => {
    dataManagementLoading.value = true;
    try {
        const res = await dataManagementApi.status();
        dataManagementStatus.value = res.data;
        selectedDataMode.value = res.data?.mode || "json";
    }
    catch (err) {
        addNotification("error", t("dataManagement.connectionFailed"), err?.message || "unknown error");
    }
    finally {
        dataManagementLoading.value = false;
    }
};
const switchDataSourceMode = async (mode) => {
    selectedDataMode.value = mode;
    dataManagementLoading.value = true;
    connectionTestResult.value = null;
    try {
        const res = await dataManagementApi.switchMode(mode);
        if (res.data?.status)
            dataManagementStatus.value = res.data.status;
        selectedDataMode.value = res.data?.mode || dataManagementStatus.value?.mode || "json";
        const success = res.data?.success || false;
        const message = res.data?.message || "";
        connectionTestResult.value = { success, message };
        addNotification(success ? "success" : "warning", success ? t("dataManagement.switchSuccess") : t("dataManagement.switchFailed"), message);
    }
    catch (err) {
        selectedDataMode.value = dataManagementStatus.value?.mode || "json";
        const message = err?.message || "unknown error";
        connectionTestResult.value = { success: false, message };
        addNotification("error", t("dataManagement.switchFailed"), message);
    }
    finally {
        dataManagementLoading.value = false;
    }
};
const testDataConnection = async () => {
    dataManagementLoading.value = true;
    connectionTestResult.value = null;
    try {
        const res = await dataManagementApi.testConnection(selectedDataMode.value);
        const success = res.data?.success || false;
        const message = res.data?.message || "";
        connectionTestResult.value = { success, message };
        addNotification(success ? "success" : "warning", success ? t("dataManagement.connectionSuccess") : t("dataManagement.connectionFailed"), message);
        await loadDataManagementStatus();
    }
    catch (err) {
        const message = err?.message || "unknown error";
        connectionTestResult.value = { success: false, message };
        addNotification("error", t("dataManagement.connectionFailed"), message);
    }
    finally {
        dataManagementLoading.value = false;
    }
};
const testPostgreSqlConnection = async () => {
    dataManagementLoading.value = true;
    connectionTestResult.value = null;
    try {
        const res = await dataManagementApi.testConnection("postgresql");
        const success = res.data?.success || false;
        const message = res.data?.message || "";
        connectionTestResult.value = { success, message };
        addNotification(success ? "success" : "warning", success ? t("dataManagement.connectionSuccess") : t("dataManagement.connectionFailed"), message);
        await loadDataManagementStatus();
    }
    catch (err) {
        const message = err?.message || "unknown error";
        connectionTestResult.value = { success: false, message };
        addNotification("error", t("dataManagement.connectionFailed"), message);
    }
    finally {
        dataManagementLoading.value = false;
    }
};
const openDataManagement = () => {
    activeView.value = "dataManagement";
    loadDataManagementStatus();
};
const clearCurrentConversation = () => {
    if (activeProvider.value === "minimax")
        minimaxMessages.value = [];
    else if (activeProvider.value === "deepseek")
        deepSeekMessages.value = [];
    else if (activeProvider.value === "openai")
        openaiMessages.value = [];
    else
        geminiMessages.value = [];
    saveActiveSession(activeProvider.value);
};
const clearSession = (provider) => {
    const session = chatSessions.value.find(item => item.id === activeSessionIds.value[provider]);
    if (session) {
        session.messages = [];
        session.updatedAt = new Date().toISOString();
    }
    if (provider === "minimax")
        minimaxMessages.value = [];
    else if (provider === "deepseek")
        deepSeekMessages.value = [];
    else if (provider === "openai")
        openaiMessages.value = [];
    else
        geminiMessages.value = [];
    saveSessions();
};
const savePromptTemplates = () => {
    localStorage.setItem("weizhi.promptTemplates", JSON.stringify(promptTemplates.value));
};
const addPromptTemplate = () => {
    if (!promptDraft.value.title.trim() || !promptDraft.value.content.trim())
        return;
    promptTemplates.value.unshift({
        id: String(Date.now()),
        title: promptDraft.value.title.trim(),
        content: promptDraft.value.content.trim(),
        provider: promptDraft.value.provider
    });
    promptDraft.value = { title: "", content: "", provider: "通用" };
    savePromptTemplates();
};
const deletePromptTemplate = (id) => {
    promptTemplates.value = promptTemplates.value.filter(item => item.id !== id);
    savePromptTemplates();
};
const usePromptTemplate = (template) => {
    activeView.value = "chat";
    if (template.provider === "MiniMax")
        activeProvider.value = "minimax";
    if (template.provider === "DeepSeek")
        activeProvider.value = "deepseek";
    let content = template.content;
    const variables = Array.from(new Set([...content.matchAll(/\{([^{}]+)\}/g)].map(match => match[1].trim()).filter(Boolean)));
    for (const variable of variables) {
        const value = window.prompt(`${t("prompt.fillVariable")} ${variable}`, "");
        if (value === null)
            return;
        const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        content = content.replace(new RegExp(`\\{${escaped}\\}`, "g"), value);
    }
    inputText.value = content;
    addNotification("info", t("prompt.applySuccess"), template.title);
    scrollChatToBottom();
};
provide('appState', {
    activeView, activeProvider, showMiniMaxSubnav, unreadNotificationCount, currentTheme, locale,
    openHome, switchProvider, openSpeech, openMiniMaxHistory, markNotificationsRead,
    openAssets, openDiagnostics, openExports, openApiStatus, openLogs, openSettings, openDataManagement,
    setLang, setTheme, clearCurrentConversation, chatSessions, taskQueue, favorites,
    inputText, voices
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
/** @type {[typeof AppBackground, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(AppBackground, new AppBackground({}));
const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-container glass-layout" },
    ...{ class: (__VLS_ctx.activeView === 'home' ? 'provider-home' : `provider-${__VLS_ctx.activeProvider}`) },
    ...{ style: ({
            '--sidebar-width': `${__VLS_ctx.sidebarWidth}px`
        }) },
});
/** @type {[typeof FloatingSidebar, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(FloatingSidebar, new FloatingSidebar({}));
const __VLS_4 = __VLS_3({}, ...__VLS_functionalComponentArgsRest(__VLS_3));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onMousedown: (...[$event]) => {
            __VLS_ctx.startResize('sidebar', $event);
        } },
    ...{ class: "vertical-resizer sidebar-resizer glass-resizer" },
});
/** @type {[typeof FloatingMainPanel, typeof FloatingMainPanel, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(FloatingMainPanel, new FloatingMainPanel({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_8.slots.default;
if (__VLS_ctx.activeView === 'home') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "home-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "home-hero" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "home-copy" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
    (__VLS_ctx.$t("home.welcomeTitle"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("home.welcomeDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "home-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeView === 'home'))
                    return;
                __VLS_ctx.switchProvider('minimax');
            } },
        ...{ class: "preview-btn" },
    });
    (__VLS_ctx.$t("home.enterMinimax"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeView === 'home'))
                    return;
                __VLS_ctx.switchProvider('deepseek');
            } },
        ...{ class: "preview-btn secondary" },
    });
    (__VLS_ctx.$t("home.enterDeepseek"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeView === 'home'))
                    return;
                __VLS_ctx.switchProvider('openai');
            } },
        ...{ class: "preview-btn secondary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeView === 'home'))
                    return;
                __VLS_ctx.switchProvider('gemini');
            } },
        ...{ class: "preview-btn secondary" },
    });
    (__VLS_ctx.$t("home.enterGemini"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openAssets) },
        ...{ class: "preview-btn secondary" },
    });
    (__VLS_ctx.$t("home.viewAssets"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "home-overview" },
    });
    for (const [stat] of __VLS_getVForSourceType((__VLS_ctx.dashboardStats))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeView === 'home'))
                        return;
                    stat.label === __VLS_ctx.$t('dashboard.tasks') ? __VLS_ctx.activeView = 'tasks' : stat.label === __VLS_ctx.$t('dashboard.sessions') ? __VLS_ctx.activeView = 'sessions' : stat.label === __VLS_ctx.$t('dashboard.assets') ? __VLS_ctx.openAssets() : __VLS_ctx.activeView = 'favorites';
                } },
            key: (stat.label),
            ...{ class: "home-tile" },
        });
        const __VLS_9 = {}.Activity;
        /** @type {[typeof __VLS_components.Activity, ]} */ ;
        // @ts-ignore
        const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
            size: (18),
        }));
        const __VLS_11 = __VLS_10({
            size: (18),
        }, ...__VLS_functionalComponentArgsRest(__VLS_10));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (stat.value);
        (stat.label);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (stat.detail);
    }
    if (__VLS_ctx.recentNotifications.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "home-notices" },
        });
        for (const [notice] of __VLS_getVForSourceType((__VLS_ctx.recentNotifications))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (notice.id),
                ...{ class: "home-notice" },
                ...{ class: (`notice-${notice.level}`) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (notice.title);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (notice.message);
        }
    }
}
else if (__VLS_ctx.activeView === 'dataManagement') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-view" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("dataManagement.title"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("dataManagement.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadDataManagementStatus) },
        ...{ class: "log-action" },
        disabled: (__VLS_ctx.dataManagementLoading),
    });
    (__VLS_ctx.$t("apiStatus.refresh"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.testDataConnection) },
        ...{ class: "log-action" },
        disabled: (__VLS_ctx.dataManagementLoading),
    });
    (__VLS_ctx.$t("dataManagement.testConnection"));
    if (__VLS_ctx.connectionTestResult) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "home-notice" },
            ...{ class: (__VLS_ctx.connectionTestResult.success ? 'notice-success' : 'notice-error') },
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
            ...{ style: {} },
        });
        (__VLS_ctx.connectionTestResult.success ? __VLS_ctx.$t("dataManagement.connectionSuccess") : __VLS_ctx.$t("dataManagement.connectionFailed"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
        (__VLS_ctx.connectionTestResult.message);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!(__VLS_ctx.connectionTestResult))
                        return;
                    __VLS_ctx.connectionTestResult = null;
                } },
            ...{ class: "icon-btn" },
            ...{ style: {} },
        });
        const __VLS_13 = {}.X;
        /** @type {[typeof __VLS_components.X, ]} */ ;
        // @ts-ignore
        const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
            size: (14),
        }));
        const __VLS_15 = __VLS_14({
            size: (14),
        }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-card minimax-card wide-status" },
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-card-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("dataManagement.currentMode"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "provider-toggle" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                __VLS_ctx.switchDataSourceMode('json');
            } },
        ...{ class: "toggle-pill" },
        ...{ class: ({ active: __VLS_ctx.selectedDataMode === 'json' }) },
        disabled: (__VLS_ctx.dataManagementLoading),
    });
    (__VLS_ctx.$t("dataManagement.jsonMode"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                __VLS_ctx.switchDataSourceMode('postgresql');
            } },
        ...{ class: "toggle-pill" },
        ...{ class: ({ active: __VLS_ctx.selectedDataMode === 'postgresql' }) },
        disabled: (__VLS_ctx.dataManagementLoading),
    });
    (__VLS_ctx.$t("dataManagement.postgresqlMode"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ style: {} },
    });
    (__VLS_ctx.dataManagementStatus?.postgresql?.message || __VLS_ctx.$t("dataManagement.postgresqlUnavailable"));
    for (const [card] of __VLS_getVForSourceType((__VLS_ctx.dataFileCards))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            key: (card.key),
            ...{ class: "settings-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "settings-card-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (card.label);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: (card.info.exists ? 'active' : 'inactive') },
        });
        (card.info.exists ? __VLS_ctx.$t("dataManagement.exists") : __VLS_ctx.$t("dataManagement.missing"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ style: {} },
        });
        (card.info.recordCount || 0);
        (__VLS_ctx.$t("dataManagement.records"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({
            ...{ style: {} },
        });
        (card.info.path || "");
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-card-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("dataManagement.postgresqlStatus"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: (__VLS_ctx.postgresqlInfo.ready ? 'active' : 'inactive') },
    });
    (__VLS_ctx.postgresqlInfo.ready ? __VLS_ctx.$t("apiStatus.statusOk") : __VLS_ctx.$t("apiStatus.statusPending"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ style: {} },
    });
    (__VLS_ctx.postgresqlInfo.message || __VLS_ctx.$t("dataManagement.postgresqlUnavailable"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("dataManagement.host"));
    (__VLS_ctx.postgresqlInfo.host || "-");
    (__VLS_ctx.postgresqlInfo.port || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("dataManagement.database"));
    (__VLS_ctx.postgresqlInfo.database || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("dataManagement.username"));
    (__VLS_ctx.postgresqlInfo.username || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("dataManagement.jdbcUrl"));
    (__VLS_ctx.postgresqlInfo.jdbcUrl || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.testPostgreSqlConnection) },
        ...{ class: "log-action" },
        ...{ style: {} },
        disabled: (__VLS_ctx.dataManagementLoading),
    });
    (__VLS_ctx.$t("dataManagement.testPostgresql"));
}
else if (__VLS_ctx.activeView === 'settings') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-view" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("settings.title"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("settings.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadSettings) },
        ...{ class: "icon-btn" },
        title: (__VLS_ctx.$t('settings.refresh')),
        disabled: (__VLS_ctx.settingsLoading),
    });
    const __VLS_17 = {}.RefreshCw;
    /** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        size: (15),
    }));
    const __VLS_19 = __VLS_18({
        size: (15),
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-card minimax-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-card-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.settingsState?.minimax?.apiKeyConfigured ? __VLS_ctx.settingsState?.minimax?.apiKeyMasked : __VLS_ctx.$t("apiStatus.notConfigured"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        placeholder: (__VLS_ctx.$t('settings.emptyKey')),
    });
    (__VLS_ctx.settingsDraft.minimax.apiKey);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    (__VLS_ctx.$t("settings.modelLabel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.settingsDraft.minimax.model),
    });
    for (const [model] of __VLS_getVForSourceType((__VLS_ctx.minimaxModels))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (model.id),
            value: (model.id),
        });
        (model.name || model.id);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!(__VLS_ctx.activeView === 'settings'))
                    return;
                __VLS_ctx.refreshProviderModels('minimax');
            } },
        ...{ class: "preview-btn secondary" },
    });
    (__VLS_ctx.$t("settings.refreshModel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!(__VLS_ctx.activeView === 'settings'))
                    return;
                __VLS_ctx.saveProviderSettings('minimax');
            } },
        ...{ class: "save-settings-btn" },
        disabled: (__VLS_ctx.settingsLoading),
    });
    (__VLS_ctx.$t("settings.saveMinimax"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-card deepseek-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-card-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.settingsState?.deepseek?.apiKeyConfigured ? __VLS_ctx.settingsState?.deepseek?.apiKeyMasked : __VLS_ctx.$t("apiStatus.notConfigured"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        placeholder: (__VLS_ctx.$t('settings.emptyKey')),
    });
    (__VLS_ctx.settingsDraft.deepseek.apiKey);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    (__VLS_ctx.$t("settings.modelLabel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.settingsDraft.deepseek.model),
    });
    for (const [model] of __VLS_getVForSourceType((__VLS_ctx.deepSeekModels))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (model.id),
            value: (model.id),
        });
        (model.name || model.id);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!(__VLS_ctx.activeView === 'settings'))
                    return;
                __VLS_ctx.refreshProviderModels('deepseek');
            } },
        ...{ class: "preview-btn secondary" },
    });
    (__VLS_ctx.$t("settings.refreshModel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!(__VLS_ctx.activeView === 'settings'))
                    return;
                __VLS_ctx.saveProviderSettings('deepseek');
            } },
        ...{ class: "save-settings-btn deepseek-save" },
        disabled: (__VLS_ctx.settingsLoading),
    });
    (__VLS_ctx.$t("settings.saveDeepseek"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "settings-hint" },
    });
    (__VLS_ctx.$t("settings.deepseekHint"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-card openai-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-card-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.settingsState?.openai?.apiKeyConfigured ? __VLS_ctx.settingsState?.openai?.apiKeyMasked : __VLS_ctx.$t("apiStatus.notConfigured"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.settingsDraft.openai.baseUrl),
        type: "text",
        placeholder: "https://api.openai.com/v1",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        placeholder: (__VLS_ctx.$t('settings.emptyKey')),
    });
    (__VLS_ctx.settingsDraft.openai.apiKey);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    (__VLS_ctx.$t("settings.modelLabel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.settingsDraft.openai.model),
    });
    for (const [model] of __VLS_getVForSourceType((__VLS_ctx.openaiModels))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (model.id),
            value: (model.id),
        });
        (model.name || model.id);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!(__VLS_ctx.activeView === 'settings'))
                    return;
                __VLS_ctx.refreshProviderModels('openai');
            } },
        ...{ class: "preview-btn secondary" },
    });
    (__VLS_ctx.$t("settings.refreshModel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!(__VLS_ctx.activeView === 'settings'))
                    return;
                __VLS_ctx.saveProviderSettings('openai');
            } },
        ...{ class: "save-settings-btn" },
        disabled: (__VLS_ctx.settingsLoading),
    });
    (__VLS_ctx.$t("settings.saveOpenai"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "settings-card gemini-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-card-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.settingsState?.gemini?.apiKeyConfigured ? __VLS_ctx.settingsState?.gemini?.apiKeyMasked : __VLS_ctx.$t("apiStatus.notConfigured"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.settingsDraft.gemini.baseUrl),
        type: "text",
        placeholder: "http://127.0.0.1:8045/v1",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "password",
        placeholder: (__VLS_ctx.$t('settings.emptyKey')),
    });
    (__VLS_ctx.settingsDraft.gemini.apiKey);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    (__VLS_ctx.$t("settings.modelLabel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "settings-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.settingsDraft.gemini.model),
    });
    for (const [model] of __VLS_getVForSourceType((__VLS_ctx.geminiModels))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (model.id),
            value: (model.id),
        });
        (model.name || model.id);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!(__VLS_ctx.activeView === 'settings'))
                    return;
                __VLS_ctx.refreshProviderModels('gemini');
            } },
        ...{ class: "preview-btn secondary" },
    });
    (__VLS_ctx.$t("settings.refreshModel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!(__VLS_ctx.activeView === 'settings'))
                    return;
                __VLS_ctx.saveProviderSettings('gemini');
            } },
        ...{ class: "save-settings-btn" },
        disabled: (__VLS_ctx.settingsLoading),
    });
    (__VLS_ctx.$t("settings.saveGemini"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "gemini-probe-section" },
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!(__VLS_ctx.activeView === 'settings'))
                    return;
                __VLS_ctx.handleGeminiProbe(false);
            } },
        ...{ class: "preview-btn secondary" },
        disabled: (__VLS_ctx.geminiProbeLoading),
        ...{ style: {} },
    });
    if (__VLS_ctx.geminiProbeLoading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ style: {} },
    });
    (__VLS_ctx.geminiCapabilities?.baseUrl || 'http://127.0.0.1:8045/v1');
    if (__VLS_ctx.geminiCapabilities?.checkedAt) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
        (new Date(__VLS_ctx.geminiCapabilities.checkedAt).toLocaleTimeString());
    }
    if (__VLS_ctx.geminiCapabilities?.accountEmail) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
        (__VLS_ctx.geminiCapabilities.accountEmail);
    }
    if (__VLS_ctx.geminiCapabilities?.models && __VLS_ctx.geminiCapabilities.models.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
        for (const [m] of __VLS_getVForSourceType((__VLS_ctx.geminiCapabilities.models))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                key: (m.id),
                ...{ style: {} },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ style: {} },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ style: ({ color: m.available ? '#60a5fa' : '#9ca3af' }) },
            });
            (m.id);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ style: {} },
            });
            (m.group);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ style: {} },
            });
            if (m.available) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ style: {} },
                });
                (m.errorType);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ style: {} },
            });
            (m.available ? m.latencyMs + 'ms' : '--');
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ style: {} },
            });
            if (m.mappedModel) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ style: {} },
                    title: (m.mappedModel),
                });
                (m.mappedModel);
            }
            if (m.accountEmail) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ style: {} },
                    title: (m.accountEmail),
                });
                (m.accountEmail);
            }
            if (!m.mappedModel && !m.accountEmail) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ style: {} },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ style: {} },
                title: (m.recommendedUse),
            });
            (m.recommendedUse);
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ style: {} },
        });
    }
}
else if (__VLS_ctx.activeView === 'logs') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page logs-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("logs.title"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("logs.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "log-controls page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        ...{ onChange: (__VLS_ctx.loadLogEntries) },
        value: (__VLS_ctx.logLevel),
        ...{ class: "log-level-select" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    (__VLS_ctx.$t("logs.allLevels"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "ERROR",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "WARN",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "INFO",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "DEBUG",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onKeydown: (__VLS_ctx.loadLogEntries) },
        ...{ class: "log-search" },
        placeholder: (__VLS_ctx.$t('logs.searchPlaceholder')),
    });
    (__VLS_ctx.logQuery);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadLogEntries) },
        ...{ class: "log-action" },
        disabled: (__VLS_ctx.logLoading),
    });
    (__VLS_ctx.$t("logs.refresh"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearLogEntries) },
        ...{ class: "log-action danger" },
    });
    (__VLS_ctx.$t("logs.clear"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body log-body-page" },
        ref: "logContainer",
    });
    /** @type {typeof __VLS_ctx.logContainer} */ ;
    if (__VLS_ctx.logEntries.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "structured-log-list" },
        });
        for (const [entry] of __VLS_getVForSourceType((__VLS_ctx.logEntries))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (entry.id),
                ...{ class: "structured-log" },
                ...{ class: (__VLS_ctx.logLevelClass(entry.level)) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "log-time" },
            });
            (__VLS_ctx.formatLogTime(entry.timestamp));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "log-level" },
            });
            (entry.level);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "log-thread" },
            });
            (entry.thread);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "log-logger" },
                title: (entry.logger),
            });
            (entry.logger);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "log-message" },
            });
            (entry.message);
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "log-empty" },
        });
        (__VLS_ctx.$t("logs.empty"));
    }
}
else if (__VLS_ctx.activeView === 'speech') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("speech.title"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("speech.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadVoices) },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("speech.refreshVoices"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!(__VLS_ctx.activeView === 'speech'))
                    return;
                __VLS_ctx.openMiniMaxHistory('ttsHistory');
            } },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("speech.viewHistory"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body speech-layout" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "speech-composer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    (__VLS_ctx.$t("speech.textLabel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
        value: (__VLS_ctx.previewText),
        ...{ class: "tts-preview-input speech-textarea" },
        placeholder: (__VLS_ctx.$t('speech.textPlaceholder')),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "speech-presets" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "preset-label" },
    });
    (__VLS_ctx.$t("speech.presetLabel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preset-groups" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preset-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "group-title" },
    });
    (__VLS_ctx.$t("speech.shortText"));
    for (const [ex] of __VLS_getVForSourceType((__VLS_ctx.shortExamples))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!(__VLS_ctx.activeView === 'speech'))
                        return;
                    __VLS_ctx.previewText = ex.text;
                } },
            key: (ex.label),
            ...{ class: "preset-btn" },
            title: (ex.text),
        });
        (ex.label);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preset-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "group-title" },
    });
    (__VLS_ctx.$t("speech.longText"));
    for (const [ex] of __VLS_getVForSourceType((__VLS_ctx.longExamples))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!(__VLS_ctx.activeView === 'speech'))
                        return;
                    __VLS_ctx.previewText = ex.text;
                } },
            key: (ex.label),
            ...{ class: "preset-btn" },
            title: (ex.text),
        });
        (ex.label);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "voice-selector-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "voice-selector-title" },
    });
    (__VLS_ctx.$t("speech.voiceLabel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "voice-tabs" },
    });
    for (const [tab] of __VLS_getVForSourceType((__VLS_ctx.voiceTabs))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!(__VLS_ctx.activeView === 'speech'))
                        return;
                    __VLS_ctx.activeVoiceTab = tab;
                } },
            key: (tab),
            ...{ class: "voice-tab-btn" },
            ...{ class: ({ active: __VLS_ctx.activeVoiceTab === tab }) },
        });
        (tab);
        (__VLS_ctx.voiceTabCounts[tab] || 0);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "voice-cards-grid" },
    });
    for (const [v] of __VLS_getVForSourceType((__VLS_ctx.filteredVoices))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!(__VLS_ctx.activeView === 'speech'))
                        return;
                    __VLS_ctx.previewVoiceId = v.voiceId;
                } },
            key: (v.voiceId),
            ...{ class: "voice-card" },
            ...{ class: ({ active: __VLS_ctx.previewVoiceId === v.voiceId }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "voice-card-body" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "voice-card-name" },
        });
        (v.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "voice-card-id" },
        });
        (v.voiceId);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "voice-card-desc" },
            title: (v.description),
        });
        (v.description);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "speech-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    (__VLS_ctx.$t("speech.formatLabel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.previewFormat),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "mp3",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "wav",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "flac",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        step: "0.1",
        min: "0.5",
        max: "2",
    });
    (__VLS_ctx.previewSpeed);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        step: "0.1",
        min: "0.1",
        max: "2",
    });
    (__VLS_ctx.previewVol);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        step: "1",
        min: "-12",
        max: "12",
    });
    (__VLS_ctx.previewPitch);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        step: "1000",
    });
    (__VLS_ctx.previewSampleRate);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        step: "1000",
    });
    (__VLS_ctx.previewBitrate);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "speech-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handlePreview) },
        ...{ class: "preview-btn" },
        disabled: (__VLS_ctx.previewLoading),
    });
    (__VLS_ctx.previewLoading ? __VLS_ctx.$t("speech.generating") : __VLS_ctx.$t("speech.previewBtn"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleGenerateTts) },
        ...{ class: "preview-btn secondary" },
        disabled: (__VLS_ctx.generateLoading),
    });
    (__VLS_ctx.generateLoading ? __VLS_ctx.$t("speech.generating") : __VLS_ctx.$t("speech.generateBtn"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "speech-result" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "speech-result-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("speech.outputPreview"));
    if (__VLS_ctx.ttsHistories.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.clearTtsHistory) },
            ...{ class: "log-action danger" },
        });
        (__VLS_ctx.$t("history.clearTts"));
    }
    if (__VLS_ctx.ttsHistories.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "speech-result-list" },
        });
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.ttsHistories))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (String(item.id)),
                ...{ class: "speech-audio-card" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "audio-card-meta" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "audio-tag" },
                ...{ class: (item.preview ? 'preview-tag' : 'full-tag') },
            });
            (item.preview ? __VLS_ctx.$t("speech.previewBtn") : __VLS_ctx.$t("speech.generateBtn"));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "audio-voice" },
            });
            (item.voiceId);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "audio-time" },
            });
            (__VLS_ctx.formatLogTime(item.createdAt));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "audio-text" },
                title: (item.text),
            });
            (item.text);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.audio)({
                src: (__VLS_ctx.mediaUrl(String(item.audioUrl || ''))),
                controls: true,
                ...{ class: "audio-player" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "audio-actions" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeView === 'home'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'dataManagement'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'settings'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'logs'))
                            return;
                        if (!(__VLS_ctx.activeView === 'speech'))
                            return;
                        if (!(__VLS_ctx.ttsHistories.length))
                            return;
                        __VLS_ctx.favoriteAsset({ id: String(item.id), type: 'audio', title: String(item.text || __VLS_ctx.$t('history.defaultTtsText')), subtitle: `${item.voiceId || 'voice'} · ${item.format || 'audio'} · ${item.preview ? 'preview' : 'tts'}`, url: String(item.audioUrl || '') });
                    } },
                ...{ class: "icon-btn-small" },
                title: (__VLS_ctx.$t('assets.favorite')),
            });
            const __VLS_21 = {}.Star;
            /** @type {[typeof __VLS_components.Star, ]} */ ;
            // @ts-ignore
            const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
                size: (12),
            }));
            const __VLS_23 = __VLS_22({
                size: (12),
            }, ...__VLS_functionalComponentArgsRest(__VLS_22));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeView === 'home'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'dataManagement'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'settings'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'logs'))
                            return;
                        if (!(__VLS_ctx.activeView === 'speech'))
                            return;
                        if (!(__VLS_ctx.ttsHistories.length))
                            return;
                        __VLS_ctx.downloadAsset({ id: String(item.id), type: 'audio', title: String(item.text || __VLS_ctx.$t('history.defaultTtsText')), subtitle: `${item.voiceId || 'voice'} · ${item.format || 'audio'} · ${item.preview ? 'preview' : 'tts'}`, url: String(item.audioUrl || '') });
                    } },
                ...{ class: "icon-btn-small" },
                title: (__VLS_ctx.$t('assets.download')),
            });
            const __VLS_25 = {}.Download;
            /** @type {[typeof __VLS_components.Download, ]} */ ;
            // @ts-ignore
            const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
                size: (12),
            }));
            const __VLS_27 = __VLS_26({
                size: (12),
            }, ...__VLS_functionalComponentArgsRest(__VLS_26));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeView === 'home'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'dataManagement'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'settings'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'logs'))
                            return;
                        if (!(__VLS_ctx.activeView === 'speech'))
                            return;
                        if (!(__VLS_ctx.ttsHistories.length))
                            return;
                        __VLS_ctx.deleteTtsHistory(String(item.id));
                    } },
                ...{ class: "icon-btn-small danger" },
                title: (__VLS_ctx.$t('chat.delete')),
            });
            const __VLS_29 = {}.Trash2;
            /** @type {[typeof __VLS_components.Trash2, ]} */ ;
            // @ts-ignore
            const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
                size: (12),
            }));
            const __VLS_31 = __VLS_30({
                size: (12),
            }, ...__VLS_functionalComponentArgsRest(__VLS_30));
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-module" },
        });
        (__VLS_ctx.$t("speech.emptyOutput"));
    }
}
else if (__VLS_ctx.activeView === 'translation') {
    /** @type {[typeof TranslationView, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(TranslationView, new TranslationView({}));
    const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
}
else if (__VLS_ctx.activeView === 'sessions') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("nav.sessions"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("history.minimaxImageDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!(__VLS_ctx.activeView === 'sessions'))
                    return;
                __VLS_ctx.createSession('minimax');
            } },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("chat.newMinimaxName"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!(__VLS_ctx.activeView === 'sessions'))
                    return;
                __VLS_ctx.createSession('deepseek');
            } },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("chat.newDeepseekName"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body session-grid" },
    });
    for (const [session] of __VLS_getVForSourceType((__VLS_ctx.sessionSummaries))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (session.id),
            ...{ class: "session-card" },
            ...{ class: (`${session.provider}-session-card`) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (session.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.providerMeta[session.provider].label);
        (session.subtitle);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (session.last);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "session-card-footer" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        (session.count);
        (__VLS_ctx.$t("chat.msgCount"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    __VLS_ctx.openSession(session);
                } },
            ...{ class: "log-action" },
        });
        (__VLS_ctx.$t("chat.continue"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    __VLS_ctx.renameSession(session);
                } },
            ...{ class: "log-action" },
        });
        (__VLS_ctx.$t("chat.rename"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    __VLS_ctx.deleteSession(session);
                } },
            ...{ class: "log-action danger" },
        });
        (__VLS_ctx.$t("chat.delete"));
    }
}
else if (__VLS_ctx.activeView === 'tasks') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("tasks.title"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("tasks.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearFinishedTasks) },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("tasks.clearFinished"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body task-list" },
    });
    for (const [task] of __VLS_getVForSourceType((__VLS_ctx.taskQueue))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (task.id),
            ...{ class: "task-card" },
            ...{ class: (`task-${task.status}`) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "task-status" },
        });
        (task.status);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (task.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (task.detail);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (task.provider);
        (new Date(task.createdAt).toLocaleString("zh-CN", { hour12: false }));
    }
    if (!__VLS_ctx.taskQueue.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-module" },
        });
        (__VLS_ctx.$t("tasks.empty"));
    }
}
else if (__VLS_ctx.activeView === 'notifications') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("notifications.title"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("notifications.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.markNotificationsRead) },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("notifications.markAllRead"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!(__VLS_ctx.activeView === 'notifications'))
                    return;
                __VLS_ctx.notifications = [];
                __VLS_ctx.saveNotifications();
            } },
        ...{ class: "log-action danger" },
    });
    (__VLS_ctx.$t("notifications.clearAll"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body notification-list" },
    });
    for (const [notice] of __VLS_getVForSourceType((__VLS_ctx.notifications))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (notice.id),
            ...{ class: "notification-card" },
            ...{ class: ([`notice-${notice.level}`, { unread: !notice.read }]) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (notice.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (notice.message);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (new Date(notice.createdAt).toLocaleString("zh-CN", { hour12: false }));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    __VLS_ctx.removeNotification(notice.id);
                } },
            ...{ class: "icon-btn" },
        });
        const __VLS_36 = {}.X;
        /** @type {[typeof __VLS_components.X, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            size: (14),
        }));
        const __VLS_38 = __VLS_37({
            size: (14),
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    }
    if (!__VLS_ctx.notifications.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-module" },
        });
        (__VLS_ctx.$t("notifications.empty"));
    }
}
else if (__VLS_ctx.activeView === 'prompts') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("exports.promptsJsonDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("settings.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body prompt-layout" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "prompt-editor" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: (__VLS_ctx.$t('prompt.draftNamePlaceholder')),
    });
    (__VLS_ctx.promptDraft.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.promptDraft.provider),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "通用",
    });
    (__VLS_ctx.$t("prompt.providerGeneric"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "MiniMax",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "DeepSeek",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
        value: (__VLS_ctx.promptDraft.content),
        placeholder: (__VLS_ctx.$t('prompt.draftContentPlaceholder')),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.addPromptTemplate) },
        ...{ class: "preview-btn" },
    });
    (__VLS_ctx.$t("prompt.addBtn"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "prompt-list" },
    });
    for (const [template] of __VLS_getVForSourceType((__VLS_ctx.promptTemplates))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (template.id),
            ...{ class: "prompt-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "prompt-card-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (template.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (template.provider);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (template.content);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "page-controls" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    __VLS_ctx.usePromptTemplate(template);
                } },
            ...{ class: "log-action" },
        });
        (__VLS_ctx.$t("prompt.useBtn"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    __VLS_ctx.deletePromptTemplate(template.id);
                } },
            ...{ class: "log-action danger" },
        });
        (__VLS_ctx.$t("chat.delete"));
    }
}
else if (__VLS_ctx.activeView === 'apiStatus') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("nav.apiStatus"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("settings.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadApiStatus) },
        ...{ class: "log-action" },
        disabled: (__VLS_ctx.settingsLoading || __VLS_ctx.accountLoading),
    });
    (__VLS_ctx.$t("apiStatus.refresh"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openSettings) },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("settings.title"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body status-layout" },
    });
    for (const [card] of __VLS_getVForSourceType((__VLS_ctx.apiStatusCards))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (card.name),
            ...{ class: "status-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (card.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (card.status);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (card.detail);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "status-card wide-status" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("apiStatus.deepseekUsageTitle"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "usage-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("apiStatus.requests"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.deepSeekUsage?.requests || 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("apiStatus.promptTokens"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.deepSeekUsage?.promptTokens || 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("apiStatus.completionTokens"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.deepSeekUsage?.completionTokens || 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("apiStatus.totalTokens"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.deepSeekUsage?.totalTokens || 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openDeepSeekUsage) },
        ...{ class: "open-usage-btn" },
    });
    (__VLS_ctx.$t("apiStatus.openUsage"));
}
else if (__VLS_ctx.activeView === 'assets') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page assets-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("nav.assets"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("assets.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadHistories) },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("assets.refresh"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!(__VLS_ctx.activeView === 'assets'))
                    return;
                __VLS_ctx.exportJson('media');
            } },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("assets.exportIndex"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "assets-tabs-container" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "assets-tabs-wrapper" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "assets-tabs" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!(__VLS_ctx.activeView === 'assets'))
                    return;
                __VLS_ctx.activeAssetTab = 'all';
            } },
        ...{ class: "assets-tab-btn" },
        ...{ class: ({ active: __VLS_ctx.activeAssetTab === 'all' }) },
    });
    (__VLS_ctx.$t("assets.tabAll"));
    (__VLS_ctx.assetItems.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!(__VLS_ctx.activeView === 'assets'))
                    return;
                __VLS_ctx.activeAssetTab = 'image';
            } },
        ...{ class: "assets-tab-btn" },
        ...{ class: ({ active: __VLS_ctx.activeAssetTab === 'image' }) },
    });
    (__VLS_ctx.$t("assets.tabImages"));
    (__VLS_ctx.assetItems.filter(item => item.type === 'image').length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!(__VLS_ctx.activeView === 'assets'))
                    return;
                __VLS_ctx.activeAssetTab = 'audio';
            } },
        ...{ class: "assets-tab-btn" },
        ...{ class: ({ active: __VLS_ctx.activeAssetTab === 'audio' }) },
    });
    (__VLS_ctx.$t("assets.tabAudio"));
    (__VLS_ctx.assetItems.filter(item => item.type === 'audio').length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!(__VLS_ctx.activeView === 'assets'))
                    return;
                __VLS_ctx.activeAssetTab = 'document';
            } },
        ...{ class: "assets-tab-btn" },
        ...{ class: ({ active: __VLS_ctx.activeAssetTab === 'document' }) },
    });
    (__VLS_ctx.assetItems.filter(item => item.type === 'document').length);
    if (__VLS_ctx.filteredAssetItems.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "assets-batch-actions" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.toggleSelectAll) },
            ...{ class: "log-action" },
            ...{ class: ({ active: __VLS_ctx.selectedAssetKeys.length > 0 }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onClick: (__VLS_ctx.toggleSelectAll) },
            type: "checkbox",
            checked: (__VLS_ctx.isAllSelected),
            ...{ class: "batch-checkbox-input" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
        (__VLS_ctx.isAllSelected ? __VLS_ctx.$t("assets.deselectAll") : __VLS_ctx.$t("assets.selectAll"));
        if (__VLS_ctx.selectedAssetKeys.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "batch-selected-count" },
            });
            (__VLS_ctx.$t("assets.selectedCount", { count: __VLS_ctx.selectedAssetKeys.length }));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (__VLS_ctx.downloadSelectedAssets) },
                ...{ class: "log-action" },
            });
            const __VLS_40 = {}.Download;
            /** @type {[typeof __VLS_components.Download, ]} */ ;
            // @ts-ignore
            const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
                size: (14),
            }));
            const __VLS_42 = __VLS_41({
                size: (14),
            }, ...__VLS_functionalComponentArgsRest(__VLS_41));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t("assets.batchDownload"));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (__VLS_ctx.deleteSelectedAssets) },
                ...{ class: "log-action danger" },
            });
            const __VLS_44 = {}.Trash2;
            /** @type {[typeof __VLS_components.Trash2, ]} */ ;
            // @ts-ignore
            const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
                size: (14),
            }));
            const __VLS_46 = __VLS_45({
                size: (14),
            }, ...__VLS_functionalComponentArgsRest(__VLS_45));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t("assets.batchDelete"));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeView === 'home'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'dataManagement'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'settings'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'logs'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'speech'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'translation'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'sessions'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'tasks'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'notifications'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'prompts'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'apiStatus'))
                            return;
                        if (!(__VLS_ctx.activeView === 'assets'))
                            return;
                        if (!(__VLS_ctx.filteredAssetItems.length > 0))
                            return;
                        if (!(__VLS_ctx.selectedAssetKeys.length > 0))
                            return;
                        __VLS_ctx.selectedAssetKeys = [];
                    } },
                ...{ class: "log-action" },
            });
            (__VLS_ctx.$t("chat.cancel") || "取消");
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "asset-grid" },
    });
    for (const [asset] of __VLS_getVForSourceType((__VLS_ctx.filteredAssetItems))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!(__VLS_ctx.activeView === 'assets'))
                        return;
                    __VLS_ctx.toggleSelectAsset(`${asset.type}-${asset.id}`);
                } },
            key: (`${asset.type}-${asset.id}`),
            ...{ class: "asset-card" },
            ...{ class: ({ selected: __VLS_ctx.selectedAssetKeys.includes(`${asset.type}-${asset.id}`) }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!(__VLS_ctx.activeView === 'assets'))
                        return;
                    __VLS_ctx.toggleSelectAsset(`${asset.type}-${asset.id}`);
                } },
            type: "checkbox",
            checked: (__VLS_ctx.selectedAssetKeys.includes(`${asset.type}-${asset.id}`)),
            ...{ class: "card-select-checkbox" },
            ...{ class: ({
                    visible: __VLS_ctx.selectedAssetKeys.length > 0 || __VLS_ctx.selectedAssetKeys.includes(`${asset.type}-${asset.id}`)
                }) },
        });
        if (asset.type === 'image') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeView === 'home'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'dataManagement'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'settings'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'logs'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'speech'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'translation'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'sessions'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'tasks'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'notifications'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'prompts'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'apiStatus'))
                            return;
                        if (!(__VLS_ctx.activeView === 'assets'))
                            return;
                        if (!(asset.type === 'image'))
                            return;
                        __VLS_ctx.selectedAssetKeys.length > 0 ? __VLS_ctx.toggleSelectAsset(`${asset.type}-${asset.id}`) : __VLS_ctx.openAssetDetail(asset);
                    } },
                src: (__VLS_ctx.mediaUrl(asset.url)),
                alt: "asset image",
                ...{ class: "history-card-image" },
            });
        }
        else if (asset.type === 'audio') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeView === 'home'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'dataManagement'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'settings'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'logs'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'speech'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'translation'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'sessions'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'tasks'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'notifications'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'prompts'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'apiStatus'))
                            return;
                        if (!(__VLS_ctx.activeView === 'assets'))
                            return;
                        if (!!(asset.type === 'image'))
                            return;
                        if (!(asset.type === 'audio'))
                            return;
                        __VLS_ctx.selectedAssetKeys.length > 0 ? __VLS_ctx.toggleSelectAsset(`${asset.type}-${asset.id}`) : null;
                    } },
                ...{ class: "asset-audio-box" },
            });
            const __VLS_48 = {}.Volume2;
            /** @type {[typeof __VLS_components.Volume2, ]} */ ;
            // @ts-ignore
            const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
                size: (30),
            }));
            const __VLS_50 = __VLS_49({
                size: (30),
            }, ...__VLS_functionalComponentArgsRest(__VLS_49));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.audio)({
                ...{ onClick: () => { } },
                src: (__VLS_ctx.mediaUrl(asset.url)),
                controls: true,
                ...{ class: "audio-preview" },
            });
        }
        else if (asset.type === 'document') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeView === 'home'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'dataManagement'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'settings'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'logs'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'speech'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'translation'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'sessions'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'tasks'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'notifications'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'prompts'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'apiStatus'))
                            return;
                        if (!(__VLS_ctx.activeView === 'assets'))
                            return;
                        if (!!(asset.type === 'image'))
                            return;
                        if (!!(asset.type === 'audio'))
                            return;
                        if (!(asset.type === 'document'))
                            return;
                        __VLS_ctx.selectedAssetKeys.length > 0 ? __VLS_ctx.toggleSelectAsset(`${asset.type}-${asset.id}`) : __VLS_ctx.openAssetDetail(asset);
                    } },
                ...{ class: "asset-document-box" },
                ...{ style: {} },
            });
            const __VLS_52 = {}.FileText;
            /** @type {[typeof __VLS_components.FileText, ]} */ ;
            // @ts-ignore
            const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
                size: (40),
                ...{ style: {} },
            }));
            const __VLS_54 = __VLS_53({
                size: (40),
                ...{ style: {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_53));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ style: {} },
            });
            (asset.title.split('.').pop());
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!(__VLS_ctx.activeView === 'assets'))
                        return;
                    __VLS_ctx.selectedAssetKeys.length > 0 ? __VLS_ctx.toggleSelectAsset(`${asset.type}-${asset.id}`) : null;
                } },
            ...{ class: "history-card-meta" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (asset.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (asset.subtitle);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: () => { } },
            ...{ class: "page-controls" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!(__VLS_ctx.activeView === 'assets'))
                        return;
                    __VLS_ctx.openAssetDetail(asset);
                } },
            ...{ class: "log-action" },
        });
        (__VLS_ctx.$t("assets.detail"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!(__VLS_ctx.activeView === 'assets'))
                        return;
                    __VLS_ctx.favoriteAsset(asset);
                } },
            ...{ class: "log-action" },
        });
        (__VLS_ctx.$t("assets.favorite"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!(__VLS_ctx.activeView === 'assets'))
                        return;
                    __VLS_ctx.downloadAsset(asset);
                } },
            ...{ class: "log-action" },
        });
        (__VLS_ctx.$t("assets.download"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!(__VLS_ctx.activeView === 'assets'))
                        return;
                    __VLS_ctx.deleteAsset(asset);
                } },
            ...{ class: "log-action danger" },
        });
        (__VLS_ctx.$t("assets.delete"));
    }
    if (!__VLS_ctx.filteredAssetItems.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-module" },
        });
        (__VLS_ctx.$t("assets.empty"));
    }
}
else if (__VLS_ctx.activeView === 'favorites') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("nav.favorites"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("favorites.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!(__VLS_ctx.activeView === 'favorites'))
                    return;
                __VLS_ctx.exportJson('favorites');
            } },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("favorites.export"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body favorite-list" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.favorites))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (item.id),
            ...{ class: "favorite-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "prompt-card-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (item.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.type);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (item.subtitle);
        if (item.content) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
            (item.content);
        }
        if (item.type === 'image' && item.url) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                src: (__VLS_ctx.mediaUrl(item.url)),
                alt: "favorite image",
                ...{ class: "favorite-image" },
            });
        }
        if (item.type === 'audio' && item.url) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.audio)({
                src: (__VLS_ctx.mediaUrl(item.url)),
                controls: true,
                ...{ class: "audio-preview" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    __VLS_ctx.removeFavorite(item.id);
                } },
            ...{ class: "log-action danger" },
        });
        (__VLS_ctx.$t("favorites.remove"));
    }
    if (!__VLS_ctx.favorites.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-module" },
        });
        (__VLS_ctx.$t("favorites.empty"));
    }
}
else if (__VLS_ctx.activeView === 'diagnostics') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("nav.diagnostics"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("diagnostics.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openDiagnostics) },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("diagnostics.reDiagnose"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openLogs) },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("diagnostics.viewLogs"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body status-layout" },
    });
    for (const [card] of __VLS_getVForSourceType((__VLS_ctx.diagnosticCards))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (card.name),
            ...{ class: "status-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (card.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (card.value);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (card.detail);
    }
}
else if (__VLS_ctx.activeView === 'exports') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("nav.exports"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("exports.desc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body export-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!!(__VLS_ctx.activeView === 'favorites'))
                    return;
                if (!!(__VLS_ctx.activeView === 'diagnostics'))
                    return;
                if (!(__VLS_ctx.activeView === 'exports'))
                    return;
                __VLS_ctx.exportJson('all');
            } },
        ...{ class: "export-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("exports.completeJson"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("exports.completeJsonDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.exportMarkdown) },
        ...{ class: "export-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("exports.markdown"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("exports.markdownDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!!(__VLS_ctx.activeView === 'favorites'))
                    return;
                if (!!(__VLS_ctx.activeView === 'diagnostics'))
                    return;
                if (!(__VLS_ctx.activeView === 'exports'))
                    return;
                __VLS_ctx.exportJson('chat');
            } },
        ...{ class: "export-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("exports.chatJson"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("exports.chatJsonDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!!(__VLS_ctx.activeView === 'favorites'))
                    return;
                if (!!(__VLS_ctx.activeView === 'diagnostics'))
                    return;
                if (!(__VLS_ctx.activeView === 'exports'))
                    return;
                __VLS_ctx.exportJson('media');
            } },
        ...{ class: "export-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("exports.mediaJson"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("exports.mediaJsonDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!!(__VLS_ctx.activeView === 'favorites'))
                    return;
                if (!!(__VLS_ctx.activeView === 'diagnostics'))
                    return;
                if (!(__VLS_ctx.activeView === 'exports'))
                    return;
                __VLS_ctx.exportJson('logs');
            } },
        ...{ class: "export-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("exports.logsJson"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("exports.logsJsonDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!!(__VLS_ctx.activeView === 'favorites'))
                    return;
                if (!!(__VLS_ctx.activeView === 'diagnostics'))
                    return;
                if (!(__VLS_ctx.activeView === 'exports'))
                    return;
                __VLS_ctx.exportJson('prompts');
            } },
        ...{ class: "export-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.$t("exports.promptsJson"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("exports.promptsJsonDesc"));
}
else if (__VLS_ctx.activeView === 'imageHistory') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("history.minimaxImageTitle"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("history.minimaxImageDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadHistories) },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("logs.refresh"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearImageHistory) },
        ...{ class: "log-action danger" },
    });
    (__VLS_ctx.$t("history.clearImage"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body history-page-grid" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.imageHistories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (String(item.id)),
            ...{ class: "history-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (__VLS_ctx.mediaUrl(String(item.url || ''))),
            alt: "history image",
            ...{ class: "history-card-image" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-card-meta" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (item.prompt || __VLS_ctx.$t('history.emptyImagePrompt'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.createdAt);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "page-controls" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    __VLS_ctx.favoriteAsset({ id: String(item.id), type: 'image', title: String(item.prompt || __VLS_ctx.$t('history.defaultImagePrompt')), subtitle: String(item.createdAt || ''), url: String(item.url || '') });
                } },
            ...{ class: "item-action-btn" },
        });
        (__VLS_ctx.$t("assets.favorite"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    __VLS_ctx.downloadAsset({ id: String(item.id), type: 'image', title: String(item.prompt || __VLS_ctx.$t('history.defaultImagePrompt')), subtitle: String(item.createdAt || ''), url: String(item.url || '') });
                } },
            ...{ class: "item-action-btn" },
        });
        (__VLS_ctx.$t("assets.download"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    __VLS_ctx.deleteImageHistory(String(item.id));
                } },
            ...{ class: "item-action-btn" },
        });
        (__VLS_ctx.$t("chat.delete"));
    }
    if (!__VLS_ctx.imageHistories.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-module" },
        });
        (__VLS_ctx.$t("history.emptyImage"));
    }
}
else if (__VLS_ctx.activeView === 'ttsHistory') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "module-page" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.$t("history.minimaxTtsTitle"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.$t("history.minimaxTtsDesc"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "page-controls" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadHistories) },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("logs.refresh"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearTtsHistory) },
        ...{ class: "log-action danger" },
    });
    (__VLS_ctx.$t("history.clearTts"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "module-body voice-history-list" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.ttsHistories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
            key: (String(item.id)),
            ...{ class: "voice-history-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-card-meta" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (item.text || __VLS_ctx.$t('history.emptyTtsText'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.voiceId);
        (item.format);
        (item.preview ? "preview" : "tts");
        __VLS_asFunctionalElement(__VLS_intrinsicElements.audio)({
            src: (__VLS_ctx.mediaUrl(String(item.audioUrl || ''))),
            controls: true,
            ...{ class: "audio-preview" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    __VLS_ctx.favoriteAsset({ id: String(item.id), type: 'audio', title: String(item.text || __VLS_ctx.$t('history.defaultTtsText')), subtitle: `${item.voiceId || 'voice'} · ${item.format || 'audio'} · ${item.preview ? 'preview' : 'tts'}`, url: String(item.audioUrl || '') });
                } },
            ...{ class: "item-action-btn" },
        });
        (__VLS_ctx.$t("assets.favorite"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    __VLS_ctx.downloadAsset({ id: String(item.id), type: 'audio', title: String(item.text || __VLS_ctx.$t('history.defaultTtsText')), subtitle: `${item.voiceId || 'voice'} · ${item.format || 'audio'} · ${item.preview ? 'preview' : 'tts'}`, url: String(item.audioUrl || '') });
                } },
            ...{ class: "item-action-btn" },
        });
        (__VLS_ctx.$t("assets.download"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    __VLS_ctx.deleteTtsHistory(String(item.id));
                } },
            ...{ class: "item-action-btn" },
        });
        (__VLS_ctx.$t("chat.delete"));
    }
    if (!__VLS_ctx.ttsHistories.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-module" },
        });
        (__VLS_ctx.$t("history.emptyTts"));
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "workbench-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chat-column" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "workspace-toolbar" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "toolbar-title" },
    });
    const __VLS_56 = {}.Terminal;
    /** @type {[typeof __VLS_components.Terminal, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        size: (15),
    }));
    const __VLS_58 = __VLS_57({
        size: (15),
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.activeMeta.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.em, __VLS_intrinsicElements.em)({});
    (__VLS_ctx.chatSessions.find(session => session.id === __VLS_ctx.activeSessionIds[__VLS_ctx.activeProvider])?.title || __VLS_ctx.activeMeta.subtitle);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "toolbar-actions" },
    });
    if (__VLS_ctx.activeProvider === 'gemini') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "gemini-mode-toggle" },
            'aria-label': (__VLS_ctx.$t('chat.geminiModeLabel')),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    if (!(__VLS_ctx.activeProvider === 'gemini'))
                        return;
                    __VLS_ctx.geminiMode = 'auto';
                } },
            ...{ class: ({ active: __VLS_ctx.geminiMode === 'auto' }) },
        });
        (__VLS_ctx.$t("chat.geminiModeAuto"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    if (!(__VLS_ctx.activeProvider === 'gemini'))
                        return;
                    __VLS_ctx.geminiMode = 'text';
                } },
            ...{ class: ({ active: __VLS_ctx.geminiMode === 'text' }) },
        });
        (__VLS_ctx.$t("chat.geminiModeText"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    if (!(__VLS_ctx.activeProvider === 'gemini'))
                        return;
                    __VLS_ctx.geminiMode = 'code';
                } },
            ...{ class: ({ active: __VLS_ctx.geminiMode === 'code' }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    if (!(__VLS_ctx.activeProvider === 'gemini'))
                        return;
                    __VLS_ctx.geminiMode = 'image';
                } },
            ...{ class: ({ active: __VLS_ctx.geminiMode === 'image' }) },
        });
        (__VLS_ctx.isGeminiImageAvailable ? __VLS_ctx.$t("chat.geminiModeImage") : '图片提示词');
    }
    if (__VLS_ctx.activeProvider === 'gemini') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "custom-dropdown-container" },
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    if (!(__VLS_ctx.activeProvider === 'gemini'))
                        return;
                    __VLS_ctx.showModelDropdown = !__VLS_ctx.showModelDropdown;
                } },
            ...{ class: "custom-model-trigger" },
            title: "选择运行模型",
        });
        const __VLS_60 = {}.Cpu;
        /** @type {[typeof __VLS_components.Cpu, ]} */ ;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
            size: (13),
            ...{ style: {} },
        }));
        const __VLS_62 = __VLS_61({
            size: (13),
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "trigger-text" },
        });
        (__VLS_ctx.selectedGeminiModel === 'auto' ? '智能自动路由' : __VLS_ctx.formatModelInfo(__VLS_ctx.selectedGeminiModel).displayName);
        const __VLS_64 = {}.ChevronDown;
        /** @type {[typeof __VLS_components.ChevronDown, ]} */ ;
        // @ts-ignore
        const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
            size: (12),
            ...{ style: {} },
        }));
        const __VLS_66 = __VLS_65({
            size: (12),
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        if (__VLS_ctx.showModelDropdown) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: () => { } },
                ...{ class: "custom-model-dropdown" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "dropdown-header" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeView === 'home'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'dataManagement'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'settings'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'logs'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'speech'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'translation'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'sessions'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'tasks'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'notifications'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'prompts'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'apiStatus'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'assets'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'favorites'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'diagnostics'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'exports'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'imageHistory'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                            return;
                        if (!(__VLS_ctx.activeProvider === 'gemini'))
                            return;
                        if (!(__VLS_ctx.showModelDropdown))
                            return;
                        __VLS_ctx.selectModel('auto');
                    } },
                ...{ class: "custom-model-item" },
                ...{ class: ({ active: __VLS_ctx.selectedGeminiModel === 'auto' }) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "model-item-main" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
                ...{ class: "model-name" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "model-badge badge-auto" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "model-desc" },
            });
            if (__VLS_ctx.availableGeminiModels.length) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "dropdown-divider" },
                });
            }
            for (const [model] of __VLS_getVForSourceType((__VLS_ctx.availableGeminiModels))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.activeView === 'home'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'dataManagement'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'settings'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'logs'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'speech'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'translation'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'sessions'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'tasks'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'notifications'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'prompts'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'apiStatus'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'assets'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'favorites'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'diagnostics'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'exports'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'imageHistory'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                                return;
                            if (!(__VLS_ctx.activeProvider === 'gemini'))
                                return;
                            if (!(__VLS_ctx.showModelDropdown))
                                return;
                            __VLS_ctx.selectModel(model.id);
                        } },
                    key: (model.id),
                    ...{ class: "custom-model-item" },
                    ...{ class: ({ active: __VLS_ctx.selectedGeminiModel === model.id }) },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "model-item-main" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
                    ...{ class: "model-name" },
                });
                (__VLS_ctx.formatModelInfo(model.id).displayName);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "model-badge" },
                    ...{ class: (__VLS_ctx.formatModelInfo(model.id).badgeClass) },
                });
                (__VLS_ctx.formatModelInfo(model.id).badgeText);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "model-desc" },
                });
                (__VLS_ctx.formatModelInfo(model.id).description);
            }
            if (!__VLS_ctx.availableGeminiModels.length) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "empty-dropdown-models" },
                });
            }
        }
    }
    if (__VLS_ctx.activeProvider === 'gemini') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    if (!(__VLS_ctx.activeProvider === 'gemini'))
                        return;
                    __VLS_ctx.handleGeminiProbe(false);
                } },
            ...{ class: "icon-btn" },
            title: "检测可用模型",
            disabled: (__VLS_ctx.geminiProbeLoading),
            ...{ style: {} },
        });
        const __VLS_68 = {}.RefreshCw;
        /** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
        // @ts-ignore
        const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
            size: (13),
            ...{ class: ({ 'animate-spin': __VLS_ctx.geminiProbeLoading }) },
        }));
        const __VLS_70 = __VLS_69({
            size: (13),
            ...{ class: ({ 'animate-spin': __VLS_ctx.geminiProbeLoading }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        ...{ onChange: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!!(__VLS_ctx.activeView === 'favorites'))
                    return;
                if (!!(__VLS_ctx.activeView === 'diagnostics'))
                    return;
                if (!!(__VLS_ctx.activeView === 'exports'))
                    return;
                if (!!(__VLS_ctx.activeView === 'imageHistory'))
                    return;
                if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                    return;
                __VLS_ctx.openSession(__VLS_ctx.chatSessions.find(session => session.id === $event.target.value));
            } },
        ...{ class: "session-picker" },
        value: (__VLS_ctx.activeSessionIds[__VLS_ctx.activeProvider]),
    });
    for (const [session] of __VLS_getVForSourceType((__VLS_ctx.providerSessions))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (session.id),
            value: (session.id),
        });
        (session.title);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!!(__VLS_ctx.activeView === 'favorites'))
                    return;
                if (!!(__VLS_ctx.activeView === 'diagnostics'))
                    return;
                if (!!(__VLS_ctx.activeView === 'exports'))
                    return;
                if (!!(__VLS_ctx.activeView === 'imageHistory'))
                    return;
                if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                    return;
                __VLS_ctx.createSession(__VLS_ctx.activeProvider);
            } },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("chat.newSession"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadHistories) },
        ...{ class: "icon-btn" },
        title: (__VLS_ctx.$t('chat.refreshHistory')),
    });
    const __VLS_72 = {}.RefreshCw;
    /** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        size: (15),
    }));
    const __VLS_74 = __VLS_73({
        size: (15),
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chat-viewport" },
        ref: "chatContainer",
    });
    /** @type {typeof __VLS_ctx.chatContainer} */ ;
    if (__VLS_ctx.messages.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-state" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
        (__VLS_ctx.activeMeta.emptyTitle);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (__VLS_ctx.activeMeta.emptyDesc);
    }
    for (const [msg, i] of __VLS_getVForSourceType((__VLS_ctx.messages))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (i),
            ...{ class: "message-row" },
            ...{ class: (msg.role) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "message-avatar" },
        });
        (msg.role === "user" ? "U" : "AI");
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "message-content" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    __VLS_ctx.favoriteMessage(msg, i);
                } },
            ...{ class: "message-favorite" },
            title: (__VLS_ctx.$t('chat.favoriteMsg')),
        });
        const __VLS_76 = {}.Star;
        /** @type {[typeof __VLS_components.Star, ]} */ ;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
            size: (13),
        }));
        const __VLS_78 = __VLS_77({
            size: (13),
        }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    __VLS_ctx.copyToClipboard(msg.content, i);
                } },
            ...{ class: "message-copy" },
            title: "复制内容",
        });
        const __VLS_80 = ((__VLS_ctx.copiedIndex === i ? __VLS_ctx.Check : __VLS_ctx.Copy));
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
            size: (13),
        }));
        const __VLS_82 = __VLS_81({
            size: (13),
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "message-text-wrapper" },
        });
        for (const [block, idx] of __VLS_getVForSourceType((__VLS_ctx.parseMessageContent(msg.content)))) {
            (idx);
            if (block.type === 'think') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "think-container" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.activeView === 'home'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'dataManagement'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'settings'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'logs'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'speech'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'translation'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'sessions'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'tasks'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'notifications'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'prompts'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'apiStatus'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'assets'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'favorites'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'diagnostics'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'exports'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'imageHistory'))
                                return;
                            if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                                return;
                            if (!(block.type === 'think'))
                                return;
                            __VLS_ctx.toggleThink(__VLS_ctx.activeProvider + '-' + __VLS_ctx.activeSessionIds[__VLS_ctx.activeProvider] + '-' + i);
                        } },
                    ...{ class: "think-header" },
                });
                const __VLS_84 = {}.Cpu;
                /** @type {[typeof __VLS_components.Cpu, ]} */ ;
                // @ts-ignore
                const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
                    size: (14),
                    ...{ class: "think-icon" },
                }));
                const __VLS_86 = __VLS_85({
                    size: (14),
                    ...{ class: "think-icon" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_85));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "think-title" },
                });
                (__VLS_ctx.$t("chat.thinkTitle"));
                const __VLS_88 = ((__VLS_ctx.expandedThinks[__VLS_ctx.activeProvider + '-' + __VLS_ctx.activeSessionIds[__VLS_ctx.activeProvider] + '-' + i] ? __VLS_ctx.ChevronUp : __VLS_ctx.ChevronDown));
                // @ts-ignore
                const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
                    size: (14),
                    ...{ class: "think-chevron" },
                }));
                const __VLS_90 = __VLS_89({
                    size: (14),
                    ...{ class: "think-chevron" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_89));
                if (__VLS_ctx.expandedThinks[__VLS_ctx.activeProvider + '-' + __VLS_ctx.activeSessionIds[__VLS_ctx.activeProvider] + '-' + i]) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "think-body" },
                    });
                    (block.content.trim());
                }
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-body" },
                });
                __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderMarkdown(block.content)) }, null, null);
            }
        }
        for (const [m, j] of __VLS_getVForSourceType(((msg.media || []).filter(x => x.type === 'image')))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                key: (`img-${j}`),
                src: (__VLS_ctx.mediaUrl(m.url)),
                ...{ class: "media-preview image-preview" },
                alt: "generated image",
            });
        }
        for (const [m, j] of __VLS_getVForSourceType(((msg.media || []).filter(x => x.type === 'audio')))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.audio)({
                key: (`audio-${j}`),
                src: (__VLS_ctx.mediaUrl(m.url)),
                ...{ class: "media-preview audio-preview" },
                controls: true,
            });
        }
    }
    if (__VLS_ctx.isThinking) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "message-row assistant" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "message-avatar" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "thinking-dots" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onMousedown: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!!(__VLS_ctx.activeView === 'favorites'))
                    return;
                if (!!(__VLS_ctx.activeView === 'diagnostics'))
                    return;
                if (!!(__VLS_ctx.activeView === 'exports'))
                    return;
                if (!!(__VLS_ctx.activeView === 'imageHistory'))
                    return;
                if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                    return;
                __VLS_ctx.startResize('chatInput', $event);
            } },
        ...{ onDblclick: (...[$event]) => {
                if (!!(__VLS_ctx.activeView === 'home'))
                    return;
                if (!!(__VLS_ctx.activeView === 'dataManagement'))
                    return;
                if (!!(__VLS_ctx.activeView === 'settings'))
                    return;
                if (!!(__VLS_ctx.activeView === 'logs'))
                    return;
                if (!!(__VLS_ctx.activeView === 'speech'))
                    return;
                if (!!(__VLS_ctx.activeView === 'translation'))
                    return;
                if (!!(__VLS_ctx.activeView === 'sessions'))
                    return;
                if (!!(__VLS_ctx.activeView === 'tasks'))
                    return;
                if (!!(__VLS_ctx.activeView === 'notifications'))
                    return;
                if (!!(__VLS_ctx.activeView === 'prompts'))
                    return;
                if (!!(__VLS_ctx.activeView === 'apiStatus'))
                    return;
                if (!!(__VLS_ctx.activeView === 'assets'))
                    return;
                if (!!(__VLS_ctx.activeView === 'favorites'))
                    return;
                if (!!(__VLS_ctx.activeView === 'diagnostics'))
                    return;
                if (!!(__VLS_ctx.activeView === 'exports'))
                    return;
                if (!!(__VLS_ctx.activeView === 'imageHistory'))
                    return;
                if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                    return;
                __VLS_ctx.chatInputHeight = null;
                __VLS_ctx.persistLayout();
                ;
            } },
        ...{ class: "horizontal-resizer chat-resizer glass-resizer" },
        title: "拖动调整高度，双击恢复默认",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "input-container" },
        ...{ style: (__VLS_ctx.chatInputHeight ? { height: `${__VLS_ctx.chatInputHeight}px` } : {}) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (__VLS_ctx.handleFileUpload) },
        type: "file",
        ref: "fileInput",
        accept: "image/*,audio/*,.pdf,.txt,.md",
        ...{ style: {} },
    });
    /** @type {typeof __VLS_ctx.fileInput} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chat-input-row" },
    });
    if (__VLS_ctx.activeProvider === 'gemini' && __VLS_ctx.documents.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "rag-document-selector-sidebar" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "rag-sidebar-header" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "rag-title-container" },
        });
        const __VLS_92 = {}.BookOpen;
        /** @type {[typeof __VLS_components.BookOpen, ]} */ ;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
            size: (12),
            ...{ style: {} },
        }));
        const __VLS_94 = __VLS_93({
            size: (12),
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "rag-actions-container" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    if (!(__VLS_ctx.activeProvider === 'gemini' && __VLS_ctx.documents.length > 0))
                        return;
                    __VLS_ctx.selectedDocIds = __VLS_ctx.documents.map(d => d.id);
                } },
            ...{ class: "rag-action-link select-all" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.activeView === 'home'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'dataManagement'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'settings'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'logs'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'speech'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'translation'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'sessions'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'tasks'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'notifications'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'prompts'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'apiStatus'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'assets'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'favorites'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'diagnostics'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'exports'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'imageHistory'))
                        return;
                    if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                        return;
                    if (!(__VLS_ctx.activeProvider === 'gemini' && __VLS_ctx.documents.length > 0))
                        return;
                    __VLS_ctx.selectedDocIds = [];
                } },
            ...{ class: "rag-action-link clear-all" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "rag-sidebar-list" },
        });
        for (const [doc] of __VLS_getVForSourceType((__VLS_ctx.documents))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                key: (doc.id),
                ...{ class: "rag-doc-sidebar-tag" },
                ...{ class: ({ active: __VLS_ctx.selectedDocIds.includes(doc.id) }) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "checkbox",
                value: (doc.id),
                ...{ style: {} },
            });
            (__VLS_ctx.selectedDocIds);
            const __VLS_96 = {}.FileText;
            /** @type {[typeof __VLS_components.FileText, ]} */ ;
            // @ts-ignore
            const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
                size: (11),
            }));
            const __VLS_98 = __VLS_97({
                size: (11),
            }, ...__VLS_functionalComponentArgsRest(__VLS_97));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "rag-doc-name" },
                title: (doc.name),
            });
            (doc.name);
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "chat-input-main" },
    });
    if (__VLS_ctx.uploadedFiles.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "attachment-preview-list" },
            ...{ style: {} },
        });
        for (const [file, idx] of __VLS_getVForSourceType((__VLS_ctx.uploadedFiles))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (idx),
                ...{ class: "attachment-preview-card" },
                ...{ style: {} },
            });
            if (file.type === 'image') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                    src: (__VLS_ctx.mediaUrl(file.url)),
                    ...{ style: {} },
                });
            }
            else {
                const __VLS_100 = {}.Volume2;
                /** @type {[typeof __VLS_components.Volume2, ]} */ ;
                // @ts-ignore
                const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
                    size: (16),
                    ...{ style: {} },
                }));
                const __VLS_102 = __VLS_101({
                    size: (16),
                    ...{ style: {} },
                }, ...__VLS_functionalComponentArgsRest(__VLS_101));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ style: {} },
            });
            (file.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.activeView === 'home'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'dataManagement'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'settings'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'logs'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'speech'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'translation'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'sessions'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'tasks'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'notifications'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'prompts'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'apiStatus'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'assets'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'favorites'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'diagnostics'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'exports'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'imageHistory'))
                            return;
                        if (!!(__VLS_ctx.activeView === 'ttsHistory'))
                            return;
                        if (!(__VLS_ctx.uploadedFiles.length > 0))
                            return;
                        __VLS_ctx.removeUploadedFile(idx);
                    } },
                ...{ style: {} },
                title: "移除",
            });
            const __VLS_104 = {}.X;
            /** @type {[typeof __VLS_components.X, ]} */ ;
            // @ts-ignore
            const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
                size: (12),
                ...{ style: {} },
            }));
            const __VLS_106 = __VLS_105({
                size: (12),
                ...{ style: {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_105));
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "input-wrapper" },
    });
    if (__VLS_ctx.activeProvider === 'gemini') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.triggerFileUpload) },
            ...{ class: "upload-attachment-btn" },
            disabled: (__VLS_ctx.isUploading || __VLS_ctx.isThinking),
            ...{ style: {} },
            title: "上传图片或音频",
        });
        if (__VLS_ctx.isUploading) {
            const __VLS_108 = {}.ImageIcon;
            /** @type {[typeof __VLS_components.ImageIcon, ]} */ ;
            // @ts-ignore
            const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
                ...{ class: "animate-spin" },
                size: (18),
            }));
            const __VLS_110 = __VLS_109({
                ...{ class: "animate-spin" },
                size: (18),
            }, ...__VLS_functionalComponentArgsRest(__VLS_109));
        }
        else {
            const __VLS_112 = {}.FolderOpen;
            /** @type {[typeof __VLS_components.FolderOpen, ]} */ ;
            // @ts-ignore
            const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
                size: (18),
            }));
            const __VLS_114 = __VLS_113({
                size: (18),
            }, ...__VLS_functionalComponentArgsRest(__VLS_113));
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
        ...{ onKeydown: (__VLS_ctx.handleSend) },
        ref: "textareaRef",
        value: (__VLS_ctx.inputText),
        placeholder: (__VLS_ctx.$t('chat.placeholder')),
        ...{ class: ({ 'resizable-active': __VLS_ctx.chatInputHeight !== null }) },
    });
    /** @type {typeof __VLS_ctx.textareaRef} */ ;
    if (__VLS_ctx.isThinking) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.handleStop) },
            ...{ class: "stop-btn" },
            title: (__VLS_ctx.$t('chat.stopGeneration')),
        });
        const __VLS_116 = {}.Square;
        /** @type {[typeof __VLS_components.Square, ]} */ ;
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
            size: (16),
        }));
        const __VLS_118 = __VLS_117({
            size: (16),
        }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.handleSend) },
            ...{ class: "send-btn" },
            disabled: (!__VLS_ctx.inputText.trim() && __VLS_ctx.uploadedFiles.length === 0),
        });
        const __VLS_120 = {}.Send;
        /** @type {[typeof __VLS_components.Send, ]} */ ;
        // @ts-ignore
        const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
            size: (18),
        }));
        const __VLS_122 = __VLS_121({
            size: (18),
        }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    }
}
var __VLS_8;
if (__VLS_ctx.selectedAsset) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.closeAssetDetail) },
        ...{ class: "asset-modal-backdrop" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "asset-modal" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "asset-modal-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedAsset.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selectedAsset.subtitle);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeAssetDetail) },
        ...{ class: "icon-btn" },
    });
    const __VLS_124 = {}.X;
    /** @type {[typeof __VLS_components.X, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        size: (15),
    }));
    const __VLS_126 = __VLS_125({
        size: (15),
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "asset-modal-body" },
    });
    if (__VLS_ctx.selectedAsset.type === 'image') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (__VLS_ctx.mediaUrl(__VLS_ctx.selectedAsset.url)),
            alt: "asset detail",
        });
    }
    else if (__VLS_ctx.selectedAsset.type === 'audio') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.audio)({
            src: (__VLS_ctx.mediaUrl(__VLS_ctx.selectedAsset.url)),
            controls: true,
            ...{ class: "audio-preview" },
        });
    }
    else if (__VLS_ctx.selectedAsset.type === 'document') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ style: {} },
        });
        const __VLS_128 = {}.FileText;
        /** @type {[typeof __VLS_components.FileText, ]} */ ;
        // @ts-ignore
        const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
            size: (60),
            ...{ style: {} },
        }));
        const __VLS_130 = __VLS_129({
            size: (60),
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_129));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
        (__VLS_ctx.selectedAsset.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ style: {} },
        });
        (__VLS_ctx.selectedAsset.subtitle);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "asset-modal-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedAsset))
                    return;
                __VLS_ctx.favoriteAsset(__VLS_ctx.selectedAsset);
            } },
        ...{ class: "log-action" },
    });
    (__VLS_ctx.$t("assets.favorite"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ class: "log-action asset-link" },
        href: (__VLS_ctx.mediaUrl(__VLS_ctx.selectedAsset.url)),
        target: "_blank",
    });
    (__VLS_ctx.$t("assets.openOriginal"));
}
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['vertical-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['home-page']} */ ;
/** @type {__VLS_StyleScopedClasses['home-hero']} */ ;
/** @type {__VLS_StyleScopedClasses['home-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['home-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['home-overview']} */ ;
/** @type {__VLS_StyleScopedClasses['home-tile']} */ ;
/** @type {__VLS_StyleScopedClasses['home-notices']} */ ;
/** @type {__VLS_StyleScopedClasses['home-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-view']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-header']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['home-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['minimax-card']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-status']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['provider-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-view']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-header']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['minimax-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['save-settings-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['deepseek-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['save-settings-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['deepseek-save']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['openai-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['save-settings-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['gemini-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['save-settings-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['gemini-probe-section']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['logs-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['log-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-level-select']} */ ;
/** @type {__VLS_StyleScopedClasses['log-search']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['log-body-page']} */ ;
/** @type {__VLS_StyleScopedClasses['structured-log-list']} */ ;
/** @type {__VLS_StyleScopedClasses['structured-log']} */ ;
/** @type {__VLS_StyleScopedClasses['log-time']} */ ;
/** @type {__VLS_StyleScopedClasses['log-level']} */ ;
/** @type {__VLS_StyleScopedClasses['log-thread']} */ ;
/** @type {__VLS_StyleScopedClasses['log-logger']} */ ;
/** @type {__VLS_StyleScopedClasses['log-message']} */ ;
/** @type {__VLS_StyleScopedClasses['log-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-composer']} */ ;
/** @type {__VLS_StyleScopedClasses['tts-preview-input']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-presets']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-label']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-groups']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-group']} */ ;
/** @type {__VLS_StyleScopedClasses['group-title']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-group']} */ ;
/** @type {__VLS_StyleScopedClasses['group-title']} */ ;
/** @type {__VLS_StyleScopedClasses['preset-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-selector-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-selector-title']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-cards-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-card']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-card-name']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-card-id']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-card-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-result']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-result-header']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-result-list']} */ ;
/** @type {__VLS_StyleScopedClasses['speech-audio-card']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-card-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-voice']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-time']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-text']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-player']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn-small']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn-small']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn-small']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-module']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['session-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['session-card']} */ ;
/** @type {__VLS_StyleScopedClasses['session-card-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['task-list']} */ ;
/** @type {__VLS_StyleScopedClasses['task-card']} */ ;
/** @type {__VLS_StyleScopedClasses['task-status']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-module']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['notification-list']} */ ;
/** @type {__VLS_StyleScopedClasses['notification-card']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-module']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-editor']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-list']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-card']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['status-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['status-card']} */ ;
/** @type {__VLS_StyleScopedClasses['status-card']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-status']} */ ;
/** @type {__VLS_StyleScopedClasses['usage-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['open-usage-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['assets-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['assets-tabs-container']} */ ;
/** @type {__VLS_StyleScopedClasses['assets-tabs-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['assets-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['assets-tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['assets-tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['assets-tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['assets-tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['assets-batch-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-checkbox-input']} */ ;
/** @type {__VLS_StyleScopedClasses['batch-selected-count']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-select-checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['history-card-image']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-audio-box']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-document-box']} */ ;
/** @type {__VLS_StyleScopedClasses['history-card-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-module']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['favorite-list']} */ ;
/** @type {__VLS_StyleScopedClasses['favorite-card']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt-card-head']} */ ;
/** @type {__VLS_StyleScopedClasses['favorite-image']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-module']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['status-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['status-card']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['export-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['export-card']} */ ;
/** @type {__VLS_StyleScopedClasses['export-card']} */ ;
/** @type {__VLS_StyleScopedClasses['export-card']} */ ;
/** @type {__VLS_StyleScopedClasses['export-card']} */ ;
/** @type {__VLS_StyleScopedClasses['export-card']} */ ;
/** @type {__VLS_StyleScopedClasses['export-card']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['history-page-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['history-card']} */ ;
/** @type {__VLS_StyleScopedClasses['history-card-image']} */ ;
/** @type {__VLS_StyleScopedClasses['history-card-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['item-action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['item-action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['item-action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-module']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-history-list']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-history-card']} */ ;
/** @type {__VLS_StyleScopedClasses['history-card-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['item-action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['item-action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['item-action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-module']} */ ;
/** @type {__VLS_StyleScopedClasses['workbench-body']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-column']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-title']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['gemini-mode-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-dropdown-container']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-model-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['trigger-text']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-model-dropdown']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-header']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-model-item']} */ ;
/** @type {__VLS_StyleScopedClasses['model-item-main']} */ ;
/** @type {__VLS_StyleScopedClasses['model-name']} */ ;
/** @type {__VLS_StyleScopedClasses['model-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['model-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-divider']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-model-item']} */ ;
/** @type {__VLS_StyleScopedClasses['model-item-main']} */ ;
/** @type {__VLS_StyleScopedClasses['model-name']} */ ;
/** @type {__VLS_StyleScopedClasses['model-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['model-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-dropdown-models']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['session-picker']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-viewport']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['message-row']} */ ;
/** @type {__VLS_StyleScopedClasses['message-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['message-content']} */ ;
/** @type {__VLS_StyleScopedClasses['message-favorite']} */ ;
/** @type {__VLS_StyleScopedClasses['message-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['message-text-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['think-container']} */ ;
/** @type {__VLS_StyleScopedClasses['think-header']} */ ;
/** @type {__VLS_StyleScopedClasses['think-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['think-title']} */ ;
/** @type {__VLS_StyleScopedClasses['think-chevron']} */ ;
/** @type {__VLS_StyleScopedClasses['think-body']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body']} */ ;
/** @type {__VLS_StyleScopedClasses['media-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['image-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['media-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['message-row']} */ ;
/** @type {__VLS_StyleScopedClasses['assistant']} */ ;
/** @type {__VLS_StyleScopedClasses['message-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['thinking-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['horizontal-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-resizer']} */ ;
/** @type {__VLS_StyleScopedClasses['input-container']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-input-row']} */ ;
/** @type {__VLS_StyleScopedClasses['rag-document-selector-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['rag-sidebar-header']} */ ;
/** @type {__VLS_StyleScopedClasses['rag-title-container']} */ ;
/** @type {__VLS_StyleScopedClasses['rag-actions-container']} */ ;
/** @type {__VLS_StyleScopedClasses['rag-action-link']} */ ;
/** @type {__VLS_StyleScopedClasses['select-all']} */ ;
/** @type {__VLS_StyleScopedClasses['rag-action-link']} */ ;
/** @type {__VLS_StyleScopedClasses['clear-all']} */ ;
/** @type {__VLS_StyleScopedClasses['rag-sidebar-list']} */ ;
/** @type {__VLS_StyleScopedClasses['rag-doc-sidebar-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['rag-doc-name']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-input-main']} */ ;
/** @type {__VLS_StyleScopedClasses['attachment-preview-list']} */ ;
/** @type {__VLS_StyleScopedClasses['attachment-preview-card']} */ ;
/** @type {__VLS_StyleScopedClasses['input-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['upload-attachment-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['stop-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['send-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-modal-head']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-modal-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['asset-link']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AppBackground: AppBackground,
            FloatingSidebar: FloatingSidebar,
            FloatingMainPanel: FloatingMainPanel,
            TranslationView: TranslationView,
            Terminal: Terminal,
            Send: Send,
            Trash2: Trash2,
            Cpu: Cpu,
            ImageIcon: ImageIcon,
            Volume2: Volume2,
            FileText: FileText,
            RefreshCw: RefreshCw,
            BookOpen: BookOpen,
            Activity: Activity,
            FolderOpen: FolderOpen,
            Star: Star,
            Download: Download,
            X: X,
            ChevronDown: ChevronDown,
            ChevronUp: ChevronUp,
            Square: Square,
            Copy: Copy,
            Check: Check,
            logEntries: logEntries,
            logLevel: logLevel,
            logQuery: logQuery,
            logLoading: logLoading,
            logContainer: logContainer,
            activeProvider: activeProvider,
            activeView: activeView,
            chatSessions: chatSessions,
            activeSessionIds: activeSessionIds,
            taskQueue: taskQueue,
            notifications: notifications,
            inputText: inputText,
            geminiMode: geminiMode,
            selectedGeminiModel: selectedGeminiModel,
            showModelDropdown: showModelDropdown,
            selectModel: selectModel,
            formatModelInfo: formatModelInfo,
            isThinking: isThinking,
            copiedIndex: copiedIndex,
            chatContainer: chatContainer,
            expandedThinks: expandedThinks,
            toggleThink: toggleThink,
            renderMarkdown: renderMarkdown,
            parseMessageContent: parseMessageContent,
            imageHistories: imageHistories,
            ttsHistories: ttsHistories,
            documents: documents,
            selectedDocIds: selectedDocIds,
            activeVoiceTab: activeVoiceTab,
            voiceTabs: voiceTabs,
            voiceTabCounts: voiceTabCounts,
            filteredVoices: filteredVoices,
            previewText: previewText,
            previewVoiceId: previewVoiceId,
            previewFormat: previewFormat,
            previewSpeed: previewSpeed,
            previewVol: previewVol,
            previewPitch: previewPitch,
            previewSampleRate: previewSampleRate,
            previewBitrate: previewBitrate,
            previewLoading: previewLoading,
            generateLoading: generateLoading,
            shortExamples: shortExamples,
            longExamples: longExamples,
            deepSeekUsage: deepSeekUsage,
            accountLoading: accountLoading,
            settingsLoading: settingsLoading,
            settingsState: settingsState,
            geminiCapabilities: geminiCapabilities,
            geminiProbeLoading: geminiProbeLoading,
            uploadedFiles: uploadedFiles,
            fileInput: fileInput,
            isUploading: isUploading,
            dataManagementStatus: dataManagementStatus,
            dataManagementLoading: dataManagementLoading,
            selectedDataMode: selectedDataMode,
            connectionTestResult: connectionTestResult,
            dataFileCards: dataFileCards,
            postgresqlInfo: postgresqlInfo,
            settingsDraft: settingsDraft,
            sidebarWidth: sidebarWidth,
            chatInputHeight: chatInputHeight,
            textareaRef: textareaRef,
            promptTemplates: promptTemplates,
            promptDraft: promptDraft,
            favorites: favorites,
            selectedAsset: selectedAsset,
            activeAssetTab: activeAssetTab,
            selectedAssetKeys: selectedAssetKeys,
            providerMeta: providerMeta,
            messages: messages,
            activeMeta: activeMeta,
            minimaxModels: minimaxModels,
            deepSeekModels: deepSeekModels,
            openaiModels: openaiModels,
            geminiModels: geminiModels,
            availableGeminiModels: availableGeminiModels,
            isGeminiImageAvailable: isGeminiImageAvailable,
            providerSessions: providerSessions,
            sessionSummaries: sessionSummaries,
            dashboardStats: dashboardStats,
            apiStatusCards: apiStatusCards,
            assetItems: assetItems,
            filteredAssetItems: filteredAssetItems,
            diagnosticCards: diagnosticCards,
            recentNotifications: recentNotifications,
            saveNotifications: saveNotifications,
            markNotificationsRead: markNotificationsRead,
            removeNotification: removeNotification,
            loadLogEntries: loadLogEntries,
            clearLogEntries: clearLogEntries,
            formatLogTime: formatLogTime,
            logLevelClass: logLevelClass,
            mediaUrl: mediaUrl,
            loadHistories: loadHistories,
            loadVoices: loadVoices,
            createSession: createSession,
            openSession: openSession,
            renameSession: renameSession,
            deleteSession: deleteSession,
            clearFinishedTasks: clearFinishedTasks,
            loadSettings: loadSettings,
            refreshProviderModels: refreshProviderModels,
            saveProviderSettings: saveProviderSettings,
            openDeepSeekUsage: openDeepSeekUsage,
            handleGeminiProbe: handleGeminiProbe,
            triggerFileUpload: triggerFileUpload,
            handleFileUpload: handleFileUpload,
            removeUploadedFile: removeUploadedFile,
            loadApiStatus: loadApiStatus,
            handlePreview: handlePreview,
            handleGenerateTts: handleGenerateTts,
            deleteImageHistory: deleteImageHistory,
            clearImageHistory: clearImageHistory,
            deleteTtsHistory: deleteTtsHistory,
            clearTtsHistory: clearTtsHistory,
            removeFavorite: removeFavorite,
            favoriteMessage: favoriteMessage,
            favoriteAsset: favoriteAsset,
            openAssetDetail: openAssetDetail,
            closeAssetDetail: closeAssetDetail,
            downloadAsset: downloadAsset,
            deleteAsset: deleteAsset,
            toggleSelectAsset: toggleSelectAsset,
            isAllSelected: isAllSelected,
            toggleSelectAll: toggleSelectAll,
            deleteSelectedAssets: deleteSelectedAssets,
            downloadSelectedAssets: downloadSelectedAssets,
            exportJson: exportJson,
            exportMarkdown: exportMarkdown,
            persistLayout: persistLayout,
            startResize: startResize,
            handleSend: handleSend,
            handleStop: handleStop,
            copyToClipboard: copyToClipboard,
            switchProvider: switchProvider,
            openMiniMaxHistory: openMiniMaxHistory,
            openLogs: openLogs,
            openDiagnostics: openDiagnostics,
            openAssets: openAssets,
            openSettings: openSettings,
            loadDataManagementStatus: loadDataManagementStatus,
            switchDataSourceMode: switchDataSourceMode,
            testDataConnection: testDataConnection,
            testPostgreSqlConnection: testPostgreSqlConnection,
            addPromptTemplate: addPromptTemplate,
            deletePromptTemplate: deletePromptTemplate,
            usePromptTemplate: usePromptTemplate,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
