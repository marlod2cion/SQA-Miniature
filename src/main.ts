import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ChairPlacement,
  CHAIR_SEAT_SIZE,
  DINING_CHAIR_OFFSET,
  DINING_TABLES,
  DINING_TABLE_SIZE,
  Door,
  Interactable,
  OVERVIEW_START,
  PLAYER_HEIGHT,
  SceneMode,
  Seat,
  WAITING_CHAIRS,
} from './data/layout';
import { FirstPersonController } from './controls/firstPersonController';
import { createCoffeeShop, ShopWorld } from './scene/createCoffeeShop';
import { LightingRig } from './scene/lighting';
import { SecurityOverlay } from './systems/securityOverlay';
import './style.css';

const getElement = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element #${id}`);
  return element as T;
};

const canvas = getElement<HTMLCanvasElement>('scene-canvas');
const welcomeScreen = getElement<HTMLElement>('welcome-screen');
const hud = getElement<HTMLElement>('hud');
const loadingIndicator = getElement<HTMLElement>('loading-indicator');
const enterButton = getElement<HTMLButtonElement>('enter-button');
const overviewButton = getElement<HTMLButtonElement>('overview-button');
const modeButton = getElement<HTMLButtonElement>('mode-button');
const modeLabel = getElement<HTMLElement>('mode-label');
const overlayToggle = getElement<HTMLInputElement>('overlay-toggle');
const nightToggle = getElement<HTMLInputElement>('night-toggle');
const staffToggle = getElement<HTMLInputElement>('staff-toggle');
const resetButton = getElement<HTMLButtonElement>('reset-button');
const roofButton = getElement<HTMLButtonElement>('roof-button');
const areaSelect = getElement<HTMLSelectElement>('area-select');
const goAreaButton = getElement<HTMLButtonElement>('go-area-button');
const autoExploreButton = getElement<HTMLButtonElement>('auto-explore-button');
const autoExploreStatus = getElement<HTMLElement>('auto-explore-status');
const tourCaption = getElement<HTMLElement>('tour-caption');
const tourCaptionArea = getElement<HTMLElement>('tour-caption-area');
const tourCaptionText = getElement<HTMLElement>('tour-caption-text');
const tourAudioButton = getElement<HTMLButtonElement>('tour-audio-button');
const tourStopButton = getElement<HTMLButtonElement>('tour-stop-button');
const helpButton = getElement<HTMLButtonElement>('help-button');
const controlsCard = getElement<HTMLElement>('controls-card');
const controlsClose = getElement<HTMLButtonElement>('controls-close');
const infoPanel = getElement<HTMLElement>('info-panel');
const infoClose = getElement<HTMLButtonElement>('info-close');
const infoKicker = getElement<HTMLElement>('info-kicker');
const infoTitle = getElement<HTMLElement>('info-title');
const infoLocation = getElement<HTMLElement>('info-location');
const infoPurpose = getElement<HTMLElement>('info-purpose');
const reticle = getElement<HTMLElement>('reticle');
const interactionPrompt = getElement<HTMLElement>('interaction-prompt');
const toast = getElement<HTMLElement>('toast');
const walkthroughHint = getElement<HTMLElement>('walkthrough-hint');
const miniLegend = getElement<HTMLElement>('mini-legend');
const blueprintStamp = getElement<HTMLElement>('blueprint-stamp');
const floorplanButton = getElement<HTMLButtonElement>('floorplan-button');
const floorplanPanel = getElement<HTMLElement>('floorplan-panel');
const floorplanClose = getElement<HTMLButtonElement>('floorplan-close');
const floorplanPlayer = document.getElementById('floorplan-player') as unknown as SVGCircleElement;
const floorplanTables = document.getElementById('floorplan-tables') as unknown as SVGGElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9eb9c7);
scene.fog = new THREE.Fog(0x9eb9c7, 19, 42);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 60);
camera.position.set(0, PLAYER_HEIGHT, -4.5);

const lighting = new LightingRig(scene);
const shop = createCoffeeShop(scene);
const firstPerson = new FirstPersonController(camera, renderer.domElement);
firstPerson.setEnabled(false);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = false;
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.minDistance = 5.7;
orbit.maxDistance = 20;
orbit.maxPolarAngle = Math.PI * 0.47;
orbit.minPolarAngle = 0.22;
orbit.target.set(0, 0.9, 0);
const securityOverlay = new SecurityOverlay(shop.overlay);

