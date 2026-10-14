import * as THREE from 'three';
import {
  ChairPlacement,
  CHAIR_SEAT_SIZE,
  DINING_CHAIR_OFFSET,
  Collider,
  DINING_TABLES,
  DINING_TABLE_SIZE,
  Door,
  Interactable,
  InspectionInfo,
  Seat,
  ROOM_LABELS,
  SHOP_BASE_DEPTH,
  SHOP_X_SCALE,
  SHOP_Z_SCALE,
  WALL_HEIGHT,
  WAITING_CHAIRS,
} from '../data/layout';
import {
  addBox,
  addCylinder,
  addLabel,
  addSphere,
  createLabelSprite,
  createPalette,
  makePlant,
  MaterialPalette,
} from './primitives';

export interface ShopWorld {
  root: THREE.Group;
  overlay: THREE.Group;
  upperShell: THREE.Group;
  roomLabels: THREE.Group;
  colliders: Collider[];
  doors: Door[];
  interactables: Interactable[];
  horizontalScale: number;
  depthScale: number;
  cctvLeds: THREE.MeshStandardMaterial[];
  alarmMaterials: THREE.MeshStandardMaterial[];
  alarmUntil: number;
  getColliders: () => Collider[];
  update: (delta: number, elapsed: number) => void;
  triggerAlarm: () => void;
  triggerBrew: () => void;
  triggerWash: () => void;
  setPickupReady: (ready: boolean) => void;
  setRoofVisible: (visible: boolean) => void;
  isRoofVisible: () => boolean;
}

interface DeviceOptions {
  id: string;
  name: string;
  location: string;
  purpose: string;
  position: THREE.Vector3;
  model: THREE.Object3D;
  labelPosition?: THREE.Vector3;
}

const DOOR_LAYOUT = {
  storage: { x: -3.75, width: 1 },
  staff: { x: -1.25, width: 1.1 },
  restroom: { x: 1.9, width: 1.1 },
  emergency: { x: 4.15, width: 1.2 },
} as const;
const RESTROOM_LEFT_WALL_X = 0.45;
const RESTROOM_RIGHT_WALL_X = 2.65;

