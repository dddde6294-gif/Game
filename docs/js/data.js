// Game content: themes, worlds, skins, flips and tricks.
// After changing WORLDS, run `node tools/make-levels.mjs` to rebuild js/levels.js.

// deco: what is scattered in the background. style: tower texture.
export const THEMES = {
  backyard: { skyTop: '#3d9bff', skyBottom: '#d6efff', ground: '#5dbb4a', tower: '#b7793f', stripe: '#8d5a2b', style: 'planks', deco: 'trees', sun: 1.0, mat: '#2f7cf6' },
  park:     { skyTop: '#4aa3ff', skyBottom: '#e3f4ff', ground: '#6ccf55', tower: '#f2f2f2', stripe: '#e64545', style: 'stripes', deco: 'trees', sun: 1.0, mat: '#f59e0b' },
  rooftop:  { skyTop: '#5b9fe0', skyBottom: '#dce9f5', ground: '#8a929c', tower: '#5d6d82', stripe: '#a9d6ff', style: 'windows', deco: 'buildings', sun: 1.0, mat: '#ef4444' },
  canyon:   { skyTop: '#ff9d5c', skyBottom: '#ffe0b8', ground: '#c9683a', tower: '#a64b2a', stripe: '#7f3519', style: 'rock', deco: 'rocks', sun: 1.0, mat: '#0ea5e9' },
  jungle:   { skyTop: '#2bb3a6', skyBottom: '#c9f5e3', ground: '#2f8f3a', tower: '#556b2f', stripe: '#2e4d1a', style: 'rock', deco: 'jungle', sun: 0.9, mat: '#f43f5e' },
  beach:    { skyTop: '#1e90ff', skyBottom: '#c8f3ff', ground: '#f2d7a0', tower: '#ffffff', stripe: '#e53935', style: 'stripes', deco: 'palms', sun: 1.1, mat: '#06b6d4' },
  sunset:   { skyTop: '#7b3fb8', skyBottom: '#ffb36b', ground: '#d9a066', tower: '#5a3a6e', stripe: '#3c2450', style: 'rock', deco: 'palms', sun: 0.8, mat: '#22c55e' },
  night:    { skyTop: '#060b24', skyBottom: '#2a2f6b', ground: '#2b2f3a', tower: '#1f2433', stripe: '#ffd66b', style: 'windows', deco: 'buildings', sun: 0.45, stars: true, mat: '#a855f7' },
  snow:     { skyTop: '#7fb7e8', skyBottom: '#f0f8ff', ground: '#f4f8fb', tower: '#bfe3f5', stripe: '#8cc8e8', style: 'ice', deco: 'pines', snowy: true, sun: 1.0, mat: '#ef4444' },
  aurora:   { skyTop: '#04132b', skyBottom: '#1f7a6c', ground: '#dfe9f2', tower: '#2d3b55', stripe: '#6ef0c8', style: 'ice', deco: 'pines', snowy: true, sun: 0.5, stars: true, mat: '#f97316' },
  volcano:  { skyTop: '#2b0a0a', skyBottom: '#c2410c', ground: '#2a1d1a', tower: '#3b2a26', stripe: '#ff6a00', style: 'lava', deco: 'volcano', sun: 0.6, mat: '#38bdf8' },
  moon:     { skyTop: '#000000', skyBottom: '#10142a', ground: '#9a9a9a', tower: '#d0d4dc', stripe: '#ef4444', style: 'stripes', deco: 'craters', sun: 1.0, stars: true, earth: true, mat: '#3b82f6' },
  clouds:   { skyTop: '#9ec9ff', skyBottom: '#fff0fa', ground: '#ffffff', tower: '#fff7e0', stripe: '#f5c542', style: 'stripes', deco: 'clouds', sun: 1.1, mat: '#ec4899' },
  space:    { skyTop: '#000008', skyBottom: '#23407a', ground: '#4d7a5a', tower: '#c9d1dc', stripe: '#3b82f6', style: 'windows', deco: 'clouds', sun: 1.0, stars: true, mat: '#f43f5e' },
};

