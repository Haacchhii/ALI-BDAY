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

window.catAdventureStatus = () => ({
  started,
  collected,
  cat: {
    x: Number(cat?.position.x.toFixed(2) || 0),
    z: Number(cat?.position.z.toFixed(2) || 0)
  }
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b14);
scene.fog = new THREE.Fog(0x090b14, 16, 42);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(8, 8, 11);

const clock = new THREE.Clock();
const keys = new Set();
const touchMoves = new Set();
let started = false;
let collected = 0;
let cameraYaw = 0;
let isDragging = false;
let previousPointerX = 0;
let catParts = {};
let walkTime = 0;

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x22392e, roughness: 0.88 }),
  path: new THREE.MeshStandardMaterial({ color: 0x665747, roughness: 0.92 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xfff1d3, roughness: 0.64 }),
  toast: new THREE.MeshStandardMaterial({ color: 0x74513d, roughness: 0.72 }),
  deepToast: new THREE.MeshStandardMaterial({ color: 0x39261e, roughness: 0.78 }),
  fluff: new THREE.MeshStandardMaterial({ color: 0xfff7e5, roughness: 0.82 }),
  black: new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.7 }),
  rose: new THREE.MeshStandardMaterial({ color: 0xee8aa0, roughness: 0.58 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf4ca73, emissive: 0x3c2706, roughness: 0.42 }),
  mint: new THREE.MeshStandardMaterial({ color: 0x94d4a7, roughness: 0.72 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x86baff, emissive: 0x061833, roughness: 0.55 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4532, roughness: 0.8 })
};

const world = new THREE.Group();
scene.add(world);

const hemi = new THREE.HemisphereLight(0xe8efff, 0x222c25, 1.8);
scene.add(hemi);

const moon = new THREE.DirectionalLight(0xdce7ff, 2.3);
moon.position.set(-8, 12, 7);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 38;
moon.shadow.camera.left = -16;
moon.shadow.camera.right = 16;
moon.shadow.camera.top = 16;
moon.shadow.camera.bottom = -16;
scene.add(moon);

const warm = new THREE.PointLight(0xf5c477, 22, 16);
warm.position.set(0, 4.5, 0);
scene.add(warm);

function mesh(geometry, material, position, scale = [1, 1, 1]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function makeRoundedIsland() {
  const base = mesh(new THREE.CylinderGeometry(10, 10.8, 0.8, 64), materials.grass, [0, -0.45, 0]);
  world.add(base);

  const pathMat = materials.path;
  const pathA = mesh(new THREE.BoxGeometry(13, 0.04, 2.2), pathMat, [0, 0.02, 0], [1, 1, 1]);
  const pathB = mesh(new THREE.BoxGeometry(2.2, 0.045, 13), pathMat, [0, 0.04, 0], [1, 1, 1]);
  world.add(pathA, pathB);

  for (let i = 0; i < 22; i += 1) {
    const angle = i * 0.72;
    const radius = 8.1 + Math.sin(i) * 0.7;
    const flower = mesh(
      new THREE.SphereGeometry(0.18 + (i % 3) * 0.04, 12, 8),
      i % 2 ? materials.rose : materials.mint,
      [Math.cos(angle) * radius, 0.25, Math.sin(angle) * radius]
    );
    world.add(flower);
  }
}

function makeTree(x, z, s = 1) {
  const tree = new THREE.Group();
  tree.add(mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.6, 10), materials.wood, [0, 0.8, 0], [s, s, s]));
  tree.add(mesh(new THREE.ConeGeometry(0.9, 1.7, 12), materials.mint, [0, 1.95, 0], [s, s, s]));
  tree.position.set(x, 0, z);
  tree.rotation.y = Math.random() * Math.PI;
  world.add(tree);
}

