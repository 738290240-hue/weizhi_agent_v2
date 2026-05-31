<script setup lang="ts">
// i18n refactor completed
import { computed, ref, onMounted, onBeforeUnmount, nextTick, provide, watch } from "vue";
import { useI18n } from "vue-i18n";
import { marked } from "marked";
import hljs from "highlight.js";
import AppBackground from './components/layout/AppBackground.vue';
import FloatingSidebar from './components/layout/FloatingSidebar.vue';
import FloatingMainPanel from './components/layout/FloatingMainPanel.vue';
import TranslationView from './components/chat/TranslationView.vue';
import { systemApi, settingsApi, chatApi, deepSeekApi, openaiApi, geminiApi, imageApi, ttsApi, dataManagementApi, documentApi, type LogEntry, type ProviderMessage, type DataManagementStatus, type DataSourceMode, type DocumentRecord } from "./utils/api";
import { resolveApiUrl } from "./utils/urlUtils";
import { Terminal, Send, Trash2, Cpu, Settings, Image as ImageIcon, Volume2, FileText, RefreshCw, History, BookOpen, Activity, FolderOpen, Star, Wrench, Download, Home, Bell, X, ChevronDown, ChevronUp, Palette, Square, Copy, Check } from "lucide-vue-next";

type MediaItem = { type: "image" | "audio" | "document"; url: string };
type ChatMessage = { role: "user" | "assistant"; content: string; media?: MediaItem[] };
type ChatProvider = "minimax" | "deepseek" | "openai" | "gemini";
type GeminiMode = "auto" | "text" | "code" | "image";
type MainView = "home" | "chat" | "speech" | "translation" | "imageHistory" | "ttsHistory" | "sessions" | "tasks" | "notifications" | "prompts" | "assets" | "favorites" | "diagnostics" | "exports" | "apiStatus" | "logs" | "settings" | "dataManagement";
type PromptTemplate = { id: string; title: string; content: string; provider: "通用" | "MiniMax" | "DeepSeek" | "OpenAI" | "Gemini" };
type FavoriteItem = { id: string; type: "text" | "image" | "audio" | "document"; title: string; subtitle: string; content?: string; url?: string };
type SessionRecord = { id: string; provider: ChatProvider; title: string; createdAt: string; updatedAt: string; messages: ChatMessage[] };
type TaskRecord = { id: string; title: string; provider: ChatProvider | "system"; status: "pending" | "running" | "success" | "failed"; createdAt: string; detail: string };
type NotificationItem = { id: string; level: "success" | "warning" | "error" | "info"; title: string; message: string; createdAt: string; read: boolean };
type AssetItem = { id: string; type: "image" | "audio" | "document"; title: string; subtitle: string; url: string };

const logs = ref<string[]>([]);
const logEntries = ref<LogEntry[]>([]);
const logLevel = ref("");
const logQuery = ref("");
const logLoading = ref(false);
const logContainer = ref<HTMLElement | null>(null);

const { t, locale } = useI18n();

const setLang = (lang: "zh-CN" | "en-US" | "zh-TW") => {
  locale.value = lang;
  localStorage.setItem("weizhi.locale", lang);
};

const currentTheme = ref<"midnight" | "light" | "obsidian" | "green" | "pink">("midnight");
const setTheme = (theme: "midnight" | "light" | "obsidian" | "green" | "pink") => {
  currentTheme.value = theme;
  localStorage.setItem("weizhi.theme", theme);
  document.body.className = theme === "midnight" ? "" : `theme-${theme}`;
};

const activeProvider = ref<ChatProvider>("minimax");
const activeView = ref<MainView>("home");
const minimaxMessages = ref<ChatMessage[]>([]);
const deepSeekMessages = ref<ChatMessage[]>([]);
const openaiMessages = ref<ChatMessage[]>([]);
const geminiMessages = ref<ChatMessage[]>([]);
const chatSessions = ref<SessionRecord[]>([]);
const activeSessionIds = ref<Record<ChatProvider, string>>({ minimax: "", deepseek: "", openai: "", gemini: "" });
const taskQueue = ref<TaskRecord[]>([]);
const notifications = ref<NotificationItem[]>([]);
const inputText = ref("");
const geminiMode = ref<GeminiMode>("auto");
const selectedGeminiModel = ref<string>("auto");
const showModelDropdown = ref(false);
const selectModel = (modelId: string) => {
  selectedGeminiModel.value = modelId;
  showModelDropdown.value = false;
};
const closeModelDropdown = () => {
  showModelDropdown.value = false;
};

const formatModelInfo = (id: string) => {
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
  } else if (lowercaseId.includes("claude-opus")) {
    displayName = "Claude Opus";
    badgeText = "Opus";
    badgeClass = "badge-thinking";
    description = "高阶逻辑 / 复杂推理";
  } else if (lowercaseId.includes("claude-sonnet-4") || lowercaseId.includes("claude-4-sonnet")
      || lowercaseId.includes("claude-3-5-sonnet-20241022")) {
    displayName = "Claude Sonnet 4";
    badgeText = "Sonnet";
    badgeClass = "badge-thinking";
    description = "高阶逻辑 / 复杂编程";
  } else if (lowercaseId.includes("claude-3-5-sonnet-20240620") || lowercaseId.includes("claude-sonnet-3")) {
    displayName = "Claude Sonnet 3.5";
    badgeText = "Sonnet";
    badgeClass = "badge-thinking";
    description = "复杂逻辑与推理";
  } else if (lowercaseId.includes("claude-sonnet")) {
    displayName = "Claude Sonnet";
    badgeText = "Sonnet";
    badgeClass = "badge-thinking";
    description = "高阶逻辑 / 复杂推理";
  } else if (lowercaseId.includes("claude-haiku-4") || lowercaseId.includes("claude-4-haiku")) {
    displayName = "Claude Haiku 4";
    badgeText = "Fast";
    badgeClass = "badge-fast";
    description = "极速日常问答 (新版)";
  } else if (lowercaseId.includes("claude-3-5-haiku") || lowercaseId.includes("claude-haiku-3")) {
    displayName = "Claude Haiku 3.5";
    badgeText = "Fast";
    badgeClass = "badge-fast";
    description = "极速日常问答";
  } else if (lowercaseId.includes("claude-haiku")) {
    displayName = "Claude Haiku";
    badgeText = "Fast";
    badgeClass = "badge-fast";
    description = "极速日常问答";
  } else if (lowercaseId.includes("claude-3-7")) {
    displayName = "Claude 3.7";
    badgeText = "Pro";
    badgeClass = "badge-pro";
    description = "高阶综合推理";
  } else if (lowercaseId.includes("claude-3-opus")) {
    displayName = "Claude 3 Opus";
    badgeText = "Opus";
    badgeClass = "badge-opus";
    description = "高阶推理 / 复杂分析";
  } else if (lowercaseId.includes("claude-3-haiku")) {
    displayName = "Claude 3 Haiku";
    badgeText = "Fast";
    badgeClass = "badge-fast";
    description = "经典极速问答";
  } else if (lowercaseId.includes("claude-3-sonnet")) {
    displayName = "Claude 3 Sonnet";
    badgeText = "Sonnet";
    badgeClass = "badge-thinking";
    description = "经典综合推理";

  // ── DeepSeek ──────────────────────────────────────────────────────
  } else if (lowercaseId.includes("deepseek-reasoner") || lowercaseId.includes("deepseek-r1")) {
    displayName = "DeepSeek R1";
    badgeText = "Thinking";
    badgeClass = "badge-thinking";
    description = "深度思考与长链推理";
  } else if (lowercaseId.includes("deepseek-chat") || lowercaseId.includes("deepseek-v3")) {
    displayName = "DeepSeek V3 / Chat";
    badgeText = "Pro";
    badgeClass = "badge-pro";
    description = "极高性价比综合分析";

  // ── GPT / OpenAI ──────────────────────────────────────────────────
  } else if (lowercaseId.includes("o1-mini") || lowercaseId === "o1-mini") {
    displayName = "GPT o1 Mini";
    badgeText = "Think";
    badgeClass = "badge-thinking";
    description = "轻量推理模型";
  } else if (lowercaseId.startsWith("o1") || lowercaseId === "o1") {
    displayName = "GPT o1";
    badgeText = "Think";
    badgeClass = "badge-thinking";
    description = "深度推理旗舰";
  } else if (lowercaseId.startsWith("o3-mini") || lowercaseId === "o3-mini") {
    displayName = "GPT o3 Mini";
    badgeText = "Think";
    badgeClass = "badge-thinking";
    description = "高效推理模型";
  } else if (lowercaseId.startsWith("o3") || lowercaseId === "o3") {
    displayName = "GPT o3";
    badgeText = "Think";
    badgeClass = "badge-thinking";
    description = "高阶推理旗舰";
  } else if (lowercaseId.startsWith("o4-mini")) {
    displayName = "GPT o4 Mini";
    badgeText = "Think";
    badgeClass = "badge-thinking";
    description = "新一代轻量推理";
  } else if (lowercaseId.startsWith("o4")) {
    displayName = "GPT o4";
    badgeText = "Think";
    badgeClass = "badge-thinking";
    description = "新一代旗舰推理";
  } else if (lowercaseId.includes("gpt-4o-mini")) {
    displayName = "GPT-4o Mini";
    badgeText = "Fast";
    badgeClass = "badge-fast";
    description = "高性价比极速文本响应";
  } else if (lowercaseId.includes("gpt-4o")) {
    displayName = "GPT-4o";
    badgeText = "Pro";
    badgeClass = "badge-pro";
    description = "强力多模态 / 综合问答";
  } else if (lowercaseId.includes("gpt-4.1-mini")) {
    displayName = "GPT-4.1 Mini";
    badgeText = "Fast";
    badgeClass = "badge-fast";
    description = "高性价比新版";
  } else if (lowercaseId.includes("gpt-4.1")) {
    displayName = "GPT-4.1";
    badgeText = "Pro";
    badgeClass = "badge-pro";
    description = "新版综合旗舰";
  } else if (lowercaseId.includes("gpt-4-turbo")) {
    displayName = "GPT-4 Turbo";
    badgeText = "Pro";
    badgeClass = "badge-pro";
    description = "强力综合推理";
  } else if (lowercaseId.includes("gpt-4")) {
    displayName = "GPT-4";
    badgeText = "Pro";
    badgeClass = "badge-pro";
    description = "经典强力模型";
  } else if (lowercaseId.includes("gpt-3.5")) {
    displayName = "GPT-3.5";
    badgeText = "Fast";
    badgeClass = "badge-fast";
    description = "高性价比快速响应";

  // ── Gemini ──────────────────────────────────────────────────────
  } else if (lowercaseId.includes("gemini-3.1-pro-high") || lowercaseId.includes("gemini-3-pro") || lowercaseId.includes("gemini-1.5-pro")) {
    displayName = "Gemini Pro";
    badgeText = "Pro";
    badgeClass = "badge-pro";
    description = "大容量多模态分析";
  } else if (lowercaseId.includes("gemini-2.5-pro") || lowercaseId.includes("gemini-2.5")) {
    displayName = "Gemini 2.5 Pro";
    badgeText = "Pro";
    badgeClass = "badge-pro";
    description = "新一代多模态旗舰";
  } else if (lowercaseId.includes("gemini-2.0")) {
    displayName = "Gemini 2.0";
    badgeText = "Pro";
    badgeClass = "badge-pro";
    description = "多模态推理";
  } else if (lowercaseId.includes("gemini-3-flash") || lowercaseId.includes("gemini-1.5-flash")) {
    displayName = "Gemini Flash";
    badgeText = "Fast";
    badgeClass = "badge-fast";
    description = "日常多模态极速问答";
  } else if (lowercaseId.includes("gemini-2.5-flash")) {
    displayName = "Gemini 2.5 Flash";
    badgeText = "Fast";
    badgeClass = "badge-fast";
    description = "新一代极速多模态";
  } else {
    // Generic fallback: format ID as readable name
    // e.g. "gpt-oss-120b-medium" → "Gpt Oss 120b"
    displayName = id
      .replace(/[-_]/g, ' ')
      .split(' ')
      .slice(0, 3)  // take first 3 words max
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    badgeText = "AI";
    badgeClass = "badge-pro";
    description = "中转自定义模型";
  }

  return { displayName, badgeText, badgeClass, description };
};
const isThinking = ref(false);
const chatAbortController = ref<AbortController | null>(null);
const copiedIndex = ref<number | null>(null);
const chatContainer = ref<HTMLElement | null>(null);

const expandedThinks = ref<Record<string, boolean>>({});
const toggleThink = (key: string) => {
  expandedThinks.value[key] = !expandedThinks.value[key];
};

// Custom renderer to add copy buttons and language headers to code blocks!
const markedRenderer = new marked.Renderer();

markedRenderer.code = (arg1: any, arg2?: any) => {
  let text = "";
  let lang = "";
  if (typeof arg1 === "object" && arg1 !== null) {
    text = arg1.text || "";
    lang = arg1.lang || "";
  } else {
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
(window as any).weizhiCopyCode = (btn: HTMLButtonElement) => {
  const pre = btn.parentElement?.nextElementSibling;
  if (!pre) return;
  const code = pre.querySelector("code")?.innerText || "";
  navigator.clipboard.writeText(code).then(() => {
    const textSpan = btn.querySelector(".copy-text");
    if (textSpan) textSpan.textContent = "已复制";
    btn.classList.add("copied");
    setTimeout(() => {
      if (textSpan) textSpan.textContent = "复制";
      btn.classList.remove("copied");
    }, 2000);
  });
};

const renderMarkdown = (text: string): string => {
  if (!text) return "";
  try {
    return marked.parse(text) as string;
  } catch (err) {
    console.error("Failed to parse markdown:", err);
    return text;
  }
};

interface MessageBlock {
  type: "think" | "text";
  content: string;
}

const parseMessageContent = (content: string): MessageBlock[] => {
  if (!content) return [];
  const blocks: MessageBlock[] = [];
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
      } else {
        blocks.push({
          type: "think",
          content: remaining.substring(thinkStart + 7)
        });
        remaining = "";
      }
    } else {
      blocks.push({
        type: "text",
        content: remaining
      });
      remaining = "";
    }
  }
  return blocks;
};

const imageHistories = ref<Array<Record<string, any>>>([]);
const ttsHistories = ref<Array<Record<string, any>>>([]);
const documents = ref<DocumentRecord[]>([]);
const selectedDocIds = ref<string[]>([]);
const voices = ref<Array<{ voiceId: string; name: string; category?: string; description?: string }>>([]);
const activeVoiceTab = ref("中文男声");

const isChineseFemale = (v: any) => {
  if (v.category !== "中文") return false;
  const str = (v.name + " " + (v.description || "") + " " + v.voiceId).toLowerCase();
  return /female|girl|woman|lady|miss|aunt|sister|女|姐|妹|奶|婶|妈|shaonv|yujie|chengshu|tianmei|xiaoling|mengmei|xuemei|xuejie|\(f\)|小琪/i.test(str);
};

const voiceTabs = ["中文男声", "中文女声", "日文", "英文", "备选音色"];

