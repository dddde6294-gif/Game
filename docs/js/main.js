import * as THREE from '../vendor/three.module.min.js';
import { LEVELS, THEMES, SKINS, TRICKS, FLIP_NAMES } from './data.js';
import { Character, HIP_HEIGHT } from './character.js';
import { World, MAT_TOP } from './world.js';
import { initAudio, setSoundEnabled, setWind, sfx } from './audio.js';

const TAU = Math.PI * 2;
const STEP = 1 / 120;                 // fixed physics step (keeps jumps identical every time)
const PHYS = { gravity: 14, jump: 7, vx: 2.6, terminal: 22 };
const SPIN = TAU / 0.72;              // one backflip every 0.72s while holding
const LAND_TOL = 0.72;                // ~41° from upright still counts as a landing
const PERFECT_TOL = 0.2;              // ~11° = perfect landing
const START_X = -0.45;                // where you stand on the tower (edge is x = 0)

// ---------- Save data (stored on this device) ----------
const SAVE_KEY = 'skyflip-save-v1';
const save = Object.assign(
  { coins: 0, skins: ['rookie'], tricks: ['backflip'], skin: 'rookie', trick: 'backflip',
    unlocked: 1, level: 0, best: {}, cleared: {}, sound: true },
  loadSave(),
);
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}
const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
const trickById = (id) => TRICKS.find((t) => t.id === id) || TRICKS[0];

// ---------- Three.js setup ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2600);
let portrait = false;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  portrait = camera.aspect < 0.8;
  camera.fov = portrait ? 62 : 50;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

const world = new World(scene);
const hero = new Character();
scene.add(hero.root);
hero.applySkin(skinById(save.skin));

// Blob shadow under the player (helps you time the landing)
const shadowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.9)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, fog: false }));
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

// ---------- Coins floating along the jump ----------
const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24);
coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: '#ffcc1a', metalness: 0.4, roughness: 0.3, emissive: '#c78a00', emissiveIntensity: 0.55 });
let coins = [];

// ---------- Particles ----------
const particles = [];
const partGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
for (let i = 0; i < 160; i++) {
  const mesh = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  mesh.visible = false;
  scene.add(mesh);
  particles.push({ mesh, life: 0, max: 1, vel: new THREE.Vector3(), grav: 0, spin: 0, size: 1, grow: 0 });
}
let partCursor = 0;
function emit(pos, color, { vel = null, spread = 1, life = 0.6, grav = 0, size = 1, grow = 0 } = {}) {
  const p = particles[partCursor];
  partCursor = (partCursor + 1) % particles.length;
  p.mesh.visible = true;
  p.mesh.position.copy(pos);
  p.mesh.material.color.set(color);
  p.mesh.material.opacity = 1;
  p.vel.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
  if (vel) p.vel.add(vel);
  p.life = p.max = life;
  p.grav = grav;
  p.spin = (Math.random() - 0.5) * 12;
  p.size = size;
  p.grow = grow;
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.mesh.visible = false; continue; }
    p.vel.y -= p.grav * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += p.spin * dt;
    p.mesh.rotation.y += p.spin * dt;
    const k = p.life / p.max;
    p.mesh.material.opacity = Math.min(1, k * 1.5);
    p.mesh.scale.setScalar(p.size * (1 + p.grow * (1 - k)));
  }
}
const tmpV = new THREE.Vector3();
function dust(x, y, n = 14, color = '#ffffff') {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    emit(tmpV.set(x, y + 0.1, 0), color, { vel: new THREE.Vector3(Math.cos(a) * 2.5, 0.8 + Math.random(), Math.sin(a) * 2.5), spread: 0.5, life: 0.5, size: 1.4, grow: 1.5 });
  }
}
function confetti(x, y) {
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#fde047'];
  for (let i = 0; i < 70; i++) {
    emit(tmpV.set(x, y, 0), colors[i % colors.length], { vel: new THREE.Vector3((Math.random() - 0.5) * 7, 5 + Math.random() * 6, (Math.random() - 0.5) * 7), spread: 1, life: 1.8, grav: 9, size: 0.9 });
  }
}

