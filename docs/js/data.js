// Game content: levels, themes, skins and tricks.

// Each level is a taller tower. `req` = flips needed in one landed jump to clear it.
export const LEVELS = [
  { name: 'Backyard',       height: 3,   req: 1, theme: 'backyard' },
  { name: 'Park',           height: 8,   req: 1, theme: 'park' },
  { name: 'Rooftop',        height: 16,  req: 2, theme: 'rooftop' },
  { name: 'Red Canyon',     height: 28,  req: 2, theme: 'canyon' },
  { name: 'Jungle Falls',   height: 40,  req: 3, theme: 'jungle' },
  { name: 'Sunset Cliffs',  height: 55,  req: 3, theme: 'sunset' },
  { name: 'Night City',     height: 72,  req: 4, theme: 'night' },
  { name: 'Snow Peak',      height: 90,  req: 5, theme: 'snow' },
  { name: 'Volcano',        height: 110, req: 6, theme: 'volcano' },
  { name: 'Cloud Kingdom',  height: 135, req: 7, theme: 'clouds' },
  { name: 'Aurora Summit',  height: 165, req: 8, theme: 'aurora' },
  { name: 'Moon Base',      height: 70,  req: 9, theme: 'moon', gravity: 5, jump: 5, terminal: 9 },
];

// deco: what is scattered in the background. tower: texture style.
export const THEMES = {
  backyard: { skyTop: '#3d9bff', skyBottom: '#d6efff', ground: '#5dbb4a', tower: '#b7793f', stripe: '#8d5a2b', style: 'planks', deco: 'trees', sun: 1.0, mat: '#2f7cf6' },
  park:     { skyTop: '#4aa3ff', skyBottom: '#e3f4ff', ground: '#6ccf55', tower: '#f2f2f2', stripe: '#e64545', style: 'stripes', deco: 'trees', sun: 1.0, mat: '#f59e0b' },
  rooftop:  { skyTop: '#5b9fe0', skyBottom: '#dce9f5', ground: '#8a929c', tower: '#5d6d82', stripe: '#a9d6ff', style: 'windows', deco: 'buildings', sun: 1.0, mat: '#ef4444' },
  canyon:   { skyTop: '#ff9d5c', skyBottom: '#ffe0b8', ground: '#c9683a', tower: '#a64b2a', stripe: '#7f3519', style: 'rock', deco: 'rocks', sun: 1.0, mat: '#0ea5e9' },
  jungle:   { skyTop: '#2bb3a6', skyBottom: '#c9f5e3', ground: '#2f8f3a', tower: '#556b2f', stripe: '#2e4d1a', style: 'rock', deco: 'jungle', sun: 0.9, mat: '#f43f5e' },
  sunset:   { skyTop: '#7b3fb8', skyBottom: '#ffb36b', ground: '#d9a066', tower: '#5a3a6e', stripe: '#3c2450', style: 'rock', deco: 'rocks', sun: 0.8, mat: '#22c55e' },
  night:    { skyTop: '#060b24', skyBottom: '#2a2f6b', ground: '#2b2f3a', tower: '#1f2433', stripe: '#ffd66b', style: 'windows', deco: 'buildings', sun: 0.45, stars: true, mat: '#a855f7' },
  snow:     { skyTop: '#7fb7e8', skyBottom: '#f0f8ff', ground: '#f4f8fb', tower: '#bfe3f5', stripe: '#8cc8e8', style: 'ice', deco: 'pines', sun: 1.0, mat: '#ef4444' },
  volcano:  { skyTop: '#2b0a0a', skyBottom: '#c2410c', ground: '#2a1d1a', tower: '#3b2a26', stripe: '#ff6a00', style: 'lava', deco: 'volcano', sun: 0.6, mat: '#38bdf8' },
  clouds:   { skyTop: '#9ec9ff', skyBottom: '#fff0fa', ground: '#ffffff', tower: '#fff7e0', stripe: '#f5c542', style: 'stripes', deco: 'clouds', sun: 1.1, mat: '#ec4899' },
  aurora:   { skyTop: '#04132b', skyBottom: '#1f7a6c', ground: '#dfe9f2', tower: '#2d3b55', stripe: '#6ef0c8', style: 'ice', deco: 'pines', sun: 0.5, stars: true, mat: '#f97316' },
  moon:     { skyTop: '#000000', skyBottom: '#10142a', ground: '#9a9a9a', tower: '#d0d4dc', stripe: '#ef4444', style: 'stripes', deco: 'craters', sun: 1.0, stars: true, earth: true, mat: '#3b82f6' },
};

