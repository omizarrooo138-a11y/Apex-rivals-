import * as THREE from 'three';
import {CHARMS} from './cosmetics';
import type {CharmId, WeaponId} from './types';
import {WEAPONS} from './weapons';
import type {WrapMaterialSet} from './wraps';

export interface WeaponRig {
  root: THREE.Group;
  muzzlePoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  dispose: () => void;
}

export function createWeaponModel(
  weaponId: WeaponId,
  mats: WrapMaterialSet,
  charmId: CharmId = 'none',
): WeaponRig {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    rotX = 0,
    rotZ = 0,
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.x = rotX;
    m.rotation.z = rotZ;
    m.castShadow = true;
    root.add(m);
    return m;
  };

  const addCyl = (
    rTop: number,
    rBot: number,
    len: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, len, 12);
    g.rotateX(Math.PI / 2);
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    root.add(m);
    return m;
  };

  let muzzleZ = -0.58;
  let muzzleY = 0.04;
  let charmAnchor = new THREE.Vector3(0.055, 0.02, -0.06);

  if (
    weaponId === 'vx47' ||
    weaponId === 'pulse3' ||
    weaponId === 'scar_heavy' ||
    weaponId === 'energy_rifle' ||
    weaponId === 'permafrost' ||
    weaponId === 'paintball_gun' ||
    weaponId === 'gunblade'
  ) {
    const isPulse = weaponId === 'pulse3';
    const isCryo = weaponId === 'permafrost';
    const isEnergy = weaponId === 'energy_rifle';
    const isPaint = weaponId === 'paintball_gun';
    const isGunblade = weaponId === 'gunblade';
    const isScar = weaponId === 'scar_heavy';

    const receiverMat = isCryo
      ? (() => {
          const m = new THREE.MeshPhysicalMaterial({
            color: 0x0ea5e9,
            emissive: 0x0284c7,
            emissiveIntensity: 0.45,
            roughness: 0.18,
            metalness: 0.72,
            clearcoat: 0.9,
          });
          localMats.push(m);
          return m;
        })()
      : mats.primaryMat;

    addBox(isScar ? 0.095 : 0.085, 0.11, isScar ? 0.48 : 0.44, 0, 0, 0, receiverMat);
    addBox(0.068, 0.04, 0.46, 0, 0.065, -0.02, mats.darkSteelMat);
    addBox(0.075, 0.085, 0.36, 0, 0.01, -0.35, receiverMat);
    addCyl(0.018, 0.02, isScar ? 0.42 : 0.36, 0, 0.02, -0.58, mats.darkSteelMat);
    addBox(0.048, 0.19, 0.085, 0, -0.12, -0.1, mats.darkSteelMat, isPulse ? 0.08 : 0.22);
    addBox(0.052, 0.14, 0.065, 0, -0.09, 0.12, mats.darkSteelMat, -0.28);
    addBox(0.055, 0.095, 0.24, 0, -0.01, 0.32, receiverMat);

    // Special attachments per rifle archetype
    if (isPaint) {
      // Top neon paintball hopper globe
      const hopperGeo = new THREE.SphereGeometry(0.068, 12, 10);
      geos.push(hopperGeo);
      const hopper = new THREE.Mesh(hopperGeo, mats.accentMat);
      hopper.position.set(0.035, 0.14, -0.08);
      root.add(hopper);
    } else if (isGunblade) {
      // Underbarrel cyber blade
      addBox(0.014, 0.052, 0.42, 0, -0.045, -0.54, mats.accentMat);
    } else if (isCryo || isEnergy) {
      // Glowing cryo/plasma core cells along shroud
      const coreMat = new THREE.MeshStandardMaterial({
        color: isCryo ? 0x67e8f9 : 0x38bdf8,
        emissive: isCryo ? 0x22d3ee : 0x0ea5e9,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      });
      localMats.push(coreMat);
      addBox(0.09, 0.032, 0.28, 0, 0.025, -0.34, coreMat);
    }

    // Reflex Optic
    addBox(0.054, 0.05, isPulse ? 0.13 : 0.085, 0, 0.105, 0.02, mats.darkSteelMat);
    const lensMat = new THREE.MeshBasicMaterial({
      color: isCryo ? 0x67e8f9 : isPulse || isEnergy ? 0x38bdf8 : isPaint ? 0xec4899 : 0xf97316,
      transparent: true,
      opacity: 0.48,
    });
    localMats.push(lensMat);
    addBox(0.042, 0.036, 0.006, 0, 0.11, -0.01, lensMat);
    addBox(
      0.014,
      0.014,
      isPulse ? 0.26 : 0.014,
      0,
      isPulse ? 0.035 : 0.112,
      isPulse ? -0.35 : 0.02,
      mats.accentMat,
    );
    muzzleZ = -0.78;
    muzzleY = 0.02;
  } else if (weaponId === 'spectre9' || weaponId === 'vector_x') {
    const isVector = weaponId === 'vector_x';
    addBox(0.078, isVector ? 0.13 : 0.105, 0.34, 0, isVector ? -0.01 : 0, 0.02, mats.primaryMat);
    addCyl(0.028, 0.028, isVector ? 0.24 : 0.3, 0, 0.02, -0.28, mats.darkSteelMat);
    addBox(0.066, 0.025, 0.26, 0, 0.06, -0.02, mats.accentMat);
    addBox(0.04, 0.22, 0.055, 0, -0.13, -0.06, mats.darkSteelMat, 0.16);
    addBox(0.048, 0.13, 0.058, 0, -0.09, 0.11, mats.darkSteelMat, -0.24);
    addBox(0.045, 0.06, 0.18, 0, 0.01, 0.26, mats.darkSteelMat);
    addBox(0.046, 0.04, 0.06, 0, 0.09, 0.02, mats.darkSteelMat);
    muzzleZ = -0.45;
    muzzleY = 0.02;
  } else if (weaponId === 'kestrel' || weaponId === 'double_barrel' || weaponId === 'shorty') {
    const isDouble = weaponId === 'double_barrel' || weaponId === 'shorty';
    const isShorty = weaponId === 'shorty';
    addBox(0.092, 0.115, isShorty ? 0.22 : 0.38, 0, 0, 0.02, mats.primaryMat);
    if (isDouble) {
      const bLen = isShorty ? 0.32 : 0.52;
      const bZ = isShorty ? -0.22 : -0.38;
      addCyl(0.022, 0.022, bLen, -0.024, 0.036, bZ, mats.darkSteelMat);
      addCyl(0.022, 0.022, bLen, 0.024, 0.036, bZ, mats.darkSteelMat);
      addBox(0.078, 0.04, 0.16, 0, -0.005, -0.22, mats.accentMat);
      muzzleZ = isShorty ? -0.4 : -0.66;
    } else {
      addCyl(0.024, 0.024, 0.48, 0, 0.038, -0.38, mats.darkSteelMat);
      addCyl(0.02, 0.02, 0.42, 0, -0.012, -0.35, mats.darkSteelMat);
      addBox(0.082, 0.072, 0.2, 0, -0.015, -0.32, mats.accentMat);
      muzzleZ = -0.63;
    }
    addBox(0.056, 0.13, 0.07, 0, -0.09, 0.13, mats.darkSteelMat, -0.3);
    if (!isShorty) {
      addBox(0.065, 0.11, 0.26, 0, -0.02, 0.32, mats.primaryMat);
    }
    muzzleY = 0.038;
  } else if (weaponId === 'longbow' || weaponId === 'crossbow') {
    const isCrossbow = weaponId === 'crossbow';
    addBox(0.088, 0.12, 0.52, 0, 0, 0, mats.primaryMat);
    if (isCrossbow) {
      // Wide horizontal crossbow bow limbs & glowing track
      addBox(0.46, 0.028, 0.055, 0, 0.02, -0.46, mats.darkSteelMat);
      addBox(0.016, 0.012, 0.42, 0, 0.035, -0.28, mats.accentMat);
      muzzleZ = -0.62;
    } else {
      addBox(0.032, 0.036, 0.56, -0.022, 0.025, -0.48, mats.darkSteelMat);
      addBox(0.032, 0.036, 0.56, 0.022, 0.025, -0.48, mats.darkSteelMat);
      addBox(0.022, 0.018, 0.52, 0, 0.025, -0.46, mats.accentMat);
      muzzleZ = -0.78;
    }
    addCyl(0.028, 0.032, 0.28, 0, 0.105, -0.04, mats.darkSteelMat);
    addBox(0.038, 0.04, 0.08, 0, 0.075, -0.04, mats.darkSteelMat);
    addBox(0.05, 0.12, 0.11, 0, -0.08, -0.08, mats.darkSteelMat);
    addBox(0.062, 0.11, 0.28, 0, -0.01, 0.36, mats.primaryMat);
    muzzleY = 0.025;
  } else if (weaponId === 'bow') {
    addBox(0.042, 0.26, 0.055, 0, 0, -0.08, mats.primaryMat);
    addBox(0.034, 0.24, 0.038, 0, 0.2, -0.04, mats.darkSteelMat, -0.35);
    addBox(0.034, 0.24, 0.038, 0, -0.2, -0.04, mats.darkSteelMat, 0.35);
    addBox(0.012, 0.56, 0.012, 0, 0, 0.08, mats.accentMat);
    addCyl(0.008, 0.008, 0.54, 0, 0.02, -0.16, mats.darkSteelMat);
    addBox(0.028, 0.022, 0.065, 0, 0.02, -0.45, mats.accentMat);
    muzzleZ = -0.48;
    muzzleY = 0.02;
    charmAnchor = new THREE.Vector3(0.038, -0.02, -0.08);
  } else if (weaponId === 'vulcan') {
    addBox(0.14, 0.14, 0.36, 0, -0.01, 0.04, mats.primaryMat);
    addCyl(0.085, 0.085, 0.16, 0.06, -0.13, 0.02, mats.darkSteelMat);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      addCyl(
        0.014,
        0.014,
        0.48,
        Math.cos(ang) * 0.038,
        0.01 + Math.sin(ang) * 0.038,
        -0.36,
        mats.darkSteelMat,
      );
    }
    addCyl(0.058, 0.058, 0.05, 0, 0.01, -0.54, mats.accentMat);
    addBox(0.11, 0.035, 0.14, 0, 0.11, -0.06, mats.darkSteelMat);
    muzzleZ = -0.62;
    muzzleY = 0.01;
    charmAnchor = new THREE.Vector3(0.085, 0.04, 0.0);
  } else if (weaponId === 'rpg' || weaponId === 'grenade_launcher') {
    const isGl = weaponId === 'grenade_launcher';
    if (isGl) {
      addCyl(0.082, 0.082, 0.18, 0, 0.01, -0.04, mats.darkSteelMat); // 6-shot drum
      addCyl(0.04, 0.042, 0.42, 0, 0.04, -0.34, mats.primaryMat);
      addBox(0.055, 0.13, 0.07, 0, -0.09, 0.14, mats.darkSteelMat, -0.25);
      addBox(0.055, 0.09, 0.22, 0, -0.01, 0.3, mats.primaryMat);
      muzzleZ = -0.56;
    } else {
      addCyl(0.062, 0.062, 0.85, 0, 0.03, -0.22, mats.primaryMat);
      addCyl(0.078, 0.062, 0.14, 0, 0.03, -0.68, mats.darkSteelMat);
      addCyl(0.068, 0.015, 0.18, 0, 0.03, -0.78, mats.accentMat); // Rocket warhead tip
      addBox(0.045, 0.12, 0.06, 0, -0.07, -0.1, mats.darkSteelMat, 0.18);
      muzzleZ = -0.84;
    }
    muzzleY = 0.03;
  } else if (weaponId === 'flamethrower') {
    addBox(0.11, 0.13, 0.42, 0, 0, 0.02, mats.primaryMat);
    const fuelMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    });
    localMats.push(fuelMat);
    addCyl(0.056, 0.056, 0.26, 0.065, -0.08, -0.06, fuelMat); // pressurized fuel tank
    addCyl(0.028, 0.032, 0.44, 0, 0.02, -0.4, mats.darkSteelMat);
    addBox(0.045, 0.045, 0.09, 0, -0.02, -0.6, mats.accentMat); // pilot flame igniter
    muzzleZ = -0.65;
    muzzleY = 0.02;
  } else if (weaponId === 'revolver' || weaponId === 'hand_cannon') {
    const isDeagle = weaponId === 'hand_cannon';
    addBox(isDeagle ? 0.058 : 0.052, 0.066, isDeagle ? 0.32 : 0.26, 0, 0.03, -0.08, mats.primaryMat);
    if (!isDeagle) {
      addCyl(0.038, 0.038, 0.1, 0, 0.01, 0.01, mats.darkSteelMat);
    } else {
      addBox(0.048, 0.04, 0.24, 0, -0.01, -0.06, mats.darkSteelMat);
    }
    addBox(0.042, 0.12, 0.055, 0, -0.075, 0.08, mats.primaryMat, -0.35);
    addBox(0.016, 0.022, 0.03, 0, 0.072, -0.2, mats.accentMat);
    muzzleZ = isDeagle ? -0.26 : -0.22;
    muzzleY = 0.03;
    charmAnchor = new THREE.Vector3(0.04, 0.01, -0.06);
  } else if (weaponId === 'vipers' || weaponId === 'spray') {
    addBox(0.056, 0.068, 0.28, 0, 0.028, -0.06, mats.primaryMat);
    addCyl(0.018, 0.018, 0.14, 0, 0.025, -0.24, mats.darkSteelMat);
    addBox(0.042, 0.16, 0.055, 0, -0.1, 0.04, mats.darkSteelMat, -0.22);
    addBox(0.022, 0.014, 0.22, 0, 0.068, -0.05, mats.accentMat);
    muzzleZ = -0.32;
    muzzleY = 0.025;
  } else if (
    weaponId === 'flare_gun' ||
    weaponId === 'slingshot' ||
    weaponId === 'exogun' ||
    weaponId === 'cryo_pistol' ||
    weaponId === 'suppressed_pistol' ||
    weaponId === 'mk2'
  ) {
    if (weaponId === 'slingshot') {
      addBox(0.036, 0.12, 0.04, 0, -0.06, 0.04, mats.darkSteelMat);
      addBox(0.03, 0.12, 0.03, -0.065, 0.04, -0.02, mats.primaryMat, 0, -0.25);
      addBox(0.03, 0.12, 0.03, 0.065, 0.04, -0.02, mats.primaryMat, 0, 0.25);
      addBox(0.14, 0.012, 0.012, 0, 0.08, 0.02, mats.accentMat);
      muzzleZ = -0.18;
      muzzleY = 0.05;
    } else {
      const pMat =
        weaponId === 'cryo_pistol'
          ? (() => {
              const m = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                emissive: 0x0284c7,
                emissiveIntensity: 0.7,
              });
              localMats.push(m);
              return m;
            })()
          : weaponId === 'exogun'
          ? (() => {
              const m = new THREE.MeshStandardMaterial({
                color: 0xa855f7,
                emissive: 0x7e22ce,
                emissiveIntensity: 0.7,
              });
              localMats.push(m);
              return m;
            })()
          : mats.primaryMat;

      addBox(0.056, 0.072, 0.26, 0, 0.025, -0.04, pMat);
      addBox(0.052, 0.045, 0.22, 0, -0.02, -0.02, mats.darkSteelMat);
      addBox(0.046, 0.125, 0.062, 0, -0.085, 0.045, mats.darkSteelMat, -0.24);
      if (weaponId === 'suppressed_pistol') {
        addCyl(0.022, 0.022, 0.22, 0, 0.03, -0.28, mats.darkSteelMat);
        muzzleZ = -0.4;
      } else if (weaponId === 'flare_gun') {
        addCyl(0.03, 0.03, 0.16, 0, 0.035, -0.18, mats.accentMat);
        muzzleZ = -0.27;
      } else {
        addBox(0.016, 0.018, 0.024, 0, 0.068, -0.14, mats.accentMat);
        muzzleZ = -0.19;
      }
      muzzleY = 0.025;
      charmAnchor = new THREE.Vector3(0.038, 0.01, -0.02);
    }
  } else if (weaponId === 'daggers') {
    [-0.085, 0.085].forEach((ox) => {
      addBox(0.022, 0.028, 0.12, ox, -0.02, 0.06, mats.darkSteelMat, 0.22);
      addBox(0.01, 0.038, 0.22, ox, 0.035, -0.12, mats.primaryMat, 0.22);
      addBox(0.006, 0.01, 0.21, ox, 0.055, -0.12, mats.accentMat, 0.22);
    });
    muzzleZ = -0.26;
    muzzleY = 0.04;
  } else if (weaponId === 'knife' || weaponId === 'karambit') {
    addBox(0.028, 0.036, 0.14, 0, -0.02, 0.05, mats.darkSteelMat, 0.25);
    addBox(0.055, 0.018, 0.02, 0, 0.0, -0.02, mats.accentMat, 0.25);
    if (weaponId === 'karambit') {
      addBox(0.012, 0.042, 0.16, 0, 0.04, -0.11, mats.primaryMat, 0.45);
      addBox(0.01, 0.035, 0.12, 0, 0.09, -0.21, mats.accentMat, 0.85);
    } else {
      addBox(0.012, 0.045, 0.24, 0, 0.045, -0.14, mats.primaryMat, 0.25);
      addBox(0.008, 0.012, 0.22, 0, 0.068, -0.14, mats.accentMat, 0.25);
    }
    muzzleZ = -0.28;
    muzzleY = 0.04;
  } else if (weaponId === 'katana' || weaponId === 'laser_saber') {
    const isSaber = weaponId === 'laser_saber';
    addBox(0.032, 0.038, 0.22, 0, -0.05, 0.1, mats.darkSteelMat, 0.35);
    addBox(0.075, 0.075, 0.016, 0, -0.01, -0.01, mats.accentMat, 0.35);
    if (isSaber) {
      const saberMat = new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.85,
        roughness: 0.1,
      });
      localMats.push(saberMat);
      addCyl(0.022, 0.022, 0.72, 0, 0.12, -0.34, saberMat);
    } else {
      addBox(0.012, 0.042, 0.62, 0, 0.11, -0.29, mats.primaryMat, 0.35);
      addBox(0.006, 0.01, 0.6, 0, 0.132, -0.29, mats.accentMat, 0.35);
    }
    muzzleZ = -0.62;
    muzzleY = 0.12;
  } else if (weaponId === 'scythe' || weaponId === 'battle_axe') {
    const isAxe = weaponId === 'battle_axe';
    addBox(0.034, 0.038, 0.74, 0, 0.05, -0.12, mats.darkSteelMat, 0.26);
    if (isAxe) {
      addBox(0.28, 0.16, 0.032, 0, 0.2, -0.44, mats.primaryMat, 0.26);
      addBox(0.3, 0.04, 0.018, 0, 0.2, -0.46, mats.accentMat, 0.26);
    } else {
      addBox(0.24, 0.055, 0.045, 0.11, 0.19, -0.44, mats.primaryMat, 0.15, -0.25);
      addBox(0.26, 0.016, 0.02, 0.12, 0.16, -0.46, mats.accentMat, 0.15, -0.25);
    }
    muzzleZ = -0.52;
    muzzleY = 0.16;
  } else if (weaponId === 'chainsaw') {
    addBox(0.11, 0.13, 0.24, 0, 0, 0.02, mats.primaryMat);
    addBox(0.032, 0.085, 0.42, 0, 0.01, -0.32, mats.darkSteelMat);
    addBox(0.036, 0.095, 0.44, 0, 0.01, -0.33, mats.accentMat);
    muzzleZ = -0.56;
    muzzleY = 0.02;
  } else if (weaponId === 'trowel' || weaponId === 'wrench') {
    addBox(0.03, 0.035, 0.18, 0, -0.02, 0.04, mats.darkSteelMat, 0.25);
    if (weaponId === 'trowel') {
      addBox(0.12, 0.014, 0.2, 0, 0.05, -0.14, mats.primaryMat, 0.25);
    } else {
      addBox(0.04, 0.03, 0.26, 0, 0.04, -0.14, mats.primaryMat, 0.25);
      addBox(0.11, 0.04, 0.07, 0, 0.08, -0.27, mats.accentMat, 0.25);
    }
    muzzleZ = -0.3;
    muzzleY = 0.05;
  } else if (weaponId === 'riot_shield') {
    addBox(0.42, 0.56, 0.042, -0.08, -0.02, -0.22, mats.darkSteelMat);
    const viewPortMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
    });
    localMats.push(viewPortMat);
    addBox(0.28, 0.13, 0.02, -0.08, 0.14, -0.23, viewPortMat);
    addBox(0.44, 0.04, 0.05, -0.08, 0.02, -0.22, mats.accentMat);
    muzzleZ = -0.28;
    muzzleY = 0.02;
  } else if (weaponId === 'boxing_gloves') {
    [-0.14, 0.12].forEach((ox) => {
      const gGeo = new THREE.SphereGeometry(0.085, 10, 10);
      geos.push(gGeo);
      const glove = new THREE.Mesh(gGeo, mats.accentMat);
      glove.position.set(ox, -0.04, -0.18);
      root.add(glove);
    });
    muzzleZ = -0.28;
    muzzleY = -0.02;
  } else if (
    weaponId === 'frag' ||
    weaponId === 'smoke' ||
    weaponId === 'satchel' ||
    weaponId === 'subspace_tripmine' ||
    weaponId === 'jump_pad'
  ) {
    if (weaponId === 'satchel') {
      addBox(0.14, 0.06, 0.11, 0, 0, -0.08, mats.darkSteelMat);
      addBox(0.05, 0.02, 0.05, 0, 0.036, -0.08, mats.accentMat);
    } else if (weaponId === 'subspace_tripmine') {
      const pinkMat = new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xdb2777,
        emissiveIntensity: 1.4,
      });
      localMats.push(pinkMat);
      addBox(0.13, 0.13, 0.13, 0, 0, -0.08, mats.darkSteelMat);
      addBox(0.08, 0.08, 0.15, 0, 0, -0.08, pinkMat);
    } else if (weaponId === 'jump_pad') {
      addCyl(0.12, 0.14, 0.035, 0, -0.01, -0.1, mats.accentMat);
    } else {
      const sphereGeo = new THREE.IcosahedronGeometry(0.075, 1);
      geos.push(sphereGeo);
      const body = new THREE.Mesh(
        sphereGeo,
        weaponId === 'smoke' ? mats.darkSteelMat : mats.primaryMat,
      );
      body.position.set(0, 0, -0.06);
      root.add(body);
      addBox(0.04, 0.045, 0.04, 0, 0.075, -0.06, mats.darkSteelMat);
      addBox(0.025, 0.05, 0.08, 0.04, 0.05, -0.06, mats.accentMat, 0, -0.35);
    }
    muzzleZ = -0.16;
    muzzleY = 0.02;
  } else if (weaponId === 'molotov') {
    const bottleMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 1.3,
      roughness: 0.25,
    });
    localMats.push(bottleMat);
    addCyl(0.046, 0.05, 0.15, 0, -0.01, -0.06, bottleMat);
    addCyl(0.022, 0.032, 0.07, 0, 0.06, -0.12, mats.darkSteelMat);
    addBox(0.024, 0.05, 0.024, 0, 0.11, -0.14, mats.accentMat, 0.35);
    muzzleZ = -0.16;
    muzzleY = 0.02;
  } else if (weaponId === 'flash' || weaponId === 'freeze_ray') {
    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    localMats.push(cyanMat);
    if (weaponId === 'freeze_ray') {
      addBox(0.064, 0.08, 0.3, 0, 0.02, -0.06, mats.primaryMat);
      addCyl(0.026, 0.026, 0.18, 0, 0.02, -0.26, cyanMat);
      muzzleZ = -0.36;
    } else {
      addCyl(0.042, 0.042, 0.18, 0, 0, -0.06, mats.darkSteelMat);
      addCyl(0.046, 0.046, 0.055, 0, 0, -0.06, cyanMat);
      addBox(0.02, 0.045, 0.04, 0, 0.055, -0.02, mats.accentMat);
      muzzleZ = -0.16;
    }
    muzzleY = 0.02;
  } else if (weaponId === 'war_horn') {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.85,
      roughness: 0.25,
    });
    localMats.push(goldMat);
    addCyl(0.085, 0.025, 0.28, 0, 0.02, -0.12, goldMat);
    muzzleZ = -0.26;
    muzzleY = 0.02;
  } else {
    // Nano Medkit (stim) or Aegis Flash Shield (flash_shield)
    const isFlashShield = weaponId === 'flash_shield';
    addCyl(0.032, 0.032, 0.22, 0, 0, -0.05, mats.primaryMat);
    const glowMat = new THREE.MeshStandardMaterial({
      color: isFlashShield ? 0x38bdf8 : 0x34d399,
      emissive: isFlashShield ? 0x0ea5e9 : 0x10b981,
      emissiveIntensity: 1.5,
    });
    localMats.push(glowMat);
    addCyl(0.024, 0.024, 0.12, 0, 0, -0.05, glowMat);
    addBox(0.045, 0.02, 0.04, 0, 0.035, 0.05, mats.accentMat);
    muzzleZ = -0.18;
    muzzleY = 0;
  }

  // Attach 3D hanging Weapon Charm on guns / melee when equipped
  const slot = WEAPONS[weaponId]?.slot;
  if (charmId !== 'none' && slot !== 'utility' && CHARMS[charmId]) {
    const charmColor = new THREE.Color(CHARMS[charmId].colorHex);
    const charmMat = new THREE.MeshStandardMaterial({
      color: charmColor,
      emissive: charmColor,
      emissiveIntensity: 0.75,
      metalness: 0.75,
      roughness: 0.25,
    });
    localMats.push(charmMat);

    const ringGeo = new THREE.TorusGeometry(0.012, 0.003, 6, 12);
    const pendantGeo =
      charmId === 'charm_ice' || charmId === 'charm_flame'
        ? new THREE.OctahedronGeometry(0.02, 0)
        : charmId === 'charm_dice'
        ? new THREE.BoxGeometry(0.026, 0.026, 0.026)
        : new THREE.CylinderGeometry(0.016, 0.022, 0.028, 6);
    geos.push(ringGeo, pendantGeo);

    const charmGroup = new THREE.Group();
    charmGroup.position.copy(charmAnchor);
    const ring = new THREE.Mesh(ringGeo, mats.darkSteelMat);
    const pendant = new THREE.Mesh(pendantGeo, charmMat);
    pendant.position.set(0, -0.026, 0);
    charmGroup.add(ring, pendant);
    root.add(charmGroup);
  }

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, muzzleY, muzzleZ);
  root.add(muzzlePoint);

  const flashGeo = new THREE.OctahedronGeometry(0.07, 0);
  const flashColor =
    weaponId === 'permafrost' || weaponId === 'cryo_pistol' || weaponId === 'freeze_ray'
      ? 0x67e8f9
      : weaponId === 'exogun'
      ? 0xc084fc
      : 0xfef08a;
  const flashMat = new THREE.MeshBasicMaterial({
    color: flashColor,
    transparent: true,
    opacity: 0.9,
  });
  geos.push(flashGeo);
  localMats.push(flashMat);

  const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.position.set(0, muzzleY, muzzleZ - 0.04);
  muzzleFlash.visible = false;
  root.add(muzzleFlash);

  return {
    root,
    muzzlePoint,
    muzzleFlash,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      localMats.forEach((m) => m.dispose());
    },
  };
}

