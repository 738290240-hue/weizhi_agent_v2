<script setup lang="ts">
import { ref, computed, inject, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { FileText, Copy, Send, Trash2, Volume2, Languages, RefreshCw, Check, Loader2, Play, Download, History, X } from 'lucide-vue-next';
import { chatApi, ttsApi } from '../../utils/api';
import { resolveApiUrl } from '../../utils/urlUtils';

const { t } = useI18n();

// Inject appState from App.vue
const appState = inject<any>('appState');

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
  if (!allVoices || allVoices.length === 0) return [];
  
  if (targetLang.value === 'Japanese') {
    return allVoices.filter((v: any) => v.category === '日文');
  } else if (targetLang.value === 'English') {
    return allVoices.filter((v: any) => v.category === '英文');
  } else {
    // Default to show Chinese/other voices if target is Chinese or others
    return allVoices.filter((v: any) => v.category !== '日文' && v.category !== '英文');
  }
});

// Auto-select first voice when target language changes
watch(filteredVoices, (newVoices) => {
  if (newVoices && newVoices.length > 0) {
    selectedVoiceId.value = newVoices[0].voiceId;
  } else {
    selectedVoiceId.value = '';
  }
}, { immediate: true });

// Helper to convert URL
const mediaUrl = (url: string) => {
  if (!url) return '';
  return resolveApiUrl(url);
};

// Translate function
const handleTranslate = async () => {
  if (!sourceText.value.trim()) return;
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
    } else {
      targetText.value = `Error: ${res.data?.error || 'Unknown error'}`;
    }
  } catch (err: any) {
    targetText.value = `Error: ${err.message || 'Network error'}`;
  } finally {
    isTranslating.value = false;
  }
};

// Synthesize translation translationText to speech
const handleSynthesize = async () => {
  if (!targetText.value.trim() || !selectedVoiceId.value) return;
  isSynthesizing.value = true;
  
  // Create task if appState has task queue managers
  const taskName = `${t("speech.taskGenerate")}: ${targetText.value.trim().slice(0, 30)}`;
  let task: any = null;
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
    } else {
      throw new Error("No audio url returned");
    }
  } catch (err: any) {
    if (appState && typeof appState.finishTask === 'function' && task) {
      appState.finishTask(task, "failed", err?.message || t("speech.generateFailed"));
    }
    alert(`Synthesis failed: ${err.message}`);
  } finally {
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
  } catch (err) {
    console.warn('Failed to read clipboard', err);
  }
};

// Copy translation to clipboard
const copyTranslation = async () => {
  if (!targetText.value) return;
  try {
    await navigator.clipboard.writeText(targetText.value);
    showCopyFeedback.value = true;
    setTimeout(() => showCopyFeedback.value = false, 2000);
  } catch (err) {
    console.warn('Failed to write to clipboard', err);
  }
};

// Send target translation to active chat input
const sendToChat = () => {
  if (!targetText.value || !appState) return;
  appState.inputText.value = targetText.value;
  appState.activeView.value = 'chat';
  showSendFeedback.value = true;
  setTimeout(() => showSendFeedback.value = false, 2000);
};

interface TranslationHistoryItem {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  style: string;
  createdAt: string;
}

const translationHistory = ref<TranslationHistoryItem[]>([]);
const showHistory = ref(true);

