import * as THREE from '../vendor/three.module.min.js';

// Model is built facing +X with feet at y=0. The root sits at the hips so flips
// rotate around the body's center.
export const HIP_HEIGHT = 0.95;

// Joint angles (radians, rotation around Z so positive = forward for limbs).
export const POSES = {
  stand:  { spine: 0,     hip: 0,    knee: 0,    shoulder: 0.12, armOut: 0.18, drop: 0 },
  crouch: { spine: -0.35, hip: 1.0,  knee: -1.7, shoulder: -0.7, armOut: 0.1,  drop: -0.31 },
  launch: { spine: 0.12,  hip: -0.1, knee: -0.2, shoulder: 2.8,  armOut: 0.25, drop: 0 },
  tuck:   { spine: -0.55, hip: 2.2,  knee: -2.3, shoulder: 1.35, armOut: 0.3,  drop: 0 },
  rocket: { spine: -0.7,  hip: 2.5,  knee: -2.6, shoulder: 1.6,  armOut: 0.15, drop: 0 },
  layout: { spine: 0.15,  hip: -0.12, knee: 0,   shoulder: 2.95, armOut: 0.4,  drop: 0 },
  flail:  { spine: 0.2,   hip: 0.5,  knee: -0.6, shoulder: 2.2,  armOut: 1.1,  drop: 0 },
  lying:  { spine: 0,     hip: 0.25, knee: -0.35, shoulder: 1.7, armOut: 1.2,  drop: 0 },
  cheer:  { spine: 0.05,  hip: 0,    knee: 0,    shoulder: 2.7,  armOut: 0.7,  drop: 0 },
};

const KEYS = Object.keys(POSES.stand);

function capsule(radius, length, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), mat);
  m.castShadow = false;
  return m;
}

