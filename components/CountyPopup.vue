<template>
  <Teleport to="body">
    <div v-if="open" class="popup-anchor" role="dialog" aria-modal="false">
      <div class="popup-card">
        <div class="popup-header">
          <div class="popup-title">{{ county?.name ?? "—" }}</div>
          <button class="popup-close" type="button" @click="emit('close')">
            ✕
          </button>
        </div>

        <div class="popup-body" v-if="county">
          <div class="row">
            <div class="label">Status</div>
            <div class="value" :style="{ color: statusColor }">
              {{ county.status }}
            </div>
          </div>
          <div class="row">
            <div class="label">Lng</div>
            <div class="value">{{ county.position[0].toFixed(4) }}</div>
          </div>
          <div class="row">
            <div class="label">Lat</div>
            <div class="value">{{ county.position[1].toFixed(4) }}</div>
          </div>

          <details class="raw">
            <summary>Raw data</summary>
            <pre>{{ JSON.stringify(county, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";

type CountyStatus = "online" | "offline";

export type CountyPoint = {
  name: string;
  position: [longitude: number, latitude: number];
  status: CountyStatus;
  [key: string]: unknown;
};

const props = defineProps<{
  open: boolean;
  county: CountyPoint | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const statusColor = computed(() =>
  props.county?.status === "online" ? "rgb(100,180,255)" : "rgb(255,90,190)",
);
</script>

<style scoped>
.popup-anchor {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 9999;
}

.popup-card {
  width: min(420px, calc(100vw - 24px));
  max-height: min(60vh, 520px);
  overflow: auto;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(12, 14, 22, 0.92);
  backdrop-filter: blur(10px);
  color: rgba(232, 237, 247, 0.92);
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.55);
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.popup-title {
  font-size: 14px;
  font-weight: 750;
  letter-spacing: 0.2px;
}

.popup-close {
  appearance: none;
  border: 0;
  background: transparent;
  color: rgba(232, 237, 247, 0.85);
  cursor: pointer;
  font-size: 14px;
  padding: 6px 8px;
  border-radius: 10px;
}

.popup-close:hover {
  background: rgba(255, 255, 255, 0.08);
}

.popup-body {
  padding: 12px 14px 14px;
}

.row {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 10px;
  padding: 6px 0;
}

.label {
  opacity: 0.65;
  font-size: 12px;
}

.value {
  font-size: 12px;
  font-weight: 650;
}

.raw {
  margin-top: 10px;
  opacity: 0.92;
}

.raw summary {
  cursor: pointer;
  font-size: 12px;
  opacity: 0.8;
}

.raw pre {
  margin: 10px 0 0;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  overflow: auto;
  font-size: 11px;
  line-height: 1.4;
}
</style>