const voiceTabCounts = computed<Record<string, number>>(() => {
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
  } else if (activeVoiceTab.value === "中文女声") {
    return voices.value.filter(v => isChineseFemale(v));
  } else if (activeVoiceTab.value === "日文") {
    return voices.value.filter(v => v.category === "日文");
  } else if (activeVoiceTab.value === "英文") {
    return voices.value.filter(v => v.category === "英文");
  } else {
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
const deepSeekBalance = ref<Record<string, any> | null>(null);
const deepSeekUsage = ref<Record<string, any> | null>(null);
const accountLoading = ref(false);
const settingsLoading = ref(false);
const settingsState = ref<Record<string, any>>({});
const geminiCapabilities = ref<any>(null);
const geminiProbeLoading = ref(false);
const uploadedFiles = ref<Array<{ url: string; type: 'image' | 'audio' | 'document'; name: string }>>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);

const dataManagementStatus = ref<DataManagementStatus | null>(null);
const dataManagementLoading = ref(false);
const selectedDataMode = ref<DataSourceMode>("json");
const connectionTestResult = ref<{ success: boolean; message: string } | null>(null);

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
const chatInputHeight = ref<number | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const adjustTextareaHeight = () => {
  if (chatInputHeight.value) return; // If manually resized, don't override with auto-grow
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
const promptTemplates = ref<PromptTemplate[]>([
  { id: "image-detail", title: t("prompt.imageDetailTitle"), provider: "MiniMax", content: t("prompt.imageDetailContent") },
  { id: "tts-polish", title: t("prompt.ttsPolishTitle"), provider: "MiniMax", content: t("prompt.ttsPolishContent") },
  { id: "reasoning", title: t("prompt.reasoningTitle"), provider: "DeepSeek", content: t("prompt.reasoningContent") }
]);
const promptDraft = ref({ title: "", content: "", provider: "通用" as PromptTemplate["provider"] });
const favorites = ref<FavoriteItem[]>([]);
const selectedAsset = ref<AssetItem | null>(null);
const activeAssetTab = ref<'all' | 'image' | 'audio' | 'document'>('all');
const selectedAssetKeys = ref<string[]>([]);

watch([activeAssetTab, activeView], () => {
  selectedAssetKeys.value = [];
});

let logEventSource: EventSource | null = null;
let resizing: "sidebar" | "chatInput" | null = null;

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
} as const;

const messages = computed(() => {
  if (activeProvider.value === "minimax") return minimaxMessages.value;
  if (activeProvider.value === "deepseek") return deepSeekMessages.value;
  if (activeProvider.value === "openai") return openaiMessages.value;
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
  const available = geminiCapabilities.value.models.filter((m: any) => {
    if (!m.available) return false;
    const lower = (m.id as string).toLowerCase();
    // Exclude pure thinking variants (they are same model, just different mode)
    if (lower.endsWith('-thinking')) return false;
    // Exclude image models from text chat selector
    if (lower.includes('image')) return false;
    return true;
  });
  // Deduplicate by displayName: keep the shortest (cleanest) model ID per name
  const seen = new Map<string, any>();
  for (const m of available) {
    const name = formatModelInfo(m.id).displayName;
    if (!seen.has(name)) {
      seen.set(name, m);
    } else {
      // Prefer shorter (simpler) ID
      if ((m.id as string).length < seen.get(name).id.length) {
        seen.set(name, m);
      }
    }
  }
  return Array.from(seen.values());
});
const isGeminiImageAvailable = computed(() => {
  if (!geminiCapabilities.value || !geminiCapabilities.value.models) return false;
  return geminiCapabilities.value.models.some((m: any) => m.available && (m.id.includes("image") || m.id === "gemini-3-pro-image"));
});
const minimaxSubViews: MainView[] = ["speech", "translation", "imageHistory", "ttsHistory"];
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
const assetItems = computed<AssetItem[]>(() => [
  ...imageHistories.value.map(item => ({
    id: String(item.id),
    type: "image" as const,
    title: item.prompt || t("history.defaultImagePrompt"),
    subtitle: item.createdAt || "",
    url: String(item.url || "")
  })),
  ...ttsHistories.value
    .filter(item => !item.preview && item.source !== 'translation')
    .map(item => ({
      id: String(item.id),
      type: "audio" as const,
      title: item.text || t("history.defaultTtsText"),
      subtitle: `${item.voiceId || "voice"} · ${item.format || "audio"} · tts`,
      url: String(item.audioUrl || "")
    })),
  ...documents.value.map(item => ({
    id: String(item.id),
    type: "document" as const,
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

const addLog = (msg: string) => {
  logs.value.push(msg);
  if (logs.value.length > 200) logs.value.shift();
  nextTick(() => {
    if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight;
  });
};

const saveNotifications = () => {
  localStorage.setItem("weizhi.notifications", JSON.stringify(notifications.value));
};

const addNotification = (level: NotificationItem["level"], title: string, message: string) => {
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

const removeNotification = (id: string) => {
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
  } catch (err: any) {
    addLog("Log history load failed: " + (err?.message || "unknown error"));
  } finally {
    logLoading.value = false;
  }
};

const clearLogEntries = async () => {
  try {
    await systemApi.clearLogs();
    logs.value = [];
    logEntries.value = [];
  } catch (err: any) {
    addLog("Log clear failed: " + (err?.message || "unknown error"));
  }
};

const formatLogTime = (value: string) => {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString("zh-CN", { hour12: false });
};

const logLevelClass = (level: string) => `level-${String(level || "info").toLowerCase()}`;

const mediaUrl = (url: string) => resolveApiUrl(url);

const loadHistories = async () => {
  const sortDesc = (a: any, b: any) => {
    const parseTime = (dateStr: string) => {
      if (!dateStr) return 0;
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
      } catch (err: any) {
        addLog("Failed to load image history: " + (err?.message || "unknown error"));
      }
    })(),
    (async () => {
      try {
        const ttsRes = await ttsApi.history();
        ttsHistories.value = (ttsRes.data?.histories || []).sort(sortDesc);
      } catch (err: any) {
        addLog("Failed to load TTS history: " + (err?.message || "unknown error"));
      }
    })(),
    (async () => {
      try {
        const docRes = await documentApi.list();
        documents.value = (docRes.data || []).sort((a, b) => b.uploadTime - a.uploadTime);
      } catch (err: any) {
        addLog("Failed to load RAG documents: " + (err?.message || "unknown error"));
      }
    })()
  ]);
};

const scrollChatToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
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
  } catch (err: any) {
    addLog("DeepSeek account load failed: " + (err?.message || "unknown error"));
  } finally {
    accountLoading.value = false;
  }
};

const defaultSession = (provider: ChatProvider): SessionRecord => {
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

const syncMessagesFromSession = (provider: ChatProvider) => {
  const session = chatSessions.value.find(item => item.id === activeSessionIds.value[provider]);
  if (provider === "minimax") minimaxMessages.value = session ? [...session.messages] : [];
  else if (provider === "deepseek") deepSeekMessages.value = session ? [...session.messages] : [];
  else if (provider === "openai") openaiMessages.value = session ? [...session.messages] : [];
  else geminiMessages.value = session ? [...session.messages] : [];
};

const saveActiveSession = (provider: ChatProvider) => {
  const session = chatSessions.value.find(item => item.id === activeSessionIds.value[provider]);
  if (!session) return;
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
  (["minimax", "deepseek", "openai", "gemini"] as ChatProvider[]).forEach(provider => {
    const currentActiveId = activeSessionIds.value[provider];
    const activeSession = chatSessions.value.find(session => session.id === currentActiveId);
    
    // If active session does not exist, or if its provider does not match, reset it to the first session of this provider
    if (!activeSession || activeSession.provider !== provider) {
      const matchingSession = chatSessions.value.find(session => session.provider === provider);
      if (matchingSession) {
        activeSessionIds.value[provider] = matchingSession.id;
      } else {
        const newSession = defaultSession(provider);
        chatSessions.value.push(newSession);
        activeSessionIds.value[provider] = newSession.id;
      }
    }
    syncMessagesFromSession(provider);
  });
  saveSessions();
};

const createSession = (provider: ChatProvider = activeProvider.value) => {
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

const openSession = (session: SessionRecord) => {
  activeSessionIds.value[session.provider] = session.id;
  activeProvider.value = session.provider;
  activeView.value = "chat";
  syncMessagesFromSession(session.provider);
  saveSessions();
  scrollChatToBottom();
};

const renameSession = (session: SessionRecord) => {
  const title = window.prompt(t("chat.sessionNamePrompt"), session.title);
  if (!title?.trim()) return;
  session.title = title.trim();
  session.updatedAt = new Date().toISOString();
  saveSessions();
};

const deleteSession = (session: SessionRecord) => {
  chatSessions.value = chatSessions.value.filter(item => item.id !== session.id);
  if (activeSessionIds.value[session.provider] === session.id) {
    const next = chatSessions.value.find(item => item.provider === session.provider) || defaultSession(session.provider);
    if (!chatSessions.value.find(item => item.id === next.id)) chatSessions.value.push(next);
    activeSessionIds.value[session.provider] = next.id;
    syncMessagesFromSession(session.provider);
  }
  saveSessions();
};

const saveTasks = () => {
  localStorage.setItem("weizhi.taskQueue", JSON.stringify(taskQueue.value));
};

const createTask = (title: string, provider: TaskRecord["provider"], detail: string): TaskRecord => {
  const task = {
    id: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    provider,
    status: "running" as const,
    createdAt: new Date().toISOString(),
    detail
  };
  taskQueue.value.unshift(task);
  saveTasks();
  return task;
};

const finishTask = (task: TaskRecord, status: TaskRecord["status"], detail?: string) => {
  task.status = status;
  if (detail) task.detail = detail;
  if (status === "success") addNotification("success", task.title, detail || t("tasks.taskSuccess"));
  if (status === "failed") addNotification("error", task.title, detail || t("tasks.taskFailed"));
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
  } catch (err: any) {
    addLog("Settings load failed: " + (err?.message || "unknown error"));
  } finally {
    settingsLoading.value = false;
  }
};

const refreshProviderModels = async (provider: ChatProvider) => {
  const res = await settingsApi.models(provider);
  settingsState.value = {
    ...settingsState.value,
    [provider]: {
      ...(settingsState.value?.[provider] || {}),
      models: res.data || []
    }
  };
};

const saveProviderSettings = async (provider: ChatProvider) => {
  settingsLoading.value = true;
  try {
    const draft = settingsDraft.value[provider] as any;
    const payload: { apiKey?: string; model?: string; baseUrl?: string } = { model: draft.model };
    if (draft.apiKey.trim()) payload.apiKey = draft.apiKey.trim();
    if (draft.baseUrl && draft.baseUrl.trim()) payload.baseUrl = draft.baseUrl.trim();
    const res = await settingsApi.update(provider, payload);
    settingsState.value = { ...settingsState.value, [provider]: res.data };
    if (provider === "gemini" && res.data?.model) {
      selectedGeminiModel.value = res.data.model;
    }
    draft.apiKey = "";
    addLog(`${provider} settings saved.`);
    addNotification("success", t("settings.saveSuccess"), `${providerMeta[provider].label} ${t("settings.saveSuccessDesc")}`);
    if (provider === "deepseek") await loadDeepSeekAccount();
  } catch (err: any) {
    addNotification("error", t("settings.saveFailed"), err?.message || "unknown error");
    addLog("Settings save failed: " + (err?.message || "unknown error"));
  } finally {
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
  } catch (err: any) {
    addLog("加载 Gemini 能力失败：" + (err?.message || "未知错误"));
  }
  // Then: trigger a background probe to get fresh availability data
  // (silent mode — no task log, just updates the list)
  handleGeminiProbe(true);
};

const handleGeminiProbe = async (silent = false) => {
  if (geminiProbeLoading.value) return;
  geminiProbeLoading.value = true;
  const task = silent ? null : createTask("检测 Gemini 中转模型", "gemini", "开始探测本地中转站的所有候选模型可用性...");
  try {
    const res = await geminiApi.probe();
    geminiCapabilities.value = res.data;
    if (task) {
      finishTask(task, "success", "Gemini 中转模型探测完成。可用模型数：" + (res.data?.models?.filter((m: any) => m.available)?.length || 0));
    }
  } catch (err: any) {
    if (task) {
      finishTask(task, "failed", err?.message || "探测失败");
      addLog("探测 Gemini 模型失败：" + (err?.message || "未知错误"));
    }
  } finally {
    geminiProbeLoading.value = false;
  }
};

const triggerFileUpload = () => {
  console.log("triggerFileUpload called, fileInput.value is:", fileInput.value);
  if (fileInput.value) {
    fileInput.value.click();
  } else {
    alert("上传控件未初始化，请稍后重试或检查控制台。");
  }
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
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
      } else {
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
    } else {
      throw new Error(res.data?.message || "接口返回失败");
    }
  } catch (err: any) {
    const errMsg = err?.response?.data?.message || err?.message || "网络请求失败";
    console.error("handleFileUpload: Upload error:", err);
    finishTask(task, "failed", errMsg);
    addNotification("error", "上传失败", errMsg);
    addLog("上传附件失败：" + errMsg);
    alert("上传失败原因: " + errMsg);
  } finally {
    isUploading.value = false;
    target.value = "";
  }
};

const removeUploadedFile = (index: number) => {
  uploadedFiles.value.splice(index, 1);
};

const loadApiStatus = async () => {
  try {
    const healthRes = await systemApi.getHealth();
    systemHealth.value = String(healthRes.data || "unknown");
  } catch {
    systemHealth.value = t("apiStatus.statusError");
  }
  await Promise.all([loadSettings(), loadDeepSeekAccount(), loadGeminiCapabilities()]);
};

const persistTtsUrls = () => {
  try {
    localStorage.setItem("weizhi.previewAudioUrl", previewAudioUrl.value);
    localStorage.setItem("weizhi.generateAudioUrl", generateAudioUrl.value);
  } catch { /* quota exceeded — non-critical */ }
};

const handlePreview = async () => {
  if (!previewText.value.trim()) return;
  if (previewLoading.value) return;
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
    try { await loadHistories(); } catch { /* history refresh is non-critical */ }
    finishTask(task, "success", t("speech.previewSuccess"));
  } catch (err: any) {
    finishTask(task, "failed", err?.message || t("speech.previewFailed"));
    addLog("TTS preview failed: " + (err?.message || "unknown error"));
  } finally {
    previewLoading.value = false;
  }
};

const handleGenerateTts = async () => {
  if (!previewText.value.trim()) return;
  if (generateLoading.value) return;
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
    try { await loadHistories(); } catch { /* history refresh is non-critical */ }
    finishTask(task, "success", t("speech.generateSuccess"));
  } catch (err: any) {
    finishTask(task, "failed", err?.message || t("speech.generateFailed"));
    addLog("TTS generate failed: " + (err?.message || "unknown error"));
  } finally {
    generateLoading.value = false;
  }
};

const deleteImageHistory = async (id: string) => {
  await imageApi.deleteHistory(id);
  await loadHistories();
};

const clearImageHistory = async () => {
  await imageApi.clearHistory();
  await loadHistories();
};

const deleteTtsHistory = async (id: string) => {
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

const isFavorite = (id: string) => favorites.value.some(item => item.id === id);

const addFavorite = (item: FavoriteItem) => {
  if (isFavorite(item.id)) return;
  favorites.value.unshift(item);
  saveFavorites();
  addNotification("success", t("favorites.addSuccess"), item.title);
};

const removeFavorite = (id: string) => {
  favorites.value = favorites.value.filter(item => item.id !== id);
  saveFavorites();
};

const favoriteMessage = (message: ChatMessage, index: number) => {
  addFavorite({
    id: `${activeProvider.value}-message-${index}`,
    type: "text",
    title: `${activeMeta.value.label} ${message.role === "user" ? t("chat.userMessage") : t("chat.aiReply")}`,
    subtitle: new Date().toLocaleString("zh-CN", { hour12: false }),
    content: message.content
  });
};

const favoriteAsset = (asset: AssetItem) => {
  addFavorite({
    id: `${asset.type}-${asset.id}`,
    type: asset.type,
    title: asset.title,
    subtitle: asset.subtitle,
    url: asset.url
  });
};

const openAssetDetail = (asset: AssetItem) => {
  selectedAsset.value = asset;
};

const closeAssetDetail = () => {
  selectedAsset.value = null;
};

const downloadAsset = (asset: AssetItem) => {
  const url = mediaUrl(asset.url);
  const link = document.createElement("a");
  link.href = url;
  link.download = url.split("/").pop() || `${asset.type}-${asset.id}`;
  link.target = "_blank";
  link.click();
  addNotification("success", t("assets.downloadStart"), link.download);
};

const deleteAsset = async (asset: AssetItem) => {
  if (confirm(t("assets.deleteConfirm") || "确定删除该素材吗？此操作不可恢复。")) {
    try {
      if (asset.type === 'image') {
        await imageApi.deleteHistory(asset.id);
      } else if (asset.type === 'document') {
        await documentApi.delete(asset.id);
      } else {
        await ttsApi.deleteHistory(asset.id);
      }
      addNotification("success", t("chat.deleteSuccess") || "删除成功", "");
      const key = `${asset.type}-${asset.id}`;
      const idx = selectedAssetKeys.value.indexOf(key);
      if (idx > -1) selectedAssetKeys.value.splice(idx, 1);
      await loadHistories();
    } catch (err: any) {
      addNotification("error", t("chat.deleteFailed") || "删除失败", err.message);
    }
  }
};

const toggleSelectAsset = (key: string) => {
  const index = selectedAssetKeys.value.indexOf(key);
  if (index > -1) {
    selectedAssetKeys.value.splice(index, 1);
  } else {
    selectedAssetKeys.value.push(key);
  }
};

const isAllSelected = computed(() => {
  if (filteredAssetItems.value.length === 0) return false;
  return filteredAssetItems.value.every(item => 
    selectedAssetKeys.value.includes(`${item.type}-${item.id}`)
  );
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    const filteredKeys = filteredAssetItems.value.map(item => `${item.type}-${item.id}`);
    selectedAssetKeys.value = selectedAssetKeys.value.filter(key => !filteredKeys.includes(key));
  } else {
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
  if (count === 0) return;
  
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
        } else if (type === 'document') {
          await documentApi.delete(id);
        } else {
          await ttsApi.deleteHistory(id);
        }
        successCount++;
      } catch (err) {
        failCount++;
      }
    });
    
    await Promise.all(promises);
    
    selectedAssetKeys.value = [];
    await loadHistories();
    
    if (failCount === 0) {
      addNotification("success", t("chat.deleteSuccess") || "删除成功", `成功删除 ${successCount} 个素材`);
    } else {
      addNotification("warning", t("chat.deletePartial") || "部分删除成功", `成功: ${successCount}, 失败: ${failCount}`);
    }
  }
};