export function createViewmodelArms(
  primaryColor: number,
  visorColor: number,
): {root: THREE.Group; dispose: () => void} {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const sleeveMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    roughness: 0.4,
    metalness: 0.38,
    clearcoat: 0.3,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.72,
    metalness: 0.22,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: visorColor,
    emissive: visorColor,
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });
  mats.push(sleeveMat, gloveMat, trimMat);

  const armGeo = new THREE.BoxGeometry(0.088, 0.088, 0.42);
  const handGeo = new THREE.BoxGeometry(0.078, 0.068, 0.11);
  const cuffGeo = new THREE.BoxGeometry(0.094, 0.094, 0.028);
  geos.push(armGeo, handGeo, cuffGeo);

  const rArm = new THREE.Mesh(armGeo, sleeveMat);
  rArm.position.set(0.04, -0.14, 0.24);
  rArm.rotation.set(0.28, -0.12, 0);

  const rCuff = new THREE.Mesh(cuffGeo, trimMat);
  rCuff.position.set(0.02, -0.105, 0.1);
  rCuff.rotation.set(0.28, -0.12, 0);

  const rHand = new THREE.Mesh(handGeo, gloveMat);
  rHand.position.set(0.0, -0.08, 0.04);

  const lArm = new THREE.Mesh(armGeo, sleeveMat);
  lArm.position.set(-0.24, -0.14, 0.04);
  lArm.rotation.set(0.22, 0.65, -0.15);

  const lCuff = new THREE.Mesh(cuffGeo, trimMat);
  lCuff.position.set(-0.14, -0.1, -0.09);
  lCuff.rotation.set(0.22, 0.65, -0.15);

  const lHand = new THREE.Mesh(handGeo, gloveMat);
  lHand.position.set(-0.04, -0.055, -0.16);
  lHand.rotation.y = 0.4;

  root.add(rArm, rCuff, rHand, lArm, lCuff, lHand);

  return {
    root,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

let cachedContactShadowTex: THREE.CanvasTexture | null = null;

function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedContactShadowTex) return cachedContactShadowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedContactShadowTex = tex;
  return tex;
}

