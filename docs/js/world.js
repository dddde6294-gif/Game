import * as THREE from '../vendor/three.module.min.js';
import { MAT_TOP } from './physics.js';

const MAT_SIZE = 3.4;
const SPACE_BLACK = new THREE.Color('#02030a');

function rng(seed) {
  // mulberry32: small seeded random so each level always looks the same
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

function towerTexture(theme, rand) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = theme.tower;
    g.fillRect(0, 0, w, h);
    const s = theme.stripe;
    switch (theme.style) {
      case 'planks':
        g.fillStyle = s;
        for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 3);
        for (let y = 0; y < h; y += 16) g.fillRect(((y / 16) % 2) * 60 + 20, y, 3, 16);
        break;
      case 'stripes':
        g.fillStyle = s;
        g.fillRect(0, h / 2, w, h / 2);
        break;
      case 'windows':
        for (let y = 8; y < h; y += 32) {
          for (let x = 10; x < w; x += 38) {
            g.fillStyle = rand() < 0.75 ? s : shade(theme.tower, -0.08);
            g.fillRect(x, y, 26, 18);
          }
        }
        break;
      case 'rock':
      case 'ice':
      case 'lava':
        for (let i = 0; i < 40; i++) {
          g.fillStyle = shade(theme.tower, (rand() - 0.5) * 0.12);
          g.beginPath();
          g.arc(rand() * w, rand() * h, 6 + rand() * 18, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = s;
        g.lineWidth = theme.style === 'lava' ? 4 : 2;
        for (let i = 0; i < (theme.style === 'rock' ? 4 : 7); i++) {
          g.beginPath();
          let x = rand() * w, y = rand() * h;
          g.moveTo(x, y);
          for (let k = 0; k < 4; k++) { x += (rand() - 0.5) * 50; y += rand() * 30; g.lineTo(x, y); }
          g.stroke();
        }
        break;
    }
  });
}

function groundTexture(color, rand) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = shade(color, (rand() - 0.5) * 0.1);
      g.fillRect(rand() * w, rand() * h, 2 + rand() * 4, 2 + rand() * 4);
    }
  });
}

function matTexture(color) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    for (const [r, lw] of [[110, 10], [72, 10], [36, 10]]) {
      g.lineWidth = lw;
      g.beginPath(); g.arc(w / 2, h / 2, r, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(w / 2, h / 2, 12, 0, Math.PI * 2); g.fill();
  }, false);
}

function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
      void main(){ float h = normalize(vPos).y; float t = smoothstep(-0.05, 0.6, h); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 16), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

