import * as THREE from "./vendor/three.module.min.js";

const canvas = document.querySelector("#world");
const intro = document.querySelector("#intro");
const finale = document.querySelector("#finale");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const playAgainButton = document.querySelector("#playAgainButton");
const scoreEl = document.querySelector("#score");
const messageText = document.querySelector("#messageText");

const messages = [
  "A moon cake crumb for the girl who makes ordinary days taste like a celebration.",
  "A velvet ribbon for every soft, brave thing I love about you.",
  "A star bell for the next year of adventures I hope I get to share with you."
];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060810);
scene.fog = new THREE.FogExp2(0x070a12, 0.038);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 130);
camera.position.set(8, 7.5, 11);

const clock = new THREE.Clock();
const keys = new Set();
const touchMoves = new Set();
const velocity = new THREE.Vector3();
const tempVec = new THREE.Vector3();

let started = false;
let collected = 0;
let cameraYaw = -0.08;
let isDragging = false;
let previousPointerX = 0;
let walkTime = 0;
let cat;
let catParts = {};

window.catAdventureStatus = () => ({
  started,
  collected,
  cat: {
    x: Number(cat?.position.x.toFixed(2) || 0),
    z: Number(cat?.position.z.toFixed(2) || 0)
  }
});

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x203b31, roughness: 0.9, metalness: 0.02 }),
  grassLight: new THREE.MeshStandardMaterial({ color: 0x386450, roughness: 0.88 }),
  islandSide: new THREE.MeshStandardMaterial({ color: 0x16251f, roughness: 0.95 }),
  path: new THREE.MeshStandardMaterial({ color: 0x7b6655, roughness: 0.86 }),
  pathEdge: new THREE.MeshStandardMaterial({ color: 0xd3b889, roughness: 0.78 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xfff1d3, roughness: 0.66 }),
  toast: new THREE.MeshStandardMaterial({ color: 0x76523e, roughness: 0.74 }),
  deepToast: new THREE.MeshStandardMaterial({ color: 0x31201b, roughness: 0.82 }),
  fluff: new THREE.MeshStandardMaterial({ color: 0xfff8e9, roughness: 0.85 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x86d7ff, emissive: 0x082436, roughness: 0.35 }),
  black: new THREE.MeshStandardMaterial({ color: 0x08090d, roughness: 0.72 }),
  rose: new THREE.MeshStandardMaterial({ color: 0xf18aa1, roughness: 0.52 }),
  roseGlow: new THREE.MeshStandardMaterial({ color: 0xf18aa1, emissive: 0x5e1425, roughness: 0.46 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf6cf7f, emissive: 0x4a2e07, roughness: 0.38 }),
  mint: new THREE.MeshStandardMaterial({ color: 0x98d9ae, roughness: 0.72 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x8bc0ff, emissive: 0x061b3b, roughness: 0.48 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x704831, roughness: 0.82 }),
  whiteBasic: new THREE.MeshBasicMaterial({ color: 0xfff2cf }),
  spark: new THREE.MeshBasicMaterial({ color: 0xffdfa0, transparent: true, opacity: 0.95 })
};

const world = new THREE.Group();
scene.add(world);

const hemi = new THREE.HemisphereLight(0xf2f5ff, 0x1a241f, 1.85);
scene.add(hemi);

const moon = new THREE.DirectionalLight(0xdce8ff, 2.8);
moon.position.set(-9, 14, 8);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 42;
moon.shadow.camera.left = -18;
moon.shadow.camera.right = 18;
moon.shadow.camera.top = 18;
moon.shadow.camera.bottom = -18;
scene.add(moon);

const warm = new THREE.PointLight(0xf7c277, 30, 18);
warm.position.set(0, 4.8, 0.5);
scene.add(warm);

const rim = new THREE.PointLight(0x8bbcff, 16, 22);
rim.position.set(6, 4, -8);
scene.add(rim);

function mesh(geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function cylinderBetween(start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const midpoint = start.clone().addScaledVector(direction, 0.5);
  const item = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), material, [midpoint.x, midpoint.y, midpoint.z]);
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return item;
}

