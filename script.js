import * as THREE from "./vendor/three.module.min.js";
import * as CANNON from "./vendor/cannon-es.js";

const canvas = document.querySelector("#world");
const avatarSelect = document.querySelector("#avatarSelect");
const avatarGrid = document.querySelector("#avatarGrid");
const welcomeModal = document.querySelector("#welcomeModal");
const welcomeClose = document.querySelector("#welcomeClose");
const contentPanel = document.querySelector("#contentPanel");
const panelClose = document.querySelector("#panelClose");
const panelKicker = document.querySelector("#panelKicker");
const panelTitle = document.querySelector("#panelTitle");
const panelBody = document.querySelector("#panelBody");
const panelGallery = document.querySelector("#panelGallery");
const interactPrompt = document.querySelector("#interactPrompt");
const interactLabel = document.querySelector("#interactLabel");
const hud = document.querySelector("#hud");
const mapDrawer = document.querySelector("#mapDrawer");
const optionsDrawer = document.querySelector("#optionsDrawer");
const helpDrawer = document.querySelector("#helpDrawer");
const mapPlayer = document.querySelector("#mapPlayer");
const audioToggle = document.querySelector("#audioToggle");
const qualityToggle = document.querySelector("#qualityToggle");
const stuckButton = document.querySelector("#stuckButton");
const joystick = document.querySelector("#joystick");
const joystickKnob = document.querySelector("#joystickKnob");

const avatarSchemes = [
  {
    id: "siamese",
    name: "Siamese",
    note: "Ivory coat, toasted points, pale blue eyes.",
    body: "#f2dfbf",
    head: "#ead5b6",
    point: "#3a261d",
    shade: "#d8bf9b",
    stripe: "#5b3a29",
    eye: "#a8ddff"
  },
  {
    id: "tabby",
    name: "Tabby",
    note: "Warm brown-gold fur with bold sleepy stripes.",
    body: "#a77a42",
    head: "#bc8b4c",
    point: "#4d3421",
    shade: "#815b31",
    stripe: "#211713",
    eye: "#e7ad46"
  },
  {
    id: "shadow",
    name: "Shadow",
    note: "Soft black silhouette with glowing forest eyes.",
    body: "#111211",
    head: "#171817",
    point: "#050605",
    shade: "#060706",
    stripe: "#242724",
    eye: "#c4e85d"
  },
  {
    id: "ginger",
    name: "Ginger",
    note: "Marmalade orange with sunny darker stripes.",
    body: "#d68531",
    head: "#e79a43",
    point: "#b86225",
    shade: "#bd6f27",
    stripe: "#9d5521",
    eye: "#93d56b"
  }
];

const zoneData = [
  {
    id: "achievements",
    title: "Your Achievements",
    kicker: "Gold-lit clearing",
    icon: "★",
    color: 0xf4c869,
    position: new THREE.Vector3(18, 0, -12),
    body: "Placeholder for Ali's wins, milestones, tiny victories, and every reason she deserves to feel proud today. Replace this with specific achievements, inside jokes, or little medals.",
    slots: ["Achievement photo", "Medal note", "Memory card"]
  },
  {
    id: "message",
    title: "Birthday Message from the Creator",
    kicker: "Heart lantern",
    icon: "♡",
    color: 0xe8a5c4,
    position: new THREE.Vector3(0, 0, 0),
    body: "Placeholder for the emotional birthday letter. This is the heart of the forest: write the message you want Ali to remember after she closes the tab.",
    slots: ["Letter image", "Favorite line", "Secret note"]
  },
  {
    id: "moments",
    title: "Ali Moments",
    kicker: "Memory grove",
    icon: "▧",
    color: 0x8ec7ff,
    position: new THREE.Vector3(-16, 0, 15),
    body: "Placeholder gallery for favorite photos, screenshots, dates, silly moments, and soft memories. Swap these slots with real images later.",
    slots: ["Photo 01", "Photo 02", "Photo 03", "Photo 04", "Photo 05", "Photo 06"]
  }
];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07110b);
scene.fog = new THREE.FogExp2(0x0d1f14, 0.028);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 130);
camera.position.set(0, 10, 16);

const physicsWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, -16, 0) });
physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
physicsWorld.allowSleep = true;

const groundMaterial = new CANNON.Material("ground");
const catMaterial = new CANNON.Material("cat");
physicsWorld.defaultContactMaterial.friction = 0.04;
physicsWorld.defaultContactMaterial.restitution = 0.08;
physicsWorld.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, catMaterial, {
  friction: 0.08,
  restitution: 0.05
}));

