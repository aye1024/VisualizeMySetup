# Visualize My Setup

A demo for a first PC build. Enter a budget and what you want to play, and the page places a compatible set of parts on a 3D desk. A desk photo, if you add one, is the backdrop behind that desk.

This is not a store. Part links open an Amazon search for the product name. Prices in the catalog are demo prices. The scene scale is approximate and is not a measured fit of your room.

## Run it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints, usually `http://127.0.0.1:5173/`.

```bash
npm run check
npm run build
```

`check` typechecks the app and runs the catalog checks. `build` typechecks and writes the static site to `dist/`.

## What the demo does

- The home form takes a budget, a short description (games, resolution, case size, noise, look), and an optional desk photo.
- The photo stays in this browser only. A copied link does not include it.
- The build page picks a known-good list that fits the budget and the description, then checks socket, memory, case clearance, cooler height, and power supply headroom.
- Click a part for its name, price, and a search link. Swap it for another compatible part from the curated catalog.
- Drag a part across the desk. **Default view** puts the camera and the parts back.
- The default monitor, case, keyboard, mouse, and headset are meshes made from their Amazon listing photos. Other catalog parts use simple stand-ins at the catalog millimeter sizes.

The shareable URL carries the budget, description, variant, case size, noise, look, and any swaps.
