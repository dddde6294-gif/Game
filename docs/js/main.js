import * as THREE from '../vendor/three.module.min.js';
import { THEMES, WORLDS, SKINS, FLIPS, TRICKS, MAX_BUTTONS, FLIP_NAMES } from './data.js';
import { LEVELS } from './levels.js';
import { STEP, HIP_HEIGHT, MAT_TOP, START_X, SPIN_TIME, levelPhysics, fallStep, simulate } from './physics.js';
import { Character, trickPose } from './character.js';
import { World } from './world.js';
import { initAudio, setSoundEnabled, setWind, sfx } from './audio.js';

const TAU = Math.PI * 2;
const SPIN = TAU / SPIN_TIME;           // spin speed of a basic flip
const LAND_TOL = 0.72;                  // ~41° from upright still counts as a landing
const PERFECT_TOL = 0.2;                // ~11° = perfect landing
const levelBonus = (i) => 1 + i * 0.4;  // later levels pay more coins
const byId = (list, id) => list.find((x) => x.id === id) || list[0];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

// ---------- Save data (stored on this device) ----------
const SAVE_KEY = 'skyflip-save-v1';
const save = loadSave();

function loadSave() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { /* private mode */ }
  if (raw.v !== 2) {
    // the first version called flip styles "tricks"
    raw.flips = raw.tricks;
    raw.flip = raw.trick;
    delete raw.tricks;
    delete raw.trick;
  }
  const owned = (list, ids, first) => {
    const out = (Array.isArray(ids) ? ids : []).filter((id, i, a) => a.indexOf(id) === i && list.some((x) => x.id === id));
    if (!out.includes(first)) out.unshift(first);
    return out;
  };
  const s = { sound: true, ...raw, v: 2 };
  s.skins = owned(SKINS, raw.skins, 'rookie');
  s.flips = owned(FLIPS, raw.flips, 'backflip');
  s.tricks = owned(TRICKS, raw.tricks, 'superman');
  s.buttons = (Array.isArray(raw.buttons) ? raw.buttons : ['superman']).filter((id) => s.tricks.includes(id)).slice(0, MAX_BUTTONS);
  if (!s.buttons.length) s.buttons = [s.tricks[0]];
  if (!s.skins.includes(s.skin)) s.skin = 'rookie';
  if (!s.flips.includes(s.flip)) s.flip = 'backflip';
  s.best = raw.best || {};
  s.cleared = raw.cleared || {};
  s.perfect = raw.perfect || {};
  s.coins = Math.max(0, Math.floor(Number(raw.coins) || 0));
  s.unlocked = Math.min(LEVELS.length, Math.max(1, Math.floor(Number(raw.unlocked) || 1)));
  s.level = Math.min(s.unlocked - 1, Math.max(0, Math.floor(Number(raw.level) || 0)));
  return s;
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

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
hero.applySkin(byId(SKINS, save.skin));

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
function sparkle(pos, color, n = 8) {
  for (let i = 0; i < n; i++) emit(pos, color, { spread: 4, life: 0.45, size: 0.7 });
}

// ---------- Game state ----------
const G = {
  state: 'menu',          // menu | store | intro | ready | air | landed | crashed
  levelIndex: 0, level: LEVELS[0], theme: THEMES.backyard, phys: levelPhysics(LEVELS[0]), info: null,
  x: START_X, y: 0, vx: 0, vy: 0, angle: 0, omega: 0,
  flipStyle: FLIPS[0], dir: 1,
  move: null, movesDone: [], moveCoins: 0, extraTwist: 0,   // button tricks in this jump
  t: 0, stateTime: 0, flipsShown: 0, airCoins: 0, streak: 0,
  angleTarget: 0, twistTarget: 0, restY: 0, landedFlips: 0,
  panel: false, trailTimer: 0, shake: 0, introDur: 1, acc: 0,
  demo: { active: false, t: 0, dur: 1, kind: 'flip', item: FLIPS[0] }, demoTimer: 0,
};
const pointers = new Set();
let holding = false;

const camPos = new THREE.Vector3(8, 6, 12);
const camLook = new THREE.Vector3(0, 3, 0);
const wantPos = new THREE.Vector3();
const wantLook = new THREE.Vector3();

function setState(s) {
  G.state = s;
  G.stateTime = 0;
  el.hint.classList.toggle('hidden', s !== 'ready');
  el.altimeter.classList.toggle('hidden', !(s === 'ready' || s === 'air'));
  updateTrickButtons();
}

