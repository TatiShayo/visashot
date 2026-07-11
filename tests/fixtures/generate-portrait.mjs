/**
 * Generates tests/fixtures/portrait.jpg — a small, deterministic, synthetic
 * "portrait" used by the Playwright e2e specs.
 *
 * Why synthetic instead of a real photo: the app's client-side face detection
 * (lib/face-detect.ts, MediaPipe FaceLandmarker) is a genuine ML model loaded
 * from a CDN that requires a real face and network access to score reliably —
 * neither is guaranteed in a sandboxed/offline CI run. The e2e suite sets
 * NEXT_PUBLIC_E2E_FAKE_FACE=true (see playwright.config.ts) which makes
 * lib/face-detect.ts return a deterministic "good" detection instead of
 * calling MediaPipe, so this fixture only needs to be a valid, reasonably
 * sized JPEG that clears lib/image-ingest.ts's checks — its pixel content is
 * not what's under test. It's still drawn as a rough head/shoulders portrait
 * (light background, oval head, simple features, contrasting top) for
 * readability if a human ever opens it.
 *
 * Regenerate with: node tests/fixtures/generate-portrait.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WIDTH = 900;
const HEIGHT = 1200;

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#e8e2d8"/>
  <!-- shoulders / top (contrasting navy so clothing-contrast check passes cleanly) -->
  <path d="M 150 1050 Q 450 880 750 1050 L 750 1200 L 150 1200 Z" fill="#1b2a4a"/>
  <!-- neck -->
  <rect x="400" y="820" width="100" height="140" fill="#d8ab84"/>
  <!-- head -->
  <ellipse cx="450" cy="620" rx="200" ry="260" fill="#e3b895"/>
  <!-- hair -->
  <path d="M 250 560 Q 260 320 450 320 Q 640 320 650 560 Q 650 420 450 400 Q 250 420 250 560 Z" fill="#3a2a1e"/>
  <!-- eyes -->
  <ellipse cx="370" cy="600" rx="22" ry="12" fill="#2a2018"/>
  <ellipse cx="530" cy="600" rx="22" ry="12" fill="#2a2018"/>
  <!-- eyebrows -->
  <rect x="340" y="565" width="60" height="8" rx="4" fill="#3a2a1e"/>
  <rect x="500" y="565" width="60" height="8" rx="4" fill="#3a2a1e"/>
  <!-- nose -->
  <path d="M 450 610 L 435 690 Q 450 705 465 690 Z" fill="#c9a17d"/>
  <!-- mouth (neutral, closed) -->
  <rect x="400" y="740" width="100" height="10" rx="5" fill="#8a4a4a"/>
</svg>`;

const buf = Buffer.from(svg);

const outPath = path.join(__dirname, "portrait.jpg");

await sharp(buf).jpeg({ quality: 90 }).toFile(outPath);

console.log(`Wrote ${outPath}`);
