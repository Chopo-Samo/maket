import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import { setupLighting } from './lighting.js';
import { createWaterfall } from './water.js';
import { AudioManager } from './audio.js';
import { PeopleManager } from './people.js';

// Application State
const app = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  lighting: null,
  waterfall: null,
  audio: null,
  people: null,
  clock: new THREE.Clock(),
  isAutoRotate: false,

  // Smooth camera tweening
  camTween: {
    active: false,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
    duration: 1.4
  }
};
window.app = app;

// Camera viewpoints
const CAMERA_VIEWS = {
  overview: {
    pos: new THREE.Vector3(0.75, 1.05, 1.25),
    target: new THREE.Vector3(0.0, 0.08, 0.0)
  },
  waterfall: {
    pos: new THREE.Vector3(-0.24, 0.26, 0.02),
    target: new THREE.Vector3(-0.41, 0.17, -0.17)
  },
  swimming: {
    pos: new THREE.Vector3(-0.24, 0.18, 0.04),
    target: new THREE.Vector3(-0.34, 0.129, -0.065)
  },
  church: {
    pos: new THREE.Vector3(0.08, 0.22, -0.02),
    target: new THREE.Vector3(-0.06, 0.12, -0.26)
  },
  barn: {
    pos: new THREE.Vector3(0.42, 0.22, 0.22),
    target: new THREE.Vector3(0.24, 0.08, 0.04)
  },
  picnic: {
    pos: new THREE.Vector3(-0.08, 0.16, 0.16),
    target: new THREE.Vector3(-0.19, 0.05, -0.02)
  }
};

// Initialize Three.js Scene
function initScene() {
  const container = document.getElementById('canvas-container');

  // Scene
  app.scene = new THREE.Scene();
  app.scene.background = new THREE.Color(0x92b4d4);
  app.scene.fog = new THREE.FogExp2(0x9cbcd8, 0.25);

  // Camera
  const aspect = window.innerWidth / window.innerHeight;
  app.camera = new THREE.PerspectiveCamera(40, aspect, 0.01, 20);
  app.camera.position.copy(CAMERA_VIEWS.overview.pos);

  // Renderer
  app.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  app.renderer.setSize(window.innerWidth, window.innerHeight);
  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  app.renderer.shadowMap.enabled = true;
  app.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  app.renderer.toneMappingExposure = 1.18;
  app.renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(app.renderer.domElement);

  // Controls
  app.controls = new OrbitControls(app.camera, app.renderer.domElement);
  app.controls.enableDamping = true;
  app.controls.dampingFactor = 0.05;
  app.controls.target.copy(CAMERA_VIEWS.overview.target);
  app.controls.maxPolarAngle = Math.PI / 2 - 0.06; // Prevent going under the model
  app.controls.minDistance = 0.12;
  app.controls.maxDistance = 3.5;

  // Add subtle floor shadow plane under maquette
  const groundGeo = new THREE.PlaneGeometry(3.5, 3.5);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.002;
  groundPlane.receiveShadow = true;
  app.scene.add(groundPlane);

  // Modular systems
  app.lighting = setupLighting(app.scene);
  app.waterfall = createWaterfall(app.scene);
  app.audio = new AudioManager();
  app.people = new PeopleManager(app.scene, app.audio);

  // Handle window resizing
  window.addEventListener('resize', onWindowResize);
}

// Window resize handler
function onWindowResize() {
  app.camera.aspect = window.innerWidth / window.innerHeight;
  app.camera.updateProjectionMatrix();
  app.renderer.setSize(window.innerWidth, window.innerHeight);
}

// Smooth Camera Transition
function transitionToView(viewKey) {
  const v = CAMERA_VIEWS[viewKey];
  if (!v) return;

  app.camTween.startPos.copy(app.camera.position);
  app.camTween.endPos.copy(v.pos);
  app.camTween.startTarget.copy(app.controls.target);
  app.camTween.endTarget.copy(v.target);
  app.camTween.progress = 0;
  app.camTween.active = true;

  // Temporarily disable auto rotate during camera move
  app.controls.autoRotate = false;
}

function updateCameraTween(delta) {
  if (!app.camTween.active) return;

  app.camTween.progress += delta / app.camTween.duration;
  if (app.camTween.progress >= 1.0) {
    app.camTween.progress = 1.0;
    app.camTween.active = false;
    app.camera.position.copy(app.camTween.endPos);
    app.controls.target.copy(app.camTween.endTarget);
    app.controls.update();
    if (app.isAutoRotate) app.controls.autoRotate = true;
    return;
  }

  // Smooth ease-in-out curve
  const t = app.camTween.progress;
  const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  app.camera.position.lerpVectors(app.camTween.startPos, app.camTween.endPos, ease);
  app.controls.target.lerpVectors(app.camTween.startTarget, app.camTween.endTarget, ease);
  app.camera.lookAt(app.controls.target);
}