function startLevel(i, { intro = true } = {}) {
  G.levelIndex = i;
  G.level = LEVELS[i];
  G.theme = THEMES[G.level.theme];
  G.phys = levelPhysics(G.level);
  const top = G.level.height;
  const land = simulate(G.phys, top);
  G.info = world.build(G.level, G.theme, land.x, i + 1);
  camera.far = Math.max(2600, G.info.viewDistance);
  camera.updateProjectionMatrix();
  document.body.style.background = G.theme.skyBottom;
  spawnCoins(top);
  save.level = i;
  persist();
  G.streak = 0;
  updateStreak();
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
  const land = simulate(G.phys, top, (t, x, y) => path.push({ x, y }));
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
  G.move = null;
  G.extraTwist = 0;
  hero.flip.rotation.z = 0;
  hero.twist.rotation.y = 0;
  hero.snapPose('stand');
  hero.setWind(0);
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
const PLAYING = ['intro', 'ready', 'air', 'landed', 'crashed'];
const HOLD_KEYS = ['Space', 'ArrowUp', 'KeyW', 'Enter'];
window.addEventListener('keydown', (e) => {
  if (e.repeat || !PLAYING.includes(G.state) || G.panel) return;
  const slot = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (slot >= 0) { doTrick(slot); return; }
  if (!HOLD_KEYS.includes(e.code)) return;
  e.preventDefault();
  pointers.add('key');
  press();
});
window.addEventListener('keyup', (e) => {
  if (!HOLD_KEYS.includes(e.code)) return;
  pointers.delete('key');
  release();
});
function dropInput() { pointers.clear(); holding = false; setWind(0); }
window.addEventListener('blur', dropInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) dropInput(); });

// ---------- Jumping, flipping, tricks, landing ----------
function jump() {
  G.flipStyle = byId(FLIPS, save.flip);
  G.dir = G.flipStyle.dir || 1;
  G.vx = G.phys.vx;
  G.vy = G.phys.jump;
  G.angle = 0;
  G.omega = 0;
  G.flipsShown = 0;
  G.airCoins = 0;
  G.acc = 0;
  G.move = null;
  G.movesDone = [];
  G.moveCoins = 0;
  G.extraTwist = 0;
  setState('air');
  hero.setPose('launch', 20);
  sfx.jump();
  dust(G.x, G.level.height, 8);
}