// 10 worlds x 10 levels. Towers get taller and taller; the Moon has low gravity.
export const WORLDS = [
  { name: 'Backyard', themes: ['backyard', 'park'],
    names: ['Backyard', 'Park Bench', 'Treehouse', 'Playground', 'Garden Wall', 'Picnic Hill', 'Big Oak', 'Duck Pond', 'Bounce Castle', 'Kite Hill'] },
  { name: 'City Rooftops', themes: ['rooftop'],
    names: ['Rooftop', 'Water Tower', 'Billboard', 'Pizza Shop', 'Crane', 'Bridge Tower', 'Clock Tower', 'Antenna', 'Helipad', 'Skyscraper'] },
  { name: 'Red Canyon', themes: ['canyon'],
    names: ['Red Canyon', 'Dusty Mesa', 'Eagle Rock', 'Cactus Cliff', 'Dry Falls', 'Snake Ridge', 'Stone Arch', 'Coyote Point', 'Sun Pillar', 'Grand Drop'] },
  { name: 'Jungle', themes: ['jungle'],
    names: ['Jungle Falls', 'Vine Swing', 'Monkey Tree', 'Parrot Peak', 'Temple Steps', 'Hidden Falls', 'Tiger Rock', 'Banana Top', 'Canopy', 'Lost Temple'] },
  { name: 'Sunny Beach', themes: ['beach', 'sunset'],
    names: ['Lighthouse', 'Sunset Cliffs', 'Palm Point', 'Coral Cliff', 'Shark Rock', 'Surf Tower', 'Pirate Cove', 'Seagull Ledge', 'Tidal Tower', 'Golden Hour'] },
  { name: 'Night City', themes: ['night'],
    names: ['Night City', 'Neon Tower', 'Moon Roof', 'Midnight Spire', 'Laser Tower', 'Starlight', 'Dark Deck', 'Owl Tower', 'Glow Top', 'City Crown'] },
  { name: 'Snow Peaks', themes: ['snow', 'aurora'],
    names: ['Snow Peak', 'Ice Wall', 'Frost Tower', 'Penguin Point', 'Aurora Ridge', 'Glacier', 'Yeti Cliff', 'Blizzard', 'Polar Spire', 'Aurora Summit'] },
  { name: 'Volcano', themes: ['volcano'],
    names: ['Volcano', 'Ash Cliff', 'Lava Falls', 'Magma Tower', 'Fire Peak', 'Obsidian', 'Smoke Stack', 'Ember Ridge', 'Inferno', 'Dragon Peak'] },
  { name: 'Moon', themes: ['moon'], gravity: 5, jump: 5, terminal: 30,
    names: ['Moon Base', 'Crater Rim', 'Lunar Lander', 'Rover Ramp', 'Moon Dust', 'Dark Side', 'Satellite', 'Space Dock', 'Crater King', 'Moon Throne'] },
  { name: 'Edge of Space', themes: ['clouds', 'clouds', 'clouds', 'clouds', 'space', 'space', 'space', 'space', 'space', 'space'],
    names: ['Cloud Kingdom', 'Sky Castle', 'Jet Stream', 'Stratosphere', 'Weather Balloon', 'Space Ladder', 'Orbit Gate', 'Star Bridge', 'Space Elevator', 'Edge of Space'] },
];