// ---------- Game state ----------
const G = {
  state: 'menu',          // menu | store | intro | ready | air | landed | crashed
  levelIndex: 0, level: LEVELS[0], theme: THEMES.backyard, phys: PHYS, info: null,
  x: START_X, y: 0, vx: 0, vy: 0, angle: 0, omega: 0, trick: TRICKS[0],
  t: 0, stateTime: 0, flipsShown: 0, airCoins: 0, streak: 0,
  angleTarget: 0, twistTarget: 0, restY: 0, landedFlips: 0,
  panel: false, trailTimer: 0, shake: 0, introDur: 1, acc: 0,
  demo: { active: false, t: 0, dur: 1, trick: TRICKS[0] }, demoTimer: 0,
};
const pointers = new Set();
let holding = false;

const camPos = new THREE.Vector3(8, 6, 12);
const camLook = new THREE.Vector3(0, 3, 0);
const wantPos = new THREE.Vector3();
const wantLook = new THREE.Vector3();

// Runs the same physics as the game to find how long a jump lasts and where it lands.
function simulate(phys, fromY, onStep) {
  let x = START_X, y = fromY, vy = phys.jump, t = 0;
  while (t < 60) {
    vy = Math.max(vy - phys.gravity * STEP, -phys.terminal);
    x += phys.vx * STEP;
    y += vy * STEP;
    t += STEP;
    if (onStep) onStep(t, x, y);
    if (y - HIP_HEIGHT <= MAT_TOP && vy < 0) break;
  }
  return { t, x };
}

function setState(s) {
  G.state = s;
  G.stateTime = 0;
  el.hint.classList.toggle('hidden', s !== 'ready');
  el.altimeter.classList.toggle('hidden', !(s === 'ready' || s === 'air'));
}

function startLevel(i, { intro = true } = {}) {
  G.levelIndex = i;
  G.level = LEVELS[i];
  G.theme = THEMES[G.level.theme];
  G.phys = {
    ...PHYS,
    gravity: G.level.gravity ?? PHYS.gravity,
    jump: G.level.jump ?? PHYS.jump,
    terminal: G.level.terminal ?? PHYS.terminal,
  };
  const top = G.level.height;
  const land = simulate(G.phys, top + HIP_HEIGHT);
  G.info = world.build(G.level, G.theme, land.x, i + 1);
  document.body.style.background = G.theme.skyBottom;
  spawnCoins(top);
  save.level = i;
  persist();
  G.streak = 0;
  placeOnTower();
  updateHud();
  if (intro) {
    showScreen(null);
    setState('intro');
    G.introDur = 1.3 + Math.min(top / 70, 1.8);
  }
}

function spawnCoins(top) {
  for (const c of coins) scene.remove(c.mesh);
  coins = [];
  const path = [];
  const land = simulate(G.phys, top + HIP_HEIGHT, (t, x, y) => path.push({ t, x, y }));
  const n = Math.min(3 + G.levelIndex, 14);
  const value = 1 + Math.floor(G.levelIndex / 2);
  for (let k = 0; k < n; k++) {
    const t = 0.3 + (land.t - 0.65) * (n === 1 ? 0.5 : k / (n - 1));
    const p = path[Math.min(path.length - 1, Math.round(t / STEP))];
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.position.set(p.x + 0.25, p.y + (k % 2 ? 0.35 : -0.15), 0);
    scene.add(mesh);
    coins.push({ mesh, home: mesh.position.clone(), taken: false, anim: 0, value });
  }
}

function resetCoins() {
  for (const c of coins) {
    c.taken = false;
    c.anim = 0;
    c.mesh.visible = true;
    c.mesh.scale.setScalar(1);
    c.mesh.position.copy(c.home);
  }
}

function placeOnTower() {
  G.x = START_X;
  G.y = G.level.height + HIP_HEIGHT;
  G.vx = G.vy = 0;
  G.angle = 0;
  G.omega = 0;
  hero.flip.rotation.z = 0;
  hero.twist.rotation.y = 0;
  hero.snapPose('stand');
  resetCoins();
  el.flip.className = '';
  el.flip.style.opacity = 0;
}

