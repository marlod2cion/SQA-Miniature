export type SceneMode = 'walkthrough' | 'overview';

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  label?: string;
}

export interface InspectionInfo {
  name: string;
  location: string;
  purpose: string;
}

export type InteractableKind = 'door' | 'device' | 'seat';

export interface Interactable {
  id: string;
  kind: InteractableKind;
  position: { x: number; y: number; z: number };
  range: number;
  info: InspectionInfo;
}

export interface Door extends Interactable {
  kind: 'door';
  userData: {
    collider: Collider;
    promptOpen: string;
    promptClosed: string;
    restricted?: boolean;
  };
  open: boolean;
  progress: number;
  target: number;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  update: (delta: number) => void;
  isBlocking: () => boolean;
}

export interface Seat extends Interactable {
  kind: 'seat';
  tablePosition: { x: number; z: number };
}

export interface ChairPlacement {
  x: number;
  z: number;
  backX: -1 | 0 | 1;
  backZ: -1 | 0 | 1;
}

export const SHOP_WIDTH = 10;
export const SHOP_BASE_DEPTH = 6;
export const SHOP_DEPTH = 9.2;
export const SHOP_X_SCALE = SHOP_WIDTH / 10;
export const SHOP_Z_SCALE = SHOP_DEPTH / SHOP_BASE_DEPTH;
export const WALL_HEIGHT = 3;
export const FLOOR_TOP = 0;
export const PLAYER_HEIGHT = 1.65;
export const PLAYER_RADIUS = 0.25;

export const PLAYER_START = { x: 0, y: PLAYER_HEIGHT, z: -5.2 };
export const OVERVIEW_START = { x: 8.4, y: 11.4, z: 14.2 };

export const DINING_TABLE_SIZE = { width: 0.86, depth: 0.86 } as const;
export const DINING_CHAIR_OFFSET = 0.6;
export const CHAIR_SEAT_SIZE = 0.32;

// Two compact rows leave a central approach aisle and a clear cross-aisle to
// the emergency exit. These coordinates are also used by the SVG floor plan.
export const DINING_TABLES = [
  { x: 2.15, z: -1.9 },
  { x: 3.35, z: -1.9 },
  { x: 2.15, z: -0.3 },
  { x: 3.35, z: -0.3 },
] as const;

// An inverted-L waiting area sits opposite the dining tables, along the
// left storefront and left-hand wall.
// Chair backs point toward the nearest wall so all seats face into the shop.
export const WAITING_CHAIRS: readonly ChairPlacement[] = [
  { x: -3.95, z: -2.45, backX: 0, backZ: -1 },
  { x: -3.35, z: -2.45, backX: 0, backZ: -1 },
  { x: -2.75, z: -2.45, backX: 0, backZ: -1 },
  { x: -2.15, z: -2.45, backX: 0, backZ: -1 },
  { x: -4.55, z: -2.45, backX: -1, backZ: 0 },
  { x: -4.55, z: -1.8, backX: -1, backZ: 0 },
  { x: -4.55, z: -1.15, backX: -1, backZ: 0 },
  { x: -4.55, z: -0.5, backX: -1, backZ: 0 },
] as const;

export const ROOM_LABELS = [
  { label: 'COFFEE BAR / PREPARATION', x: -3.15, z: -0.65, rotation: 0 },
  { label: 'CASHIER / POS', x: -0.1, z: 0.75, rotation: 0 },
  { label: 'CUSTOMER DINING', x: 3.2, z: 1.05, rotation: 0 },
  { label: 'STORAGE', x: -3.75, z: 2.48, rotation: 0 },
  { label: 'STAFF ONLY', x: -1.25, z: 2.48, rotation: 0 },
  { label: 'RESTROOM', x: 1.9, z: 2.48, rotation: 0 },
];
