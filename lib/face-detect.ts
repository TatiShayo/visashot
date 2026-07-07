/**
 * Client-side face detection via MediaPipe FaceLandmarker (@mediapipe/tasks-vision).
 * Runs entirely in the browser — no photo bytes leave the device for detection.
 *
 * Landmark indices are the standard 468-point face mesh:
 *   10  = forehead top (hairline-adjacent point used as the "top of face" anchor)
 *   152 = chin bottom
 *   33 / 263 = left/right eye outer corners (used for eye-line + face center)
 *   1   = nose tip (used for a cheap tilt/roll sanity check)
 * Blendshapes (if the model provides them) give eye-blink and smile scores
 * directly; we fall back to landmark geometry heuristics when blendshapes are
 * unavailable (some browsers/GPU configs skip them).
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "IMAGE",
        numFaces: 2, // detect up to 2 so we can flag "more than one face"
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    })();
  }
  return landmarkerPromise;
}

export interface DetectedFace {
  faceCount: number;
  /** Normalized (0..1) landmark points needed by lib/crop.ts. */
  points: {
    foreheadTopY: number;
    chinY: number;
    leftEyeY: number;
    rightEyeY: number;
    leftEyeX: number;
    rightEyeX: number;
  } | null;
  faceTiltDeg: number;
  leftEyeClosed: number;
  rightEyeClosed: number;
  smileScore: number;
  /** Live feedback hint for the alignment ring UI. */
  hint: "none" | "move_closer" | "face_straight" | "center" | "good";
}

const IDX = {
  foreheadTop: 10,
  chin: 152,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  leftEyeInner: 133,
  rightEyeInner: 362,
};

function blendshapeScore(result: FaceLandmarkerResult, faceIdx: number, names: string[]): number | null {
  const shapes = result.faceBlendshapes?.[faceIdx]?.categories;
  if (!shapes) return null;
  let sum = 0;
  let found = false;
  for (const n of names) {
    const c = shapes.find((s) => s.categoryName === n);
    if (c) {
      sum += c.score;
      found = true;
    }
  }
  return found ? sum / names.length : null;
}

export async function detectFace(image: HTMLImageElement | HTMLVideoElement): Promise<DetectedFace> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(image);

  const faceCount = result.faceLandmarks?.length ?? 0;
  if (faceCount === 0) {
    return {
      faceCount: 0,
      points: null,
      faceTiltDeg: 0,
      leftEyeClosed: 0,
      rightEyeClosed: 0,
      smileScore: 0,
      hint: "none",
    };
  }

  const lm = result.faceLandmarks[0];
  const leftEyeOuter = lm[IDX.leftEyeOuter];
  const rightEyeOuter = lm[IDX.rightEyeOuter];
  const leftEyeInner = lm[IDX.leftEyeInner];
  const rightEyeInner = lm[IDX.rightEyeInner];
  const forehead = lm[IDX.foreheadTop];
  const chin = lm[IDX.chin];

  const leftEyeY = (leftEyeOuter.y + leftEyeInner.y) / 2;
  const rightEyeY = (rightEyeOuter.y + rightEyeInner.y) / 2;
  const leftEyeX = (leftEyeOuter.x + leftEyeInner.x) / 2;
  const rightEyeX = (rightEyeOuter.x + rightEyeInner.x) / 2;

  // Roll angle from the eye line (screen-space; x/y already normalized 0..1
  // aspect-relative, close enough for a coarse tilt check).
  const dy = rightEyeY - leftEyeY;
  const dx = rightEyeX - leftEyeX;
  const faceTiltDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  const eyeBlinkLeft = blendshapeScore(result, 0, ["eyeBlinkLeft"]);
  const eyeBlinkRight = blendshapeScore(result, 0, ["eyeBlinkRight"]);
  const smile = blendshapeScore(result, 0, ["mouthSmileLeft", "mouthSmileRight"]);

  const headHeightNorm = chin.y - forehead.y;

  let hint: DetectedFace["hint"] = "good";
  if (faceCount > 1) hint = "none";
  else if (headHeightNorm < 0.28) hint = "move_closer";
  else if (Math.abs(faceTiltDeg) > 8) hint = "face_straight";
  else if (Math.abs((leftEyeX + rightEyeX) / 2 - 0.5) > 0.15) hint = "center";

  return {
    faceCount,
    points: {
      foreheadTopY: forehead.y,
      chinY: chin.y,
      leftEyeY,
      rightEyeY,
      leftEyeX,
      rightEyeX,
    },
    faceTiltDeg,
    leftEyeClosed: eyeBlinkLeft ?? 0,
    rightEyeClosed: eyeBlinkRight ?? 0,
    smileScore: smile ?? 0,
    hint,
  };
}
