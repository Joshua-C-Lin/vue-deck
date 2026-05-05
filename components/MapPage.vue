<template>
  <div class="map-wrap">
    <!-- Mapbox 會把地圖畫在這個 DOM 節點裡。 -->
    <div ref="mapContainer" class="map"></div>
    <CountyPopup
      :open="Boolean(selectedCounty)"
      :county="selectedCounty"
      @close="handlePopupClose"
    />
  </div>
</template>

<script setup lang="ts">
import "mapbox-gl/dist/mapbox-gl.css";
import { COORDINATE_SYSTEM } from "@deck.gl/core";
import type { ScatterplotLayer } from "@deck.gl/layers";
import type { ScenegraphLayer } from "@deck.gl/mesh-layers";
import { useRuntimeConfig } from "nuxt/app";
import { onBeforeUnmount, onMounted, ref } from "vue";
import CountyPopup from "./CountyPopup.vue";

const mapContainer = ref<HTMLDivElement | null>(null);

type CountyStatus = "online" | "offline";

type CountyPoint = {
  name: string;
  position: [longitude: number, latitude: number];
  /** 即時狀態：online 用冷／青示意連線；offline 用暖色突出離線。 */
  status: CountyStatus;
};

const selectedCounty = ref<CountyPoint | null>(null);
let resetMapView: (() => void) | null = null;
const handlePopupClose = () => {
  selectedCounty.value = null;
  resetMapView?.();
};

/** 點位名稱 → GeoJSON 縣市名稱（public/data/twCounty2010.geo.json） */
function countyNameForBoundaryLayer(pointName: string) {
  // 這份 boundary 資料仍使用「桃園縣」
  if (pointName === "桃園市") return "桃園縣";
  return pointName;
}

// deck.gl 使用經緯度陣列標記位置，格式是 [longitude, latitude]。
// 這裡使用各縣市政府/市政府附近的位置，比行政區幾何中心更適合做「縣市標記」。
const countyPoints = [
  { name: "台北市", position: [121.5654, 25.0375], status: "online" },
  { name: "新北市", position: [121.4657, 25.012], status: "online" },
  { name: "桃園市", position: [121.301, 24.9937], status: "offline" },
  { name: "台中市", position: [120.6468, 24.1618], status: "online" },
  { name: "台南市", position: [120.185, 22.992], status: "offline" },
  { name: "高雄市", position: [120.3008, 22.6395], status: "online" },
  { name: "基隆市", position: [121.7444, 25.1316], status: "offline" },
  { name: "新竹市", position: [120.9686, 24.8066], status: "online" },
  { name: "新竹縣", position: [121.0129, 24.8269], status: "offline" },
  { name: "苗栗縣", position: [120.819, 24.5602], status: "online" },
  { name: "彰化縣", position: [120.544, 24.0756], status: "online" },
  { name: "南投縣", position: [120.684, 23.9609], status: "online" },
  { name: "雲林縣", position: [120.5276, 23.7092], status: "online" },
  { name: "嘉義市", position: [120.4491, 23.4801], status: "online" },
  { name: "嘉義縣", position: [120.294, 23.459], status: "offline" },
  { name: "屏東縣", position: [120.488, 22.6698], status: "online" },
  { name: "宜蘭縣", position: [121.753, 24.7597], status: "online" },
  { name: "花蓮縣", position: [121.6015, 23.9911], status: "offline" },
  { name: "台東縣", position: [121.1504, 22.7554], status: "online" },
  { name: "澎湖縣", position: [119.5664, 23.569], status: "online" },
  { name: "金門縣", position: [118.3186, 24.4368], status: "offline" },
  { name: "連江縣", position: [119.9499, 26.1602], status: "offline" },
] satisfies CountyPoint[];

// TextLayer 預設字元集偏向英數字；把縣市名稱用到的中文字明確交給 deck.gl，才不會出現 Missing character。
const countyLabelCharacters = Array.from(
  new Set(countyPoints.map((county) => county.name).join("")),
);

