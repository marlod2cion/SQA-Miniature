import * as THREE from 'three';
import { SHOP_Z_SCALE } from '../data/layout';

export class LightingRig {
  private readonly scene: THREE.Scene;
  private readonly ambient: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly windowGlow: THREE.PointLight;
  private readonly interiorLights: THREE.PointLight[] = [];
  private readonly securityLights: THREE.PointLight[] = [];
  private readonly dayBackground = new THREE.Color(0x9eb9c7);
  private readonly nightBackground = new THREE.Color(0x07131d);
  private readonly currentBackground = new THREE.Color(0x9eb9c7);
  private nightTarget = 0;
  private nightAmount = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ambient = new THREE.HemisphereLight(0xd7e7ec, 0x4c3425, 1.6);
    this.ambient.position.set(0, 8, 0);
    scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff3d5, 2.3);
    this.sun.position.set(-4, 9, -6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 25;
    this.sun.shadow.camera.left = -9;
    this.sun.shadow.camera.right = 9;
    this.sun.shadow.camera.top = 9;
    this.sun.shadow.camera.bottom = -9;
    scene.add(this.sun);

    this.windowGlow = new THREE.PointLight(0xb9e7ff, 1.1, 10, 2);
    this.windowGlow.position.set(0, 2.5, -2.6 * SHOP_Z_SCALE);
    scene.add(this.windowGlow);

    this.createInteriorLight(-2.5, 2.65, -0.8 * SHOP_Z_SCALE, 1.7);
    this.createInteriorLight(0.3, 2.65, -0.6 * SHOP_Z_SCALE, 1.45);
    this.createInteriorLight(3.1, 2.65, -0.8 * SHOP_Z_SCALE, 1.65);
    this.createInteriorLight(-3.7, 2.7, 2.2 * SHOP_Z_SCALE, 1.25);
    this.createInteriorLight(-1.3, 2.7, 2.2 * SHOP_Z_SCALE, 1.25);
    this.createInteriorLight(1.0, 2.7, 2.2 * SHOP_Z_SCALE, 1.15);

    this.createSecurityLight(-1.45, -3.35 * SHOP_Z_SCALE);
    this.createSecurityLight(1.45, -3.35 * SHOP_Z_SCALE);
  }

  private createInteriorLight(x: number, y: number, z: number, intensity: number): void {
    const light = new THREE.PointLight(0xffc982, intensity, 5.5, 2);
    light.position.set(x, y, z);
    light.userData.dayIntensity = intensity;
    light.castShadow = false;
    this.interiorLights.push(light);
    this.scene.add(light);
  }

  private createSecurityLight(x: number, z: number): void {
    const light = new THREE.PointLight(0x8edfff, 0.6, 4.5, 2);
    light.position.set(x, 2.45, z);
    light.castShadow = false;
    this.securityLights.push(light);
    this.scene.add(light);
  }

  public getSecurityLights(): THREE.PointLight[] {
    return this.securityLights;
  }

  public setNight(enabled: boolean): void {
    this.nightTarget = enabled ? 1 : 0;
  }

  public isNight(): boolean {
    return this.nightTarget === 1;
  }

  public update(delta: number): void {
    const easing = Math.min(1, delta * 3.3);
    this.nightAmount = THREE.MathUtils.lerp(this.nightAmount, this.nightTarget, easing);
    this.sun.intensity = THREE.MathUtils.lerp(2.3, 0.2, this.nightAmount);
    this.ambient.intensity = THREE.MathUtils.lerp(1.6, 0.34, this.nightAmount);
    this.windowGlow.intensity = THREE.MathUtils.lerp(1.1, 0.12, this.nightAmount);
    this.interiorLights.forEach((light) => {
      light.intensity = THREE.MathUtils.lerp(light.userData.dayIntensity ?? light.intensity, 2.1, this.nightAmount);
    });
    this.securityLights.forEach((light) => {
      light.intensity = THREE.MathUtils.lerp(0.6, 3.6, this.nightAmount);
      light.color.set(this.nightAmount > 0.55 ? 0xffd28b : 0x8edfff);
    });

    this.currentBackground.copy(this.dayBackground).lerp(this.nightBackground, this.nightAmount);
    this.scene.background = this.currentBackground;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(this.currentBackground);
      this.scene.fog.near = THREE.MathUtils.lerp(19, 12, this.nightAmount);
      this.scene.fog.far = THREE.MathUtils.lerp(42, 27, this.nightAmount);
    }
  }
}
