import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

interface Field {
  id: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
}

export async function getPageCount(pdfPath: string): Promise<number> {
  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

export async function applyFieldsToPdf(
  pdfPath: string,
  fields: Field[]
): Promise<Buffer> {
  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  for (const field of fields) {
    if (!field.value) continue;

    const page = pdfDoc.getPage(field.page - 1);
    const pageHeight = page.getHeight();

    if (field.type === 'signature') {
      try {
        // Signature value is base64 PNG data URL
        const base64Data = field.value.replace(/^data:image\/png;base64,/, '');
        const sigBytes = Buffer.from(base64Data, 'base64');
        const sigImage = await pdfDoc.embedPng(sigBytes);

        page.drawImage(sigImage, {
          x: field.x,
          y: pageHeight - field.y - field.height,
          width: field.width,
          height: field.height,
        });
      } catch (error) {
        console.error('Error embedding signature:', error);
      }
    } else if (field.type === 'text' || field.type === 'date') {
      page.drawText(field.value, {
        x: field.x,
        y: pageHeight - field.y - 12,
        size: 12,
        color: rgb(0, 0, 0),
      });
    }
  }

  const savedPdf = await pdfDoc.save();
  return Buffer.from(savedPdf);
}

export async function saveFinalPdf(
  pdfPath: string,
  fields: Field[],
  outputDir: string
): Promise<string> {
  const pdfBuffer = await applyFieldsToPdf(pdfPath, fields);
  const baseName = path.basename(pdfPath, '.pdf');
  const outputPath = path.join(outputDir, `${baseName}_signed.pdf`);
  await fs.writeFile(outputPath, pdfBuffer);
  return outputPath;
}
