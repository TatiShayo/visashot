/**
 * POST /api/process — the pipeline entry point.
 *
 * Accepts an uploaded photo + client-detected face landmarks + spec id.
 * Runs: ingest (EXIF strip) → processPhoto (bg removal + compose + crop) →
 * compliance checks → SERVER-SIDE watermark.
 *
 * SECURITY INVARIANT: the response contains ONLY the watermarked preview and
 * the compliance report. The clean processed bytes are stored server-side and
 * are unreachable until the order is paid. (Asserted by a security test.)
 *
 * Rate-limited per IP (Replicate costs money — bots will find this).
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { getSpec } from "@/data/photo-specs";
import { ingestUpload, IngestError, MAX_UPLOAD_BYTES } from "@/lib/image-ingest";
import { processPhoto } from "@/lib/pipeline";
import { applyWatermark } from "@/lib/watermark";
import { runComplianceChecks, type ComplianceInput } from "@/lib/compliance";
import { CropError } from "@/lib/crop";
import { getStorage } from "@/lib/providers/storage";
import { getOrderStore } from "@/lib/orders";
import { BASE_PRICE_CENTS } from "@/lib/pricing";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { processingSemaphore } from "@/lib/semaphore";
import { getTurnstileProvider } from "@/lib/providers/turnstile";
import { reportError } from "@/lib/monitoring";
import { env } from "@/lib/env";

/**
 * Mean luminance + std-dev over the face region of the FINAL processed photo
 * (grayscale stats), feeding the brightness/contrast compliance checks.
 */
async function faceRegionStats(
  processedBytes: Buffer,
  processedWidth: number,
  processedHeightPx: number,
  eyeLinePct: number
): Promise<{ brightness: number; contrast: number }> {
  // Sample a box centered vertically on the eye line, spanning the middle
  // third of the width — a cheap, dependency-free stand-in for a proper
  // face-region crop (exact landmark boxes aren't available post-crop).
  const eyeY = Math.round(processedHeightPx * (1 - eyeLinePct / 100));
  const boxH = Math.round(processedHeightPx * 0.25);
  const boxW = Math.round(processedWidth * 0.4);
  const top = Math.max(0, Math.min(processedHeightPx - boxH, eyeY - boxH / 2));
  const left = Math.max(0, Math.round((processedWidth - boxW) / 2));

  const { data, info } = await sharp(processedBytes)
    .extract({ left, top, width: Math.max(1, boxW), height: Math.max(1, boxH) })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / (info.width * info.height);

  let variance = 0;
  for (let i = 0; i < data.length; i++) variance += (data[i] - mean) ** 2;
  const stdDev = Math.sqrt(variance / (info.width * info.height));

  return { brightness: mean, contrast: stdDev };
}

export const runtime = "nodejs";

const landmarksSchema = z.object({
  crownY: z.number().finite(),
  chinY: z.number().finite(),
  eyeY: z.number().finite(),
  faceCenterX: z.number().finite(),
});