function makeLantern(x, z) {
  const lantern = new THREE.Group();
  lantern.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.55, 8), materials.wood, [0, 0.78, 0]));
  lantern.add(mesh(new THREE.SphereGeometry(0.22, 16, 12), materials.gold, [0, 1.55, 0]));
  const light = new THREE.PointLight(0xf4ca73, 4, 5);
  light.position.set(0, 1.5, 0);
  lantern.add(light);
  lantern.position.set(x, 0, z);
  world.add(lantern);
}

function makeTrailSign(x, z, textColorMaterial = materials.rose) {
  const sign = new THREE.Group();
  sign.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 8), materials.wood, [0, 0.45, 0]));
  sign.add(mesh(new THREE.BoxGeometry(1.05, 0.42, 0.08), materials.cream, [0, 0.92, 0]));
  sign.add(mesh(new THREE.BoxGeometry(0.72, 0.08, 0.1), textColorMaterial, [0, 0.98, 0.055]));
  sign.add(mesh(new THREE.BoxGeometry(0.42, 0.06, 0.1), materials.gold, [0.12, 0.84, 0.055]));
  sign.position.set(x, 0, z);
  sign.rotation.y = Math.atan2(-x, -z);
  world.add(sign);
}

function makeCat() {
  const cat = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.62, 28, 18), materials.fluff, [0, 0.68, 0], [1.55, 0.86, 1.03]);
  const chest = mesh(new THREE.SphereGeometry(0.36, 20, 14), materials.cream, [0, 0.72, 0.54], [1.06, 1.02, 0.42]);
  const ruff = mesh(new THREE.TorusGeometry(0.42, 0.08, 10, 34), materials.fluff, [0, 1.02, 0.36]);
  ruff.rotation.x = Math.PI / 2;

  const head = mesh(new THREE.SphereGeometry(0.46, 28, 18), materials.fluff, [0, 1.22, 0.55], [1.08, 0.94, 1.02]);
  const faceMask = mesh(new THREE.SphereGeometry(0.29, 20, 14), materials.toast, [0, 1.16, 0.88], [1.08, 0.76, 0.34]);
  const muzzle = mesh(new THREE.SphereGeometry(0.15, 16, 10), materials.cream, [0, 1.07, 1.02], [1.3, 0.72, 0.55]);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(-0.72, 0.78, -0.42);
  const tail = mesh(new THREE.CylinderGeometry(0.13, 0.18, 1.25, 16), materials.toast, [0, 0.48, -0.24]);
  tail.rotation.x = 0.95;
  tail.rotation.z = -0.4;
  const tailTip = mesh(new THREE.SphereGeometry(0.22, 18, 12), materials.deepToast, [-0.22, 0.92, -0.58], [0.9, 1.3, 0.9]);
  tailPivot.add(tail, tailTip);

  const earGeo = new THREE.ConeGeometry(0.18, 0.36, 3);
  const leftEar = mesh(earGeo, materials.deepToast, [-0.28, 1.56, 0.55]);
  const rightEar = mesh(earGeo, materials.deepToast, [0.28, 1.56, 0.55]);
  leftEar.rotation.y = Math.PI / 3;
  rightEar.rotation.y = Math.PI / 3;

  const eyeGeo = new THREE.SphereGeometry(0.045, 12, 8);
  const leftEye = mesh(eyeGeo, materials.black, [-0.15, 1.22, 0.95]);
  const rightEye = mesh(eyeGeo, materials.black, [0.15, 1.22, 0.95]);
  const nose = mesh(new THREE.SphereGeometry(0.04, 12, 8), materials.rose, [0, 1.1, 1.08], [1.2, 0.8, 0.7]);

  const scarf = mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 28), materials.rose, [0, 0.98, 0.31]);
  scarf.rotation.x = Math.PI / 2;

  const legGeo = new THREE.SphereGeometry(0.15, 16, 10);
  const legs = [
    [-0.42, 0.29, 0.38],
    [0.42, 0.29, 0.38],
    [-0.48, 0.29, -0.34],
    [0.48, 0.29, -0.34]
  ].map(([x, y, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, y, z);
    leg.add(mesh(legGeo, materials.toast, [0, 0, 0], [0.9, 1.35, 0.9]));
    leg.add(mesh(new THREE.SphereGeometry(0.16, 16, 10), materials.deepToast, [0, -0.22, 0.08], [1.2, 0.5, 1.45]));
    return leg;
  });

  const cheekLeft = mesh(new THREE.SphereGeometry(0.13, 14, 10), materials.cream, [-0.15, 1.07, 1.01], [1, 0.8, 0.68]);
  const cheekRight = mesh(new THREE.SphereGeometry(0.13, 14, 10), materials.cream, [0.15, 1.07, 1.01], [1, 0.8, 0.68]);
  const bow = mesh(new THREE.BoxGeometry(0.26, 0.14, 0.08), materials.gold, [0, 0.96, 0.78]);
  bow.rotation.z = Math.PI / 4;

  cat.add(body, chest, ruff, head, faceMask, muzzle, tailPivot, leftEar, rightEar, leftEye, rightEye, nose, scarf, cheekLeft, cheekRight, bow, ...legs);
  cat.position.set(-5.8, 0, 4.6);
  catParts = { body, head, tailPivot, legs, ruff };
  world.add(cat);
  return cat;
}

