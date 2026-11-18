import * as THREE from 'three';

export interface CarRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  frontLeftSteer: THREE.Group;
  frontRightSteer: THREE.Group;
  wheels: THREE.Mesh[];
  tailLightMat: THREE.MeshStandardMaterial;
  exhaustGlowMat: THREE.MeshStandardMaterial;
  shadowMesh: THREE.Mesh;
  dispose: () => void;
}

function createShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.34)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCarRig(isSoftwareGl: boolean): CarRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  // Materials with varied roughness/metalness contrast
  const chassisPaint = new THREE.MeshPhysicalMaterial({
    color: 0xf97316, // signature apex racing orange
    metalness: 0.45,
    roughness: 0.28,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    metalness: 0.25,
    roughness: 0.75,
  });
  const accentStripeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.15,
    roughness: 0.4,
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1.0,
    transmission: isSoftwareGl ? 0 : 0.35,
    transparent: true,
    opacity: isSoftwareGl ? 0.82 : 0.92,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x14171f,
    metalness: 0.05,
    roughness: 0.88,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd1d9e6,
    metalness: 0.92,
    roughness: 0.2,
  });
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.0,
    roughness: 0.15,
  });
  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });
  const exhaustGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.4,
    roughness: 0.25,
  });

  materials.push(
    chassisPaint,
    carbonMat,
    accentStripeMat,
    canopyMat,
    tireMat,
    rimMat,
    headLightMat,
    tailLightMat,
    exhaustGlowMat,
  );

  // 1. Primary Silhouette: Sculpted Beveled Wedge Chassis (ExtrudeGeometry)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.85, 0.22); // rear bottom
  hullShape.lineTo(1.78, 0.18);  // front nose bottom
  hullShape.lineTo(1.92, 0.34);  // nose tip
  hullShape.lineTo(0.85, 0.56);  // hood
  hullShape.lineTo(0.18, 0.86);  // windshield peak
  hullShape.lineTo(-0.75, 0.88); // roof rear
  hullShape.lineTo(-1.72, 0.64); // rear deck
  hullShape.lineTo(-1.88, 0.42); // rear fascia
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.36,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 2,
  });
  hullGeo.center();
  // Rotate so +X length maps to -Z forward (front nose at -Z)
  hullGeo.rotateY(Math.PI / 2);
  geometries.push(hullGeo);

  const hullMesh = new THREE.Mesh(hullGeo, chassisPaint);
  hullMesh.position.set(0, 0.54, 0);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyGroup.add(hullMesh);

  // 2. Lower Carbon Splitter & Side Skirts
  const floorGeo = new THREE.BoxGeometry(1.76, 0.12, 3.88);
  geometries.push(floorGeo);
  const floorMesh = new THREE.Mesh(floorGeo, carbonMat);
  floorMesh.position.set(0, 0.26, 0.02);
  floorMesh.castShadow = true;
  bodyGroup.add(floorMesh);

  // 3. Sculpted Sidepods (Left & Right)
  const podGeo = new THREE.BoxGeometry(0.28, 0.32, 1.9);
  geometries.push(podGeo);
  [-0.84, 0.84].forEach((sx) => {
    const pod = new THREE.Mesh(podGeo, chassisPaint);
    pod.position.set(sx, 0.46, 0.1);
    pod.castShadow = true;
    bodyGroup.add(pod);
  });

  // 4. Racing Hood Stripe
  const stripeGeo = new THREE.BoxGeometry(0.38, 0.04, 1.85);
  geometries.push(stripeGeo);
  const stripe = new THREE.Mesh(stripeGeo, accentStripeMat);
  stripe.position.set(0, 0.67, -0.78);
  stripe.rotation.x = 0.15;
  bodyGroup.add(stripe);

  // 5. Tinted Cockpit Canopy
  const canopyGeo = new THREE.BoxGeometry(1.06, 0.34, 1.48);
  geometries.push(canopyGeo);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.84, 0.06);
  canopy.castShadow = true;
  bodyGroup.add(canopy);

  // 6. Roof Air Intake Scoop
  const scoopGeo = new THREE.BoxGeometry(0.32, 0.16, 0.58);
  geometries.push(scoopGeo);
  const scoop = new THREE.Mesh(scoopGeo, carbonMat);
  scoop.position.set(0, 1.03, 0.32);
  bodyGroup.add(scoop);

  // 7. Front Aero Wing
  const frontWingGeo = new THREE.BoxGeometry(1.94, 0.07, 0.46);
  geometries.push(frontWingGeo);
  const frontWing = new THREE.Mesh(frontWingGeo, carbonMat);
  frontWing.position.set(0, 0.24, -1.92);
  frontWing.castShadow = true;
  bodyGroup.add(frontWing);

  // 8. Rear GT Wing + Endplates + Pylons
  const rearWingGeo = new THREE.BoxGeometry(1.96, 0.08, 0.46);
  const pylonGeo = new THREE.BoxGeometry(0.06, 0.42, 0.24);
  const endplateGeo = new THREE.BoxGeometry(0.05, 0.28, 0.54);
  geometries.push(rearWingGeo, pylonGeo, endplateGeo);

  const rearWing = new THREE.Mesh(rearWingGeo, carbonMat);
  rearWing.position.set(0, 1.12, 1.72);
  rearWing.rotation.x = 0.12;
  rearWing.castShadow = true;
  bodyGroup.add(rearWing);

  [-0.45, 0.45].forEach((px) => {
    const pylon = new THREE.Mesh(pylonGeo, carbonMat);
    pylon.position.set(px, 0.9, 1.68);
    bodyGroup.add(pylon);
  });
  [-0.98, 0.98].forEach((ex) => {
    const plate = new THREE.Mesh(endplateGeo, chassisPaint);
    plate.position.set(ex, 1.1, 1.72);
    bodyGroup.add(plate);
  });

  // 9. Twin LED Headlights & Tail Light Bar
  const headGeo = new THREE.BoxGeometry(0.32, 0.09, 0.08);
  const tailGeo = new THREE.BoxGeometry(1.32, 0.1, 0.08);
  const exhaustGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.24, 12);
  exhaustGeo.rotateX(Math.PI / 2);
  geometries.push(headGeo, tailGeo, exhaustGeo);

  [-0.54, 0.54].forEach((hx) => {
    const hl = new THREE.Mesh(headGeo, headLightMat);
    hl.position.set(hx, 0.44, -1.84);
    bodyGroup.add(hl);
  });

  const tailBar = new THREE.Mesh(tailGeo, tailLightMat);
  tailBar.position.set(0, 0.58, 1.9);
  bodyGroup.add(tailBar);

  [-0.32, 0.32].forEach((tx) => {
    const ex = new THREE.Mesh(exhaustGeo, exhaustGlowMat);
    ex.position.set(tx, 0.34, 1.92);
    bodyGroup.add(ex);
  });

  // 10. Four Wheel Assemblies (bottom sits at y = 0)
  const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.36, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.38, 8);
  hubGeo.rotateZ(Math.PI / 2);
  geometries.push(tireGeo, rimGeo, hubGeo);

  const wheels: THREE.Mesh[] = [];
  const frontLeftSteer = new THREE.Group();
  const frontRightSteer = new THREE.Group();

  const wheelSpecs = [
    {x: -0.94, z: -1.24, steerGroup: frontLeftSteer},
    {x: 0.94, z: -1.24, steerGroup: frontRightSteer},
    {x: -0.96, z: 1.24, steerGroup: null},
    {x: 0.96, z: 1.24, steerGroup: null},
  ];

  wheelSpecs.forEach((spec) => {
    const wheelMesh = new THREE.Mesh(tireGeo, tireMat);
    wheelMesh.castShadow = true;
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    const hubMesh = new THREE.Mesh(hubGeo, chassisPaint);
    wheelMesh.add(rimMesh);
    wheelMesh.add(hubMesh);

    if (spec.steerGroup) {
      spec.steerGroup.position.set(spec.x, 0.38, spec.z);
      spec.steerGroup.add(wheelMesh);
      root.add(spec.steerGroup);
    } else {
      wheelMesh.position.set(spec.x, 0.38, spec.z);
      root.add(wheelMesh);
    }
    wheels.push(wheelMesh);
  });

  // 11. Contact Shadow Grounding Plane
  const shadowTex = createShadowTexture();
  textures.push(shadowTex);
  const shadowGeo = new THREE.PlaneGeometry(2.8, 4.7);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  geometries.push(shadowGeo);
  materials.push(shadowMat);

  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.set(0, 0.03, 0);
  root.add(shadowMesh);

  return {
    root,
    bodyGroup,
    frontLeftSteer,
    frontRightSteer,
    wheels,
    tailLightMat,
    exhaustGlowMat,
    shadowMesh,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

export function createGhostCarMesh(): {mesh: THREE.Group; dispose: () => void} {
  const group = new THREE.Group();
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.85,
    transparent: true,
    opacity: 0.34,
    roughness: 0.2,
    depthWrite: false,
  });

  const bodyGeo = new THREE.BoxGeometry(1.65, 0.48, 3.6);
  const canopyGeo = new THREE.BoxGeometry(1.04, 0.32, 1.45);
  const wingGeo = new THREE.BoxGeometry(1.9, 0.08, 0.42);

  const body = new THREE.Mesh(bodyGeo, ghostMat);
  body.position.set(0, 0.48, 0);
  const canopy = new THREE.Mesh(canopyGeo, ghostMat);
  canopy.position.set(0, 0.84, 0.08);
  const wing = new THREE.Mesh(wingGeo, ghostMat);
  wing.position.set(0, 1.05, 1.65);

  group.add(body, canopy, wing);
  group.visible = false;

  return {
    mesh: group,
    dispose: () => {
      bodyGeo.dispose();
      canopyGeo.dispose();
      wingGeo.dispose();
      ghostMat.dispose();
    },
  };
}