const downloadSelectedAssets = () => {
  const count = selectedAssetKeys.value.length;
  if (count === 0) return;
  
  const selectedItems = filteredAssetItems.value.filter(item => 
    selectedAssetKeys.value.includes(`${item.type}-${item.id}`)
  );
  
  selectedItems.forEach((item, i) => {
    setTimeout(() => {
      downloadAsset(item);
    }, i * 250);
  });
  
  addNotification("success", t("assets.downloadStart"), `正在批量下载 ${count} 个素材`);
};

const downloadTextFile = (filename: string, content: string, type = "application/json") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  addNotification("success", t("exports.success"), filename);
};

const exportJson = (scope: "all" | "chat" | "media" | "logs" | "favorites" | "prompts") => {
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
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.sidebarWidth === "number") sidebarWidth.value = Math.min(420, Math.max(180, data.sidebarWidth));
    if (typeof data.chatInputHeight === "number") chatInputHeight.value = Math.min(600, Math.max(90, data.chatInputHeight));
  } catch {
    // Ignore invalid local storage state.
  }
};

const startResize = (target: "sidebar" | "chatInput", event: MouseEvent) => {
  resizing = target;
  event.preventDefault();
  document.body.classList.add("is-resizing");
  
  if (target === "chatInput") {
    const inputContainerEl = document.querySelector(".input-container") as HTMLElement;
    if (inputContainerEl && chatInputHeight.value === null) {
      chatInputHeight.value = inputContainerEl.offsetHeight;
    }
  }

  window.addEventListener("mousemove", resizeLayout);
  window.addEventListener("mouseup", stopResize);
};

const resizeLayout = (event: MouseEvent) => {
  if (!resizing) return;
  if (resizing === "sidebar") {
    sidebarWidth.value = Math.min(420, Math.max(180, event.clientX));
  } else if (resizing === "chatInput") {
    const rawHeight = window.innerHeight - event.clientY;
    const maxHeight = Math.min(600, window.innerHeight * 0.6);
    chatInputHeight.value = Math.min(maxHeight, Math.max(90, rawHeight));
  }
};

const stopResize = () => {
  if (resizing) persistLayout();
  resizing = null;
  document.body.classList.remove("is-resizing");
  window.removeEventListener("mousemove", resizeLayout);
  window.removeEventListener("mouseup", stopResize);
};

const handleGlobalError = (event: Event) => {
  const customEvt = event as CustomEvent;
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
    if (storedSessions) chatSessions.value = JSON.parse(storedSessions);
    const storedActive = localStorage.getItem("weizhi.activeSessionIds");
    if (storedActive) activeSessionIds.value = { ...activeSessionIds.value, ...JSON.parse(storedActive) };
  } catch {
    // Fall back to default local sessions.
  }
  ensureSessions();
  try {
    const storedTasks = localStorage.getItem("weizhi.taskQueue");
    if (storedTasks) taskQueue.value = JSON.parse(storedTasks);
  } catch {
    // Keep task queue empty if local storage is invalid.
  }
  try {
    const storedNotifications = localStorage.getItem("weizhi.notifications");
    if (storedNotifications) notifications.value = JSON.parse(storedNotifications);
  } catch {
    // Keep notifications empty if local storage is invalid.
  }
  try {
    const storedPrompts = localStorage.getItem("weizhi.promptTemplates");
    if (storedPrompts) promptTemplates.value = JSON.parse(storedPrompts);
  } catch {
    // Keep built-in templates if local prompt storage is invalid.
  }
  try {
    const storedFavorites = localStorage.getItem("weizhi.favorites");
    if (storedFavorites) favorites.value = JSON.parse(storedFavorites);
  } catch {
    // Keep favorites empty if local storage is invalid.
  }
  // Restore last TTS audio URLs so the speech page shows results after refresh
  try {
    const storedPreviewUrl = localStorage.getItem("weizhi.previewAudioUrl");
    if (storedPreviewUrl) previewAudioUrl.value = storedPreviewUrl;
    const storedGenerateUrl = localStorage.getItem("weizhi.generateAudioUrl");
    if (storedGenerateUrl) generateAudioUrl.value = storedGenerateUrl;
  } catch {
    // Non-critical — audio URLs will just be empty.
  }
  try {
    const storedTheme = localStorage.getItem("weizhi.theme") as any;
    if (["light", "obsidian", "midnight", "green", "pink"].includes(storedTheme)) {
      setTheme(storedTheme);
    }
  } catch {}
  
  window.addEventListener("click", closeModelDropdown);
  window.addEventListener("weizhi-global-error", handleGlobalError);
  
  // 启动程序自动探测可用模型
  handleGeminiProbe();
});

onBeforeUnmount(() => {
  if (logEventSource) logEventSource.close();
  window.removeEventListener("click", closeModelDropdown);
  window.removeEventListener("weizhi-global-error", handleGlobalError);
  stopResize();
});