export function createCoffeeShop(scene: THREE.Scene): ShopWorld {
  const palette = createPalette();
  const root = new THREE.Group();
  root.name = 'BrewGuardCoffeeShop';
  root.scale.set(SHOP_X_SCALE, 1, SHOP_Z_SCALE);
  scene.add(root);

  const colliders: Collider[] = [];
  const doors: Door[] = [];
  const interactables: Interactable[] = [];
  const overlay = new THREE.Group();
  overlay.name = 'SecurityOverlay';
  overlay.visible = false;
  root.add(overlay);

  const upperShell = new THREE.Group();
  upperShell.name = 'RoofAndUpperShell';
  root.add(upperShell);

  const roomLabels = new THREE.Group();
  roomLabels.name = 'RoomLabels';
  roomLabels.visible = true;
  root.add(roomLabels);

  const cctvLeds: THREE.MeshStandardMaterial[] = [];
  const alarmMaterials: THREE.MeshStandardMaterial[] = [];
  let roofVisible = true;
  let alarmUntil = 0;

  buildGround(root, palette);
  buildShell(root, upperShell, colliders, palette);
  buildInterior(root, colliders, interactables, palette);
  buildRoomLabels(roomLabels, palette);

  const mainDoor = createEntranceDoor(root, palette);
  doors.push(mainDoor);
  interactables.push(mainDoor);

  const storageDoor = createHingedDoor(
    root,
    palette,
    {
      id: 'storage-door',
      name: 'Storage Access Door',
      location: 'Back-left storage room threshold',
      purpose: 'Keeps supplies organized while allowing staff to move between the preparation and storage areas.',
      position: new THREE.Vector3(DOOR_LAYOUT.storage.x, 1.65, 1.35),
      width: DOOR_LAYOUT.storage.width,
      depth: 0.08,
      openByDefault: false,
      swingSign: 1,
    },
  );
  doors.push(storageDoor);
  interactables.push(storageDoor);

  const staffDoor = createHingedDoor(
    root,
    palette,
    {
      id: 'staff-door',
      name: 'Staff-Only RFID Door',
      location: 'Front edge of the staff-only room',
      purpose: 'Restricts access to staff records, lockers, and back-of-house supplies through a visual RFID access point.',
      position: new THREE.Vector3(DOOR_LAYOUT.staff.x, 1.65, 1.35),
      width: DOOR_LAYOUT.staff.width,
      depth: 0.08,
      openByDefault: false,
      swingSign: -1,
      restricted: true,
    },
  );
  doors.push(staffDoor);
  interactables.push(staffDoor);

  const restroomDoor = createHingedDoor(
    root,
    palette,
    {
      id: 'restroom-door',
      name: 'Restroom Door',
      location: 'Back-right restroom entry, separated from the cashier',
      purpose: 'Provides a visual privacy boundary for the restroom while maintaining a clear public route.',
      position: new THREE.Vector3(DOOR_LAYOUT.restroom.x, 1.65, 1.35),
      width: DOOR_LAYOUT.restroom.width,
      depth: 0.08,
      openByDefault: false,
      swingSign: -1,
    },
  );
  doors.push(restroomDoor);
  interactables.push(restroomDoor);

  const cashierGateX = 0.92;
  const cashierGateFrontZ = 0.27;
  const cashierGateBackZ = 1.28;
  const cashierGateWidth = cashierGateBackZ - cashierGateFrontZ;
  const cashierGate = createHingedDoor(root, palette, {
    id: 'cashier-staff-gate',
    name: 'POS / Prep Staff Gate',
    location: 'Staff-only entrance behind the cashier counter',
    purpose: 'Keeps visitors out of the cashier and preparation work area while allowing authorized staff to pass through the RFID gate.',
    position: new THREE.Vector3(cashierGateX, 0.58, (cashierGateFrontZ + cashierGateBackZ) / 2),
    width: cashierGateWidth,
    depth: 0.12,
    height: 0.92,
    openByDefault: false,
    swingSign: 1,
    openAngle: Math.PI * 0.39,
    restricted: true,
    sideWall: true,
    reverseHinge: true,
  });
  doors.push(cashierGate);
  interactables.push(cashierGate);
  addBox(root, [0.14, 1.02, 0.14], [cashierGateX, 0.51, cashierGateFrontZ], palette.woodDark, {
    name: 'CashierGateLatchPost',
  });
  addBox(root, [0.14, 1.02, 0.14], [cashierGateX, 0.51, cashierGateBackZ], palette.woodDark, {
    name: 'CashierGateHingePost',
  });

  const emergencyDoor = createHingedDoor(
    root,
    palette,
    {
      id: 'emergency-door',
      name: 'Emergency Exit Door',
      location: 'Back-right wall',
      purpose: 'Provides a clearly marked secondary egress route for evacuation and emergency response.',
      position: new THREE.Vector3(DOOR_LAYOUT.emergency.x, 1.65, 2.9),
      width: DOOR_LAYOUT.emergency.width,
      depth: 0.08,
      openByDefault: false,
      swingSign: -1,
      backWall: true,
    },
  );
  doors.push(emergencyDoor);
  interactables.push(emergencyDoor);

  const security = buildSecurityDevices(root, overlay, palette, cctvLeds, alarmMaterials);
  interactables.push(...security.interactables);

  const cafeActions = createCafeActions(root, overlay, palette);
  interactables.push(...cafeActions.interactables);

  const staffHighlight = new THREE.Mesh(
    new THREE.BoxGeometry(2.25, 0.025, 1.22),
    new THREE.MeshBasicMaterial({
      color: 0x36b8df,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  staffHighlight.position.set(-1.25, 0.08, 2.1);
  overlay.add(staffHighlight);
  addLabel(overlay, 'RESTRICTED\nRFID ACCESS', [-1.25, 2.92, 2.1], {
    color: '#b7f2ff',
    background: 'rgba(13, 67, 91, 0.9)',
    border: '#4de0ff',
    fontSize: 28,
    width: 1.42,
  });
  addLabel(overlay, 'EMERGENCY EXIT', [4.15, 2.95, 2.57], {
    color: '#ffe8e4',
    background: 'rgba(111, 24, 27, 0.94)',
    border: '#ff7065',
    fontSize: 28,
    width: 1.3,
  });

  const alarmBeacon = security.alarmBeacon;

  const scaleCollider = (collider: Collider): Collider => ({
    ...collider,
    minX: collider.minX * SHOP_X_SCALE,
    maxX: collider.maxX * SHOP_X_SCALE,
    minZ: collider.minZ * SHOP_Z_SCALE,
    maxZ: collider.maxZ * SHOP_Z_SCALE,
  });
  interactables.forEach((item) => {
    item.position.x *= SHOP_X_SCALE;
    item.position.z *= SHOP_Z_SCALE;
    if (item.kind === 'seat') {
      const seat = item as Seat;
      seat.tablePosition.x *= SHOP_X_SCALE;
      seat.tablePosition.z *= SHOP_Z_SCALE;
    }
  });

  return {
    root,
    overlay,
    upperShell,
    roomLabels,
    colliders: colliders.map(scaleCollider),
    doors,
    interactables,
    horizontalScale: SHOP_X_SCALE,
    depthScale: SHOP_Z_SCALE,
    cctvLeds,
    alarmMaterials,
    get alarmUntil() {
      return alarmUntil;
    },
    set alarmUntil(value: number) {
      alarmUntil = value;
    },
    getColliders: () => {
      const dynamic = colliders.map(scaleCollider);
      doors.forEach((door) => {
        if (door.isBlocking()) {
          dynamic.push(scaleCollider(door.userData.collider));
        }
      });
      return dynamic;
    },
    update: (delta: number, elapsed: number) => {
      doors.forEach((door) => door.update(delta));
      cctvLeds.forEach((material, index) => {
        material.emissiveIntensity = 1.45 + Math.sin(elapsed * 2.1 + index) * 0.22;
      });
      const active = performance.now() < alarmUntil;
      const pulse = active ? 2.5 + Math.sin(elapsed * 13) * 1.6 : 0.55;
      alarmMaterials.forEach((material) => {
        material.emissiveIntensity = pulse;
      });
      if (alarmBeacon) alarmBeacon.visible = true;
      cafeActions.update(delta, elapsed);
    },
    triggerAlarm: () => {
      alarmUntil = performance.now() + 2800;
    },
    triggerBrew: cafeActions.triggerBrew,
    triggerWash: cafeActions.triggerWash,
    setPickupReady: cafeActions.setPickupReady,
    setRoofVisible: (visible: boolean) => {
      roofVisible = visible;
      upperShell.visible = visible;
    },
    isRoofVisible: () => roofVisible,
  };
}

function buildGround(root: THREE.Group, palette: MaterialPalette): void {
  addBox(root, [15, 0.28, 12], [0, -0.42, 0], palette.woodDark, { castShadow: false });
  addBox(root, [11.3, 0.2, 7.3], [0, -0.24, 0], palette.wallTrim, { castShadow: false });
  addBox(root, [10, 0.12, 6], [0, -0.06, 0], palette.floor, { castShadow: false });

  for (let index = -4; index <= 4; index += 1) {
    const plank = addBox(root, [0.018, 0.012, 5.82], [index + 0.35, 0.008, 0], palette.floorAlt, {
      castShadow: false,
      receiveShadow: false,
    });
    plank.material = palette.floorAlt;
  }
  const mat = addBox(root, [1.65, 0.025, 0.7], [0, 0.025, -3.58], palette.black, {
    castShadow: false,
  });
  mat.name = 'EntranceMat';
  addBox(root, [13, 0.12, 1.9], [0, -0.08, -4.13], palette.tile, { castShadow: false, name: 'StorefrontPaving' });
  addBox(root, [3.2, 0.035, 0.8], [0, 0.025, -4.08], palette.tile, { castShadow: false });
  addBox(root, [0.12, 0.03, 0.92], [-1.6, 0.04, -4.08], palette.wallTrim, { castShadow: false });
  addBox(root, [0.12, 0.03, 0.92], [1.6, 0.04, -4.08], palette.wallTrim, { castShadow: false });
}

function createCafeActions(
  root: THREE.Group,
  overlay: THREE.Group,
  palette: MaterialPalette,
): { interactables: Interactable[]; triggerBrew: () => void; triggerWash: () => void; setPickupReady: (ready: boolean) => void; update: (delta: number, elapsed: number) => void } {
  const steamMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f3e9,
    transparent: true,
    opacity: 0.45,
    roughness: 1,
    depthWrite: false,
  });
  const steam = new THREE.Group();
  steam.position.set(-3.95, 1.55, 0.3);
  steam.visible = false;
  root.add(steam);
  const steamPuffs = [
    addSphere(steam, 0.075, [-0.1, 0.02, 0], steamMaterial, 10, 8),
    addSphere(steam, 0.09, [0.06, 0.16, 0], steamMaterial, 10, 8),
    addSphere(steam, 0.065, [0.16, 0.28, 0], steamMaterial, 10, 8),
  ];
  steamPuffs.forEach((puff) => {
    puff.castShadow = false;
    puff.receiveShadow = false;
  });

  const espresso: Interactable = {
    id: 'espresso-machine',
    kind: 'device',
    position: { x: -3.95, y: 1.25, z: 0.3 },
    range: 2.35,
    info: {
      name: 'Espresso Station',
      location: 'Coffee bar / preparation counter',
      purpose: 'Use the machine to start a short coffee preparation demonstration. The steam effect is visual only.',
    },
  };
  const register: Interactable = {
    id: 'cashier-order',
    kind: 'device',
    position: { x: -0.27, y: 1.22, z: -0.16 },
    range: 2.15,
    info: {
      name: 'POS / Demo Order',
      location: 'Cashier counter',
      purpose: 'Place a presentation-only sample order for a coffee and pastry at the point of sale.',
    },
  };
  addBox(root, [0.72, 0.56, 0.07], [-2.75, 2.08, 1.24], palette.woodDark, { name: 'CafeMenuBoard' });
  addLabel(root, 'MENU', [-2.75, 2.09, 1.17], {
    color: '#f6e6c9', background: 'rgba(32, 25, 20, 0.9)', border: '#d6ad70', fontSize: 20, width: 0.5,
  });
  const menu: Interactable = {
    id: 'menu-board', kind: 'device', position: { x: -2.75, y: 2.08, z: 1.16 }, range: 3.4,
    info: {
      name: 'Coffee shop menu', location: 'Behind the preparation counter',
      purpose: 'Espresso, cappuccino, latte, and fresh pastries. Choose a demo order at the cashier, watch it brew, then collect it at pickup.',
    },
  };
  addBox(root, [0.26, 0.025, 0.2], [0.55, 1.01, -0.49], palette.cyan, { name: 'OrderPickupPad' });
  const pickupCup = new THREE.Group();
  pickupCup.position.set(0.55, 1.1, -0.49);
  pickupCup.visible = false;
  root.add(pickupCup);
  addCylinder(pickupCup, 0.075, 0.16, [0, 0, 0], palette.white, 12);
  addBox(pickupCup, [0.045, 0.075, 0.045], [0.09, 0.01, 0], palette.white);
  const pickup: Interactable = {
    id: 'order-pickup', kind: 'device', position: { x: 0.55, y: 1.08, z: -0.49 }, range: 1.55,
    info: { name: 'Order pickup', location: 'Customer side of the cashier counter', purpose: 'Collect your coffee after placing an order and watching it brew.' },
  };
  const sink: Interactable = {
    id: 'restroom-sink', kind: 'device', position: { x: 2.28, y: 0.92, z: 1.82 }, range: 1.45,
    info: { name: 'Wash hands', location: 'Restroom sink', purpose: 'Use the restroom sink as part of the café walkthrough.' },
  };
  const runningWater = addCylinder(root, 0.012, 0.18, [2.28, 0.99, 1.82], palette.cyan, 8);
  runningWater.visible = false;
  addLabel(overlay, 'ESPRESSO STATION', [-3.95, 2.0, 0.3], {
    color: '#f7e4c3',
    background: 'rgba(55, 32, 20, 0.92)',
    border: '#d6ad70',
    fontSize: 22,
    width: 1.2,
  });
  addLabel(overlay, 'PLACE DEMO ORDER', [-0.27, 1.8, -0.16], {
    color: '#f7e4c3',
    background: 'rgba(55, 32, 20, 0.92)',
    border: '#d6ad70',
    fontSize: 22,
    width: 1.34,
  });

  let brewUntil = 0;
  let washUntil = 0;
  const triggerBrew = (): void => {
    brewUntil = performance.now() + 4200;
    steam.visible = true;
  };

  return {
    interactables: [espresso, register, menu, pickup, sink],
    triggerBrew,
    triggerWash: () => { washUntil = performance.now() + 2400; runningWater.visible = true; },
    setPickupReady: (ready) => { pickupCup.visible = ready; },
    update: (_delta, elapsed) => {
      runningWater.visible = performance.now() < washUntil;
      const brewing = performance.now() < brewUntil;
      steam.visible = brewing;
      if (brewing) {
        steamPuffs.forEach((puff, index) => {
          puff.position.y = 0.03 + ((elapsed * 0.42 + index * 0.32) % 0.62);
          puff.position.x = Math.sin(elapsed * 2.1 + index * 1.7) * 0.11;
          (puff.material as THREE.MeshStandardMaterial).opacity = 0.5 - index * 0.1;
        });
      }
    },
  };
}

function buildShell(
  root: THREE.Group,
  upperShell: THREE.Group,
  colliders: Collider[],
  palette: MaterialPalette,
): void {
  createWall(root, colliders, [0.2, WALL_HEIGHT, SHOP_BASE_DEPTH], [4.9, 1.5, 0], palette.wall, 'Right exterior wall');
  createWall(root, colliders, [0.2, WALL_HEIGHT, SHOP_BASE_DEPTH], [-4.9, 1.5, 0], palette.wall, 'Left exterior wall');
  buildFrontFacade(root, colliders, palette);
  const emergencyOpeningStart = DOOR_LAYOUT.emergency.x - DOOR_LAYOUT.emergency.width / 2;
  const emergencyOpeningEnd = DOOR_LAYOUT.emergency.x + DOOR_LAYOUT.emergency.width / 2;
  const backWallLeftEnd = emergencyOpeningStart;
  const backWallRightStart = emergencyOpeningEnd;
  const backWallLeftWidth = backWallLeftEnd + 5;
  const backWallRightWidth = 5 - backWallRightStart;
  createWall(
    root,
    colliders,
    [backWallLeftWidth, WALL_HEIGHT, 0.2],
    [(-5 + backWallLeftEnd) / 2, 1.5, 2.9],
    palette.wall,
    'Back left wall',
  );
  createWall(
    root,
    colliders,
    [backWallRightWidth, WALL_HEIGHT, 0.2],
    [(backWallRightStart + 5) / 2, 1.5, 2.9],
    palette.wall,
    'Back right wall',
  );
  addBox(
    root,
    [DOOR_LAYOUT.emergency.width + 0.14, WALL_HEIGHT - 2.32, 0.22],
    [DOOR_LAYOUT.emergency.x, 2.66, 2.9],
    palette.wall,
    {
      name: 'EmergencyExitLintel',
    },
  );

  addBox(root, [10.05, 0.12, 0.35], [0, 2.88, -2.82], palette.wallTrim, { name: 'FrontBeam' });
  addBox(root, [10.05, 0.12, 0.35], [0, 2.88, 2.82], palette.wallTrim, { name: 'BackBeam' });
  addBox(root, [0.35, 0.12, 5.7], [-4.72, 2.88, 0], palette.wallTrim);
  addBox(root, [0.35, 0.12, 5.7], [4.72, 2.88, 0], palette.wallTrim);

  addBox(upperShell, [10.35, 0.16, 6.35], [0, 3.08, 0], palette.wallTrim, {
    castShadow: false,
    name: 'RoofSlab',
  });
  addBox(upperShell, [10.1, 0.08, 6.1], [0, 3.18, 0], palette.woodDark, {
    castShadow: false,
    name: 'RoofInset',
  });

  const sign = addBox(root, [0.95, 0.68, 0.14], [4.525, 2.45, -3.04], palette.woodDark);
  sign.name = 'FrontShopSign';
  addLabel(root, 'BREWGUARD\nCOFFEE SHOP', [4.525, 2.48, -3.13], {
    color: '#f5ead5',
    background: 'rgba(34, 22, 17, 0.9)',
    border: '#c79c62',
    fontSize: 18,
    width: 1.02,
  });
}

function buildFrontFacade(root: THREE.Group, colliders: Collider[], palette: MaterialPalette): void {
  const bays = [
    { center: -3.15, width: 3.0, leftPier: -4.825, rightPier: -1.475, rightPierWidth: 0.35 },
    { center: 2.85, width: 2.4, leftPier: 1.475, rightPier: 4.525, rightPierWidth: 0.95 },
  ];
  bays.forEach((bay, index) => {
    const leftPierWidth = 0.35;
    createWall(
      root,
      colliders,
      [leftPierWidth, WALL_HEIGHT, 0.2],
      [bay.leftPier, 1.5, -2.9],
      palette.wall,
      `Front window ${index + 1} left pier`,
    );
    createWall(
      root,
      colliders,
      [bay.rightPierWidth, WALL_HEIGHT, 0.2],
      [bay.rightPier, 1.5, -2.9],
      palette.wall,
      `Front window ${index + 1} right pier`,
    );
    addBox(root, [bay.width, 2.9, 0.045], [bay.center, 1.5, -3.015], palette.glass, {
      castShadow: false,
      name: `FrontGlassWindow${index + 1}`,
    });
    addBox(root, [bay.width, 0.11, 0.12], [bay.center, 0.055, -2.93], palette.wallTrim, {
      name: `FrontWindowSill${index + 1}`,
    });
    addBox(root, [bay.width, 0.1, 0.12], [bay.center, 2.945, -2.93], palette.wallTrim, {
      name: `FrontWindowHeader${index + 1}`,
    });
    colliders.push({
      minX: bay.center - bay.width / 2,
      maxX: bay.center + bay.width / 2,
      minZ: -3.07,
      maxZ: -2.96,
      label: 'Front storefront glass',
    });
  });

  const entranceBayHalfWidth = 1.65;
  const entranceDoorOuterEdge = 1.02;
  const sidelightWidth = entranceBayHalfWidth - entranceDoorOuterEdge;
  const entryGlassZ = -3.015;
  [-1, 1].forEach((side) => {
    const centerX = side * (entranceDoorOuterEdge + sidelightWidth / 2);
    addBox(root, [sidelightWidth, 2.35, 0.045], [centerX, 1.175, entryGlassZ], palette.glass, {
      castShadow: false,
      name: side < 0 ? 'LeftEntranceSidelight' : 'RightEntranceSidelight',
    });
    colliders.push({
      minX: centerX - sidelightWidth / 2,
      maxX: centerX + sidelightWidth / 2,
      minZ: entryGlassZ - 0.03,
      maxZ: entryGlassZ + 0.03,
      label: 'Entrance sidelight glass',
    });
  });
  addBox(root, [entranceBayHalfWidth * 2, 0.65, 0.045], [0, 2.675, entryGlassZ], palette.glass, {
    castShadow: false,
    name: 'EntranceGlassTransom',
  });
}

function buildInterior(root: THREE.Group, colliders: Collider[], interactables: Interactable[], palette: MaterialPalette): void {
  const partitionZ = 1.35;
  const toSegment = (start: number, end: number): [number, number] => [(start + end) / 2, end - start];
  const storageStart = DOOR_LAYOUT.storage.x - DOOR_LAYOUT.storage.width / 2;
  const storageEnd = DOOR_LAYOUT.storage.x + DOOR_LAYOUT.storage.width / 2;
  const staffStart = DOOR_LAYOUT.staff.x - DOOR_LAYOUT.staff.width / 2;
  const staffEnd = DOOR_LAYOUT.staff.x + DOOR_LAYOUT.staff.width / 2;
  const restroomStart = DOOR_LAYOUT.restroom.x - DOOR_LAYOUT.restroom.width / 2;
  const restroomEnd = DOOR_LAYOUT.restroom.x + DOOR_LAYOUT.restroom.width / 2;
  const partitionSegments: Array<[number, number]> = [
    toSegment(-4.9, storageStart),
    toSegment(storageEnd, -2.5),
    toSegment(-2.5, staffStart),
    toSegment(staffEnd, RESTROOM_LEFT_WALL_X),
    toSegment(RESTROOM_LEFT_WALL_X, restroomStart),
    toSegment(restroomEnd, RESTROOM_RIGHT_WALL_X),
    toSegment(RESTROOM_RIGHT_WALL_X, 3.5),
    toSegment(4.6, 4.9),
  ];
  partitionSegments.forEach(([center, width]) => {
    createWall(root, colliders, [width, WALL_HEIGHT, 0.14], [center, 1.5, partitionZ], palette.wall, 'Back room partition');
  });
  createWall(root, colliders, [0.14, WALL_HEIGHT, 1.55], [-2.5, 1.5, 2.12], palette.wall, 'Storage staff partition');
  createWall(
    root,
    colliders,
    [0.14, WALL_HEIGHT, 1.55],
    [RESTROOM_LEFT_WALL_X, 1.5, 2.12],
    palette.wall,
    'Staff restroom partition',
  );
  createWall(
    root,
    colliders,
    [0.14, WALL_HEIGHT, 1.55],
    [RESTROOM_RIGHT_WALL_X, 1.5, 2.12],
    palette.wall,
    'Restroom exit partition',
  );

  createCoffeeBar(root, colliders, palette);
  createCashier(root, colliders, palette);
  createDining(root, colliders, interactables, palette);
  createStorage(root, colliders, palette);
  createStaffRoom(root, colliders, palette);
  createRestroom(root, colliders, palette);
  createExteriorPlanting(root, palette);
}

function createWall(
  parent: THREE.Group,
  colliders: Collider[],
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  label: string,
): void {
  addBox(parent, size, position, material, { name: label });
  colliders.push({
    minX: position[0] - size[0] / 2,
    maxX: position[0] + size[0] / 2,
    minZ: position[2] - size[2] / 2,
    maxZ: position[2] + size[2] / 2,
    label,
  });
}

function createCoffeeBar(root: THREE.Group, colliders: Collider[], palette: MaterialPalette): void {
  addBox(root, [4.15, 0.82, 0.78], [-2.8, 0.46, 0.28], palette.wood, { name: 'CoffeeBarFront' });
  addBox(root, [4.28, 0.12, 0.9], [-2.8, 0.92, 0.28], palette.counter, { name: 'CoffeeBarCountertop' });
  addBox(root, [4.0, 0.08, 0.08], [-2.8, 0.87, -0.18], palette.brass);
  colliders.push({ minX: -4.95, maxX: -0.7, minZ: -0.18, maxZ: 0.75, label: 'Coffee bar counter' });

  addBox(root, [0.68, 0.5, 0.46], [-3.95, 1.22, 0.3], palette.metal, { name: 'EspressoMachine' });
  addBox(root, [0.78, 0.05, 0.5], [-3.95, 1.5, 0.3], palette.black);
  for (let index = 0; index < 3; index += 1) {
    addCylinder(root, 0.07, 0.06, [-4.18 + index * 0.22, 1.54, 0.3], palette.white, 12);
  }
  addBox(root, [0.55, 0.34, 0.44], [-2.85, 1.14, 0.3], palette.metal);
  addBox(root, [0.48, 0.03, 0.36], [-2.85, 1.33, 0.3], palette.black);
  addBox(root, [0.6, 0.44, 0.46], [-1.85, 1.14, 0.3], palette.metal);
  addCylinder(root, 0.17, 0.12, [-1.25, 1.03, 0.28], palette.white, 16);
  addBox(root, [0.42, 0.3, 0.32], [-4.45, 0.68, 0.3], palette.metal);
  addLabel(root, 'STAFF PREP', [-2.8, 1.64, 0.35], {
    color: '#f6e6c9',
    background: 'rgba(32, 25, 20, 0.84)',
    border: '#d6ad70',
    fontSize: 22,
    width: 1.1,
  });
}

function createCashier(root: THREE.Group, colliders: Collider[], palette: MaterialPalette): void {
  addBox(root, [1.75, 0.82, 0.8], [-0.02, 0.46, -0.18], palette.woodDark, { name: 'CashierCounter' });
  addBox(root, [1.88, 0.12, 0.9], [-0.02, 0.92, -0.18], palette.counter, { name: 'CashierCountertop' });
  colliders.push({ minX: -0.92, maxX: 0.88, minZ: -0.64, maxZ: 0.3, label: 'Cashier counter' });

  addBox(root, [0.34, 0.27, 0.12], [-0.27, 1.22, -0.16], palette.black, { name: 'POSMonitor' });
  addBox(root, [0.04, 0.18, 0.04], [-0.27, 1.08, -0.16], palette.black);
  addBox(root, [0.21, 0.03, 0.15], [0.25, 1.04, -0.29], palette.metal);
  addBox(root, [0.42, 0.35, 0.38], [0.57, 1.1, -0.18], palette.white, { name: 'PastryDisplay' });
  addCylinder(root, 0.07, 0.06, [0.47, 1.31, -0.18], palette.brass, 12);
  addCylinder(root, 0.07, 0.06, [0.68, 1.31, -0.18], palette.brass, 12);
  addBox(root, [1.55, 0.018, 0.9], [0, 0.012, -1.4], palette.tile, {
    castShadow: false,
    name: 'CustomerOrderQueue',
  });
  addLabel(root, 'CUSTOMER ORDER / PICKUP', [0, 1.42, -0.72], {
    color: '#f6e6c9',
    background: 'rgba(32, 25, 20, 0.88)',
    border: '#d6ad70',
    fontSize: 20,
    width: 1.42,
  });
  addLabel(root, 'POS', [-0.02, 1.55, -0.18], {
    color: '#f6e6c9',
    background: 'rgba(32, 25, 20, 0.84)',
    border: '#d6ad70',
    fontSize: 22,
    width: 0.56,
  });
}

function createDining(root: THREE.Group, colliders: Collider[], interactables: Interactable[], palette: MaterialPalette): void {
  DINING_TABLES.forEach(({ x, z }, index) => {
    addBox(root, [DINING_TABLE_SIZE.width, 0.08, DINING_TABLE_SIZE.depth], [x, 0.92, z], palette.wood, {
      name: `DiningTable${index + 1}`,
    });
    addCylinder(root, 0.06, 0.84, [x, 0.5, z], palette.woodDark, 12);
    // The pot base sits slightly inside the tabletop to avoid a visible gap.
    makePlant(root, [x, 0.95, z], palette, 0.45);
    colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45, label: 'Dining table' });
    const chairs: ChairPlacement[] = [
      { x, z: z - DINING_CHAIR_OFFSET, backX: 0, backZ: -1 },
      { x, z: z + DINING_CHAIR_OFFSET, backX: 0, backZ: 1 },
    ];
    chairs.forEach((placement, seatIndex) => {
      createChair(root, colliders, placement, palette, 'Dining chair');
      interactables.push({
        id: `seat-${index + 1}-${seatIndex + 1}`,
        kind: 'seat',
        position: { x: placement.x, y: 0.9, z: placement.z },
        range: 1.4,
        tablePosition: { x, z },
        info: { name: `Table ${index + 1} seat`, location: 'Customer dining area', purpose: 'Sit and look around the coffee shop.' },
      } as Seat);
    });
  });

  WAITING_CHAIRS.forEach((placement) => createChair(root, colliders, placement, palette, 'Waiting chair'));
}

