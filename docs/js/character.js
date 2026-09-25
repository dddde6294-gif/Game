import * as THREE from '../vendor/three.module.min.js';
import { HIP_HEIGHT } from './physics.js';

// The model is built facing +X with feet at y = 0. The root sits at the hips so
// flips rotate around the middle of the body.

// Joint angles in radians. Limbs rotate around Z (positive = forward).
// legOut/armOut spread limbs sideways, split/armSplit/kneeSplit move left and
// right limbs in opposite directions, nod tips the head down.
const BASE = { spine: 0, hip: 0, knee: 0, shoulder: 0, armOut: 0, drop: 0, legOut: 0, split: 0, kneeSplit: 0, armSplit: 0, nod: 0 };
const KEYS = Object.keys(BASE);
const P = (o) => ({ ...BASE, ...o });

export const POSES = {
  stand:    P({ shoulder: 0.12, armOut: 0.18 }),
  crouch:   P({ spine: -0.35, hip: 1.0, knee: -1.7, shoulder: -0.7, armOut: 0.1, drop: -0.31 }),
  launch:   P({ spine: 0.12, hip: -0.1, knee: -0.2, shoulder: 2.8, armOut: 0.25 }),
  tuck:     P({ spine: -0.55, hip: 2.2, knee: -2.3, shoulder: 1.35, armOut: 0.3 }),
  rocket:   P({ spine: -0.7, hip: 2.5, knee: -2.6, shoulder: 1.6, armOut: 0.15 }),
  layout:   P({ spine: 0.15, hip: -0.12, shoulder: 2.95, armOut: 0.4 }),
  pike:     P({ spine: -0.8, hip: 1.75, shoulder: 1.55, armOut: 0.12 }),
  flail:    P({ spine: 0.2, hip: 0.5, knee: -0.6, shoulder: 2.2, armOut: 1.1 }),
  lying:    P({ hip: 0.25, knee: -0.35, shoulder: 1.7, armOut: 1.2 }),
  cheer:    P({ spine: 0.05, shoulder: 2.7, armOut: 0.7 }),
  // button tricks
  superman: P({ spine: 0.35, hip: -0.5, knee: -0.15, shoulder: 3.0, armOut: 0.08, nod: -0.3 }),
  star:     P({ spine: 0.1, shoulder: 2.2, armOut: 1.35, legOut: 0.75 }),
  twist:    P({ shoulder: 1.3, armOut: -0.45, knee: -0.1 }),
  kick:     P({ spine: -0.25, hip: 0.1, split: 1.35, shoulder: 1.2, armSplit: 0.8, armOut: 0.35 }),
  split:    P({ split: 1.45, shoulder: 0.2, armOut: 1.5 }),
  toetouch: P({ spine: -0.7, hip: 1.55, legOut: 0.85, shoulder: 1.55, armOut: 0.75 }),
  dab:      P({ spine: -0.1, shoulder: 1.9, armSplit: 0.95, armOut: 0.6, nod: 0.45 }),
  heli:     P({ shoulder: 0.15, armOut: 1.5 }),
  tornado:  P({ spine: 0.1, shoulder: 2.2, armOut: 1.35, legOut: 0.75 }),
};

// Pose for a button trick at time t (seconds since it started). Some are animated.
export function trickPose(id, t) {
  switch (id) {
    case 'bike': {
      const a = t * 14;
      return P({ spine: -0.2, hip: 1.1, split: Math.sin(a) * 0.7, knee: -1.2, kneeSplit: Math.cos(a) * 0.8, shoulder: 0.6, armOut: 0.9 });
    }
    case 'guitar':
      return P({ spine: 0.35, hip: 0.45, knee: -0.6, split: 0.3, shoulder: 1.0, armSplit: 0.35 + Math.sin(t * 22) * 0.35, armOut: 0.15, nod: 0.25 + Math.sin(t * 11) * 0.25 });
    case 'moonwalk': {
      const a = t * 9;
      return P({ spine: 0.05, split: Math.sin(a) * 0.55, knee: -0.35, kneeSplit: Math.cos(a) * 0.3, shoulder: 0.3, armSplit: -Math.sin(a) * 0.6, armOut: 0.2 });
    }
    default:
      return POSES[id] || POSES.stand;
  }
}

function capsule(radius, length, mat) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), mat);
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });

export class Character {
  constructor() {
    this.root = new THREE.Group();   // position = hips in world space
    this.flip = new THREE.Group();   // rotation.z = flip angle
    this.twist = new THREE.Group();  // rotation.y = twist angle
    this.body = new THREE.Group();   // model space (feet at 0)
    this.root.add(this.flip);
    this.flip.add(this.twist);
    this.twist.add(this.body);
    this.body.position.y = -HIP_HEIGHT;

    this.mats = {
      shirt: std(0xffffff),
      pants: std(0xffffff),
      skin: std(0xffffff),
      shoes: std(0xffffff),
      hat: std(0xffffff),
      extra: std(0xffffff, { side: THREE.DoubleSide }),
      eye: std(0x111111, { roughness: 0.3 }),
    };
    const M = this.mats;

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.36), M.pants);
    pelvis.position.y = 0.95;
    this.body.add(pelvis);

    // Spine: torso, head and arms
    this.spine = new THREE.Group();
    this.spine.position.y = 1.0;
    this.body.add(this.spine);
    const torso = capsule(0.21, 0.32, M.shirt);
    torso.position.y = 0.3;
    torso.scale.set(0.9, 1, 1.12);
    this.spine.add(torso);

    this.head = new THREE.Group();
    this.head.position.y = 0.76;
    this.spine.add(this.head);
    this.head.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), M.skin));
    this.eyes = [];
    const eyeGeo = new THREE.SphereGeometry(0.045, 10, 8);
    for (const z of [0.1, -0.1]) {
      const eye = new THREE.Mesh(eyeGeo, M.eye);
      eye.position.set(0.25, 0.05, z);
      eye.scale.set(0.6, 1.2, 1);
      this.head.add(eye);
      this.eyes.push(eye);
    }
    this.acc = new THREE.Group();      // hats and face things (on the head)
    this.head.add(this.acc);
    this.backAcc = new THREE.Group();  // capes and spikes (on the back)
    this.spine.add(this.backAcc);
    this.accMats = [];
    this.spinners = [];
    this.cape = null;

    this.arms = [];
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.52, 0.29 * side);
      const arm = capsule(0.075, 0.42, M.shirt);
      arm.position.y = -0.25;
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), M.skin);
      hand.position.y = -0.54;
      pivot.add(hand);
      pivot.userData.side = side;
      this.spine.add(pivot);
      this.arms.push(pivot);
    }

    this.legs = [];
    this.feet = [];
    for (const side of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(0, 0.92, 0.11 * side);
      const thigh = capsule(0.095, 0.28, M.pants);
      thigh.position.y = -0.22;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.45;
      hip.add(knee);
      const shin = capsule(0.085, 0.28, M.pants);
      shin.position.y = -0.2;
      knee.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.15), M.shoes);
      foot.position.set(0.06, -0.42, 0);
      knee.add(foot);
      this.feet.push(foot);
      this.body.add(hip);
      this.legs.push({ hip, knee, side });
    }

    this.pose = { ...POSES.stand };
    this.target = POSES.stand;
    this.poseSpeed = 12;
    this.time = 0;
    this.fx = null;
    this.wind = 0;
    this.applyPose();
  }

  setPose(name, speed = 12) {
    this.target = POSES[name];
    this.poseSpeed = speed;
  }

  setPoseTo(pose, speed = 16) {
    this.target = pose;
    this.poseSpeed = speed;
  }

  snapPose(name) {
    this.target = POSES[name];
    Object.assign(this.pose, this.target);
    this.applyPose();
  }

  applySkin(skin) {
    const M = this.mats;
    const c = skin.colors;
    for (const k of ['shirt', 'pants', 'skin', 'shoes', 'hat', 'extra']) {
      const m = M[k];
      m.color.set(c[k] || c.hat);
      m.emissive.set(0x000000);
      m.emissiveIntensity = 1;
      m.metalness = 0;
      m.roughness = 0.6;
      m.transparent = false;
      m.opacity = 1;
      m.needsUpdate = true;
    }
    M.eye.color.set(0x111111);
    M.eye.emissive.set(0x000000);
    this.fx = skin.fx || null;

    const glowEyes = (color) => { M.eye.color.set(color); M.eye.emissive.set(color); };
    switch (skin.fx) {
      case 'metal':
        for (const k of ['shirt', 'pants', 'skin', 'shoes']) { M[k].metalness = 0.6; M[k].roughness = 0.3; }
        glowEyes('#22d3ee');
        break;
      case 'armor':
        for (const k of ['shirt', 'pants', 'skin', 'shoes']) { M[k].metalness = 0.7; M[k].roughness = 0.28; }
        break;
      case 'lava':
        for (const k of ['skin', 'shoes']) { M[k].emissive.set('#ff3d00'); M[k].emissiveIntensity = 0.8; }
        glowEyes('#fff200');
        break;
      case 'shiny':
        for (const k of ['shirt', 'pants', 'shoes', 'hat']) {
          M[k].metalness = 0.55; M[k].roughness = 0.25;
          M[k].emissive.set(c[k]); M[k].emissiveIntensity = 0.15;
        }
        break;
      case 'ghost':
        for (const k of ['shirt', 'pants', 'skin', 'shoes']) {
          M[k].transparent = true; M[k].opacity = 0.55;
          M[k].emissive.set('#bfe9ff'); M[k].emissiveIntensity = 0.35;
        }
        M.hat.emissive.set('#fde047'); M.hat.emissiveIntensity = 0.9;
        break;
      case 'shadow':
        for (const k of ['shirt', 'pants', 'skin', 'shoes']) { M[k].emissive.set('#2e1065'); M[k].roughness = 0.9; }
        glowEyes('#c084fc');
        break;
      case 'diamond':
        for (const k of ['shirt', 'pants', 'skin', 'shoes', 'hat']) {
          M[k].metalness = 0.35; M[k].roughness = 0.08;
          M[k].emissive.set(c[k]); M[k].emissiveIntensity = 0.35;
          M[k].transparent = true; M[k].opacity = 0.88;
        }
        break;
      case 'galaxy':
        for (const k of ['shirt', 'pants', 'skin', 'shoes']) { M[k].emissiveIntensity = 0.5; M[k].roughness = 0.3; }
        M.hat.emissive.set(c.hat); M.hat.emissiveIntensity = 0.9;
        glowEyes('#f0abfc');
        break;
    }
    if (skin.face === 'glow') glowEyes('#fde047');
    if (skin.hat === 'mask') M.eye.color.set('#ffffff');
    this.buildAccessories(skin);
  }

  buildAccessories(skin) {
    for (const group of [this.acc, this.backAcc]) {
      for (const child of [...group.children]) {
        group.remove(child);
        child.traverse((o) => o.geometry && o.geometry.dispose());
      }
    }
    for (const m of this.accMats) m.dispose();
    this.accMats = [];
    this.spinners = [];
    this.cape = null;
    for (const eye of this.eyes) eye.visible = true;

    const M = this.mats;
    const mat = (color, extra) => { const m = std(color, extra); this.accMats.push(m); return m; };
    const add = (geo, material, x = 0, y = 0, z = 0, group = this.acc) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    const cyl = (rt, rb, h, seg = 20, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
    const sphere = (r, ws = 16, hs = 12, ...rest) => new THREE.SphereGeometry(r, ws, hs, ...rest);
    const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
    const dome = (r) => sphere(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);

    switch (skin.hat) {
      case 'cap': {
        add(dome(0.295), M.hat, 0, 0.04, 0);
        const brim = add(cyl(0.2, 0.2, 0.03), M.hat, 0.24, 0.07, 0);
        brim.scale.set(1, 1, 0.9);
        brim.rotation.z = -0.12;
        break;
      }
      case 'headband': {
        add(new THREE.TorusGeometry(0.28, 0.035, 8, 24), M.hat, 0, 0.1, 0).rotation.x = Math.PI / 2;
        for (const [z, r] of [[0.05, 0.5], [-0.05, -0.3]]) add(new THREE.BoxGeometry(0.22, 0.05, 0.03), M.hat, -0.36, 0.05, z).rotation.z = r;
        break;
      }
      case 'helmet': {
        add(sphere(0.37, 20, 16), M.hat, 0, 0.02, 0);
        add(sphere(0.3, 20, 16), mat('#1e3a8a', { metalness: 0.7, roughness: 0.15, emissive: '#172554' }), 0.14, 0.02, 0).scale.set(0.8, 0.75, 0.95);
        break;
      }
      case 'hair': {
        add(sphere(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), M.hat, -0.02, 0.03, 0).scale.set(1.05, 1.1, 1.05);
        for (let i = 0; i < 5; i++) add(cone(0.06, 0.16, 6), M.hat, -0.1 + i * 0.05, 0.3, (i - 2) * 0.07).rotation.z = (i - 2) * 0.3;
        break;
      }
      case 'antenna': {
        add(cyl(0.015, 0.015, 0.25, 6), M.shoes, 0, 0.38, 0);
        add(sphere(0.06, 10, 8), M.hat, 0, 0.52, 0);
        M.hat.emissive.set('#22d3ee');
        break;
      }
      case 'antennae': {
        for (const z of [0.1, -0.1]) {
          const rod = add(cyl(0.015, 0.015, 0.3, 6), M.hat, 0, 0.36, z);
          rod.rotation.x = z > 0 ? -0.35 : 0.35;
          add(sphere(0.055, 10, 8), M.hat, 0, 0.5, z * 1.6);
        }
        M.hat.emissive.set('#22c55e');
        M.hat.emissiveIntensity = 0.4;
        break;
      }
      case 'horns':
        for (const z of [0.15, -0.15]) add(cone(0.06, 0.25, 8), M.skin, 0.02, 0.28, z).rotation.x = z > 0 ? -0.4 : 0.4;
        break;
      case 'crown': {
        add(cyl(0.2, 0.2, 0.12, 20, true), mat(skin.colors.hat, { metalness: 0.6, roughness: 0.25, side: THREE.DoubleSide }), 0, 0.3, 0);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          add(cone(0.045, 0.12, 6), M.hat, Math.cos(a) * 0.19, 0.42, Math.sin(a) * 0.19);
        }
        add(sphere(0.045, 8, 6), mat('#e11d48', { emissive: '#e11d48', emissiveIntensity: 0.4 }), 0.2, 0.31, 0);
        break;
      }
      case 'halo':
        add(new THREE.TorusGeometry(0.2, 0.03, 8, 24), M.hat, 0, 0.48, 0).rotation.x = Math.PI / 2;
        M.hat.emissive.set(skin.colors.hat);
        M.hat.emissiveIntensity = 0.8;
        break;
      case 'cowboy': {
        add(cyl(0.46, 0.46, 0.03, 28), M.hat, 0, 0.14, 0).scale.set(1, 1, 0.8);
        add(cyl(0.2, 0.25, 0.26), M.hat, 0, 0.28, 0);
        add(cyl(0.252, 0.252, 0.05), mat('#3b1d0c'), 0, 0.19, 0);
        break;
      }
      case 'pirate': {
        add(dome(0.29), M.hat, 0, 0.06, 0);
        const tri = add(cyl(0.44, 0.44, 0.05, 3), M.hat, 0, 0.16, 0);
        tri.rotation.y = Math.PI / 2;
        add(sphere(0.05, 10, 8), mat('#ffffff'), 0.3, 0.23, 0);
        break;
      }
      case 'catears':
      case 'bunnyears': {
        const inner = mat('#f9a8d4');
        for (const z of [0.13, -0.13]) {
          const tilt = z > 0 ? -0.3 : 0.3;
          if (skin.hat === 'catears') {
            add(cone(0.11, 0.22, 4), M.hat, -0.02, 0.29, z).rotation.x = tilt;
            add(cone(0.06, 0.14, 4), inner, 0.02, 0.28, z * 0.95).rotation.x = tilt;
          } else {
            add(new THREE.CapsuleGeometry(0.065, 0.34, 6, 12), M.hat, -0.04, 0.5, z * 0.8).rotation.x = tilt * 0.5;
            add(new THREE.CapsuleGeometry(0.035, 0.26, 6, 12), inner, 0.0, 0.5, z * 0.8).rotation.x = tilt * 0.5;
          }
        }
        break;
      }
      case 'chef':
        add(cyl(0.22, 0.2, 0.22), M.hat, 0, 0.3, 0);
        add(sphere(0.28, 16, 12), M.hat, 0, 0.48, 0).scale.set(1, 0.65, 1);
        break;
      case 'firehelmet':
        add(dome(0.31), M.hat, 0, 0.04, 0);
        add(cyl(0.34, 0.4, 0.03, 24), M.hat, -0.07, 0.04, 0);
        add(new THREE.BoxGeometry(0.04, 0.12, 0.1), mat('#facc15', { metalness: 0.6, roughness: 0.3 }), 0.31, 0.16, 0);
        break;
      case 'tophat':
        add(cyl(0.34, 0.34, 0.03, 24), M.hat, 0, 0.2, 0);
        add(cyl(0.21, 0.21, 0.38), M.hat, 0, 0.4, 0);
        add(cyl(0.215, 0.215, 0.06), mat('#b91c1c'), 0, 0.25, 0);
        break;
      case 'stem': {
        add(cyl(0.035, 0.05, 0.16, 8), M.hat, 0, 0.32, 0).rotation.z = 0.25;
        add(sphere(0.07, 10, 8), M.hat, 0.06, 0.36, 0.05).scale.set(1.4, 0.4, 0.8);
        break;
      }
      case 'knight': {
        add(sphere(0.34, 20, 16), M.skin, 0, 0.02, 0);
        add(new THREE.BoxGeometry(0.04, 0.05, 0.34), mat('#111827'), 0.33, 0.05, 0);
        add(cone(0.08, 0.36, 10), M.hat, -0.06, 0.46, 0).rotation.z = 0.35;
        for (const eye of this.eyes) eye.visible = false;
        break;
      }
      case 'wizard': {
        add(cyl(0.44, 0.44, 0.03, 28), M.hat, 0, 0.16, 0);
        const hat = add(cone(0.29, 0.8, 24), M.hat, -0.04, 0.55, 0);
        hat.rotation.z = 0.18;
        const starMat = mat('#fde047', { emissive: '#facc15', emissiveIntensity: 0.8 });
        add(new THREE.OctahedronGeometry(0.05), starMat, 0.2, 0.38, 0.08);
        add(new THREE.OctahedronGeometry(0.04), starMat, 0.1, 0.6, -0.08);
        break;
      }
      case 'wig': {
        const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
        let i = 0;
        for (const z of [0.25, -0.25]) {
          for (const [x, y] of [[0.02, 0.12], [-0.14, 0.05], [-0.06, 0.22]]) {
            add(sphere(0.12, 10, 8), mat(colors[i++ % colors.length]), x, y, z);
          }
        }
        break;
      }
      case 'mask':
        add(new THREE.TorusGeometry(0.278, 0.05, 8, 28), M.hat, 0, 0.06, 0).rotation.x = Math.PI / 2;
        break;
      case 'gem': {
        const gem = add(new THREE.OctahedronGeometry(0.14), M.hat, 0, 0.56, 0);
        M.hat.emissive.set(skin.colors.hat);
        M.hat.emissiveIntensity = 0.6;
        this.spinners.push(gem);
        break;
      }
    }

    switch (skin.face) {
      case 'patch': {
        add(cyl(0.065, 0.065, 0.02, 16), mat('#111111'), 0.275, 0.06, 0.1).rotation.z = Math.PI / 2;
        const strap = add(new THREE.TorusGeometry(0.283, 0.012, 6, 32), mat('#111111'), 0, 0.1, 0);
        strap.rotation.set(Math.PI / 2, 0.35, 0);
        break;
      }
      case 'pinknose':
        add(sphere(0.045, 10, 8), mat('#f472b6'), 0.285, -0.03, 0);
        break;
      case 'rednose':
        add(sphere(0.075, 14, 10), mat('#ef4444', { roughness: 0.2 }), 0.29, -0.02, 0);
        break;
      case 'carrot':
        add(cone(0.05, 0.28, 10), mat('#f97316'), 0.4, -0.01, 0).rotation.z = -Math.PI / 2;
        break;
      case 'beard': {
        const beard = add(cone(0.2, 0.44, 14), M.extra, 0.13, -0.32, 0);
        beard.rotation.z = Math.PI;
        break;
      }
      case 'frog': {
        const white = mat('#ffffff');
        const black = mat('#111111');
        for (const z of [0.13, -0.13]) {
          add(sphere(0.1, 12, 10), white, 0.1, 0.24, z);
          add(sphere(0.045, 10, 8), black, 0.19, 0.26, z);
        }
        for (const eye of this.eyes) eye.visible = false;
        break;
      }
      case 'alien': {
        const black = mat('#0b0b0b', { roughness: 0.1 });
        for (const z of [0.1, -0.1]) {
          const eye = add(sphere(0.09, 14, 10), black, 0.22, 0.05, z);
          eye.scale.set(0.5, 1.2, 0.85);
          eye.rotation.x = z > 0 ? 0.5 : -0.5;
        }
        for (const eye of this.eyes) eye.visible = false;
        break;
      }
    }

    switch (skin.back) {
      case 'cape': {
        const pivot = new THREE.Group();
        pivot.position.set(-0.2, 0.62, 0);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.0), M.extra);
        cloth.rotation.y = Math.PI / 2;
        cloth.position.y = -0.5;
        pivot.add(cloth);
        this.backAcc.add(pivot);
        this.cape = pivot;
        break;
      }
      case 'spikes':
        for (let i = 0; i < 5; i++) {
          add(cone(0.07, 0.18, 4), M.hat, -0.22, 0.02 + i * 0.13, 0, this.backAcc).rotation.z = Math.PI / 2;
        }
        for (let i = 0; i < 3; i++) add(cone(0.05, 0.14, 4), M.hat, -0.16 + i * 0.08, 0.28 - Math.abs(i - 1) * 0.02, 0).rotation.z = 0.3;
        break;
    }
  }

  applyPose() {
    const p = this.pose;
    this.spine.rotation.z = p.spine;
    this.head.rotation.z = -p.spine * 0.4 - p.nod;
    for (const leg of this.legs) {
      leg.hip.rotation.z = p.hip + p.split * leg.side;
      leg.hip.rotation.x = -p.legOut * leg.side;
      leg.knee.rotation.z = Math.min(0, p.knee + p.kneeSplit * leg.side);
    }
    for (const arm of this.arms) {
      const side = arm.userData.side;
      arm.rotation.z = p.shoulder + p.armSplit * side;
      arm.rotation.x = -p.armOut * side;
    }
    this.body.position.y = -HIP_HEIGHT + p.drop;
  }

  // 0..1: how hard the wind blows (makes capes flap)
  setWind(amount) {
    this.wind = amount;
  }

  update(dt, { idle = false } = {}) {
    this.time += dt;
    const k = 1 - Math.exp(-this.poseSpeed * dt);
    for (const key of KEYS) this.pose[key] += (this.target[key] - this.pose[key]) * k;
    this.applyPose();

    if (idle) {
      // gentle breathing / arm sway while waiting
      this.spine.rotation.z += Math.sin(this.time * 2.2) * 0.03;
      for (const arm of this.arms) arm.rotation.z += Math.sin(this.time * 2.2 + arm.userData.side) * 0.08;
    }

    const M = this.mats;
    switch (this.fx) {
      case 'rainbow':
        M.shirt.color.setHSL((this.time * 0.25) % 1, 0.85, 0.55);
        M.hat.color.setHSL((this.time * 0.25 + 0.5) % 1, 0.85, 0.6);
        M.shoes.color.setHSL((this.time * 0.25 + 0.25) % 1, 0.85, 0.6);
        break;
      case 'lava': {
        const pulse = 0.6 + Math.sin(this.time * 5) * 0.3;
        M.skin.emissiveIntensity = pulse;
        M.shoes.emissiveIntensity = pulse;
        break;
      }
      case 'metal':
        M.hat.emissiveIntensity = Math.sin(this.time * 6) > 0 ? 1 : 0.2;
        break;
      case 'ghost':
        this.body.position.y += Math.sin(this.time * 3) * 0.03;
        break;
      case 'shadow': {
        const glow = 0.4 + Math.sin(this.time * 3) * 0.3;
        for (const k of ['shirt', 'pants', 'skin', 'shoes']) M[k].emissiveIntensity = glow;
        break;
      }
      case 'galaxy': {
        const h = 0.72 + Math.sin(this.time * 0.8) * 0.08;
        M.shirt.color.setHSL(h, 0.8, 0.35);
        M.shirt.emissive.setHSL(h + 0.05, 0.9, 0.25);
        M.pants.emissive.setHSL(h - 0.05, 0.9, 0.18);
        M.skin.emissive.setHSL(h + 0.1, 0.8, 0.2);
        break;
      }
    }
    for (const s of this.spinners) s.rotation.y += dt * 2.5;
    if (this.cape) this.cape.rotation.z = -0.2 - this.wind * 0.9 + Math.sin(this.time * (6 + this.wind * 14)) * (0.06 + this.wind * 0.12);
  }
}