const clock = new THREE.Clock();
const keys = new Set();
const joystickVector = new THREE.Vector2();
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const boundary = 28;
let selectedAvatar = avatarSchemes[0];
let catGroup;
let catBody;
let catParts = {};
let activeZone = null;
let openedPanel = false;
let sceneStarted = false;
let cameraYaw = 0;
let draggingCamera = false;
let dragStartX = 0;
let joystickPointerId = null;
let joystickCenter = { x: 0, y: 0 };
let audioOn = false;
let qualityHigh = true;
let audioContext = null;
let ambienceGain = null;
let walkTime = 0;

const colliders = [];
const zoneMeshes = [];
const fireflies = [];
const reusableVec3 = new THREE.Vector3();

function colorMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0,
    emissive: options.emissive ?? 0x000000,
    flatShading: true
  });
}

const materials = {
  ground: colorMaterial(0x1e3a2b),
  groundDark: colorMaterial(0x0d1f14),
  path: colorMaterial(0x735d43),
  bark: colorMaterial(0x62412c),
  pine: colorMaterial(0x2e6147),
  pineDark: colorMaterial(0x1b3a2a),
  roundTree: colorMaterial(0x466f4d),
  fence: colorMaterial(0x8a6743),
  parchment: colorMaterial(0xf5f0e6),
  gold: colorMaterial(0xf4c869, { emissive: 0x3d2605 }),
  pink: colorMaterial(0xe8a5c4, { emissive: 0x33101d }),
  blue: colorMaterial(0x8ec7ff, { emissive: 0x071b30 }),
  black: colorMaterial(0x050605),
  white: colorMaterial(0xf8f3e9),
  firefly: new THREE.MeshBasicMaterial({ color: 0xf4c869, transparent: true, opacity: 0.9 })
};

function mesh(geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function makeAvatarCard(avatar) {
  const card = document.createElement("article");
  card.className = "avatar-card";
  card.innerHTML = `
    <div class="avatar-preview" style="--body:${avatar.body};--head:${avatar.head};--point:${avatar.point};--shade:${avatar.shade};--stripe:${avatar.stripe};--eye:${avatar.eye}">
      <span class="preview-tail"></span>
      <span class="preview-body"></span>
      <span class="preview-ear left"></span>
      <span class="preview-ear right"></span>
      <span class="preview-head"></span>
      <span class="preview-eye left"></span>
      <span class="preview-eye right"></span>
      <span class="preview-stripe one"></span>
      <span class="preview-stripe two"></span>
      <span class="preview-stripe three"></span>
    </div>
    <h2>${avatar.name}</h2>
    <p>${avatar.note}</p>
    <button class="select-button" type="button">Select</button>
  `;
  card.querySelector("button").addEventListener("click", () => startForest(avatar));
  return card;
}

avatarSchemes.forEach((avatar) => avatarGrid.appendChild(makeAvatarCard(avatar)));

function setupLights() {
  scene.add(new THREE.HemisphereLight(0xfff4d6, 0x102417, 1.6));
  const sun = new THREE.DirectionalLight(0xffe8b2, 2.2);
  sun.position.set(-16, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -36;
  sun.shadow.camera.right = 36;
  sun.shadow.camera.top = 36;
  sun.shadow.camera.bottom = -36;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  scene.add(sun);
  const heartGlow = new THREE.PointLight(0xe8a5c4, 14, 28);
  heartGlow.position.set(0, 5, 0);
  scene.add(heartGlow);
}

function addPhysicsBox(position, halfExtents) {
  const body = new CANNON.Body({ mass: 0, material: groundMaterial });
  body.addShape(new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z)));
  body.position.set(position.x, position.y, position.z);
  physicsWorld.addBody(body);
  colliders.push(body);
  return body;
}

function addPhysicsCylinder(position, radius, height) {
  const body = new CANNON.Body({ mass: 0, material: groundMaterial });
  body.addShape(new CANNON.Cylinder(radius, radius, height, 10));
  body.position.set(position.x, position.y, position.z);
  physicsWorld.addBody(body);
  colliders.push(body);
  return body;
}