function createChair(
  root: THREE.Group,
  colliders: Collider[],
  placement: ChairPlacement,
  palette: MaterialPalette,
  label: string,
): void {
  const { x, z, backX, backZ } = placement;
  const rotation = Math.atan2(backX, backZ);
  const chair = addBox(root, [CHAIR_SEAT_SIZE, 0.38, CHAIR_SEAT_SIZE], [x, 0.28, z], palette.woodDark, {
    name: label === 'Waiting chair' ? 'WaitingChair' : 'DiningChair',
  });
  chair.rotation.y = rotation;
  addBox(
    root,
    [0.34, 0.42, 0.08],
    [x + backX * 0.14, 0.58, z + backZ * 0.14],
    palette.woodDark,
    { name: label === 'Waiting chair' ? 'WaitingChairBack' : 'DiningChairBack' },
  ).rotation.y = rotation;
  colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2, label });
}

function createStorage(root: THREE.Group, colliders: Collider[], palette: MaterialPalette): void {
  for (let row = 0; row < 2; row += 1) {
    addBox(root, [0.14, 1.45, 0.95], [-4.52, 0.78 + row * 0.02, 2.17], palette.metal, { name: 'StorageShelf' });
    for (let level = 0; level < 3; level += 1) {
      addBox(root, [0.75, 0.08, 0.82], [-4.08 + row * 0.6, 0.35 + level * 0.5, 2.17], palette.wood);
      addBox(root, [0.28, 0.25, 0.28], [-4.28 + row * 0.6, 0.53 + level * 0.5, 2.17], palette.brass);
      addBox(root, [0.22, 0.2, 0.2], [-3.93 + row * 0.6, 0.54 + level * 0.5, 2.17], palette.white);
    }
  }
  colliders.push({ minX: -4.7, maxX: -3.45, minZ: 1.7, maxZ: 2.72, label: 'Storage shelves' });
  addLabel(root, 'SUPPLIES', [-4.2, 2.57, 2.78], {
    color: '#f6e6c9',
    background: 'rgba(32, 25, 20, 0.84)',
    border: '#d6ad70',
    fontSize: 21,
    width: 0.8,
  });
}

