import * as THREE from '../vendor/three.module.min.js';

export const MAT_TOP = 0.35;       // landing mat surface height
const MAT_SIZE = 3.4;

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
    this.dynamic = [];
  }

  clear() {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of [].concat(o.material)) {
          if (m.map) m.map.dispose();
          if (m.emissiveMap) m.emissiveMap.dispose();
          m.dispose();
        }
      }
    });
    for (const o of this.skyExtras || []) this.skyGroup.remove(o);
    this.group = null;
    this.dynamic = [];
  }

  // Builds the level. `landX` is where the jump will land (mat center).
  build(level, theme, landX, seed) {
    this.clear();
    const rand = rng(seed * 9973 + 17);
    const H = level.height;
    const G = new THREE.Group();
    this.group = G;
    this.skyExtras = [];
    this.scene.add(G);

    // Sky, fog and lights
    this.sky.material.uniforms.top.value.set(theme.skyTop);
    this.sky.material.uniforms.bottom.value.set(theme.skyBottom);
    this.scene.fog = new THREE.Fog(theme.skyBottom, 40 + H * 0.3, 320 + H * 1.5);
    this.hemi.color.set(theme.skyTop).lerp(new THREE.Color('#ffffff'), 0.6);
    this.hemi.groundColor.set(theme.ground).multiplyScalar(0.6);
    this.hemi.intensity = 1.1 * theme.sun + 0.35;
    this.sun.intensity = 1.9 * theme.sun;

    if (theme.stars) {
      const pts = [];
      for (let i = 0; i < 700; i++) {
        const a = rand() * Math.PI * 2, y = 0.05 + rand() * 0.95, r = Math.sqrt(1 - y * y);
        pts.push(Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
      this.skyGroup.add(stars);
      this.skyExtras.push(stars);
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
    const gTex = groundTexture(theme.ground, rand);
    gTex.repeat.set(160, 160);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400),
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
    return { towerTop: H, matX: landX, matHalf: MAT_SIZE / 2, towerWidth: W };
  }

  buildDeco(theme, H, landX, rand, G) {
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
    const place = (mesh, x, z, y = 0) => { mesh.position.set(x, y, z); G.add(mesh); return mesh; };
    // pick a spot behind the play area (z < -6) or far to the sides
    const spot = () => {
      const x = -60 + rand() * (landX + 120);
      const z = -8 - rand() * 90;
      return [x, z];
    };

    const deco = theme.deco;
    const count = 55;
    const cloudMat = (color, opacity) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, transparent: opacity < 1, opacity, emissive: color, emissiveIntensity: 0.25 });
    const groundCloud = cloudMat('#ffffff', 1);
    const trunk = std('#7a4a26'), leaf = std(shade(theme.ground, -0.12)), leaf2 = std(shade(theme.ground, 0.05));

    for (let i = 0; i < count; i++) {
      const [x, z] = spot();
      const s = 0.7 + rand() * 1.1;
      if (deco === 'trees' || (deco === 'jungle' && i % 2)) {
        place(new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2.2 * s, 6), trunk), x, z, 1.1 * s);
        const l = place(new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 * s, 0), rand() < 0.5 ? leaf : leaf2), x, z, 2.9 * s);
        l.rotation.set(rand(), rand(), rand());
      } else if (deco === 'jungle') {
        const hgt = 4 + rand() * 5;
        place(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, hgt, 6), trunk), x, z, hgt / 2);
        for (let k = 0; k < 5; k++) {
          const frond = place(new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), leaf2), x, z, hgt);
          frond.rotation.set(Math.PI / 2 - 0.5, (k / 5) * Math.PI * 2, 0, 'YXZ');
        }
      } else if (deco === 'buildings') {
        const bw = 4 + rand() * 6, bh = 8 + rand() * (20 + H * 0.8), bd = 4 + rand() * 6;
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
          const pool = place(new THREE.Mesh(new THREE.CircleGeometry(1.5 * s, 16),
            new THREE.MeshBasicMaterial({ color: '#ff5a00' })), x + 2, z, 0.03);
          pool.rotation.x = -Math.PI / 2;
        }
      } else if (deco === 'pines') {
        const snowy = theme.ground === '#f4f8fb' || theme.ground === '#dfe9f2';
        place(new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.25 * s, 1.2 * s, 6), trunk), x, z, 0.6 * s);
        for (let k = 0; k < 3; k++) {
          place(new THREE.Mesh(new THREE.ConeGeometry((1.5 - k * 0.35) * s, 1.8 * s, 7), std(k === 2 && snowy ? '#ffffff' : '#1f5f3a')), x, z, (1.6 + k * 1.0) * s);
        }
      } else if (deco === 'clouds') {
        this.cloud(G, x, z, groundCloud, rand, 1.4 * s);
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
      if (theme.deco === 'volcano' && i % 3 === 1) {
        const glow = new THREE.Mesh(new THREE.SphereGeometry(mh * 0.12, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff6a00', fog: false }));
        glow.position.set(m.position.x, mh - 4, m.position.z);
        G.add(glow);
      }
    }

    // Floating clouds / rocks at altitude so falls feel fast
    const floaters = Math.min(70, 6 + Math.floor(H / 3));
    const skyCloud = cloudMat(theme.stars ? shade(theme.skyBottom, 0.1) : '#ffffff', 0.92);
    for (let i = 0; i < floaters; i++) {
      const y = 6 + rand() * (H + 25);
      const x = -30 + rand() * (landX + 70);
      const near = rand() < 0.35;
      const z = near ? -6 - rand() * 6 : -14 - rand() * 50;
      if (theme.deco === 'craters') {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rand() * 1.5, 0), std('#8a8a8a'));
        rock.position.set(x, y, z);
        rock.rotation.set(rand() * 3, rand() * 3, 0);
        const spin = (rand() - 0.5) * 0.6;
        G.add(rock);
        this.dynamic.push((t, dt) => { rock.rotation.y += spin * dt; });
      } else {
        const c = this.cloud(G, x, z, skyCloud, rand, 1 + rand() * 1.8, y);
        const drift = 0.3 + rand() * 0.6;
        const x0 = c.position.x;
        this.dynamic.push((t) => { c.position.x = x0 + Math.sin(t * 0.05 * drift + x0) * 4; });
      }
    }
  }

  cloud(G, x, z, mat, rand, scale, y = 0) {
    const c = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < puffs; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry((0.9 + rand() * 0.8) * scale, 1), mat);
      p.position.set((i - puffs / 2) * 1.1 * scale, rand() * 0.4 * scale, (rand() - 0.5) * scale);
      c.add(p);
    }
    c.position.set(x, y || scale, z);
    G.add(c);
    return c;
  }

  update(t, dt, camera) {
    this.skyGroup.position.copy(camera.position);
    for (const f of this.dynamic) f(t, dt);
  }
}