function makeGround() {
  const ground = mesh(new THREE.CylinderGeometry(31, 32, 1.4, 72), materials.groundDark, [0, -0.7, 0]);
  const top = mesh(new THREE.CylinderGeometry(30, 30.8, 0.26, 72), materials.ground, [0, 0.02, 0]);
  scene.add(ground, top);

  const planeBody = new CANNON.Body({ mass: 0, material: groundMaterial });
  planeBody.addShape(new CANNON.Plane());
  planeBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  physicsWorld.addBody(planeBody);

  const fencePieces = 28;
  for (let i = 0; i < fencePieces; i += 1) {
    const angle = (i / fencePieces) * Math.PI * 2;
    const x = Math.cos(angle) * 29.5;
    const z = Math.sin(angle) * 29.5;
    const rail = mesh(new THREE.BoxGeometry(2.5, 0.42, 0.22), materials.fence, [x, 0.56, z]);
    rail.rotation.y = -angle;
    scene.add(rail);
    addPhysicsBox(new THREE.Vector3(x, 0.56, z), new THREE.Vector3(1.25, 0.38, 0.22));
  }

  const pathPoints = [
    new THREE.Vector3(0, 0.14, 0),
    new THREE.Vector3(18, 0.14, -12),
    new THREE.Vector3(0, 0.14, 0),
    new THREE.Vector3(-16, 0.14, 15)
  ];
  pathPoints.forEach((point, index) => {
    if (index === 0) return;
    const start = pathPoints[index - 1];
    const distance = start.distanceTo(point);
    const mid = start.clone().lerp(point, 0.5);
    const path = mesh(new THREE.BoxGeometry(2.8, 0.06, distance), materials.path, [mid.x, 0.16, mid.z]);
    path.rotation.y = Math.atan2(point.x - start.x, point.z - start.z);
    scene.add(path);
  });
}

function makeTree(x, z, type = "pine", scale = 1) {
  const tree = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.35, 0.46, 2.1, 7), materials.bark, [0, 1.05, 0], [scale, scale, scale]);
  tree.add(trunk);
  if (type === "pine") {
    tree.add(mesh(new THREE.ConeGeometry(1.4, 2.25, 7), materials.pineDark, [0, 2.5, 0], [scale, scale, scale]));
    tree.add(mesh(new THREE.ConeGeometry(1.08, 1.95, 7), materials.pine, [0, 3.45, 0], [scale, scale, scale]));
  } else {
    tree.add(mesh(new THREE.DodecahedronGeometry(1.45, 0), materials.roundTree, [0, 2.65, 0], [scale, scale, scale]));
    tree.add(mesh(new THREE.DodecahedronGeometry(0.9, 0), materials.pine, [0.7, 3.1, 0.2], [scale, scale, scale]));
  }
  tree.position.set(x, 0, z);
  tree.rotation.y = Math.sin(x * 5 + z) * 0.5;
  scene.add(tree);
  addPhysicsCylinder(new THREE.Vector3(x, 0.9, z), 0.72 * scale, 2.2 * scale);
}

function populateForest() {
  const treePositions = [
    [-23, -18, "pine", 1.15], [-17, -23, "round", 1.0], [-7, -24, "pine", 0.8],
    [10, -24, "round", 0.9], [22, -18, "pine", 1.1], [25, -4, "pine", 0.85],
    [23, 12, "round", 1.0], [13, 23, "pine", 1.0], [5, 26, "round", 0.88],
    [-13, 24, "pine", 1.1], [-24, 14, "round", 0.9], [-25, -4, "pine", 1.0],
    [-10, -8, "round", 0.75], [9, 10, "pine", 0.72], [13, -2, "round", 0.72],
    [-8, 8, "pine", 0.68]
  ];
  treePositions.forEach(([x, z, type, scale]) => makeTree(x, z, type, scale));

  for (let i = 0; i < 38; i += 1) {
    const angle = i * 0.73;
    const radius = 8 + Math.sin(i * 1.4) * 8 + (i % 5);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
    const rock = mesh(new THREE.DodecahedronGeometry(0.35 + (i % 4) * 0.08, 0), colorMaterial(i % 2 ? 0x6c7565 : 0x4d5a4e), [x, 0.28, z], [1, 0.65, 1]);
    rock.rotation.set(Math.sin(i), Math.cos(i), Math.sin(i * 0.3));
    scene.add(rock);
  }
}

