<template>
  <span v-if="sourceType === 'manual' || sourceType === 'url'" class="document-source-icon"
    :class="`document-source-icon--${sourceType}`" aria-hidden="true">
    <svg viewBox="0 0 32 38" fill="none">
      <path class="file-sheet" d="M6 1.5h13L28.5 11v22A3.5 3.5 0 0 1 25 36.5H6A3.5 3.5 0 0 1 2.5 33V5A3.5 3.5 0 0 1 6 1.5Z" />
      <path class="file-fold" d="M19 1.5V8a3 3 0 0 0 3 3h6.5" />
      <path class="file-lines" d="M8 14h9M8 18h14" />
    </svg>
    <span class="document-source-icon__badge"><t-icon :name="sourceType === 'manual' ? 'edit' : 'link'" size="13px" /></span>
  </span>
  <svg v-else viewBox="0 0 32 38" fill="none" class="document-file-icon" :class="fileKindClass" aria-hidden="true">
    <path class="file-sheet" d="M6 1.5h13L28.5 11v22A3.5 3.5 0 0 1 25 36.5H6A3.5 3.5 0 0 1 2.5 33V5A3.5 3.5 0 0 1 6 1.5Z" />
    <path class="file-fold" d="M19 1.5V8a3 3 0 0 0 3 3h6.5" />
    <path class="file-lines" d="M8 14h9M8 18h14" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ sourceType?: string; fileName: string }>();

const EXT_KIND_MAP: Record<string, string> = {
  doc: 'kind-file-word', docx: 'kind-file-word',
  xls: 'kind-file-excel', xlsx: 'kind-file-excel', csv: 'kind-file-excel',
  ppt: 'kind-file-powerpoint', pptx: 'kind-file-powerpoint',
  pdf: 'kind-file-pdf',
  png: 'kind-image', jpg: 'kind-image', jpeg: 'kind-image', gif: 'kind-image', webp: 'kind-image', svg: 'kind-image', bmp: 'kind-image',
  mp4: 'kind-video', mov: 'kind-video', avi: 'kind-video', mkv: 'kind-video', webm: 'kind-video',
  js: 'kind-code', ts: 'kind-code', vue: 'kind-code', py: 'kind-code', go: 'kind-code', java: 'kind-code',
  c: 'kind-code', cpp: 'kind-code', h: 'kind-code', css: 'kind-code', html: 'kind-code', json: 'kind-code', sh: 'kind-code',
  mp3: 'kind-sound', wav: 'kind-sound', flac: 'kind-sound', ogg: 'kind-sound', m4a: 'kind-sound',
};

const fileKindClass = computed(() => {
  const name = props.fileName || '';
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return EXT_KIND_MAP[ext] || '';
});
</script>

<style scoped lang="less">
@import '@/components/css/artifact-file-icon.less';
.document-file-icon { .artifact-file-icon-style(); }
.document-source-icon {
  position: relative;
  display: inline-flex;
  flex: 0 0 32px;
  width: 32px;
  height: 38px;
  color: #7885ad;
  &--url { color: #53978e; }
  > svg { .artifact-file-icon-style(); color: inherit; }
  &__badge {
    position: absolute;
    right: 1px;
    bottom: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 16px;
    border-radius: var(--app-radius-xs);
    background: currentColor;
    .t-icon { color: #fff; }
  }
}
</style>