const trail = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-5.8, 0.08, 4.6),
  new THREE.Vector3(-4.8, 0.08, 1.15),
  new THREE.Vector3(-1.2, 0.08, -1.2),
  new THREE.Vector3(4.6, 0.08, -3.1),
  new THREE.Vector3(6.0, 0.08, 0.6),
  new THREE.Vector3(3.7, 0.08, 4.3),
  new THREE.Vector3(0.3, 0.08, 5.4)
]);

function makeIsland() {
  const base = mesh(new THREE.CylinderGeometry(10.8, 11.7, 1.2, 96), materials.islandSide, [0, -0.62, 0]);
  const top = mesh(new THREE.CylinderGeometry(10.5, 10.9, 0.38, 96), materials.grass, [0, -0.08, 0]);
  world.add(base, top);

  const points = trail.getPoints(80);
  points.forEach((point, index) => {
    const t = index / (points.length - 1);
    const tangent = trail.getTangent(t);
    const stone = mesh(
      new THREE.CapsuleGeometry(0.48 + Math.sin(index * 0.4) * 0.05, 0.58, 6, 14),
      index % 6 === 0 ? materials.pathEdge : materials.path,
      [point.x, 0.12 + Math.sin(index * 0.7) * 0.012, point.z],
      [1.55, 0.1, 0.82]
    );
    stone.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI / 2;
    world.add(stone);
  });

  [
    [4.9, -3.1, 1.35],
    [3.7, 4.3, 1.2],
    [-4.8, 1.15, 1.0],
    [0.2, 5.45, 1.55]
  ].forEach(([x, z, s]) => {
    const pad = mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.16, 40), materials.grassLight, [x, 0.09, z], [s, 1, s]);
    world.add(pad);
  });

  for (let i = 0; i < 46; i += 1) {
    const angle = i * 0.47;
    const radius = 8.15 + Math.sin(i * 1.7) * 1.05;
    const flower = mesh(
      new THREE.SphereGeometry(0.13 + (i % 4) * 0.025, 12, 8),
      i % 3 === 0 ? materials.rose : i % 3 === 1 ? materials.mint : materials.gold,
      [Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius],
      [1, 0.72, 1]
    );
    world.add(flower);
  }
}

function makeTree(x, z, s = 1) {
  const tree = new THREE.Group();
  tree.add(mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.65, 10), materials.wood, [0, 0.76, 0], [s, s, s]));
  tree.add(mesh(new THREE.ConeGeometry(0.9, 1.55, 12), materials.mint, [0, 1.75, 0], [s, s, s]));
  tree.add(mesh(new THREE.ConeGeometry(0.72, 1.2, 12), materials.grassLight, [0, 2.35, 0], [s, s, s]));
  tree.position.set(x, 0, z);
  tree.rotation.y = Math.sin(x * 13.4 + z) * 0.3;
  world.add(tree);
}

function makeLantern(x, z, height = 1.55) {
  const lantern = new THREE.Group();
  lantern.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, height, 8), materials.wood, [0, height / 2, 0]));
  lantern.add(mesh(new THREE.SphereGeometry(0.23, 20, 14), materials.gold, [0, height + 0.08, 0]));
  lantern.add(mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 20), materials.rose, [0, height + 0.08, 0]));
  const light = new THREE.PointLight(0xf4ca73, 5.5, 5.5);
  light.position.set(0, height + 0.08, 0);
  lantern.add(light);
  lantern.position.set(x, 0, z);
  world.add(lantern);
}

function makeBalloonCluster(x, z, colors = [materials.rose, materials.gold, materials.blue]) {
  const cluster = new THREE.Group();
  colors.forEach((mat, index) => {
    const bx = (index - 1) * 0.34;
    const by = 1.75 + Math.sin(index) * 0.18;
    cluster.add(cylinderBetween(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(bx, by - 0.28, 0), 0.01, materials.cream));
    cluster.add(mesh(new THREE.SphereGeometry(0.28, 20, 14), mat, [bx, by, 0], [0.88, 1.18, 0.88]));
  });
  cluster.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 8), materials.wood, [0, 0.38, 0]));
  cluster.position.set(x, 0, z);
  cluster.rotation.y = Math.atan2(-x, -z);
  world.add(cluster);
}