function makeLantern(position, color, icon) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.1, 8), materials.fence, [0, 1.05, 0]));
  const lanternMat = colorMaterial(color, { emissive: color });
  const orb = mesh(new THREE.SphereGeometry(0.46, 18, 12), lanternMat, [0, 2.38, 0]);
  group.add(orb);
  group.add(mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 32), materials.gold, [0, 2.38, 0]));
  const sign = mesh(new THREE.BoxGeometry(1.15, 0.72, 0.1), materials.parchment, [0, 1.45, 0.08]);
  group.add(sign);
  const iconGeo = icon === "★" ? new THREE.OctahedronGeometry(0.22, 0) : icon === "♡" ? new THREE.SphereGeometry(0.22, 16, 10) : new THREE.BoxGeometry(0.36, 0.28, 0.08);
  group.add(mesh(iconGeo, lanternMat, [0, 1.48, 0.17]));
  const light = new THREE.PointLight(color, 14, 12);
  light.position.set(0, 2.35, 0);
  group.add(light);
  group.position.copy(position);
  group.userData.light = light;
  scene.add(group);
  return group;
}

function makeZone(zone) {
  const zoneGroup = new THREE.Group();
  const padMaterial = colorMaterial(zone.color, { emissive: zone.color });
  const pad = mesh(new THREE.CylinderGeometry(3.1, 3.5, 0.16, 32), padMaterial, [0, 0.1, 0]);
  pad.material.transparent = true;
  pad.material.opacity = 0.36;
  zoneGroup.add(pad);
  const ring = mesh(new THREE.TorusGeometry(3.3, 0.05, 8, 64), materials.gold, [0, 0.2, 0]);
  ring.rotation.x = Math.PI / 2;
  zoneGroup.add(ring);
  const lantern = makeLantern(new THREE.Vector3(0, 0, 0), zone.color, zone.icon);
  zoneGroup.add(lantern);
  zoneGroup.position.copy(zone.position);
  zoneGroup.userData.zone = zone;
  scene.add(zoneGroup);
  zoneMeshes.push(zoneGroup);
}

function createFireflies(count = 70) {
  for (let i = 0; i < count; i += 1) {
    const firefly = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), materials.firefly.clone());
    firefly.position.set((Math.random() - 0.5) * 50, 1.5 + Math.random() * 5, (Math.random() - 0.5) * 50);
    firefly.userData = {
      seed: Math.random() * 100,
      base: firefly.position.clone()
    };
    fireflies.push(firefly);
    scene.add(firefly);
  }
}

