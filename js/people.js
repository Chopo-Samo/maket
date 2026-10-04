import * as THREE from 'three';

// Procedural 3D People System
export class PeopleManager {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.people = [];
    this.group = new THREE.Group();
    this.group.name = 'people-group';
    this.scene.add(this.group);

    this.raycaster = new THREE.Raycaster();
    this.downVec = new THREE.Vector3(0, -1, 0);
    this.terrainMeshes = [];

    // Height cache grid for ultra-fast lookup (120 x 120)
    this.heightCache = new Map();

    // Color palettes for clothing and hair (architectural miniature style)
    this.shirtColors = [
      0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6,
      0xec4899, 0x06b6d4, 0xf97316, 0x64748b, 0xffffff
    ];
    this.pantsColors = [
      0x1e293b, 0x334155, 0x475569, 0x1e3a8a, 0x3f3f46, 0x78716c
    ];
    this.skinColors = [
      0xfed7aa, 0xfcd34d, 0xfbbd23, 0xfbbf24, 0xe2e8f0, 0xd97706
    ];
    this.hairColors = [
      0x1c1917, 0x451a03, 0x78350f, 0xb45309, 0xfef08a, 0x71717a
    ];

    // Shared geometries to minimize memory and draw calls
    this.geos = {
      head: new THREE.SphereGeometry(0.0035, 8, 8),
      hair: new THREE.SphereGeometry(0.0038, 8, 6),
      torso: new THREE.BoxGeometry(0.0065, 0.009, 0.0045),
      limb: new THREE.BoxGeometry(0.0024, 0.009, 0.0024),
      phone: new THREE.BoxGeometry(0.0012, 0.0022, 0.0006),
      ripple: new THREE.RingGeometry(0.004, 0.009, 16)
    };
    this.geos.ripple.rotateX(-Math.PI / 2);
  }

  setTerrainMeshes(meshes) {
    this.terrainMeshes = meshes;
    this.initPeople();
  }

  getGroundHeight(x, z, defaultY = 0.05) {
    // Round to 0.005 for spatial caching
    const key = `${Math.round(x * 200)},${Math.round(z * 200)}`;
    if (this.heightCache.has(key)) return this.heightCache.get(key);

    if (this.terrainMeshes.length === 0) return defaultY;

    this.raycaster.set(new THREE.Vector3(x, 1.0, z), this.downVec);
    const hits = this.raycaster.intersectObjects(this.terrainMeshes, true);
    let y = defaultY;
    if (hits.length > 0) {
      y = hits[0].point.y;
    }
    this.heightCache.set(key, y);
    return y;
  }

  // Create a stylized maquette figurine
  createFigure(isChild = false) {
    const scale = isChild ? 0.65 : 1.0;
    const figure = new THREE.Group();

    // Random styling
    const skinCol = this.skinColors[Math.floor(Math.random() * this.skinColors.length)];
    const shirtCol = this.shirtColors[Math.floor(Math.random() * this.shirtColors.length)];
    const pantsCol = this.pantsColors[Math.floor(Math.random() * this.pantsColors.length)];
    const hairCol = this.hairColors[Math.floor(Math.random() * this.hairColors.length)];

    const skinMat = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.6 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtCol, roughness: 0.5 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsCol, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: hairCol, roughness: 0.8 });

    // Torso
    const torso = new THREE.Mesh(this.geos.torso, shirtMat);
    torso.position.y = 0.0135 * scale;
    torso.castShadow = true;
    figure.add(torso);

    // Head & Hair
    const head = new THREE.Mesh(this.geos.head, skinMat);
    head.position.y = 0.0205 * scale;
    head.castShadow = true;
    figure.add(head);

    const hair = new THREE.Mesh(this.geos.hair, hairMat);
    hair.position.set(0, 0.0215 * scale, -0.0005 * scale);
    hair.scale.set(1, 0.7, 1);
    figure.add(hair);

    // Left & Right Arms (pivoted at shoulders)
    const armPivotL = new THREE.Group();
    armPivotL.position.set(-0.0048 * scale, 0.017 * scale, 0);
    const armL = new THREE.Mesh(this.geos.limb, shirtMat);
    armL.position.y = -0.0045 * scale;
    armL.castShadow = true;
    armPivotL.add(armL);
    figure.add(armPivotL);

    const armPivotR = new THREE.Group();
    armPivotR.position.set(0.0048 * scale, 0.017 * scale, 0);
    const armR = new THREE.Mesh(this.geos.limb, shirtMat);
    armR.position.y = -0.0045 * scale;
    armR.castShadow = true;
    armPivotR.add(armR);
    figure.add(armPivotR);

    // Left & Right Legs (pivoted at hips)
    const legPivotL = new THREE.Group();
    legPivotL.position.set(-0.0022 * scale, 0.009 * scale, 0);
    const legL = new THREE.Mesh(this.geos.limb, pantsMat);
    legL.position.y = -0.0045 * scale;
    legL.castShadow = true;
    legPivotL.add(legL);
    figure.add(legPivotL);

    const legPivotR = new THREE.Group();
    legPivotR.position.set(0.0022 * scale, 0.009 * scale, 0);
    const legR = new THREE.Mesh(this.geos.limb, pantsMat);
    legR.position.y = -0.0045 * scale;
    legR.castShadow = true;
    legPivotR.add(legR);
    figure.add(legPivotR);

    // Optional phone/camera in right hand
    const phone = new THREE.Mesh(this.geos.phone, new THREE.MeshBasicMaterial({ color: 0x111111 }));
    phone.position.set(0, -0.008 * scale, 0.002 * scale);
    phone.visible = false;
    armPivotR.add(phone);

    // Flash light for photography
    const flashLight = new THREE.PointLight(0xffffff, 0, 0.15);
    flashLight.position.set(0, 0.02 * scale, 0.01 * scale);
    figure.add(flashLight);

    return {
      group: figure,
      scale,
      head,
      torso,
      armPivotL,
      armPivotR,
      legPivotL,
      legPivotR,
      phone,
      flashLight,
      shirtMat
    };
  }

  initPeople() {
    this.group.clear();
    this.people = [];

    // Configuration for the 20 people
    const configs = [
      // 1. Swimmers in waterfall pool (2 people)
      {
        role: 'swimmer',
        pos: [-0.345, -0.068],
        isChild: false,
        name: 'Լողացող ջրվեժի մոտ'
      },
      {
        role: 'swimmer',
        pos: [-0.325, -0.052],
        isChild: false,
        name: 'Լողացող'
      },

      // 2. Church: Visiting / Entering church (2 people)
      {
        role: 'church-visitor',
        pos: [-0.07, -0.15],
        doorPos: [-0.045, -0.185],
        targetPos: [-0.07, -0.08],
        name: 'Եկեղեցու այցելու'
      },
      {
        role: 'church-visitor',
        pos: [-0.045, -0.18],
        doorPos: [-0.045, -0.185],
        targetPos: [-0.12, -0.06],
        name: 'Հավատացյալ'
      },

      // 3. Church outdoor strolling & photographer (2 people)
      {
        role: 'photographer',
        pos: [-0.02, -0.12],
        photoTarget: [-0.08, 0.15, -0.28], // Point camera at church domes
        name: 'Լուսանկարիչ եկեղեցու մոտ'
      },
      {
        role: 'wanderer',
        pos: [-0.12, -0.16],
        bounds: { minX: -0.16, maxX: -0.04, minZ: -0.22, maxZ: -0.08 },
        name: 'Եկեղեցու մոտ զբոսնող'
      },

      // 4. Barn: Sitting & resting (3 people)
      {
        role: 'sitting-barn',
        pos: [0.25, -0.03],
        yaw: Math.PI * 0.75,
        name: 'Հանգստացող մառանի մոտ'
      },
      {
        role: 'talking-barn',
        pos: [0.235, -0.045],
        yaw: -Math.PI * 0.25,
        name: 'Զրուցող մառանի մոտ'
      },
      {
        role: 'wanderer',
        pos: [0.27, -0.08],
        bounds: { minX: 0.18, maxX: 0.32, minZ: -0.12, maxZ: 0.05 },
        name: 'Մառանի հյուր'
      },

      // 5. Campfire / Picnic / Benches (3 people)
      {
        role: 'sitting-fire',
        pos: [-0.185, -0.02],
        yaw: Math.PI * 0.2,
        name: 'Խարույկի մոտ նստած'
      },
      {
        role: 'child-playing',
        pos: [-0.21, -0.005],
        isChild: true,
        bounds: { minX: -0.25, maxX: -0.15, minZ: -0.06, maxZ: 0.05 },
        name: 'Խաղացող երեխա'
      },
      {
        role: 'sitting-bench',
        pos: [0.125, -0.175],
        yaw: Math.PI * 0.9,
        name: 'Նստարանին հանգստացող'
      },

      // 6. Waterfall photographer & bridge walker (2 people)
      {
        role: 'photographer',
        pos: [-0.26, -0.08],
        photoTarget: [-0.38, 0.12, -0.14], // Point camera at waterfall cascade
        name: 'Լուսանկարիչ ջրվեժի մոտ'
      },
      {
        role: 'wanderer',
        pos: [-0.33, -0.14],
        bounds: { minX: -0.36, maxX: -0.24, minZ: -0.18, maxZ: -0.06 },
        name: 'Կամրջի մոտ զբոսնող'
      },

      // 7. Talking pair in central park (2 people)
      {
        role: 'talking-pair',
        pos: [-0.08, 0.02],
        partnerPos: [-0.065, 0.025],
        name: 'Այգում զրուցող'
      },
      {
        role: 'talking-pair',
        pos: [-0.065, 0.025],
        partnerPos: [-0.08, 0.02],
        name: 'Զրուցակից'
      },

      // 8. Talking pair by gazebo / clearing (2 people)
      {
        role: 'talking-pair',
        pos: [0.03, -0.04],
        partnerPos: [0.045, -0.035],
        name: 'Հանգստացող'
      },
      {
        role: 'talking-pair',
        pos: [0.045, -0.035],
        partnerPos: [0.03, -0.04],
        name: 'Հանգստացող'
      },

      // 9. Free wanderers & Children across park paths (2 people)
      {
        role: 'child-playing',
        pos: [0.08, 0.15],
        isChild: true,
        bounds: { minX: 0.0, maxX: 0.18, minZ: 0.08, maxZ: 0.22 },
        name: 'Վազվզող երեխա'
      },
      {
        role: 'wanderer',
        pos: [0.15, -0.05],
        bounds: { minX: 0.05, maxX: 0.25, minZ: -0.15, maxZ: 0.05 },
        name: 'Զբոսնող'
      }
    ];

    configs.forEach((cfg, idx) => {
      const isChild = cfg.isChild || false;
      const figure = this.createFigure(isChild);
      const groundY = this.getGroundHeight(cfg.pos[0], cfg.pos[1]);

      figure.group.position.set(cfg.pos[0], groundY, cfg.pos[1]);
      if (cfg.yaw != null) figure.group.rotation.y = cfg.yaw;

      this.group.add(figure.group);

      // Create person state machine
      const person = {
        id: idx,
        name: cfg.name,
        role: cfg.role,
        figure,
        pos: new THREE.Vector2(cfg.pos[0], cfg.pos[1]),
        target: new THREE.Vector2(cfg.pos[0], cfg.pos[1]),
        speed: isChild ? 0.022 : 0.014,
        walkCycle: Math.random() * Math.PI * 2,
        stateTimer: 2 + Math.random() * 5,
        state: 'idle',
        cfg
      };

      // Role specific setup
      if (cfg.role === 'swimmer') {
        // Lower into water pool (water level is at y ~ 0.129)
        figure.group.position.y = 0.122;
        // Legs slightly bent
        figure.legPivotL.rotation.x = Math.PI * 0.35;
        figure.legPivotR.rotation.x = Math.PI * 0.35;
        // Water ripple ring around swimmer
        const rippleMat = new THREE.MeshBasicMaterial({
          color: 0x88e0ef,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide
        });
        const ripple = new THREE.Mesh(this.geos.ripple, rippleMat);
        ripple.position.y = 0.129 - figure.group.position.y;
        figure.group.add(ripple);
        person.ripple = ripple;
        person.state = 'swimming';
      } else if (cfg.role.startsWith('sitting')) {
        // Bend legs 90 deg for sitting
        figure.legPivotL.rotation.x = Math.PI * 0.48;
        figure.legPivotR.rotation.x = Math.PI * 0.48;
        figure.group.position.y -= 0.004; // Adjust onto bench/seat
        person.state = 'sitting';
      } else if (cfg.role === 'photographer') {
        person.state = 'taking-photo';
        person.photoTimer = 3 + Math.random() * 4;
        figure.phone.visible = true;
      } else if (cfg.role === 'talking-pair') {
        person.state = 'talking';
        // Face partner
        if (cfg.partnerPos) {
          const dx = cfg.partnerPos[0] - cfg.pos[0];
          const dz = cfg.partnerPos[1] - cfg.pos[1];
          figure.group.rotation.y = Math.atan2(dx, dz);
        }
      } else if (cfg.role === 'church-visitor') {
        person.state = 'walking-to-church';
        person.target.set(cfg.doorPos[0], cfg.doorPos[1]);
        person.isInside = false;
      } else if (cfg.role === 'wanderer' || cfg.role === 'child-playing') {
        this.pickNewTarget(person);
      }

      this.people.push(person);
    });
  }

  pickNewTarget(person) {
    const b = person.cfg.bounds || { minX: -0.25, maxX: 0.25, minZ: -0.25, maxZ: 0.25 };
    const tx = b.minX + Math.random() * (b.maxX - b.minX);
    const tz = b.minZ + Math.random() * (b.maxZ - b.minZ);
    person.target.set(tx, tz);
    person.state = 'walking';
  }

  update(delta, elapsed) {
    for (const p of this.people) {
      const f = p.figure;

      // 1. Swimmer animation
      if (p.role === 'swimmer') {
        // Bob up and down in water
        const bob = Math.sin(elapsed * 2.8 + p.id) * 0.0018;
        f.group.position.y = 0.122 + bob;
        // Arm swimming strokes
        f.armPivotL.rotation.x = Math.sin(elapsed * 2.5 + p.id) * 0.6;
        f.armPivotR.rotation.x = Math.sin(elapsed * 2.5 + p.id + Math.PI) * 0.6;
        // Ripple pulsation
        if (p.ripple) {
          const rScale = 1.0 + Math.sin(elapsed * 4.0 + p.id) * 0.25;
          p.ripple.scale.set(rScale, rScale, rScale);
        }
        continue;
      }

      // 2. Sitting persons
      if (p.state === 'sitting') {
        // Idle head turning & subtle breathing
        f.head.rotation.y = Math.sin(elapsed * 0.8 + p.id) * 0.35;
        f.torso.rotation.x = Math.sin(elapsed * 1.5 + p.id) * 0.02;
        continue;
      }

      // 3. Talking persons
      if (p.state === 'talking') {
        f.head.rotation.y = Math.sin(elapsed * 2.0 + p.id) * 0.2;
        // Occasional expressive arm gesturing
        f.armPivotR.rotation.x = -Math.PI * 0.25 + Math.sin(elapsed * 3.5 + p.id) * 0.4;
        f.armPivotL.rotation.x = Math.sin(elapsed * 2.2 + p.id) * 0.15;
        continue;
      }

      // 4. Photographer behavior
      if (p.role === 'photographer') {
        p.photoTimer -= delta;
        if (p.photoTimer <= 0) {
          // Snap photo!
          p.photoTimer = 6 + Math.random() * 8;
          f.flashLight.intensity = 3.5;
          this.audioManager.playShutter();
          setTimeout(() => { f.flashLight.intensity = 0; }, 120);
        }
        // Face target
        if (p.cfg.photoTarget) {
          const dx = p.cfg.photoTarget[0] - p.pos.x;
          const dz = p.cfg.photoTarget[2] - p.pos.y;
          f.group.rotation.y = Math.atan2(dx, dz);
        }
        // Raise phone/camera to eye level
        f.armPivotR.rotation.x = -Math.PI * 0.45;
        f.armPivotL.rotation.x = -Math.PI * 0.35;
        continue;
      }

      // 5. Church visitor: Entering / Exiting church
      if (p.role === 'church-visitor') {
        p.stateTimer -= delta;
        if (p.isInside) {
          if (p.stateTimer <= 0) {
            // Exit church
            p.isInside = false;
            f.group.visible = true;
            p.stateTimer = 10 + Math.random() * 8;
            p.state = 'walking';
            p.target.set(p.cfg.targetPos[0], p.cfg.targetPos[1]);
          }
          continue;
        } else if (p.state === 'walking-to-church') {
          const distToDoor = p.pos.distanceTo(p.target);
          if (distToDoor < 0.015) {
            // Stepped inside church
            p.isInside = true;
            f.group.visible = false;
            p.stateTimer = 12 + Math.random() * 12; // stay inside for 12-24 seconds
            continue;
          }
        } else if (p.stateTimer <= 0 && !p.isInside) {
          // Decide to visit church again
          p.state = 'walking-to-church';
          p.target.set(p.cfg.doorPos[0], p.cfg.doorPos[1]);
          p.stateTimer = 25 + Math.random() * 15;
        }
      }

      // 6. Walking navigation & animation
      if (p.state === 'walking' || p.state === 'walking-to-church') {
        const dx = p.target.x - p.pos.x;
        const dz = p.target.y - p.pos.y;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.008) {
          const moveDist = p.speed * delta;
          const stepX = (dx / dist) * Math.min(dist, moveDist);
          const stepZ = (dz / dist) * Math.min(dist, moveDist);

          p.pos.x += stepX;
          p.pos.y += stepZ;

          // Rotate to face movement direction
          const targetAngle = Math.atan2(dx, dz);
          f.group.rotation.y = targetAngle;

          // Update position and terrain ground height
          const groundY = this.getGroundHeight(p.pos.x, p.pos.y);
          f.group.position.set(p.pos.x, groundY, p.pos.y);

          // Animate walk cycle (swing legs & arms)
          p.walkCycle += delta * (p.speed * 450);
          const legSwing = Math.sin(p.walkCycle) * 0.65;
          f.legPivotL.rotation.x = legSwing;
          f.legPivotR.rotation.x = -legSwing;
          f.armPivotL.rotation.x = -legSwing * 0.8;
          f.armPivotR.rotation.x = legSwing * 0.8;
          // Slight body bounce
          f.torso.position.y = (0.0135 + Math.abs(Math.sin(p.walkCycle * 2)) * 0.0008) * f.scale;
        } else {
          // Reached destination, pause and idle
          p.state = 'idle';
          p.stateTimer = 3 + Math.random() * 6;
          // Reset limbs to neutral stand
          f.legPivotL.rotation.x = 0;
          f.legPivotR.rotation.x = 0;
          f.armPivotL.rotation.x = 0;
          f.armPivotR.rotation.x = 0;
        }
      } else if (p.state === 'idle') {
        p.stateTimer -= delta;
        // Idle breathing and head glance
        f.head.rotation.y = Math.sin(elapsed * 1.5 + p.id) * 0.25;
        if (p.stateTimer <= 0) {
          if (p.role === 'wanderer' || p.role === 'child-playing') {
            this.pickNewTarget(p);
          }
        }
      }
    }
  }
}
