/**
 * VisaShot spec database — THE source of truth for photo requirements.
 *
 * Every entry auto-generates:
 *   - an SEO landing page at /photo/[id]
 *   - a processing target (crop + background + compliance thresholds)
 *   - a sitemap entry and OG image
 *
 * Adding a spec = adding one object to PHOTO_SPECS.
 *
 * Conventions:
 *   - eyeLinePct* is measured from the BOTTOM edge of the photo (like the US
 *     State Department diagram). headHeightPct* is crown-to-chin as % of photo
 *     height.
 *   - Where a government publishes explicit head/eye numbers we use them and
 *     cite sourceUrl. Where only dimensions are official, head/eye ranges are
 *     ICAO-derived defaults and the spec carries `needsVerification: true`.
 *   - NEEDS HUMAN: every spec flagged `needsVerification` must be re-checked
 *     against its sourceUrl before launch (dimensions, background, head size).
 */

export type DocType =
  | "passport"
  | "visa"
  | "id"
  | "residency"
  | "other";

export interface PhotoSpec {
  id: string;
  country: string;
  /** ISO 3166-1 alpha-2 (or "EU"/"US" for multi-country docs). */
  countryCode: string;
  docType: DocType;
  displayName: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  dpi: number;
  /** Required background color, hex. */
  bgColor: string;
  /** Crown-to-chin height as % of photo height. */
  headHeightPctMin: number;
  headHeightPctMax: number;
  /** Eye line measured from the BOTTOM edge, % of photo height. */
  eyeLinePctMin: number;
  eyeLinePctMax: number;
  glassesAllowed: boolean;
  smileAllowed: boolean;
  /** Infant/baby variant — compliance checks relaxed per official exemptions. */
  infant?: boolean;
  /** Show a "beta" badge in UI. */
  beta?: boolean;
  /** Religious / medical exemption text surfaced in checker + SEO page. */
  exemptionNotes?: string;
  /** Upsell suggestions ("commonly bought together"). */
  relatedSpecIds?: string[];
  notes: string;
  sourceUrl: string;
  /** NEEDS HUMAN: verify against sourceUrl before launch. */
  needsVerification?: boolean;
}