// A trick button was pressed (slot 0-3). On the tower it also jumps.
function doTrick(slot) {
  initAudio();
  const id = save.buttons[slot];
  if (!id) return;
  if (G.state === 'ready') jump();
  if (G.state !== 'air') return;
  const btn = el.tricks.children[slot];
  if (G.move) {
    if (btn) { btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope'); }
    return;
  }
  G.move = { def: byId(TRICKS, id), t: 0, slot };
  sfx.trick();
  updateTrickButtons();
}

function finishTrick() {
  const def = G.move.def;
  G.movesDone.push(def.id);
  G.moveCoins += def.coins;
  G.extraTwist += (def.turns || 0) * TAU;
  G.move = null;
  sfx.trickDone(G.movesDone.length);
  sparkle(hero.root.position, '#fde047', 10);
  el.trickPop.textContent = `${def.icon} ${def.name.toUpperCase()}!${G.movesDone.length > 1 ? ` ×${G.movesDone.length}` : ''}`;
  el.trickPop.classList.remove('pop');
  void el.trickPop.offsetWidth;
  el.trickPop.classList.add('pop');
  updateTrickButtons();
}

function stepAir() {
  const target = holding ? SPIN * G.flipStyle.speed : 0;
  const rate = holding ? 16 : 20;
  G.omega += (target - G.omega) * (1 - Math.exp(-rate * STEP));
  G.angle += G.omega * STEP * G.dir;
  if (G.move) {
    G.move.t += STEP;
    if (G.move.t >= G.move.def.time) finishTrick();
  }
  const landed = fallStep(G, G.phys);
  // coins are checked every step so fast falls can't skip past them
  for (const c of coins) {
    if (c.taken) continue;
    if (Math.hypot(c.mesh.position.x - G.x, c.mesh.position.y - G.y) < 1.25) {
      c.taken = true;
      G.airCoins += c.value;
      addCoins(c.value);
      sfx.coin();
      sparkle(c.mesh.position, '#ffe066', 6);
    }
  }
  if (landed) {
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
  hero.setWind(0);
  el.flip.classList.remove('pop');
  el.flip.style.opacity = 0;
  if (G.move) { crash(a, 'Finish your trick before you land!'); return; }
  if (Math.abs(a) < LAND_TOL) {
    const turns = Math.round(G.angle / TAU);
    const flips = Math.abs(turns);
    const perfect = Math.abs(a) < PERFECT_TOL;
    G.angleTarget = turns * TAU;
    G.twistTarget = turns * TAU * G.flipStyle.twist + G.extraTwist;
    G.landedFlips = flips;
    setState('landed');
    hero.setPose('crouch', 25);
    sfx.land();
    if (perfect && (flips > 0 || G.movesDone.length)) setTimeout(() => sfx.perfect(), 120);
    dust(G.x, MAT_TOP, 16);
    G.shake = 0.12;
    scoreLanding(flips, perfect);
  } else {
    crash(a, 'Land on your feet!');
  }
}

function crash(a, why) {
  setState('crashed');
  G.streak = 0;
  const base = G.angle - a;
  G.angleTarget = base + (a > 0 ? Math.PI / 2 : -Math.PI / 2);
  G.twistTarget = Math.round(hero.twist.rotation.y / TAU) * TAU;
  G.move = null;
  G.vy = 3.2;
  G.vx *= 0.5;
  G.restY = MAT_TOP + 0.24;
  hero.setPose('lying', 10);
  sfx.crash();
  G.shake = 0.55;
  dust(G.x, MAT_TOP, 26);
  const msgs = ['OUCH!', 'CRASH!', 'BONK!', 'OOF!', 'WIPEOUT!'];
  const sub = G.airCoins ? `${why} · +${G.airCoins} coins` : why;
  toast(`<div class="big bad">${msgs[Math.floor(Math.random() * msgs.length)]}</div><div class="sub">${sub}</div>`);
  updateStreak();
}

function flipName(flips, style) {
  const base = style.name.toUpperCase();
  if (flips === 1) return base + '!';
  return `${FLIP_NAMES[flips] || flips + 'x'} ${base}!`;
}

function goalMissing(L, flips, tricks, perfect) {
  const need = [];
  if (flips < L.flips) need.push(plural(L.flips, 'flip'));
  if (tricks < L.tricks) need.push(plural(L.tricks, 'trick'));
  if (L.perfect && !perfect) need.push('a PERFECT landing');
  return need;
}

function scoreLanding(flips, perfect) {
  const L = G.level, i = G.levelIndex;
  const tricks = G.movesDone.length;
  let earned = 0;
  if (flips > 0 || tricks > 0) {
    G.streak++;
    const streakMult = 1 + Math.min(G.streak - 1, 10) * 0.1;
    const flipCoins = 5 * flips * G.flipStyle.mult;
    earned = Math.round((flipCoins + G.moveCoins) * levelBonus(i) * (perfect ? 1.5 : 1) * streakMult);
    addCoins(earned);
  } else {
    G.streak = 0;
  }
  updateStreak();
  if (flips > (save.best[i] || 0)) save.best[i] = flips;

  const need = goalMissing(L, flips, tricks, perfect);
  const cleared = need.length === 0;
  const firstClear = cleared && !save.cleared[i];
  if (cleared && perfect) save.perfect[i] = true;

  let big;
  if (flips > 0) big = flipName(flips, G.flipStyle);
  else if (tricks === 1) big = `${byId(TRICKS, G.movesDone[0]).name.toUpperCase()}!`;
  else if (tricks > 1) big = `${tricks} TRICKS!`;
  else big = 'NICE LANDING';
  const subs = [];
  if (perfect && (flips > 0 || tricks > 0)) subs.push('<span class="perfect">★ PERFECT LANDING ★</span>');
  if (flips > 0 && tricks > 0) subs.push(`+ ${plural(tricks, 'trick')}`);
  if (earned) subs.push(`+${earned} coins${G.streak > 1 ? ` · streak x${(1 + Math.min(G.streak - 1, 10) * 0.1).toFixed(1)}` : ''}`);
  else subs.push('Hold longer to flip!');
  if (!cleared) subs.push(`Need ${need.join(' + ')}`);
  else if (!firstClear) subs.push('Level cleared ✔');

  if (firstClear) {
    save.cleared[i] = true;
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, i + 2));
    const bonus = 40 * (i + 1);
    addCoins(bonus);
    G.panel = true;
    toast(`<div class="big">${big}</div>`);
    setTimeout(() => showComplete(flips, tricks, earned, bonus), 900);
  } else {
    toast(`<div class="big">${big}</div>${subs.map((s) => `<div class="sub">${s}</div>`).join('')}`);
  }
  persist();
  updateHud();
}