function nextAttempt() {
  placeOnTower();
  setState('ready');
}

// ---------- Input ----------
function press() {
  initAudio();
  holding = true;
  if (G.state === 'ready') jump();
  else if (G.state === 'intro') setState('ready');
  else if ((G.state === 'landed' || G.state === 'crashed') && G.stateTime > 0.5 && !G.panel) nextAttempt();
}
function release() {
  holding = pointers.size > 0;
}
const touchLayer = document.getElementById('touch');
touchLayer.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  pointers.add(e.pointerId);
  press();
});
const endPointer = (e) => { pointers.delete(e.pointerId); release(); };
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
touchLayer.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
touchLayer.addEventListener('touchend', () => initAudio());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.repeat || !['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code)) return;
  if (!['intro', 'ready', 'air', 'landed', 'crashed'].includes(G.state)) return;
  e.preventDefault();
  pointers.add('key');
  press();
});
window.addEventListener('keyup', (e) => {
  if (!['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code)) return;
  pointers.delete('key');
  release();
});
function dropInput() { pointers.clear(); holding = false; setWind(0); }
window.addEventListener('blur', dropInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) dropInput(); });

// ---------- Jumping, flipping, landing ----------
function jump() {
  G.trick = trickById(save.trick);
  G.vx = G.phys.vx;
  G.vy = G.phys.jump;
  G.angle = 0;
  G.omega = 0;
  G.flipsShown = 0;
  G.airCoins = 0;
  G.acc = 0;
  setState('air');
  hero.setPose('launch', 20);
  sfx.jump();
  dust(G.x, G.level.height, 8);
}

function stepAir() {
  const target = holding ? SPIN * G.trick.speed : 0;
  const rate = holding ? 16 : 20;
  G.omega += (target - G.omega) * (1 - Math.exp(-rate * STEP));
  G.angle += G.omega * STEP;
  G.vy = Math.max(G.vy - G.phys.gravity * STEP, -G.phys.terminal);
  G.x += G.vx * STEP;
  G.y += G.vy * STEP;
  if (G.y - HIP_HEIGHT <= MAT_TOP && G.vy < 0) {
    G.y = MAT_TOP + HIP_HEIGHT;
    land();
  }
}

// angle folded into (-PI, PI]; 0 means perfectly upright
function uprightError(angle) {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

function land() {
  const a = uprightError(G.angle);
  setWind(0);
  el.flip.classList.remove('pop');
  el.flip.style.opacity = 0;
  if (Math.abs(a) < LAND_TOL) {
    const flips = Math.max(0, Math.round(G.angle / TAU));
    const perfect = Math.abs(a) < PERFECT_TOL;
    G.angleTarget = flips * TAU;
    G.twistTarget = flips * TAU * G.trick.twist;
    G.landedFlips = flips;
    setState('landed');
    hero.setPose('crouch', 25);
    sfx.land();
    if (perfect && flips > 0) setTimeout(() => sfx.perfect(), 120);
    dust(G.x, MAT_TOP, 16);
    G.shake = 0.12;
    scoreLanding(flips, perfect);
  } else {
    crash(a);
  }
}

function crash(a) {
  setState('crashed');
  G.streak = 0;
  const base = G.angle - a;
  G.angleTarget = base + (a > 0 ? Math.PI / 2 : -Math.PI / 2);
  G.twistTarget = Math.round((G.angle * G.trick.twist) / TAU) * TAU;
  G.vy = 3.2;
  G.vx *= 0.5;
  G.restY = MAT_TOP + 0.24;
  hero.setPose('lying', 10);
  sfx.crash();
  G.shake = 0.55;
  dust(G.x, MAT_TOP, 26);
  const msgs = ['OUCH!', 'CRASH!', 'BONK!', 'OOF!', 'WIPEOUT!'];
  const sub = G.airCoins ? `Land on your feet! · +${G.airCoins} coins` : 'Land on your feet!';
  toast(`<div class="big bad">${msgs[Math.floor(Math.random() * msgs.length)]}</div><div class="sub">${sub}</div>`);
  updateStreak();
}

function flipName(flips, trick) {
  const base = trick.name.toUpperCase();
  if (flips === 1) return base + '!';
  return `${FLIP_NAMES[flips] || flips + 'x'} ${base}!`;
}

function scoreLanding(flips, perfect) {
  const L = G.level, i = G.levelIndex;
  let earned = 0;
  if (flips > 0) {
    G.streak++;
    const streakMult = 1 + Math.min(G.streak - 1, 10) * 0.1;
    earned = Math.round(5 * flips * (1 + i * 0.5) * G.trick.mult * (perfect ? 1.5 : 1) * streakMult);
    addCoins(earned);
  } else {
    G.streak = 0;
  }
  updateStreak();
  if (flips > (save.best[i] || 0)) save.best[i] = flips;

  const cleared = flips >= L.req;
  const firstClear = cleared && !save.cleared[i];
  let big, subs = [];
  if (flips === 0) {
    big = 'NICE LANDING';
    subs.push('Hold longer to flip!');
  } else {
    big = flipName(flips, G.trick);
    subs.push(`+${earned} coins${G.streak > 1 ? ` · streak x${(1 + Math.min(G.streak - 1, 10) * 0.1).toFixed(1)}` : ''}`);
  }
  if (perfect && flips > 0) subs.unshift('<span class="perfect">★ PERFECT LANDING ★</span>');
  if (!cleared) subs.push(`Need ${L.req} flip${L.req > 1 ? 's' : ''} to clear`);
  else if (!firstClear) subs.push('Level cleared ✔');

  if (firstClear) {
    save.cleared[i] = true;
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, i + 2));
    const bonus = 40 * (i + 1);
    addCoins(bonus);
    G.panel = true;
    toast(`<div class="big">${big}</div>`);
    setTimeout(() => showComplete(flips, earned, bonus), 900);
  } else {
    toast(`<div class="big">${big}</div>${subs.map((s) => `<div class="sub">${s}</div>`).join('')}`);
  }
  persist();
  updateHud();
}

