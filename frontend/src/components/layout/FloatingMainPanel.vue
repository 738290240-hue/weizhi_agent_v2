<script setup lang="ts">
// Glassmorphism Main Content Panel
</script>

<template>
  <main class="floating-main-panel">
    <slot></slot>
  </main>
</template>

<style scoped>
.floating-main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
  margin: var(--gap);
  margin-left: 0;
  box-shadow: var(--shadow);
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
}

@media (max-width: 768px) {
  .floating-main-panel {
    margin-left: var(--gap);
  }
}
</style>