function makeRibbonArch(x, z, rotation = 0) {
  const arch = new THREE.Group();
  const left = new THREE.Vector3(-0.85, 0, 0);
  const right = new THREE.Vector3(0.85, 0, 0);
  arch.add(mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.8, 12), materials.gold, [left.x, 0.9, 0]));
  arch.add(mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.8, 12), materials.gold, [right.x, 0.9, 0]));
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.85, 1.75, 0),
    new THREE.Vector3(-0.35, 2.25, 0),
    new THREE.Vector3(0.35, 2.25, 0),
    new THREE.Vector3(0.85, 1.75, 0)
  ]);
  const tube = mesh(new THREE.TubeGeometry(curve, 28, 0.075, 10), materials.roseGlow);
  arch.add(tube);
  arch.add(mesh(new THREE.BoxGeometry(0.42, 0.25, 0.08), materials.roseGlow, [-0.18, 2.05, 0.02], [1, 0.7, 1]));
  arch.add(mesh(new THREE.BoxGeometry(0.42, 0.25, 0.08), materials.roseGlow, [0.18, 2.05, 0.02], [1, 0.7, 1]));
  arch.position.set(x, 0, z);
  arch.rotation.y = rotation;
  world.add(arch);
}

function makeCakeTable(x, z) {
  const table = new THREE.Group();
  table.add(mesh(new THREE.CylinderGeometry(0.86, 0.95, 0.18, 32), materials.wood, [0, 0.62, 0]));
  table.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.62, 10), materials.wood, [0, 0.31, 0]));
  table.add(mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.3, 32), materials.cream, [0, 0.88, 0]));
  table.add(mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.25, 32), materials.rose, [0, 1.15, 0]));
  table.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.35, 8), materials.gold, [-0.16, 1.43, 0]));
  table.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.35, 8), materials.gold, [0.16, 1.43, 0]));
  table.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), materials.gold, [-0.16, 1.64, 0]));
  table.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), materials.gold, [0.16, 1.64, 0]));
  table.position.set(x, 0, z);
  world.add(table);
}

function makeGift(x, z, mat, scale = 1) {
  const gift = new THREE.Group();
  gift.add(mesh(new THREE.BoxGeometry(0.72, 0.58, 0.72), mat, [0, 0.32, 0], [scale, scale, scale]));
  gift.add(mesh(new THREE.BoxGeometry(0.12, 0.63, 0.78), materials.gold, [0, 0.34, 0], [scale, scale, scale]));
  gift.add(mesh(new THREE.BoxGeometry(0.78, 0.64, 0.12), materials.gold, [0, 0.35, 0], [scale, scale, scale]));
  gift.add(mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 18), materials.gold, [-0.18 * scale, 0.68 * scale, 0], [scale, scale, scale]));
  gift.add(mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 18), materials.gold, [0.18 * scale, 0.68 * scale, 0], [scale, scale, scale]));
  gift.position.set(x, 0, z);
  gift.rotation.y = Math.sin(x + z) * 1.4;
  world.add(gift);
}

function makeTrailSign(x, z, mat = materials.rose) {
  const sign = new THREE.Group();
  sign.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 8), materials.wood, [0, 0.45, 0]));
  sign.add(mesh(new THREE.BoxGeometry(1.1, 0.43, 0.08), materials.cream, [0, 0.92, 0]));
  sign.add(mesh(new THREE.BoxGeometry(0.72, 0.08, 0.1), mat, [0, 0.99, 0.055]));
  sign.add(mesh(new THREE.BoxGeometry(0.42, 0.06, 0.1), materials.gold, [0.12, 0.84, 0.055]));
  sign.position.set(x, 0, z);
  sign.rotation.y = Math.atan2(-x, -z);
  world.add(sign);
}

function addPawPrints() {
  const pawMat = new THREE.MeshStandardMaterial({ color: 0xf7dfb2, roughness: 0.9 });
  const points = trail.getPoints(24);
  points.forEach((point, index) => {
    if (index < 2 || index % 2 === 0) return;
    const tangent = trail.getTangent(index / (points.length - 1));
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(index % 4 === 1 ? 0.24 : -0.24);
    const paw = new THREE.Group();
    paw.add(mesh(new THREE.SphereGeometry(0.105, 10, 8), pawMat, [0, 0.084, 0], [1.2, 0.18, 1]));
    paw.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), pawMat, [-0.1, 0.103, 0.12], [1, 0.18, 1]));
    paw.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), pawMat, [0, 0.103, 0.16], [1, 0.18, 1]));
    paw.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), pawMat, [0.1, 0.103, 0.12], [1, 0.18, 1]));
    paw.position.copy(point).add(side);
    paw.rotation.y = Math.atan2(tangent.x, tangent.z);
    world.add(paw);
  });
}