function starsFor(i) {
  if (!save.cleared[i]) return 0;
  return 1 + ((save.best[i] || 0) >= LEVELS[i].flips + 1 ? 1 : 0) + (save.perfect[i] ? 1 : 0);
}
function starsHtml(n) {
  return [0, 1, 2].map((k) => `<span class="${k < n ? 'on' : 'off'}">★</span>`).join('');
}

function addCoins(n) {
  if (!n) return;
  save.coins += n;
  persist();
  for (const c of document.querySelectorAll('.coin-count, #hud-coins')) c.textContent = save.coins.toLocaleString();
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
  flip: $('flip-counter'), trickPop: $('trick-pop'), hint: $('hint'), hintGoal: $('hint-goal'),
  toast: $('toast'), streak: $('streak'), tricks: $('trick-buttons'),
  altimeter: $('altimeter'), altMarker: $('alt-marker'), altText: $('alt-text'),
  menu: $('menu'), levels: $('levels'), store: $('store'), complete: $('complete'),
  levelGrid: $('level-grid'), storeGrid: $('store-grid'), storeDesc: $('store-desc'), buy: $('btn-buy'),
  sound: $('btn-sound'), playLevel: $('play-level'),
};

function showScreen(name) {
  for (const s of ['menu', 'levels', 'store', 'complete']) el[s].classList.toggle('hidden', s !== name);
  el.hud.classList.toggle('hidden', name !== null && name !== 'complete');
  touchLayer.style.pointerEvents = name === null ? 'auto' : 'none';
  refreshCoins();
  el.playLevel.textContent = `Level ${Math.min(save.level, save.unlocked - 1) + 1} of ${LEVELS.length}`;
}

function refreshCoins() {
  for (const c of document.querySelectorAll('.coin-count, #hud-coins')) c.textContent = save.coins.toLocaleString();
}

function goalChips(L) {
  let html = `<span class="chip">🔄 ${L.flips}</span>`;
  if (L.tricks) html += `<span class="chip">✨ ${L.tricks}</span>`;
  if (L.perfect) html += '<span class="chip gold">🎯 perfect</span>';
  return html;
}
function goalSentence(L) {
  const parts = [plural(L.flips, 'flip')];
  if (L.tricks) parts.push(plural(L.tricks, 'button trick'));
  let s = 'Goal: land ' + parts.join(' + ');
  if (L.perfect) s += ' with a PERFECT landing';
  return s;
}

function updateHud() {
  const L = G.level;
  el.level.textContent = `Lv ${G.levelIndex + 1} · ${L.name} · ${L.height.toLocaleString()} m`;
  el.goal.innerHTML = goalChips(L);
  el.hintGoal.textContent = goalSentence(L) + (L.tricks ? ' · tap the trick buttons in the air!' : '');
  refreshCoins();
}

function updateStreak() {
  el.streak.classList.toggle('hidden', G.streak < 2);
  el.streak.textContent = `🔥 Streak x${G.streak}`;
}

function renderTrickButtons() {
  el.tricks.innerHTML = '';
  save.buttons.forEach((id, slot) => {
    const def = byId(TRICKS, id);
    const b = document.createElement('button');
    b.className = 'trick-btn';
    b.innerHTML = `<span class="ti">${def.icon}</span><span class="tn">${def.name}</span><span class="tk">${slot + 1}</span>`;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      doTrick(slot);
    });
    el.tricks.appendChild(b);
  });
  updateTrickButtons();
}