function createCat(avatar) {
  const bodyMat = colorMaterial(avatar.body);
  const headMat = colorMaterial(avatar.head);
  const pointMat = colorMaterial(avatar.point);
  const shadeMat = colorMaterial(avatar.shade);
  const stripeMat = colorMaterial(avatar.stripe);
  const eyeMat = colorMaterial(avatar.eye, { emissive: new THREE.Color(avatar.eye).getHex() });

  const group = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.72, 1.1, 5, 12), bodyMat, [0, 0.76, 0], [1.4, 0.9, 0.9]);
  body.rotation.z = Math.PI / 2;
  const head = mesh(new THREE.DodecahedronGeometry(0.62, 0), headMat, [0, 1.42, 0.62], [1.08, 0.92, 1]);
  const mask = mesh(new THREE.DodecahedronGeometry(0.34, 0), pointMat, [0, 1.36, 1.03], [1.02, 0.72, 0.38]);
  const leftEar = mesh(new THREE.ConeGeometry(0.24, 0.48, 3), pointMat, [-0.36, 1.94, 0.55]);
  const rightEar = mesh(new THREE.ConeGeometry(0.24, 0.48, 3), pointMat, [0.36, 1.94, 0.55]);
  leftEar.rotation.y = Math.PI / 3;
  rightEar.rotation.y = Math.PI / 3;
  const tailPivot = new THREE.Group();
  tailPivot.position.set(-0.9, 0.9, -0.3);
  const tail = mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.55, 9), pointMat, [-0.26, 0.52, -0.48]);
  tail.rotation.x = 0.9;
  tail.rotation.z = -0.52;
  tailPivot.add(tail);
  const eyeL = mesh(new THREE.SphereGeometry(0.065, 12, 8), eyeMat, [-0.18, 1.43, 1.1]);
  const eyeR = mesh(new THREE.SphereGeometry(0.065, 12, 8), eyeMat, [0.18, 1.43, 1.1]);
  const nose = mesh(new THREE.SphereGeometry(0.045, 10, 8), materials.pink, [0, 1.32, 1.18]);

  const legs = [
    [-0.48, 0.33, 0.42], [0.48, 0.33, 0.42], [-0.48, 0.33, -0.42], [0.48, 0.33, -0.42]
  ].map(([x, y, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, y, z);
    leg.add(mesh(new THREE.CapsuleGeometry(0.13, 0.34, 4, 8), pointMat, [0, 0, 0], [1, 1.2, 1]));
    leg.add(mesh(new THREE.SphereGeometry(0.17, 10, 8), shadeMat, [0, -0.28, 0.08], [1.25, 0.45, 1.45]));
    return leg;
  });

  const stripes = [];
  if (avatar.id !== "siamese") {
    for (let i = 0; i < 6; i += 1) {
      const stripe = mesh(new THREE.BoxGeometry(0.08, 0.025, 0.52), stripeMat, [-0.42 + i * 0.17, 1.98, 0.5]);
      stripe.rotation.x = 0.5;
      stripe.rotation.z = (i % 2 ? -0.32 : 0.32);
      stripes.push(stripe);
    }
  }

  const whiskers = [
    [[-0.08, 1.31, 1.16], [-0.54, 1.42, 1.24]],
    [[0.08, 1.31, 1.16], [0.54, 1.42, 1.24]],
    [[-0.08, 1.27, 1.16], [-0.55, 1.22, 1.25]],
    [[0.08, 1.27, 1.16], [0.55, 1.22, 1.25]]
  ].map(([a, b]) => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const whisker = mesh(new THREE.CylinderGeometry(0.008, 0.008, direction.length(), 6), materials.white);
    whisker.position.copy(start.clone().lerp(end, 0.5));
    whisker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return whisker;
  });

  group.add(body, head, mask, leftEar, rightEar, tailPivot, eyeL, eyeR, nose, ...legs, ...stripes, ...whiskers);
  scene.add(group);
  catParts = { body, head, tailPivot, legs };

  catBody = new CANNON.Body({
    mass: 1,
    fixedRotation: true,
    material: catMaterial,
    linearDamping: 0.68,
    angularDamping: 0.9
  });
  catBody.addShape(new CANNON.Sphere(0.72), new CANNON.Vec3(0, 0.9, 0));
  catBody.position.set(0, 1.2, 19);
  physicsWorld.addBody(catBody);

  catGroup = group;
  syncCatMesh();
}

function syncCatMesh() {
  catGroup.position.set(catBody.position.x, catBody.position.y - 0.85, catBody.position.z);
}

function resetCat() {
  catBody.position.set(0, 1.2, 19);
  catBody.velocity.set(0, 0, 0);
  catBody.angularVelocity.set(0, 0, 0);
  cameraYaw = 0;
  syncCatMesh();
}

function buildWorld() {
  setupLights();
  makeGround();
  populateForest();
  zoneData.forEach(makeZone);
  createFireflies(qualityHigh ? 80 : 32);
  createCat(selectedAvatar);
}

function startForest(avatar) {
  selectedAvatar = avatar;
  avatarSelect.classList.add("is-hidden");
  hud.classList.remove("is-hidden");
  buildWorld();
  sceneStarted = true;
  window.setTimeout(() => welcomeModal.classList.remove("is-hidden"), 260);
  canvas.focus();
}

function openPanel(zone) {
  panelKicker.textContent = zone.kicker;
  panelTitle.textContent = zone.title;
  panelBody.textContent = zone.body;
  panelGallery.innerHTML = "";
  zone.slots.forEach((slot) => {
    const item = document.createElement("div");
    item.className = "panel-slot";
    item.textContent = slot;
    panelGallery.appendChild(item);
  });
  contentPanel.classList.add("is-visible");
  openedPanel = true;
}

function closePanel() {
  contentPanel.classList.remove("is-visible");
  openedPanel = false;
  canvas.focus();
}

function closeDrawers() {
  mapDrawer.classList.remove("is-visible");
  optionsDrawer.classList.remove("is-visible");
  helpDrawer.classList.remove("is-visible");
}

