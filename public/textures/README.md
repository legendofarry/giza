Place high-resolution (4k) textures here for best visual fidelity.

Expected filenames (used by SavannaMapBuilder):

- `grass_4k.jpg` — tiled grass/ground color texture (albedo)
- `soil_4k.jpg` — optional dirt/soil
- `rock_4k.jpg` — rock albedo
- `tree_bark_4k.jpg` — trunk bark albedo
- `leaf_4k.jpg` — leaf/albedo for tree crowns

Tips:
- Use power-of-two textures (4096x4096) for best GPU performance.
- Compress or optimize textures (KTX2/Basis) for fast loads in production.
- If textures are missing the code will fall back to colored materials so the scene still renders.

Recommended free sources:
- Poly Haven (https://polyhaven.com)
- CC0 textures or public domain assets

After adding textures, restart the dev server if necessary to ensure Vite serves the new files.