const loadHistory = () => {
  try {
    const raw = localStorage.getItem('weizhi.translationHistory');
    if (raw) {
      translationHistory.value = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load translation history', err);
  }
};

const saveHistory = () => {
  try {
    localStorage.setItem('weizhi.translationHistory', JSON.stringify(translationHistory.value));
  } catch (err) {
    console.error('Failed to save translation history', err);
  }
};

const addToHistory = (source: string, target: string, sourceL: string, targetL: string, st: string) => {
  if (translationHistory.value.length > 0) {
    const last = translationHistory.value[0];
    if (last.sourceText === source && last.targetText === target && last.sourceLang === sourceL && last.targetLang === targetL && last.style === st) {
      return;
    }
  }
  const item: TranslationHistoryItem = {
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

const deleteHistoryItem = (id: string) => {
  translationHistory.value = translationHistory.value.filter(item => item.id !== id);
  saveHistory();
};

const clearHistory = () => {
  if (confirm(t('translation.clearHistoryConfirm') || '确定清除所有翻译历史记录吗？')) {
    translationHistory.value = [];
    saveHistory();
  }
};

const restoreHistoryItem = (item: TranslationHistoryItem) => {
  sourceText.value = item.sourceText;
  targetText.value = item.targetText;
  sourceLang.value = item.sourceLang;
  targetLang.value = item.targetLang;
  selectedStyle.value = item.style;
  generatedAudioUrl.value = '';
};

const formatTime = (isoString: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getLangDisplay = (lang: string) => {
  if (lang === 'auto') return t('translation.autoDetect');
  const found = sourceLanguages.find(l => l.code === lang) || targetLanguages.find(l => l.code === lang);
  return found ? ((found as any).label || t((found as any).labelKey || '')) : lang;
};

const getStyleDisplay = (styleId: string) => {
  const found = translationStyles.find(s => s.id === styleId);
  return found ? t(found.labelKey) : styleId;
};

const getStyleEmoji = (styleId: string) => {
  const found = translationStyles.find(s => s.id === styleId);
  return found ? found.emoji : '📄';
};

loadHistory();
</script>

<template>
  <div class="translation-view module-page">
    <div class="module-header">
      <div>
        <h2>{{ $t("translation.title") }}</h2>
        <p>{{ $t("translation.desc") }}</p>
      </div>
      <div class="page-controls">
        <button class="log-action" :class="{ active: showHistory }" @click="showHistory = !showHistory">
          <History :size="15" /> {{ $t("translation.toggleHistory") }}
        </button>
        <button class="log-action" @click="appState.openSpeech">
          <Volume2 :size="15" /> {{ $t("speech.title") }}
        </button>
      </div>
    </div>

    <div class="translation-container" :class="{ 'with-sidebar': showHistory }">
      <div class="module-body translation-layout">
        <!-- Top Translation Grid (Source -> Target) -->
        <div class="translation-grid">
          <!-- Source Pane -->
          <div class="translation-panel">
            <div class="panel-header">
              <span class="panel-tag">{{ $t("translation.sourceLabel") }}</span>
              <div class="selector-wrapper">
                <Languages :size="14" class="selector-icon" />
                <select v-model="sourceLang" class="lang-selector">
                  <option v-for="lang in sourceLanguages" :key="lang.code" :value="lang.code">
                    {{ lang.label || $t(lang.labelKey || '') }}
                  </option>
                </select>
              </div>
            </div>
            <div class="textarea-container">
              <textarea
                v-model="sourceText"
                :placeholder="$t('translation.sourcePlaceholder')"
                class="translation-textarea"
                @keydown.meta.enter="handleTranslate"
                @keydown.ctrl.enter="handleTranslate"
              />
              <div class="textarea-actions">
                <span class="char-count">{{ sourceText.length }}</span>
                <button v-if="sourceText" class="icon-btn-small" :title="$t('speech.clearTtsText')" @click="clearSource">
                  <Trash2 :size="14" />
                </button>
                <button v-else class="icon-btn-small" :title="$t('chat.placeholder')" @click="pasteSource">
                  <Copy :size="14" />
                </button>
              </div>
            </div>
            <div class="panel-footer">
              <button 
                class="preview-btn" 
                :disabled="isTranslating || !sourceText.trim()" 
                @click="handleTranslate"
              >
                <Loader2 v-if="isTranslating" :size="15" class="spin-icon" />
                <RefreshCw v-else :size="15" />
                <span>{{ isTranslating ? $t("translation.translating") : $t("translation.translateBtn") }}</span>
              </button>
            </div>
          </div>

          <!-- Target Pane -->
          <div class="translation-panel">
            <div class="panel-header">
              <span class="panel-tag target">{{ $t("translation.targetLabel") }}</span>
              <div class="selector-wrapper">
                <Languages :size="14" class="selector-icon" />
                <select v-model="targetLang" class="lang-selector">
                  <option v-for="lang in targetLanguages" :key="lang.code" :value="lang.code">
                    {{ lang.label }}
                  </option>
                </select>
              </div>
            </div>
            <div class="textarea-container">
              <textarea
                v-model="targetText"
                :placeholder="$t('translation.targetPlaceholder')"
                class="translation-textarea target-textarea"
              />
              <div class="textarea-actions" v-if="targetText">
                <button class="icon-btn-small" :title="$t('translation.copySuccess')" @click="copyTranslation">
                  <Check v-if="showCopyFeedback" :size="14" class="feedback-success" />
                  <Copy v-else :size="14" />
                </button>
              </div>
            </div>
            
            <!-- Tone / Style Selection Chips -->
            <div class="style-selector-box">
              <span class="style-title">{{ $t("translation.styleLabel") }}</span>
              <div class="style-chips">
                <button
                  v-for="style in translationStyles"
                  :key="style.id"
                  class="style-chip-btn"
                  :class="{ active: selectedStyle === style.id }"
                  @click="selectedStyle = style.id; handleTranslate()"
                >
                  <span class="emoji">{{ style.emoji }}</span>
                  <span>{{ $t(style.labelKey) }}</span>
                </button>
              </div>
            </div>
            
            <div class="panel-footer actions-footer">
              <button 
                v-if="targetText"
                class="preview-btn secondary" 
                @click="sendToChat"
              >
                <Send :size="14" />
                <span>{{ $t("translation.sendToChatBtn") }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Integrated TTS Section -->
        <div class="translation-tts-section" v-if="targetText.trim()">
          <div class="section-title">
            <Volume2 :size="16" />
            <h3>{{ $t("translation.voiceLabel") }}</h3>
          </div>
          
          <!-- Compact Voice Grid selector -->
          <div class="voice-picker-grid" v-if="filteredVoices.length">
            <div 
              v-for="v in filteredVoices" 
              :key="v.voiceId" 
              class="compact-voice-card"
              :class="{ active: selectedVoiceId === v.voiceId }"
              @click="selectedVoiceId = v.voiceId"
            >
              <div class="card-inner">
                <span class="voice-name">{{ v.name }}</span>
                <span class="voice-id">{{ v.voiceId }}</span>
              </div>
              <p class="voice-desc">{{ v.description }}</p>
            </div>
          </div>
          <div v-else class="no-voices-fallback">
            {{ $t("speech.noVoices") || 'No matching voices found' }}
          </div>

          <div class="tts-trigger-bar" v-if="selectedVoiceId">
            <button 
              class="preview-btn" 
              :disabled="isSynthesizing"
              @click="handleSynthesize"
            >
              <Loader2 v-if="isSynthesizing" :size="15" class="spin-icon" />
              <Play v-else :size="15" />
              <span>{{ isSynthesizing ? $t("translation.synthesizing") : $t("translation.synthesizeBtn") }}</span>
            </button>
          </div>

          <!-- Synthesized Audio output player -->
          <div class="translation-audio-result" v-if="generatedAudioUrl">
            <div class="audio-banner">
              <span class="badge">{{ $t("translation.audioLabel") }}</span>
              <span class="voice">{{ selectedVoiceId }}</span>
            </div>
            <audio :src="generatedAudioUrl" controls class="audio-player-control" autoplay />
          </div>
        </div>
      </div>

      <!-- History Sidebar -->
      <div v-if="showHistory" class="translation-history-sidebar">
        <div class="sidebar-header">
          <h3>{{ $t("translation.historyTitle") }}</h3>
          <button 
            v-if="translationHistory.length" 
            class="clear-history-btn" 
            @click="clearHistory"
          >
            <Trash2 :size="14" />
          </button>
        </div>
        <div class="sidebar-body">
          <div 
            v-for="item in translationHistory" 
            :key="item.id" 
            class="history-item-card"
            @click="restoreHistoryItem(item)"
          >
            <div class="card-top">
              <span class="lang-badge">{{ getLangDisplay(item.sourceLang) }} ➔ {{ getLangDisplay(item.targetLang) }}</span>
              <button class="delete-item-btn" @click.stop="deleteHistoryItem(item.id)">
                <X :size="12" />
              </button>
            </div>
            <p class="source-snippet">{{ item.sourceText }}</p>
            <p class="target-snippet">{{ item.targetText }}</p>
            <div class="card-bottom">
              <span class="style-badge" v-if="item.style !== 'default'">
                <span class="emoji">{{ getStyleEmoji(item.style) }}</span>
                <span>{{ getStyleDisplay(item.style) }}</span>
              </span>
              <span class="item-time">{{ formatTime(item.createdAt) }}</span>
            </div>
          </div>
          <div v-if="!translationHistory.length" class="empty-history">
            {{ $t("translation.emptyHistory") }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.translation-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 30px;
}

.translation-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.translation-panel {
  background: rgba(20, 22, 37, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  backdrop-filter: blur(16px);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.translation-panel:focus-within {
  border-color: rgba(235, 54, 76, 0.5);
  box-shadow: 0 0 15px rgba(235, 54, 76, 0.15);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-tag {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--accent);
  background: rgba(235, 54, 76, 0.15);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(235, 54, 76, 0.2);
}

.panel-tag.target {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.2);
}

.selector-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4px 10px;
  border-radius: 6px;
}

.selector-icon {
  color: var(--text-muted);
}

.lang-selector {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  outline: none;
  cursor: pointer;
}

.textarea-container {
  position: relative;
  flex-grow: 1;
  min-height: 180px;
  display: flex;
}

.translation-textarea {
  width: 100%;
  flex-grow: 1;
  min-height: 180px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.25s;
}

.translation-textarea:focus {
  border-color: rgba(255, 255, 255, 0.15);
}

.textarea-actions {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.char-count {
  font-size: 11px;
  color: var(--text-muted);
}

.panel-footer {
  display: flex;
  justify-content: flex-end;
}

.actions-footer {
  justify-content: flex-start;
  gap: 10px;
}

.style-selector-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 5px;
}

.style-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.style-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.style-chip-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.style-chip-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

.style-chip-btn.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  font-weight: 500;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.1);
}

.style-chip-btn .emoji {
  font-size: 14px;
}

/* Integrated TTS section styles */
.translation-tts-section {
  background: rgba(20, 22, 37, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  backdrop-filter: blur(10px);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.section-title h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}

.voice-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 6px;
}

.compact-voice-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s;
}

.compact-voice-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.compact-voice-card.active {
  background: rgba(235, 54, 76, 0.12);
  border-color: rgba(235, 54, 76, 0.4);
  box-shadow: 0 0 8px rgba(235, 54, 76, 0.15);
}

.card-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
}

.voice-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-id {
  font-size: 10px;
  color: var(--text-muted);
  font-family: monospace;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-desc {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-voices-fallback {
  text-align: center;
  padding: 20px;
  font-size: 12px;
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

.tts-trigger-bar {
  display: flex;
  justify-content: flex-start;
}

.translation-audio-result {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.audio-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.audio-banner .badge {
  font-size: 10px;
  font-weight: 700;
  color: #10b981;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
}

.audio-banner .voice {
  font-size: 11px;
  font-family: monospace;
  color: var(--text-muted);
}

.audio-player-control {
  width: 100%;
  height: 36px;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

.feedback-success {
  color: #10b981;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.translation-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  width: 100%;
  min-height: 0;
  flex-grow: 1;
}

.translation-container.with-sidebar {
  grid-template-columns: 1fr 280px;
}

.translation-history-sidebar {
  background: rgba(20, 22, 37, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
  max-height: calc(100vh - 160px);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-header h3 {
  font-size: 13.5px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.clear-history-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.clear-history-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.sidebar-body {
  flex-grow: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.2s ease;
}

.history-item-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lang-badge {
  font-size: 10px;
  font-weight: 600;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.delete-item-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.history-item-card:hover .delete-item-btn {
  opacity: 1;
}

.delete-item-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.source-snippet {
  font-size: 12px;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.target-snippet {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.style-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
  padding: 1px 5px;
  border-radius: 3px;
}

.style-badge .emoji {
  font-size: 11px;
}

.item-time {
  font-size: 10px;
  color: var(--text-muted);
}

.empty-history {
  text-align: center;
  padding: 40px 10px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Mobile responsiveness */
@media (max-width: 1024px) {
  .translation-container.with-sidebar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .translation-grid {
    grid-template-columns: 1fr;
  }
}
</style>