function makeCat() {
  const group = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.66, 32, 20), materials.fluff, [0, 0.7, 0], [1.62, 0.88, 1.05]);
  const chest = mesh(new THREE.SphereGeometry(0.38, 22, 14), materials.cream, [0, 0.72, 0.58], [1.06, 1.05, 0.45]);
  const ruff = new THREE.Group();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    ruff.add(mesh(
      new THREE.SphereGeometry(0.115, 12, 8),
      materials.fluff,
      [Math.cos(angle) * 0.44, 1.0 + Math.sin(angle) * 0.08, 0.36 + Math.sin(angle) * 0.18],
      [1.15, 0.82, 0.82]
    ));
  }
  const head = mesh(new THREE.SphereGeometry(0.48, 32, 20), materials.fluff, [0, 1.24, 0.58], [1.1, 0.96, 1.04]);
  const faceMask = mesh(new THREE.SphereGeometry(0.3, 22, 14), materials.toast, [0, 1.17, 0.92], [1.08, 0.76, 0.34]);
  const muzzle = mesh(new THREE.SphereGeometry(0.16, 16, 10), materials.cream, [0, 1.08, 1.08], [1.35, 0.74, 0.58]);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(-0.78, 0.78, -0.44);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.24, 0.52, -0.2),
    new THREE.Vector3(-0.22, 1.0, -0.56),
    new THREE.Vector3(0.08, 1.22, -0.72)
  ]);
  tailPivot.add(mesh(new THREE.TubeGeometry(tailCurve, 30, 0.16, 14), materials.toast));
  tailPivot.add(mesh(new THREE.SphereGeometry(0.22, 18, 12), materials.deepToast, [0.08, 1.22, -0.72], [0.9, 1.25, 0.9]));

  const earGeo = new THREE.ConeGeometry(0.2, 0.38, 3);
  const leftEar = mesh(earGeo, materials.deepToast, [-0.3, 1.59, 0.58]);
  const rightEar = mesh(earGeo, materials.deepToast, [0.3, 1.59, 0.58]);
  leftEar.rotation.y = Math.PI / 3;
  rightEar.rotation.y = Math.PI / 3;

  const leftEye = mesh(new THREE.SphereGeometry(0.054, 14, 10), materials.eye, [-0.15, 1.22, 0.98]);
  const rightEye = mesh(new THREE.SphereGeometry(0.054, 14, 10), materials.eye, [0.15, 1.22, 0.98]);
  const nose = mesh(new THREE.SphereGeometry(0.043, 12, 8), materials.rose, [0, 1.105, 1.105], [1.2, 0.8, 0.7]);
  const scarf = mesh(new THREE.TorusGeometry(0.38, 0.045, 8, 32), materials.roseGlow, [0, 0.99, 0.36]);
  scarf.rotation.x = Math.PI / 2;

  const whiskerPoints = [
    [[-0.08, 1.1, 1.1], [-0.46, 1.17, 1.18]],
    [[-0.08, 1.07, 1.1], [-0.48, 1.02, 1.2]],
    [[0.08, 1.1, 1.1], [0.46, 1.17, 1.18]],
    [[0.08, 1.07, 1.1], [0.48, 1.02, 1.2]]
  ];
  const whiskers = whiskerPoints.map(([a, b]) => cylinderBetween(new THREE.Vector3(...a), new THREE.Vector3(...b), 0.008, materials.cream));

  const legGeo = new THREE.SphereGeometry(0.16, 18, 12);
  const legs = [
    [-0.43, 0.3, 0.4],
    [0.43, 0.3, 0.4],
    [-0.5, 0.3, -0.34],
    [0.5, 0.3, -0.34]
  ].map(([x, y, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, y, z);
    leg.add(mesh(legGeo, materials.toast, [0, 0, 0], [0.9, 1.38, 0.9]));
    leg.add(mesh(new THREE.SphereGeometry(0.17, 16, 10), materials.deepToast, [0, -0.23, 0.09], [1.25, 0.48, 1.5]));
    return leg;
  });

  const bowLeft = mesh(new THREE.BoxGeometry(0.26, 0.15, 0.08), materials.gold, [-0.12, 0.95, 0.79]);
  const bowRight = mesh(new THREE.BoxGeometry(0.26, 0.15, 0.08), materials.gold, [0.12, 0.95, 0.79]);
  bowLeft.rotation.z = Math.PI / 4;
  bowRight.rotation.z = -Math.PI / 4;

  group.add(body, chest, ruff, head, faceMask, muzzle, tailPivot, leftEar, rightEar, leftEye, rightEye, nose, scarf, bowLeft, bowRight, ...whiskers, ...legs);
  group.position.set(-5.8, 0, 4.6);
  world.add(group);
  catParts = { body, head, tailPivot, ruff, legs, scarf };
  return group;
}