function updateTrickButtons() {
  const usable = G.state === 'ready' || G.state === 'air';
  [...el.tricks.children].forEach((b, i) => {
    const active = !!G.move && G.move.slot === i;
    b.classList.toggle('active', active);
    b.classList.toggle('dim', !usable || (!!G.move && !active));
    if (!active) b.style.setProperty('--p', 0);
  });
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

function showComplete(flips, tricks, earned, bonus) {
  const i = G.levelIndex;
  const last = i === LEVELS.length - 1;
  $('complete-title').textContent = last ? 'YOU BEAT ALL 100 LEVELS!' : 'LEVEL COMPLETE!';
  $('complete-stars').innerHTML = starsHtml(starsFor(i));
  const next = LEVELS[i + 1];
  const landed = [plural(flips, 'flip')];
  if (tricks) landed.push(plural(tricks, 'trick'));
  $('complete-lines').innerHTML = [
    `${landed.join(' + ')} landed · +${earned} coins`,
    `<span class="gold">Clear bonus +${bonus} coins</span>`,
    next
      ? `Next: ${next.name} · ${next.height.toLocaleString()} m tall!${next.world !== G.level.world ? `<br>🌍 New world: ${WORLDS[next.world].name}!` : ''}`
      : 'You are a flip legend! 🏆',
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
$('btn-levels').addEventListener('click', () => { initAudio(); sfx.click(); showScreen('levels'); renderLevels(); });
$('btn-store').addEventListener('click', () => { initAudio(); sfx.click(); openStore(); });
$('btn-pause').addEventListener('click', () => { sfx.click(); goMenu(); });
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { sfx.click(); goMenu(); });

function goMenu() {
  if (G.state === 'store') hero.applySkin(byId(SKINS, save.skin));
  dropInput();
  G.panel = false;
  G.demo.active = false;
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
  let focus = null;
  WORLDS.forEach((w, wi) => {
    let stars = 0;
    for (let k = 0; k < 10; k++) stars += starsFor(wi * 10 + k);
    const head = document.createElement('div');
    head.className = 'world-head';
    head.innerHTML = `<span>World ${wi + 1} · ${w.name}</span><span class="wstars">★ ${stars}/30</span>`;
    el.levelGrid.appendChild(head);
    for (let k = 0; k < 10; k++) {
      const i = wi * 10 + k;
      const L = LEVELS[i];
      const th = THEMES[L.theme];
      const locked = i >= save.unlocked;
      const b = document.createElement('button');
      b.className = 'level-card' + (locked ? ' locked' : '') + (i === save.unlocked - 1 ? ' next' : '');
      b.style.setProperty('--c1', th.skyTop);
      b.style.setProperty('--c2', th.ground);
      b.innerHTML = `<div class="num">${i + 1}</div><div class="name">${L.name}</div>
        <div class="meta">${L.height.toLocaleString()} m${L.gravity && L.gravity < 14 ? ' · 🌙' : ''}</div>
        <div class="goals">${goalChips(L)}</div>
        <div class="stars">${starsHtml(starsFor(i))}</div>`;
      b.addEventListener('click', () => {
        if (locked) { sfx.nope(); return; }
        sfx.click();
        startLevel(i);
      });
      el.levelGrid.appendChild(b);
      if (i === save.unlocked - 1) focus = b;
    }
  });
  if (focus) focus.scrollIntoView({ block: 'center' });
}

// ---------- Store ----------
const SHOP = {
  skins: { list: SKINS, owned: () => save.skins },
  flips: { list: FLIPS, owned: () => save.flips },
  tricks: { list: TRICKS, owned: () => save.tricks },
};
let storeTab = 'skins';
let storeSel = save.skin;

function equippedId(tab) {
  return tab === 'skins' ? save.skin : tab === 'flips' ? save.flip : null;
}

function openStore() {
  storeSel = storeTab === 'tricks' ? save.buttons[0] : equippedId(storeTab);
  G.demo.active = false;
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
    storeSel = storeTab === 'tricks' ? save.buttons[0] : equippedId(storeTab);
    hero.applySkin(byId(SKINS, save.skin));
    renderStore();
    el.storeGrid.scrollTop = 0;
  });
}