// Collects lots of copies of one shape and draws them all at once (fast on phones).
class Batch {
  constructor() { this.items = []; }
  add(x, y, z, sx, sy = sx, sz = sx, ry = 0) { this.items.push([x, y, z, sx, sy, sz, ry]); }
  build(geometry, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, this.items.length));
    const o = new THREE.Object3D();
    this.items.forEach(([x, y, z, sx, sy, sz, ry], i) => {
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      o.rotation.set(0, ry, 0);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.count = this.items.length;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.8);
    this.sun.position.set(30, 60, 40);
    scene.add(this.hemi, this.sun);

    this.skyGroup = new THREE.Group();
    this.sky = makeSky();
    this.skyGroup.add(this.sky);
    scene.add(this.skyGroup);

    this.group = null;
    this.skyExtras = [];
    this.dynamic = [];
    this.skyTop = new THREE.Color();
    this.stars = null;
    this.starsAlways = false;
    this.altitudeSky = false;
  }

  clear() {
    const dispose = (o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of [].concat(o.material)) {
          if (m.map) m.map.dispose();
          if (m.emissiveMap) m.emissiveMap.dispose();
          m.dispose();
        }
      }
    };
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse(dispose);
    }
    for (const o of this.skyExtras) {
      this.skyGroup.remove(o);
      o.traverse(dispose);
    }
    this.group = null;
    this.skyExtras = [];
    this.dynamic = [];
    this.stars = null;
  }

  // Builds the level. `landX` is where the jump will land (mat center).
  build(level, theme, landX, seed) {
    this.clear();
    const rand = rng(seed * 9973 + 17);
    const H = level.height;
    const G = new THREE.Group();
    this.group = G;
    this.scene.add(G);

    // Sky, fog and lights
    const fogFar = 320 + H * 1.5;
    this.skyTop.set(theme.skyTop);
    this.sky.material.uniforms.top.value.set(theme.skyTop);
    this.sky.material.uniforms.bottom.value.set(theme.skyBottom);
    this.scene.fog = new THREE.Fog(theme.skyBottom, 40 + H * 0.3, fogFar);
    this.hemi.color.set(theme.skyTop).lerp(new THREE.Color('#ffffff'), 0.6);
    this.hemi.groundColor.set(theme.ground).multiplyScalar(0.6);
    this.hemi.intensity = 1.1 * theme.sun + 0.35;
    this.sun.intensity = 1.9 * theme.sun;

    // Very tall towers reach so high that the sky turns dark and starry.
    this.altitudeSky = H > 400;
    this.starsAlways = !!theme.stars;
    if (theme.stars || this.altitudeSky) {
      const pts = [];
      for (let i = 0; i < 800; i++) {
        const a = rand() * Math.PI * 2, y = 0.05 + rand() * 0.95, r = Math.sqrt(1 - y * y);
        pts.push(Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: theme.stars ? 1 : 0,
      }));
      this.skyGroup.add(this.stars);
      this.skyExtras.push(this.stars);
    }
    if (theme.earth) {
      const earth = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 24),
        new THREE.MeshStandardMaterial({ color: '#2f6fde', emissive: '#12306b', roughness: 0.8, fog: false }));
      earth.position.set(-260, 380, -700);
      const land = new THREE.Mesh(new THREE.SphereGeometry(70.5, 16, 12, 0.3, 1.4, 0.6, 1.2),
        new THREE.MeshStandardMaterial({ color: '#3fa34d', emissive: '#12391a', fog: false }));
      earth.add(land);
      this.skyGroup.add(earth);
      this.skyExtras.push(earth);
    }

    // Ground
    const size = Math.max(2400, H * 5);
    const gTex = groundTexture(theme.ground, rand);
    gTex.repeat.set(size / 15, size / 15);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ map: gTex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    G.add(ground);

    // Tower (front edge at x = 0)
    const W = 3 + Math.min(H * 0.025, 4);
    const tTex = towerTexture(theme, rand);
    tTex.repeat.set(W / 3, (H - 0.3) / 3);
    const towerMat = new THREE.MeshStandardMaterial({ map: tTex, roughness: 0.85 });
    if (theme.style === 'lava' || theme.style === 'windows') {
      towerMat.emissiveMap = tTex;
      towerMat.emissive = new THREE.Color(theme.style === 'lava' ? '#ff5500' : '#ffffff');
      towerMat.emissiveIntensity = theme.style === 'lava' ? 0.9 : (theme.stars ? 0.55 : 0.05);
    }
    const tower = new THREE.Mesh(new THREE.BoxGeometry(W, H - 0.3, W), towerMat);
    tower.position.set(-W / 2, (H - 0.3) / 2, 0);
    G.add(tower);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.3, W + 0.4),
      new THREE.MeshStandardMaterial({ color: theme.stripe, roughness: 0.6 }));
    slab.position.set(-W / 2 + 0.2, H - 0.15, 0);
    G.add(slab);
    // edge stripe so you can see the jump-off point
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.32, W + 0.42),
      new THREE.MeshStandardMaterial({ color: '#ffd400', emissive: '#806a00', emissiveIntensity: 0.3 }));
    edge.position.set(0.08, H - 0.15, 0);
    G.add(edge);
    // flag
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), new THREE.MeshStandardMaterial({ color: '#dddddd', metalness: 0.4 }));
    pole.position.set(-W + 0.4, H + 1.2, -W / 2 + 0.4);
    G.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshStandardMaterial({ color: theme.mat, side: THREE.DoubleSide }));
    flag.position.set(-W + 0.92, H + 2.05, -W / 2 + 0.4);
    G.add(flag);
    this.dynamic.push((t) => { flag.rotation.y = Math.sin(t * 3) * 0.25; });

    // Landing mat
    const mTex = matTexture(theme.mat);
    const side = new THREE.MeshStandardMaterial({ color: theme.mat, roughness: 0.8 });
    const top = new THREE.MeshStandardMaterial({ map: mTex, roughness: 0.8 });
    const mat = new THREE.Mesh(new THREE.BoxGeometry(MAT_SIZE, MAT_TOP, MAT_SIZE), [side, side, top, side, side, side]);
    mat.position.set(landX, MAT_TOP / 2, 0);
    G.add(mat);

    this.buildDeco(theme, H, landX, rand, G);
    return { towerTop: H, matX: landX, matHalf: MAT_SIZE / 2, towerWidth: W, viewDistance: fogFar + 400 };
  }

  buildDeco(theme, H, landX, rand, G) {
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
    const place = (mesh, x, z, y = 0) => { mesh.position.set(x, y, z); G.add(mesh); return mesh; };
    // pick a spot behind the play area (z < -8)
    const spot = () => [-60 + rand() * (landX + 120), -8 - rand() * 90];

    const deco = theme.deco;
    const trunk = std('#7a4a26');
    const leaf = std(shade(theme.ground, -0.12));
    const leaf2 = std(shade(theme.ground, 0.05));
    const palmLeaf = std('#2f9e44');
    const cloudPuffs = new Batch();
    const addCloud = (x, y, z, scale) => {
      const n = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        cloudPuffs.add(x + (i - n / 2) * 1.1 * scale, y + rand() * 0.4 * scale, z + (rand() - 0.5) * scale, (0.9 + rand() * 0.8) * scale);
      }
    };
    const palm = (x, z, hgt, leafMat) => {
      place(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, hgt, 6), trunk), x, z, hgt / 2);
      for (let k = 0; k < 5; k++) {
        place(new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), leafMat), x, z, hgt).rotation.set(Math.PI / 2 - 0.5, (k / 5) * Math.PI * 2, 0, 'YXZ');
      }
    };

    if (deco === 'palms') {
      // the sea behind the beach
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 3000),
        new THREE.MeshStandardMaterial({ color: '#1592c9', roughness: 0.3, emissive: '#0b4f73', emissiveIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(0, 0.3, -1560);
      G.add(sea);
    }

    for (let i = 0; i < 55; i++) {
      const [x, z] = spot();
      const s = 0.7 + rand() * 1.1;
      if (deco === 'trees' || (deco === 'jungle' && i % 2)) {
        place(new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2.2 * s, 6), trunk), x, z, 1.1 * s);
        place(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 * s, 0), rand() < 0.5 ? leaf : leaf2), x, z, 2.9 * s).rotation.set(rand(), rand(), rand());
      } else if (deco === 'jungle') {
        palm(x, z, 4 + rand() * 5, leaf2);
      } else if (deco === 'palms') {
        const bz = -8 - rand() * 45; // stay on the sand, in front of the sea
        if (i % 4 === 0) {
          // beach umbrella
          place(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), std('#e5e7eb')), x, bz, 1.1);
          place(new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.6, 8), std(['#ef4444', '#f59e0b', '#3b82f6', '#ec4899'][i % 4])), x, bz, 2.3);
        } else {
          palm(x, bz, 3.5 + rand() * 4, palmLeaf);
        }
      } else if (deco === 'buildings') {
        const bw = 4 + rand() * 6, bh = 8 + rand() * (20 + Math.min(H, 600) * 0.8), bd = 4 + rand() * 6;
        const tex = towerTexture({ ...theme, tower: shade(theme.tower, (rand() - 0.5) * 0.15) }, rand);
        tex.repeat.set(bw / 4, bh / 4);
        const m = std('#ffffff', { map: tex, flatShading: false });
        if (theme.stars) { m.emissiveMap = tex; m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = 0.6; }
        place(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m), x, z - 10, bh / 2);
      } else if (deco === 'rocks' || deco === 'volcano' || deco === 'craters') {
        const r = (deco === 'craters' ? 0.8 : 1.2) * s;
        const rock = place(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), std(shade(theme.ground, -0.1 - rand() * 0.1))), x, z, r * 0.5);
        rock.scale.y = 0.5 + rand() * 1.2;
        rock.rotation.set(rand(), rand(), rand());
        if (deco === 'craters' && i % 3 === 0) {
          const crater = place(new THREE.Mesh(new THREE.TorusGeometry(2 * s, 0.35 * s, 6, 16), std(shade(theme.ground, -0.08))), x + 3, z + 2, 0.05);
          crater.rotation.x = Math.PI / 2;
          crater.scale.z = 0.4;
        }
        if (deco === 'volcano' && i % 4 === 0) {
          const pool = place(new THREE.Mesh(new THREE.CircleGeometry(1.5 * s, 16), new THREE.MeshBasicMaterial({ color: '#ff5a00' })), x + 2, z, 0.03);
          pool.rotation.x = -Math.PI / 2;
        }
      } else if (deco === 'pines') {
        place(new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.25 * s, 1.2 * s, 6), trunk), x, z, 0.6 * s);
        for (let k = 0; k < 3; k++) {
          place(new THREE.Mesh(new THREE.ConeGeometry((1.5 - k * 0.35) * s, 1.8 * s, 7), std(k === 2 && theme.snowy ? '#ffffff' : '#1f5f3a')), x, z, (1.6 + k * 1.0) * s);
        }
      } else if (deco === 'clouds') {
        addCloud(x, 1.4 * s, z, 1.4 * s);
      }
    }

    // Distant mountains for scale
    const mtnColor = new THREE.Color(theme.ground).lerp(new THREE.Color(theme.skyBottom), 0.35);
    for (let i = 0; i < 9; i++) {
      const mh = 60 + rand() * 90 + H * 0.4;
      const m = new THREE.Mesh(new THREE.ConeGeometry(mh * 0.9, mh, 6 + Math.floor(rand() * 3)), std('#' + mtnColor.getHexString()));
      m.position.set(-300 + i * 90 + rand() * 40, mh / 2 - 2, -280 - rand() * 150);
      m.rotation.y = rand() * Math.PI;
      G.add(m);
      if (deco === 'volcano' && i % 3 === 1) {
        const glow = new THREE.Mesh(new THREE.SphereGeometry(mh * 0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff6a00', fog: false }));
        glow.position.set(m.position.x, mh - 4, m.position.z);
        G.add(glow);
      }
    }

    // Floating clouds (or space rocks) all the way up, so falls feel fast
    const floaters = Math.min(220, 8 + Math.floor(H / 4));
    const rocks = new Batch();
    for (let i = 0; i < floaters; i++) {
      const y = 6 + rand() * (H + 40);
      const x = -30 + rand() * (landX + 70);
      const z = rand() < 0.35 ? -6 - rand() * 6 : -14 - rand() * 50;
      if (deco === 'craters') rocks.add(x, y, z, 0.5 + rand() * 1.5, 0.5 + rand() * 1.5, 0.5 + rand() * 1.5, rand() * 6);
      else addCloud(x, y, z, 1 + rand() * 1.8);
    }
    if (cloudPuffs.items.length) {
      const color = theme.stars && deco !== 'clouds' ? shade(theme.skyBottom, 0.12) : '#ffffff';
      G.add(cloudPuffs.build(new THREE.IcosahedronGeometry(1, 1), std(color, { roughness: 1, emissive: color, emissiveIntensity: 0.25 })));
    }
    if (rocks.items.length) G.add(rocks.build(new THREE.DodecahedronGeometry(1, 0), std('#8a8a8a')));
  }

  update(t, dt, camera) {
    this.skyGroup.position.copy(camera.position);
    if (this.altitudeSky) {
      // higher up = darker sky with stars, like the edge of space
      const f = THREE.MathUtils.smoothstep(camera.position.y, 150, 1300);
      this.sky.material.uniforms.top.value.copy(this.skyTop).lerp(SPACE_BLACK, f * 0.95);
      if (this.stars && !this.starsAlways) this.stars.material.opacity = f;
    }
    for (const f of this.dynamic) f(t, dt);
  }
}
