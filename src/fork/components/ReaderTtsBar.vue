<template>
  <div v-if="ttsEnabled && ttsActive" class="reader-toolbar is-visible is-tts-bar">
    <button class="toolbar-btn b3-tooltips b3-tooltips__n" @click.stop="$emit('jump', -1)" :aria-label="i18n.prevChapter || '上一章'"><svg><use xlink:href="#iconLeft"/></svg></button>
    <button class="toolbar-btn b3-tooltips b3-tooltips__n" :class="{ active: ttsPlaying && !ttsLoading }" :disabled="ttsLoading" @click.stop="$emit('toggle')" :aria-label="ttsLoading ? (i18n.ttsPreparing || '准备中') : (ttsPaused ? (i18n.ttsResume || '继续朗读') : (i18n.ttsPause || '暂停朗读'))">
      <span v-if="ttsLoading" class="toolbar-spinner"/>
      <svg v-else><use :xlink:href="ttsPaused ? '#iconPlay' : '#iconPause'"/></svg>
    </button>
    <button class="toolbar-btn b3-tooltips b3-tooltips__n" @click.stop="$emit('jump', 1)" :aria-label="i18n.nextChapter || '下一章'"><svg><use xlink:href="#iconRight"/></svg></button>
    <button class="toolbar-btn b3-tooltips b3-tooltips__n" :disabled="ttsLoading" @click.stop="$emit('restart')" :aria-label="i18n.ttsRestart || '从当前页朗读'"><svg><use xlink:href="#iconRefresh"/></svg></button>
    <button class="toolbar-btn b3-tooltips b3-tooltips__n" @click.stop="$emit('stop')" :aria-label="i18n.ttsStop || '停止朗读'"><svg><use xlink:href="#iconClose"/></svg></button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  ttsEnabled: boolean
  ttsActive: boolean
  ttsPlaying: boolean
  ttsLoading: boolean
  ttsPaused: boolean
  i18n: Record<string, any>
}>()
defineEmits<{ jump: [delta: number]; toggle: []; restart: []; stop: [] }>()
</script>

<style scoped>
/* Mirror Reader.vue toolbar look (scoped parent styles don't pierce child). */
.reader-toolbar{display:flex;align-items:center;gap:2px;padding:3px 4px;background:var(--b3-theme-surface);border:1px solid var(--b3-border-color);border-radius:6px;box-shadow:0 2px 8px #0002}
.toolbar-btn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;border-radius:4px;cursor:pointer;color:inherit;transition:all .15s}
.toolbar-btn svg{width:14px;height:14px}
.toolbar-btn:hover{background:var(--b3-list-hover)}
.toolbar-btn.active{background:var(--b3-theme-primary-lightest);color:var(--b3-theme-primary)}
.toolbar-btn:disabled{opacity:.5;cursor:default}
.toolbar-spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
