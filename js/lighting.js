import * as THREE from 'three';

export function setupLighting(scene) {
  // Ambient & Hemisphere light for soft, natural outdoor illumination
  const hemiLight = new THREE.HemisphereLight(0xdff0ff, 0x544736, 1.1);
  hemiLight.position.set(0, 5, 0);
  scene.add(hemiLight);

  // Soft directional fill light from opposite angle to prevent dark pitch-black shadows
  const fillLight = new THREE.DirectionalLight(0xb0d4f5, 0.6);
  fillLight.position.set(-1.5, 1.0, -1.0);
  scene.add(fillLight);

  // Main Sun: Angled Directional Light with crisp, soft shadows
  const sunLight = new THREE.DirectionalLight(0xfff6e0, 2.5);
  // Angled sunlight shining across the maquette at ~38 degrees elevation
  sunLight.position.set(1.4, 1.8, 1.2);
  sunLight.castShadow = true;

  // Optimize shadow camera bounds tightly around the maquette [-0.7 to 0.7]
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.2;
  sunLight.shadow.camera.far = 4.5;
  const d = 0.85;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.015;

  scene.add(sunLight);

  // Sun preset states (Day, Sunset, Morning)
  const presets = [
    {
      name: 'Կեսօրվա արև',
      pos: new THREE.Vector3(1.4, 1.8, 1.2),
      color: 0xfff6e0,
      intensity: 2.5,
      hemi: 1.1,
      sky: 0x87ceeb
    },
    {
      name: 'Ոսկե մայրամուտ',
      pos: new THREE.Vector3(1.9, 0.7, 1.6),
      color: 0xffa34d,
      intensity: 3.0,
      hemi: 0.8,
      sky: 0x93656e
    },
    {
      name: 'Առավոտյան լույս',
      pos: new THREE.Vector3(-1.6, 1.6, 1.3),
      color: 0xfff0d0,
      intensity: 2.4,
      hemi: 1.0,
      sky: 0x90c8f0
    }
  ];

  let currentPresetIndex = 0;

  function setPreset(index) {
    currentPresetIndex = (index + presets.length) % presets.length;
    const p = presets[currentPresetIndex];
    sunLight.position.copy(p.pos);
    sunLight.color.setHex(p.color);
    sunLight.intensity = p.intensity;
    hemiLight.intensity = p.hemi;
    return p;
  }

  function cyclePreset() {
    return setPreset(currentPresetIndex + 1);
  }

  return {
    sunLight,
    hemiLight,
    fillLight,
    cyclePreset,
    getPreset: () => presets[currentPresetIndex]
  };
}
