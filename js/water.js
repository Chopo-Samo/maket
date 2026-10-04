import * as THREE from 'three';

export function createWaterfall(scene) {
  const waterGroup = new THREE.Group();
  waterGroup.name = 'waterfall-system';

  // 1. Spline path for the main waterfall stream down the yellow rock cascade
  const curvePoints = [
    new THREE.Vector3(-0.460, 0.305, -0.270), // Top of cliff cascade
    new THREE.Vector3(-0.442, 0.225, -0.225), // Upper rock cascade
    new THREE.Vector3(-0.418, 0.175, -0.180), // Mid rock ledge
    new THREE.Vector3(-0.392, 0.152, -0.140), // Rocky chute above bridge
    new THREE.Vector3(-0.365, 0.138, -0.105), // Bridge runoff
    new THREE.Vector3(-0.340, 0.129, -0.070)  // Pool entry
  ];

  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const segments = 48;
  const ribbonWidth = 0.038;

  // Generate ribbon geometry perpendicular to flow direction
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // Slightly wider at the bottom pool
    const w = ribbonWidth * (0.85 + 0.35 * t);

    // Left vertex
    positions.push(pt.x - normal.x * w * 0.5, pt.y - normal.y * w * 0.5, pt.z - normal.z * w * 0.5);
    uvs.push(0, t);

    // Right vertex
    positions.push(pt.x + normal.x * w * 0.5, pt.y + normal.y * w * 0.5, pt.z + normal.z * w * 0.5);
    uvs.push(1, t);

    if (i < segments) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ribbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  ribbonGeo.setIndex(indices);
  ribbonGeo.computeVertexNormals();

  // Procedural flowing water shader with foam streaks and noise
  const waterShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(0x1a8cb8) },
      uShallowColor: { value: new THREE.Color(0x6ee7b7) },
      uFoamColor: { value: new THREE.Color(0xffffff) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      uniform float uTime;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 pos = position;
        // Subtle micro-ripple displacement
        pos += normal * (sin(uv.y * 40.0 - uTime * 8.0) * 0.0012);
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      uniform float uTime;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uFoamColor;

      // Pseudo-random noise function
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      void main() {
        // High speed flow downwards along Y UV
        float flowY = vUv.y * 14.0 - uTime * 4.5;
        float flowX = vUv.x * 6.0;

        float n1 = noise(vec2(flowX * 2.0, flowY));
        float n2 = noise(vec2(flowX * 4.0 - flowY * 0.5, flowY * 1.5));
        float combinedNoise = (n1 + n2 * 0.5) / 1.5;

        // Base gradient from deep water to shallow
        vec3 baseWater = mix(uDeepColor, uShallowColor, combinedNoise * 0.7);

        // Foam threshold (streaks where water tumbles down)
        float foamIntensity = smoothstep(0.48, 0.75, combinedNoise);
        // Extra foam at the start of drops and near edges
        float edgeFoam = smoothstep(0.35, 0.0, abs(vUv.x - 0.5));
        foamIntensity = clamp(foamIntensity + (1.0 - edgeFoam) * 0.25, 0.0, 1.0);

        vec3 finalColor = mix(baseWater, uFoamColor, foamIntensity * 0.85);

        // Specular highlight / Fresnel
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
        finalColor += vec3(0.4) * fresnel;

        float alpha = clamp(0.72 + foamIntensity * 0.26, 0.0, 0.95);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const waterMesh = new THREE.Mesh(ribbonGeo, waterShaderMaterial);
  waterGroup.add(waterMesh);

  // 2. Pool Water Surface (basin at the bottom of the waterfall)
  const poolGeo = new THREE.CircleGeometry(0.065, 32);
  poolGeo.rotateX(-Math.PI / 2);
  poolGeo.scale(1.2, 1, 0.9); // Elliptical basin

  const poolMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector2(-0.31, -0.11) }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;

      void main() {
        vec2 p = vUv - 0.5;
        float d = length(p);
        // Expanding circular ripple waves
        float ripples = sin(d * 42.0 - uTime * 5.0) * 0.5 + 0.5;
        float microRipples = sin(d * 75.0 - uTime * 7.0) * 0.5 + 0.5;

        vec3 waterColor = mix(vec3(0.08, 0.45, 0.65), vec3(0.35, 0.78, 0.88), ripples * 0.4);
        waterColor += vec3(1.0) * (pow(microRipples, 4.0) * 0.2);

        // Edge fade
        float edgeFade = smoothstep(0.5, 0.35, d);
        gl_FragColor = vec4(waterColor, edgeFade * 0.78);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const poolMesh = new THREE.Mesh(poolGeo, poolMaterial);
  poolMesh.position.set(-0.340, 0.129, -0.065);
  waterGroup.add(poolMesh);

  // 3. Spray and Mist Particle System
  const particleCount = 80;
  const pPositions = new Float32Array(particleCount * 3);
  const pVelocities = [];

  // Splashdown origin at the bottom of the cascade
  const splashOrigin = new THREE.Vector3(-0.340, 0.130, -0.070);

  for (let i = 0; i < particleCount; i++) {
    pPositions[i * 3] = splashOrigin.x + (Math.random() - 0.5) * 0.03;
    pPositions[i * 3 + 1] = splashOrigin.y + Math.random() * 0.02;
    pPositions[i * 3 + 2] = splashOrigin.z + (Math.random() - 0.5) * 0.03;

    pVelocities.push({
      vx: (Math.random() - 0.5) * 0.03,
      vy: 0.02 + Math.random() * 0.05,
      vz: (Math.random() - 0.5) * 0.03,
      life: Math.random()
    });
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

  // Circular soft sprite texture generated on canvas
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(210,245,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  const pTex = new THREE.CanvasTexture(canvas);

  const pMat = new THREE.PointsMaterial({
    size: 0.014,
    map: pTex,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(pGeo, pMat);
  waterGroup.add(particleSystem);

  scene.add(waterGroup);

  // Update animation loop
  function update(delta, elapsed) {
    waterShaderMaterial.uniforms.uTime.value = elapsed;
    poolMaterial.uniforms.uTime.value = elapsed;

    // Animate splash droplets
    const pos = pGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const v = pVelocities[i];
      v.life += delta * 1.8;

      if (v.life > 1.0) {
        // Reset particle
        pos[i * 3] = splashOrigin.x + (Math.random() - 0.5) * 0.03;
        pos[i * 3 + 1] = splashOrigin.y + 0.005;
        pos[i * 3 + 2] = splashOrigin.z + (Math.random() - 0.5) * 0.03;
        v.vx = (Math.random() - 0.5) * 0.025;
        v.vy = 0.02 + Math.random() * 0.04;
        v.vz = (Math.random() - 0.5) * 0.025;
        v.life = 0;
      } else {
        pos[i * 3] += v.vx * delta;
        pos[i * 3 + 1] += v.vy * delta;
        pos[i * 3 + 2] += v.vz * delta;
        v.vy -= 0.12 * delta; // Gravity
      }
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  return {
    group: waterGroup,
    update,
    waterfallCenter: new THREE.Vector3(-0.41, 0.18, -0.18),
    poolCenter: new THREE.Vector3(-0.34, 0.129, -0.065)
  };
}