let mode: SceneMode = 'walkthrough';
let authorizedStaff = false;
let currentInteractable: Interactable | null = null;
let toastTimer: number | undefined;
let elapsed = 0;
let overviewInitialized = false;
let orderPlaced = false;
let pickupReady = false;
interface AutoTourState {
  index: number;
  pauseRemaining: number;
  visited: number;
  narrationDone: boolean;
  narrationDeadline: number;
  narrationText: string;
  utterance: SpeechSynthesisUtterance | null;
  previousAuthorized: boolean;
  previousOverlay: boolean;
  doorStates: Map<string, boolean>;
}
let autoTour: AutoTourState | null = null;
const savedWalkPosition = firstPerson.getPosition().clone();
const savedWalkDirection = new THREE.Vector3(0, 0, 1);

const planPoint = (x: number, z: number): { x: number; y: number } => ({
  x: 500 + x * shop.horizontalScale * 90,
  y: 450 - z * shop.depthScale * 90,
});
const svgNamespace = 'http://www.w3.org/2000/svg';
const planWidth = (width: number): number => width * shop.horizontalScale * 90;
const planDepth = (depth: number): number => depth * shop.depthScale * 90;

function appendPlanRect(
  x: number,
  y: number,
  width: number,
  height: number,
  className: string,
  radius = 3,
): SVGRectElement {
  const rectangle = document.createElementNS(svgNamespace, 'rect');
  rectangle.setAttribute('x', String(x - width / 2));
  rectangle.setAttribute('y', String(y - height / 2));
  rectangle.setAttribute('width', String(width));
  rectangle.setAttribute('height', String(height));
  rectangle.setAttribute('rx', String(radius));
  rectangle.setAttribute('class', className);
  floorplanTables.append(rectangle);
  return rectangle;
}

function appendPlanChair(placement: ChairPlacement, waiting = false): void {
  const seat = planPoint(placement.x, placement.z);
  appendPlanRect(
    seat.x,
    seat.y,
    planWidth(CHAIR_SEAT_SIZE),
    planDepth(CHAIR_SEAT_SIZE),
    waiting ? 'plan-chair plan-waiting-chair' : 'plan-chair',
  );

  const back = planPoint(placement.x + placement.backX * 0.14, placement.z + placement.backZ * 0.14);
  const facesSideWall = placement.backX !== 0;
  appendPlanRect(
    back.x,
    back.y,
    planWidth(facesSideWall ? 0.08 : 0.34),
    planDepth(facesSideWall ? 0.34 : 0.08),
    waiting ? 'plan-chair-back plan-waiting-chair' : 'plan-chair-back',
    1,
  );
}

DINING_TABLES.forEach(({ x, z }) => {
  const table = planPoint(x, z);
  appendPlanRect(table.x, table.y, planWidth(DINING_TABLE_SIZE.width), planDepth(DINING_TABLE_SIZE.depth), 'plan-table', 4);
  const plant = document.createElementNS(svgNamespace, 'circle');
  plant.setAttribute('cx', String(table.x));
  plant.setAttribute('cy', String(table.y));
  plant.setAttribute('r', '8');
  plant.setAttribute('class', 'plan-plant');
  floorplanTables.append(plant);
  appendPlanChair({ x, z: z - DINING_CHAIR_OFFSET, backX: 0, backZ: -1 });
  appendPlanChair({ x, z: z + DINING_CHAIR_OFFSET, backX: 0, backZ: 1 });
});
WAITING_CHAIRS.forEach((placement) => appendPlanChair(placement, true));

function updateFloorplanPlayer(): void {
  const position = mode === 'overview' ? savedWalkPosition : firstPerson.getPosition();
  const point = planPoint(position.x / shop.horizontalScale, position.z / shop.depthScale);
  floorplanPlayer.setAttribute('cx', String(THREE.MathUtils.clamp(point.x, 10, 990)));
  floorplanPlayer.setAttribute('cy', String(THREE.MathUtils.clamp(point.y, 10, 925)));
}

function toggleFloorplan(show: boolean): void {
  if (show) stopAutoTour();
  floorplanPanel.classList.toggle('is-hidden', !show);
  if (show) {
    firstPerson.setEnabled(false);
    firstPerson.unlock();
    infoPanel.classList.add('is-hidden');
    updateFloorplanPlayer();
    floorplanClose.focus();
  } else {
    if (mode === 'walkthrough') firstPerson.setEnabled(true);
    floorplanButton.focus();
  }
}