export const PHOTO_SPECS: PhotoSpec[] = [
  // ───────────────────────────── United States ─────────────────────────────
  {
    id: "us-passport",
    country: "United States",
    countryCode: "US",
    docType: "passport",
    displayName: "US Passport Photo",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 69,
    eyeLinePctMin: 56,
    eyeLinePctMax: 69,
    glassesAllowed: false,
    smileAllowed: true,
    exemptionNotes:
      "Head coverings worn daily for religious reasons are allowed with a signed statement; medical head coverings need a doctor's note. Glasses are only allowed with a medical statement (e.g. recent eye surgery). The full face must remain visible.",
    relatedSpecIds: ["us-visa", "us-green-card-dv", "us-passport-baby"],
    notes:
      "2 x 2 inches (51 x 51 mm). Head 1\" to 1 3/8\" (50–69% of image). Eye line 1 1/8\" to 1 3/8\" from the bottom. Plain white background, neutral expression or natural smile, both eyes open, taken within the last 6 months.",
    sourceUrl:
      "https://travel.state.gov/content/travel/en/passports/how-apply/photos.html",
  },
  {
    id: "us-visa",
    country: "United States",
    countryCode: "US",
    docType: "visa",
    displayName: "US Visa Photo (DS-160)",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 69,
    eyeLinePctMin: 56,
    eyeLinePctMax: 69,
    glassesAllowed: false,
    smileAllowed: true,
    exemptionNotes:
      "Religious head coverings allowed if the full face is visible. Glasses are not allowed in US visa photos (since Nov 2016) except for rare medical reasons with a signed doctor's statement.",
    relatedSpecIds: ["us-passport", "us-green-card-dv"],
    notes:
      "Digital photo for DS-160: square, minimum 600 x 600 px, maximum 1200 x 1200 px, JPEG, white background. Same head-size geometry as the US passport photo.",
    sourceUrl:
      "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html",
  },
  {
    id: "us-green-card-dv",
    country: "United States",
    countryCode: "US",
    docType: "residency",
    displayName: "Green Card / DV Lottery Photo",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 69,
    eyeLinePctMin: 56,
    eyeLinePctMax: 69,
    glassesAllowed: false,
    smileAllowed: true,
    exemptionNotes:
      "Religious head coverings allowed if worn daily and the full face is visible. No glasses.",
    relatedSpecIds: ["us-passport", "us-visa"],
    notes:
      "Diversity Visa (DV) lottery entries and green card applications use the US visa digital standard: 600 x 600 px exactly for DV entry, JPEG, max 240 kB, white background, taken within the last 6 months.",
    sourceUrl:
      "https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry.html",
  },
  {
    id: "tsa-precheck",
    country: "United States",
    countryCode: "US",
    docType: "other",
    displayName: "TSA PreCheck Photo",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 69,
    eyeLinePctMin: 56,
    eyeLinePctMax: 69,
    glassesAllowed: false,
    smileAllowed: true,
    relatedSpecIds: ["us-passport", "us-cdl-state-id"],
    notes:
      "TSA PreCheck enrollment photos are normally captured in person at an enrollment center; some online renewal flows request a passport-style photo. This spec mirrors the US passport standard (2 x 2 in, white background).",
    sourceUrl: "https://www.tsa.gov/precheck",
    needsVerification: true,
  },
  {
    id: "us-cdl-state-id",
    country: "United States",
    countryCode: "US",
    docType: "id",
    displayName: "US State ID / CDL Photo (generic)",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 69,
    eyeLinePctMin: 56,
    eyeLinePctMax: 69,
    glassesAllowed: false,
    smileAllowed: true,
    relatedSpecIds: ["us-passport", "tsa-precheck"],
    notes:
      "Generic passport-style photo accepted by most US DMV/state-ID processes that allow submitted photos. Requirements vary by state — check your state DMV before ordering.",
    sourceUrl: "https://www.usa.gov/motor-vehicle-services",
    needsVerification: true,
  },
  {
    id: "us-passport-baby",
    country: "United States",
    countryCode: "US",
    docType: "passport",
    displayName: "US Passport Photo — Baby / Infant",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 69,
    eyeLinePctMin: 56,
    eyeLinePctMax: 69,
    glassesAllowed: false,
    smileAllowed: true,
    infant: true,
    beta: true,
    exemptionNotes:
      "Official infant exemptions: newborns don't need to look directly at the camera, and it's acceptable if an infant's eyes are not fully open. No other person or hands may be visible in the photo.",
    relatedSpecIds: ["us-passport"],
    notes:
      "Same 2 x 2 in white-background spec as the adult US passport photo, with official infant relaxations. Tip: lay the baby on a plain white sheet and shoot from directly above.",
    sourceUrl:
      "https://travel.state.gov/content/travel/en/passports/how-apply/photos.html",
  },

  // ──────────────────────────── Schengen / EU ──────────────────────────────
  {
    id: "schengen-visa",
    country: "Schengen Area",
    countryCode: "EU",
    docType: "visa",
    displayName: "Schengen Visa Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#F0F0F0",
    headHeightPctMin: 70,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Head coverings for religious reasons are accepted if the face is fully visible from chin to forehead and both cheeks are shown. Glasses with heavy frames or glare are rejected; best practice is to remove them.",
    relatedSpecIds: ["schengen-visa-baby", "uk-visa", "france-passport"],
    notes:
      "35 x 45 mm (ICAO standard), face covering 70–80% of the photo height (about 32–36 mm), neutral expression, mouth closed, light uniform background (light grey recommended, white widely accepted). Eye-line range is ICAO-derived.",
    sourceUrl:
      "https://france-visas.gouv.fr/en/web/france-visas/photos",
  },
  {
    id: "schengen-visa-baby",
    country: "Schengen Area",
    countryCode: "EU",
    docType: "visa",
    displayName: "Schengen Visa Photo — Baby / Infant",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#F0F0F0",
    headHeightPctMin: 60,
    headHeightPctMax: 80,
    eyeLinePctMin: 45,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    infant: true,
    beta: true,
    exemptionNotes:
      "Children under 10 have relaxed head-position requirements in most Schengen consulates; infants may have eyes not fully open and a non-neutral expression. No hands or other people visible.",
    relatedSpecIds: ["schengen-visa"],
    notes:
      "Same 35 x 45 mm geometry with relaxed infant tolerances applied by most consulates. Tip: lay the baby on a plain light sheet and shoot from above.",
    sourceUrl: "https://france-visas.gouv.fr/en/web/france-visas/photos",
    needsVerification: true,
  },

  // ──────────────────────────── United Kingdom ─────────────────────────────
  {
    id: "uk-passport",
    country: "United Kingdom",
    countryCode: "GB",
    docType: "passport",
    displayName: "UK Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#EBEBEB",
    headHeightPctMin: 64,
    headHeightPctMax: 76,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Head coverings allowed for religious or medical reasons if the full face is visible. HM Passport Office asks you to remove glasses if at all possible; frames must not cover the eyes and there must be no glare.",
    relatedSpecIds: ["uk-visa", "uk-passport-baby", "ireland-passport"],
    notes:
      "35 x 45 mm printed, or digital at minimum 600 x 750 px. Head (crown to chin) between 29 mm and 34 mm. Plain cream or light grey background, neutral expression, mouth closed. Eye-line range is derived from the head-size rule.",
    sourceUrl: "https://www.gov.uk/photos-for-passports",
  },
  {
    id: "uk-passport-baby",
    country: "United Kingdom",
    countryCode: "GB",
    docType: "passport",
    displayName: "UK Passport Photo — Baby / Infant",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#EBEBEB",
    headHeightPctMin: 55,
    headHeightPctMax: 76,
    eyeLinePctMin: 45,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    infant: true,
    beta: true,
    exemptionNotes:
      "Official exemptions: children under 6 do not need a plain/neutral expression or to look directly at the camera; children under 1 do not need their eyes open and may be supported (support hand must not be visible). Under-1s may lie on a plain light-coloured sheet.",
    relatedSpecIds: ["uk-passport"],
    notes:
      "Same 35 x 45 mm geometry as the adult UK passport photo with GOV.UK's published under-1 and under-6 relaxations.",
    sourceUrl: "https://www.gov.uk/photos-for-passports/rules-for-digital-photos",
  },
  {
    id: "uk-visa",
    country: "United Kingdom",
    countryCode: "GB",
    docType: "visa",
    displayName: "UK Visa Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#EBEBEB",
    headHeightPctMin: 64,
    headHeightPctMax: 76,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted with the full face visible. Remove glasses if possible.",
    relatedSpecIds: ["uk-passport", "schengen-visa"],
    notes:
      "35 x 45 mm, head 29–34 mm crown to chin, plain light grey or cream background, neutral expression. Same geometry as the UK passport photo.",
    sourceUrl:
      "https://www.gov.uk/government/publications/uk-visas-and-immigration-photograph-requirements",
  },

  // ─────────────────────────────── Canada ──────────────────────────────────
  {
    id: "canada-passport",
    country: "Canada",
    countryCode: "CA",
    docType: "passport",
    displayName: "Canada Passport Photo",
    widthMm: 50,
    heightMm: 70,
    widthPx: 1181,
    heightPx: 1654,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 44,
    headHeightPctMax: 51,
    eyeLinePctMin: 45,
    eyeLinePctMax: 62,
    glassesAllowed: true,
    smileAllowed: false,
    exemptionNotes:
      "Prescription glasses are allowed if the eyes are clearly visible with no glare (no sunglasses or tinted lenses). Head coverings worn for religious beliefs or medical reasons are allowed if the full face is clearly visible.",
    relatedSpecIds: ["canada-visa", "us-passport"],
    notes:
      "50 x 70 mm, face height (chin to crown) 31–36 mm — i.e. 44–51% of the 70 mm photo height. Plain white or light-coloured background, neutral expression, mouth closed. Eye-line range is derived. NOTE: Canada normally requires photos taken by a commercial photographer with studio stamp for the paper process; digital submission rules differ — check the current IRCC guidance.",
    sourceUrl:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/photos.html",
    needsVerification: true,
  },
  {
    id: "canada-visa",
    country: "Canada",
    countryCode: "CA",
    docType: "visa",
    displayName: "Canada Visa Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 69,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: true,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings allowed with the full face visible. Prescription glasses allowed if eyes are clearly visible.",
    relatedSpecIds: ["canada-passport", "us-visa"],
    notes:
      "35 x 45 mm, head 31–36 mm crown to chin (about 69–80% of photo height), plain white background, neutral expression. Used for visitor visas and permanent-residence applications.",
    sourceUrl:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/visa-application-photograph-specifications.html",
  },

  // ────────────────────────────── Australia ────────────────────────────────
  {
    id: "australia-passport",
    country: "Australia",
    countryCode: "AU",
    docType: "passport",
    displayName: "Australia Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#F0F0F0",
    headHeightPctMin: 71,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Glasses are NOT allowed in Australian passport photos (rule since 2018) unless supported by a medical statement. Religious head coverings allowed if the face is visible from bottom of chin to top of forehead and both edges of the face are shown.",
    relatedSpecIds: ["new-zealand-passport", "uk-passport"],
    notes:
      "35 x 45 mm (photos 35–40 mm wide and 45–50 mm high are accepted), head 32–36 mm crown to chin, plain white or light grey background, neutral expression, mouth closed.",
    sourceUrl:
      "https://www.passports.gov.au/getting-passport-how-it-works/photo-requirements",
  },

  // ──────────────────────────────── India ──────────────────────────────────
  {
    id: "india-passport",
    country: "India",
    countryCode: "IN",
    docType: "passport",
    displayName: "India Passport Photo",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 55,
    headHeightPctMax: 72,
    eyeLinePctMin: 52,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings (e.g. turban) are accepted if worn daily and the full face is visible. Glasses should be removed.",
    relatedSpecIds: ["india-visa", "india-oci"],
    notes:
      "2 x 2 inches (51 x 51 mm), plain white background with no borders, full face front view, neutral expression, both ears visible where possible. Head-size percentages are ICAO-derived — Passport Seva publishes dimensions but not head-height numbers.",
    sourceUrl: "https://www.passportindia.gov.in/AppOnlineProject/online/faqFeesPayment",
    needsVerification: true,
  },
  {
    id: "india-oci",
    country: "India",
    countryCode: "IN",
    docType: "residency",
    displayName: "India OCI Card Photo",
    widthMm: 51,
    heightMm: 51,
    widthPx: 900,
    heightPx: 900,
    dpi: 450,
    bgColor: "#FFFFFF",
    headHeightPctMin: 55,
    headHeightPctMax: 72,
    eyeLinePctMin: 52,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted if worn daily; the face from chin to crown must be visible. No glasses.",
    relatedSpecIds: ["india-passport", "us-passport"],
    notes:
      "OCI online upload: square JPEG between 360 x 360 px and 900 x 900 px (max 200 kB), plain white background, no shadows, full front view. We output 900 x 900 px for maximum quality.",
    sourceUrl: "https://ociservices.gov.in/",
    needsVerification: true,
  },
  {
    id: "india-visa",
    country: "India",
    countryCode: "IN",
    docType: "visa",
    displayName: "India Visa / e-Visa Photo",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 55,
    headHeightPctMax: 72,
    eyeLinePctMin: 52,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted with the full face visible.",
    relatedSpecIds: ["india-passport"],
    notes:
      "2 x 2 inches (51 x 51 mm) square. e-Visa upload: square JPEG, minimum 350 x 350 px, max 1 MB, plain white background, full face centered.",
    sourceUrl: "https://indianvisaonline.gov.in/evisa/tvoa.html",
    needsVerification: true,
  },

  // ──────────────────────────────── China ──────────────────────────────────
  {
    id: "china-visa",
    country: "China",
    countryCode: "CN",
    docType: "visa",
    displayName: "China Visa Photo",
    widthMm: 33,
    heightMm: 48,
    widthPx: 420,
    heightPx: 560,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 58,
    headHeightPctMax: 69,
    eyeLinePctMin: 50,
    eyeLinePctMax: 68,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Glasses are not allowed in Chinese visa photos (rule since 2016). Religious head coverings are generally not accepted except in limited cases — the full head outline and both ears should be visible.",
    relatedSpecIds: ["japan-visa", "vietnam-evisa"],
    notes:
      "33 x 48 mm. Head height (crown to chin) 28–33 mm, head width 15–22 mm. Digital upload: 354–420 px wide, 472–560 px high (3:4 ratio — official digital aspect differs from the 33 x 48 mm print), JPEG 40–120 kB. White background only, neutral expression, ears visible, no jewelry obscuring the face. Print sheet is re-cropped to 33 x 48 mm from the master.",
    sourceUrl: "https://www.visaforchina.cn/globle/",
  },

  // ──────────────────────────────── Japan ──────────────────────────────────
  {
    id: "japan-passport",
    country: "Japan",
    countryCode: "JP",
    docType: "passport",
    displayName: "Japan Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 71,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "MOFA recommends removing glasses (glare and frames cause rejections). Religious head coverings allowed if the face from chin to forehead and both cheek edges are visible.",
    relatedSpecIds: ["japan-visa", "south-korea-passport"],
    notes:
      "35 x 45 mm, head (crown to chin) 34 ± 2 mm (32–36 mm), centered, plain white or light background with no shadows, neutral expression, taken within 6 months.",
    sourceUrl: "https://www.mofa.go.jp/mofaj/toko/passport/ic_photo.html",
  },
  {
    id: "japan-visa",
    country: "Japan",
    countryCode: "JP",
    docType: "visa",
    displayName: "Japan Visa Photo",
    widthMm: 45,
    heightMm: 45,
    widthPx: 1063,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 55,
    headHeightPctMax: 75,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    relatedSpecIds: ["japan-passport", "china-visa"],
    notes:
      "45 x 45 mm (2 x 2 in / 51 x 51 mm also commonly accepted at some missions), plain white background, full front view, neutral expression, taken within 6 months. Requirements vary slightly by embassy — check your local Japanese mission.",
    sourceUrl: "https://www.mofa.go.jp/j_info/visit/visa/index.html",
    needsVerification: true,
  },

  // ─────────────────────────────── Brazil ──────────────────────────────────
  {
    id: "brazil-passport",
    country: "Brazil",
    countryCode: "BR",
    docType: "passport",
    displayName: "Brazil Passport Photo",
    widthMm: 50,
    heightMm: 70,
    widthPx: 1181,
    heightPx: 1654,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 44,
    headHeightPctMax: 55,
    eyeLinePctMin: 45,
    eyeLinePctMax: 62,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Glasses must be removed. Religious head coverings accepted if the face is fully visible.",
    relatedSpecIds: ["brazil-visa"],
    notes:
      "5 x 7 cm, white background, neutral expression, front view. Photos for passports issued inside Brazil are usually captured at the Polícia Federal counter; printed photos are required for applications at consulates abroad.",
    sourceUrl: "https://www.gov.br/pf/pt-br/assuntos/passaporte",
    needsVerification: true,
  },
  {
    id: "brazil-visa",
    country: "Brazil",
    countryCode: "BR",
    docType: "visa",
    displayName: "Brazil Visa / e-Visa Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 60,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    relatedSpecIds: ["brazil-passport", "us-visa"],
    notes:
      "35 x 45 mm passport-style photo (digital upload for the e-visa: recent, front view, white background, no glasses). Head-size percentages are ICAO-derived.",
    sourceUrl: "https://www.gov.br/mre/en/subjects/visits-to-brazil/visas",
    needsVerification: true,
  },

  // ─────────────────────────────── Nigeria ─────────────────────────────────
  {
    id: "nigeria-passport",
    country: "Nigeria",
    countryCode: "NG",
    docType: "passport",
    displayName: "Nigeria Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 65,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted if the full facial features from chin to forehead are visible. No glasses or tinted lenses.",
    relatedSpecIds: ["ghana-passport", "uk-visa"],
    notes:
      "35 x 45 mm, plain white background, neutral expression, full face, ears visible where possible. Head-size percentages are ICAO-derived — verify against the Nigeria Immigration Service guidance.",
    sourceUrl: "https://immigration.gov.ng/",
    needsVerification: true,
  },

  // ──────────────────────────────── Kenya ──────────────────────────────────
  {
    id: "kenya-passport",
    country: "Kenya",
    countryCode: "KE",
    docType: "passport",
    displayName: "Kenya Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 65,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted with the full face visible.",
    relatedSpecIds: ["nigeria-passport", "south-africa-passport"],
    notes:
      "Passport-style photo with plain white background for the eCitizen application. Commonly quoted as 35 x 45 mm — VERIFY the exact size and digital upload constraints on the Directorate of Immigration Services portal before launch.",
    sourceUrl: "https://immigration.go.ke/",
    needsVerification: true,
  },

  // ──────────────────────────── South Africa ───────────────────────────────
  {
    id: "south-africa-passport",
    country: "South Africa",
    countryCode: "ZA",
    docType: "passport",
    displayName: "South Africa Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 65,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted if the full face is visible. No glasses with tinted lenses; frames must not cover the eyes.",
    relatedSpecIds: ["kenya-passport", "uk-visa"],
    notes:
      "35 x 45 mm, plain white or light grey background, neutral expression, mouth closed. Head-size percentages are ICAO-derived — verify against DHA guidance.",
    sourceUrl: "http://www.dha.gov.za/index.php/civic-services/travel-documents",
    needsVerification: true,
  },

  // ───────────────────────────────── UAE ───────────────────────────────────
  {
    id: "uae-visa",
    country: "United Arab Emirates",
    countryCode: "AE",
    docType: "visa",
    displayName: "UAE Visa / Residence Photo",
    widthMm: 43,
    heightMm: 55,
    widthPx: 1016,
    heightPx: 1299,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 60,
    headHeightPctMax: 75,
    eyeLinePctMin: 50,
    eyeLinePctMax: 68,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings (hijab) accepted if the full face from chin to forehead is visible.",
    relatedSpecIds: ["saudi-visa", "india-passport"],
    notes:
      "4.3 x 5.5 cm, white background, front view, neutral expression. Used for UAE residence visas and Emirates ID applications. VERIFY exact digital pixel requirements on the ICP smart channels before launch.",
    sourceUrl: "https://icp.gov.ae/en/",
    needsVerification: true,
  },

  // ─────────────────────────── Saudi Arabia ────────────────────────────────
  {
    id: "saudi-visa",
    country: "Saudi Arabia",
    countryCode: "SA",
    docType: "visa",
    displayName: "Saudi Arabia Visa Photo",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 69,
    eyeLinePctMin: 52,
    eyeLinePctMax: 69,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted if the full face is visible (required for Hajj/Umrah visa photos as well).",
    relatedSpecIds: ["saudi-iqama", "uae-visa"],
    notes:
      "2 x 2 inches (51 x 51 mm), white background, front view, neutral expression. The Saudi e-visa portal accepts a square digital photo (min 200 x 200 px) — we output 600 x 600 px.",
    sourceUrl: "https://visa.visitsaudi.com/",
    needsVerification: true,
  },
  {
    id: "saudi-iqama",
    country: "Saudi Arabia",
    countryCode: "SA",
    docType: "residency",
    displayName: "Saudi Iqama (Residence) Photo",
    widthMm: 51,
    heightMm: 51,
    widthPx: 600,
    heightPx: 600,
    dpi: 300,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 69,
    eyeLinePctMin: 52,
    eyeLinePctMax: 69,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted if the full face is visible.",
    relatedSpecIds: ["saudi-visa"],
    notes:
      "Passport-style photo on a white background, commonly requested at 2 x 2 in for iqama issuance and renewals. Requirements are applied by Jawazat/employers — VERIFY the current requested size before launch.",
    sourceUrl: "https://www.absher.sa/",
    needsVerification: true,
  },

  // ───────────────────────────── Philippines ───────────────────────────────
  {
    id: "philippines-passport",
    country: "Philippines",
    countryCode: "PH",
    docType: "passport",
    displayName: "Philippines Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 65,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted with a full-face view. No eyeglasses, colored contact lenses, or heavy makeup that alters appearance.",
    relatedSpecIds: ["us-visa", "japan-visa"],
    notes:
      "Photos for e-passports are normally captured live at DFA sites; passport-style 35 x 45 mm white-background photos are used for applications at foreign service posts and for other Philippine documents. VERIFY the target office's requirement before ordering.",
    sourceUrl: "https://dfa.gov.ph/passport-faqs",
    needsVerification: true,
  },

  // ─────────────────────────────── Mexico ──────────────────────────────────
  {
    id: "mexico-passport",
    country: "Mexico",
    countryCode: "MX",
    docType: "passport",
    displayName: "Mexico Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 65,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "No glasses. Head coverings only for religious reasons with the face fully visible.",
    relatedSpecIds: ["us-passport", "us-visa"],
    notes:
      "3.5 x 4.5 cm, white background, front view, neutral expression, forehead and ears visible where possible, no jewelry. Photos are also captured on-site at SRE offices — printed photos are used for OP-5 and consular applications.",
    sourceUrl: "https://www.gob.mx/sre",
    needsVerification: true,
  },

  // ─────────────────────────────── Europe ──────────────────────────────────
  {
    id: "france-passport",
    country: "France",
    countryCode: "FR",
    docType: "passport",
    displayName: "France Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#F0F0F0",
    headHeightPctMin: 71,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Bareheaded photos are required — no head coverings are accepted for French identity documents. Glasses: thick frames and glare are refused; removing glasses is strongly recommended.",
    relatedSpecIds: ["schengen-visa", "germany-passport"],
    notes:
      "35 x 45 mm, face height (chin to crown) 32–36 mm, light plain background (light grey or light blue — pure white is refused for French domestic documents), neutral expression, mouth closed.",
    sourceUrl: "https://www.service-public.fr/particuliers/vosdroits/F10619",
  },
  {
    id: "germany-passport",
    country: "Germany",
    countryCode: "DE",
    docType: "passport",
    displayName: "Germany Passport Photo (Biometric)",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#F0F0F0",
    headHeightPctMin: 71,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: true,
    smileAllowed: false,
    exemptionNotes:
      "Glasses allowed if the eyes are clearly visible (no glare, no tinted lenses, frames not covering the eyes). Religious head coverings allowed if the face is fully visible.",
    relatedSpecIds: ["schengen-visa", "france-passport"],
    notes:
      "35 x 45 mm biometric standard (Fotomustertafel): face height 32–36 mm, eyes in the upper photo area, neutral expression, mouth closed, uniform light grey background. Since May 2025 German authorities require digitally transmitted photos — VERIFY the current submission channel.",
    sourceUrl:
      "https://www.bmi.bund.de/DE/themen/moderne-verwaltung/ausweise-und-paesse/ausweise-und-paesse-node.html",
    needsVerification: true,
  },
  {
    id: "italy-passport",
    country: "Italy",
    countryCode: "IT",
    docType: "passport",
    displayName: "Italy Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 70,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Glasses should be removed (ICAO recommendation applied by the Polizia di Stato). Religious head coverings allowed with the face fully visible.",
    relatedSpecIds: ["schengen-visa", "france-passport"],
    notes:
      "35 x 45 mm ICAO-compliant, white background, face 70–80% of the photo, neutral expression, front view, no shadows.",
    sourceUrl: "https://www.poliziadistato.it/articolo/191",
  },
  {
    id: "spain-passport",
    country: "Spain",
    countryCode: "ES",
    docType: "passport",
    displayName: "Spain Passport / DNI Photo",
    widthMm: 26,
    heightMm: 32,
    widthPx: 614,
    heightPx: 756,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 65,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "No dark or tinted glasses; frames must not cover the eyes. Religious head coverings allowed if the oval of the face is fully visible.",
    relatedSpecIds: ["schengen-visa", "france-passport"],
    notes:
      "32 x 26 mm (unusually small — the Spanish DNI/passport format), plain uniform white background, front view, neutral expression. VERIFY: some offices also accept 35 x 45 mm and crop on-site.",
    sourceUrl: "https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/tramites-y-gestiones/dni/",
    needsVerification: true,
  },
  {
    id: "netherlands-passport",
    country: "Netherlands",
    countryCode: "NL",
    docType: "passport",
    displayName: "Netherlands Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#F0F0F0",
    headHeightPctMin: 58,
    headHeightPctMax: 71,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: true,
    smileAllowed: false,
    exemptionNotes:
      "Glasses allowed if the eyes are fully visible (no glare, no tinted lenses). Head coverings only for religious or medical reasons, with the face fully visible from chin to forehead.",
    relatedSpecIds: ["schengen-visa", "germany-passport"],
    notes:
      "35 x 45 mm per the Dutch Fotomatrix: head height (chin to crown) 26–32 mm — smaller than the ICAO norm. Light grey, light blue or white background, neutral expression, mouth closed.",
    sourceUrl:
      "https://www.rijksoverheid.nl/onderwerpen/paspoort-en-identiteitskaart/eisen-pasfoto-paspoort-id-kaart",
    needsVerification: true,
  },
  {
    id: "ireland-passport",
    country: "Ireland",
    countryCode: "IE",
    docType: "passport",
    displayName: "Ireland Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#F0F0F0",
    headHeightPctMin: 62,
    headHeightPctMax: 76,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Glasses are not allowed in Irish passport photos (rule since 2019). Religious head coverings allowed if the full face is visible.",
    relatedSpecIds: ["uk-passport", "schengen-visa"],
    notes:
      "Printed: 35 x 45 mm with head 29–34 mm. Passport Online accepts digital photos between 715 x 951 px and 4770 x 6350 px (portrait, 0.75 ratio) — our 827 x 1063 px output fits the accepted range.",
    sourceUrl: "https://www.ireland.ie/en/dfa/passports/passport-photo-guidelines/",
  },
  {
    id: "poland-passport",
    country: "Poland",
    countryCode: "PL",
    docType: "passport",
    displayName: "Poland Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 70,
    headHeightPctMax: 80,
    eyeLinePctMin: 55,
    eyeLinePctMax: 72,
    glassesAllowed: true,
    smileAllowed: false,
    exemptionNotes:
      "Glasses allowed if eyes are clearly visible without glare (dark lenses only with a disability certificate). Religious head coverings allowed with a face fully visible, based on a membership statement of a registered religious community.",
    relatedSpecIds: ["schengen-visa", "germany-passport"],
    notes:
      "35 x 45 mm, head 70–80% of the photo height, eyes in the upper part of the photo, uniform light background, neutral expression, front view.",
    sourceUrl: "https://www.gov.pl/web/gov/zdjecie-do-dowodu-lub-paszportu",
  },

  // ─────────────────────────── Asia-Pacific ────────────────────────────────
  {
    id: "new-zealand-passport",
    country: "New Zealand",
    countryCode: "NZ",
    docType: "passport",
    displayName: "New Zealand Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 1200,
    heightPx: 1600,
    dpi: 900,
    bgColor: "#F0F0F0",
    headHeightPctMin: 65,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Glasses are not allowed in NZ passport photos. Religious head coverings allowed if the face is visible from chin to forehead.",
    relatedSpecIds: ["australia-passport"],
    notes:
      "Digital-first: JPEG between 900 x 1200 px and 4500 x 6000 px at 3:4 ratio, plain light grey or cream background. We output 1200 x 1600 px. Printed photos (35 x 45 mm) accepted for paper forms — the official digital 3:4 aspect differs from the print aspect; the print sheet is re-cropped to 35 x 45 mm from the master.",
    sourceUrl:
      "https://www.passports.govt.nz/passport-photos/passport-photo-requirements/",
  },
  {
    id: "singapore-passport",
    country: "Singapore",
    countryCode: "SG",
    docType: "passport",
    displayName: "Singapore Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 55,
    headHeightPctMax: 72,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "No glasses or tinted lenses. Religious head coverings allowed if they do not obscure facial features; the face from forehead to chin and both cheeks must be visible.",
    relatedSpecIds: ["malaysia-passport", "japan-passport"],
    notes:
      "35 x 45 mm, white background, full face without headgear, taken within the last 3 months. ICA digital upload: 400 x 514 px minimum. Face should occupy 55–72% of the photo per ICA's crown-to-chin guidance.",
    sourceUrl: "https://www.ica.gov.sg/photo-guidelines",
    needsVerification: true,
  },
  {
    id: "malaysia-passport",
    country: "Malaysia",
    countryCode: "MY",
    docType: "passport",
    displayName: "Malaysia Passport Photo",
    widthMm: 35,
    heightMm: 50,
    widthPx: 827,
    heightPx: 1181,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 55,
    headHeightPctMax: 72,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings (tudung) allowed if the face from chin to forehead is fully visible. No glasses.",
    relatedSpecIds: ["singapore-passport", "indonesia-passport"],
    notes:
      "35 x 50 mm (note: taller than the ICAO 35 x 45), white background, neutral expression, front view. VERIFY: Jabatan Imigresen Malaysia guidance on head size before launch.",
    sourceUrl: "https://www.imi.gov.my/index.php/en/main-services/passport/",
    needsVerification: true,
  },
  {
    id: "south-korea-passport",
    country: "South Korea",
    countryCode: "KR",
    docType: "passport",
    displayName: "South Korea Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 71,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Glasses are discouraged (no glare, no tinted lenses; frames must not cover the eyes). Religious head coverings allowed if the facial outline is fully visible.",
    relatedSpecIds: ["japan-passport", "china-visa"],
    notes:
      "35 x 45 mm, face height (chin to crown) 32–36 mm, white background, neutral expression, both ears visible where possible, taken within 6 months.",
    sourceUrl: "https://www.passport.go.kr/home/kor/contents.do?menuPos=32",
  },
  {
    id: "pakistan-passport",
    country: "Pakistan",
    countryCode: "PK",
    docType: "passport",
    displayName: "Pakistan Passport / NICOP Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 60,
    headHeightPctMax: 78,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings (hijab) accepted if the full face is visible. No glasses.",
    relatedSpecIds: ["india-passport", "bangladesh-passport"],
    notes:
      "35 x 45 mm, white background, front view, neutral expression. Used for machine-readable passports and NADRA NICOP/POC cards. Head-size percentages are ICAO-derived.",
    sourceUrl: "https://dgip.gov.pk/",
    needsVerification: true,
  },
  {
    id: "bangladesh-passport",
    country: "Bangladesh",
    countryCode: "BD",
    docType: "passport",
    displayName: "Bangladesh e-Passport Photo",
    widthMm: 40,
    heightMm: 50,
    widthPx: 945,
    heightPx: 1181,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 60,
    headHeightPctMax: 78,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted with the full face visible.",
    relatedSpecIds: ["pakistan-passport", "india-passport"],
    notes:
      "40 x 50 mm, white background, for e-passport applications (photos are also captured live at enrollment). VERIFY the currently requested print size with the Department of Immigration & Passports.",
    sourceUrl: "https://www.epassport.gov.bd/",
    needsVerification: true,
  },
  {
    id: "indonesia-passport",
    country: "Indonesia",
    countryCode: "ID",
    docType: "passport",
    displayName: "Indonesia Passport Photo",
    widthMm: 40,
    heightMm: 60,
    widthPx: 945,
    heightPx: 1417,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 70,
    eyeLinePctMin: 45,
    eyeLinePctMax: 65,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings (jilbab) accepted if the full face is visible.",
    relatedSpecIds: ["malaysia-passport", "singapore-passport"],
    notes:
      "4 x 6 cm, white background, front view, neutral expression (photos are also captured live at immigration offices; printed photos are used for some consular applications). VERIFY size with the target office.",
    sourceUrl: "https://www.imigrasi.go.id/",
    needsVerification: true,
  },
  {
    id: "vietnam-evisa",
    country: "Vietnam",
    countryCode: "VN",
    docType: "visa",
    displayName: "Vietnam e-Visa Photo",
    widthMm: 40,
    heightMm: 60,
    widthPx: 945,
    heightPx: 1417,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 70,
    eyeLinePctMin: 45,
    eyeLinePctMax: 65,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted with the full face visible.",
    relatedSpecIds: ["thailand-evisa", "china-visa"],
    notes:
      "4 x 6 cm portrait, white background, front view, no glasses, for the official Vietnam e-visa portal upload. VERIFY current portal pixel constraints before launch.",
    sourceUrl: "https://evisa.gov.vn/",
    needsVerification: true,
  },
  {
    id: "thailand-evisa",
    country: "Thailand",
    countryCode: "TH",
    docType: "visa",
    displayName: "Thailand Visa / e-Visa Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 65,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted with the full face visible.",
    relatedSpecIds: ["vietnam-evisa", "malaysia-passport"],
    notes:
      "35 x 45 mm (4 x 6 cm also accepted at some missions), white background, taken within 6 months, neutral expression. VERIFY the requirement of your specific embassy or the e-visa portal.",
    sourceUrl: "https://www.thaievisa.go.th/",
    needsVerification: true,
  },

  // ──────────────────────── Middle East / Eurasia ──────────────────────────
  {
    id: "turkey-passport",
    country: "Turkey",
    countryCode: "TR",
    docType: "passport",
    displayName: "Turkey Passport Photo (Biometric)",
    widthMm: 50,
    heightMm: 60,
    widthPx: 1181,
    heightPx: 1417,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 50,
    headHeightPctMax: 70,
    eyeLinePctMin: 45,
    eyeLinePctMax: 65,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted if the face is fully visible from chin to forehead.",
    relatedSpecIds: ["schengen-visa", "russia-visa"],
    notes:
      "50 x 60 mm biometric photo, white background, front view, neutral expression, taken within the last 6 months. Used for passports and national ID cards.",
    sourceUrl: "https://www.nvi.gov.tr/",
    needsVerification: true,
  },
  {
    id: "russia-visa",
    country: "Russia",
    countryCode: "RU",
    docType: "visa",
    displayName: "Russia Visa Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 60,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted for applicants who wear them daily, with the full face visible.",
    relatedSpecIds: ["schengen-visa", "china-visa"],
    notes:
      "35 x 45 mm, white or light background, full front view, neutral expression, no glasses with tinted lenses. Uploaded with the electronic visa application form.",
    sourceUrl: "https://visa.kdmid.ru/",
    needsVerification: true,
  },

  // ──────────────────────────────── Ghana ──────────────────────────────────
  {
    id: "ghana-passport",
    country: "Ghana",
    countryCode: "GH",
    docType: "passport",
    displayName: "Ghana Passport Photo",
    widthMm: 35,
    heightMm: 45,
    widthPx: 827,
    heightPx: 1063,
    dpi: 600,
    bgColor: "#FFFFFF",
    headHeightPctMin: 65,
    headHeightPctMax: 80,
    eyeLinePctMin: 50,
    eyeLinePctMax: 70,
    glassesAllowed: false,
    smileAllowed: false,
    exemptionNotes:
      "Religious head coverings accepted with the full face visible.",
    relatedSpecIds: ["nigeria-passport", "kenya-passport"],
    notes:
      "Passport-style 35 x 45 mm photo, plain white background, neutral expression, front view. VERIFY exact size and digital constraints on the passport application portal before launch.",
    sourceUrl: "https://passport.mfa.gov.gh/",
    needsVerification: true,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const specById = new Map(PHOTO_SPECS.map((s) => [s.id, s]));

export function getSpec(id: string): PhotoSpec | undefined {
  return specById.get(id);
}

export function getSpecOrThrow(id: string): PhotoSpec {
  const spec = specById.get(id);
  if (!spec) throw new Error(`Unknown photo spec: ${id}`);
  return spec;
}

export function listSpecs(): PhotoSpec[] {
  return PHOTO_SPECS;
}

export function relatedSpecs(spec: PhotoSpec): PhotoSpec[] {
  const related = (spec.relatedSpecIds ?? [])
    .map((id) => specById.get(id))
    .filter((s): s is PhotoSpec => Boolean(s));
  if (related.length > 0) return related;
  // Fallback: same country, different doc.
  return PHOTO_SPECS.filter(
    (s) => s.countryCode === spec.countryCode && s.id !== spec.id
  ).slice(0, 3);
}

/** Specs suggested as paid add-ons at checkout (multi-spec upsell). */
export function upsellSpecs(spec: PhotoSpec): PhotoSpec[] {
  return relatedSpecs(spec).filter((s) => !s.infant).slice(0, 3);
}

export function formatDimensions(spec: PhotoSpec): string {
  return `${spec.widthMm} × ${spec.heightMm} mm`;
}

export function formatPixels(spec: PhotoSpec): string {
  return `${spec.widthPx} × ${spec.heightPx} px`;
}