// Load 3D Model with progress updates
function loadModel() {
  const progressBar = document.getElementById('progress-bar');
  const progressStatus = document.getElementById('progress-status');
  const btnEnter = document.getElementById('btn-enter');
  const progressContainer = document.getElementById('progress-container');

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  loader.load(
    './assets/model.glb',
    (gltf) => {
      const maquette = gltf.scene;
      const terrainMeshes = [];

      maquette.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          if (node.material) {
            node.material.roughness = 0.82;
            node.material.metalness = 0.02;
          }
          terrainMeshes.push(node);
        }
      });

      app.scene.add(maquette);

      // Connect terrain meshes to people manager for exact ground height tracking
      app.people.setTerrainMeshes(terrainMeshes);

      // Loading complete UI
      progressStatus.textContent = 'Պատրաստ է!';
      progressBar.style.width = '100%';
      setTimeout(() => {
        progressContainer.style.display = 'none';
        btnEnter.classList.add('ready');
      }, 300);

      document.title = 'ready'; // Flag for automated screenshot tests
    },
    (xhr) => {
      if (xhr.lengthComputable && xhr.total > 0) {
        const pct = Math.round((xhr.loaded / xhr.total) * 100);
        progressBar.style.width = pct + '%';
        progressStatus.textContent = `3D մոդելի բեռնում... ${pct}%`;
      }
    },
    (err) => {
      console.error('Error loading model:', err);
      progressStatus.textContent = 'Մոդելի բեռնման սխալ: Ստուգեք կոնսոլը:';
    }
  );
}

// Setup User Interface Listeners
function setupUI() {
  const splash = document.getElementById('splash-screen');
  const btnEnter = document.getElementById('btn-enter');
  const btnSound = document.getElementById('btn-sound');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');
  const btnSun = document.getElementById('btn-sun');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnAutoRotate = document.getElementById('btn-autorotate');
  const btnVolumePopup = document.getElementById('btn-volume-popup');
  const volumePopup = document.getElementById('volume-popup');
  const sliderAmbient = document.getElementById('slider-ambient-vol');
  const sliderWaterfall = document.getElementById('slider-waterfall-vol');
  const labelAmbient = document.getElementById('label-ambient-vol');
  const labelWaterfall = document.getElementById('label-waterfall-vol');
  const statusChip = document.getElementById('status-chip');

  // Enter button
  btnEnter.addEventListener('click', async () => {
    splash.classList.add('hidden');
    await app.audio.init();
  });

  // Sound toggle button
  btnSound.addEventListener('click', () => {
    const isMuted = app.audio.toggleMute();
    iconSoundOn.style.display = isMuted ? 'none' : 'block';
    iconSoundOff.style.display = isMuted ? 'block' : 'none';
    btnSound.classList.toggle('active', !isMuted);
  });

  // Volume popup toggle
  btnVolumePopup.addEventListener('click', (e) => {
    e.stopPropagation();
    volumePopup.classList.toggle('show');
    btnVolumePopup.classList.toggle('active', volumePopup.classList.contains('show'));
  });

  document.addEventListener('click', (e) => {
    if (!volumePopup.contains(e.target) && e.target !== btnVolumePopup) {
      volumePopup.classList.remove('show');
      btnVolumePopup.classList.remove('active');
    }
  });

  // Volume sliders
  sliderAmbient.addEventListener('input', (e) => {
    const val = e.target.value / 100;
    labelAmbient.textContent = e.target.value + '%';
    app.audio.setAmbientVolume(val);
  });

  sliderWaterfall.addEventListener('input', (e) => {
    const val = e.target.value / 100;
    labelWaterfall.textContent = e.target.value + '%';
    app.audio.setWaterfallVolume(val);
  });

  // Sun preset cycling
  btnSun.addEventListener('click', () => {
    const preset = app.lighting.cyclePreset();
    app.scene.background.setHex(preset.sky);
    app.scene.fog.color.setHex(preset.sky);
    statusChip.textContent = `${preset.name} • 20 բնակիչ`;
  });

  // Fullscreen toggle
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Auto-rotate toggle
  btnAutoRotate.addEventListener('click', () => {
    app.isAutoRotate = !app.isAutoRotate;
    app.controls.autoRotate = app.isAutoRotate;
    app.controls.autoRotateSpeed = 0.8;
    btnAutoRotate.classList.toggle('active', app.isAutoRotate);
  });

  // Navigation camera pills
  const navPills = document.querySelectorAll('.nav-pill[data-view]');
  navPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      navPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      transitionToView(pill.dataset.view);
    });
  });
}

// Animation Loop
function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(app.clock.getDelta(), 0.1);
  const elapsed = app.clock.getElapsedTime();

  // Update camera tween
  if (app.camTween.active) {
    updateCameraTween(delta);
  } else {
    // Update controls only when not actively tweening
    app.controls.update();
  }

  // Update systems
  if (app.waterfall) {
    app.waterfall.update(delta, elapsed);
  }

  if (app.people) {
    app.people.update(delta, elapsed);
  }

  if (app.audio) {
    app.audio.updateCamera(app.camera);
  }

  // Render scene
  app.renderer.render(app.scene, app.camera);
}

// Start Application
initScene();
setupUI();
loadModel();
animate();
