/**
 * Deterministic PDF + text fixtures for pipeline tests.
 * The PDF builder emits a tiny valid single-page PDF (uncompressed content
 * stream, correct xref offsets) so both unpdf (real PDF.js) and the naive
 * extractor parse the same bytes.
 */

export function makeMinimalPdf(lines: string[]): Uint8Array {
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const ops: string[] = ["BT", "/F1 12 Tf", "72 720 Td", "16 TL"];
  lines.forEach((line, i) => {
    if (i > 0) ops.push("T*");
    ops.push(`(${escape(line)}) Tj`);
  });
  ops.push("ET");
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  const pdf = body + xref + trailer; // ASCII only: length == byte length
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// Text fixtures (one per doc type + low-signal)
// ---------------------------------------------------------------------------

export const FIXTURE_VACCINE_TEXT = `PINEWOOD VETERINARY CLINIC
Rabies Vaccination Certificate
Pet name: Maple
Date: 03/14/2026
Vaccine: Rabies (1-year)
Administered by: Dr. Elena Ruiz, DVM
Next due: 03/14/2027`;

export const FIXTURE_MEDICATION_TEXT = `CITY ANIMAL HOSPITAL
Prescription dispensed
Medication: Amoxicillin
Dosage: 125 mg twice daily
Instructions: give with food, as needed for 7 days
Date: 2026-02-02`;

export const FIXTURE_LAB_TEXT = `WOOFSPAN LABORATORY
Complete Blood Count (CBC)
Result: within normal limits
Date: September 2, 2026`;

export const FIXTURE_VET_VISIT_TEXT = `Maple's Annual Checkup
BARKSIDE ANIMAL HOSPITAL
Physical exam performed. Chief complaint: itchy skin.
Diagnosis: mild dermatitis.
Follow-up on 10/10/2026.
Examined by Dr. Patel, DVM`;

export const FIXTURE_LOW_SIGNAL_TEXT = `Receipt for chew toys and shampoo.
Total: $23.45. Thank you for shopping with us.`;

export const FIXTURE_GARBAGE_PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x01, 0x02, 0xff,
]);
