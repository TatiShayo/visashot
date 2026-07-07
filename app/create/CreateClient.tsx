"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PhotoSpec } from "@/data/photo-specs";
import { formatDimensions, formatPixels } from "@/data/photo-specs";
import { detectFace, type DetectedFace } from "@/lib/face-detect";
import { sampleTorsoColor } from "@/lib/torso-sample";
import { track } from "@/lib/analytics";
import { ConsentGate, RetentionBadge } from "@/components/ConsentGate";
import { AlignmentRing } from "@/components/AlignmentRing";
import { ComplianceChecklist } from "@/components/ComplianceChecklist";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import type { ComplianceResult } from "@/lib/compliance";

type Stage = "consent" | "capture" | "processing" | "result";

const PROCESSING_COPY = [
  "Reading your photo…",
  "Removing background…",
  "Aligning to spec…",
  "Checking compliance…",
];

interface ProcessResponse {
  orderId: string;
  preview: string;
  report: ComplianceResult;
  purchasable: boolean;
  backgroundMocked: boolean;
  headHeightPct: number;
  eyeLinePct: number;
  error?: string;
}

export function CreateClient({ spec }: { spec: PhotoSpec }) {
  const [stage, setStage] = useState<Stage>("consent");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectedFace | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage !== "processing") return;
    const t = setInterval(() => {
      setProcessingStep((s) => Math.min(s + 1, PROCESSING_COPY.length - 1));
    }, 900);
    return () => clearInterval(t);
  }, [stage]);

  const onFileChosen = useCallback(
    (f: File, capture: "camera" | "file") => {
      setError(null);
      setFile(f);
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
      track("photo_uploaded", { spec_id: spec.id, file_bytes: f.size, capture });
    },
    [spec.id]
  );

  // Run detection whenever the preview image loads.
  useEffect(() => {
    if (!previewUrl || !imgRef.current) return;
    let cancelled = false;
    const img = imgRef.current;

    async function run() {
      try {
        await img.decode();
        if (cancelled) return;
        const d = await detectFace(img);
        if (cancelled) return;
        setDetection(d);
        track("face_detected", {
          spec_id: spec.id,
          ok: d.faceCount === 1,
          hint: d.hint === "good" || d.hint === "center" ? "none" : (d.hint as "move_closer" | "face_straight" | "none"),
        });
      } catch {
        if (!cancelled) setDetection(null);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [previewUrl, spec.id]);

  async function submit() {
    if (!file || !detection?.points) return;
    setStage("processing");
    setProcessingStep(0);
    setError(null);
    track("processing_started", { spec_id: spec.id });
    const startedAt = Date.now();

    try {
      let clothingRgb = { r: 40, g: 60, b: 120 };
      if (imgRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = imgRef.current.naturalWidth;
        canvas.height = imgRef.current.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(imgRef.current, 0, 0);
          const headHeightNorm = detection.points.chinY - detection.points.foreheadTopY;
          clothingRgb = sampleTorsoColor({
            ctx,
            imageWidth: canvas.width,
            imageHeight: canvas.height,
            chinY: detection.points.chinY,
            faceCenterX: (detection.points.leftEyeX + detection.points.rightEyeX) / 2,
            headHeightNorm,
          });
        }
      }

      const form = new FormData();
      form.set("specId", spec.id);
      form.set("photo", file);
      form.set(
        "landmarks",
        JSON.stringify(landmarksFromPoints(detection.points, imgRef.current))
      );
      form.set(
        "signals",
        JSON.stringify({
          faceTiltDeg: detection.faceTiltDeg,
          leftEyeClosed: detection.leftEyeClosed,
          rightEyeClosed: detection.rightEyeClosed,
          smileScore: detection.smileScore,
          faceCount: detection.faceCount,
          glassesDetected: false,
          clothingRgb,
        })
      );

      const res = await fetch("/api/process", { method: "POST", body: form });
      const json = (await res.json()) as ProcessResponse;
      if (!res.ok) {
        setError(json.error ?? "Something went wrong processing your photo.");
        track("processing_failed", { spec_id: spec.id, stage: "compose", reason: json.error ?? "unknown" });
        setStage("capture");
        return;
      }
      setResult(json);
      setStage("result");
      track("processing_succeeded", {
        spec_id: spec.id,
        duration_ms: Date.now() - startedAt,
        mock_background: json.backgroundMocked,
      });
      track("compliance_checked", {
        spec_id: spec.id,
        passed: json.report.purchasable,
        fail_checks: json.report.checks.filter((c) => c.status === "fail").map((c) => c.id),
        warn_checks: json.report.checks.filter((c) => c.status === "warn").map((c) => c.id),
      });
      track("preview_viewed", { spec_id: spec.id, passed: json.report.purchasable });
    } catch {
      setError("Network error — please check your connection and try again.");
      setStage("capture");
    }
  }

  function retake() {
    setFile(null);
    setPreviewUrl(null);
    setDetection(null);
    setResult(null);
    setError(null);
    setStage("capture");
    track("reprocess_requested", { spec_id: spec.id, paid: false, run_number: 1 });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-accent mb-2">
        {spec.displayName}
      </p>
      <h1 className="display text-3xl sm:text-4xl mb-2">
        {stage === "result" ? "Check your compliance report" : "Upload or take your photo"}
      </h1>
      <p className="text-ink-soft mb-6">
        {formatDimensions(spec)} · {formatPixels(spec)} · {spec.bgColor.toUpperCase()} background
      </p>

      {stage === "consent" && <ConsentGate onAccept={() => setStage("capture")} />}

      {stage === "capture" && (
        <div className="space-y-5">
          <RetentionBadge />
          {!previewUrl ? (
            <div className="rounded-card border-2 border-dashed border-rule-strong p-10 text-center">
              <p className="text-ink-soft mb-4">
                Drag a photo in, or choose a file / use your camera.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 px-5 rounded-md border border-rule-strong font-medium hover:border-ink-faint transition-colors"
                >
                  Choose file
                </button>
                <label className="h-11 px-5 rounded-md bg-accent text-white font-medium inline-flex items-center cursor-pointer hover:bg-accent-hover transition-colors">
                  Use camera
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onFileChosen(e.target.files[0], "camera")}
                  />
                </label>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFileChosen(e.target.files[0], "file")}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-card overflow-hidden border border-rule bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={previewUrl} alt="Your upload" className="w-full max-h-[480px] object-contain" />
                <AlignmentRing hint={detection?.hint ?? "none"} />
              </div>
              {detection && detection.faceCount > 1 && (
                <p className="text-sm text-fail">
                  More than one face detected — make sure you&apos;re alone in the photo.
                </p>
              )}
              {error && <p className="text-sm text-fail">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="h-11 px-5 rounded-md border border-rule-strong font-medium hover:border-ink-faint transition-colors"
                >
                  Choose a different photo
                </button>
                <button
                  onClick={submit}
                  disabled={!detection?.points || detection.faceCount !== 1}
                  className="h-11 px-6 rounded-md bg-accent text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
                >
                  Process my photo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === "processing" && (
        <div className="rounded-card border border-rule p-10 text-center">
          <p className="font-mono text-sm text-ink-soft tnum" aria-live="polite">
            {PROCESSING_COPY[processingStep]}
          </p>
          <div className="mt-4 h-1 w-full bg-rule rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-700 ease-out"
              style={{ width: `${((processingStep + 1) / PROCESSING_COPY.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {stage === "result" && result && (
        <div className="space-y-6">
          {previewUrl ? (
            <BeforeAfterSlider
              beforeSrc={previewUrl}
              afterSrc={result.preview}
              beforeLabel="Original"
              afterLabel="Processed"
            />
          ) : (
            <div className="relative rounded-card overflow-hidden border border-rule bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.preview} alt="Processed preview (watermarked)" className="w-full max-h-[420px] object-contain" />
            </div>
          )}
          <RetentionBadge />
          <ComplianceChecklist
            checks={result.report.checks}
            overall={result.report.overall}
            headHeightPct={result.headHeightPct}
            eyeLinePct={result.eyeLinePct}
          />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={retake}
              className="h-11 px-5 rounded-md border border-rule-strong font-medium hover:border-ink-faint transition-colors"
            >
              Retake photo
            </button>
            {result.report.purchasable ? (
              <Link
                href={`/checkout/${result.orderId}`}
                className="h-11 px-6 rounded-md bg-accent text-white font-medium inline-flex items-center hover:bg-accent-hover transition-colors"
              >
                Continue — $4.99
              </Link>
            ) : (
              <p className="text-sm text-fail self-center">
                Fix the issues above and retake before purchasing.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function landmarksFromPoints(
  points: NonNullable<DetectedFace["points"]>,
  img: HTMLImageElement | null
) {
  const w = img?.naturalWidth ?? 1;
  const h = img?.naturalHeight ?? 1;
  // Mirror lib/crop.ts's landmarksFromNormalized so the server receives
  // pixel-space landmarks directly (server has no access to the DOM image).
  const chinY = points.chinY * h;
  const foreheadY = points.foreheadTopY * h;
  const faceSpan = chinY - foreheadY;
  const crownY = foreheadY - faceSpan * 0.12;
  const eyeY = ((points.leftEyeY + points.rightEyeY) / 2) * h;
  const faceCenterX = ((points.leftEyeX + points.rightEyeX) / 2) * w;
  return { crownY, chinY, eyeY, faceCenterX };
}
