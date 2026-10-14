import * as THREE from 'three';

export interface MaterialPalette {
  floor: THREE.MeshStandardMaterial;
  floorAlt: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  wallTrim: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  counter: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  green: THREE.MeshStandardMaterial;
  pot: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
  blue: THREE.MeshStandardMaterial;
  cyan: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  tile: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
}

export function createPalette(): MaterialPalette {
  return {
    floor: new THREE.MeshStandardMaterial({ color: 0x8f5f3d, roughness: 0.8 }),
    floorAlt: new THREE.MeshStandardMaterial({ color: 0xa87349, roughness: 0.82 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xd8d0c4, roughness: 0.9 }),
    wallTrim: new THREE.MeshStandardMaterial({ color: 0x8b8378, roughness: 0.72 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4028, roughness: 0.78 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x382319, roughness: 0.75 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.5, metalness: 0.18 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8c9697, roughness: 0.33, metalness: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x86c9dc,
      transparent: true,
      opacity: 0.2,
      roughness: 0.05,
      metalness: 0.05,
      transmission: 0.2,
      side: THREE.DoubleSide,
    }),
    green: new THREE.MeshStandardMaterial({ color: 0x2d6b45, roughness: 0.92 }),
    pot: new THREE.MeshStandardMaterial({ color: 0x3c3127, roughness: 0.88 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb62924, roughness: 0.52, metalness: 0.08 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x103552, roughness: 0.56, metalness: 0.18 }),
    cyan: new THREE.MeshStandardMaterial({
      color: 0x5be4ff,
      emissive: 0x0e95b5,
      emissiveIntensity: 1.5,
      roughness: 0.35,
    }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.55 }),
    black: new THREE.MeshStandardMaterial({ color: 0x12171a, roughness: 0.6 }),
    tile: new THREE.MeshStandardMaterial({ color: 0xc9c2b8, roughness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb99158, roughness: 0.38, metalness: 0.7 }),
  };
}

export function addBox(
  parent: THREE.Object3D,
  size: THREE.Vector3 | [number, number, number],
  position: THREE.Vector3 | [number, number, number],
  material: THREE.Material | THREE.Material[],
  options: { castShadow?: boolean; receiveShadow?: boolean; name?: string } = {},
): THREE.Mesh<THREE.BoxGeometry, THREE.Material | THREE.Material[]> {
  const dimensions: [number, number, number] = Array.isArray(size) ? size : [size.x, size.y, size.z];
  const location: [number, number, number] = Array.isArray(position) ? position : [position.x, position.y, position.z];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.position.set(...location);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.name) mesh.name = options.name;
  parent.add(mesh);
  return mesh;
}

export function addCylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  position: THREE.Vector3 | [number, number, number],
  material: THREE.Material,
  radialSegments = 16,
): THREE.Mesh<THREE.CylinderGeometry, THREE.Material> {
  const location: [number, number, number] = Array.isArray(position) ? position : [position.x, position.y, position.z];
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radialSegments), material);
  mesh.position.set(...location);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addSphere(
  parent: THREE.Object3D,
  radius: number,
  position: THREE.Vector3 | [number, number, number],
  material: THREE.Material,
  widthSegments = 16,
  heightSegments = 10,
): THREE.Mesh<THREE.SphereGeometry, THREE.Material> {
  const location: [number, number, number] = Array.isArray(position) ? position : [position.x, position.y, position.z];
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, widthSegments, heightSegments), material);
  mesh.position.set(...location);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addRoundedBar(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  position: [number, number, number],
  material: THREE.Material,
): THREE.Mesh {
  const mesh = addBox(parent, [width, height, depth], position, material);
  mesh.geometry.translate(0, 0, 0);
  return mesh;
}

export function createLabelSprite(
  text: string,
  options: {
    color?: string;
    background?: string;
    border?: string;
    fontSize?: number;
    width?: number;
    opacity?: number;
    padding?: number;
  } = {},
): THREE.Sprite {
  const labelWorldScale = 0.68;
  const lines = text.split('\n');
  const fontSize = options.fontSize ?? 34;
  const padding = options.padding ?? 22;
  const font = `600 ${fontSize}px Arial, sans-serif`;
  const canvas = document.createElement('canvas');
  const measureContext = canvas.getContext('2d');
  if (!measureContext) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
  }
  measureContext.font = font;
  const measuredWidth = Math.max(...lines.map((line) => measureContext.measureText(line).width), 120);
  canvas.width = Math.ceil(measuredWidth + padding * 2);
  canvas.height = Math.ceil(fontSize * 1.35 * lines.length + padding * 2);

  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
  }
  context.font = font;
  context.textBaseline = 'middle';
  context.fillStyle = options.background ?? 'rgba(7, 31, 48, 0.92)';
  context.strokeStyle = options.border ?? 'rgba(88, 218, 255, 0.9)';
  context.lineWidth = 4;
  const radius = 14;
  roundRect(context, 2, 2, canvas.width - 4, canvas.height - 4, radius);
  context.fill();
  context.stroke();
  context.fillStyle = options.color ?? '#e8f7fb';
  lines.forEach((line, index) => {
    context.fillText(line, padding, padding + fontSize * 0.68 + index * fontSize * 1.35);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: options.opacity ?? 1,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const width = (options.width ?? Math.max(0.65, canvas.width / 420)) * labelWorldScale;
  const height = width * (canvas.height / canvas.width);
  sprite.scale.set(width, height, 1);
  return sprite;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export function addLabel(
  parent: THREE.Object3D,
  text: string,
  position: [number, number, number],
  options: Parameters<typeof createLabelSprite>[1] = {},
): THREE.Sprite {
  const sprite = createLabelSprite(text, options);
  sprite.position.set(...position);
  parent.add(sprite);
  return sprite;
}

export function makePlant(parent: THREE.Object3D, position: [number, number, number], palette: MaterialPalette, scale = 1): void {
  const group = new THREE.Group();
  group.position.set(...position);
  group.scale.setScalar(scale);
  parent.add(group);
  addCylinder(group, 0.16, 0.25, [0, 0.125, 0], palette.pot, 14);
  addSphere(group, 0.2, [0, 0.44, 0], palette.green, 12, 8);
  for (let index = 0; index < 5; index += 1) {
    const leaf = addSphere(group, 0.11, [Math.cos(index * 1.25) * 0.15, 0.5 + (index % 2) * 0.1, Math.sin(index * 1.25) * 0.15], palette.green, 10, 7);
    leaf.scale.set(0.55, 1.35, 0.55);
    leaf.rotation.z = (index - 2) * 0.18;
  }
}

export function setGroupVisibility(group: THREE.Group, visible: boolean): void {
  group.visible = visible;
}