function makeCharm(index, x, z, colorMaterial) {
  const group = new THREE.Group();
  const core = mesh(new THREE.OctahedronGeometry(0.42, 0), colorMaterial, [0, 0.95, 0]);
  const ring = mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 40), materials.gold, [0, 0.95, 0]);
  ring.rotation.x = Math.PI / 2;
  group.add(core, ring);
  const light = new THREE.PointLight(index === 1 ? 0xf18aa1 : index === 2 ? 0x96d7ad : 0x86baff, 8, 6);
  light.position.set(0, 1, 0);
  group.add(light);
  group.position.set(x, 0, z);
  group.userData = { index, collected: false, radius: 0.9 };
  world.add(group);
  return group;
}

function makeGift(x, z, mat) {
  const gift = new THREE.Group();
  gift.add(mesh(new THREE.BoxGeometry(0.72, 0.58, 0.72), mat, [0, 0.32, 0]));
  gift.add(mesh(new THREE.BoxGeometry(0.12, 0.63, 0.78), materials.gold, [0, 0.34, 0]));
  gift.add(mesh(new THREE.BoxGeometry(0.78, 0.64, 0.12), materials.gold, [0, 0.35, 0]));
  gift.position.set(x, 0, z);
  gift.rotation.y = Math.random() * Math.PI;
  world.add(gift);
}

function addPawPrints() {
  const pawMat = new THREE.MeshStandardMaterial({ color: 0xf7dfb2, roughness: 0.9 });
  for (let i = 0; i < 18; i += 1) {
    const paw = new THREE.Group();
    paw.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), pawMat, [0, 0.085, 0], [1.2, 0.2, 1]));
    paw.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), pawMat, [-0.1, 0.105, 0.12], [1, 0.2, 1]));
    paw.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), pawMat, [0, 0.105, 0.16], [1, 0.2, 1]));
    paw.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), pawMat, [0.1, 0.105, 0.12], [1, 0.2, 1]));
    paw.position.set(-5.6 + i * 0.58, 0, 4.1 - i * 0.38);
    paw.rotation.y = -0.75;
    world.add(paw);
  }
}

makeRoundedIsland();
[[-6.8, -4.8, 1.1], [7.1, -5.9, 0.9], [6.8, 4.9, 1.2], [-7.8, 5.4, 0.8]].forEach(([x, z, s]) => makeTree(x, z, s));
[[-3.4, -5.8], [4.6, -2.2], [2.2, 5.5], [-5.1, 2.6]].forEach(([x, z]) => makeLantern(x, z));
makeGift(-1.8, 3.8, materials.rose);
makeGift(5.1, 2.5, materials.blue);
makeGift(-4.2, -2.8, materials.mint);
makeTrailSign(-5.3, 2.1, materials.rose);
makeTrailSign(3.2, -3.8, materials.mint);
makeTrailSign(4.8, 3.5, materials.blue);
addPawPrints();