function createStaffRoom(root: THREE.Group, colliders: Collider[], palette: MaterialPalette): void {
  addBox(root, [1.35, 0.08, 0.5], [-1.55, 0.82, 2.25], palette.wood, { name: 'StaffDesk' });
  addBox(root, [0.06, 0.75, 0.06], [-2.1, 0.42, 2.08], palette.woodDark);
  addBox(root, [0.06, 0.75, 0.06], [-1.0, 0.42, 2.08], palette.woodDark);
  addBox(root, [0.35, 0.42, 0.36], [-1.55, 0.23, 2.75], palette.woodDark);
  addBox(root, [0.38, 0.8, 0.34], [-0.62, 0.52, 2.08], palette.metal, { name: 'StaffLocker' });
  addBox(root, [0.05, 0.05, 0.05], [-0.62, 0.8, 1.9], palette.brass);
  addBox(root, [0.05, 0.05, 0.05], [-0.62, 0.5, 1.9], palette.brass);
  colliders.push({ minX: -2.2, maxX: -0.42, minZ: 1.85, maxZ: 2.7, label: 'Staff room furniture' });
}

function createRestroom(root: THREE.Group, colliders: Collider[], palette: MaterialPalette): void {
  addBox(root, [0.46, 0.42, 0.55], [2.15, 0.27, 2.42], palette.white, { name: 'RestroomToilet' });
  addCylinder(root, 0.2, 0.05, [2.15, 0.5, 2.42], palette.white, 16);
  addBox(root, [0.4, 0.08, 0.32], [2.28, 0.84, 1.82], palette.tile, { name: 'RestroomSink' });
  addCylinder(root, 0.035, 0.22, [2.28, 0.96, 1.82], palette.metal, 10);
  addSphere(root, 0.06, [2.28, 1.08, 1.82], palette.metal, 12, 8);
  colliders.push({ minX: 1.89, maxX: 2.41, minZ: 2.12, maxZ: 2.72, label: 'Restroom toilet' });
  colliders.push({ minX: 2.04, maxX: 2.52, minZ: 1.63, maxZ: 2.0, label: 'Restroom sink' });
}