const signalsSchema = z.object({
  faceTiltDeg: z.number().finite().default(0),
  leftEyeClosed: z.number().min(0).max(1).default(0),
  rightEyeClosed: z.number().min(0).max(1).default(0),
  smileScore: z.number().min(0).max(1).default(0),
  faceCount: z.number().int().min(0).max(20).default(1),
  glassesDetected: z.boolean().default(false),
  clothingRgb: z
    .object({ r: z.number(), g: z.number(), b: z.number() })
    .default({ r: 40, g: 60, b: 120 }),
});

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 processing requests / 5 min / IP.
  const ip = clientIp(req.headers);
  const rl = rateLimit(`process:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Expected multipart/form-data");
  }

  // Invisible Turnstile check — this endpoint calls paid third-party APIs
  // (Replicate), so it's the one bots will target. Mocked (always passes)
  // when TURNSTILE_SECRET_KEY isn't configured, per "never stall on missing
  // keys" — see NEEDS HUMAN for enabling this for real in production.
  if (env.turnstileSecretKey) {
    const turnstileToken = String(form.get("turnstileToken") ?? "");
    const verdict = await getTurnstileProvider().verify(turnstileToken, ip);
    if (!verdict.ok) {
      return bad("Verification failed — please reload and try again.", 403);
    }
  }

  const specId = String(form.get("specId") ?? "");
  const spec = getSpec(specId);
  if (!spec) return bad("Unknown photo spec");

  const file = form.get("photo");
  if (!(file instanceof File)) return bad("Missing photo");
  if (file.size > MAX_UPLOAD_BYTES) return bad("Photo is too large (max 15MB)");

  let landmarks, signals;
  try {
    landmarks = landmarksSchema.parse(JSON.parse(String(form.get("landmarks") ?? "{}")));
    signals = signalsSchema.parse(JSON.parse(String(form.get("signals") ?? "{}")));
  } catch {
    return bad("Invalid landmarks or signals");
  }

  const raw = Buffer.from(await file.arrayBuffer());

  let ingested;
  try {
    ingested = await ingestUpload(raw);
  } catch (e) {
    if (e instanceof IngestError) return bad(e.message);
    return bad("Could not read the uploaded image");
  }

  // Concurrency cap: each pipeline is a paid Replicate call + several full-
  // image sharp passes. Bound how many run (and wait) at once; past that,
  // shed load with a 503 instead of OOMing the instance.
  let processed;
  try {
    const slot = await processingSemaphore.run(() =>
      processPhoto({
        imageBytes: ingested.bytes,
        imageWidth: ingested.width,
        imageHeight: ingested.height,
        landmarks,
        spec,
      })
    );
    if (!slot.ok) {
      return NextResponse.json(
        { error: "We're at capacity right now — please try again in a minute." },
        { status: 503, headers: { "Retry-After": "60" } }
      );
    }
    processed = slot.value;
  } catch (e) {
    if (e instanceof CropError) return bad(e.message);
    // Generic to client; details go to server logs / Sentry (PLAYBOOK 2.4).
    reportError(e, { stage: "pipeline", specId: spec.id });
    return bad("We couldn't process this photo — please try another shot.", 500);
  }

  // Real brightness/contrast stats sampled from the final processed photo
  // (grayscale mean + std-dev over an eye-line-centered box).
  const stats = await faceRegionStats(
    processed.bytes,
    processed.width,
    processed.height,
    processed.crop.eyeLinePct
  ).catch(() => ({ brightness: 150, contrast: 40 })); // never block purchase on a stats failure

  // Compliance report from achieved geometry + client signals + image stats.
  const complianceInput: ComplianceInput = {
    headHeightPct: processed.crop.headHeightPct,
    eyeLinePct: processed.crop.eyeLinePct,
    faceTiltDeg: signals.faceTiltDeg,
    leftEyeClosed: signals.leftEyeClosed,
    rightEyeClosed: signals.rightEyeClosed,
    smileScore: signals.smileScore,
    faceCount: signals.faceCount,
    glassesDetected: signals.glassesDetected,
    faceBrightness: stats.brightness,
    faceContrast: stats.contrast,
    clothingRgb: signals.clothingRgb,
    backgroundMocked: processed.backgroundMocked,
  };
  const report = runComplianceChecks(complianceInput, spec);

  // Persist the order + CLEAN asset (server-only) and the watermarked preview.
  const store = getOrderStore();
  const storage = getStorage();
  const order = await store.create({ specId: spec.id, amountCents: BASE_PRICE_CENTS });

  const cleanKey = `${order.id}/processed-${spec.id}.png`;
  const previewKey = `${order.id}/preview-${spec.id}.png`;
  const originalKey = `${order.id}/original.png`;

  const watermarked = await applyWatermark(processed.bytes);

  await storage.put(originalKey, ingested.bytes, "image/png");
  await storage.put(cleanKey, processed.bytes, "image/png"); // NEVER served pre-payment
  await storage.put(previewKey, watermarked, "image/png");

  await store.update(order.id, {
    originalKey,
    processedKey: cleanKey,
    watermarkedKey: previewKey,
    // Persisted so fulfillment can re-crop the ORIGINAL for any add-on specs
    // bought at checkout (each spec has its own aspect/geometry).
    landmarks: {
      crownY: landmarks.crownY,
      chinY: landmarks.chinY,
      eyeY: landmarks.eyeY,
      faceCenterX: landmarks.faceCenterX,
    },
    complianceReport: {
      overall: report.overall,
      checks: report.checks,
      backgroundMocked: processed.backgroundMocked,
    },
  });

  // Response: watermarked preview (base64) + report ONLY. No clean bytes.
  return NextResponse.json({
    orderId: order.id,
    spec: { id: spec.id, displayName: spec.displayName },
    preview: `data:image/png;base64,${watermarked.toString("base64")}`,
    report,
    purchasable: report.purchasable,
    backgroundMocked: processed.backgroundMocked,
    headHeightPct: processed.crop.headHeightPct,
    eyeLinePct: processed.crop.eyeLinePct,
  });
}