function setMode(nextMode: SceneMode, lockPointer = false): void {
  stopAutoTour();
  const wasOverview = mode === 'overview';
  mode = nextMode;
  const isOverview = mode === 'overview';
  floorplanPanel.classList.add('is-hidden');
  if (isOverview && !wasOverview) {
    firstPerson.standUp();
    savedWalkPosition.copy(firstPerson.getPosition());
    camera.getWorldDirection(savedWalkDirection);
  }
  modeLabel.textContent = isOverview ? 'Overview' : 'Walkthrough';
  modeButton.innerHTML = isOverview ? '<span>⌁</span> Return to walkthrough' : '<span>⌘</span> Switch to overview';
  reticle.classList.toggle('is-hidden', isOverview);
  interactionPrompt.classList.toggle('is-hidden', isOverview);
  walkthroughHint.classList.toggle('is-hidden', isOverview);
  shop.roomLabels.visible = isOverview;
  roofButton.classList.toggle('is-hidden', !isOverview);
  miniLegend.classList.toggle('is-hidden', !isOverview);
  blueprintStamp.classList.toggle('is-hidden', !isOverview);

  if (isOverview) {
    infoPanel.classList.add('is-hidden');
    if (!overviewInitialized) {
      securityOverlay.setEnabled(true);
      overlayToggle.checked = true;
      overviewInitialized = true;
    }
    firstPerson.setEnabled(false);
    firstPerson.unlock();
    orbit.enabled = true;
    camera.position.set(OVERVIEW_START.x, OVERVIEW_START.y, OVERVIEW_START.z);
    orbit.target.set(0, 0.75, 0);
    orbit.update();
    shop.setRoofVisible(false);
    roofButton.innerHTML = '<span>▱</span> Show roof shell';
    interactionPrompt.textContent = '';
  } else {
    orbit.enabled = false;
    firstPerson.setEnabled(true);
    if (wasOverview) firstPerson.moveTo(savedWalkPosition, savedWalkPosition.clone().add(savedWalkDirection));
    else firstPerson.reset();
    shop.setRoofVisible(true);
    if (lockPointer) firstPerson.lock();
  }
}

function showHud(): void {
  welcomeScreen.classList.add('is-hidden');
  hud.classList.remove('is-hidden');
}

