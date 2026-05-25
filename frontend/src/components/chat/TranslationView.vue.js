/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, computed, inject, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Copy, Send, Trash2, Volume2, Languages, RefreshCw, Check, Loader2, Play, History, X } from 'lucide-vue-next';
import { chatApi, ttsApi } from '../../utils/api';
import { resolveApiUrl } from '../../utils/urlUtils';
const { t } = useI18n();
// Inject appState from App.vue
const appState = inject('appState');
// Reactive states
const sourceText = ref('');
const targetText = ref('');
const sourceLang = ref('auto');
const targetLang = ref('Japanese');
const selectedStyle = ref('default');
const isTranslating = ref(false);
const isSynthesizing = ref(false);
const showCopyFeedback = ref(false);
const showSendFeedback = ref(false);
const selectedVoiceId = ref('');
const generatedAudioUrl = ref('');
// Supported translation styles
const translationStyles = [
    { id: 'default', labelKey: 'translation.styleDefault', emoji: '📄' },
    { id: 'oral', labelKey: 'translation.styleOral', emoji: '💬' },
    { id: 'polite', labelKey: 'translation.stylePolite', emoji: '👔' },
    { id: 'literary', labelKey: 'translation.styleLiterary', emoji: '✍️' }
];
// Languages list
const sourceLanguages = [
    { code: 'auto', labelKey: 'translation.autoDetect' },
    { code: 'Chinese', label: '中文' },
    { code: 'Japanese', label: '日本語' },
    { code: 'English', label: 'English' }
];
const targetLanguages = [
    { code: 'Japanese', label: '日本語' },
    { code: 'Chinese', label: '中文' },
    { code: 'English', label: 'English' }
];
// Retrieve voices from injected appState
const voices = computed(() => appState?.voices?.value || []);
// Filter voices based on selected target language
const filteredVoices = computed(() => {
    const allVoices = voices.value;
    if (!allVoices || allVoices.length === 0)
        return [];
    if (targetLang.value === 'Japanese') {
        return allVoices.filter((v) => v.category === '日文');
    }
    else if (targetLang.value === 'English') {
        return allVoices.filter((v) => v.category === '英文');
    }
    else {
        // Default to show Chinese/other voices if target is Chinese or others
        return allVoices.filter((v) => v.category !== '日文' && v.category !== '英文');
    }
});
// Auto-select first voice when target language changes
watch(filteredVoices, (newVoices) => {
    if (newVoices && newVoices.length > 0) {
        selectedVoiceId.value = newVoices[0].voiceId;
    }
    else {
        selectedVoiceId.value = '';
    }
}, { immediate: true });
// Helper to convert URL
const mediaUrl = (url) => {
    if (!url)
        return '';
    return resolveApiUrl(url);
};
// Translate function
const handleTranslate = async () => {
    if (!sourceText.value.trim())
        return;
    isTranslating.value = true;
    generatedAudioUrl.value = ''; // Reset audio on new translation
    try {
        const res = await chatApi.translate({
            text: sourceText.value,
            sourceLang: sourceLang.value === 'auto' ? t('translation.autoDetect') : sourceLang.value,
            targetLang: targetLang.value,
            style: selectedStyle.value
        });
        if (res.data && res.data.success) {
            targetText.value = res.data.translation;
            addToHistory(sourceText.value, res.data.translation, sourceLang.value, targetLang.value, selectedStyle.value);
        }
        else {
            targetText.value = `Error: ${res.data?.error || 'Unknown error'}`;
        }
    }
    catch (err) {
        targetText.value = `Error: ${err.message || 'Network error'}`;
    }
    finally {
        isTranslating.value = false;
    }
};
// Synthesize translation translationText to speech
const handleSynthesize = async () => {
    if (!targetText.value.trim() || !selectedVoiceId.value)
        return;
    isSynthesizing.value = true;
    // Create task if appState has task queue managers
    const taskName = `${t("speech.taskGenerate")}: ${targetText.value.trim().slice(0, 30)}`;
    let task = null;
    if (appState && typeof appState.createTask === 'function') {
        task = appState.createTask(taskName, "minimax", targetText.value.trim().slice(0, 80));
    }
    try {
        const res = await ttsApi.generate({
            text: targetText.value.trim(),
            voiceId: selectedVoiceId.value,
            model: "speech-2.8-hd",
            format: "mp3",
            speed: 1.0,
            vol: 1.0,
            pitch: 0,
            source: 'translation'
        });
        if (res.data?.audioUrl) {
            const raw = mediaUrl(res.data.audioUrl);
            generatedAudioUrl.value = `${raw}${raw.includes("?") ? "&" : "?"}t=${Date.now()}`;
            if (appState && typeof appState.finishTask === 'function' && task) {
                appState.finishTask(task, "success", t("speech.generateSuccess"));
            }
        }
        else {
            throw new Error("No audio url returned");
        }
    }
    catch (err) {
        if (appState && typeof appState.finishTask === 'function' && task) {
            appState.finishTask(task, "failed", err?.message || t("speech.generateFailed"));
        }
        alert(`Synthesis failed: ${err.message}`);
    }
    finally {
        isSynthesizing.value = false;
    }
};
// Clear text
const clearSource = () => {
    sourceText.value = '';
    targetText.value = '';
    generatedAudioUrl.value = '';
};
// Paste text from clipboard
const pasteSource = async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            sourceText.value = text;
        }
    }
    catch (err) {
        console.warn('Failed to read clipboard', err);
    }
};
// Copy translation to clipboard
const copyTranslation = async () => {
    if (!targetText.value)
        return;
    try {
        await navigator.clipboard.writeText(targetText.value);
        showCopyFeedback.value = true;
        setTimeout(() => showCopyFeedback.value = false, 2000);
    }
    catch (err) {
        console.warn('Failed to write to clipboard', err);
    }
};
// Send target translation to active chat input
const sendToChat = () => {
    if (!targetText.value || !appState)
        return;
    appState.inputText.value = targetText.value;
    appState.activeView.value = 'chat';
    showSendFeedback.value = true;
    setTimeout(() => showSendFeedback.value = false, 2000);
};
const translationHistory = ref([]);
const showHistory = ref(true);
const loadHistory = () => {
    try {
        const raw = localStorage.getItem('weizhi.translationHistory');
        if (raw) {
            translationHistory.value = JSON.parse(raw);
        }
    }
    catch (err) {
        console.error('Failed to load translation history', err);
    }
};
const saveHistory = () => {
    try {
        localStorage.setItem('weizhi.translationHistory', JSON.stringify(translationHistory.value));
    }
    catch (err) {
        console.error('Failed to save translation history', err);
    }
};
const addToHistory = (source, target, sourceL, targetL, st) => {
    if (translationHistory.value.length > 0) {
        const last = translationHistory.value[0];
        if (last.sourceText === source && last.targetText === target && last.sourceLang === sourceL && last.targetLang === targetL && last.style === st) {
            return;
        }
    }
    const item = {
        id: `trans-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sourceText: source,
        targetText: target,
        sourceLang: sourceL,
        targetLang: targetL,
        style: st,
        createdAt: new Date().toISOString()
    };
    translationHistory.value.unshift(item);
    if (translationHistory.value.length > 50) {
        translationHistory.value.pop();
    }
    saveHistory();
};
const deleteHistoryItem = (id) => {
    translationHistory.value = translationHistory.value.filter(item => item.id !== id);
    saveHistory();
};
const clearHistory = () => {
    if (confirm(t('translation.clearHistoryConfirm') || '确定清除所有翻译历史记录吗？')) {
        translationHistory.value = [];
        saveHistory();
    }
};
const restoreHistoryItem = (item) => {
    sourceText.value = item.sourceText;
    targetText.value = item.targetText;
    sourceLang.value = item.sourceLang;
    targetLang.value = item.targetLang;
    selectedStyle.value = item.style;
    generatedAudioUrl.value = '';
};
const formatTime = (isoString) => {
    if (!isoString)
        return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const getLangDisplay = (lang) => {
    if (lang === 'auto')
        return t('translation.autoDetect');
    const found = sourceLanguages.find(l => l.code === lang) || targetLanguages.find(l => l.code === lang);
    return found ? (found.label || t(found.labelKey || '')) : lang;
};
const getStyleDisplay = (styleId) => {
    const found = translationStyles.find(s => s.id === styleId);
    return found ? t(found.labelKey) : styleId;
};
const getStyleEmoji = (styleId) => {
    const found = translationStyles.find(s => s.id === styleId);
    return found ? found.emoji : '📄';
};
loadHistory();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['translation-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['style-chip-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['style-chip-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['style-chip-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['compact-voice-card']} */ ;
/** @type {__VLS_StyleScopedClasses['compact-voice-card']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-container']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-header']} */ ;
/** @type {__VLS_StyleScopedClasses['clear-history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item-card']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item-card']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-item-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-item-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['style-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['emoji']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-container']} */ ;
/** @type {__VLS_StyleScopedClasses['with-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-grid']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "translation-view module-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "module-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
(__VLS_ctx.$t("translation.title"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
(__VLS_ctx.$t("translation.desc"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-controls" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showHistory = !__VLS_ctx.showHistory;
        } },
    ...{ class: "log-action" },
    ...{ class: ({ active: __VLS_ctx.showHistory }) },
});
const __VLS_0 = {}.History;
/** @type {[typeof __VLS_components.History, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    size: (15),
}));
const __VLS_2 = __VLS_1({
    size: (15),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
(__VLS_ctx.$t("translation.toggleHistory"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.appState.openSpeech) },
    ...{ class: "log-action" },
});
const __VLS_4 = {}.Volume2;
/** @type {[typeof __VLS_components.Volume2, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    size: (15),
}));
const __VLS_6 = __VLS_5({
    size: (15),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
(__VLS_ctx.$t("speech.title"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "translation-container" },
    ...{ class: ({ 'with-sidebar': __VLS_ctx.showHistory }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "module-body translation-layout" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "translation-grid" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "translation-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "panel-tag" },
});
(__VLS_ctx.$t("translation.sourceLabel"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "selector-wrapper" },
});
const __VLS_8 = {}.Languages;
/** @type {[typeof __VLS_components.Languages, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    size: (14),
    ...{ class: "selector-icon" },
}));
const __VLS_10 = __VLS_9({
    size: (14),
    ...{ class: "selector-icon" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.sourceLang),
    ...{ class: "lang-selector" },
});
for (const [lang] of __VLS_getVForSourceType((__VLS_ctx.sourceLanguages))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (lang.code),
        value: (lang.code),
    });
    (lang.label || __VLS_ctx.$t(lang.labelKey || ''));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "textarea-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
    ...{ onKeydown: (__VLS_ctx.handleTranslate) },
    ...{ onKeydown: (__VLS_ctx.handleTranslate) },
    value: (__VLS_ctx.sourceText),
    placeholder: (__VLS_ctx.$t('translation.sourcePlaceholder')),
    ...{ class: "translation-textarea" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "textarea-actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "char-count" },
});
(__VLS_ctx.sourceText.length);
if (__VLS_ctx.sourceText) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearSource) },
        ...{ class: "icon-btn-small" },
        title: (__VLS_ctx.$t('speech.clearTtsText')),
    });
    const __VLS_12 = {}.Trash2;
    /** @type {[typeof __VLS_components.Trash2, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        size: (14),
    }));
    const __VLS_14 = __VLS_13({
        size: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.pasteSource) },
        ...{ class: "icon-btn-small" },
        title: (__VLS_ctx.$t('chat.placeholder')),
    });
    const __VLS_16 = {}.Copy;
    /** @type {[typeof __VLS_components.Copy, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        size: (14),
    }));
    const __VLS_18 = __VLS_17({
        size: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-footer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.handleTranslate) },
    ...{ class: "preview-btn" },
    disabled: (__VLS_ctx.isTranslating || !__VLS_ctx.sourceText.trim()),
});
if (__VLS_ctx.isTranslating) {
    const __VLS_20 = {}.Loader2;
    /** @type {[typeof __VLS_components.Loader2, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        size: (15),
        ...{ class: "spin-icon" },
    }));
    const __VLS_22 = __VLS_21({
        size: (15),
        ...{ class: "spin-icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
else {
    const __VLS_24 = {}.RefreshCw;
    /** @type {[typeof __VLS_components.RefreshCw, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        size: (15),
    }));
    const __VLS_26 = __VLS_25({
        size: (15),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.isTranslating ? __VLS_ctx.$t("translation.translating") : __VLS_ctx.$t("translation.translateBtn"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "translation-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "panel-tag target" },
});
(__VLS_ctx.$t("translation.targetLabel"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "selector-wrapper" },
});
const __VLS_28 = {}.Languages;
/** @type {[typeof __VLS_components.Languages, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    size: (14),
    ...{ class: "selector-icon" },
}));
const __VLS_30 = __VLS_29({
    size: (14),
    ...{ class: "selector-icon" },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.targetLang),
    ...{ class: "lang-selector" },
});
for (const [lang] of __VLS_getVForSourceType((__VLS_ctx.targetLanguages))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (lang.code),
        value: (lang.code),
    });
    (lang.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "textarea-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
    value: (__VLS_ctx.targetText),
    placeholder: (__VLS_ctx.$t('translation.targetPlaceholder')),
    ...{ class: "translation-textarea target-textarea" },
});
if (__VLS_ctx.targetText) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "textarea-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.copyTranslation) },
        ...{ class: "icon-btn-small" },
        title: (__VLS_ctx.$t('translation.copySuccess')),
    });
    if (__VLS_ctx.showCopyFeedback) {
        const __VLS_32 = {}.Check;
        /** @type {[typeof __VLS_components.Check, ]} */ ;
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
            size: (14),
            ...{ class: "feedback-success" },
        }));
        const __VLS_34 = __VLS_33({
            size: (14),
            ...{ class: "feedback-success" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    }
    else {
        const __VLS_36 = {}.Copy;
        /** @type {[typeof __VLS_components.Copy, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            size: (14),
        }));
        const __VLS_38 = __VLS_37({
            size: (14),
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "style-selector-box" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "style-title" },
});
(__VLS_ctx.$t("translation.styleLabel"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "style-chips" },
});
for (const [style] of __VLS_getVForSourceType((__VLS_ctx.translationStyles))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedStyle = style.id;
                __VLS_ctx.handleTranslate();
            } },
        key: (style.id),
        ...{ class: "style-chip-btn" },
        ...{ class: ({ active: __VLS_ctx.selectedStyle === style.id }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "emoji" },
    });
    (style.emoji);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t(style.labelKey));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-footer actions-footer" },
});
if (__VLS_ctx.targetText) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.sendToChat) },
        ...{ class: "preview-btn secondary" },
    });
    const __VLS_40 = {}.Send;
    /** @type {[typeof __VLS_components.Send, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        size: (14),
    }));
    const __VLS_42 = __VLS_41({
        size: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.$t("translation.sendToChatBtn"));
}
if (__VLS_ctx.targetText.trim()) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "translation-tts-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "section-title" },
    });
    const __VLS_44 = {}.Volume2;
    /** @type {[typeof __VLS_components.Volume2, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        size: (16),
    }));
    const __VLS_46 = __VLS_45({
        size: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    (__VLS_ctx.$t("translation.voiceLabel"));
    if (__VLS_ctx.filteredVoices.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "voice-picker-grid" },
        });
        for (const [v] of __VLS_getVForSourceType((__VLS_ctx.filteredVoices))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.targetText.trim()))
                            return;
                        if (!(__VLS_ctx.filteredVoices.length))
                            return;
                        __VLS_ctx.selectedVoiceId = v.voiceId;
                    } },
                key: (v.voiceId),
                ...{ class: "compact-voice-card" },
                ...{ class: ({ active: __VLS_ctx.selectedVoiceId === v.voiceId }) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card-inner" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "voice-name" },
            });
            (v.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "voice-id" },
            });
            (v.voiceId);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "voice-desc" },
            });
            (v.description);
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "no-voices-fallback" },
        });
        (__VLS_ctx.$t("speech.noVoices") || 'No matching voices found');
    }
    if (__VLS_ctx.selectedVoiceId) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tts-trigger-bar" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.handleSynthesize) },
            ...{ class: "preview-btn" },
            disabled: (__VLS_ctx.isSynthesizing),
        });
        if (__VLS_ctx.isSynthesizing) {
            const __VLS_48 = {}.Loader2;
            /** @type {[typeof __VLS_components.Loader2, ]} */ ;
            // @ts-ignore
            const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
                size: (15),
                ...{ class: "spin-icon" },
            }));
            const __VLS_50 = __VLS_49({
                size: (15),
                ...{ class: "spin-icon" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_49));
        }
        else {
            const __VLS_52 = {}.Play;
            /** @type {[typeof __VLS_components.Play, ]} */ ;
            // @ts-ignore
            const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
                size: (15),
            }));
            const __VLS_54 = __VLS_53({
                size: (15),
            }, ...__VLS_functionalComponentArgsRest(__VLS_53));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.isSynthesizing ? __VLS_ctx.$t("translation.synthesizing") : __VLS_ctx.$t("translation.synthesizeBtn"));
    }
    if (__VLS_ctx.generatedAudioUrl) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "translation-audio-result" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "audio-banner" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge" },
        });
        (__VLS_ctx.$t("translation.audioLabel"));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "voice" },
        });
        (__VLS_ctx.selectedVoiceId);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.audio)({
            src: (__VLS_ctx.generatedAudioUrl),
            controls: true,
            ...{ class: "audio-player-control" },
            autoplay: true,
        });
    }
}
if (__VLS_ctx.showHistory) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "translation-history-sidebar" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sidebar-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    (__VLS_ctx.$t("translation.historyTitle"));
    if (__VLS_ctx.translationHistory.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.clearHistory) },
            ...{ class: "clear-history-btn" },
        });
        const __VLS_56 = {}.Trash2;
        /** @type {[typeof __VLS_components.Trash2, ]} */ ;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
            size: (14),
        }));
        const __VLS_58 = __VLS_57({
            size: (14),
        }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sidebar-body" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.translationHistory))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showHistory))
                        return;
                    __VLS_ctx.restoreHistoryItem(item);
                } },
            key: (item.id),
            ...{ class: "history-item-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card-top" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "lang-badge" },
        });
        (__VLS_ctx.getLangDisplay(item.sourceLang));
        (__VLS_ctx.getLangDisplay(item.targetLang));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showHistory))
                        return;
                    __VLS_ctx.deleteHistoryItem(item.id);
                } },
            ...{ class: "delete-item-btn" },
        });
        const __VLS_60 = {}.X;
        /** @type {[typeof __VLS_components.X, ]} */ ;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
            size: (12),
        }));
        const __VLS_62 = __VLS_61({
            size: (12),
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "source-snippet" },
        });
        (item.sourceText);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "target-snippet" },
        });
        (item.targetText);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card-bottom" },
        });
        if (item.style !== 'default') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "style-badge" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "emoji" },
            });
            (__VLS_ctx.getStyleEmoji(item.style));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (__VLS_ctx.getStyleDisplay(item.style));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "item-time" },
        });
        (__VLS_ctx.formatTime(item.createdAt));
    }
    if (!__VLS_ctx.translationHistory.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-history" },
        });
        (__VLS_ctx.$t("translation.emptyHistory"));
    }
}
/** @type {__VLS_StyleScopedClasses['translation-view']} */ ;
/** @type {__VLS_StyleScopedClasses['module-page']} */ ;
/** @type {__VLS_StyleScopedClasses['module-header']} */ ;
/** @type {__VLS_StyleScopedClasses['page-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['log-action']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-container']} */ ;
/** @type {__VLS_StyleScopedClasses['module-body']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['selector-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['selector-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['lang-selector']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-container']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['char-count']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn-small']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn-small']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['spin-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['target']} */ ;
/** @type {__VLS_StyleScopedClasses['selector-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['selector-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['lang-selector']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-container']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['target-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['icon-btn-small']} */ ;
/** @type {__VLS_StyleScopedClasses['feedback-success']} */ ;
/** @type {__VLS_StyleScopedClasses['style-selector-box']} */ ;
/** @type {__VLS_StyleScopedClasses['style-title']} */ ;
/** @type {__VLS_StyleScopedClasses['style-chips']} */ ;
/** @type {__VLS_StyleScopedClasses['style-chip-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['emoji']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['actions-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-tts-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-picker-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['compact-voice-card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-name']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-id']} */ ;
/** @type {__VLS_StyleScopedClasses['voice-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['no-voices-fallback']} */ ;
/** @type {__VLS_StyleScopedClasses['tts-trigger-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['spin-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-audio-result']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['voice']} */ ;
/** @type {__VLS_StyleScopedClasses['audio-player-control']} */ ;
/** @type {__VLS_StyleScopedClasses['translation-history-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-header']} */ ;
/** @type {__VLS_StyleScopedClasses['clear-history-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-body']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item-card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-top']} */ ;
/** @type {__VLS_StyleScopedClasses['lang-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-item-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['source-snippet']} */ ;
/** @type {__VLS_StyleScopedClasses['target-snippet']} */ ;
/** @type {__VLS_StyleScopedClasses['card-bottom']} */ ;
/** @type {__VLS_StyleScopedClasses['style-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['emoji']} */ ;
/** @type {__VLS_StyleScopedClasses['item-time']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-history']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Copy: Copy,
            Send: Send,
            Trash2: Trash2,
            Volume2: Volume2,
            Languages: Languages,
            RefreshCw: RefreshCw,
            Check: Check,
            Loader2: Loader2,
            Play: Play,
            History: History,
            X: X,
            appState: appState,
            sourceText: sourceText,
            targetText: targetText,
            sourceLang: sourceLang,
            targetLang: targetLang,
            selectedStyle: selectedStyle,
            isTranslating: isTranslating,
            isSynthesizing: isSynthesizing,
            showCopyFeedback: showCopyFeedback,
            selectedVoiceId: selectedVoiceId,
            generatedAudioUrl: generatedAudioUrl,
            translationStyles: translationStyles,
            sourceLanguages: sourceLanguages,
            targetLanguages: targetLanguages,
            filteredVoices: filteredVoices,
            handleTranslate: handleTranslate,
            handleSynthesize: handleSynthesize,
            clearSource: clearSource,
            pasteSource: pasteSource,
            copyTranslation: copyTranslation,
            sendToChat: sendToChat,
            translationHistory: translationHistory,
            showHistory: showHistory,
            deleteHistoryItem: deleteHistoryItem,
            clearHistory: clearHistory,
            restoreHistoryItem: restoreHistoryItem,
            formatTime: formatTime,
            getLangDisplay: getLangDisplay,
            getStyleDisplay: getStyleDisplay,
            getStyleEmoji: getStyleEmoji,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
