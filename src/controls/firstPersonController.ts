import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Collider, PLAYER_HEIGHT, PLAYER_RADIUS, PLAYER_START } from '../data/layout';

export class FirstPersonController {
  public readonly controls: PointerLockControls;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly keys = new Set<string>();
  private readonly position = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly movement = new THREE.Vector3();
  private enabled = true;
  private sprinting = false;
  private seatReturn: { position: THREE.Vector3; rotation: THREE.Quaternion } | null = null;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.reset();
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || !this.controls.isLocked || this.isTextEntry(event.target)) return;
    const key = event.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      this.keys.add(key);
      event.preventDefault();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    this.keys.delete(key);
  };

  private isTextEntry(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
  }

  public update(delta: number, colliders: Collider[]): void {
    if (!this.enabled || this.seatReturn) return;
    const moveForward = (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0)
      - (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0);
    const moveRight = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0)
      - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    if (moveForward === 0 && moveRight === 0) return;

    this.sprinting = this.keys.has('shift');
    const speed = this.sprinting ? 3.75 : 2.3;
    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    // Camera-right is the camera forward direction crossed with world-up.
    this.right.crossVectors(this.forward, this.camera.up).normalize();
    this.movement
      .set(0, 0, 0)
      .addScaledVector(this.forward, moveForward)
      .addScaledVector(this.right, moveRight)
      .normalize()
      .multiplyScalar(speed * Math.min(delta, 0.05));

    this.position.copy(this.camera.position);
    const nextX = this.position.x + this.movement.x;
    const nextZ = this.position.z + this.movement.z;
    if (!this.collides(nextX, this.position.z, colliders)) this.position.x = nextX;
    if (!this.collides(this.position.x, nextZ, colliders)) this.position.z = nextZ;
    this.position.y = PLAYER_HEIGHT;
    this.camera.position.copy(this.position);
  }

  private collides(x: number, z: number, colliders: Collider[]): boolean {
    return colliders.some((collider) => {
      const closestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
      const closestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
      const dx = x - closestX;
      const dz = z - closestZ;
      return dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS;
    });
  }

  public reset(): void {
    this.seatReturn = null;
    this.camera.position.set(PLAYER_START.x, PLAYER_START.y, PLAYER_START.z);
    this.camera.lookAt(0, PLAYER_HEIGHT, -1.8);
    this.position.copy(this.camera.position);
  }

  public moveTo(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.seatReturn = null;
    this.camera.position.copy(position);
    this.camera.lookAt(lookAt);
    this.position.copy(position);
    this.keys.clear();
  }

  public getPosition(): THREE.Vector3 {
    return this.camera.position;
  }

  public sitAt(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    if (this.seatReturn) return;
    this.seatReturn = { position: this.camera.position.clone(), rotation: this.camera.quaternion.clone() };
    this.keys.clear();
    this.camera.position.copy(position);
    this.camera.lookAt(lookAt);
    this.position.copy(this.camera.position);
  }

  public standUp(): void {
    if (!this.seatReturn) return;
    this.camera.position.copy(this.seatReturn.position);
    this.camera.quaternion.copy(this.seatReturn.rotation);
    this.position.copy(this.camera.position);
    this.seatReturn = null;
    this.keys.clear();
  }

  public isSeated(): boolean {
    return this.seatReturn !== null;
  }

  public lock(): void {
    this.controls.lock();
  }

  public unlock(): void {
    this.controls.unlock();
  }

  public isLocked(): boolean {
    return this.controls.isLocked;
  }
}