function updateNearbyZone() {
  activeZone = null;
  let nearestDistance = Infinity;
  zoneMeshes.forEach((zoneMesh) => {
    const distance = zoneMesh.position.distanceTo(catGroup.position);
    if (distance < 5.2 && distance < nearestDistance) {
      nearestDistance = distance;
      activeZone = zoneMesh.userData.zone;
      reusableVec3.copy(zoneMesh.position).add(new THREE.Vector3(0, 3.7, 0));
    }
  });

  if (activeZone && !openedPanel) {
    const screen = reusableVec3.clone().project(camera);
    interactPrompt.style.left = `${(screen.x * 0.5 + 0.5) * 100}%`;
    interactPrompt.style.top = `${(-screen.y * 0.5 + 0.5) * 100}%`;
    interactLabel.textContent = window.matchMedia("(pointer: coarse)").matches ? "Tap to open" : "Press E to open";
    interactPrompt.classList.add("is-visible");
    interactPrompt.setAttribute("aria-hidden", "false");
  } else {
    interactPrompt.classList.remove("is-visible");
    interactPrompt.setAttribute("aria-hidden", "true");
  }
}

function readInputVector() {
  const forward = keys.has("w") || keys.has("arrowup");
  const back = keys.has("s") || keys.has("arrowdown");
  const left = keys.has("a") || keys.has("arrowleft");
  const right = keys.has("d") || keys.has("arrowright");
  const vector = new THREE.Vector2(Number(right) - Number(left), Number(back) - Number(forward));
  vector.add(joystickVector);
  if (vector.lengthSq() > 1) vector.normalize();
  return vector;
}

function updateMovement(delta) {
  if (!sceneStarted || openedPanel) return;
  const input = readInputVector();
  const yawMatrix = new THREE.Matrix4().makeRotationY(cameraYaw);
  const direction = new THREE.Vector3(input.x, 0, input.y).applyMatrix4(yawMatrix);
  const speed = 10.5;
  catBody.velocity.x += (direction.x * speed - catBody.velocity.x) * Math.min(1, delta * 7.5);
  catBody.velocity.z += (direction.z * speed - catBody.velocity.z) * Math.min(1, delta * 7.5);

  const isMoving = Math.abs(catBody.velocity.x) + Math.abs(catBody.velocity.z) > 0.35;
  if (isMoving) {
    catGroup.rotation.y = THREE.MathUtils.lerp(catGroup.rotation.y, Math.atan2(catBody.velocity.x, catBody.velocity.z), 1 - Math.pow(0.001, delta));
  }

  walkTime += delta * (isMoving ? 9 : 1.6);
  const stride = Math.sin(walkTime);
  catParts.body.rotation.y = isMoving ? stride * 0.04 : Math.sin(walkTime) * 0.01;
  catParts.head.rotation.x = isMoving ? -0.07 + Math.abs(stride) * 0.04 : Math.sin(walkTime * 0.7) * 0.02;
  catParts.tailPivot.rotation.y = Math.sin(walkTime * 0.8) * (isMoving ? 0.42 : 0.2);
  catParts.legs.forEach((leg, index) => {
    const phase = Math.sin(walkTime + (index % 2 ? Math.PI : 0));
    leg.rotation.x = phase * (isMoving ? 0.62 : 0.05);
  });
}

function updateCamera(delta) {
  if (!catGroup) return;
  const target = catGroup.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  const offset = new THREE.Vector3(0, 8.4, 13.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
  camera.position.lerp(target.clone().add(offset), 1 - Math.pow(0.012, delta));
  camera.lookAt(target);
}

function updateFireflies(elapsed) {
  const max = qualityHigh ? fireflies.length : Math.min(32, fireflies.length);
  fireflies.forEach((firefly, index) => {
    firefly.visible = index < max;
    if (!firefly.visible) return;
    const seed = firefly.userData.seed;
    const base = firefly.userData.base;
    firefly.position.set(
      base.x + Math.sin(elapsed * 0.8 + seed) * 0.7,
      base.y + Math.sin(elapsed * 1.4 + seed) * 0.35,
      base.z + Math.cos(elapsed * 0.7 + seed) * 0.7
    );
    firefly.material.opacity = 0.45 + Math.sin(elapsed * 4 + seed) * 0.35;
  });
}

function updateMap() {
  if (!catGroup) return;
  const x = THREE.MathUtils.clamp((catGroup.position.x + boundary) / (boundary * 2), 0, 1);
  const y = THREE.MathUtils.clamp((catGroup.position.z + boundary) / (boundary * 2), 0, 1);
  mapPlayer.style.left = `${x * 100}%`;
  mapPlayer.style.top = `${y * 100}%`;
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  if (sceneStarted) {
    updateMovement(delta);
    physicsWorld.step(1 / 60, delta, 3);
    catBody.position.x = THREE.MathUtils.clamp(catBody.position.x, -boundary, boundary);
    catBody.position.z = THREE.MathUtils.clamp(catBody.position.z, -boundary, boundary);
    syncCatMesh();
    updateNearbyZone();
    updateCamera(delta);
    updateMap();
  }
  updateFireflies(clock.elapsedTime);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function startAudio() {
  if (!audioOn || audioContext) return;
  audioContext = new AudioContext();
  ambienceGain = audioContext.createGain();
  ambienceGain.gain.value = 0.035;
  ambienceGain.connect(audioContext.destination);
  [196, 261.63, 329.63].forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.18 / (index + 1);
    osc.connect(gain);
    gain.connect(ambienceGain);
    osc.start();
  });
}