const cat = makeCat();
const charms = [
  makeCharm(1, -4.8, 1.15, materials.rose),
  makeCharm(2, 4.6, -3.1, materials.mint),
  makeCharm(3, 3.7, 4.3, materials.blue)
];

const starGeo = new THREE.SphereGeometry(0.045, 8, 6);
const starMat = new THREE.MeshBasicMaterial({ color: 0xfff2c6 });
for (let i = 0; i < 130; i += 1) {
  const star = new THREE.Mesh(starGeo, starMat);
  star.position.set((Math.random() - 0.5) * 52, 8 + Math.random() * 18, (Math.random() - 0.5) * 52);
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
  charms.forEach((charm) => {
    charm.visible = true;
    charm.userData.collected = false;
    charm.scale.setScalar(1);
  });
}

function collectCharm(charm) {
  if (charm.userData.collected) return;
  charm.userData.collected = true;
  charm.visible = false;
  collected += 1;
  scoreEl.textContent = `${collected} / 3`;
  messageText.textContent = messages[charm.userData.index - 1];
  if (collected === charms.length) {
    window.setTimeout(() => finale.classList.add("is-visible"), 600);
  }
}

function update(delta) {
  const move = readMoveVector();
  const isMoving = started && move.lengthSq() > 0;
  if (isMoving) {
    const speed = 4.6;
    const yawMatrix = new THREE.Matrix4().makeRotationY(cameraYaw);
    move.applyMatrix4(yawMatrix);
    cat.position.addScaledVector(move, delta * speed);
    cat.position.x = THREE.MathUtils.clamp(cat.position.x, -8.3, 8.3);
    cat.position.z = THREE.MathUtils.clamp(cat.position.z, -8.3, 8.3);
    cat.rotation.y = Math.atan2(move.x, move.z);
  }

  if (isMoving) {
    walkTime += delta * 8.5;
  } else {
    walkTime += delta * 1.4;
  }
  const stride = Math.sin(walkTime);
  const counterStride = Math.sin(walkTime + Math.PI);
  cat.position.y = (isMoving ? Math.abs(stride) * 0.045 : Math.sin(clock.elapsedTime * 2) * 0.018);
  catParts.body.rotation.z = isMoving ? stride * 0.035 : Math.sin(clock.elapsedTime * 1.4) * 0.012;
  catParts.head.rotation.x = isMoving ? -0.08 + Math.abs(stride) * 0.045 : Math.sin(clock.elapsedTime * 1.2) * 0.025;
  catParts.ruff.rotation.z = Math.sin(clock.elapsedTime * 3.6) * 0.04;
  catParts.tailPivot.rotation.y = Math.sin(walkTime * 0.8) * (isMoving ? 0.36 : 0.18);
  catParts.tailPivot.rotation.z = 0.3 + Math.cos(walkTime * 0.7) * 0.08;
  catParts.legs.forEach((leg, index) => {
    const phase = index % 2 === 0 ? stride : counterStride;
    leg.rotation.x = phase * (isMoving ? 0.62 : 0.06);
    leg.position.y = 0.29 + Math.max(phase, 0) * (isMoving ? 0.08 : 0.01);
  });

  charms.forEach((charm) => {
    charm.rotation.y += delta * 1.7;
    charm.position.y = Math.sin(clock.elapsedTime * 2.4 + charm.userData.index) * 0.12;
    if (!charm.userData.collected && cat.position.distanceTo(charm.position) < charm.userData.radius) {
      collectCharm(charm);
    }
  });

  const cameraOffset = new THREE.Vector3(7.8, 7.2, 9.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
  const target = cat.position.clone().add(new THREE.Vector3(0, 0.8, 0));
  camera.position.lerp(target.clone().add(cameraOffset), 0.08);
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