const handleSend = async () => {
  if ((!inputText.value.trim() && uploadedFiles.value.length === 0) || isThinking.value) return;
  
  let userMsg = inputText.value.trim();
  const mediaItems: MediaItem[] = uploadedFiles.value.map(file => ({
    type: file.type,
    url: file.url
  }));

  if (uploadedFiles.value.length > 0) {
    const mediaTags = uploadedFiles.value.map(file => {
      if (file.type === "image") {
        return `\n![${file.name}](${file.url})`;
      } else {
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
  const isImagePrompt = (input: string) => {
    const s = input.toLowerCase();
    const questionMarkers = ["为什么", "怎么", "如何", "啥", "什么", "吗", "?", "？", "why", "how", "what"];
    if (s.includes("/api/images/files/") || s.includes("图片已生成")) return false;
    if (questionMarkers.some(marker => s.includes(marker))) return false;
    return (s.includes("生成") || s.includes("画") || s.includes("创建") || s.includes("draw") || s.includes("create"))
        && (s.includes("图片") || s.includes("图像") || s.includes("照片") || s.includes("image") || s.includes("picture"));
  };

  if (isImagePrompt(userMsg)) {
    // Fallback to standard blocking endpoint for image generation
    const request = provider === "deepseek"
      ? deepSeekApi.ask(userMsg, targetMessages.slice(0, -1).map((message): ProviderMessage => ({ role: message.role, content: message.content })), options)
      : provider === "openai"
        ? openaiApi.ask(userMsg, targetMessages.slice(0, -1).map((message): ProviderMessage => ({ role: message.role, content: message.content })), options)
        : provider === "gemini"
          ? geminiApi.ask(userMsg, targetMessages.slice(0, -1).map((message): ProviderMessage => ({ role: message.role, content: message.content })), geminiMode.value, selectedDocIds.value, selectedGeminiModel.value, options)
          : chatApi.ask(userMsg, targetMessages.slice(0, -1).map((message): ProviderMessage => ({ role: message.role, content: message.content })), options);

    request.then(async (res) => {
      const payload = res.data;
      const content = typeof payload?.text === "string" ? payload.text : (typeof payload === "string" ? payload : JSON.stringify(payload));
      const media: MediaItem[] = Array.isArray(payload?.media) ? payload.media : [];
      targetMessages.push({ role: "assistant", content, media });
      if (provider === "deepseek" && payload?.metadata?.localUsage) {
        deepSeekUsage.value = payload.metadata.localUsage;
      }
      scrollChatToBottom();
      try { await loadHistories(); } catch { /* non-critical */ }
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
  } else {
    // Use Server-Sent Events (SSE) streaming endpoint
    const url = provider === "deepseek"
      ? deepSeekApi.streamUrl()
      : provider === "openai"
        ? openaiApi.streamUrl()
        : provider === "gemini"
          ? geminiApi.streamUrl()
          : chatApi.streamUrl();

    // Push an initial empty assistant message block
    const assistantMsg = ref<ChatMessage>({ role: "assistant", content: "", media: [] });
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
      if (!reader) throw new Error("ReadableStream not supported on response");

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
        if (done) break;

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
          } else if (trimmed.startsWith("data:")) {
            const rawToken = line.substring(5);
            const dataToken = rawToken === "" ? "\n" : rawToken;
            if (dataToken.trim() === "[DONE]") break;
            
            if (currentEvent === "error") {
              assistantMsg.value.content += "\n[Error: " + dataToken.trim() + "]";
            } else if (currentEvent === "reasoning") {
              // Properly accumulate reasoning tokens inside a single <think> block
              if (!inReasoningBlock) {
                assistantMsg.value.content += "<think>\n";
                inReasoningBlock = true;
              }
              assistantMsg.value.content += dataToken;
            } else {
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
                } catch {
                  assistantMsg.value.content += dataToken;
                }
              } else {
                // Preserve spaces and newlines
                assistantMsg.value.content += dataToken;
              }
            }
            throttledScroll();
          } else if (trimmed.startsWith("error:")) {
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
    } catch (err: any) {
      if (err?.name === "AbortError" || chatAbortController.value === null) {
        finishTask(task, "failed", t("chat.qaAborted"));
        return;
      }
      finishTask(task, "failed", err?.message || t("chat.qaFailed"));
      assistantMsg.value.content += "\n[Stream Error: " + (err?.message || "connection closed") + "]";
      addLog("Error streaming from AI: " + err.message);
    } finally {
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

const copyToClipboard = (text: string, index: number) => {
  if (!text) return;
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


const switchProvider = (provider: ChatProvider) => {
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

const openMiniMaxHistory = async (view: "imageHistory" | "ttsHistory") => {
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
  } catch (err: any) {
    addNotification("error", t("dataManagement.connectionFailed"), err?.message || "unknown error");
  } finally {
    dataManagementLoading.value = false;
  }
};

const switchDataSourceMode = async (mode: DataSourceMode) => {
  selectedDataMode.value = mode;
  dataManagementLoading.value = true;
  connectionTestResult.value = null;
  try {
    const res = await dataManagementApi.switchMode(mode);
    if (res.data?.status) dataManagementStatus.value = res.data.status;
    selectedDataMode.value = res.data?.mode || dataManagementStatus.value?.mode || "json";
    
    const success = res.data?.success || false;
    const message = res.data?.message || "";
    connectionTestResult.value = { success, message };
    
    addNotification(success ? "success" : "warning", success ? t("dataManagement.switchSuccess") : t("dataManagement.switchFailed"), message);
  } catch (err: any) {
    selectedDataMode.value = dataManagementStatus.value?.mode || "json";
    const message = err?.message || "unknown error";
    connectionTestResult.value = { success: false, message };
    addNotification("error", t("dataManagement.switchFailed"), message);
  } finally {
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
  } catch (err: any) {
    const message = err?.message || "unknown error";
    connectionTestResult.value = { success: false, message };
    addNotification("error", t("dataManagement.connectionFailed"), message);
  } finally {
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
  } catch (err: any) {
    const message = err?.message || "unknown error";
    connectionTestResult.value = { success: false, message };
    addNotification("error", t("dataManagement.connectionFailed"), message);
  } finally {
    dataManagementLoading.value = false;
  }
};

const openDataManagement = () => {
  activeView.value = "dataManagement";
  loadDataManagementStatus();
};

const clearCurrentConversation = () => {
  if (activeProvider.value === "minimax") minimaxMessages.value = [];
  else if (activeProvider.value === "deepseek") deepSeekMessages.value = [];
  else if (activeProvider.value === "openai") openaiMessages.value = [];
  else geminiMessages.value = [];
  saveActiveSession(activeProvider.value);
};

const clearSession = (provider: ChatProvider) => {
  const session = chatSessions.value.find(item => item.id === activeSessionIds.value[provider]);
  if (session) {
    session.messages = [];
    session.updatedAt = new Date().toISOString();
  }
  if (provider === "minimax") minimaxMessages.value = [];
  else if (provider === "deepseek") deepSeekMessages.value = [];
  else if (provider === "openai") openaiMessages.value = [];
  else geminiMessages.value = [];
  saveSessions();
};

const savePromptTemplates = () => {
  localStorage.setItem("weizhi.promptTemplates", JSON.stringify(promptTemplates.value));
};

const addPromptTemplate = () => {
  if (!promptDraft.value.title.trim() || !promptDraft.value.content.trim()) return;
  promptTemplates.value.unshift({
    id: String(Date.now()),
    title: promptDraft.value.title.trim(),
    content: promptDraft.value.content.trim(),
    provider: promptDraft.value.provider
  });
  promptDraft.value = { title: "", content: "", provider: "通用" };
  savePromptTemplates();
};

const deletePromptTemplate = (id: string) => {
  promptTemplates.value = promptTemplates.value.filter(item => item.id !== id);
  savePromptTemplates();
};

const usePromptTemplate = (template: PromptTemplate) => {
  activeView.value = "chat";
  if (template.provider === "MiniMax") activeProvider.value = "minimax";
  if (template.provider === "DeepSeek") activeProvider.value = "deepseek";
  let content = template.content;
  const variables = Array.from(new Set([...content.matchAll(/\{([^{}]+)\}/g)].map(match => match[1].trim()).filter(Boolean)));
  for (const variable of variables) {
    const value = window.prompt(`${t("prompt.fillVariable")} ${variable}`, "");
    if (value === null) return;
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
</script>

<template>
  <AppBackground />
  <div
    class="app-container glass-layout"
    :class="activeView === 'home' ? 'provider-home' : `provider-${activeProvider}`"
    :style="{
      '--sidebar-width': `${sidebarWidth}px`
    }"
  >
    <FloatingSidebar />
    <div class="vertical-resizer sidebar-resizer glass-resizer" @mousedown.prevent="startResize('sidebar', $event)"></div>
    <FloatingMainPanel>
      <section v-if="activeView === 'home'" class="home-page">
        <div class="home-hero">
          <div class="home-copy">
            <span>WEIZHI AGENT WORKSPACE</span>
            <h1>{{ $t("home.welcomeTitle") }}</h1>
            <p>{{ $t("home.welcomeDesc") }}</p>
            <div class="home-actions">
              <button class="preview-btn" @click="switchProvider('minimax')">{{ $t("home.enterMinimax") }}</button>
              <button class="preview-btn secondary" @click="switchProvider('deepseek')">{{ $t("home.enterDeepseek") }}</button>
              <button class="preview-btn secondary" @click="switchProvider('openai')">进入 OpenAI</button>
              <button class="preview-btn secondary" @click="switchProvider('gemini')">{{ $t("home.enterGemini") }}</button>
              <button class="preview-btn secondary" @click="openAssets">{{ $t("home.viewAssets") }}</button>
            </div>
          </div>
        </div>
        <div class="home-overview">
          <button v-for="stat in dashboardStats" :key="stat.label" class="home-tile" @click="stat.label === $t('dashboard.tasks') ? activeView = 'tasks' : stat.label === $t('dashboard.sessions') ? activeView = 'sessions' : stat.label === $t('dashboard.assets') ? openAssets() : activeView = 'favorites'">
            <Activity :size="18" />
            <strong>{{ stat.value }} {{ stat.label }}</strong>
            <span>{{ stat.detail }}</span>
          </button>
        </div>
        <div class="home-notices" v-if="recentNotifications.length">
          <div v-for="notice in recentNotifications" :key="notice.id" class="home-notice" :class="`notice-${notice.level}`">
            <strong>{{ notice.title }}</strong>
            <span>{{ notice.message }}</span>
          </div>
        </div>
      </section>

      <section v-else-if="activeView === 'dataManagement'" class="settings-view">
        <div class="settings-header">
          <div>
            <h2>{{ $t("dataManagement.title") }}</h2>
            <p>{{ $t("dataManagement.desc") }}</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="log-action" :disabled="dataManagementLoading" @click="loadDataManagementStatus">
              {{ $t("apiStatus.refresh") }}
            </button>
            <button class="log-action" :disabled="dataManagementLoading" @click="testDataConnection">
              {{ $t("dataManagement.testConnection") }}
            </button>
          </div>
        </div>

        <div v-if="connectionTestResult" class="home-notice" :class="connectionTestResult.success ? 'notice-success' : 'notice-error'" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-radius: var(--radius-sm);">
          <div>
            <strong style="margin-right: 8px;">{{ connectionTestResult.success ? $t("dataManagement.connectionSuccess") : $t("dataManagement.connectionFailed") }}</strong>
            <span style="opacity: 0.9;">{{ connectionTestResult.message }}</span>
          </div>
          <button class="icon-btn" style="border: none; background: transparent; padding: 4px; color: inherit; cursor: pointer;" @click="connectionTestResult = null">
            <X :size="14" />
          </button>
        </div>

        <div class="settings-grid">
          <section class="settings-card minimax-card wide-status" style="grid-column: span 2;">
            <div class="settings-card-head">
              <strong>{{ $t("dataManagement.currentMode") }}</strong>
            </div>
            <div class="provider-toggle">
              <button class="toggle-pill" :class="{ active: selectedDataMode === 'json' }" :disabled="dataManagementLoading" @click="switchDataSourceMode('json')">
                {{ $t("dataManagement.jsonMode") }}
              </button>
              <button class="toggle-pill" :class="{ active: selectedDataMode === 'postgresql' }" :disabled="dataManagementLoading" @click="switchDataSourceMode('postgresql')">
                {{ $t("dataManagement.postgresqlMode") }}
              </button>
            </div>
            <p style="font-size: 13px; color: var(--text-muted);">{{ dataManagementStatus?.postgresql?.message || $t("dataManagement.postgresqlUnavailable") }}</p>
          </section>

          <section v-for="card in dataFileCards" :key="card.key" class="settings-card">
            <div class="settings-card-head">
              <strong>{{ card.label }}</strong>
              <span :class="card.info.exists ? 'active' : 'inactive'">{{ card.info.exists ? $t("dataManagement.exists") : $t("dataManagement.missing") }}</span>
            </div>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">{{ card.info.recordCount || 0 }} {{ $t("dataManagement.records") }}</p>
            <small style="display: block; margin-top: 12px; font-size: 11px; word-break: break-all; opacity: 0.7;">{{ card.info.path || "" }}</small>
          </section>

          <section class="settings-card">
            <div class="settings-card-head">
              <strong>{{ $t("dataManagement.postgresqlStatus") }}</strong>
              <span :class="postgresqlInfo.ready ? 'active' : 'inactive'">{{ postgresqlInfo.ready ? $t("apiStatus.statusOk") : $t("apiStatus.statusPending") }}</span>
            </div>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">{{ postgresqlInfo.message || $t("dataManagement.postgresqlUnavailable") }}</p>
            <div style="display: grid; gap: 8px; margin-top: 14px; font-size: 12px; color: var(--text-muted);">
              <div><strong>{{ $t("dataManagement.host") }}:</strong> {{ postgresqlInfo.host || "-" }}:{{ postgresqlInfo.port || "-" }}</div>
              <div><strong>{{ $t("dataManagement.database") }}:</strong> {{ postgresqlInfo.database || "-" }}</div>
              <div><strong>{{ $t("dataManagement.username") }}:</strong> {{ postgresqlInfo.username || "-" }}</div>
              <div style="word-break: break-all;"><strong>{{ $t("dataManagement.jdbcUrl") }}:</strong> {{ postgresqlInfo.jdbcUrl || "-" }}</div>
            </div>
            <button class="log-action" style="margin-top: 14px;" :disabled="dataManagementLoading" @click="testPostgreSqlConnection">
              {{ $t("dataManagement.testPostgresql") }}
            </button>
          </section>
        </div>
      </section>

      <section v-else-if="activeView === 'settings'" class="settings-view">
        <div class="settings-header">
          <div>
            <h2>{{ $t("settings.title") }}</h2>
            <p>{{ $t("settings.desc") }}</p>
          </div>
          <button class="icon-btn" :title="$t('settings.refresh')" :disabled="settingsLoading" @click="loadSettings"><RefreshCw :size="15" /></button>
        </div>

        <div class="settings-grid">
          <section class="settings-card minimax-card">
            <div class="settings-card-head">
              <strong>MiniMax</strong>
              <span>{{ settingsState?.minimax?.apiKeyConfigured ? settingsState?.minimax?.apiKeyMasked : $t("apiStatus.notConfigured") }}</span>
            </div>
            <label>API Key</label>
            <input v-model="settingsDraft.minimax.apiKey" type="password" :placeholder="$t('settings.emptyKey')" />
            <label>{{ $t("settings.modelLabel") }}</label>
            <div class="settings-row">
              <select v-model="settingsDraft.minimax.model">
                <option v-for="model in minimaxModels" :key="model.id" :value="model.id">{{ model.name || model.id }}</option>
              </select>
              <button class="preview-btn secondary" @click="refreshProviderModels('minimax')">{{ $t("settings.refreshModel") }}</button>
            </div>
            <button class="save-settings-btn" :disabled="settingsLoading" @click="saveProviderSettings('minimax')">{{ $t("settings.saveMinimax") }}</button>
          </section>

          <section class="settings-card deepseek-card">
            <div class="settings-card-head">
              <strong>DeepSeek</strong>
              <span>{{ settingsState?.deepseek?.apiKeyConfigured ? settingsState?.deepseek?.apiKeyMasked : $t("apiStatus.notConfigured") }}</span>
            </div>
            <label>API Key</label>
            <input v-model="settingsDraft.deepseek.apiKey" type="password" :placeholder="$t('settings.emptyKey')" />
            <label>{{ $t("settings.modelLabel") }}</label>
            <div class="settings-row">
              <select v-model="settingsDraft.deepseek.model">
                <option v-for="model in deepSeekModels" :key="model.id" :value="model.id">{{ model.name || model.id }}</option>
              </select>
              <button class="preview-btn secondary" @click="refreshProviderModels('deepseek')">{{ $t("settings.refreshModel") }}</button>
            </div>
            <button class="save-settings-btn deepseek-save" :disabled="settingsLoading" @click="saveProviderSettings('deepseek')">{{ $t("settings.saveDeepseek") }}</button>
            <p class="settings-hint">{{ $t("settings.deepseekHint") }}</p>
          </section>

          <section class="settings-card openai-card">
            <div class="settings-card-head">
              <strong>OpenAI / API</strong>
              <span>{{ settingsState?.openai?.apiKeyConfigured ? settingsState?.openai?.apiKeyMasked : $t("apiStatus.notConfigured") }}</span>
            </div>
            <label>Base URL</label>
            <input v-model="settingsDraft.openai.baseUrl" type="text" placeholder="https://api.openai.com/v1" />
            <label>API Key</label>
            <input v-model="settingsDraft.openai.apiKey" type="password" :placeholder="$t('settings.emptyKey')" />
            <label>{{ $t("settings.modelLabel") }}</label>
            <div class="settings-row">
              <select v-model="settingsDraft.openai.model">
                <option v-for="model in openaiModels" :key="model.id" :value="model.id">{{ model.name || model.id }}</option>
              </select>
              <button class="preview-btn secondary" @click="refreshProviderModels('openai')">{{ $t("settings.refreshModel") }}</button>
            </div>
            <button class="save-settings-btn" :disabled="settingsLoading" @click="saveProviderSettings('openai')">{{ $t("settings.saveOpenai") }}</button>
          </section>

          <section class="settings-card gemini-card">
            <div class="settings-card-head">
              <strong>Gemini 会话</strong>
              <span>{{ settingsState?.gemini?.apiKeyConfigured ? settingsState?.gemini?.apiKeyMasked : $t("apiStatus.notConfigured") }}</span>
            </div>
            <label>Base URL</label>
            <input v-model="settingsDraft.gemini.baseUrl" type="text" placeholder="http://127.0.0.1:8045/v1" />
            <label>API Key</label>
            <input v-model="settingsDraft.gemini.apiKey" type="password" :placeholder="$t('settings.emptyKey')" />
            <label>{{ $t("settings.modelLabel") }}</label>
            <div class="settings-row">
              <select v-model="settingsDraft.gemini.model">
                <option v-for="model in geminiModels" :key="model.id" :value="model.id">{{ model.name || model.id }}</option>
              </select>
              <button class="preview-btn secondary" @click="refreshProviderModels('gemini')">{{ $t("settings.refreshModel") }}</button>
            </div>
            <button class="save-settings-btn" :disabled="settingsLoading" @click="saveProviderSettings('gemini')">{{ $t("settings.saveGemini") }}</button>

            <!-- Model capability probe section -->
            <div class="gemini-probe-section" style="margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--text-color);">检测中转模型</h4>
                <button class="preview-btn secondary" :disabled="geminiProbeLoading" @click="handleGeminiProbe(false)" style="padding: 6px 12px; font-size: 12px;">
                  <span v-if="geminiProbeLoading">探测中...</span>
                  <span v-else>立即检测</span>
                </button>
              </div>
              <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 12px 0;">
                中转地址: {{ geminiCapabilities?.baseUrl || 'http://127.0.0.1:8045/v1' }}
                <span v-if="geminiCapabilities?.checkedAt" style="margin-left: 8px;">检测时间: {{ new Date(geminiCapabilities.checkedAt).toLocaleTimeString() }}</span>
                <span v-if="geminiCapabilities?.accountEmail" style="margin-left: 8px; color: #10b981;">账号: {{ geminiCapabilities.accountEmail }}</span>
              </p>
              
              <div v-if="geminiCapabilities?.models && geminiCapabilities.models.length" style="max-height: 250px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                  <thead>
                    <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08); color: var(--text-muted);">
                      <th style="padding: 8px 12px;">模型 ID</th>
                      <th style="padding: 8px 12px;">状态</th>
                      <th style="padding: 8px 12px;">延迟</th>
                      <th style="padding: 8px 12px;">映射与账号</th>
                      <th style="padding: 8px 12px;">建议用途</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="m in geminiCapabilities.models" :key="m.id" style="border-bottom: 1px solid rgba(255,255,255,0.04); background: rgba(255,255,255,0.01);">
                      <td style="padding: 8px 12px; font-family: monospace; font-size: 11px;">
                        <span :style="{ color: m.available ? '#60a5fa' : '#9ca3af' }">{{ m.id }}</span>
                        <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">组: {{ m.group }}</div>
                      </td>
                      <td style="padding: 8px 12px;">
                        <span v-if="m.available" style="color: #34d399; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
                          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #34d399;"></span> 可用
                        </span>
                        <span v-else style="color: #f87171; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
                          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f87171;"></span> 不可用 ({{ m.errorType }})
                        </span>
                      </td>
                      <td style="padding: 8px 12px; color: var(--text-muted);">{{ m.available ? m.latencyMs + 'ms' : '--' }}</td>
                      <td style="padding: 8px 12px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div v-if="m.mappedModel" style="color: var(--text-color); font-size: 11px;" :title="m.mappedModel">映射: {{ m.mappedModel }}</div>
                        <div v-if="m.accountEmail" style="color: #34d399; font-size: 10px;" :title="m.accountEmail">账号: {{ m.accountEmail }}</div>
                        <div v-if="!m.mappedModel && !m.accountEmail" style="color: var(--text-muted); font-size: 11px;">--</div>
                      </td>
                      <td style="padding: 8px 12px; color: var(--text-muted); font-size: 11px; max-width: 200px;" :title="m.recommendedUse">{{ m.recommendedUse }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else style="text-align: center; padding: 20px; border: 1px dashed rgba(255,255,255,0.08); border-radius: 6px; color: var(--text-muted); font-size: 12px;">
                暂无探测数据，请点击“立即检测”开始扫描。
              </div>
            </div>
          </section>
        </div>
      </section>

      <section v-else-if="activeView === 'logs'" class="module-page logs-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("logs.title") }}</h2>
            <p>{{ $t("logs.desc") }}</p>
          </div>
          <div class="log-controls page-controls">
            <select v-model="logLevel" class="log-level-select" @change="loadLogEntries">
              <option value="">{{ $t("logs.allLevels") }}</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
            <input v-model="logQuery" class="log-search" :placeholder="$t('logs.searchPlaceholder')" @keydown.enter.prevent="loadLogEntries" />
            <button class="log-action" :disabled="logLoading" @click="loadLogEntries">{{ $t("logs.refresh") }}</button>
            <button class="log-action danger" @click="clearLogEntries">{{ $t("logs.clear") }}</button>
          </div>
        </div>
        <div class="module-body log-body-page" ref="logContainer">
          <div v-if="logEntries.length" class="structured-log-list">
            <div v-for="entry in logEntries" :key="entry.id" class="structured-log" :class="logLevelClass(entry.level)">
              <span class="log-time">{{ formatLogTime(entry.timestamp) }}</span>
              <span class="log-level">{{ entry.level }}</span>
              <span class="log-thread">{{ entry.thread }}</span>
              <span class="log-logger" :title="entry.logger">{{ entry.logger }}</span>
              <span class="log-message">{{ entry.message }}</span>
            </div>
          </div>
          <div v-else class="log-empty">{{ $t("logs.empty") }}</div>
        </div>
      </section>

      <section v-else-if="activeView === 'speech'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("speech.title") }}</h2>
            <p>{{ $t("speech.desc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" @click="loadVoices">{{ $t("speech.refreshVoices") }}</button>
            <button class="log-action" @click="openMiniMaxHistory('ttsHistory')">{{ $t("speech.viewHistory") }}</button>
          </div>
        </div>
        <div class="module-body speech-layout">
          <section class="speech-composer">
            <label>{{ $t("speech.textLabel") }}</label>
            <textarea v-model="previewText" class="tts-preview-input speech-textarea" :placeholder="$t('speech.textPlaceholder')" />
            
            <div class="speech-presets">
              <span class="preset-label">{{ $t("speech.presetLabel") }}</span>
              <div class="preset-groups">
                <div class="preset-group">
                  <span class="group-title">{{ $t("speech.shortText") }}</span>
                  <button v-for="ex in shortExamples" :key="ex.label" class="preset-btn" @click="previewText = ex.text" :title="ex.text">
                    {{ ex.label }}
                  </button>
                </div>
                <div class="preset-group">
                  <span class="group-title">{{ $t("speech.longText") }}</span>
                  <button v-for="ex in longExamples" :key="ex.label" class="preset-btn" @click="previewText = ex.text" :title="ex.text">
                    {{ ex.label }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Tabbed Voice Card Selector -->
            <div class="voice-selector-panel">
              <span class="voice-selector-title">{{ $t("speech.voiceLabel") }}</span>
              <div class="voice-tabs">
                <button 
                  v-for="tab in voiceTabs" 
                  :key="tab" 
                  class="voice-tab-btn" 
                  :class="{ active: activeVoiceTab === tab }"
                  @click="activeVoiceTab = tab"
                >
                  {{ tab }} ({{ voiceTabCounts[tab] || 0 }})
                </button>
              </div>
              <div class="voice-cards-grid">
                <div 
                  v-for="v in filteredVoices" 
                  :key="v.voiceId" 
                  class="voice-card" 
                  :class="{ active: previewVoiceId === v.voiceId }"
                  @click="previewVoiceId = v.voiceId"
                >
                  <div class="voice-card-body">
                    <span class="voice-card-name">{{ v.name }}</span>
                    <span class="voice-card-id">{{ v.voiceId }}</span>
                  </div>
                  <p class="voice-card-desc" :title="v.description">{{ v.description }}</p>
                </div>
              </div>
            </div>

            <div class="speech-grid">
              <label>{{ $t("speech.formatLabel") }}<select v-model="previewFormat"><option value="mp3">mp3</option><option value="wav">wav</option><option value="flac">flac</option></select></label>
              <label>Speed<input v-model.number="previewSpeed" type="number" step="0.1" min="0.5" max="2" /></label>
              <label>Vol<input v-model.number="previewVol" type="number" step="0.1" min="0.1" max="2" /></label>
              <label>Pitch<input v-model.number="previewPitch" type="number" step="1" min="-12" max="12" /></label>
              <label>Sample Rate<input v-model.number="previewSampleRate" type="number" step="1000" /></label>
              <label>Bitrate<input v-model.number="previewBitrate" type="number" step="1000" /></label>
            </div>
            <div class="speech-actions">
              <button class="preview-btn" :disabled="previewLoading" @click="handlePreview">{{ previewLoading ? $t("speech.generating") : $t("speech.previewBtn") }}</button>
              <button class="preview-btn secondary" :disabled="generateLoading" @click="handleGenerateTts">{{ generateLoading ? $t("speech.generating") : $t("speech.generateBtn") }}</button>
            </div>
          </section>
          <section class="speech-result">
            <div class="speech-result-header">
              <strong>{{ $t("speech.outputPreview") }}</strong>
              <button class="log-action danger" v-if="ttsHistories.length" @click="clearTtsHistory">{{ $t("history.clearTts") }}</button>
            </div>
            <div class="speech-result-list" v-if="ttsHistories.length">
              <div v-for="item in ttsHistories" :key="String(item.id)" class="speech-audio-card">
                <div class="audio-card-meta">
                  <span class="audio-tag" :class="item.preview ? 'preview-tag' : 'full-tag'">
                    {{ item.preview ? $t("speech.previewBtn") : $t("speech.generateBtn") }}
                  </span>
                  <span class="audio-voice">{{ item.voiceId }}</span>
                  <span class="audio-time">{{ formatLogTime(item.createdAt) }}</span>
                </div>
                <p class="audio-text" :title="item.text">{{ item.text }}</p>
                <audio :src="mediaUrl(String(item.audioUrl || ''))" controls class="audio-player" />
                <div class="audio-actions">
                  <button class="icon-btn-small" :title="$t('assets.favorite')" @click="favoriteAsset({ id: String(item.id), type: 'audio', title: String(item.text || $t('history.defaultTtsText')), subtitle: `${item.voiceId || 'voice'} · ${item.format || 'audio'} · ${item.preview ? 'preview' : 'tts'}`, url: String(item.audioUrl || '') })">
                    <Star :size="12" />
                  </button>
                  <button class="icon-btn-small" :title="$t('assets.download')" @click="downloadAsset({ id: String(item.id), type: 'audio', title: String(item.text || $t('history.defaultTtsText')), subtitle: `${item.voiceId || 'voice'} · ${item.format || 'audio'} · ${item.preview ? 'preview' : 'tts'}`, url: String(item.audioUrl || '') })">
                    <Download :size="12" />
                  </button>
                  <button class="icon-btn-small danger" :title="$t('chat.delete')" @click="deleteTtsHistory(String(item.id))">
                    <Trash2 :size="12" />
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="empty-module">{{ $t("speech.emptyOutput") }}</div>
          </section>
        </div>
      </section>

      <TranslationView v-else-if="activeView === 'translation'" />

      <section v-else-if="activeView === 'sessions'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("nav.sessions") }}</h2>
            <p>{{ $t("history.minimaxImageDesc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" @click="createSession('minimax')">{{ $t("chat.newMinimaxName") }}</button>
            <button class="log-action" @click="createSession('deepseek')">{{ $t("chat.newDeepseekName") }}</button>
          </div>
        </div>
        <div class="module-body session-grid">
          <article v-for="session in sessionSummaries" :key="session.id" class="session-card" :class="`${session.provider}-session-card`">
            <div>
              <strong>{{ session.title }}</strong>
              <span>{{ providerMeta[session.provider].label }} · {{ session.subtitle }}</span>
            </div>
            <p>{{ session.last }}</p>
            <div class="session-card-footer">
              <small>{{ session.count }} {{ $t("chat.msgCount") }}</small>
              <button class="log-action" @click="openSession(session)">{{ $t("chat.continue") }}</button>
              <button class="log-action" @click="renameSession(session)">{{ $t("chat.rename") }}</button>
              <button class="log-action danger" @click="deleteSession(session)">{{ $t("chat.delete") }}</button>
            </div>
          </article>
        </div>
      </section>

      <section v-else-if="activeView === 'tasks'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("tasks.title") }}</h2>
            <p>{{ $t("tasks.desc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" @click="clearFinishedTasks">{{ $t("tasks.clearFinished") }}</button>
          </div>
        </div>
        <div class="module-body task-list">
          <article v-for="task in taskQueue" :key="task.id" class="task-card" :class="`task-${task.status}`">
            <div class="task-status">{{ task.status }}</div>
            <div>
              <strong>{{ task.title }}</strong>
              <p>{{ task.detail }}</p>
              <span>{{ task.provider }} · {{ new Date(task.createdAt).toLocaleString("zh-CN", { hour12: false }) }}</span>
            </div>
          </article>
          <div v-if="!taskQueue.length" class="empty-module">{{ $t("tasks.empty") }}</div>
        </div>
      </section>

      <section v-else-if="activeView === 'notifications'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("notifications.title") }}</h2>
            <p>{{ $t("notifications.desc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" @click="markNotificationsRead">{{ $t("notifications.markAllRead") }}</button>
            <button class="log-action danger" @click="notifications = []; saveNotifications()">{{ $t("notifications.clearAll") }}</button>
          </div>
        </div>
        <div class="module-body notification-list">
          <article v-for="notice in notifications" :key="notice.id" class="notification-card" :class="[`notice-${notice.level}`, { unread: !notice.read }]">
            <div>
              <strong>{{ notice.title }}</strong>
              <p>{{ notice.message }}</p>
              <span>{{ new Date(notice.createdAt).toLocaleString("zh-CN", { hour12: false }) }}</span>
            </div>
            <button class="icon-btn" @click="removeNotification(notice.id)"><X :size="14" /></button>
          </article>
          <div v-if="!notifications.length" class="empty-module">{{ $t("notifications.empty") }}</div>
        </div>
      </section>

      <section v-else-if="activeView === 'prompts'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("exports.promptsJsonDesc") }}</h2>
            <p>{{ $t("settings.desc") }}</p>
          </div>
        </div>
        <div class="module-body prompt-layout">
          <section class="prompt-editor">
            <input v-model="promptDraft.title" :placeholder="$t('prompt.draftNamePlaceholder')" />
            <select v-model="promptDraft.provider"><option value="通用">{{ $t("prompt.providerGeneric") }}</option><option value="MiniMax">MiniMax</option><option value="DeepSeek">DeepSeek</option></select>
            <textarea v-model="promptDraft.content" :placeholder="$t('prompt.draftContentPlaceholder')" />
            <button class="preview-btn" @click="addPromptTemplate">{{ $t("prompt.addBtn") }}</button>
          </section>
          <section class="prompt-list">
            <article v-for="template in promptTemplates" :key="template.id" class="prompt-card">
              <div class="prompt-card-head">
                <strong>{{ template.title }}</strong>
                <span>{{ template.provider }}</span>
              </div>
              <p>{{ template.content }}</p>
              <div class="page-controls">
                <button class="log-action" @click="usePromptTemplate(template)">{{ $t("prompt.useBtn") }}</button>
                <button class="log-action danger" @click="deletePromptTemplate(template.id)">{{ $t("chat.delete") }}</button>
              </div>
            </article>
          </section>
        </div>
      </section>

      <section v-else-if="activeView === 'apiStatus'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("nav.apiStatus") }}</h2>
            <p>{{ $t("settings.desc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" :disabled="settingsLoading || accountLoading" @click="loadApiStatus">{{ $t("apiStatus.refresh") }}</button>
            <button class="log-action" @click="openSettings">{{ $t("settings.title") }}</button>
          </div>
        </div>
        <div class="module-body status-layout">
          <article v-for="card in apiStatusCards" :key="card.name" class="status-card">
            <span>{{ card.name }}</span>
            <strong>{{ card.status }}</strong>
            <p>{{ card.detail }}</p>
          </article>
          <article class="status-card wide-status">
            <span>{{ $t("apiStatus.deepseekUsageTitle") }}</span>
            <div class="usage-grid">
              <div><span>{{ $t("apiStatus.requests") }}</span><strong>{{ deepSeekUsage?.requests || 0 }}</strong></div>
              <div><span>{{ $t("apiStatus.promptTokens") }}</span><strong>{{ deepSeekUsage?.promptTokens || 0 }}</strong></div>
              <div><span>{{ $t("apiStatus.completionTokens") }}</span><strong>{{ deepSeekUsage?.completionTokens || 0 }}</strong></div>
              <div><span>{{ $t("apiStatus.totalTokens") }}</span><strong>{{ deepSeekUsage?.totalTokens || 0 }}</strong></div>
            </div>
            <button class="open-usage-btn" @click="openDeepSeekUsage">{{ $t("apiStatus.openUsage") }}</button>
          </article>
        </div>
      </section>

      <section v-else-if="activeView === 'assets'" class="module-page assets-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("nav.assets") }}</h2>
            <p>{{ $t("assets.desc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" @click="loadHistories">{{ $t("assets.refresh") }}</button>
            <button class="log-action" @click="exportJson('media')">{{ $t("assets.exportIndex") }}</button>
          </div>
        </div>
        <div class="assets-tabs-container">
          <div class="assets-tabs-wrapper">
            <div class="assets-tabs">
              <button 
                class="assets-tab-btn" 
                :class="{ active: activeAssetTab === 'all' }" 
                @click="activeAssetTab = 'all'"
              >
                {{ $t("assets.tabAll") }} ({{ assetItems.length }})
              </button>
              <button 
                class="assets-tab-btn" 
                :class="{ active: activeAssetTab === 'image' }" 
                @click="activeAssetTab = 'image'"
              >
                {{ $t("assets.tabImages") }} ({{ assetItems.filter(item => item.type === 'image').length }})
              </button>
              <button 
                class="assets-tab-btn" 
                :class="{ active: activeAssetTab === 'audio' }" 
                @click="activeAssetTab = 'audio'"
              >
                {{ $t("assets.tabAudio") }} ({{ assetItems.filter(item => item.type === 'audio').length }})
              </button>
              <button 
                class="assets-tab-btn" 
                :class="{ active: activeAssetTab === 'document' }" 
                @click="activeAssetTab = 'document'"
              >
                文档 ({{ assetItems.filter(item => item.type === 'document').length }})
              </button>
            </div>
            
            <div class="assets-batch-actions" v-if="filteredAssetItems.length > 0">
              <button 
                class="log-action" 
                :class="{ active: selectedAssetKeys.length > 0 }"
                @click="toggleSelectAll"
              >
                <input 
                  type="checkbox" 
                  :checked="isAllSelected" 
                  class="batch-checkbox-input"
                  @click.stop="toggleSelectAll"
                />
                <span style="margin-left: 6px;">{{ isAllSelected ? $t("assets.deselectAll") : $t("assets.selectAll") }}</span>
              </button>
              
              <template v-if="selectedAssetKeys.length > 0">
                <span class="batch-selected-count">
                  {{ $t("assets.selectedCount", { count: selectedAssetKeys.length }) }}
                </span>
                <button class="log-action" @click="downloadSelectedAssets">
                  <Download :size="14" />
                  <span style="margin-left: 4px;">{{ $t("assets.batchDownload") }}</span>
                </button>
                <button class="log-action danger" @click="deleteSelectedAssets">
                  <Trash2 :size="14" />
                  <span style="margin-left: 4px;">{{ $t("assets.batchDelete") }}</span>
                </button>
                <button class="log-action" @click="selectedAssetKeys = []">
                  {{ $t("chat.cancel") || "取消" }}
                </button>
              </template>
            </div>
          </div>
        </div>
        <div class="module-body">
          <div class="asset-grid">
            <article 
              v-for="asset in filteredAssetItems" 
              :key="`${asset.type}-${asset.id}`" 
              class="asset-card"
              :class="{ selected: selectedAssetKeys.includes(`${asset.type}-${asset.id}`) }"
              @click="toggleSelectAsset(`${asset.type}-${asset.id}`)"
            >
              <!-- Card Select Checkbox overlay -->
              <input 
                type="checkbox" 
                :checked="selectedAssetKeys.includes(`${asset.type}-${asset.id}`)"
                class="card-select-checkbox"
                :class="{ 
                  visible: selectedAssetKeys.length > 0 || selectedAssetKeys.includes(`${asset.type}-${asset.id}`)
                }"
                @click.stop="toggleSelectAsset(`${asset.type}-${asset.id}`)"
              />

              <img 
                v-if="asset.type === 'image'" 
                :src="mediaUrl(asset.url)" 
                alt="asset image" 
                class="history-card-image" 
                @click.stop="selectedAssetKeys.length > 0 ? toggleSelectAsset(`${asset.type}-${asset.id}`) : openAssetDetail(asset)" 
              />
              <div 
                v-else-if="asset.type === 'audio'" 
                class="asset-audio-box" 
                @click.stop="selectedAssetKeys.length > 0 ? toggleSelectAsset(`${asset.type}-${asset.id}`) : null"
              >
                <Volume2 :size="30" />
                <audio :src="mediaUrl(asset.url)" controls class="audio-preview" @click.stop />
              </div>
              <div 
                v-else-if="asset.type === 'document'" 
                class="asset-document-box" 
                @click.stop="selectedAssetKeys.length > 0 ? toggleSelectAsset(`${asset.type}-${asset.id}`) : openAssetDetail(asset)"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 160px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); position: relative; cursor: pointer;"
              >
                <FileText :size="40" style="color: #60a5fa; margin-bottom: 8px;" />
                <span style="font-size: 10px; font-weight: bold; background: rgba(96, 165, 250, 0.15); color: #93c5fd; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">{{ asset.title.split('.').pop() }}</span>
              </div>
              
              <div 
                class="history-card-meta" 
                @click.stop="selectedAssetKeys.length > 0 ? toggleSelectAsset(`${asset.type}-${asset.id}`) : null"
              >
                <strong>{{ asset.title }}</strong>
                <span>{{ asset.subtitle }}</span>
                <div class="page-controls" @click.stop>
                  <button class="log-action" @click="openAssetDetail(asset)">{{ $t("assets.detail") }}</button>
                  <button class="log-action" @click="favoriteAsset(asset)">{{ $t("assets.favorite") }}</button>
                  <button class="log-action" @click="downloadAsset(asset)">{{ $t("assets.download") }}</button>
                  <button class="log-action danger" @click="deleteAsset(asset)">{{ $t("assets.delete") }}</button>
                </div>
              </div>
            </article>
          </div>
          <div v-if="!filteredAssetItems.length" class="empty-module">{{ $t("assets.empty") }}</div>
        </div>
      </section>

      <section v-else-if="activeView === 'favorites'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("nav.favorites") }}</h2>
            <p>{{ $t("favorites.desc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" @click="exportJson('favorites')">{{ $t("favorites.export") }}</button>
          </div>
        </div>
        <div class="module-body favorite-list">
          <article v-for="item in favorites" :key="item.id" class="favorite-card">
            <div class="prompt-card-head">
              <strong>{{ item.title }}</strong>
              <span>{{ item.type }}</span>
            </div>
            <p>{{ item.subtitle }}</p>
            <p v-if="item.content">{{ item.content }}</p>
            <img v-if="item.type === 'image' && item.url" :src="mediaUrl(item.url)" alt="favorite image" class="favorite-image" />
            <audio v-if="item.type === 'audio' && item.url" :src="mediaUrl(item.url)" controls class="audio-preview" />
            <button class="log-action danger" @click="removeFavorite(item.id)">{{ $t("favorites.remove") }}</button>
          </article>
          <div v-if="!favorites.length" class="empty-module">{{ $t("favorites.empty") }}</div>
        </div>
      </section>

      <section v-else-if="activeView === 'diagnostics'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("nav.diagnostics") }}</h2>
            <p>{{ $t("diagnostics.desc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" @click="openDiagnostics">{{ $t("diagnostics.reDiagnose") }}</button>
            <button class="log-action" @click="openLogs">{{ $t("diagnostics.viewLogs") }}</button>
          </div>
        </div>
        <div class="module-body status-layout">
          <article v-for="card in diagnosticCards" :key="card.name" class="status-card">
            <span>{{ card.name }}</span>
            <strong>{{ card.value }}</strong>
            <p>{{ card.detail }}</p>
          </article>
        </div>
      </section>

      <section v-else-if="activeView === 'exports'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("nav.exports") }}</h2>
            <p>{{ $t("exports.desc") }}</p>
          </div>
        </div>
        <div class="module-body export-grid">
          <button class="export-card" @click="exportJson('all')"><strong>{{ $t("exports.completeJson") }}</strong><span>{{ $t("exports.completeJsonDesc") }}</span></button>
          <button class="export-card" @click="exportMarkdown"><strong>{{ $t("exports.markdown") }}</strong><span>{{ $t("exports.markdownDesc") }}</span></button>
          <button class="export-card" @click="exportJson('chat')"><strong>{{ $t("exports.chatJson") }}</strong><span>{{ $t("exports.chatJsonDesc") }}</span></button>
          <button class="export-card" @click="exportJson('media')"><strong>{{ $t("exports.mediaJson") }}</strong><span>{{ $t("exports.mediaJsonDesc") }}</span></button>
          <button class="export-card" @click="exportJson('logs')"><strong>{{ $t("exports.logsJson") }}</strong><span>{{ $t("exports.logsJsonDesc") }}</span></button>
          <button class="export-card" @click="exportJson('prompts')"><strong>{{ $t("exports.promptsJson") }}</strong><span>{{ $t("exports.promptsJsonDesc") }}</span></button>
        </div>
      </section>

      <section v-else-if="activeView === 'imageHistory'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("history.minimaxImageTitle") }}</h2>
            <p>{{ $t("history.minimaxImageDesc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" @click="loadHistories">{{ $t("logs.refresh") }}</button>
            <button class="log-action danger" @click="clearImageHistory">{{ $t("history.clearImage") }}</button>
          </div>
        </div>
        <div class="module-body history-page-grid">
          <article v-for="item in imageHistories" :key="String(item.id)" class="history-card">
            <img :src="mediaUrl(String(item.url || ''))" alt="history image" class="history-card-image" />
            <div class="history-card-meta">
              <strong>{{ item.prompt || $t('history.emptyImagePrompt') }}</strong>
              <span>{{ item.createdAt }}</span>
              <div class="page-controls">
                <button class="item-action-btn" @click="favoriteAsset({ id: String(item.id), type: 'image', title: String(item.prompt || $t('history.defaultImagePrompt')), subtitle: String(item.createdAt || ''), url: String(item.url || '') })">{{ $t("assets.favorite") }}</button>
                <button class="item-action-btn" @click="downloadAsset({ id: String(item.id), type: 'image', title: String(item.prompt || $t('history.defaultImagePrompt')), subtitle: String(item.createdAt || ''), url: String(item.url || '') })">{{ $t("assets.download") }}</button>
                <button class="item-action-btn" @click="deleteImageHistory(String(item.id))">{{ $t("chat.delete") }}</button>
              </div>
            </div>
          </article>
          <div v-if="!imageHistories.length" class="empty-module">{{ $t("history.emptyImage") }}</div>
        </div>
      </section>

      <section v-else-if="activeView === 'ttsHistory'" class="module-page">
        <div class="module-header">
          <div>
            <h2>{{ $t("history.minimaxTtsTitle") }}</h2>
            <p>{{ $t("history.minimaxTtsDesc") }}</p>
          </div>
          <div class="page-controls">
            <button class="log-action" @click="loadHistories">{{ $t("logs.refresh") }}</button>
            <button class="log-action danger" @click="clearTtsHistory">{{ $t("history.clearTts") }}</button>
          </div>
        </div>
        <div class="module-body voice-history-list">
          <article v-for="item in ttsHistories" :key="String(item.id)" class="voice-history-card">
            <div class="history-card-meta">
              <strong>{{ item.text || $t('history.emptyTtsText') }}</strong>
              <span>{{ item.voiceId }} · {{ item.format }} · {{ item.preview ? "preview" : "tts" }}</span>
            </div>
            <audio :src="mediaUrl(String(item.audioUrl || ''))" controls class="audio-preview" />
            <button class="item-action-btn" @click="favoriteAsset({ id: String(item.id), type: 'audio', title: String(item.text || $t('history.defaultTtsText')), subtitle: `${item.voiceId || 'voice'} · ${item.format || 'audio'} · ${item.preview ? 'preview' : 'tts'}`, url: String(item.audioUrl || '') })">{{ $t("assets.favorite") }}</button>
            <button class="item-action-btn" @click="downloadAsset({ id: String(item.id), type: 'audio', title: String(item.text || $t('history.defaultTtsText')), subtitle: `${item.voiceId || 'voice'} · ${item.format || 'audio'} · ${item.preview ? 'preview' : 'tts'}`, url: String(item.audioUrl || '') })">{{ $t("assets.download") }}</button>
            <button class="item-action-btn" @click="deleteTtsHistory(String(item.id))">{{ $t("chat.delete") }}</button>
          </article>
          <div v-if="!ttsHistories.length" class="empty-module">{{ $t("history.emptyTts") }}</div>
        </div>
      </section>

      <section v-else class="workbench-body">
        <div class="chat-column">
          <div class="workspace-toolbar">
            <div class="toolbar-title">
              <Terminal :size="15" />
              <strong>{{ activeMeta.label }}</strong>
              <em>{{ chatSessions.find(session => session.id === activeSessionIds[activeProvider])?.title || activeMeta.subtitle }}</em>
            </div>
            <div class="toolbar-actions">
              <div v-if="activeProvider === 'gemini'" class="gemini-mode-toggle" :aria-label="$t('chat.geminiModeLabel')">
                <button :class="{ active: geminiMode === 'auto' }" @click="geminiMode = 'auto'">{{ $t("chat.geminiModeAuto") }}</button>
                <button :class="{ active: geminiMode === 'text' }" @click="geminiMode = 'text'">{{ $t("chat.geminiModeText") }}</button>
                <button :class="{ active: geminiMode === 'code' }" @click="geminiMode = 'code'">代码</button>
                <button :class="{ active: geminiMode === 'image' }" @click="geminiMode = 'image'">
                  {{ isGeminiImageAvailable ? $t("chat.geminiModeImage") : '图片提示词' }}
                </button>
              </div>
              <!-- Custom Popover Model Selector -->
              <div v-if="activeProvider === 'gemini'" class="custom-dropdown-container" style="position: relative; display: inline-block;">
                <button class="custom-model-trigger" @click.stop="showModelDropdown = !showModelDropdown" title="选择运行模型">
                  <Cpu :size="13" style="color: #c084fc; margin-right: 6px;" />
                  <span class="trigger-text">{{ selectedGeminiModel === 'auto' ? '智能自动路由' : formatModelInfo(selectedGeminiModel).displayName }}</span>
                  <ChevronDown :size="12" style="margin-left: 6px; opacity: 0.7;" />
                </button>

                <div v-if="showModelDropdown" class="custom-model-dropdown" @click.stop>
                  <div class="dropdown-header">运行模型</div>
                  
                  <!-- Auto Route Option -->
                  <div class="custom-model-item" :class="{ active: selectedGeminiModel === 'auto' }" @click="selectModel('auto')">
                    <div class="model-item-main">
                      <strong class="model-name">智能自动路由</strong>
                      <span class="model-badge badge-auto">Auto</span>
                    </div>
                    <div class="model-desc">根据日常提问、代码、生图自动智能分配</div>
                  </div>
                  
                  <div class="dropdown-divider" v-if="availableGeminiModels.length"></div>

                  <!-- Available Probed Models -->
                  <div v-for="model in availableGeminiModels" :key="model.id" class="custom-model-item" :class="{ active: selectedGeminiModel === model.id }" @click="selectModel(model.id)">
                    <div class="model-item-main">
                      <strong class="model-name">{{ formatModelInfo(model.id).displayName }}</strong>
                      <span class="model-badge" :class="formatModelInfo(model.id).badgeClass">{{ formatModelInfo(model.id).badgeText }}</span>
                    </div>
                    <div class="model-desc">{{ formatModelInfo(model.id).description }}</div>
                  </div>
                  
                  <div v-if="!availableGeminiModels.length" class="empty-dropdown-models">
                    暂无检测可用模型，请重测
                  </div>
                </div>
              </div>
              <button v-if="activeProvider === 'gemini'" class="icon-btn" title="检测可用模型" :disabled="geminiProbeLoading" @click="handleGeminiProbe(false)" style="height: 32px; width: 32px; display: flex; align-items: center; justify-content: center; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer; transition: all 0.2s;">
                <RefreshCw :size="13" :class="{ 'animate-spin': geminiProbeLoading }" />
              </button>
              <select class="session-picker" :value="activeSessionIds[activeProvider]" @change="openSession(chatSessions.find(session => session.id === ($event.target as HTMLSelectElement).value)!)">
                <option v-for="session in providerSessions" :key="session.id" :value="session.id">{{ session.title }}</option>
              </select>
              <button class="log-action" @click="createSession(activeProvider)">{{ $t("chat.newSession") }}</button>
              <button class="icon-btn" :title="$t('chat.refreshHistory')" @click="loadHistories"><RefreshCw :size="15" /></button>
            </div>
          </div>

          <div class="chat-viewport" ref="chatContainer">
            <div v-if="messages.length === 0" class="empty-state">
              <h2>{{ activeMeta.emptyTitle }}</h2>
              <p>{{ activeMeta.emptyDesc }}</p>
            </div>
            <div v-for="(msg, i) in messages" :key="i" class="message-row" :class="msg.role">
              <div class="message-avatar">{{ msg.role === "user" ? "U" : "AI" }}</div>
              <div class="message-content">
                <button class="message-favorite" :title="$t('chat.favoriteMsg')" @click="favoriteMessage(msg, i)"><Star :size="13" /></button>
                <button class="message-copy" title="复制内容" @click="copyToClipboard(msg.content, i)">
                  <component :is="copiedIndex === i ? Check : Copy" :size="13" />
                </button>
                <div class="message-text-wrapper">
                  <template v-for="(block, idx) in parseMessageContent(msg.content)" :key="idx">
                    <div v-if="block.type === 'think'" class="think-container">
                      <div class="think-header" @click="toggleThink(activeProvider + '-' + activeSessionIds[activeProvider] + '-' + i)">
                        <Cpu :size="14" class="think-icon" />
                        <span class="think-title">{{ $t("chat.thinkTitle") }}</span>
                        <component 
                          :is="expandedThinks[activeProvider + '-' + activeSessionIds[activeProvider] + '-' + i] ? ChevronUp : ChevronDown" 
                          :size="14" 
                          class="think-chevron" 
                        />
                      </div>
                      <div v-if="expandedThinks[activeProvider + '-' + activeSessionIds[activeProvider] + '-' + i]" class="think-body">
                        {{ block.content.trim() }}
                      </div>
                    </div>
                    <div v-else class="text-body" v-html="renderMarkdown(block.content)"></div>
                  </template>
                </div>
                <img v-for="(m, j) in (msg.media || []).filter(x => x.type === 'image')" :key="`img-${j}`" :src="mediaUrl(m.url)" class="media-preview image-preview" alt="generated image" />
                <audio v-for="(m, j) in (msg.media || []).filter(x => x.type === 'audio')" :key="`audio-${j}`" :src="mediaUrl(m.url)" class="media-preview audio-preview" controls />
              </div>
            </div>
            <div v-if="isThinking" class="message-row assistant"><div class="message-avatar">AI</div><div class="thinking-dots"><span>.</span><span>.</span><span>.</span></div></div>
          </div>

          <!-- Horizontal Splitter Resizer -->
          <div 
            class="horizontal-resizer chat-resizer glass-resizer" 
            @mousedown.prevent="startResize('chatInput', $event)"
            @dblclick="chatInputHeight = null; persistLayout();"
            title="拖动调整高度，双击恢复默认"
          ></div>

          <div class="input-container" :style="chatInputHeight ? { height: `${chatInputHeight}px` } : {}">
            <!-- Hidden file input -->
            <input type="file" ref="fileInput" @change="handleFileUpload" accept="image/*,audio/*,.pdf,.txt,.md" style="display:none" />

            <div class="chat-input-row">
              <!-- Left: RAG Knowledge Base Document Selector -->
              <div v-if="activeProvider === 'gemini' && documents.length > 0" class="rag-document-selector-sidebar">
                <div class="rag-sidebar-header">
                  <div class="rag-title-container">
                    <BookOpen :size="12" style="color: #60a5fa;" />
                    <span>知识库关联 (RAG)</span>
                  </div>
                  <div class="rag-actions-container">
                    <span class="rag-action-link select-all" @click="selectedDocIds = documents.map(d => d.id)">全选</span>
                    <span class="rag-action-link clear-all" @click="selectedDocIds = []">清除</span>
                  </div>
                </div>
                <div class="rag-sidebar-list">
                  <label 
                    v-for="doc in documents" 
                    :key="doc.id" 
                    class="rag-doc-sidebar-tag"
                    :class="{ active: selectedDocIds.includes(doc.id) }"
                  >
                    <input 
                      type="checkbox" 
                      :value="doc.id" 
                      v-model="selectedDocIds" 
                      style="display: none;" 
                    />
                    <FileText :size="11" />
                    <span class="rag-doc-name" :title="doc.name">{{ doc.name }}</span>
                  </label>
                </div>
              </div>

              <!-- Right: Main Input Column -->
              <div class="chat-input-main">
                <!-- Attachment preview list -->
                <div v-if="uploadedFiles.length > 0" class="attachment-preview-list" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; padding: 4px;">
                  <div v-for="(file, idx) in uploadedFiles" :key="idx" class="attachment-preview-card" style="position: relative; display: flex; align-items: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 8px; font-size: 11px;">
                    <img v-if="file.type === 'image'" :src="mediaUrl(file.url)" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; margin-right: 8px;" />
                    <Volume2 v-else :size="16" style="margin-right: 8px; color: var(--text-muted);" />
                    <span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-color);">{{ file.name }}</span>
                    <button @click="removeUploadedFile(idx)" style="background: none; border: none; padding: 0 0 0 8px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center;" title="移除">
                      <X :size="12" style="color: #f87171;" />
                    </button>
                  </div>
                </div>

                <!-- Input bar -->
                <div class="input-wrapper">
                  <!-- Upload button -->
                  <button v-if="activeProvider === 'gemini'" class="upload-attachment-btn" @click="triggerFileUpload" :disabled="isUploading || isThinking" style="background: none; border: none; padding: 8px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s;" title="上传图片或音频">
                    <ImageIcon v-if="isUploading" class="animate-spin" :size="18" />
                    <FolderOpen v-else :size="18" />
                  </button>
                  
                  <textarea 
                    ref="textareaRef"
                    v-model="inputText" 
                    :placeholder="$t('chat.placeholder')" 
                    @keydown.enter.prevent="handleSend"
                    :class="{ 'resizable-active': chatInputHeight !== null }"
                  />
                  <button v-if="isThinking" class="stop-btn" @click="handleStop" :title="$t('chat.stopGeneration')"><Square :size="16" /></button>
                  <button v-else class="send-btn" @click="handleSend" :disabled="!inputText.trim() && uploadedFiles.length === 0"><Send :size="18" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FloatingMainPanel>
    <div v-if="selectedAsset" class="asset-modal-backdrop" @click.self="closeAssetDetail">
      <section class="asset-modal">
        <div class="asset-modal-head">
          <div>
            <strong>{{ selectedAsset.title }}</strong>
            <span>{{ selectedAsset.subtitle }}</span>
          </div>
          <button class="icon-btn" @click="closeAssetDetail"><X :size="15" /></button>
        </div>
        <div class="asset-modal-body">
          <img v-if="selectedAsset.type === 'image'" :src="mediaUrl(selectedAsset.url)" alt="asset detail" />
          <audio v-else-if="selectedAsset.type === 'audio'" :src="mediaUrl(selectedAsset.url)" controls class="audio-preview" />
          <div v-else-if="selectedAsset.type === 'document'" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <FileText :size="60" style="color: #60a5fa; margin-bottom: 16px;" />
            <span style="font-size: 14px; font-weight: 500; color: var(--text-color); margin-bottom: 8px; text-align: center;">{{ selectedAsset.title }}</span>
            <span style="font-size: 12px; color: var(--text-muted);">{{ selectedAsset.subtitle }}</span>
          </div>
        </div>
        <div class="asset-modal-actions">
          <button class="log-action" @click="favoriteAsset(selectedAsset)">{{ $t("assets.favorite") }}</button>
          <a class="log-action asset-link" :href="mediaUrl(selectedAsset.url)" target="_blank">{{ $t("assets.openOriginal") }}</a>
        </div>
      </section>
    </div>
  </div>
</template>

<style>
.animate-spin {
  animation: spin-kf 1s linear infinite;
  display: inline-block;
}
@keyframes spin-kf {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── Layout & Resizers ────────────────────────── */
.app-container {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1px minmax(0, 1fr);
  height: 100%;
  overflow: hidden;
}

.vertical-resizer {
  width: 1px;
  background: var(--border);
  cursor: col-resize;
  user-select: none;
  transition: background 0.25s ease;
  z-index: 10;
}

.vertical-resizer:hover,
.vertical-resizer:active {
  background: var(--accent);
}

/* ── Home Page ────────────────────────────────── */
.home-page {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(420px, 68%) minmax(132px, 1fr);
  overflow: hidden;
  position: relative;
}

.home-hero {
  position: relative;
  min-height: 0;
  display: flex;
  align-items: center;
  padding: 42px clamp(32px, 8vw, 96px);
  background:
    radial-gradient(circle at 80% 20%, rgba(91, 124, 255, 0.15), transparent 45%),
    radial-gradient(circle at 15% 80%, rgba(244, 63, 94, 0.12), transparent 50%),
    linear-gradient(180deg, rgba(8, 9, 14, 0.4) 0%, rgba(8, 9, 14, 0.95) 100%),
    url("https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1800&q=85") center / cover no-repeat;
  border-bottom: 1px solid var(--border);
}

.home-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--bg-base) 12%, transparent 85%);
  pointer-events: none;
  z-index: 1;
}

.home-copy {
  position: relative;
  z-index: 2;
  width: min(720px, 100%);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.home-copy span {
  color: var(--accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 3px;
  text-transform: uppercase;
  text-shadow: 0 0 12px var(--accent-soft);
}

.home-copy h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(32px, 4vw, 56px);
  line-height: 1.15;
  font-weight: 900;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.home-copy p {
  margin: 0;
  max-width: 580px;
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1.7;
}

.home-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.home-overview {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 12px;
  padding: 16px 28px;
  background: var(--bg-base);
  border-top: 1px solid var(--border);
}

.home-tile {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(17, 20, 32, 0.45);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  text-align: left;
  cursor: pointer;
  min-width: 0;
  backdrop-filter: blur(10px);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.home-tile:hover {
  background: rgba(91, 124, 255, 0.06);
  border-color: rgba(91, 124, 255, 0.35);
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05);
}

.home-tile svg {
  color: var(--accent);
  margin-bottom: 2px;
  transition: transform 0.3s;
}

.home-tile:hover svg {
  transform: scale(1.1) rotate(5deg);
}

.home-tile strong {
  font-size: 15px;
  font-weight: 700;
}

.home-tile span {
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.4;
}

.home-notices {
  position: absolute;
  right: 28px;
  top: 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(340px, 30vw);
  z-index: 10;
}

.home-notice {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(12, 13, 20, 0.85);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-in {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.home-notice strong {
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 700;
}

.home-notice span {
  color: var(--text-muted);
  font-size: 11.5px;
  line-height: 1.45;
}

.notice-success { border-left: 3px solid var(--success); }
.notice-error { border-left: 3px solid var(--error); }
.notice-warning { border-left: 3px solid var(--warning); }
.notice-info { border-left: 3px solid var(--accent); }

/* ── Settings View ────────────────────────────── */
.settings-view {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 32px;
}

.settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.settings-header h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 800;
}

.settings-header p {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(320px, 1fr));
  gap: 20px;
  max-width: 1000px;
}

.settings-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.settings-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  opacity: 0.7;
}

.minimax-card::before {
  background: linear-gradient(90deg, #f43f5e, transparent);
}

.deepseek-card::before {
  background: linear-gradient(90deg, #3b82f6, transparent);
}

.settings-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.settings-card-head strong {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.settings-card-head span {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  background: rgba(255, 255, 255, 0.04);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.settings-card label {
  color: var(--text-muted);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.settings-card input,
.settings-card select {
  height: 36px;
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 0 12px;
  min-width: 0;
  transition: all 0.2s;
}

.settings-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.save-settings-btn {
  height: 36px;
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--text-primary);
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  transition: all 0.2s;
}

.save-settings-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 4px 12px var(--accent-soft);
}

.save-settings-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-hint {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
}

/* ── Chat / Workbench Layout ──────────────────── */
.workbench-body {
  height: 100%;
  min-height: 0;
  display: block;
}

.chat-column {
  min-width: 0;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 52px minmax(0, 1fr) 1px auto;
}

.workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--border);
  background: rgba(12, 13, 20, 0.7);
  backdrop-filter: blur(10px);
  z-index: 5;
}

.toolbar-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.toolbar-title em {
  color: var(--text-muted);
  font-style: normal;
  font-size: 11.5px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  margin-left: 4px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-picker {
  height: 32px;
  min-width: 140px;
  max-width: 220px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 0 28px 0 10px;
  font-size: 12.5px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7592' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.session-picker:hover {
  border-color: var(--accent);
}

.chat-viewport {
  min-height: 0;
  overflow-y: auto;
  padding: 28px clamp(24px, 8vw, 120px);
  display: flex;
  flex-direction: column;
  gap: 22px;
  scrollbar-gutter: stable;
  background: radial-gradient(circle at 50% 100%, rgba(91, 124, 255, 0.02), transparent 60%);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px;
  max-width: 520px;
  margin: auto;
  animation: fade-in 0.5s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.empty-state h2 {
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #ffffff 40%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.empty-state p {
  color: var(--text-muted);
  font-size: 13.5px;
  line-height: 1.6;
}

/* ── Chat Messages ────────────────────────────── */
.message-row {
  display: flex;
  gap: 16px;
  max-width: 880px;
  width: 100%;
  animation: message-appear 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes message-appear {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-row.user {
  align-self: flex-end;
  flex-direction: row-reverse;
  max-width: 780px;
}

.message-avatar {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--text-primary);
}

.user .message-avatar {
  background: var(--accent);
  border-color: var(--accent-border);
  color: #fff;
  box-shadow: 0 4px 12px var(--accent-soft);
}

.assistant .message-avatar {
  background: var(--bg-card);
  border-color: var(--border-hover);
  color: var(--accent);
}

.message-content {
  position: relative;
  line-height: 1.65;
  font-size: 14.5px;
  white-space: pre-wrap;
  background: rgba(17, 20, 32, 0.55);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
  min-width: 0;
  max-width: calc(100% - 50px);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
  backdrop-filter: blur(8px);
}

.message-content:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow);
}

.user .message-content {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  border-top-right-radius: 4px;
  color: var(--text-primary);
}

.assistant .message-content {
  color: var(--text-primary);
  border-top-left-radius: 4px;
}

.assistant .message-content div:first-child {
  word-break: break-word;
}

.message-favorite {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
}

.message-content:hover .message-favorite {
  opacity: 1;
}

.message-favorite:hover {
  color: var(--warning);
  border-color: rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.08);
}

/* ── Previews & Media ─────────────────────────── */
.media-preview {
  margin-top: 12px;
  display: block;
}

.image-preview {
  width: min(480px, 100%);
  max-height: 380px;
  object-fit: contain;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.2);
  box-shadow: var(--shadow-sm);
}

.audio-preview {
  width: min(360px, 100%);
  height: 36px;
  border-radius: 99px;
}

/* ── Thinking Animation ───────────────────────── */
.thinking-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 4px;
}

.thinking-dots span {
  font-size: 24px;
  line-height: 0;
  color: var(--accent);
  animation: dots 1.4s infinite both;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dots {
  0%, 100% { opacity: 0.2; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-4px); }
}

/* ── Prompt Input Bar ─────────────────────────── */
.input-container {
  padding: 16px clamp(24px, 8vw, 120px) 24px;
  border-top: 1px solid var(--border);
  background: linear-gradient(180deg, transparent, rgba(8, 9, 14, 0.95) 40%);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.chat-input-row {
  display: flex;
  gap: 16px;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  align-items: stretch;
  height: 100%;
  box-sizing: border-box;
}

.chat-input-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 8px;
  height: 100%;
  box-sizing: border-box;
}

/* ── RAG Sidebar Document Selector ──────────────── */
.rag-document-selector-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: rgba(17, 20, 32, 0.55);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  padding: 10px;
  box-sizing: border-box;
  max-height: 100%;
  gap: 8px;
}

.rag-sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.rag-title-container {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-primary);
  font-weight: 700;
}

.rag-actions-container {
  display: flex;
  gap: 10px;
  font-size: 10.5px;
  color: var(--text-muted);
}

.rag-action-link {
  cursor: pointer;
  transition: color 0.2s;
  font-size: 10.5px;
}

.rag-action-link.select-all {
  color: #60a5fa;
}

.rag-action-link.select-all:hover {
  color: #93c5fd;
}

.rag-action-link.clear-all:hover {
  color: var(--text-primary);
}

.rag-sidebar-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 2px;
}

.rag-sidebar-list::-webkit-scrollbar {
  width: 4px;
}
.rag-sidebar-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.rag-doc-sidebar-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  transition: all 0.2s ease;
  user-select: none;
  overflow: hidden;
}

.rag-doc-sidebar-tag:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

.rag-doc-sidebar-tag.active {
  background: rgba(96, 165, 250, 0.12);
  border-color: rgba(96, 165, 250, 0.3);
  color: #93c5fd;
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.08);
}

.rag-doc-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* ── Prompt Input Bar ─────────────────────────── */
.input-wrapper {
  background: rgba(17, 20, 32, 0.65);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  padding: 10px 12px 10px 18px;
  align-items: flex-end;
  max-width: 880px;
  margin: 0 auto;
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
  width: 100%;
  flex: 1;
  min-height: 58px;
}

.input-wrapper:focus-within {
  border-color: var(--accent-border);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--accent-border), inset 0 1px 0 rgba(255,255,255,0.05);
  background: rgba(17, 20, 32, 0.85);
}

.input-wrapper textarea {
  flex: 1;
  background: transparent;
  border: none !important;
  box-shadow: none !important;
  color: var(--text-primary);
  resize: none;
  padding: 6px 0;
  margin-right: 12px;
  outline: none;
  font-family: inherit;
  font-size: 14.5px;
  height: 36px;
  min-height: 36px;
  max-height: 400px;
  line-height: 1.5;
  overflow-y: auto;
}

.input-wrapper textarea.resizable-active {
  height: 100%;
  align-self: stretch;
}

/* ── Horizontal Resizer ────────────────────────── */
.horizontal-resizer {
  height: 1px;
  background: var(--border);
  cursor: row-resize;
  user-select: none;
  position: relative;
  z-index: 10;
  transition: background 0.25s ease;
}

.horizontal-resizer::after {
  content: "";
  position: absolute;
  top: -4px;
  bottom: -4px;
  left: 0;
  right: 0;
  cursor: row-resize;
}

.horizontal-resizer:hover,
.horizontal-resizer:active {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.send-btn {
  background: var(--accent);
  border: none;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 10px var(--accent-soft);
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05) translateY(-1px);
  filter: brightness(1.1);
}

.send-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

/* ── Logs View ────────────────────────────────── */
.log-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.log-level-select,
.log-search {
  height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 0 10px;
  font-size: 12px;
  outline: none;
  transition: all 0.2s;
}

.log-level-select {
  width: 106px;
}

.log-search {
  width: min(280px, 34vw);
  min-width: 140px;
}

.log-level-select:focus,
.log-search:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.log-body {
  min-height: 0;
  overflow-y: auto;
  padding: 10px 4px;
  font-family: var(--font-mono);
}

.structured-log-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.structured-log {
  display: grid;
  grid-template-columns: 80px 64px 130px minmax(160px, 240px) minmax(220px, 1fr);
  gap: 10px;
  align-items: start;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.015);
  font-size: 11.5px;
  line-height: 1.5;
  transition: all 0.15s;
}

.structured-log:hover {
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.035);
}

.log-time,
.log-thread,
.log-logger {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-level {
  font-weight: 700;
  letter-spacing: 0.5px;
  font-size: 10.5px;
}

.log-message {
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.structured-log.level-error {
  background: rgba(248, 113, 113, 0.08);
  border-left: 3px solid var(--error);
}

.structured-log.level-error .log-level,
.structured-log.level-error .log-message {
  color: #fca5a5;
}

.structured-log.level-warn {
  background: rgba(251, 191, 36, 0.06);
  border-left: 3px solid var(--warning);
}

.structured-log.level-warn .log-level,
.structured-log.level-warn .log-message {
  color: #fde047;
}

.structured-log.level-debug {
  opacity: 0.65;
}

.structured-log.level-debug .log-level {
  color: #94a3b8;
}

.structured-log.level-debug .log-message {
  color: #cbd5e1;
}

.log-line {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 3px 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

.log-empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 24px 8px;
  text-align: center;
}

/* ── Speech Synthesis ─────────────────────────── */
.speech-layout {
  display: grid;
  grid-template-columns: minmax(360px, 640px) minmax(280px, 1fr);
  gap: 20px;
  align-content: start;
}

.speech-composer,
.speech-result {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 20px;
  min-width: 0;
  box-shadow: var(--shadow-sm);
}

.speech-composer {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.speech-composer label {
  color: var(--text-muted);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.speech-textarea {
  min-height: 120px;
  resize: vertical;
  padding: 12px;
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-sm);
}

.voice-selector-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  margin-bottom: 4px;
}

.voice-selector-title {
  color: var(--text-muted);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.voice-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}

.voice-tab-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.voice-tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

.voice-tab-btn.active {
  background: var(--primary, #9333ea);
  color: #ffffff;
  border-color: var(--primary, #9333ea);
  box-shadow: 0 0 10px rgba(147, 51, 234, 0.4);
}

.voice-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 6px;
}

.voice-cards-grid::-webkit-scrollbar {
  width: 6px;
}
.voice-cards-grid::-webkit-scrollbar-track {
  background: transparent;
}
.voice-cards-grid::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
.voice-cards-grid::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

.voice-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 70px;
}

.voice-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border-hover);
}

.voice-card.active {
  background: rgba(147, 51, 234, 0.08);
  border-color: var(--primary, #9333ea);
  box-shadow: inset 0 0 0 1px var(--primary, #9333ea);
}

.voice-card-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.voice-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.voice-card-id {
  font-size: 10px;
  color: var(--text-muted);
  font-family: monospace;
}

.voice-card-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-top: 1px solid rgba(255, 255, 255, 0.03);
  padding-top: 4px;
}

.speech-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(160px, 1fr));
  gap: 12px;
}

.speech-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.speech-grid select,
.speech-grid input {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-sm);
  min-height: 36px;
  padding: 0 10px;
  min-width: 0;
  transition: border-color 0.25s;
}

.speech-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.speech-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: calc(100vh - 220px);
}

.speech-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}

.speech-result strong {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.speech-result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 6px;
}

.speech-audio-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.speech-audio-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.audio-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.audio-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.audio-tag.preview-tag {
  background: rgba(91, 124, 255, 0.12);
  color: var(--accent);
  border: 1px solid rgba(91, 124, 255, 0.25);
}

.audio-tag.full-tag {
  background: rgba(244, 63, 94, 0.12);
  color: #f43f5e;
  border: 1px solid rgba(244, 63, 94, 0.25);
}

.audio-voice {
  color: var(--text-muted);
  font-weight: 600;
}

.audio-time {
  color: var(--text-faint);
  margin-left: auto;
}

.audio-text {
  font-size: 12.5px;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
  opacity: 0.85;
}

.audio-player {
  width: 100%;
  height: 32px;
  margin-top: 4px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.02);
}

.audio-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 2px;
}

.icon-btn-small {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn-small:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.icon-btn-small.danger:hover {
  border-color: rgba(244, 63, 94, 0.4);
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.1);
}

/* ── Speech Text Presets ── */
.speech-presets {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
  margin-bottom: 2px;
}

.preset-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preset-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.group-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-faint);
  background: rgba(255, 255, 255, 0.02);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
  text-transform: uppercase;
}

.preset-btn {
  height: 24px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-btn:hover {
  border-color: var(--accent-border);
  color: var(--text-primary);
  background: var(--accent-soft);
}

/* ── Sessions View ────────────────────────────── */
.session-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  align-content: start;
}

.session-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 16px;
  transition: all 0.2s ease;
}

.session-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-card-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.session-card strong {
  display: block;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 4px;
}

.session-card span {
  color: var(--text-muted);
  font-size: 11.5px;
}

.session-card p {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.session-card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.session-card-footer small {
  color: var(--text-faint);
  font-size: 11px;
  margin-right: auto;
  font-weight: 600;
}

.minimax-session-card {
  border-left: 3px solid #f43f5e;
}

.deepseek-session-card {
  border-left: 3px solid #3b82f6;
}

/* ── Tasks View ───────────────────────────────── */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-card {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 14px 18px;
  transition: all 0.2s;
}

.task-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-card-hover);
}

.task-status {
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid var(--border);
}

.task-card strong {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.task-card p {
  margin: 4px 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.4;
}

.task-card span {
  color: var(--text-faint);
  font-size: 11px;
  font-family: var(--font-mono);
}

.task-running .task-status {
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.25);
  animation: status-pulse 2s infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; filter: brightness(1.2); }
}

.task-success .task-status {
  color: #a7f3d0;
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.25);
}

.task-failed .task-status {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.25);
}

/* ── Notifications View ───────────────────────── */
.notification-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 14px 18px;
  transition: all 0.2s;
}

.notification-card.unread {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.notification-card strong {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.notification-card p {
  margin: 4px 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.45;
}

.notification-card span {
  color: var(--text-faint);
  font-size: 11px;
  font-family: var(--font-mono);
}

/* ── Prompt Library ───────────────────────────── */
.prompt-layout {
  display: grid;
  grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.prompt-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 18px;
  box-shadow: var(--shadow-sm);
}

.prompt-editor label {
  color: var(--text-muted);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.prompt-editor input,
.prompt-editor select,
.prompt-editor textarea {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-sm);
  min-height: 36px;
  padding: 0 10px;
  min-width: 0;
  transition: border-color 0.2s;
}

.prompt-editor textarea {
  min-height: 140px;
  padding: 10px;
  resize: vertical;
}

.prompt-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.prompt-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 16px;
  transition: all 0.2s;
}

.prompt-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-card-hover);
}

.prompt-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.prompt-card-head strong {
  color: var(--text-primary);
  font-size: 14.5px;
  font-weight: 700;
}

.prompt-card-head span {
  color: var(--accent);
  border: 1px solid var(--accent-border);
  background: var(--accent-soft);
  border-radius: 99px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
}

.prompt-card p {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── API Status & Diagnostics ─────────────────── */
.status-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  align-content: start;
}

.status-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--shadow-sm);
}

.status-card strong {
  display: block;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 2px;
}

.status-card span {
  color: var(--text-muted);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 700;
}

.status-card p {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.45;
  margin: 0;
  word-break: break-word;
}

.wide-status {
  grid-column: 1 / -1;
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
  margin-top: 6px;
}

.usage-grid div {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px;
  background: var(--bg-input);
  text-align: center;
}

.usage-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
  margin-bottom: 4px;
  font-weight: 700;
  text-transform: uppercase;
}

.usage-grid strong {
  display: block;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 800;
}

.open-usage-btn {
  width: 100%;
  height: 34px;
  border: 1px solid var(--accent-border);
  background: var(--accent-soft);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.open-usage-btn:hover {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 4px 10px var(--accent-soft);
}

/* ── Asset & History grids ────────────────────── */
.history-page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-content: start;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
  align-content: start;
}

.history-card,
.asset-card {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.history-card-image {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  background: #050505;
  border-bottom: 1px solid var(--border);
  transition: transform 0.3s;
}

.history-card:hover .history-card-image,
.asset-card:hover .history-card-image {
  transform: scale(1.02);
}

.asset-audio-box {
  min-height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px;
  color: var(--accent);
  background: var(--accent-soft);
  border-bottom: 1px solid var(--border);
}

.asset-link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.history-card-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  flex: 1;
}

.history-card-meta strong {
  color: var(--text-primary);
  font-size: 13.5px;
  line-height: 1.4;
  word-break: break-word;
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.history-card-meta span {
  color: var(--text-muted);
  font-size: 11px;
  word-break: break-word;
}

.voice-history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.voice-history-card {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(260px, 480px) auto auto auto;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 12px 18px;
  transition: all 0.2s;
}

.voice-history-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-card-hover);
}

.item-action-btn {
  height: 26px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s;
}

.item-action-btn:hover {
  border-color: var(--accent-border);
  color: var(--text-primary);
  background: var(--accent-soft);
}

.voice-history-card .item-action-btn {
  margin-top: 0;
}

/* ── Favorites ────────────────────────────────── */
.favorite-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  align-content: start;
}

.favorite-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 16px;
  min-width: 0;
  transition: all 0.2s;
}

.favorite-card:hover {
  border-color: var(--border-hover);
  background: var(--bg-card-hover);
}

.favorite-card p {
  margin: 0;
  color: var(--text-primary);
  font-size: 13.5px;
  line-height: 1.5;
  word-break: break-word;
}

.favorite-image {
  width: 100%;
  max-height: 220px;
  object-fit: contain;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.2);
}

/* ── Export Cards ─────────────────────────────── */
.export-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 16px;
  align-content: start;
}

