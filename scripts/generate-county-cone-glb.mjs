/**
 * 尖端在原點、沿 +Z 伸長的一單位圓錐 glb（底座平面 z= HEIGHT、XY 上半徑 0.5）。
 * LNGLAT 下 deck.gl 對齊為：模型 X→東、Y→北、Z→天頂 → 錐軸對齊「立起來」。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Document, NodeIO } from "@gltf-transform/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "models");
const OUT_FILE = path.join(OUT_DIR, "county-cone.glb");

const HEIGHT = 1;
const BASE_RADIUS = 0.5;
const RADIAL = 32;

function buildConeAttributes() {
  const positions = [];
  const normals = [];
  const indices = [];

  positions.push(0, 0, 0);

  /** 側面外向法線近似：對稱過 z 軸，傾斜向上 */
  const hyp = Math.hypot(BASE_RADIUS, HEIGHT);
  const axialN = HEIGHT / hyp;
  const radialN = BASE_RADIUS / hyp;
  normals.push(0, 0, 1);

  for (let i = 0; i < RADIAL; i += 1) {
    const u = (i / RADIAL) * Math.PI * 2;
    const x = Math.cos(u) * BASE_RADIUS;
    const y = Math.sin(u) * BASE_RADIUS;
    positions.push(x, y, HEIGHT);
    const rx = Math.cos(u);
    const ry = Math.sin(u);
    normals.push(rx * radialN, ry * radialN, axialN);
    if (i < RADIAL - 1) {
      indices.push(0, i + 1, i + 2);
    } else {
      indices.push(0, RADIAL, 1);
    }
  }

  const baseCenter = positions.length / 3;
  positions.push(0, 0, HEIGHT);
  normals.push(0, 0, 1);

  const ring0 = 1;
  for (let i = 0; i < RADIAL - 1; i += 1) {
    indices.push(baseCenter, ring0 + i + 1, ring0 + i);
  }
  indices.push(baseCenter, ring0, ring0 + RADIAL - 1);

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

const doc = new Document();
const buffer = doc.createBuffer();
const mesh = doc.createMesh("countyCone");
const prim = doc.createPrimitive();

const { positions, normals, indices } = buildConeAttributes();

const posAcc = doc
  .createAccessor("POSITION")
  .setArray(positions)
  .setType("VEC3")
  .setBuffer(buffer);

const nrmAcc = doc
  .createAccessor("NORMAL")
  .setArray(normals)
  .setType("VEC3")
  .setBuffer(buffer);

const idxAcc = doc
  .createAccessor("INDEX")
  .setArray(indices)
  .setType("SCALAR")
  .setBuffer(buffer);

prim.setAttribute("POSITION", posAcc);
prim.setAttribute("NORMAL", nrmAcc);
prim.setIndices(idxAcc);

const material = doc.createMaterial("coneMat");
/** 白底讓 deck.gl ScenegraphLayer 的 getColor（乘色）主導外觀，呼吸變色才明顯 */
material
  .setBaseColorFactor([1, 1, 1, 1])
  .setMetallicFactor(0.15)
  .setRoughnessFactor(0.42);

prim.setMaterial(material);
mesh.addPrimitive(prim);

const node = doc.createNode("coneNode").setMesh(mesh);
let scene = doc.getRoot().listScenes()[0];
if (!scene) {
  scene = doc.createScene("Default");
}
scene.addChild(node);

fs.mkdirSync(OUT_DIR, { recursive: true });
const io = new NodeIO();
await io.write(OUT_FILE, doc);
console.log("Wrote", path.relative(ROOT, OUT_FILE));