export class Character {
  constructor() {
    this.root = new THREE.Group();   // position = hips in world space
    this.flip = new THREE.Group();   // rotation.z = backflip angle
    this.twist = new THREE.Group();  // rotation.y = twist angle
    this.body = new THREE.Group();   // model space (feet at 0)
    this.root.add(this.flip);
    this.flip.add(this.twist);
    this.twist.add(this.body);
    this.body.position.y = -HIP_HEIGHT;

    this.mats = {
      shirt: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      pants: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
      skin: new THREE.MeshStandardMaterial({ roughness: 0.55 }),
      shoes: new THREE.MeshStandardMaterial({ roughness: 0.5 }),
      hat: new THREE.MeshStandardMaterial({ roughness: 0.45 }),
      eye: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 }),
    };
    const M = this.mats;

    // Pelvis
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.36), M.pants);
    pelvis.position.y = 0.95;
    this.body.add(pelvis);

    // Spine (torso + head + arms)
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
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), M.skin);
    this.head.add(headMesh);
    const eyeGeo = new THREE.SphereGeometry(0.045, 10, 8);
    for (const z of [0.1, -0.1]) {
      const eye = new THREE.Mesh(eyeGeo, M.eye);
      eye.position.set(0.25, 0.05, z);
      eye.scale.set(0.6, 1.2, 1);
      this.head.add(eye);
    }
    this.hat = new THREE.Group();
    this.head.add(this.hat);

    // Arms: pivot at shoulder
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

    // Legs: pivot at hip, knee in the middle
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
      this.legs.push({ hip, knee });
    }

    this.pose = { ...POSES.stand };
    this.target = POSES.stand;
    this.poseSpeed = 12;
    this.time = 0;
    this.fx = null;
    this.applyPose();
  }

  setPose(name, speed = 12) {
    this.target = POSES[name];
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
    for (const k of ['shirt', 'pants', 'skin', 'shoes', 'hat']) {
      const m = M[k];
      m.color.set(c[k]);
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

    if (skin.fx === 'metal') {
      for (const k of ['shirt', 'pants', 'skin', 'shoes']) { M[k].metalness = 0.6; M[k].roughness = 0.3; }
      M.eye.color.set('#22d3ee');
      M.eye.emissive.set('#22d3ee');
    } else if (skin.fx === 'lava') {
      M.skin.emissive.set('#ff3d00'); M.skin.emissiveIntensity = 0.8;
      M.shoes.emissive.set('#ff3d00'); M.shoes.emissiveIntensity = 0.8;
      M.eye.color.set('#fff200'); M.eye.emissive.set('#fff200');
    } else if (skin.fx === 'shiny') {
      for (const k of ['shirt', 'pants', 'shoes', 'hat']) {
        M[k].metalness = 0.55; M[k].roughness = 0.25;
        M[k].emissive.set(c[k]); M[k].emissiveIntensity = 0.15;
      }
    } else if (skin.fx === 'ghost') {
      for (const k of ['shirt', 'pants', 'skin', 'shoes']) {
        M[k].transparent = true; M[k].opacity = 0.55;
        M[k].emissive.set('#bfe9ff'); M[k].emissiveIntensity = 0.35;
      }
      M.hat.emissive.set('#fde047'); M.hat.emissiveIntensity = 0.9;
    }
    this.buildHat(skin.hat);
  }

  buildHat(type) {
    for (const child of [...this.hat.children]) {
      this.hat.remove(child);
      child.traverse((o) => o.geometry && o.geometry.dispose());
    }
    const M = this.mats;
    const add = (mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); this.hat.add(mesh); return mesh; };

    if (type === 'cap') {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.295, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.hat), 0, 0.04, 0);
      const brim = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20), M.hat), 0.24, 0.07, 0);
      brim.scale.set(1, 1, 0.9);
      brim.rotation.z = -0.12;
    } else if (type === 'headband') {
      const band = add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 24), M.hat), 0, 0.1, 0);
      band.rotation.x = Math.PI / 2;
      for (const [z, r] of [[0.05, 0.5], [-0.05, -0.3]]) {
        const tail = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.03), M.hat), -0.36, 0.05, z);
        tail.rotation.z = r;
      }
    } else if (type === 'helmet') {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.37, 20, 16), M.hat), 0, 0.02, 0);
      const visor = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16),
        new THREE.MeshStandardMaterial({ color: '#1e3a8a', metalness: 0.7, roughness: 0.15, emissive: '#172554' })), 0.14, 0.02, 0);
      visor.scale.set(0.8, 0.75, 0.95);
    } else if (type === 'hair') {
      const hair = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), M.hat), -0.02, 0.03, 0);
      hair.scale.set(1.05, 1.1, 1.05);
      for (let i = 0; i < 5; i++) {
        const tuft = add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), M.hat), -0.1 + i * 0.05, 0.3, (i - 2) * 0.07);
        tuft.rotation.z = (i - 2) * 0.3;
      }
    } else if (type === 'antenna') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), this.mats.shoes), 0, 0.38, 0);
      const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M.hat), 0, 0.52, 0);
      M.hat.emissive.set('#22d3ee'); M.hat.emissiveIntensity = 1;
      bulb.userData.blink = true;
    } else if (type === 'horns') {
      for (const z of [0.15, -0.15]) {
        const horn = add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 8), this.mats.skin), 0.02, 0.28, z);
        horn.rotation.x = z > 0 ? -0.4 : 0.4;
      }
    } else if (type === 'crown') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 20, 1, true), M.hat), 0, 0.3, 0).material.side = THREE.DoubleSide;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6), M.hat), Math.cos(a) * 0.19, 0.42, Math.sin(a) * 0.19);
      }
      add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6),
        new THREE.MeshStandardMaterial({ color: '#e11d48', emissive: '#e11d48', emissiveIntensity: 0.4 })), 0.2, 0.31, 0);
    } else if (type === 'halo') {
      const halo = add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), M.hat), 0, 0.48, 0);
      halo.rotation.x = Math.PI / 2;
    }
  }

  applyPose() {
    const p = this.pose;
    this.spine.rotation.z = p.spine;
    this.head.rotation.z = -p.spine * 0.4;
    for (const leg of this.legs) {
      leg.hip.rotation.z = p.hip;
      leg.knee.rotation.z = p.knee;
    }
    for (const arm of this.arms) {
      arm.rotation.z = p.shoulder;
      arm.rotation.x = -p.armOut * arm.userData.side;
    }
    this.body.position.y = -HIP_HEIGHT + p.drop;
  }

  update(dt, { idle = false } = {}) {
    this.time += dt;
    const k = 1 - Math.exp(-this.poseSpeed * dt);
    for (const key of KEYS) this.pose[key] += (this.target[key] - this.pose[key]) * k;
    this.applyPose();

    if (idle) {
      // gentle breathing / arm sway while waiting on the tower
      const s = Math.sin(this.time * 2.2);
      this.spine.rotation.z += s * 0.03;
      for (const arm of this.arms) arm.rotation.z += Math.sin(this.time * 2.2 + arm.userData.side) * 0.08;
    }

    if (this.fx === 'rainbow') {
      this.mats.shirt.color.setHSL((this.time * 0.25) % 1, 0.85, 0.55);
      this.mats.hat.color.setHSL((this.time * 0.25 + 0.5) % 1, 0.85, 0.6);
      this.mats.shoes.color.setHSL((this.time * 0.25 + 0.25) % 1, 0.85, 0.6);
    } else if (this.fx === 'lava') {
      const pulse = 0.6 + Math.sin(this.time * 5) * 0.3;
      this.mats.skin.emissiveIntensity = pulse;
      this.mats.shoes.emissiveIntensity = pulse;
    } else if (this.fx === 'metal') {
      this.mats.hat.emissiveIntensity = Math.sin(this.time * 6) > 0 ? 1 : 0.2;
    } else if (this.fx === 'ghost') {
      this.body.position.y += Math.sin(this.time * 3) * 0.03;
    }
  }
}