// colors: shirt, pants, skin, shoes, hat (+ extra for capes/beards) + spin trail.
// hat / face / back: accessories. fx: special material effects.
export const SKINS = [
  { id: 'rookie',  name: 'Rookie',      price: 0,     icon: '🧢', hat: 'cap',
    colors: { shirt: '#3b82f6', pants: '#334155', skin: '#f1c27d', shoes: '#ef4444', hat: '#ef4444', trail: '#60a5fa' } },
  { id: 'ninja',   name: 'Ninja',       price: 100,   icon: '🥷', hat: 'headband',
    colors: { shirt: '#1f2937', pants: '#111827', skin: '#e0ac69', shoes: '#111827', hat: '#dc2626', trail: '#ef4444' } },
  { id: 'cowboy',  name: 'Cowboy',      price: 150,   icon: '🤠', hat: 'cowboy',
    colors: { shirt: '#b45309', pants: '#1e3a8a', skin: '#f1c27d', shoes: '#78350f', hat: '#92400e', trail: '#f59e0b' } },
  { id: 'astro',   name: 'Astronaut',   price: 250,   icon: '🚀', hat: 'helmet',
    colors: { shirt: '#f5f5f5', pants: '#e5e5e5', skin: '#f1c27d', shoes: '#9ca3af', hat: '#f5f5f5', trail: '#e0f2fe' } },
  { id: 'pirate',  name: 'Pirate',      price: 300,   icon: '🏴‍☠️', hat: 'pirate', face: 'patch',
    colors: { shirt: '#f5f5f5', pants: '#111827', skin: '#e0ac69', shoes: '#111827', hat: '#111827', trail: '#dc2626' } },
  { id: 'zombie',  name: 'Zombie',      price: 400,   icon: '🧟', hat: 'hair',
    colors: { shirt: '#5b7a99', pants: '#4b3a2a', skin: '#8fbf6a', shoes: '#3f3f46', hat: '#2f2f2f', trail: '#84cc16' } },
  { id: 'kitty',   name: 'Kitty',       price: 500,   icon: '🐱', hat: 'catears', face: 'pinknose',
    colors: { shirt: '#fb923c', pants: '#fdba74', skin: '#fed7aa', shoes: '#fb923c', hat: '#fb923c', trail: '#fdba74' } },
  { id: 'robot',   name: 'Robot',       price: 600,   icon: '🤖', hat: 'antenna', fx: 'metal',
    colors: { shirt: '#9ca3af', pants: '#6b7280', skin: '#cbd5e1', shoes: '#374151', hat: '#22d3ee', trail: '#22d3ee' } },
  { id: 'bunny',   name: 'Bunny',       price: 700,   icon: '🐰', hat: 'bunnyears', face: 'pinknose',
    colors: { shirt: '#fbcfe8', pants: '#f9a8d4', skin: '#fff1f2', shoes: '#f9a8d4', hat: '#fff1f2', trail: '#f9a8d4' } },
  { id: 'chef',    name: 'Chef',        price: 800,   icon: '👨‍🍳', hat: 'chef',
    colors: { shirt: '#ffffff', pants: '#374151', skin: '#f1c27d', shoes: '#111827', hat: '#ffffff', trail: '#fde68a' } },
  { id: 'lava',    name: 'Lava Demon',  price: 900,   icon: '😈', hat: 'horns', fx: 'lava',
    colors: { shirt: '#1c1917', pants: '#1c1917', skin: '#ff5a1f', shoes: '#ff5a1f', hat: '#1c1917', trail: '#ff6a00' } },
  { id: 'frog',    name: 'Froggy',      price: 1000,  icon: '🐸', hat: 'none', face: 'frog',
    colors: { shirt: '#4ade80', pants: '#16a34a', skin: '#4ade80', shoes: '#15803d', hat: '#ffffff', trail: '#86efac' } },
  { id: 'fire',    name: 'Firefighter', price: 1200,  icon: '🧑‍🚒', hat: 'firehelmet',
    colors: { shirt: '#d6a756', pants: '#3f3f46', skin: '#f1c27d', shoes: '#111827', hat: '#dc2626', trail: '#f97316' } },
  { id: 'gold',    name: 'Gold King',   price: 1500,  icon: '👑', hat: 'crown', fx: 'shiny',
    colors: { shirt: '#f5c542', pants: '#d4a017', skin: '#f1c27d', shoes: '#b8860b', hat: '#ffd700', trail: '#ffd700' } },
  { id: 'snowman', name: 'Snowman',     price: 1800,  icon: '⛄', hat: 'tophat', face: 'carrot',
    colors: { shirt: '#ffffff', pants: '#f1f5f9', skin: '#ffffff', shoes: '#1f2937', hat: '#111827', trail: '#e0f2fe' } },
  { id: 'ghost',   name: 'Ghost',       price: 2000,  icon: '👻', hat: 'halo', fx: 'ghost',
    colors: { shirt: '#ffffff', pants: '#e0f2fe', skin: '#ffffff', shoes: '#e0f2fe', hat: '#fde047', trail: '#bae6fd' } },
  { id: 'pumpkin', name: 'Pumpkin',     price: 2500,  icon: '🎃', hat: 'stem', face: 'glow',
    colors: { shirt: '#1f2937', pants: '#111827', skin: '#f97316', shoes: '#111827', hat: '#16a34a', trail: '#f97316' } },
  { id: 'rainbow', name: 'Rainbow',     price: 3000,  icon: '🌈', hat: 'cap', fx: 'rainbow',
    colors: { shirt: '#ff0000', pants: '#312e81', skin: '#f1c27d', shoes: '#ffffff', hat: '#ffffff', trail: 'rainbow' } },
  { id: 'knight',  name: 'Knight',      price: 3500,  icon: '🛡️', hat: 'knight', fx: 'armor',
    colors: { shirt: '#cbd5e1', pants: '#94a3b8', skin: '#e2e8f0', shoes: '#64748b', hat: '#dc2626', trail: '#e2e8f0' } },
  { id: 'wizard',  name: 'Wizard',      price: 5000,  icon: '🧙', hat: 'wizard', face: 'beard',
    colors: { shirt: '#6d28d9', pants: '#5b21b6', skin: '#f1c27d', shoes: '#4c1d95', hat: '#6d28d9', extra: '#f8fafc', trail: '#c4b5fd' } },
  { id: 'alien',   name: 'Alien',       price: 7000,  icon: '👽', hat: 'antennae', face: 'alien',
    colors: { shirt: '#94a3b8', pants: '#64748b', skin: '#86efac', shoes: '#475569', hat: '#86efac', trail: '#4ade80' } },
  { id: 'dino',    name: 'Dino',        price: 9000,  icon: '🦖', hat: 'none', back: 'spikes',
    colors: { shirt: '#22c55e', pants: '#15803d', skin: '#22c55e', shoes: '#166534', hat: '#facc15', trail: '#4ade80' } },
  { id: 'clown',   name: 'Clown',       price: 12000, icon: '🤡', hat: 'wig', face: 'rednose',
    colors: { shirt: '#facc15', pants: '#3b82f6', skin: '#ffffff', shoes: '#ef4444', hat: '#ef4444', trail: 'rainbow' } },
  { id: 'hero',    name: 'Super Hero',  price: 16000, icon: '🦸', hat: 'mask', back: 'cape',
    colors: { shirt: '#2563eb', pants: '#1d4ed8', skin: '#f1c27d', shoes: '#dc2626', hat: '#111827', extra: '#dc2626', trail: '#ef4444' } },
  { id: 'shadow',  name: 'Shadow',      price: 22000, icon: '🌑', hat: 'none', fx: 'shadow',
    colors: { shirt: '#0a0a0a', pants: '#0a0a0a', skin: '#171717', shoes: '#0a0a0a', hat: '#a855f7', trail: '#a855f7' } },
  { id: 'diamond', name: 'Diamond',     price: 30000, icon: '💎', hat: 'gem', fx: 'diamond',
    colors: { shirt: '#67e8f9', pants: '#22d3ee', skin: '#cffafe', shoes: '#06b6d4', hat: '#a5f3fc', trail: '#67e8f9' } },
  { id: 'galaxy',  name: 'Galaxy',      price: 45000, icon: '🌌', hat: 'halo', fx: 'galaxy',
    colors: { shirt: '#4c1d95', pants: '#1e1b4b', skin: '#312e81', shoes: '#1e1b4b', hat: '#f0abfc', trail: 'rainbow' } },
];