function setAudioEnabled(enabled) {
  audioOn = enabled;
  audioToggle.textContent = `Audio: ${audioOn ? "On" : "Off"}`;
  document.querySelector("[data-hud='sound']").textContent = audioOn ? "♪" : "×";
  if (audioOn) {
    startAudio();
    if (audioContext?.state === "suspended") audioContext.resume();
    if (ambienceGain) ambienceGain.gain.value = 0.035;
  } else if (ambienceGain) {
    ambienceGain.gain.value = 0;
  }
}

function setQuality(high) {
  qualityHigh = high;
  renderer.shadowMap.enabled = high;
  qualityToggle.textContent = `Graphics: ${qualityHigh ? "High" : "Low"}`;
}

function updateJoystick(event) {
  const dx = event.clientX - joystickCenter.x;
  const dy = event.clientY - joystickCenter.y;
  const max = 42;
  const length = Math.min(max, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * length;
  const y = Math.sin(angle) * length;
  joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  joystickVector.set(x / max, y / max);
}

welcomeClose.addEventListener("click", () => {
  welcomeModal.classList.add("is-hidden");
  canvas.focus();
});

panelClose.addEventListener("click", closePanel);

interactPrompt.addEventListener("click", () => {
  if (activeZone) openPanel(activeZone);
});

document.querySelectorAll("[data-hud]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.hud;
    if (action === "home") resetCat();
    if (action === "sound") setAudioEnabled(!audioOn);
    if (action === "map") {
      const visible = mapDrawer.classList.contains("is-visible");
      closeDrawers();
      mapDrawer.classList.toggle("is-visible", !visible);
    }
    if (action === "options") {
      const visible = optionsDrawer.classList.contains("is-visible");
      closeDrawers();
      optionsDrawer.classList.toggle("is-visible", !visible);
    }
    if (action === "help") {
      const visible = helpDrawer.classList.contains("is-visible");
      closeDrawers();
      helpDrawer.classList.toggle("is-visible", !visible);
    }
  });
});

document.querySelectorAll("[data-close-drawer]").forEach((button) => button.addEventListener("click", closeDrawers));
audioToggle.addEventListener("click", () => setAudioEnabled(!audioOn));
qualityToggle.addEventListener("click", () => setQuality(!qualityHigh));
stuckButton.addEventListener("click", resetCat);

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key.toLowerCase() === "e" && activeZone && !openedPanel) openPanel(activeZone);
  if (event.key === "Escape") {
    closePanel();
    closeDrawers();
    welcomeModal.classList.add("is-hidden");
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

canvas.addEventListener("pointerdown", (event) => {
  if (event.target.closest?.("#joystick")) return;
  draggingCamera = true;
  dragStartX = event.clientX;
});

window.addEventListener("pointerup", (event) => {
  if (event.pointerId === joystickPointerId) {
    joystickPointerId = null;
    joystickVector.set(0, 0);
    joystickKnob.style.transform = "translate(-50%, -50%)";
  }
  draggingCamera = false;
});

window.addEventListener("pointermove", (event) => {
  if (event.pointerId === joystickPointerId) {
    updateJoystick(event);
    return;
  }
  if (!draggingCamera) return;
  const dx = event.clientX - dragStartX;
  dragStartX = event.clientX;
  cameraYaw -= dx * 0.006;
});

joystick.addEventListener("pointerdown", (event) => {
  joystickPointerId = event.pointerId;
  const rect = joystick.getBoundingClientRect();
  joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
});

window.addEventListener("resize", resize);

resize();
hud.classList.add("is-hidden");
setAudioEnabled(false);
animate();