function makeKeepsake(index, x, z, material, kind) {
  const group = new THREE.Group();
  const halo = mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 44), materials.gold, [0, 0.94, 0]);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  if (kind === "cake") {
    group.add(mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.32, 24), materials.cream, [0, 0.9, 0]));
    group.add(mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.22, 24), material, [0, 1.15, 0]));
    group.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), materials.gold, [0, 1.34, 0]));
  } else if (kind === "ribbon") {
    group.add(mesh(new THREE.BoxGeometry(0.38, 0.22, 0.12), material, [-0.16, 0.95, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.38, 0.22, 0.12), material, [0.16, 0.95, 0]));
    group.add(mesh(new THREE.SphereGeometry(0.11, 12, 8), materials.gold, [0, 0.95, 0]));
  } else {
    group.add(mesh(new THREE.OctahedronGeometry(0.38, 0), material, [0, 0.98, 0]));
    group.add(mesh(new THREE.SphereGeometry(0.09, 12, 8), materials.gold, [0, 1.35, 0]));
  }
  const light = new THREE.PointLight(index === 1 ? 0xf18aa1 : index === 2 ? 0x96d7ad : 0x86baff, 9, 6.5);
  light.position.set(0, 1, 0);
  group.add(light);
  group.position.set(x, 0, z);
  group.userData = { index, collected: false, radius: index === 1 ? 1.9 : 0.92, light };
  world.add(group);
  return group;
}

const particlePool = [];
function makeParticlePool() {
  for (let i = 0; i < 70; i += 1) {
    const particle = mesh(new THREE.SphereGeometry(0.045, 8, 6), materials.spark, [0, -10, 0]);
    particle.visible = false;
    particle.userData = { life: 0, velocity: new THREE.Vector3() };
    particlePool.push(particle);
    scene.add(particle);
  }
}

function burstAt(position, color = 0xffdfa0) {
  let spawned = 0;
  particlePool.forEach((particle) => {
    if (spawned >= 22 || particle.visible) return;
    spawned += 1;
    particle.material.color.setHex(color);
    particle.visible = true;
    particle.position.copy(position).add(new THREE.Vector3(0, 0.9, 0));
    particle.userData.life = 0.85 + Math.random() * 0.45;
    particle.userData.velocity.set((Math.random() - 0.5) * 2.2, 1.6 + Math.random() * 1.8, (Math.random() - 0.5) * 2.2);
    particle.scale.setScalar(0.8 + Math.random() * 1.4);
  });
}

function updateParticles(delta) {
  particlePool.forEach((particle) => {
    if (!particle.visible) return;
    particle.userData.life -= delta;
    particle.userData.velocity.y -= delta * 2.4;
    particle.position.addScaledVector(particle.userData.velocity, delta);
    particle.material.opacity = Math.max(0, particle.userData.life);
    particle.scale.multiplyScalar(0.985);
    if (particle.userData.life <= 0) {
      particle.visible = false;
      particle.material.opacity = 0.95;
    }
  });
}