// Flip styles: how you spin while holding the screen.
// speed: spin speed. mult: coin multiplier. twist: full twists per flip. dir -1 = forwards.
export const FLIPS = [
  { id: 'backflip',  icon: '🔄', name: 'Backflip',    price: 0,     speed: 1.0,  mult: 1.0, pose: 'tuck',   twist: 0, desc: 'The classic. Tuck and spin!' },
  { id: 'frontflip', icon: '🔃', name: 'Frontflip',   price: 100,   speed: 1.0,  mult: 1.3, pose: 'tuck',   twist: 0, dir: -1, desc: 'Flip forwards instead of backwards!' },
  { id: 'layout',    icon: '📏', name: 'Layout',      price: 250,   speed: 0.85, mult: 1.6, pose: 'layout', twist: 0, desc: 'Straight body. Slower spin, more coins.' },
  { id: 'pike',      icon: '📐', name: 'Pike',        price: 500,   speed: 0.95, mult: 1.5, pose: 'pike',   twist: 0, desc: 'Legs straight. Touch your toes!' },
  { id: 'twister',   icon: '🌪️', name: 'Twister',     price: 900,   speed: 1.0,  mult: 2.0, pose: 'tuck',   twist: 1, desc: 'A full twist on every flip. 2x coins!' },
  { id: 'rocket',    icon: '⚡', name: 'Rocket Tuck', price: 1500,  speed: 1.45, mult: 1.3, pose: 'rocket', twist: 0, desc: 'Super tight tuck. Spins way faster!' },
  { id: 'cork',      icon: '🍾', name: 'Double Cork', price: 3500,  speed: 1.2,  mult: 3.0, pose: 'layout', twist: 2, desc: 'Two twists per flip. 3x coins!' },
  { id: 'turbo',     icon: '🚀', name: 'Turbo Tuck',  price: 8000,  speed: 1.9,  mult: 1.8, pose: 'rocket', twist: 0, desc: 'The fastest flip in the game!' },
  { id: 'corkscrew', icon: '🌀', name: 'Corkscrew',   price: 18000, speed: 1.35, mult: 4.0, pose: 'layout', twist: 3, desc: 'Three twists per flip. 4x coins!' },
  { id: 'galaxy',    icon: '🌌', name: 'Galaxy Spin', price: 40000, speed: 1.8,  mult: 5.0, pose: 'rocket', twist: 2, desc: 'Super fast with two twists. 5x coins!' },
];