// colors: shirt, pants, skin, shoes, hat + spin trail color. fx: special material effects.
export const SKINS = [
  { id: 'rookie',  name: 'Rookie',     price: 0,    colors: { shirt: '#3b82f6', pants: '#334155', skin: '#f1c27d', shoes: '#ef4444', trail: '#60a5fa', hat: '#ef4444' }, hat: 'cap', icon: '🧢' },
  { id: 'ninja',   name: 'Ninja',      price: 100,  colors: { shirt: '#1f2937', pants: '#111827', skin: '#e0ac69', shoes: '#111827', trail: '#ef4444', hat: '#dc2626' }, hat: 'headband', icon: '🥷' },
  { id: 'astro',   name: 'Astronaut',  price: 250,  colors: { shirt: '#f5f5f5', pants: '#e5e5e5', skin: '#f1c27d', shoes: '#9ca3af', trail: '#e0f2fe', hat: '#f5f5f5' }, hat: 'helmet', icon: '🚀' },
  { id: 'zombie',  name: 'Zombie',     price: 400,  colors: { shirt: '#5b7a99', pants: '#4b3a2a', skin: '#8fbf6a', shoes: '#3f3f46', trail: '#84cc16', hat: '#2f2f2f' }, hat: 'hair', icon: '🧟' },
  { id: 'robot',   name: 'Robot',      price: 600,  colors: { shirt: '#9ca3af', pants: '#6b7280', skin: '#cbd5e1', shoes: '#374151', trail: '#22d3ee', hat: '#22d3ee' }, hat: 'antenna', fx: 'metal', icon: '🤖' },
  { id: 'lava',    name: 'Lava Demon', price: 900,  colors: { shirt: '#1c1917', pants: '#1c1917', skin: '#ff5a1f', shoes: '#ff5a1f', trail: '#ff6a00', hat: '#1c1917' }, hat: 'horns', fx: 'lava', icon: '😈' },
  { id: 'gold',    name: 'Gold King',  price: 1500, colors: { shirt: '#f5c542', pants: '#d4a017', skin: '#f1c27d', shoes: '#b8860b', trail: '#ffd700', hat: '#ffd700' }, hat: 'crown', fx: 'shiny', icon: '👑' },
  { id: 'ghost',   name: 'Ghost',      price: 2000, colors: { shirt: '#ffffff', pants: '#e0f2fe', skin: '#ffffff', shoes: '#e0f2fe', trail: '#bae6fd', hat: '#fde047' }, hat: 'halo', fx: 'ghost', icon: '👻' },
  { id: 'rainbow', name: 'Rainbow',    price: 3000, colors: { shirt: '#ff0000', pants: '#312e81', skin: '#f1c27d', shoes: '#ffffff', trail: 'rainbow', hat: '#ffffff' }, hat: 'cap', fx: 'rainbow', icon: '🌈' },
];

// speed: spin speed multiplier. mult: coin multiplier. pose: body shape while spinning.
// twist: full twists per flip.
export const TRICKS = [
  { id: 'backflip', icon: '🔄', name: 'Backflip',     price: 0,    speed: 1.0,  mult: 1.0, pose: 'tuck',   twist: 0, desc: 'The classic. Tuck and spin!' },
  { id: 'layout', icon: '📏',   name: 'Layout',       price: 150,  speed: 0.85, mult: 1.6, pose: 'layout', twist: 0, desc: 'Straight body. Slower spin, more coins.' },
  { id: 'twister', icon: '🌪️',  name: 'Twister',      price: 400,  speed: 1.0,  mult: 2.0, pose: 'tuck',   twist: 1, desc: 'A full twist on every flip. 2x coins!' },
  { id: 'rocket', icon: '⚡',   name: 'Rocket Tuck',  price: 900,  speed: 1.45, mult: 1.3, pose: 'rocket', twist: 0, desc: 'Super tight tuck. Spins way faster!' },
  { id: 'cork', icon: '🍾',     name: 'Double Cork',  price: 2000, speed: 1.2,  mult: 3.0, pose: 'layout', twist: 2, desc: 'Two twists per flip. 3x coins!' },
];

export const FLIP_NAMES = ['', 'BACKFLIP', 'DOUBLE', 'TRIPLE', 'QUAD', 'QUINT', 'SEXTUPLE', 'SEPTUPLE', 'OCTUPLE', 'NONUPLE', 'DECUPLE'];