.export-card {
  min-height: 120px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text-primary);
  text-align: left;
  padding: 18px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.export-card:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.export-card strong {
  font-size: 16px;
  font-weight: 700;
}

.export-card span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

/* ── Modals & Popups ──────────────────────────── */
.asset-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(5, 5, 8, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  backdrop-filter: blur(8px);
  animation: fade-backdrop 0.25s ease-out;
}

@keyframes fade-backdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}

.asset-modal {
  width: min(840px, 92vw);
  max-height: 88vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: modal-scale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-scale {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.asset-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.01);
}

.asset-modal-head div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.asset-modal-head strong {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.asset-modal-head span {
  color: var(--text-muted);
  font-size: 11.5px;
}

.asset-modal-body {
  min-height: 0;
  overflow: auto;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.25);
}

.asset-modal-body img {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.asset-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.01);
}

/* ── Miscellaneous ────────────────────────────── */
.empty-module {
  color: var(--text-muted);
  font-size: 13.5px;
  padding: 32px 12px;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  grid-column: 1 / -1;
  background: rgba(255, 255, 255, 0.01);
}

/* ── Responsive breakpoints ───────────────────── */
@media (max-width: 1200px) {
  .chat-viewport, .input-container { padding-left: 16px; padding-right: 16px; }
  .speech-layout, .prompt-layout { grid-template-columns: 1fr; }
  .speech-grid { grid-template-columns: 1fr 1fr; }
  .voice-history-card { grid-template-columns: 1fr; gap: 12px; }
  .home-overview { grid-template-columns: repeat(2, minmax(160px, 1fr)); }
  .preview-btn { min-width: 86px; }
  .settings-grid { grid-template-columns: 1fr; }
}

