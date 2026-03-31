// src/export-pdf.ts
import { PDFDocument } from "pdf-lib"

export async function pngToPdf(png: Buffer | Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const image = await doc.embedPng(png)
  const { width, height } = image.scale(1)

  const page = doc.addPage([width, height])
  page.drawImage(image, { x: 0, y: 0, width, height })

  return doc.save()
}