function toggleControlsCard(force?: boolean): void {
  const shouldShow = force ?? controlsCard.classList.contains('is-hidden');
  controlsCard.classList.toggle('is-hidden', !shouldShow);
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add('is-visible');
  if (toastTimer !== undefined) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

function showInfo(item: Interactable): void {
  infoKicker.textContent = item.kind === 'door' ? 'ACCESS POINT' : item.id === 'menu-board' ? 'COFFEE SHOP MENU' : 'SECURITY DEVICE';
  infoTitle.textContent = item.info.name;
  infoLocation.textContent = item.info.location;
  infoPurpose.textContent = item.info.purpose;
  infoPanel.classList.remove('is-hidden');
}

function getNearestInteractable(): Interactable | null {
  if (autoTour || mode !== 'walkthrough' || !floorplanPanel.classList.contains('is-hidden')) return null;
  const playerPosition = firstPerson.getPosition();
  const viewDirection = new THREE.Vector3();
  camera.getWorldDirection(viewDirection);
  viewDirection.y = 0;
  viewDirection.normalize();

  let nearest: Interactable | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  shop.interactables.forEach((item) => {
    if (item.id === 'restroom-sink' && (
      playerPosition.z < 1.48 * shop.depthScale ||
      playerPosition.x < 0.52 * shop.horizontalScale ||
      playerPosition.x > 2.58 * shop.horizontalScale
    )) return;
    const offset = new THREE.Vector3(
      item.position.x - playerPosition.x,
      item.position.y - playerPosition.y,
      item.position.z - playerPosition.z,
    );
    const distance = offset.length();
    if (distance > item.range) return;
    offset.normalize();
    const facing = viewDirection.dot(offset);
    const isDoor = item.kind === 'door';
    if (!isDoor && facing < -0.18) return;
    // Give a nearby doorway priority over ceiling-mounted devices so E opens the door you reached.
    const doorPriority = item.id === 'cashier-staff-gate' ? 1.25 : 0.55;
    const priorityDistance = distance + (1 - facing) * 5.5 - (isDoor ? doorPriority : 0);
    if (priorityDistance < nearestDistance) {
      nearestDistance = priorityDistance;
      nearest = item;
    }
  });
  return nearest;
}

function getPrompt(item: Interactable): string {
  if (item.kind === 'seat') return '[E] / click · Sit at this table';
  if (item.kind === 'door') {
    const door = item as Door;
    if (door.userData.restricted && !authorizedStaff) return '[E] / click · Try RFID staff access';
    return door.open
      ? `[E] / click · ${door.userData.promptOpen}`
      : `[E] / click · ${door.userData.promptClosed}`;
  }
  if (item.id === 'panic-button') return '[E] / click · Demonstrate panic button';
  if (item.id === 'espresso-machine') return '[E] / click · Brew a coffee';
  if (item.id === 'cashier-order') return '[E] / click · Place a demo order';
  if (item.id === 'menu-board') return '[E] / click · Read the menu';
  if (item.id === 'order-pickup') return '[E] / click · Collect order';
  if (item.id === 'restroom-sink') return '[E] / click · Wash hands';
  return `[E] / click · Inspect ${item.info.name}`;
}

function updateInteractionPrompt(): void {
  if (firstPerson.isSeated() && mode === 'walkthrough') {
    currentInteractable = null;
    interactionPrompt.textContent = '[E] / click · Stand up';
    interactionPrompt.classList.add('is-visible');
    return;
  }
  currentInteractable = getNearestInteractable();
  if (!currentInteractable || mode !== 'walkthrough') {
    interactionPrompt.textContent = '';
    interactionPrompt.classList.remove('is-visible');
    return;
  }
  interactionPrompt.textContent = getPrompt(currentInteractable);
  interactionPrompt.classList.add('is-visible');
}

function interact(): void {
  if (firstPerson.isSeated()) {
    firstPerson.standUp();
    showToast('You stood up from the table.');
    return;
  }
  if (!currentInteractable || mode !== 'walkthrough') return;
  if (currentInteractable.kind === 'seat') {
    const seat = currentInteractable as Seat;
    firstPerson.sitAt(
      new THREE.Vector3(seat.position.x, 1.04, seat.position.z),
      new THREE.Vector3(seat.tablePosition.x, 1.1, seat.tablePosition.z),
    );
    showToast('Seated at the table · press E or click to stand.');
    return;
  }
  if (currentInteractable.kind === 'door') {
    const door = currentInteractable as Door;
    if (door.userData.restricted && !authorizedStaff) {
      showToast('Access restricted · enable Authorized Staff Demo to open this door.');
      showInfo(door);
      return;
    }
    door.toggle();
    showToast(door.open ? `${door.info.name} opening.` : `${door.info.name} closing.`);
    return;
  }
  if (currentInteractable.id === 'menu-board') {
    showInfo(currentInteractable);
    return;
  }
  if (currentInteractable.id === 'cashier-order') {
    orderPlaced = true;
    pickupReady = false;
    shop.setPickupReady(false);
    showToast('Order placed · watch the espresso station brew your coffee.');
    return;
  }
  if (currentInteractable.id === 'espresso-machine') {
    shop.triggerBrew();
    if (orderPlaced) {
      pickupReady = true;
      shop.setPickupReady(true);
      showToast('Coffee brewed · collect your cup at the cashier pickup pad.');
    } else showToast('Espresso demo started · steam is rising from the machine.');
    return;
  }
  if (currentInteractable.id === 'order-pickup') {
    if (!pickupReady) showToast(orderPlaced ? 'Watch the espresso station brew your order first.' : 'Place an order at the cashier first.');
    else {
      pickupReady = false;
      orderPlaced = false;
      shop.setPickupReady(false);
      showToast('Coffee collected · enjoy it at a dining table.');
    }
    return;
  }
  if (currentInteractable.id === 'restroom-sink') {
    shop.triggerWash();
    showToast('Hands washed at the restroom sink.');
    return;
  }
  if (currentInteractable.id === 'panic-button') {
    shop.triggerAlarm();
    showToast('Demonstration alert · entrance alarm activated for 3 seconds.');
    return;
  }
  showInfo(currentInteractable);
}

const areaStops: Record<string, { x: number; z: number; faceX: number; faceZ: number }> = {
  entrance: { x: 0, z: -4.5, faceX: 0, faceZ: -1.8 },
  prep: { x: -3.15, z: -1.25, faceX: -3.15, faceZ: 0.25 },
  cashier: { x: 0, z: -1.3, faceX: 0, faceZ: -0.15 },
  dining: { x: 1.7, z: -1.0, faceX: 3.1, faceZ: -0.5 },
  storage: { x: -3.75, z: 1.015, faceX: -3.75, faceZ: 2.1 },
  staff: { x: -1.25, z: 1.015, faceX: -1.25, faceZ: 1.8 },
  restroom: { x: 1.9, z: 0.82, faceX: 1.9, faceZ: 2.1 },
  exit: { x: 4.0, z: 1.65, faceX: 4.15, faceZ: 2.55 },
};

interface TourStop {
  x: number;
  z: number;
  faceX: number;
  faceZ: number;
  label?: string;
  narration?: string;
  pause?: number;
  openDoor?: string;
}

// Viewpoints follow the actual public aisle and the narrow staff passage behind
// the counter. Doorway stops show the small rooms without crossing their fixtures.
const autoTourStops: readonly TourStop[] = [
  {
    x: 0, z: -4.4, faceX: 0, faceZ: -2, label: 'Main entrance', pause: 1.4, openDoor: 'main-door',
    narration: 'Welcome to BrewGuard Coffee Shop. The glass entrance has a door contact sensor and security lighting that help monitor arrivals.',
  },
  { x: 0, z: -2.2, faceX: -3.2, faceZ: -1.8 },
  {
    x: -3.2, z: -1.75, faceX: -4.2, faceZ: -2, label: 'Waiting area', pause: 1.6,
    narration: 'The waiting chairs form an L along the left storefront and wall. The tables are opposite them, so the main entrance stays clear.',
  },
  {
    x: -3.15, z: -1.2, faceX: -3.15, faceZ: 0.25, label: 'Coffee preparation', pause: 1.8,
    narration: 'This is the preparation counter. Staff use the espresso machine and work area here, behind the customer side of the bar.',
  },
  {
    x: 0, z: -1.3, faceX: 0, faceZ: -0.15, label: 'Cashier and POS', pause: 1.8,
    narration: 'At the cashier, customers place orders and collect drinks. The nearby staff gate separates the public area from the work passage.',
  },
  {
    x: 1.25, z: -1.35, faceX: 2.8, faceZ: -1.4, label: 'Four dining tables', pause: 1.8,
    narration: 'Four two-seat tables occupy the right side. Cameras cover the dining area, and an open aisle leads toward the rear exit.',
  },
  { x: 1.25, z: 0.85, faceX: 1.9, faceZ: 2.1 },
  {
    x: 1.9, z: 0.85, faceX: 1.9, faceZ: 2.2, label: 'Restroom', pause: 1.8, openDoor: 'restroom-door',
    narration: 'The restroom has its own door, sink, and toilet. Its entrance opens from the public aisle at the back of the café.',
  },
  { x: 1.25, z: 0.85, faceX: 0.55, faceZ: 1.015 },
  { x: 0.55, z: 1.015, faceX: -1.25, faceZ: 1.015 },
  { x: -1.25, z: 1.015, faceX: -1.25, faceZ: 2.15, pause: 1.1, openDoor: 'staff-door' },
  {
    x: -1.25, z: 1.53, faceX: -1.55, faceZ: 2.25, label: 'Authorized staff room', pause: 1.8,
    narration: 'Demo authorization opens the RFID controlled staff access. The staff room contains a desk and locker for back-of-house use.',
  },
  { x: -1.25, z: 1.015, faceX: -3.75, faceZ: 1.015 },
  { x: -3.75, z: 1.015, faceX: -3.75, faceZ: 2.1, pause: 1.1, openDoor: 'storage-door' },
  {
    x: -3.75, z: 1.4, faceX: -4.1, faceZ: 2.1, label: 'Storage', pause: 1.8,
    narration: 'Storage shelves hold supplies behind the counter. A motion sensor helps monitor this back-of-house area.',
  },
  { x: -3.75, z: 1.015, faceX: 0.55, faceZ: 1.015 },
  { x: 0.55, z: 1.015, faceX: 1.25, faceZ: 1.015 },
  { x: 1.25, z: 1.015, faceX: 4.05, faceZ: 1.015 },
  { x: 4.05, z: 1.015, faceX: 4.05, faceZ: 2.2 },
  {
    x: 4.05, z: 2.2, faceX: 4.15, faceZ: 2.9, label: 'Emergency exit', pause: 2, openDoor: 'emergency-door',
    narration: 'The emergency exit is at the back right. An illuminated exit sign and door contact sensor mark the route, which stays clear of the tables.',
  },
];
const autoTourAreaCount = autoTourStops.filter((stop) => stop.label).length;
const tourLookCamera = new THREE.PerspectiveCamera();
const tourAudioSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let tourAudioEnabled = true;

function updateTourAudioButton(): void {
  tourAudioButton.disabled = !tourAudioSupported;
  tourAudioButton.textContent = !tourAudioSupported ? 'Audio unavailable' : tourAudioEnabled ? 'Audio on' : 'Audio off';
  tourAudioButton.setAttribute('aria-pressed', String(tourAudioSupported && tourAudioEnabled));
}

function cancelTourSpeech(tour: AutoTourState): void {
  const hadUtterance = tour.utterance !== null;
  tour.utterance = null;
  tour.narrationDone = true;
  if (hadUtterance && tourAudioSupported) window.speechSynthesis.cancel();
}

function speakTourNarration(tour: AutoTourState): void {
  if (!tourAudioSupported || !tourAudioEnabled || !tour.narrationText) return;
  const utterance = new SpeechSynthesisUtterance(tour.narrationText);
  utterance.lang = 'en-US';
  utterance.rate = 0.96;
  utterance.volume = 0.9;
  const finish = (): void => {
    if (autoTour === tour && tour.utterance === utterance) {
      tour.utterance = null;
      tour.narrationDone = true;
    }
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  tour.utterance = utterance;
  tour.narrationDone = false;
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    finish();
  }
}

function setAuthorizedStaff(enabled: boolean): void {
  authorizedStaff = enabled;
  staffToggle.checked = enabled;
  shop.doors
    .filter((door) => door.userData.restricted)
    .forEach((door) => {
      if (door.id === 'cashier-staff-gate') door.setOpen(enabled);
      else if (!enabled) door.setOpen(false);
    });
}

function visitTourStop(stop: TourStop, tour: AutoTourState): void {
  if (stop.openDoor) shop.doors.find((door) => door.id === stop.openDoor)?.setOpen(true);
  if (!stop.label) return;
  tour.visited += 1;
  autoExploreStatus.textContent = `${tour.visited} / ${autoTourAreaCount} · ${stop.label}`;
  cancelTourSpeech(tour);
  tour.narrationText = stop.narration ?? '';
  tourCaptionArea.textContent = stop.label;
  tourCaptionText.textContent = tour.narrationText;
  tourCaption.classList.remove('is-hidden');
  hud.classList.add('has-tour-captions');
  const readingSeconds = 1.2 + tour.narrationText.trim().split(/\s+/).length / 2.6;
  tour.pauseRemaining = Math.max(tour.pauseRemaining, readingSeconds);
  tour.narrationDeadline = performance.now() + (readingSeconds + 6) * 1000;
  speakTourNarration(tour);
}

function stopAutoTour(completed = false): void {
  const tour = autoTour;
  if (!tour) return;
  cancelTourSpeech(tour);
  autoTour = null;

  // Move out of the staff passage or a room doorway before restoring closed doors.
  const position = firstPerson.getPosition();
  const localX = position.x / shop.horizontalScale;
  const localZ = position.z / shop.depthScale;
  if ((localX < 1 && localZ > 0.75) || (localX < 2.65 && localZ > 1.35)) {
    firstPerson.moveTo(
      new THREE.Vector3(1.25 * shop.horizontalScale, PLAYER_HEIGHT, 0.85 * shop.depthScale),
      new THREE.Vector3(3 * shop.horizontalScale, PLAYER_HEIGHT, 0.85 * shop.depthScale),
    );
  }

  setAuthorizedStaff(tour.previousAuthorized);
  tour.doorStates.forEach((wasOpen, id) => shop.doors.find((door) => door.id === id)?.setOpen(wasOpen));
  securityOverlay.setEnabled(tour.previousOverlay);
  overlayToggle.checked = tour.previousOverlay;
  firstPerson.setEnabled(mode === 'walkthrough' && floorplanPanel.classList.contains('is-hidden'));
  autoExploreButton.innerHTML = '<span>▶</span> Start Auto Explore';
  autoExploreButton.setAttribute('aria-pressed', 'false');
  autoExploreStatus.hidden = true;
  tourCaption.classList.add('is-hidden');
  hud.classList.remove('has-tour-captions');
  walkthroughHint.classList.toggle('is-hidden', mode !== 'walkthrough' || firstPerson.isLocked());
  if (completed) showToast('Auto Explore complete · previous access settings restored.');
}

function startAutoTour(): void {
  if (mode === 'overview') setMode('walkthrough');
  firstPerson.standUp();
  const firstStop = autoTourStops[0];
  const tour: AutoTourState = {
    index: 0,
    pauseRemaining: firstStop.pause ?? 0,
    visited: 0,
    narrationDone: true,
    narrationDeadline: 0,
    narrationText: '',
    utterance: null,
    previousAuthorized: authorizedStaff,
    previousOverlay: securityOverlay.isEnabled(),
    doorStates: new Map(shop.doors.map((door) => [door.id, door.open])),
  };
  autoTour = tour;
  firstPerson.setEnabled(false);
  firstPerson.unlock();
  setAuthorizedStaff(true);
  securityOverlay.setEnabled(true);
  overlayToggle.checked = true;
  firstPerson.moveTo(
    new THREE.Vector3(firstStop.x * shop.horizontalScale, PLAYER_HEIGHT, firstStop.z * shop.depthScale),
    new THREE.Vector3(firstStop.faceX * shop.horizontalScale, PLAYER_HEIGHT, firstStop.faceZ * shop.depthScale),
  );
  visitTourStop(firstStop, tour);
  autoExploreButton.innerHTML = '<span>■</span> Stop Auto Explore';
  autoExploreButton.setAttribute('aria-pressed', 'true');
  autoExploreStatus.hidden = false;
  walkthroughHint.classList.add('is-hidden');
  interactionPrompt.classList.remove('is-visible');
  infoPanel.classList.add('is-hidden');
  showToast('Auto Explore started · demo staff access enabled.');
}

function updateAutoTour(delta: number): void {
  const tour = autoTour;
  if (!tour) return;
  if (tour.pauseRemaining > 0) {
    tour.pauseRemaining -= delta;
    return;
  }
  if (!tour.narrationDone) {
    if (performance.now() < tour.narrationDeadline) return;
    cancelTourSpeech(tour);
  }
  const nextStop = autoTourStops[tour.index + 1];
  if (!nextStop) {
    stopAutoTour(true);
    return;
  }

  const destination = new THREE.Vector3(nextStop.x * shop.horizontalScale, PLAYER_HEIGHT, nextStop.z * shop.depthScale);
  const remaining = camera.position.distanceTo(destination);
  const step = Math.min(remaining, 2.1 * delta);
  if (remaining > 0) camera.position.lerp(destination, step / remaining);
  tourLookCamera.position.copy(destination);
  tourLookCamera.lookAt(nextStop.faceX * shop.horizontalScale, PLAYER_HEIGHT, nextStop.faceZ * shop.depthScale);
  camera.quaternion.slerp(tourLookCamera.quaternion, Math.min(1, delta * 4));
  if (remaining > step + 0.001) return;

  firstPerson.moveTo(
    destination,
    new THREE.Vector3(nextStop.faceX * shop.horizontalScale, PLAYER_HEIGHT, nextStop.faceZ * shop.depthScale),
  );
  tour.index += 1;
  tour.pauseRemaining = nextStop.pause ?? 0;
  visitTourStop(nextStop, tour);
}

function goToSelectedArea(): void {
  stopAutoTour();
  if (mode === 'overview') setMode('walkthrough', false);
  const autoAuthorized = !authorizedStaff && ['storage', 'staff'].includes(areaSelect.value);
  if (['storage', 'staff'].includes(areaSelect.value)) {
    setAuthorizedStaff(true);
    shop.doors.find((door) => door.id === (areaSelect.value === 'staff' ? 'staff-door' : 'storage-door'))?.setOpen(true);
  }
  const destination = areaStops[areaSelect.value];
  if (!destination) return;
  firstPerson.moveTo(
    new THREE.Vector3(destination.x * shop.horizontalScale, PLAYER_HEIGHT, destination.z * shop.depthScale),
    new THREE.Vector3(destination.faceX * shop.horizontalScale, PLAYER_HEIGHT, destination.faceZ * shop.depthScale),
  );
  infoPanel.classList.add('is-hidden');
  showToast(`Moved to ${areaSelect.options[areaSelect.selectedIndex]?.text ?? 'selected area'}${autoAuthorized ? ' · demo staff access enabled' : ''}.`);
}

function resetPosition(): void {
  stopAutoTour();
  if (mode === 'overview') setMode('walkthrough', false);
  firstPerson.reset();
  infoPanel.classList.add('is-hidden');
  showToast('Position reset to the main entrance.');
}

enterButton.addEventListener('click', () => {
  showHud();
  setMode('walkthrough', true);
});

overviewButton.addEventListener('click', () => {
  showHud();
  setMode('overview');
});

modeButton.addEventListener('click', () => {
  if (mode === 'overview') {
    setMode('walkthrough', true);
  } else {
    setMode('overview');
  }
});

resetButton.addEventListener('click', resetPosition);
updateTourAudioButton();
tourAudioButton.addEventListener('click', () => {
  if (!tourAudioSupported) return;
  tourAudioEnabled = !tourAudioEnabled;
  updateTourAudioButton();
  const tour = autoTour;
  if (!tour) return;
  cancelTourSpeech(tour);
  if (tourAudioEnabled && autoTourStops[tour.index].label && tour.pauseRemaining > 0) {
    tour.narrationDeadline = performance.now() + 18000;
    speakTourNarration(tour);
  }
});
tourStopButton.addEventListener('click', () => {
  stopAutoTour();
  showToast('Auto Explore stopped · manual control restored.');
});
autoExploreButton.addEventListener('click', () => {
  if (autoTour) {
    stopAutoTour();
    showToast('Auto Explore stopped · manual control restored.');
  } else startAutoTour();
});
goAreaButton.addEventListener('click', goToSelectedArea);
areaSelect.addEventListener('change', goToSelectedArea);
floorplanButton.addEventListener('click', () => toggleFloorplan(true));
floorplanClose.addEventListener('click', () => toggleFloorplan(false));
floorplanPanel.addEventListener('click', (event) => {
  if (event.target === floorplanPanel) toggleFloorplan(false);
});
roofButton.addEventListener('click', () => {
  const nextVisible = !shop.isRoofVisible();
  shop.setRoofVisible(nextVisible);
  roofButton.innerHTML = nextVisible ? '<span>▱</span> Hide roof shell' : '<span>▱</span> Show roof shell';
  showToast(nextVisible ? 'Roof shell shown.' : 'Roof shell hidden for interior view.');
});
helpButton.addEventListener('click', () => toggleControlsCard());
controlsClose.addEventListener('click', () => toggleControlsCard(false));
infoClose.addEventListener('click', () => infoPanel.classList.add('is-hidden'));

overlayToggle.addEventListener('change', () => {
  const requested = overlayToggle.checked;
  stopAutoTour();
  securityOverlay.setEnabled(requested);
  overlayToggle.checked = requested;
  showToast(requested ? 'Security layer enabled.' : 'Security layer hidden.');
});

nightToggle.addEventListener('change', () => {
  lighting.setNight(nightToggle.checked);
  showToast(nightToggle.checked ? 'Night lighting enabled.' : 'Day lighting restored.');
});

staffToggle.addEventListener('change', () => {
  const requested = staffToggle.checked;
  stopAutoTour();
  setAuthorizedStaff(requested);
  showToast(authorizedStaff ? 'Staff RFID enabled · cashier gate opening.' : 'Visitor mode restored · staff gates secured.');
});

renderer.domElement.addEventListener('click', () => {
  if (autoTour) stopAutoTour();
  if (mode === 'walkthrough' && hud.classList.contains('is-hidden') === false && !firstPerson.isLocked()) {
    firstPerson.lock();
  }
});
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button === 0 && mode === 'walkthrough' && firstPerson.isLocked()) interact();
});