function createExteriorPlanting(root: THREE.Group, palette: MaterialPalette): void {
  // The planter tops support the pots at their original storefront positions.
  addBox(root, [3.4, 0.34, 0.64], [-3.15, 0.14, -3.54], palette.woodDark, { name: 'LeftFrontPlanter' });
  addBox(root, [3.05, 0.34, 0.64], [3.025, 0.14, -3.54], palette.woodDark, { name: 'RightFrontPlanter' });
  for (let index = 0; index < 9; index += 1) {
    const x = -4.55 + index * 0.35;
    const shrub = addSphere(root, 0.2, [x, 0.37, -3.62], palette.green, 12, 8);
    shrub.scale.set(1.25, 0.85, 0.8);
    shrub.castShadow = true;
    const rightShrub = addSphere(root, 0.2, [1.95 + index * 0.22, 0.37, -3.62], palette.green, 12, 8);
    rightShrub.scale.set(1.2, 0.8, 0.8);
  }

  // Each pot base overlaps the planter top (0.31) by 0.005 to avoid a gap.
  const planterPlantBase = 0.305;
  makePlant(root, [-4.35, planterPlantBase, -3.44], palette, 1.25);
  makePlant(root, [4.35, planterPlantBase, -3.44], palette, 1.25);
  makePlant(root, [-2.3, planterPlantBase, -3.42], palette, 0.85);
  makePlant(root, [2.3, planterPlantBase, -3.42], palette, 0.85);
  addBox(root, [0.16, 0.55, 0.12], [-1.45, 2.2, -3.22], palette.black);
  addBox(root, [0.16, 0.55, 0.12], [1.45, 2.2, -3.22], palette.black);
  const lampLens = new THREE.MeshStandardMaterial({
    color: 0xffd18a,
    emissive: 0xffab4c,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  addBox(root, [0.21, 0.25, 0.08], [-1.45, 2.35, -3.3], lampLens);
  addBox(root, [0.21, 0.25, 0.08], [1.45, 2.35, -3.3], lampLens);
}

function buildRoomLabels(group: THREE.Group, palette: MaterialPalette): void {
  ROOM_LABELS.forEach((room) => {
    const label = createLabelSprite(room.label, {
      color: '#ead9bb',
      background: 'rgba(28, 22, 19, 0.62)',
      border: 'rgba(215, 176, 112, 0.55)',
      fontSize: 19,
      width: room.label.length > 18 ? 1.65 : 1.18,
      opacity: 0.82,
    });
    label.position.set(room.x, 0.12, room.z);
    label.rotation.z = room.rotation;
    group.add(label);
  });
}

function createEntranceDoor(root: THREE.Group, palette: MaterialPalette): Door {
  const container = new THREE.Group();
  container.name = 'MainEntranceDoubleDoor';
  container.position.set(0, 0, -3.015);
  root.add(container);

  const leftHinge = new THREE.Group();
  leftHinge.position.set(-1.02, 0, 0);
  const leftPanel = addBox(leftHinge, [1.02, 2.35, 0.06], [0.51, 1.18, 0], palette.glass, {
    name: 'LeftGlassDoor',
    castShadow: false,
  });
  addBox(leftHinge, [0.05, 1.95, 0.08], [0.86, 1.18, -0.02], palette.brass);
  leftHinge.add(leftPanel);
  container.add(leftHinge);

  const rightHinge = new THREE.Group();
  rightHinge.position.set(1.02, 0, 0);
  const rightPanel = addBox(rightHinge, [1.02, 2.35, 0.06], [-0.51, 1.18, 0], palette.glass, {
    name: 'RightGlassDoor',
    castShadow: false,
  });
  addBox(rightHinge, [0.05, 1.95, 0.08], [-0.86, 1.18, -0.02], palette.brass);
  rightHinge.add(rightPanel);
  container.add(rightHinge);

  const collider: Collider = { minX: -1.06, maxX: 1.06, minZ: -3.12, maxZ: -2.78, label: 'Closed main door' };
  const info: InspectionInfo = {
    name: 'Main Entrance Door',
    location: 'Front-center entrance',
    purpose: 'Controls the public entry point and visually demonstrates a door-contact sensor and security lighting coverage.',
  };
  let progress = 0;
  let target = 0;
  const door: Door = {
    id: 'main-door',
    kind: 'door',
    position: { x: 0, y: 1.65, z: -2.98 },
    range: 2.25,
    info,
    userData: { collider, promptOpen: 'Close main entrance', promptClosed: 'Open main entrance' },
    open: false,
    progress,
    target,
    toggle: () => {
      target = target > 0.5 ? 0 : 1;
      door.open = target > 0.5;
    },
    setOpen: (open: boolean) => {
      target = open ? 1 : 0;
      door.open = open;
    },
    update: (delta: number) => {
      progress = THREE.MathUtils.lerp(progress, target, Math.min(1, delta * 4.8));
      door.progress = progress;
      leftHinge.rotation.y = -progress * Math.PI * 0.57;
      rightHinge.rotation.y = progress * Math.PI * 0.57;
    },
    isBlocking: () => progress < 0.78,
  };
  return door;
}

function createHingedDoor(
  root: THREE.Group,
  palette: MaterialPalette,
  options: {
    id: string;
    name: string;
    location: string;
    purpose: string;
    position: THREE.Vector3;
    width: number;
    depth: number;
    height?: number;
    openByDefault: boolean;
    swingSign: number;
    openAngle?: number;
    restricted?: boolean;
    backWall?: boolean;
    sideWall?: boolean;
    reverseHinge?: boolean;
  },
): Door {
  const doorHeight = options.height ?? 2.32;
  const hinge = new THREE.Group();
  const hingeX = options.sideWall ? options.position.x : options.position.x - options.width / 2;
  const hingeZ = options.sideWall
    ? options.position.z + (options.reverseHinge ? options.width / 2 : -options.width / 2)
    : options.position.z;
  const leafDirection = options.reverseHinge ? -1 : 1;
  hinge.position.set(hingeX, 0, hingeZ);
  root.add(hinge);
  const panel = addBox(
    hinge,
    options.sideWall ? [options.depth, doorHeight, options.width] : [options.width, doorHeight, options.depth],
    options.sideWall ? [0, doorHeight / 2, leafDirection * options.width / 2] : [options.width / 2, doorHeight / 2, 0],
    options.sideWall ? palette.wood : options.restricted ? palette.woodDark : palette.wood,
    { name: options.name },
  );
  if (options.backWall) {
    panel.position.set(options.width / 2, 1.16, 0);
  }
  addBox(
    hinge,
    options.sideWall ? [0.04, Math.min(1.8, doorHeight * 0.78), 0.05] : [0.05, Math.min(1.8, doorHeight * 0.78), 0.04],
    options.sideWall
      ? [-0.05, doorHeight / 2, leafDirection * (options.width - 0.11)]
      : [options.width - 0.11, doorHeight / 2, -0.05],
    palette.brass,
  );
  if (options.restricted) {
    addBox(
      hinge,
      options.sideWall ? [0.04, 0.18, 0.06] : [0.06, 0.18, 0.04],
      options.sideWall
        ? [-0.07, Math.min(1.25, doorHeight * 0.72), leafDirection * (options.width - 0.18)]
        : [options.width - 0.18, Math.min(1.25, doorHeight * 0.72), -0.07],
      palette.cyan,
    );
  }
  const collider: Collider = {
    minX: options.position.x - (options.sideWall ? 0.1 : options.width / 2 + 0.06),
    maxX: options.position.x + (options.sideWall ? 0.1 : options.width / 2 + 0.06),
    minZ: options.position.z - (options.sideWall ? options.width / 2 + 0.06 : options.backWall ? 0.17 : 0.1),
    maxZ: options.position.z + (options.sideWall ? options.width / 2 + 0.06 : options.backWall ? 0.17 : 0.1),
    label: `Closed ${options.name}`,
  };
  if (!options.backWall && doorHeight >= WALL_HEIGHT - 0.68) {
    addBox(
      root,
      [options.width + 0.14, WALL_HEIGHT - doorHeight, 0.14],
      [options.position.x, 2.66, options.position.z],
      palette.wall,
      { name: `${options.name}Header` },
    );
  }
  const info: InspectionInfo = {
    name: options.name,
    location: options.location,
    purpose: options.purpose,
  };
  let progress = options.openByDefault ? 1 : 0;
  let target = progress;
  const door: Door = {
    id: options.id,
    kind: 'door',
    position: { x: options.position.x, y: options.position.y, z: options.position.z },
    range: 1.95,
    info,
    userData: {
      collider,
      promptOpen: `Close ${options.name.replace(' Door', '').toLowerCase()}`,
      promptClosed: options.restricted ? 'Use RFID staff door' : `Open ${options.name.replace(' Door', '').toLowerCase()}`,
      restricted: options.restricted ?? false,
    },
    open: options.openByDefault,
    progress,
    target,
    toggle: () => {
      target = target > 0.5 ? 0 : 1;
      door.open = target > 0.5;
    },
    setOpen: (open: boolean) => {
      target = open ? 1 : 0;
      door.open = open;
    },
    update: (delta: number) => {
      progress = THREE.MathUtils.lerp(progress, target, Math.min(1, delta * 4.8));
      door.progress = progress;
      const openAngle = options.openAngle ?? Math.PI * 0.56;
      hinge.rotation.y = options.swingSign * progress * openAngle;
    },
    isBlocking: () => progress < 0.78,
  };
  return door;
}

function buildSecurityDevices(
  root: THREE.Group,
  overlay: THREE.Group,
  palette: MaterialPalette,
  cctvLeds: THREE.MeshStandardMaterial[],
  alarmMaterials: THREE.MeshStandardMaterial[],
): { interactables: Interactable[]; alarmBeacon: THREE.Object3D } {
  const interactables: Interactable[] = [];

  const addDevice = (options: DeviceOptions): Interactable => {
    const device: Interactable = {
      id: options.id,
      kind: 'device',
      position: { x: options.position.x, y: options.position.y, z: options.position.z },
      range: 2.0,
      info: { name: options.name, location: options.location, purpose: options.purpose },
    };
    interactables.push(device);
    if (options.labelPosition) {
      addLabel(overlay, options.name.toUpperCase(), [options.labelPosition.x, options.labelPosition.y, options.labelPosition.z], {
        color: '#d9f8ff',
        background: 'rgba(8, 50, 72, 0.92)',
        border: '#52dfff',
        fontSize: 24,
        width: options.name.length > 18 ? 1.6 : 1.25,
      });
    }
    return device;
  };

  addCctv(root, overlay, palette, cctvLeds, addDevice, {
    id: 'cctv-1',
    name: 'CCTV 1 — Main Entrance',
    location: 'Front entrance / exterior walkway',
    purpose: 'Monitors the primary approach and entry doors to deter unauthorized entry and preserve incident evidence.',
    position: new THREE.Vector3(1.6, 2.5, -2.63),
    direction: new THREE.Vector3(-0.15, -0.12, 1),
  });
  addCctv(root, overlay, palette, cctvLeds, addDevice, {
    id: 'cctv-2',
    name: 'CCTV 2 — Dining Area',
    location: 'Right wall / customer seating',
    purpose: 'Covers customer seating, circulation aisles, and the right-side window line for visibility and deterrence.',
    position: new THREE.Vector3(4.62, 2.4, 1.08),
    direction: new THREE.Vector3(-1, -0.18, -0.38),
  });
  addCctv(root, overlay, palette, cctvLeds, addDevice, {
    id: 'cctv-3',
    name: 'CCTV 3 — Cashier / POS',
    location: 'Above the cashier counter',
    purpose: 'Monitors payment transactions and the cashier area to discourage theft and provide incident evidence.',
    position: new THREE.Vector3(0.2, 2.28, -0.55),
    direction: new THREE.Vector3(-0.12, -0.2, -1),
  });
  addCctv(root, overlay, palette, cctvLeds, addDevice, {
    id: 'cctv-4',
    name: 'CCTV 4 — Storage / Staff Area',
    location: 'Back-left corner near restricted rooms',
    purpose: 'Watches the supply shelves and RFID-controlled staff threshold where valuable stock is handled.',
    position: new THREE.Vector3(-3.9, 2.52, 1.2),
    direction: new THREE.Vector3(0.7, -0.16, -0.7),
  });

  const panicPosition = new THREE.Vector3(0.68, 1.04, 0.12);
  const panicButton = new THREE.Group();
  panicButton.position.copy(panicPosition);
  root.add(panicButton);
  addBox(panicButton, [0.24, 0.12, 0.15], [0, 0, 0], palette.black, { name: 'PanicButtonHousing' });
  addCylinder(panicButton, 0.075, 0.045, [0, 0.08, 0], palette.red, 20).rotation.x = Math.PI / 2;
  addDevice({
    id: 'panic-button',
    name: 'Panic Button',
    location: 'Staff side of the cashier counter, beside the POS',
    purpose: 'Provides a manually triggered emergency alert point for staff. The presentation demo flashes the entrance siren only.',
    position: panicPosition.clone(),
    model: panicButton,
    labelPosition: new THREE.Vector3(panicPosition.x, 1.55, panicPosition.z),
  });

  const smokeDetector = new THREE.Group();
  smokeDetector.position.set(-3.05, 2.88, -0.25);
  root.add(smokeDetector);
  addCylinder(smokeDetector, 0.16, 0.08, [0, 0, 0], palette.white, 20);
  addCylinder(smokeDetector, 0.05, 0.09, [0, 0.06, 0], palette.red, 12);
  addDevice({
    id: 'smoke-detector',
    name: 'Smoke Detector',
    location: 'Ceiling above the preparation area',
    purpose: 'Detects smoke early near cooking and espresso equipment so staff can respond before a small fire spreads.',
    position: smokeDetector.position,
    model: smokeDetector,
    labelPosition: new THREE.Vector3(-3.05, 2.62, -0.25),
  });

  const extinguisher = new THREE.Group();
  extinguisher.position.set(-4.65, 0.82, 0.93);
  root.add(extinguisher);
  addCylinder(extinguisher, 0.12, 0.62, [0, 0, 0], palette.red, 18);
  addCylinder(extinguisher, 0.06, 0.1, [0, 0.36, 0], palette.black, 12);
  addBox(extinguisher, [0.28, 0.07, 0.05], [0, 0.1, -0.12], palette.white);
  addDevice({
    id: 'fire-extinguisher',
    name: 'Fire Extinguisher',
    location: 'Left wall beside the preparation area',
    purpose: 'Provides immediate first-response fire suppression for a small incident near the coffee bar.',
    position: extinguisher.position,
    model: extinguisher,
    labelPosition: new THREE.Vector3(-4.05, 1.55, 0.93),
  });

  const motionSensor = new THREE.Group();
  motionSensor.position.set(-4.0, 2.38, 2.77);
  root.add(motionSensor);
  addBox(motionSensor, [0.25, 0.2, 0.08], [0, 0, 0], palette.white);
  addSphere(motionSensor, 0.045, [0, -0.01, -0.06], palette.cyan, 12, 8);
  addDevice({
    id: 'motion-sensor',
    name: 'Motion Sensor',
    location: 'Storage room back wall',
    purpose: 'Adds after-hours movement detection to the restricted supply area.',
    position: motionSensor.position,
    model: motionSensor,
    labelPosition: new THREE.Vector3(-4.0, 2.83, 2.76),
  });

  const rfid = new THREE.Group();
  rfid.position.set(-0.72, 1.62, 1.28);
  root.add(rfid);
  addBox(rfid, [0.14, 0.23, 0.05], [0, 0, 0], palette.blue, { name: 'RFIDReader' });
  addBox(rfid, [0.04, 0.09, 0.02], [0, 0, -0.04], palette.cyan);
  addDevice({
    id: 'rfid-reader',
    name: 'RFID Access Reader',
    location: 'Staff-only room door',
    purpose: 'Marks the transition from public space to restricted staff space and provides a presentation-only access-control demonstration.',
    position: rfid.position,
    model: rfid,
    labelPosition: new THREE.Vector3(-0.72, 2.02, 1.28),
  });

  const entranceContact = createContactSensor(root, palette, new THREE.Vector3(-0.98, 2.35, -2.9), 'Entrance Contact Sensor');
  addDevice({
    id: 'entrance-contact',
    name: 'Main Door Contact Sensor',
    location: 'Upper-left side of the main entrance',
    purpose: 'Reports whether the primary entrance is open or closed as part of the physical security boundary.',
    position: entranceContact.position,
    model: entranceContact,
    labelPosition: new THREE.Vector3(-0.98, 2.85, -2.76),
  });
  const exitContact = createContactSensor(root, palette, new THREE.Vector3(4.58, 2.35, 2.78), 'Emergency Exit Contact Sensor');
  addDevice({
    id: 'exit-contact',
    name: 'Emergency Exit Contact Sensor',
    location: 'Upper-right side of the emergency exit',
    purpose: 'Monitors the secondary egress door so an unexpected opening can be noticed and investigated.',
    position: exitContact.position,
    model: exitContact,
    labelPosition: new THREE.Vector3(4.45, 2.84, 2.7),
  });

  const alarmBeacon = new THREE.Group();
  alarmBeacon.position.set(1.75, 2.28, -2.72);
  root.add(alarmBeacon);
  addBox(alarmBeacon, [0.28, 0.32, 0.18], [0, 0, 0], palette.black, { name: 'AlarmHousing' });
  const alarmMaterial = new THREE.MeshStandardMaterial({
    color: 0xe03a32,
    emissive: 0xb11212,
    emissiveIntensity: 0.6,
    roughness: 0.32,
  });
  addCylinder(alarmBeacon, 0.12, 0.18, [0, 0.23, 0], alarmMaterial, 18);
  alarmMaterials.push(alarmMaterial);
  addDevice({
    id: 'alarm-siren',
    name: 'Alarm / Siren',
    location: 'Front entrance wall',
    purpose: 'Provides a local visual alarm cue. It flashes briefly when the panic-button presentation demo is activated.',
    position: alarmBeacon.position,
    model: alarmBeacon,
    labelPosition: new THREE.Vector3(1.75, 2.78, -2.72),
  });

  const exitSign = addBox(root, [0.78, 0.25, 0.06], [4.15, 2.62, 2.77], palette.red, { name: 'ExitSign' });
  addLabel(root, 'EXIT', [4.15, 2.63, 2.71], {
    color: '#fff2e9',
    background: 'rgba(175, 29, 25, 0.96)',
    border: '#ff9282',
    fontSize: 28,
    width: 0.68,
  });
  addDevice({
    id: 'exit-sign',
    name: 'EXIT Sign',
    location: 'Above the back-right emergency exit',
    purpose: 'Keeps the emergency route identifiable in a stressful or low-light evacuation condition.',
    position: new THREE.Vector3(4.15, 2.62, 2.77),
    model: exitSign,
    labelPosition: new THREE.Vector3(4.15, 3.02, 2.67),
  });

  addDevice({
    id: 'security-lighting',
    name: 'Entrance Security Lighting',
    location: 'Exterior lamps flanking the main entrance',
    purpose: 'Improves facial visibility and deters loitering around the entry approach, especially in night mode.',
    position: new THREE.Vector3(1.45, 2.2, -3.35),
    model: root,
    labelPosition: new THREE.Vector3(1.45, 3.0, -3.32),
  });

  addLabel(overlay, 'CONTACT', [-0.98, 2.86, -2.72], {
    color: '#d9f8ff',
    background: 'rgba(8, 50, 72, 0.92)',
    border: '#52dfff',
    fontSize: 22,
    width: 0.8,
  });
  addLabel(overlay, 'CONTACT', [4.42, 2.86, 2.68], {
    color: '#d9f8ff',
    background: 'rgba(8, 50, 72, 0.92)',
    border: '#52dfff',
    fontSize: 22,
    width: 0.8,
  });

  return { interactables, alarmBeacon };
}

function addCctv(
  root: THREE.Group,
  overlay: THREE.Group,
  palette: MaterialPalette,
  leds: THREE.MeshStandardMaterial[],
  addDevice: (options: DeviceOptions) => Interactable,
  options: {
    id: string;
    name: string;
    location: string;
    purpose: string;
    position: THREE.Vector3;
    direction: THREE.Vector3;
  },
): void {
  const model = new THREE.Group();
  model.name = options.name;
  model.position.copy(options.position);
  model.rotation.y = Math.atan2(options.direction.x, options.direction.z);
  root.add(model);
  addBox(model, [0.36, 0.24, 0.3], [0, 0, 0], palette.white, { name: 'CCTVBody' });
  const lens = addCylinder(model, 0.085, 0.12, [0, 0, 0.19], palette.black, 16);
  lens.rotation.x = Math.PI / 2;
  const led = new THREE.MeshStandardMaterial({
    color: 0x4de7ff,
    emissive: 0x13a9c7,
    emissiveIntensity: 1.5,
    roughness: 0.28,
  });
  addSphere(model, 0.035, [0.1, -0.08, 0.17], led, 12, 8);
  leds.push(led);

  const direction = options.direction.clone().normalize();
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: 0x37d2f5,
    transparent: true,
    opacity: 0.075,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 3.1, 28, 1, true), coneMaterial);
  cone.position.copy(options.position).add(direction.clone().multiplyScalar(1.55));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().negate());
  overlay.add(cone);

  addDevice({
    id: options.id,
    name: options.name,
    location: options.location,
    purpose: options.purpose,
    position: options.position,
    model,
    labelPosition: options.position.clone().add(new THREE.Vector3(0, 0.38, 0)),
  });
}

function createContactSensor(root: THREE.Group, palette: MaterialPalette, position: THREE.Vector3, name: string): THREE.Group {
  const sensor = new THREE.Group();
  sensor.name = name;
  sensor.position.copy(position);
  root.add(sensor);
  addBox(sensor, [0.18, 0.14, 0.08], [0, 0, 0], palette.cyan, { name: 'ContactSensor' });
  addBox(sensor, [0.055, 0.2, 0.1], [0.13, 0, 0], palette.white);
  return sensor;
}