function renderStore() {
  const { list, owned } = SHOP[storeTab];
  el.storeGrid.innerHTML = '';
  for (const item of list) {
    const b = document.createElement('button');
    b.className = 'item' + (item.id === storeSel ? ' selected' : '');
    const bg = storeTab === 'skins'
      ? `linear-gradient(135deg, ${item.colors.shirt} 50%, ${item.colors.hat} 50%)`
      : storeTab === 'flips' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, #22d3ee, #6366f1)';
    const slot = save.buttons.indexOf(item.id);
    let tag;
    if (storeTab === 'tricks' && slot >= 0) tag = `<span class="tag eq">BUTTON ${slot + 1}</span>`;
    else if (item.id === equippedId(storeTab)) tag = '<span class="tag eq">EQUIPPED</span>';
    else if (owned().includes(item.id)) tag = '<span class="tag">OWNED</span>';
    else tag = `<span class="price"><span class="coin-icon"></span>${item.price.toLocaleString()}</span>`;
    b.innerHTML = `<div class="swatch" style="background:${bg}">${item.icon}</div><div class="iname">${item.name}</div>${tag}`;
    b.addEventListener('click', () => {
      sfx.click();
      storeSel = item.id;
      if (storeTab === 'skins') hero.applySkin(item);
      else startDemo(storeTab === 'flips' ? 'flip' : 'trick', item);
      renderStore();
    });
    el.storeGrid.appendChild(b);
    if (item.id === storeSel) requestAnimationFrame(() => b.scrollIntoView({ block: 'nearest' }));
  }
  updateStoreAction();
}

function updateStoreAction() {
  const { list, owned } = SHOP[storeTab];
  const item = byId(list, storeSel);
  const has = owned().includes(item.id);
  let desc;
  if (storeTab === 'skins') desc = has ? 'Looking good!' : 'Tap Buy to unlock this skin.';
  else if (storeTab === 'flips') desc = `${item.mult}x coins · ${item.desc}`;
  else desc = `${item.time}s · +${item.coins} coins · ${item.desc}`;
  el.storeDesc.innerHTML = `<b>${item.name}</b><br>${desc}`;
  el.buy.disabled = false;
  if (!has) {
    if (save.coins >= item.price) el.buy.textContent = `Buy · ${item.price.toLocaleString()}`;
    else { el.buy.textContent = `Need ${(item.price - save.coins).toLocaleString()}`; el.buy.disabled = true; }
  } else if (storeTab === 'tricks') {
    const on = save.buttons.includes(item.id);
    el.buy.textContent = on ? 'Remove button' : 'Add button';
    el.buy.disabled = on && save.buttons.length === 1;
  } else if (item.id === equippedId(storeTab)) {
    el.buy.textContent = 'Equipped ✔';
    el.buy.disabled = true;
  } else {
    el.buy.textContent = 'Equip';
  }
}

el.buy.addEventListener('click', () => {
  const { list, owned } = SHOP[storeTab];
  const item = byId(list, storeSel);
  if (!owned().includes(item.id)) {
    if (save.coins < item.price) { sfx.nope(); return; }
    addCoins(-item.price);
    owned().push(item.id);
    sfx.buy();
    confetti(START_X, G.level.height + 1.5);
    if (storeTab === 'tricks') {
      // new tricks go straight onto a button (replacing the oldest if all 4 are used)
      if (save.buttons.length >= MAX_BUTTONS) save.buttons.shift();
      save.buttons.push(item.id);
    }
  } else if (storeTab === 'tricks') {
    sfx.click();
    const at = save.buttons.indexOf(item.id);
    if (at >= 0) {
      if (save.buttons.length > 1) save.buttons.splice(at, 1);
    } else {
      if (save.buttons.length >= MAX_BUTTONS) save.buttons.shift();
      save.buttons.push(item.id);
    }
  } else {
    sfx.click();
  }
  if (storeTab === 'skins') save.skin = item.id;
  if (storeTab === 'flips') save.flip = item.id;
  persist();
  renderTrickButtons();
  renderStore();
});

function startDemo(kind, item) {
  G.demo = { active: true, t: 0, kind, item, dur: kind === 'flip' ? 0.95 / item.speed : item.time + 0.45 };
}

// ---------- Main loop ----------
function smooth(k, dt) { return 1 - Math.exp(-k * dt); }