makeIsland();
[
  [-7.4, -4.8, 1.1],
  [7.2, -5.9, 0.9],
  [7.2, 4.9, 1.2],
  [-7.8, 5.5, 0.86],
  [-2.9, -7.1, 0.75],
  [0.9, 7.4, 0.72]
].forEach(([x, z, s]) => makeTree(x, z, s));
[
  [-3.4, -5.8],
  [4.6, -2.2],
  [2.2, 5.5],
  [-5.1, 2.6],
  [6.5, 1.9],
  [-0.7, 4.7]
].forEach(([x, z]) => makeLantern(x, z));
makeBalloonCluster(-5.7, 1.3, [materials.roseGlow, materials.gold, materials.mint]);
makeBalloonCluster(5.5, -3.6, [materials.mint, materials.blue, materials.gold]);
makeBalloonCluster(3.3, 4.9, [materials.blue, materials.roseGlow, materials.gold]);
makeRibbonArch(5.9, 0.55, Math.PI / 2.8);
makeCakeTable(0.2, 5.45);
makeGift(-1.8, 3.8, materials.roseGlow, 1);
makeGift(5.1, 2.5, materials.blue, 0.95);
makeGift(-4.2, -2.8, materials.mint, 0.85);
makeGift(1.45, -4.6, materials.roseGlow, 0.7);
makeTrailSign(-5.3, 2.1, materials.roseGlow);
makeTrailSign(3.2, -3.8, materials.mint);
makeTrailSign(4.8, 3.5, materials.blue);
addPawPrints();
makeParticlePool();

cat = makeCat();
const keepsakes = [
  makeKeepsake(1, -4.8, 1.15, materials.roseGlow, "cake"),
  makeKeepsake(2, 4.6, -3.1, materials.mint, "ribbon"),
  makeKeepsake(3, 3.7, 4.3, materials.blue, "bell")
];

const starGeo = new THREE.SphereGeometry(0.045, 8, 6);
for (let i = 0; i < 160; i += 1) {
  const star = new THREE.Mesh(starGeo, materials.whiteBasic);
  star.position.set((Math.random() - 0.5) * 60, 8 + Math.random() * 20, (Math.random() - 0.5) * 60);
  star.scale.setScalar(0.7 + Math.random() * 1.8);
  scene.add(star);
}

function readMoveVector() {
  const forward = keys.has("w") || keys.has("arrowup") || touchMoves.has("up");
  const back = keys.has("s") || keys.has("arrowdown") || touchMoves.has("down");
  const left = keys.has("a") || keys.has("arrowleft") || touchMoves.has("left");
  const right = keys.has("d") || keys.has("arrowright") || touchMoves.has("right");
  const vector = new THREE.Vector3(Number(right) - Number(left), 0, Number(back) - Number(forward));
  if (vector.lengthSq() > 0) vector.normalize();
  return vector;
}

function resetGame() {
  collected = 0;
  scoreEl.textContent = "0 / 3";
  messageText.textContent = "Follow the paw prints to the first keepsake.";
  finale.classList.remove("is-visible");
  cat.position.set(-5.8, 0, 4.6);
  cat.rotation.y = 0;
  velocity.set(0, 0, 0);
  keepsakes.forEach((keepsake) => {
    keepsake.visible = true;
    keepsake.userData.collected = false;
    keepsake.scale.setScalar(1);
  });
}

function collectKeepsake(keepsake) {
  if (keepsake.userData.collected) return;
  keepsake.userData.collected = true;
  keepsake.visible = false;
  collected += 1;
  scoreEl.textContent = `${collected} / 3`;
  messageText.textContent = messages[keepsake.userData.index - 1];
  burstAt(keepsake.position, keepsake.userData.index === 1 ? 0xf18aa1 : keepsake.userData.index === 2 ? 0x96d7ad : 0x8bc0ff);
  if (collected === keepsakes.length) {
    burstAt(new THREE.Vector3(0.2, 0, 5.45), 0xffdfa0);
    window.setTimeout(() => finale.classList.add("is-visible"), 650);
  }
}