export interface OperatorRig {
  root: THREE.Group;
  headGroup: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  gunMount: THREE.Group;
  dispose: () => void;
}

export function createOperatorRig(
  targetId: string,
  primaryColor: number,
  visorColor: number,
): OperatorRig {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const armorMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    roughness: 0.34,
    metalness: 0.48,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x141923,
    roughness: 0.76,
    metalness: 0.18,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.28,
    metalness: 0.85,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: visorColor,
    emissive: visorColor,
    emissiveIntensity: 1.55,
    roughness: 0.14,
    metalness: 0.85,
  });
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  mats.push(armorMat, darkMat, steelMat, visorMat, shadowMat);

  const shadowGeo = new THREE.PlaneGeometry(1.35, 1.35);
  shadowGeo.rotateX(-Math.PI / 2);
  geos.push(shadowGeo);
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.set(0, 0.015, 0);
  root.add(contactShadow);

  const legGeo = new THREE.BoxGeometry(0.26, 0.84, 0.28);
  legGeo.translate(0, 0.42, 0);
  const kneeGeo = new THREE.BoxGeometry(0.28, 0.26, 0.08);
  kneeGeo.translate(0, 0.48, -0.13);
  geos.push(legGeo, kneeGeo);

  const leftLeg = new THREE.Mesh(legGeo, darkMat);
  leftLeg.position.set(-0.19, 0, 0);
  leftLeg.userData = {hitbox: 'body', targetId};
  leftLeg.castShadow = true;
  const leftKnee = new THREE.Mesh(kneeGeo, armorMat);
  leftKnee.userData = {hitbox: 'body', targetId};
  leftLeg.add(leftKnee);

  const rightLeg = new THREE.Mesh(legGeo, darkMat);
  rightLeg.position.set(0.19, 0, 0);
  rightLeg.userData = {hitbox: 'body', targetId};
  rightLeg.castShadow = true;
  const rightKnee = new THREE.Mesh(kneeGeo, armorMat);
  rightKnee.userData = {hitbox: 'body', targetId};
  rightLeg.add(rightKnee);

  const waistGeo = new THREE.BoxGeometry(0.68, 0.16, 0.38);
  const torsoGeo = new THREE.BoxGeometry(0.74, 0.68, 0.4);
  const chestPlateGeo = new THREE.BoxGeometry(0.62, 0.42, 0.08);
  const chestCoreGeo = new THREE.BoxGeometry(0.26, 0.08, 0.03);
  const packGeo = new THREE.BoxGeometry(0.46, 0.52, 0.22);
  const ventGeo = new THREE.BoxGeometry(0.1, 0.24, 0.04);
  const padGeo = new THREE.BoxGeometry(0.24, 0.26, 0.34);
  geos.push(waistGeo, torsoGeo, chestPlateGeo, chestCoreGeo, packGeo, ventGeo, padGeo);

  const waist = new THREE.Mesh(waistGeo, darkMat);
  waist.position.set(0, 0.88, 0);
  waist.userData = {hitbox: 'body', targetId};

  const torso = new THREE.Mesh(torsoGeo, armorMat);
  torso.position.set(0, 1.24, 0);
  torso.userData = {hitbox: 'body', targetId};
  torso.castShadow = true;

  const chestPlate = new THREE.Mesh(chestPlateGeo, steelMat);
  chestPlate.position.set(0, 1.28, -0.21);
  chestPlate.userData = {hitbox: 'body', targetId};

  const chestCore = new THREE.Mesh(chestCoreGeo, visorMat);
  chestCore.position.set(0, 1.32, -0.25);
  chestCore.userData = {hitbox: 'body', targetId};

  const pack = new THREE.Mesh(packGeo, darkMat);
  pack.position.set(0, 1.28, 0.26);
  pack.userData = {hitbox: 'body', targetId};

  [-0.12, 0.12].forEach((vx) => {
    const vent = new THREE.Mesh(ventGeo, visorMat);
    vent.position.set(vx, 1.28, 0.37);
    vent.userData = {hitbox: 'body', targetId};
    root.add(vent);
  });

  [-0.48, 0.48].forEach((sx) => {
    const pad = new THREE.Mesh(padGeo, armorMat);
    pad.position.set(sx, 1.42, 0);
    pad.rotation.z = sx < 0 ? 0.12 : -0.12;
    pad.userData = {hitbox: 'body', targetId};
    pad.castShadow = true;
    root.add(pad);
  });

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.78, 0);

  const helmetGeo = new THREE.BoxGeometry(0.42, 0.42, 0.44);
  const crestGeo = new THREE.BoxGeometry(0.14, 0.08, 0.38);
  const visorGeo = new THREE.BoxGeometry(0.36, 0.15, 0.08);
  geos.push(helmetGeo, crestGeo, visorGeo);

  const helmet = new THREE.Mesh(helmetGeo, armorMat);
  helmet.userData = {hitbox: 'head', targetId};
  helmet.castShadow = true;

  const crest = new THREE.Mesh(crestGeo, steelMat);
  crest.position.set(0, 0.22, 0.01);
  crest.userData = {hitbox: 'head', targetId};

  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.02, -0.21);
  visor.userData = {hitbox: 'head', targetId};

  headGroup.add(helmet, crest, visor);

  const gunMount = new THREE.Group();
  gunMount.position.set(0.38, 1.24, -0.26);

  const gunBodyGeo = new THREE.BoxGeometry(0.095, 0.13, 0.56);
  const gunBarrelGeo = new THREE.CylinderGeometry(0.02, 0.022, 0.32, 8);
  gunBarrelGeo.rotateX(Math.PI / 2);
  const gunRailGeo = new THREE.BoxGeometry(0.04, 0.03, 0.36);
  geos.push(gunBodyGeo, gunBarrelGeo, gunRailGeo);

  const gunBody = new THREE.Mesh(gunBodyGeo, steelMat);
  gunBody.position.set(0, 0, -0.18);
  const gunBarrel = new THREE.Mesh(gunBarrelGeo, darkMat);
  gunBarrel.position.set(0, 0.02, -0.54);
  const gunRail = new THREE.Mesh(gunRailGeo, visorMat);
  gunRail.position.set(0, 0.075, -0.16);
  gunMount.add(gunBody, gunBarrel, gunRail);

  root.add(leftLeg, rightLeg, waist, torso, chestPlate, chestCore, pack, headGroup, gunMount);

  return {
    root,
    headGroup,
    leftLeg,
    rightLeg,
    gunMount,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export interface RangeTargetRig {
  root: THREE.Group;
  bodyMesh: THREE.Mesh;
  headMesh: THREE.Mesh;
  baseMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createRangeTarget(
  targetId: string,
  isDrone: boolean,
): RangeTargetRig {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const standMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.6,
    roughness: 0.4,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.5,
    metalness: 0.2,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.75,
    roughness: 0.35,
  });
  mats.push(standMat, baseMat, headMat);

  if (!isDrone) {
    const postGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.9, 8);
    postGeo.translate(0, 0.45, 0);
    geos.push(postGeo);
    const post = new THREE.Mesh(postGeo, standMat);
    post.castShadow = true;
    root.add(post);
  }

  const bodyGeo = isDrone
    ? new THREE.OctahedronGeometry(0.45, 0)
    : new THREE.BoxGeometry(0.74, 0.88, 0.18);
  const headGeo = isDrone
    ? new THREE.SphereGeometry(0.22, 12, 12)
    : new THREE.CylinderGeometry(0.21, 0.21, 0.18, 16);
  if (!isDrone) headGeo.rotateX(Math.PI / 2);
  geos.push(bodyGeo, headGeo);

  const bodyMesh = new THREE.Mesh(bodyGeo, baseMat);
  bodyMesh.position.set(0, isDrone ? 0 : 1.25, 0);
  bodyMesh.userData = {hitbox: 'body', targetId};
  bodyMesh.castShadow = true;

  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.set(0, isDrone ? 0.52 : 1.9, 0);
  headMesh.userData = {hitbox: 'head', targetId};
  headMesh.castShadow = true;

  root.add(bodyMesh, headMesh);

  return {
    root,
    bodyMesh,
    headMesh,
    baseMat,
    headMat,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