/** 常用參數集中在這裡，方便微調。 */
const PIN_TUNING = {
  /** 標記在畫面上可讀的柱狀高度（公尺）。 */
  targetHeightMeters: 3_000,
  /** 額外縮放倍率（想「再大一點點」就調這個）。 */
  scaleMultiplier: 2,
  /**
   * signalicon-rings.glb：已刪除實心圓錐節點，僅光環／上升環；場景內節點 Y 約 −0.68～0.62，
   * 加網格厚度後視覺跨度約 1.38 glTF 單位（動畫平移亦在此範圍內）。
   */
  modelYExtent: 1.38,
  glbUrl: "/models/signalicon-rings.glb",
  /** 直立軸已在 signalicon-rings.glb 用 `deck_map_z_up_rig` 預先固定；此處通常保持單位旋轉。 */
  orientation: [180, 0, 0] as [number, number, number],
  breathe: {
    /** 正弦呼吸週期速度；數值越大閃爍越快。 */
    speedHz: 0.28,
    /** 標記縮放呼吸幅度（0.09 表示 0.91～1.00）。 */
    scaleAmp: 0.09,
    scaleBase: 0.91,
  },
  glow: {
    radiusBaseMeters: 2_000,
    radiusBreathMeters: 420,
  },
  mapFocus: {
    /** 點擊縣市後 zoom in 到此層級 */
    zoom: 8.5,
    /** 動畫時間（ms） */
    flyDurationMs: 900,
  },
  countyHighlight: {
    /** 面積覆蓋呼吸亮度（0~1），與 signalicon 同步 */
    fillOpacityBase: 0.08,
    fillOpacityBreath: 0.14,
    lineOpacityBase: 0.25,
    lineOpacityBreath: 0.5,
    lineWidth: 2,
  },
  colors: {
    online: {
      /** 偏藍（呼吸時往更亮的藍青提亮） */
      rgbBase: [20, 105, 255] as [number, number, number],
      rgbBreath: [55, 85, 0] as [number, number, number],
    },
    offline: {
      /** 桃紅（呼吸時往粉紫方向提亮） */
      rgbBase: [255, 25, 110] as [number, number, number],
      rgbBreath: [0, 55, 55] as [number, number, number],
    },
    pinAlphaBase: 210,
    pinAlphaBreath: 45,
    glowAlphaBase: 22,
    glowAlphaBreath: 58,
  },
} as const;

const PIN_TARGET_HEIGHT_METERS = PIN_TUNING.targetHeightMeters;
const PIN_MODEL_Y_EXTENT = PIN_TUNING.modelYExtent;
const PIN_GLTF_URL = PIN_TUNING.glbUrl;

const PIN_GLTF_UNIFORM_SCALE =
  (PIN_TARGET_HEIGHT_METERS / PIN_MODEL_Y_EXTENT) * PIN_TUNING.scaleMultiplier;
const PIN_GLTF_SCALE: [number, number, number] = [
  PIN_GLTF_UNIFORM_SCALE,
  PIN_GLTF_UNIFORM_SCALE,
  PIN_GLTF_UNIFORM_SCALE,
];

const PIN_GLTF_ORIENTATION: [number, number, number] = [
  ...PIN_TUNING.orientation,
];

/** 地面光暈半徑（公尺）；數值愈小光斑愈緊。 */
const GROUND_GLOW_RADIUS_BASE = PIN_TUNING.glow.radiusBaseMeters;
const GROUND_GLOW_RADIUS_BREATH = PIN_TUNING.glow.radiusBreathMeters;

/**
 * ScenegraphLayer `flat`：無 baseColor 貼圖時 `fragColor = vColor`，顏色完全由 `status` 與呼吸係數決定。
 */
function countyPinColors(
  status: CountyStatus,
  brighten: number,
): [number, number, number, number] {
  const palette =
    status === "online" ? PIN_TUNING.colors.online : PIN_TUNING.colors.offline;
  const a = Math.floor(
    PIN_TUNING.colors.pinAlphaBase +
      PIN_TUNING.colors.pinAlphaBreath * brighten,
  );
  return [
    Math.floor(palette.rgbBase[0] + palette.rgbBreath[0] * brighten),
    Math.floor(palette.rgbBase[1] + palette.rgbBreath[1] * brighten),
    Math.floor(palette.rgbBase[2] + palette.rgbBreath[2] * brighten),
    a,
  ];
}

/** 地面加光：與標記同色（RGB 同源），僅降低 alpha 讓 additive 不過曝。 */
function countyGroundGlowColors(
  status: CountyStatus,
  brighten: number,
): [number, number, number, number] {
  const [r, g, b] = countyPinColors(status, brighten);
  const a = Math.floor(
    PIN_TUNING.colors.glowAlphaBase +
      PIN_TUNING.colors.glowAlphaBreath * brighten,
  );
  return [r, g, b, a];
}