function updateCat(delta, isMoving) {
  walkTime += delta * (isMoving ? 9.4 : 1.55);
  const stride = Math.sin(walkTime);
  const counterStride = Math.sin(walkTime + Math.PI);
  cat.position.y = isMoving ? Math.abs(stride) * 0.055 : Math.sin(clock.elapsedTime * 1.8) * 0.018;
  catParts.body.rotation.z = isMoving ? stride * 0.042 : Math.sin(clock.elapsedTime * 1.2) * 0.012;
  catParts.head.rotation.x = isMoving ? -0.09 + Math.abs(stride) * 0.05 : Math.sin(clock.elapsedTime * 1.15) * 0.024;
  catParts.ruff.rotation.z = Math.sin(clock.elapsedTime * 3.4) * 0.035;
  catParts.scarf.rotation.z = Math.sin(clock.elapsedTime * 4.1) * 0.035;
  catParts.tailPivot.rotation.y = Math.sin(walkTime * 0.8) * (isMoving ? 0.42 : 0.2);
  catParts.tailPivot.rotation.z = 0.26 + Math.cos(walkTime * 0.7) * 0.1;
  catParts.legs.forEach((leg, index) => {
    const phase = index % 2 === 0 ? stride : counterStride;
    leg.rotation.x = phase * (isMoving ? 0.68 : 0.05);
    leg.position.y = 0.3 + Math.max(phase, 0) * (isMoving ? 0.09 : 0.01);
  });
}

function update(delta) {
  const input = readMoveVector();
  const hasInput = started && input.lengthSq() > 0;
  if (hasInput) {
    const yawMatrix = new THREE.Matrix4().makeRotationY(cameraYaw);
    input.applyMatrix4(yawMatrix);
    tempVec.copy(input).multiplyScalar(6.4);
    velocity.lerp(tempVec, 1 - Math.pow(0.002, delta));
  } else {
    velocity.multiplyScalar(Math.pow(0.055, delta));
  }

  cat.position.addScaledVector(velocity, delta);
  cat.position.x = THREE.MathUtils.clamp(cat.position.x, -8.4, 8.4);
  cat.position.z = THREE.MathUtils.clamp(cat.position.z, -8.4, 8.4);
  const isMoving = velocity.lengthSq() > 0.05;
  if (isMoving) {
    cat.rotation.y = THREE.MathUtils.lerp(cat.rotation.y, Math.atan2(velocity.x, velocity.z), 1 - Math.pow(0.0003, delta));
  }
  updateCat(delta, isMoving);

  keepsakes.forEach((keepsake) => {
    keepsake.rotation.y += delta * 1.65;
    keepsake.position.y = Math.sin(clock.elapsedTime * 2.3 + keepsake.userData.index) * 0.12;
    keepsake.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3 + keepsake.userData.index) * 0.035);
    if (!keepsake.userData.collected && cat.position.distanceTo(keepsake.position) < keepsake.userData.radius) {
      collectKeepsake(keepsake);
    }
  });

  updateParticles(delta);

  const cameraOffset = new THREE.Vector3(7.8, 6.8, 9.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
  const target = cat.position.clone().add(new THREE.Vector3(0, 0.9, 0));
  camera.position.lerp(target.clone().add(cameraOffset), 1 - Math.pow(0.015, delta));
  camera.lookAt(target);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  update(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

startButton.addEventListener("click", () => {
  started = true;
  document.body.classList.add("is-playing");
  intro.classList.add("is-hidden");
  canvas.focus();
});

resetButton.addEventListener("click", resetGame);
playAgainButton.addEventListener("click", () => {
  resetGame();
  started = true;
  document.body.classList.add("is-playing");
});

window.addEventListener("keydown", (event) => keys.add(event.key.toLowerCase()));
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("resize", resize);

canvas.addEventListener("pointerdown", (event) => {
  isDragging = true;
  previousPointerX = event.clientX;
});

window.addEventListener("pointerup", () => {
  isDragging = false;
});

window.addEventListener("pointermove", (event) => {
  if (!isDragging) return;
  const deltaX = event.clientX - previousPointerX;
  previousPointerX = event.clientX;
  cameraYaw -= deltaX * 0.006;
});

document.querySelectorAll("[data-move]").forEach((button) => {
  const move = button.dataset.move;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    touchMoves.add(move);
    started = true;
    document.body.classList.add("is-playing");
    intro.classList.add("is-hidden");
  });
  button.addEventListener("pointerup", () => touchMoves.delete(move));
  button.addEventListener("pointerleave", () => touchMoves.delete(move));
  button.addEventListener("pointercancel", () => touchMoves.delete(move));
});

resize();
resetGame();
animate();
