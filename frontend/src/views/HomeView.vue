<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref } from 'vue'

// HomeView receives shared app state via provide/inject from App.vue
const activeView = inject<Ref<string>>('activeView')
const dashboardStats = inject<ReturnType<typeof computed>>('dashboardStats')
const recentNotifications = inject<ReturnType<typeof computed>>('recentNotifications')
const switchProvider = inject<(provider: string) => void>('switchProvider')
const openAssets = inject<() => void>('openAssets')
</script>

<template>
  <!-- This view is rendered by the parent App.vue when activeView === 'home' -->
  <!-- The actual content is still managed by App.vue for compatibility -->
  <slot />
</template>