function starsFor(i) {
  const best = save.best[i] || 0, req = LEVELS[i].req;
  if (!save.cleared[i]) return 0;
  return best >= req + 2 ? 3 : best >= req + 1 ? 2 : 1;
}
function starsHtml(n) {
  return [0, 1, 2].map((k) => `<span class="${k < n ? 'on' : 'off'}">★</span>`).join('');
}

function addCoins(n) {
  if (!n) return;
  save.coins += n;
  persist();
  for (const c of document.querySelectorAll('.coin-count, #hud-coins')) c.textContent = save.coins;
  for (const p of document.querySelectorAll('.coins-pill')) {
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
  }
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const el = {
  hud: $('hud'), level: $('hud-level'), goal: $('hud-goal'), coins: $('hud-coins'),
  flip: $('flip-counter'), hint: $('hint'), toast: $('toast'), streak: $('streak'),
  altimeter: $('altimeter'), altMarker: $('alt-marker'), altText: $('alt-text'),
  menu: $('menu'), levels: $('levels'), store: $('store'), complete: $('complete'),
  levelGrid: $('level-grid'), storeGrid: $('store-grid'), storeDesc: $('store-desc'), buy: $('btn-buy'),
  sound: $('btn-sound'),
};

function showScreen(name) {
  for (const s of ['menu', 'levels', 'store', 'complete']) el[s].classList.toggle('hidden', s !== name);
  el.hud.classList.toggle('hidden', name !== null && name !== 'complete');
  touchLayer.style.pointerEvents = name === null ? 'auto' : 'none';
  for (const c of document.querySelectorAll('.coin-count, #hud-coins')) c.textContent = save.coins;
}

function updateHud() {
  const L = G.level;
  el.level.textContent = `Lv ${G.levelIndex + 1} · ${L.name}`;
  const best = save.best[G.levelIndex] || 0;
  el.goal.textContent = `🎯 ${L.req} flip${L.req > 1 ? 's' : ''} · ${L.height} m${best ? ` · best ${best}` : ''}`;
  el.coins.textContent = save.coins;
}

function updateStreak() {
  el.streak.classList.toggle('hidden', G.streak < 2);
  el.streak.textContent = `🔥 Streak x${G.streak}`;
}

let toastTimer = 0;
function toast(html) {
  el.toast.innerHTML = html;
  el.toast.classList.remove('show');
  void el.toast.offsetWidth;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1800);
}