// Button tricks: tap a trick button while in the air. Finish it before you land!
// time: seconds it takes. coins: coins earned (times the level bonus). turns: extra spins.
export const TRICKS = [
  { id: 'superman', icon: '🦸', name: 'Superman',    price: 0,     time: 0.5,  coins: 5,  desc: 'Stretch out like you can fly.' },
  { id: 'star',     icon: '⭐', name: 'Star Jump',   price: 80,    time: 0.45, coins: 6,  desc: 'Arms and legs out wide!' },
  { id: 'twist',    icon: '🔁', name: 'Air Twist',   price: 200,   time: 0.55, coins: 8,  turns: 1, desc: 'Spin around once like a pencil.' },
  { id: 'kick',     icon: '🥋', name: 'Karate Kick', price: 350,   time: 0.5,  coins: 9,  desc: 'Hi-yah!' },
  { id: 'split',    icon: '🤸', name: 'Split',       price: 600,   time: 0.6,  coins: 12, desc: 'One leg front, one leg back.' },
  { id: 'toetouch', icon: '🙌', name: 'Toe Touch',   price: 1000,  time: 0.6,  coins: 14, desc: 'Legs wide, reach for your toes!' },
  { id: 'bike',     icon: '🚲', name: 'Bicycle',     price: 1800,  time: 0.8,  coins: 20, desc: 'Pedal in the air!' },
  { id: 'guitar',   icon: '🎸', name: 'Air Guitar',  price: 3000,  time: 0.8,  coins: 24, desc: 'Rock out in mid-air!' },
  { id: 'dab',      icon: '😎', name: 'Dab',         price: 5000,  time: 0.4,  coins: 18, desc: 'Quick and cool. The fastest trick!' },
  { id: 'heli',     icon: '🚁', name: 'Helicopter',  price: 8000,  time: 0.9,  coins: 36, turns: 3, desc: 'Spin three times with arms out!' },
  { id: 'moonwalk', icon: '🕺', name: 'Moonwalk',    price: 14000, time: 1.0,  coins: 45, desc: 'Walk on air!' },
  { id: 'tornado',  icon: '🌀', name: 'Tornado',     price: 25000, time: 1.1,  coins: 60, turns: 5, desc: 'Five spins in a star shape. Wow!' },
];

export const MAX_BUTTONS = 4;

export const FLIP_NAMES = ['', '', 'DOUBLE', 'TRIPLE', 'QUAD', 'QUINT', 'SEXTUPLE', 'SEPTUPLE', 'OCTUPLE', 'NONUPLE', 'DECUPLE'];