/* ── Thinking Trace Block ──────────────────────── */
.think-container {
  margin-top: 4px;
  margin-bottom: 12px;
  border-left: 2px solid var(--accent);
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.think-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: var(--text-muted);
  transition: background 0.2s, color 0.2s;
}

.think-header:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

.think-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.think-title {
  font-weight: 600;
  flex-grow: 1;
}

.think-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.2s;
}

.think-body {
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
  font-style: italic;
  white-space: pre-wrap;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
}

.text-body {
  word-break: break-word;
  line-height: 1.65;
  font-size: 14px;
  color: var(--text-primary);
  white-space: normal;
}

.text-body p {
  margin: 0 0 6px 0;
}

.text-body p:last-child {
  margin-bottom: 0;
}

.text-body h1,
.text-body h2,
.text-body h3,
.text-body h4 {
  color: var(--text-primary);
  font-weight: 700;
  margin-top: 12px;
  margin-bottom: 6px;
}

.text-body h1 { font-size: 1.5em; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 6px; }
.text-body h2 { font-size: 1.35em; border-bottom: 1px solid rgba(255, 255, 255, 0.04); padding-bottom: 4px; }
.text-body h3 { font-size: 1.2em; }
.text-body h4 { font-size: 1.1em; }

.text-body code {
  font-family: var(--font-mono);
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  color: #c084fc;
}