function updateDemo(dt) {
  if (G.state === 'menu') {
    G.demoTimer += dt;
    if (G.demoTimer > 3.2 && !G.demo.active) {
      G.demoTimer = 0;
      if (Math.random() < 0.5) startDemo('trick', byId(TRICKS, save.buttons[Math.floor(Math.random() * save.buttons.length)]));
      else startDemo('flip', byId(FLIPS, save.flip));
    }
  }
  let hop = 0;
  const d = G.demo;
  if (d.active) {
    d.t += dt;
    const p = Math.min(1, d.t / d.dur);
    hop = Math.sin(p * Math.PI) * (G.state === 'store' ? 0.8 : 1.3);
    if (d.kind === 'flip') {
      G.angle = ease(p) * TAU * (d.item.dir || 1);
      hero.setPose(p < 0.12 ? 'launch' : p < 0.8 ? d.item.pose : 'stand', 16);
      hero.twist.rotation.y = G.angle * d.item.twist;
    } else {
      const tt = d.t - 0.2;
      G.angle = 0;
      if (tt > 0 && tt < d.item.time) {
        hero.setPoseTo(trickPose(d.item.id, tt), 22);
        hero.twist.rotation.y = (d.item.turns || 0) * TAU * ease(tt / d.item.time);
      } else {
        hero.setPose(tt <= 0 ? 'launch' : 'stand', 16);
      }
    }
    if (p >= 1) { d.active = false; G.angle = 0; hero.twist.rotation.y = 0; }
  } else {
    hero.setPose('stand', 8);
  }
  G.x = START_X;
  G.y = G.level.height + HIP_HEIGHT + hop;
}

function update(dt) {
  const top = G.level.height;

  if (G.state === 'menu' || G.state === 'store') updateDemo(dt);

  if (G.state === 'intro' && G.stateTime >= G.introDur) setState('ready');

  if (G.state === 'air') {
    G.acc += dt;
    while (G.acc >= STEP && G.state === 'air') { stepAir(); G.acc -= STEP; }
  }

  if (G.state === 'air') {
    const height = G.y - HIP_HEIGHT - MAT_TOP;
    const fall = Math.max(0, -G.vy);
    const timeToLand = height / Math.max(1, fall);
    if (G.move) hero.setPoseTo(trickPose(G.move.def.id, G.move.t), 22);
    else if (holding && G.stateTime > 0.06) hero.setPose(G.flipStyle.pose, 16);
    else if (G.vy > 0) hero.setPose('launch', 12);
    else if (timeToLand < 0.45) hero.setPose('stand', 14);
    else hero.setPose('flail', 8);
    const partial = G.move ? (G.move.def.turns || 0) * TAU * ease(Math.min(1, G.move.t / G.move.def.time)) : 0;
    hero.twist.rotation.y = G.angle * G.flipStyle.twist + G.extraTwist + partial;
    if (G.move) el.tricks.children[G.move.slot]?.style.setProperty('--p', Math.min(1, G.move.t / G.move.def.time));

    const done = Math.floor((Math.abs(G.angle) + 0.35) / TAU);
    if (done > G.flipsShown) {
      G.flipsShown = done;
      showFlipCount(done);
      sfx.flip(done);
    }

    // spin trail
    G.trailTimer -= dt;
    if (G.omega > 4 && G.trailTimer <= 0) {
      G.trailTimer = 0.018;
      const tc = byId(SKINS, save.skin).colors.trail;
      const color = tc === 'rainbow' ? new THREE.Color().setHSL((G.t * 0.8) % 1, 0.9, 0.6) : tc;
      for (const f of hero.feet) {
        f.getWorldPosition(tmpV);
        emit(tmpV, color, { spread: 0.2, life: 0.45, size: 0.9 });
      }
    }
    setWind(fall / 45);
    hero.setWind(Math.min(1, fall / 30));
  }

  if (G.state === 'landed') {
    G.angle += (G.angleTarget - G.angle) * smooth(20, dt);
    hero.twist.rotation.y += (G.twistTarget - hero.twist.rotation.y) * smooth(20, dt);
    if (G.stateTime > 0.22) hero.setPose(G.landedFlips > 0 || G.movesDone.length ? 'cheer' : 'stand', 10);
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
    el.altText.textContent = `${Math.round(h).toLocaleString()} m`;
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
  let lockY = false;

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
      // follow exactly up and down (falls can reach 180 m/s), ease sideways
      const fall = Math.max(0, -G.vy);
      const ahead = Math.min(fall * 0.12, 5);
      const dist = base + Math.min(fall, 40) * 0.18;
      wantLook.set(G.x + 1.0, G.y - ahead, 0);
      wantPos.set(G.x + 1.8, G.y + 1.2, dist);
      rate = 10;
      lockY = true;
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
  if (lockY) {
    camPos.y = wantPos.y;
    camLook.y = wantLook.y;
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
renderTrickButtons();
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
