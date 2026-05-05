/**
 * 從 signalicon.glb 移除實心「Glowing inverted cone / top body」，只保留光環與上升環動畫網格。
 * 輸出 public/models/signalicon-rings.glb（供 MapPage 載入）。
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const IN = path.join(ROOT, "public", "models", "signalicon.glb");
const OUT = path.join(ROOT, "public", "models", "signalicon-rings.glb");

const REMOVE_NODE_NAMES = new Set(["Glowing inverted cone / top body"]);

const io = new NodeIO();
const doc = await io.read(IN);
const root = doc.getRoot();

for (const scene of root.listScenes()) {
  for (const node of [...scene.listChildren()]) {
    const name = node.getName() ?? "";
    if (REMOVE_NODE_NAMES.has(name)) {
      scene.removeChild(node);
    }
  }
}

/**
 * deck.gl LNGLAT 下位移第三軸對應「天頂」；glTF 為 Y-up，環堆疊沿 +Y。
 * 透過「預先固定到模型」的方式：繞 X +90°（四元數 [x,y,z,w]）把 +Y 對到 +Z，避免只靠 getOrientation 與 project_size 非等向縮放組合後仍橫躺。
 */
const Q_ROT_X_PLUS_90 = [
  Math.SQRT1_2,
  0,
  0,
  Math.SQRT1_2,
];

for (const scene of root.listScenes()) {
  const rig = doc.createNode("deck_map_z_up_rig");
  rig.setRotation(Q_ROT_X_PLUS_90);
  const children = [...scene.listChildren()];
  for (const child of children) {
    scene.removeChild(child);
    rig.addChild(child);
  }
  scene.addChild(rig);
}

await doc.transform(prune());
await io.write(OUT, doc);
console.log("Wrote", OUT);