firstPerson.controls.addEventListener('lock', () => walkthroughHint.classList.add('is-hidden'));
firstPerson.controls.addEventListener('unlock', () => {
  if (mode === 'walkthrough' && !autoTour) walkthroughHint.classList.remove('is-hidden');
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  if (key === 'escape' && !floorplanPanel.classList.contains('is-hidden')) {
    toggleFloorplan(false);
    return;
  }
  if (key === 'p') {
    toggleFloorplan(floorplanPanel.classList.contains('is-hidden'));
    return;
  }
  if (key === 'escape' && autoTour) {
    stopAutoTour();
    return;
  }
  if (autoTour && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    stopAutoTour();
    return;
  }
  if (!floorplanPanel.classList.contains('is-hidden')) return;
  if (key === 'e') interact();
  if (key === 'f') {
    const enabled = securityOverlay.toggle();
    overlayToggle.checked = enabled;
    showToast(enabled ? 'Security layer enabled.' : 'Security layer hidden.');
  }
  if (key === 'l') {
    nightToggle.checked = !nightToggle.checked;
    lighting.setNight(nightToggle.checked);
    showToast(nightToggle.checked ? 'Night lighting enabled.' : 'Day lighting restored.');
  }
  if (key === 'o') setMode(mode === 'overview' ? 'walkthrough' : 'overview', mode === 'overview');
  if (key === 'r') resetPosition();
  if (key === '?') toggleControlsCard();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
});

setMode('walkthrough');
window.setTimeout(() => loadingIndicator.classList.add('is-hidden'), 450);

const clock = new THREE.Clock();
function animate(): void {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;
  lighting.update(delta);
  if (mode === 'walkthrough') {
    if (autoTour) updateAutoTour(delta);
    else {
      firstPerson.update(delta, shop.getColliders());
      updateInteractionPrompt();
    }
  } else {
    orbit.update();
  }
  if (!floorplanPanel.classList.contains('is-hidden')) updateFloorplanPlayer();
  shop.update(delta, elapsed);
  renderer.render(scene, camera);
}

animate();