/** 半透明、加色系混合的地面光暈（近似示意圖中「打在地面上的色光」，非 GPU bloom）。 */
const groundGlowParameters = {
  blend: true,
  blendColorOperation: "add" as const,
  blendAlphaOperation: "add" as const,
  blendColorSrcFactor: "src-alpha" as const,
  blendColorDstFactor: "one" as const,
  blendAlphaSrcFactor: "one" as const,
  blendAlphaDstFactor: "one" as const,
  depthWriteEnabled: false,
  depthCompare: "always" as const,
};

let cleanupMap: (() => void) | undefined;

onMounted(async () => {
  // Nuxt 會先在伺服器端渲染頁面，Mapbox 需要瀏覽器 DOM，所以放在 onMounted。
  if (!mapContainer.value) return;

  const config = useRuntimeConfig();

  // 動態 import 可以避免 Mapbox 在 SSR 階段讀取 window/document。
  const mapboxgl = await import("mapbox-gl");
  const { MapboxOverlay } = await import("@deck.gl/mapbox");
  const { ScatterplotLayer, TextLayer } = await import("@deck.gl/layers");
  const { ScenegraphLayer } = await import("@deck.gl/mesh-layers");

  type MapboxOverlayClass = (typeof import("@deck.gl/mapbox"))["MapboxOverlay"];

  const mapboxToken = config.public.mapboxToken;

  // runtimeConfig.public 的型別可能是 unknown，這裡先確認 token 是有效字串。
  if (typeof mapboxToken !== "string" || !mapboxToken) return;

  mapboxgl.default.accessToken = mapboxToken;

  /** Mapbox 官方 DEM + terrain；需在 style load 後加入 source，否則樣式尚未就緒。 */
  function setupTerrain(m: InstanceType<(typeof mapboxgl)["default"]["Map"]>) {
    const demId = "mapbox-dem";
    if (m.getSource(demId)) return;
    m.addSource(demId, {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
    m.setTerrain({
      source: demId,
      exaggeration: 5.0,
    });
  }

  // 建立 Mapbox 底圖；dark-v11 暗色；pitch/bearing 維持 3D 視角。
  const INITIAL_VIEW = {
    center: [120.9605, 23.6978] as [number, number],
    zoom: 7.5,
    pitch: 55,
    bearing: -25,
  } as const;

  const map = new mapboxgl.default.Map({
    container: mapContainer.value,
    style: "mapbox://styles/mapbox/dark-v11",
    projection: "mercator",
    center: INITIAL_VIEW.center,
    zoom: INITIAL_VIEW.zoom,
    pitch: INITIAL_VIEW.pitch,
    bearing: INITIAL_VIEW.bearing,
    antialias: true,
  });

  // 加上右上角的縮放與 3D 旋轉控制，可以用滑鼠拖曳或按鈕調整 pitch/bearing。
  map.addControl(
    new mapboxgl.default.NavigationControl({ visualizePitch: true }),
  );

  let overlay: InstanceType<MapboxOverlayClass> | undefined;
  let breathRafId: number = 0;
  let countyHighlightReady = false;
  const COUNTY_SOURCE_ID = "tw-counties";
  const COUNTY_FILL_LAYER_ID = "tw-county-highlight-fill";
  const COUNTY_LINE_LAYER_ID = "tw-county-highlight-line";

  resetMapView = () => {
    map.flyTo({
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
      duration: PIN_TUNING.mapFocus.flyDurationMs,
      essential: true,
    });
  };

  const focusCounty = (county: CountyPoint) => {
    map.flyTo({
      center: county.position,
      zoom: PIN_TUNING.mapFocus.zoom,
      duration: PIN_TUNING.mapFocus.flyDurationMs,
      essential: true,
    });
  };

  const countyLayerFilter = (countyName: string) => [
    "==",
    ["get", "name"],
    countyName,
  ];

  const setCountyHighlight = (county: CountyPoint | null, brighten: number) => {
    if (!countyHighlightReady) return;

    if (!county) {
      map.setFilter(COUNTY_FILL_LAYER_ID, ["==", ["get", "name"], ""]);
      map.setFilter(COUNTY_LINE_LAYER_ID, ["==", ["get", "name"], ""]);
      return;
    }

    const boundaryName = countyNameForBoundaryLayer(county.name);
    const [r, g, b] = countyPinColors(county.status, brighten);
    map.setFilter(COUNTY_FILL_LAYER_ID, countyLayerFilter(boundaryName));
    map.setFilter(COUNTY_LINE_LAYER_ID, countyLayerFilter(boundaryName));

    map.setPaintProperty(
      COUNTY_FILL_LAYER_ID,
      "fill-color",
      `rgb(${r},${g},${b})`,
    );
    map.setPaintProperty(
      COUNTY_LINE_LAYER_ID,
      "line-color",
      `rgb(${r},${g},${b})`,
    );
    map.setPaintProperty(
      COUNTY_FILL_LAYER_ID,
      "fill-opacity",
      PIN_TUNING.countyHighlight.fillOpacityBase +
        PIN_TUNING.countyHighlight.fillOpacityBreath * brighten,
    );
    map.setPaintProperty(
      COUNTY_LINE_LAYER_ID,
      "line-opacity",
      PIN_TUNING.countyHighlight.lineOpacityBase +
        PIN_TUNING.countyHighlight.lineOpacityBreath * brighten,
    );
  };

  const mountDeckOverlay = () => {
    overlay?.finalize();
    if (breathRafId !== 0) {
      cancelAnimationFrame(breathRafId);
      breathRafId = 0;
    }

    // 地面上的一層發光底板：additive 合成，與標記同色呼吸動畫。
    const groundLayer = new ScatterplotLayer<CountyPoint>({
      id: "taiwan-county-ground-glow",
      data: countyPoints,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      getPosition: (county) => [...county.position, 0],
      radiusUnits: "meters",
      getRadius: GROUND_GLOW_RADIUS_BASE + GROUND_GLOW_RADIUS_BREATH * 0.5,
      stroked: false,
      filled: true,
      billboard: false,
      getFillColor: (county) => countyGroundGlowColors(county.status, 0.5),
      parameters: groundGlowParameters,
    });

    const pinsLayer = new ScenegraphLayer<CountyPoint>({
      id: "taiwan-county-pins",
      data: countyPoints,
      scenegraph: PIN_GLTF_URL,
      coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
      getPosition: (county) => [...county.position, 0],
      getScale: [...PIN_GLTF_SCALE],
      getOrientation: [...PIN_GLTF_ORIENTATION],
      // 初始色；動畫時由 breatheLoop 以同參數覆寫 getColor（與地面光暈同步呼吸）
      getColor: (county) => countyPinColors(county.status, 0.5),
      /** flat：乘色完全由 getColor 決定，offline/online 與底部光暈一致。 */
      _lighting: "flat",
      /** GLB 內建「Bottom-to-top glowing ring pulse」等片段；配合 MapboxOverlay `_animate` 驅動 timeline。 */
      _animations: {
        "*": { playing: true, speed: 1 },
      },
      parameters: {
        depthWriteEnabled: false,
        blend: true,
        /** GLB 多為單面材質；翻轉 180 度時避免被背面剔除而「消失」。 */
        cullMode: "none",
      },
      pickable: true,
    });

    const labelsLayer = new TextLayer<CountyPoint>({
      id: "taiwan-county-labels",
      data: countyPoints,
      getPosition: (county) => [
        county.position[0],
        county.position[1],
        PIN_TARGET_HEIGHT_METERS,
      ],
      getText: (county) => county.name,
      getSize: 14,
      // 暗色底圖上使用淺字 + 深色描邊
      getColor: [230, 235, 245, 255],
      outlineWidth: 4,
      outlineColor: [15, 18, 28, 220],
      getPixelOffset: [0, -18],
      characterSet: countyLabelCharacters,
      fontFamily:
        '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif',
      // billboard: true（預設行為）：文字面朝螢幕，3D 傾斜/旋轉時仍保持可讀。
      billboard: true,
    });

    let groundRenderable: ScatterplotLayer<CountyPoint> = groundLayer;
    let pinsRenderable: ScenegraphLayer<CountyPoint> = pinsLayer;

    const breatheLoop = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        if (!overlay) return;

        const t = (now - t0) * 0.001;
        /** 約 3.6 秒一整個呼吸周期 */
        const brighten =
          Math.sin(t * Math.PI * 2 * PIN_TUNING.breathe.speedHz) * 0.5 + 0.5;
        /** 細微縮放讓標記有感「鼓起」而非只有透明度變 */
        const scaleBreath =
          PIN_TUNING.breathe.scaleBase + brighten * PIN_TUNING.breathe.scaleAmp;

        pinsRenderable = pinsRenderable.clone({
          getColor: (county) => countyPinColors(county.status, brighten),
          getScale: [
            PIN_GLTF_SCALE[0] * scaleBreath,
            PIN_GLTF_SCALE[1] * scaleBreath,
            PIN_GLTF_SCALE[2] * scaleBreath,
          ],
        });

        groundRenderable = groundRenderable.clone({
          getFillColor: (county) =>
            countyGroundGlowColors(county.status, brighten),
          getRadius:
            GROUND_GLOW_RADIUS_BASE + brighten * GROUND_GLOW_RADIUS_BREATH,
        });

        setCountyHighlight(selectedCounty.value, brighten);

        overlay.setProps({
          layers: [groundRenderable, pinsRenderable, labelsLayer],
        });

        breathRafId = requestAnimationFrame(tick);
      };

      breathRafId = requestAnimationFrame(tick);
    };

    // MapboxOverlay 讓 deck.gl 圖層疊加到 Mapbox 之上。
    // interleaved: false 時會額外加一張 deck.gl canvas。
    //
    // 注意：過去在某些排版條件下（父層文字置中等），這張 overlay 會偏移；官方 workaround 是固定 left/top。
    overlay = new MapboxOverlay({
      interleaved: false,
      /** 持續驅動 deck timeline，ScenegraphLayer 才能把 glTF 動畫與時間同步更新。 */
      _animate: true,
      style: {
        position: "absolute",
        inset: "0",
        pointerEvents: "none",
      },
      layers: [groundLayer, pinsLayer, labelsLayer],
    });

    map.addControl(overlay);
    breatheLoop();
  };

  // Style 載入後先掛 terrain，再建立 deck overlay（避免 overlay 與底圖尺寸不同步）。
  const onMapReady = async () => {
    setupTerrain(map);

    // 縣市邊界（面積覆蓋呼吸）資料：public/data/twCounty2010.geo.json
    if (!map.getSource(COUNTY_SOURCE_ID)) {
      const res = await fetch("/data/twCounty2010.geo.json");
      const geojson = await res.json();
      map.addSource(COUNTY_SOURCE_ID, {
        type: "geojson",
        data: geojson,
      });

      map.addLayer({
        id: COUNTY_FILL_LAYER_ID,
        type: "fill",
        source: COUNTY_SOURCE_ID,
        paint: {
          "fill-color": "rgb(0,0,0)",
          "fill-opacity": 0,
        },
        filter: ["==", ["get", "name"], ""],
      });

      map.addLayer({
        id: COUNTY_LINE_LAYER_ID,
        type: "line",
        source: COUNTY_SOURCE_ID,
        paint: {
          "line-color": "rgb(0,0,0)",
          "line-opacity": 0,
          "line-width": PIN_TUNING.countyHighlight.lineWidth,
        },
        filter: ["==", ["get", "name"], ""],
      });

      countyHighlightReady = true;
    }

    mountDeckOverlay();
  };

  if (map.loaded()) {
    onMapReady();
  } else {
    map.once("load", onMapReady);
  }

  map.on("styledata", () => {
    if (!overlay) return;
    map.resize();
  });

  map.on("resize", () => {
    overlay?.setProps({});
  });

  map.on("click", (e) => {
    if (!overlay) return;

    const picked = overlay.pickObject({
      x: e.point.x,
      y: e.point.y,
      radius: 6,
      layerIds: ["taiwan-county-pins"],
    });

    if (!picked || !picked.object) {
      // 不要在點空白時自動關閉：避免彈窗開啟時使用者想拖曳/縮放地圖卻被誤判為關閉。
      return;
    }

    const county = picked.object as CountyPoint;
    selectedCounty.value = county;
    focusCounty(county);
  });

  // 元件離開頁面時清掉地圖與 deck.gl overlay，避免重複建立造成記憶體外漏。
  cleanupMap = () => {
    if (breathRafId !== 0) {
      cancelAnimationFrame(breathRafId);
      breathRafId = 0;
    }
    selectedCounty.value = null;
    setCountyHighlight(null, 0);
    overlay?.finalize();
    overlay = undefined;
    map.remove();
  };
});

onBeforeUnmount(() => {
  cleanupMap?.();
});
</script>

<style scoped>
.map-wrap {
  width: 100vw;
  height: 100vh;
}

.map {
  width: 100%;
  height: 100%;
}
</style>