function showFlipCount(n) {
  el.flip.textContent = `${n} FLIP${n > 1 ? 'S' : ''}`;
  el.flip.classList.remove('pop');
  void el.flip.offsetWidth;
  el.flip.style.opacity = '';
  el.flip.classList.add('pop');
}

function showComplete(flips, earned, bonus) {
  const i = G.levelIndex;
  const last = i === LEVELS.length - 1;
  $('complete-title').textContent = last ? 'YOU BEAT SKYFLIP!' : 'LEVEL COMPLETE!';
  $('complete-stars').innerHTML = starsHtml(starsFor(i));
  const next = LEVELS[i + 1];
  $('complete-lines').innerHTML = [
    `${flips} flip${flips > 1 ? 's' : ''} landed · +${earned} coins`,
    `<span class="gold">Clear bonus +${bonus} coins</span>`,
    next ? `Next: ${next.name} · ${next.height} m tall!` : 'You are a flip legend! 🏆',
  ].join('<br>');
  $('btn-next').classList.toggle('hidden', last);
  showScreen('complete');
  sfx.win();
  confetti(G.x, G.y + 1);
}

$('btn-next').addEventListener('click', () => {
  sfx.click();
  G.panel = false;
  startLevel(Math.min(G.levelIndex + 1, LEVELS.length - 1));
});
$('btn-replay').addEventListener('click', () => {
  sfx.click();
  G.panel = false;
  showScreen(null);
  nextAttempt();
});
$('btn-complete-store').addEventListener('click', () => {
  G.panel = false;
  openStore();
});

$('btn-play').addEventListener('click', () => {
  initAudio();
  sfx.click();
  startLevel(Math.min(save.level, save.unlocked - 1));
});
$('btn-levels').addEventListener('click', () => { initAudio(); sfx.click(); renderLevels(); showScreen('levels'); });
$('btn-store').addEventListener('click', () => { initAudio(); sfx.click(); openStore(); });
$('btn-pause').addEventListener('click', () => { sfx.click(); goMenu(); });
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { sfx.click(); goMenu(); });

function goMenu() {
  if (G.state === 'store') hero.applySkin(skinById(save.skin));
  dropInput();
  G.panel = false;
  placeOnTower();
  setState('menu');
  showScreen('menu');
}

el.sound.textContent = save.sound ? '🔊' : '🔇';
setSoundEnabled(save.sound);
el.sound.addEventListener('click', () => {
  initAudio();
  save.sound = !save.sound;
  setSoundEnabled(save.sound);
  el.sound.textContent = save.sound ? '🔊' : '🔇';
  persist();
  sfx.click();
});

function renderLevels() {
  el.levelGrid.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const th = THEMES[L.theme];
    const locked = i >= save.unlocked;
    const b = document.createElement('button');
    b.className = 'level-card' + (locked ? ' locked' : '');
    b.style.setProperty('--c1', th.skyTop);
    b.style.setProperty('--c2', th.ground);
    b.innerHTML = `<div class="num">LEVEL ${i + 1}</div><div class="name">${L.name}</div>
      <div class="meta">${L.height} m · ${L.req} flip${L.req > 1 ? 's' : ''}${L.gravity ? ' · low gravity' : ''}</div>
      <div class="stars">${starsHtml(starsFor(i))}</div>`;
    b.addEventListener('click', () => {
      if (locked) { sfx.nope(); return; }
      sfx.click();
      startLevel(i);
    });
    el.levelGrid.appendChild(b);
  });
}

// ---------- Store ----------
let storeTab = 'skins';
let storeSel = save.skin;

function openStore() {
  storeSel = storeTab === 'skins' ? save.skin : save.trick;
  placeOnTower();
  setState('store');
  showScreen('store');
  renderStore();
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    sfx.click();
    storeTab = tab.dataset.tab;
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
    storeSel = storeTab === 'skins' ? save.skin : save.trick;
    hero.applySkin(skinById(save.skin));
    renderStore();
  });
}

