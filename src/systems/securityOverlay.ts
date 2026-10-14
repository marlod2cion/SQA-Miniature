import * as THREE from 'three';

export class SecurityOverlay {
  private readonly group: THREE.Group;
  private enabled = false;

  constructor(group: THREE.Group) {
    this.group = group;
    this.group.visible = false;
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.group.visible = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }
}