.text-body a {
  color: #c084fc;
  text-decoration: none;
  border-bottom: 1px dashed rgba(192, 132, 252, 0.4);
  transition: all 0.2s;
}

.text-body a:hover {
  color: #a855f7;
  border-bottom-color: #a855f7;
}

.text-body hr {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 12px 0;
}

.text-body ul,
.text-body ol {
  margin: 4px 0 6px 20px;
  padding-left: 0;
}

.text-body li {
  margin-bottom: 3px;
  list-style-position: outside;
}

.text-body ul > li {
  list-style-type: disc;
}

.text-body ol > li {
  list-style-type: decimal;
}

/* ── Code Block Wrapper ──────────────────────── */
.code-block-wrapper {
  margin: 8px 0;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1a1b26; /* Tokyo Night Dark main bg */
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.code-lang {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.code-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: 0;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.code-copy-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.code-copy-btn.copied {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.code-block-wrapper pre {
  margin: 0;
  padding: 14px;
  overflow-x: auto;
}

.code-block-wrapper pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 13.5px;
  color: inherit;
  font-family: var(--font-mono);
}

.module-page.assets-page {
  display: flex;
  flex-direction: column;
}

.assets-page .module-body {
  flex: 1;
}

.assets-tabs-container {
  margin: 0;
  padding: 16px 28px 0 28px;
}

.assets-tabs-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
}

.assets-tabs {
  display: flex;
  gap: 10px;
}

.assets-tab-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
}