function renderStore() {
  const list = storeTab === 'skins' ? SKINS : TRICKS;
  const owned = storeTab === 'skins' ? save.skins : save.tricks;
  const equipped = storeTab === 'skins' ? save.skin : save.trick;
  el.storeGrid.innerHTML = '';
  for (const item of list) {
    const b = document.createElement('button');
    b.className = 'item' + (item.id === storeSel ? ' selected' : '');
    const bg = storeTab === 'skins'
      ? `linear-gradient(135deg, ${item.colors.shirt} 50%, ${item.colors.hat} 50%)`
      : 'linear-gradient(135deg, #f59e0b, #ef4444)';
    let tag;
    if (item.id === equipped) tag = '<span class="tag eq">EQUIPPED</span>';
    else if (owned.includes(item.id)) tag = '<span class="tag">OWNED</span>';
    else tag = `<span class="price"><span class="coin-icon"></span>${item.price}</span>`;
    b.innerHTML = `<div class="swatch" style="background:${bg}">${item.icon}</div><div class="iname">${item.name}</div>${tag}`;
    b.addEventListener('click', () => {
      sfx.click();
      storeSel = item.id;
      if (storeTab === 'skins') hero.applySkin(item);
      else startDemo(item);
      renderStore();
    });
    el.storeGrid.appendChild(b);
  }
  updateStoreAction();
}

function updateStoreAction() {
  const isSkin = storeTab === 'skins';
  const item = isSkin ? skinById(storeSel) : trickById(storeSel);
  const owned = (isSkin ? save.skins : save.tricks).includes(item.id);
  const equipped = (isSkin ? save.skin : save.trick) === item.id;
  el.storeDesc.innerHTML = isSkin
    ? `<b>${item.name}</b><br>${owned ? 'Looking good!' : 'Tap Buy to unlock this skin.'}`
    : `<b>${item.name}</b> · ${item.mult}x coins<br>${item.desc}`;
  el.buy.disabled = false;
  if (equipped) { el.buy.textContent = 'Equipped ✔'; el.buy.disabled = true; }
  else if (owned) el.buy.textContent = 'Equip';
  else if (save.coins >= item.price) el.buy.textContent = `Buy · ${item.price}`;
  else { el.buy.textContent = `Need ${item.price - save.coins}`; el.buy.disabled = true; }
}

el.buy.addEventListener('click', () => {
  const isSkin = storeTab === 'skins';
  const item = isSkin ? skinById(storeSel) : trickById(storeSel);
  const ownedList = isSkin ? save.skins : save.tricks;
  if (!ownedList.includes(item.id)) {
    if (save.coins < item.price) { sfx.nope(); return; }
    addCoins(-item.price);
    ownedList.push(item.id);
    sfx.buy();
    confetti(START_X, G.level.height + 1.5);
  } else {
    sfx.click();
  }
  if (isSkin) save.skin = item.id; else save.trick = item.id;
  persist();
  renderStore();
});

function startDemo(trick) {
  G.demo.active = true;
  G.demo.t = 0;
  G.demo.trick = trick;
  G.demo.dur = 0.95 / trick.speed;
}

// ---------- Main loop ----------
function smooth(k, dt) { return 1 - Math.exp(-k * dt); }

