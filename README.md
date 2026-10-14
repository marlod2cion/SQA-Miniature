# BrewGuard — 3D Physical Security Miniature

BrewGuard is a self-contained browser-based 3D digital twin of a small coffee shop physical-security miniature. It is designed for a school presentation: enter the shop from the main entrance, walk through the public and back-of-house areas, inspect physical security devices, and switch to an elevated miniature view.

The implementation follows the written BrewGuard specification. The supplied concept image is retained at `public/reference/brewguard_3d_reference.png` as a visual reference; the scene itself uses lightweight procedural geometry so it runs without paid or remote assets.

## Technology

- Vite
- TypeScript
- Three.js
- `PointerLockControls` for walkthrough mode
- `OrbitControls` for overview / miniature mode
- Native HTML and CSS for the presentation overlay

There is no backend, database, login system, dashboard, or external API.

## Install and run

After cloning the repository, run these commands from the project directory:

```bash
npm ci
npm run dev
```

`npm ci` installs the exact dependency versions recorded in `package-lock.json`, so everyone in the group uses the same versions. Keep `package-lock.json` committed to Git.

Open the local URL printed by Vite, normally `http://localhost:5173`.

After pulling updates, run `npm ci` again only if `package.json` or `package-lock.json` changed, or if `node_modules` is missing. Otherwise, just run `npm run dev`.

`npm install` also works for setup. To add a new dependency, use `npm install <package-name>` and commit both `package.json` and `package-lock.json`.

To verify the production bundle:

```bash
npm run build
npm run preview
```

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` or arrow keys | Move through the shop |
| Mouse | Look around after pointer lock |
| `Shift` | Move faster |
| `E` or left-click | Interact with the nearest door, security device, or café station |
| `F` | Toggle labels, CCTV coverage cones, and restricted-area helpers |
| `L` | Toggle day / night lighting |
| `O` | Switch between Walkthrough and Overview |
| `R` | Reset to the main entrance |
| `Esc` | Release the pointer |

In Overview mode, drag to orbit, right-drag to pan, and scroll to zoom. The presentation dock also exposes overlay, lighting, staff-demo, reset, overview, and roof-shell controls. Use **Explore an area** to move directly to the entrance, coffee bar, cashier, dining area, storage room, staff door, restroom, or emergency exit route.

**Auto Explore** guides the camera through the public area, restroom, staff doorway, storage doorway, and emergency exit. Each area has spoken English narration and matching on-screen subtitles; the tour waits for each explanation before moving on. The audio can be muted while subtitles stay visible. Narration uses the browser's speech synthesis, so available voices depend on the browser and operating system. The tour temporarily enables the security overlay and Authorized Staff Demo, opens the doors needed for the tour, and restores the previous settings when it finishes or is stopped. Choosing a staff or storage area from **Explore an area** also enables Authorized Staff Demo automatically.

Walk up to the espresso station and press `E` to show a short steam effect. At the POS, press `E` to place a presentation-only coffee-and-pastry demo order. The staff room stays behind its RFID door until **Authorized staff demo** is enabled.

## Coffee-shop areas

The 10 m × 8.4 m miniature is expanded front-to-back and contains:

- Main entrance with double glass doors and entrance mat
- Wide storefront with large front windows, a visible shop sign, a paved apron, and planted frontage
- Coffee bar / preparation area with espresso equipment, sink, cups, and cabinets
- Cashier / POS with monitor, card terminal, and pastry display
- Customer dining area with four two-seat tables, an inverted-L waiting-chair area opposite the tables on the left, and a clear marked aisle to the emergency exit
- Storage room with shelves, boxes, and a motion sensor
- Staff-only room with desk, lockers, and RFID reader
- Restroom with toilet, sink, and door
- Back-right emergency exit with contact sensor and illuminated `EXIT` sign

## Physical security represented

- CCTV 1 — Main Entrance
- CCTV 2 — Dining Area
- CCTV 3 — Cashier / POS
- CCTV 4 — Storage / Staff Area
- Panic button and presentation-only alarm/siren demo
- Smoke detector
- Fire extinguisher
- Motion sensor
- Main entrance and emergency-exit door contact sensors
- Staff-only RFID access point with Authorized Staff Demo mode
- Entrance security lighting that becomes prominent in Night mode
- Emergency exit signage

The scene includes simple collision handling for exterior and interior walls, counters, shelving, tables, fixtures, and closed doors. Staff access is a presentation demonstration only; it does not authenticate a real user or trigger a real emergency service.

## Project structure

```text
src/
  main.ts                         UI wiring, scene loop, interactions
  style.css                       Native presentation overlay
  data/layout.ts                  Dimensions, modes, collision/device types
  controls/firstPersonController.ts
                                  Pointer lock, WASD movement, collision checks
  scene/createCoffeeShop.ts       Procedural building, furniture, devices
  scene/primitives.ts             Reusable geometry, labels, palette helpers
  scene/lighting.ts               Day/night lighting rig
  systems/securityOverlay.ts      Coverage/label visibility state
public/reference/                 Supplied concept reference image
```

## Adding 3D assets later

The procedural objects are intentionally grouped by responsibility so GLTF/GLB assets can be introduced later without changing the app architecture. Add an asset under `public/`, load it with `GLTFLoader` in `src/scene/createCoffeeShop.ts`, and keep its root object positioned in the same 1 unit = 1 metre coordinate system. Preserve the existing low-poly procedural fallback so the presentation still works if an optional asset is unavailable.

## Remaining limitations

The model is an educational visualization rather than a construction drawing. It uses approximate dimensions, lightweight collision rectangles, and presentation-only security behavior. Browser pointer-lock permissions and performance can vary slightly by browser and device.