.assets-tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.assets-tab-btn.active {
  background: var(--primary, #9333ea);
  border-color: var(--primary, #9333ea);
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(147, 51, 234, 0.08);
}

.assets-batch-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.batch-checkbox-input {
  margin: 0;
  accent-color: var(--primary, #9333ea);
  cursor: pointer;
}

.batch-selected-count {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-right: 6px;
}

/* Card select checkbox overlay styling */
.asset-card {
  position: relative;
  cursor: pointer;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.asset-card.selected {
  border-color: var(--primary, #9333ea);
  box-shadow: 0 0 0 2px rgba(147, 51, 234, 0.25);
}

.card-select-checkbox {
  appearance: none;
  -webkit-appearance: none;
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 5;
  width: 22px;
  height: 22px;
  border: 1.5px solid rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  opacity: 0;
  transition: all 0.2s ease;
}

.asset-card:hover .card-select-checkbox,
.card-select-checkbox.visible {
  opacity: 1;
}

.card-select-checkbox:checked {
  background: var(--primary, #9333ea);
  border-color: var(--primary, #9333ea);
  opacity: 1;
}

.card-select-checkbox:checked::after {
  content: '✓';
  color: #ffffff;
  font-size: 13px;
  font-weight: bold;
}

/* --- Chat Stop Generation & Copy Message Enhancements --- */
.stop-btn {
  background: var(--error, #ef4444);
  border: none;
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);
}

.stop-btn:hover {
  transform: scale(1.05) translateY(-1px);
  filter: brightness(1.1);
}

.stop-btn:active {
  transform: scale(0.98);
}

.message-copy {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
  z-index: 10;
}

.message-content:hover .message-copy {
  opacity: 1;
}

.message-copy:hover {
  color: var(--accent);
  border-color: var(--accent-border);
  background: var(--accent-soft);
}

/* ── Data Source Switcher Toggle Pills ────────── */
.provider-toggle {
  display: inline-flex;
  background: var(--bg-input, rgba(255, 255, 255, 0.02));
  border: 1px solid var(--border);
  padding: 4px;
  border-radius: var(--radius-sm, 6px);
  gap: 4px;
  margin: 12px 0;
  box-shadow: var(--shadow-sm);
  transition: all 0.25s ease;
}

.provider-toggle:hover {
  border-color: var(--border-hover);
}

.toggle-pill {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  padding: 6px 14px;
  border-radius: calc(var(--radius-sm, 6px) - 2px);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.toggle-pill:hover:not(:disabled) {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.04);
}

.toggle-pill.active {
  background: var(--accent, #5b7cff);
  border-color: var(--accent-border, rgba(91, 124, 255, 0.3));
  color: #ffffff;
  box-shadow: 0 2px 8px var(--accent-soft, rgba(91, 124, 255, 0.15));
}

.toggle-pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gemini-mode-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border: 1px solid rgba(168, 85, 247, 0.28);
  border-radius: var(--radius-sm);
  background: rgba(168, 85, 247, 0.08);
}

.gemini-mode-toggle button {
  border: 0;
  border-radius: 5px;
  padding: 6px 10px;
  min-width: 44px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.gemini-mode-toggle button.active {
  background: rgba(168, 85, 247, 0.9);
  color: white;
}

/* ── Custom Popover Model Selector ────────────────────────── */
.custom-model-trigger {
  height: 32px;
  min-width: 140px;
  max-width: 220px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 0 12px;
  font-size: 12.5px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s;
}

.custom-model-trigger:hover {
  border-color: #a855f7;
  background: rgba(168, 85, 247, 0.05);
}

.custom-model-trigger .trigger-text {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-model-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 1000;
  width: 300px;
  max-height: 380px;
  overflow-y: auto;
  overflow-x: hidden;
  background: rgba(18, 22, 33, 0.97);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  padding: 6px 0;
  animation: dropdown-fade-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.15) transparent;
}

.custom-model-dropdown::-webkit-scrollbar {
  width: 4px;
}

.custom-model-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.custom-model-dropdown::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

@keyframes dropdown-fade-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.dropdown-header {
  padding: 6px 14px 4px 14px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.custom-model-item {
  padding: 8px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  transition: all 0.15s;
}

.custom-model-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.custom-model-item.active {
  background: rgba(168, 85, 247, 0.12);
}

.custom-model-item.active .model-name {
  color: #c084fc;
}

.model-item-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.model-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.model-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.badge-auto {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.badge-thinking {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.badge-fast {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.badge-pro {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.badge-opus {
  background: rgba(234, 179, 8, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(234, 179, 8, 0.35);
}

.model-desc {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 6px 0;
}

.empty-dropdown-models {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
