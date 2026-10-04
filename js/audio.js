// Audio manager for ambient soundscapes, spatial waterfall, and chaotic events
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.ambientVolume = 0.7;
    this.waterfallVolume = 0.85;
    this.isInitialized = false;

    // Audio elements & nodes
    this.loops = {};
    this.oneShots = {};
    this.masterGain = null;
    this.ambientGain = null;
    this.waterfallGain = null;
    this.waterfallPanner = null;

    // Waterfall position in 3D scene
    this.waterfallPos = { x: -0.41, y: 0.18, z: -0.18 };

    this.oneShotList = [
      'child-laugh-1', 'child-laugh-2', 'kid-giggle', 'kids-play',
      'woman-laugh', 'man-laugh', 'teens-laugh',
      'bird-1', 'bird-2', 'leaves'
    ];

    this.timerId = null;
  }

  async init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      // Ambient bus
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this.ambientVolume;
      this.ambientGain.connect(this.masterGain);

      // Waterfall bus with spatial distance attenuation
      this.waterfallGain = this.ctx.createGain();
      this.waterfallGain.gain.value = this.waterfallVolume;
      this.waterfallGain.connect(this.masterGain);

      // Load background loops
      this.loadLoop('birds', './assets/audio/birds.mp3', 0.40, this.ambientGain);
      this.loadLoop('wind', './assets/audio/wind.mp3', 0.45, this.ambientGain);
      this.loadLoop('park', './assets/audio/park.mp3', 0.28, this.ambientGain);
      this.loadLoop('waterfall', './assets/audio/waterfall.mp3', 0.70, this.waterfallGain);

      // Preload one-shot audio buffers
      for (const name of this.oneShotList) {
        this.loadOneShot(name, `./assets/audio/${name}.mp3`);
      }
      this.loadOneShot('shutter', './assets/audio/shutter.mp3');

      this.isInitialized = true;
      this.startRandomEvents();
      console.log('Audio manager initialized successfully');
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  }

  loadLoop(name, url, defaultGain, destinationNode) {
    const audio = new Audio();
    audio.src = url;
    audio.loop = true;
    audio.crossOrigin = 'anonymous';

    try {
      const track = this.ctx.createMediaElementSource(audio);
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = defaultGain;
      track.connect(gainNode);
      gainNode.connect(destinationNode);

      this.loops[name] = { audio, gainNode, baseGain: defaultGain };
      audio.play().catch(() => {});
    } catch (err) {
      // Fallback direct playback
      audio.volume = defaultGain;
      audio.play().catch(() => {});
      this.loops[name] = { audio };
    }
  }

  async loadOneShot(name, url) {
    try {
      const resp = await fetch(url);
      const arrayBuf = await resp.arrayBuffer();
      const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
      this.oneShots[name] = audioBuf;
    } catch (e) {
      // Silently ignore if single one-shot buffer fails
    }
  }

  playOneShot(name, volume = 0.5, pan = 0) {
    if (!this.ctx || this.isMuted) return;
    const buf = this.oneShots[name];
    if (!buf) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buf;

      const gain = this.ctx.createGain();
      gain.gain.value = volume;

      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        source.connect(gain);
        gain.connect(panner);
        panner.connect(this.ambientGain);
      } else {
        source.connect(gain);
        gain.connect(this.ambientGain);
      }

      source.start(0);
    } catch (e) {}
  }

  playShutter() {
    this.playOneShot('shutter', 0.65, 0);
  }

  // Periodic chaotic natural sound events (kids giggling, rustling leaves, birds)
  startRandomEvents() {
    const scheduleNext = () => {
      // Random delay between 5 and 13 seconds
      const delay = (5 + Math.random() * 8) * 1000;
      this.timerId = setTimeout(() => {
        if (!this.isMuted && this.isInitialized) {
          const randomIndex = Math.floor(Math.random() * this.oneShotList.length);
          const soundName = this.oneShotList[randomIndex];
          const randomPan = (Math.random() - 0.5) * 1.6;
          const randomVol = 0.35 + Math.random() * 0.45;
          this.playOneShot(soundName, randomVol, randomPan);
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  // Adjust waterfall volume smoothly based on distance from camera
  updateCamera(camera) {
    if (!this.isInitialized || !this.waterfallGain) return;

    const dx = camera.position.x - this.waterfallPos.x;
    const dy = camera.position.y - this.waterfallPos.y;
    const dz = camera.position.z - this.waterfallPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Distance attenuation: near (0.3m) -> max, far (2.0m) -> quieter
    const t = Math.max(0, Math.min(1, (dist - 0.25) / 1.6));
    const distFactor = (1.0 - t * 0.75); // Range ~0.25 to 1.0

    this.waterfallGain.gain.setTargetAtTime(
      this.waterfallVolume * distFactor,
      this.ctx.currentTime,
      0.1
    );
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : 1.0,
        this.ctx.currentTime,
        0.05
      );
    }
    return this.isMuted;
  }

  setAmbientVolume(val) {
    this.ambientVolume = Math.max(0, Math.min(1, val));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.ambientVolume, this.ctx.currentTime, 0.05);
    }
  }

  setWaterfallVolume(val) {
    this.waterfallVolume = Math.max(0, Math.min(1, val));
    if (this.waterfallGain && this.ctx) {
      this.waterfallGain.gain.setTargetAtTime(this.waterfallVolume, this.ctx.currentTime, 0.05);
    }
  }
}