function update(dt) {
  const top = G.level.height;

  // Menu & store: idle on the tower, show off tricks now and then
  if (G.state === 'menu' || G.state === 'store') {
    if (G.state === 'menu') {
      G.demoTimer += dt;
      if (G.demoTimer > 3.2 && !G.demo.active) { G.demoTimer = 0; startDemo(trickById(save.trick)); }
    }
    let hop = 0;
    if (G.demo.active) {
      const d = G.demo;
      d.t += dt;
      const p = Math.min(1, d.t / d.dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      hop = Math.sin(p * Math.PI) * (G.state === 'store' ? 0.8 : 1.3);
      G.angle = e * TAU;
      hero.setPose(p < 0.12 ? 'launch' : p < 0.8 ? d.trick.pose : 'stand', 16);
      hero.twist.rotation.y = G.angle * d.trick.twist;
      if (p >= 1) { d.active = false; G.angle = 0; hero.twist.rotation.y = 0; }
    } else {
      hero.setPose('stand', 8);
    }
    G.x = START_X;
    G.y = top + HIP_HEIGHT + hop;
  }

  if (G.state === 'intro' && G.stateTime >= G.introDur) setState('ready');

  if (G.state === 'air') {
    G.acc += dt;
    while (G.acc >= STEP && G.state === 'air') { stepAir(); G.acc -= STEP; }
  }

  if (G.state === 'air') {
    // pose follows the button: tuck while holding, open up to land
    const height = G.y - HIP_HEIGHT - MAT_TOP;
    const timeToLand = height / Math.max(1, -G.vy);
    if (holding && G.stateTime > 0.06) hero.setPose(G.trick.pose, 16);
    else if (G.vy > 0) hero.setPose('launch', 12);
    else if (timeToLand < 0.45) hero.setPose('stand', 14);
    else hero.setPose('flail', 8);
    hero.twist.rotation.y = G.angle * G.trick.twist;

    const done = Math.floor((G.angle + 0.35) / TAU);
    if (done > G.flipsShown) {
      G.flipsShown = done;
      showFlipCount(done);
      sfx.flip(done);
    }

    // spin trail
    G.trailTimer -= dt;
    if (G.omega > 4 && G.trailTimer <= 0) {
      G.trailTimer = 0.018;
      const tc = skinById(save.skin).colors.trail;
      const color = tc === 'rainbow' ? new THREE.Color().setHSL((G.t * 0.8) % 1, 0.9, 0.6) : tc;
      for (const f of hero.feet) {
        f.getWorldPosition(tmpV);
        emit(tmpV, color, { spread: 0.2, life: 0.45, size: 0.9 });
      }
    }

    // coins
    for (const c of coins) {
      if (c.taken) continue;
      if (Math.hypot(c.mesh.position.x - G.x, c.mesh.position.y - G.y) < 1.25) {
        c.taken = true;
        G.airCoins += c.value;
        addCoins(c.value);
        sfx.coin();
        for (let k = 0; k < 6; k++) emit(c.mesh.position, '#ffe066', { spread: 3, life: 0.4, size: 0.7 });
      }
    }
    setWind(Math.max(0, -G.vy) / 22);
  }

  if (G.state === 'landed') {
    G.angle += (G.angleTarget - G.angle) * smooth(20, dt);
    hero.twist.rotation.y += (G.twistTarget - hero.twist.rotation.y) * smooth(20, dt);
    if (G.stateTime > 0.22) hero.setPose(G.landedFlips > 0 ? 'cheer' : 'stand', 10);
    if (G.stateTime > 1.9 && !G.panel) nextAttempt();
  }

  if (G.state === 'crashed') {
    G.vy -= G.phys.gravity * dt;
    G.y += G.vy * dt;
    if (G.y < G.restY) { G.y = G.restY; G.vy = Math.abs(G.vy) > 1.5 ? -G.vy * 0.3 : 0; }
    G.x += G.vx * dt;
    G.vx *= Math.exp(-4 * dt);
    G.angle += (G.angleTarget - G.angle) * smooth(9, dt);
    hero.twist.rotation.y += (G.twistTarget - hero.twist.rotation.y) * smooth(9, dt);
    if (G.stateTime > 1.8) nextAttempt();
  }

  // apply to the model
  hero.root.position.set(G.x, G.y, 0);
  hero.flip.rotation.z = G.angle;
  hero.update(dt, { idle: G.state === 'ready' || ((G.state === 'menu' || G.state === 'store') && !G.demo.active) });

  // coins spin / collect animation
  for (const c of coins) {
    if (!c.taken) {
      c.mesh.rotation.y = G.t * 3 + c.home.x;
    } else if (c.mesh.visible) {
      c.anim += dt;
      c.mesh.position.y += dt * 4;
      c.mesh.rotation.y += dt * 20;
      c.mesh.scale.setScalar(Math.max(0.01, 1 - c.anim * 4));
      if (c.anim > 0.25) c.mesh.visible = false;
    }
  }

  // shadow on whatever is below
  const info = G.info;
  let surface = 0;
  if (G.x <= 0.15 && G.x >= -info.towerWidth) surface = top;
  else if (Math.abs(G.x - info.matX) < info.matHalf) surface = MAT_TOP;
  const above = Math.max(0, G.y - HIP_HEIGHT - surface);
  shadow.position.set(G.x, surface + 0.03, 0);
  shadow.material.opacity = Math.max(0.15, 0.6 - above * 0.02);
  shadow.scale.set(G.state === 'crashed' ? 2 : 1, 1, 1);

  // altimeter
  if (G.state === 'ready' || G.state === 'air') {
    const h = Math.max(0, G.y - HIP_HEIGHT - MAT_TOP);
    el.altMarker.style.top = `${(1 - Math.min(1, h / Math.max(1, top))) * 100}%`;
    el.altText.textContent = `${Math.round(h)} m`;
  }

  updateParticles(dt);
  world.update(G.t, dt, camera);
  updateCamera(dt);
}

function updateCamera(dt) {
  const top = G.level.height;
  const base = portrait ? 11 : 9;
  const readyLook = new THREE.Vector3(START_X + 1.6, top + 0.3, 0);
  const readyPos = new THREE.Vector3(START_X + 2.6, top + 2.4, base);
  let rate = 3.5;

  switch (G.state) {
    case 'menu': {
      const a = G.t * 0.25;
      wantLook.set(START_X, top + (portrait ? 0.35 : 1.0), 0);
      wantPos.set(START_X + Math.sin(a) * 6.5, top + 2.2, Math.cos(a) * 6.5);
      rate = 2.5;
      break;
    }
    case 'store':
      wantLook.set(START_X, top + (portrait ? -0.3 : 0.2), 0);
      wantPos.set(START_X + 2.2, top + 1.6, portrait ? 5.6 : 4.8);
      rate = 4;
      break;
    case 'intro': {
      const p = Math.min(1, G.stateTime / G.introDur);
      const e = p * p * (3 - 2 * p);
      const fromLook = new THREE.Vector3(G.info.matX, MAT_TOP + 1, 0);
      const fromPos = new THREE.Vector3(G.info.matX + 4, MAT_TOP + 3, base + 6);
      camLook.lerpVectors(fromLook, readyLook, e);
      camPos.lerpVectors(fromPos, readyPos, e);
      rate = 0;
      break;
    }
    case 'ready':
      wantLook.copy(readyLook);
      wantPos.copy(readyPos);
      rate = 3.2;
      break;
    case 'air': {
      const fall = Math.max(0, -G.vy);
      const ahead = Math.min(fall * 0.18, 4);
      const dist = base + Math.min(fall, 30) * 0.22;
      wantLook.set(G.x + 1.0, G.y - ahead, 0);
      wantPos.set(G.x + 1.8, G.y + 1.2, dist);
      rate = 10;
      break;
    }
    default: // landed / crashed
      wantLook.set(G.x + 0.3, MAT_TOP + 0.9, 0);
      wantPos.set(G.x + 1.4, MAT_TOP + 2.2, base * 0.8);
      rate = 4;
  }
  if (rate > 0) {
    const k = smooth(rate, dt);
    camPos.lerp(wantPos, k);
    camLook.lerp(wantLook, k);
  }
  camera.position.copy(camPos);
  if (G.shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * G.shake;
    camera.position.y += (Math.random() - 0.5) * G.shake;
    G.shake *= Math.exp(-7 * dt);
  }
  camera.lookAt(camLook);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  G.t += dt;
  G.stateTime += dt;
  update(dt);
  renderer.render(scene, camera);
}

window.__skyflip = G; // handy for debugging in the browser console

// ---------- Boot ----------
startLevel(Math.min(save.level, save.unlocked - 1), { intro: false });
setState('menu');
showScreen('menu');
camPos.set(START_X + 6, G.level.height + 3, 6);
camLook.set(START_X, G.level.height + 1, 0);

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
$('ios-tip').classList.toggle('hidden', !(isIOS && !standalone));

requestAnimationFrame((t) => {
  last = t;
  $('loading').classList.add('hidden');
  frame(t);
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
