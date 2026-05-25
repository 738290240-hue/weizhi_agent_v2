<script setup lang="ts">
// Renders the dynamic glowing background for the Glassmorphism layout
</script>

<template>
  <div class="app-background">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
  </div>
</template>

<style scoped>
.app-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  background-color: var(--bg-base);
  overflow: hidden;
}

.blob {
  position: absolute;
  filter: blur(100px);
  opacity: 0.5;
  border-radius: 50%;
  animation: float 20s infinite alternate ease-in-out;
}

.blob-1 {
  top: -10%;
  left: -10%;
  width: 50vw;
  height: 50vw;
  background: var(--accent-soft);
  animation-delay: 0s;
}

.blob-2 {
  bottom: -20%;
  right: -10%;
  width: 60vw;
  height: 60vw;
  background: var(--accent);
  opacity: 0.15;
  animation-delay: -5s;
}

.blob-3 {
  top: 40%;
  left: 50%;
  width: 40vw;
  height: 40vw;
  background: var(--text-faint);
  opacity: 0.1;
  animation-delay: -10s;
}

@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(5%, 10%) scale(1.1); }
  100% { transform: translate(-5%, -5%) scale(0.9); }
}
</style>
