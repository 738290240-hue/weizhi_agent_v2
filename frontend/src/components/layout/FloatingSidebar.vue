<script setup lang="ts">
import { inject } from 'vue';
import { Terminal, Home, Bell, BookOpen, Activity, FolderOpen, Star, Wrench, Download, FileText, Settings, History, Trash2, Cpu, Image as ImageIcon, Volume2, Database } from 'lucide-vue-next';

// Inject all required state and methods from App.vue
const appState = inject<any>('appState');
</script>

<template>
  <aside class="floating-sidebar">
    <div class="brand"><Cpu class="icon-accent" /><span>WEIZHI AGENT</span></div>
    <div class="nav-group">
      <button class="nav-item" :class="{ active: appState.activeView.value === 'home' }" @click="appState.openHome"><Home :size="16" /> {{ $t('nav.home') }}</button>
      <button class="nav-item provider-entry minimax-entry" :class="{ active: appState.activeProvider.value === 'minimax' }" @click="appState.switchProvider('minimax')">
        <Terminal :size="16" />
        <span>
          <strong>{{ $t('nav.minimaxSession') }}</strong>
          <small>{{ $t('nav.minimaxDesc') }}</small>
        </span>
      </button>
      <div v-if="appState.showMiniMaxSubnav.value" class="nav-subgroup">
        <button class="nav-subitem" :class="{ active: appState.activeView.value === 'speech' }" @click="appState.openSpeech">
          <Volume2 :size="14" /> {{ $t('nav.speechSynthesis') }}
        </button>
        <button class="nav-subitem" :class="{ active: appState.activeView.value === 'translation' }" @click="appState.activeView.value = 'translation'">
          <FileText :size="14" /> {{ $t('nav.translation') }}
        </button>
        <button class="nav-subitem" :class="{ active: appState.activeView.value === 'imageHistory' }" @click="appState.openMiniMaxHistory('imageHistory')">
          <ImageIcon :size="14" /> {{ $t('nav.imageHistory') }}
        </button>
        <button class="nav-subitem" :class="{ active: appState.activeView.value === 'ttsHistory' }" @click="appState.openMiniMaxHistory('ttsHistory')">
          <Volume2 :size="14" /> {{ $t('nav.speechHistory') }}
        </button>
      </div>
      <button class="nav-item provider-entry deepseek-entry" :class="{ active: appState.activeProvider.value === 'deepseek' }" @click="appState.switchProvider('deepseek')">
        <Terminal :size="16" />
        <span>
          <strong>{{ $t('nav.deepseekSession') }}</strong>
          <small>{{ $t('nav.deepseekDesc') }}</small>
        </span>
      </button>
      <button class="nav-item provider-entry openai-entry" :class="{ active: appState.activeProvider.value === 'openai' }" @click="appState.switchProvider('openai')">
        <Terminal :size="16" />
        <span>
          <strong>{{ $t('nav.openaiSession') }}</strong>
          <small>{{ $t('nav.openaiDesc') }}</small>
        </span>
      </button>
      <button class="nav-item provider-entry gemini-entry" :class="{ active: appState.activeProvider.value === 'gemini' }" @click="appState.switchProvider('gemini')">
        <Terminal :size="16" />
        <span>
          <strong>{{ $t('nav.geminiSession') }}</strong>
          <small>{{ $t('nav.geminiDesc') }}</small>
        </span>
      </button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'sessions' }" @click="appState.activeView.value = 'sessions'"><History :size="16" /> {{ $t('nav.sessions') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'tasks' }" @click="appState.activeView.value = 'tasks'"><Activity :size="16" /> {{ $t('nav.tasks') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'notifications' }" @click="appState.activeView.value = 'notifications'; appState.markNotificationsRead()">
        <Bell :size="16" /> {{ $t('nav.notifications') }} <small v-if="appState.unreadNotificationCount.value" class="nav-badge">{{ appState.unreadNotificationCount.value }}</small>
      </button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'prompts' }" @click="appState.activeView.value = 'prompts'"><BookOpen :size="16" /> {{ $t('nav.prompts') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'assets' }" @click="appState.openAssets"><FolderOpen :size="16" /> {{ $t('nav.assets') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'favorites' }" @click="appState.activeView.value = 'favorites'"><Star :size="16" /> {{ $t('nav.favorites') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'diagnostics' }" @click="appState.openDiagnostics"><Wrench :size="16" /> {{ $t('nav.diagnostics') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'exports' }" @click="appState.openExports"><Download :size="16" /> {{ $t('nav.exports') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'apiStatus' }" @click="appState.openApiStatus"><Activity :size="16" /> {{ $t('nav.apiStatus') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'logs' }" @click="appState.openLogs"><FileText :size="16" /> {{ $t('nav.logs') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'dataManagement' }" @click="appState.openDataManagement"><Database :size="16" /> {{ $t('nav.dataManagement') }}</button>
      <button class="nav-item" :class="{ active: appState.activeView.value === 'settings' }" @click="appState.openSettings"><Settings :size="16" /> {{ $t('nav.settings') }}</button>
    </div>
    
    <div class="bottom-controls">
      <div class="lang-switcher">
        <button class="lang-btn" :class="{ active: appState.locale.value === 'zh-CN' }" @click="appState.setLang('zh-CN')">{{ $t("lang.zhCN") }}</button>
        <button class="lang-btn" :class="{ active: appState.locale.value === 'zh-TW' }" @click="appState.setLang('zh-TW')">{{ $t("lang.zhTW") }}</button>
        <button class="lang-btn" :class="{ active: appState.locale.value === 'en-US' }" @click="appState.setLang('en-US')">EN</button>
      </div>
      <div class="theme-switcher">
        <button class="theme-btn" :class="{ active: appState.currentTheme.value === 'midnight' }" @click="appState.setTheme('midnight')" :title="$t('theme.midnight')"><div class="color-dot midnight"></div></button>
        <button class="theme-btn" :class="{ active: appState.currentTheme.value === 'light' }" @click="appState.setTheme('light')" :title="$t('theme.light')"><div class="color-dot light"></div></button>
        <button class="theme-btn" :class="{ active: appState.currentTheme.value === 'obsidian' }" @click="appState.setTheme('obsidian')" :title="$t('theme.obsidian')"><div class="color-dot obsidian"></div></button>
        <button class="theme-btn" :class="{ active: appState.currentTheme.value === 'green' }" @click="appState.setTheme('green')" :title="$t('theme.green')"><div class="color-dot green"></div></button>
        <button class="theme-btn" :class="{ active: appState.currentTheme.value === 'pink' }" @click="appState.setTheme('pink')" :title="$t('theme.pink')"><div class="color-dot pink"></div></button>
      </div>
    </div>

    <button class="btn-clear" @click="appState.clearCurrentConversation"><Trash2 :size="14" /> {{ $t('nav.clearSession') }}</button>
  </aside>
</template>

<style scoped>
.floating-sidebar {
  width: var(--sidebar-width);
  background: var(--glass-bg);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  overflow-y: auto;
  z-index: 10;
  transition: width 0.1s;
}

/* Base styles for sidebar elements are inherited from main.css */
</style>
