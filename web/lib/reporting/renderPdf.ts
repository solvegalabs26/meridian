import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'
import type { CohortReportSections } from './types'

// ── Brand palette ──────────────────────────────────────────────────────────
const NAVY  = rgb(11/255,  24/255,  41/255)   // #0B1829
const GOLD  = rgb(201/255,168/255,  76/255)   // #C9A84C
const SLATE = rgb(100/255,116/255, 139/255)   // muted text
const LIGHT = rgb(245/255,247/255, 250/255)   // section bg
const WHITE = rgb(1, 1, 1)
const BLACK = rgb(0.1, 0.1, 0.1)

// ── Page geometry ──────────────────────────────────────────────────────────
const W = 612   // Letter width pts
const H = 792   // Letter height pts
const ML = 48   // margin left
const MR = 48   // margin right
const CONTENT_W = W - ML - MR

interface DrawCtx {
  page: PDFPage
  font: PDFFont
  bold: PDFFont
  y: number
  doc: PDFDocument
  addPage: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ensureSpace(ctx: DrawCtx, needed: number) {
  if (ctx.y - needed < 60) ctx.addPage()
}

function drawText(ctx: DrawCtx, text: string, x: number, size: number, color = BLACK, font?: PDFFont) {
  ctx.page.drawText(text, { x, y: ctx.y, size, color, font: font ?? ctx.font })
}

function drawRect(ctx: DrawCtx, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, color })
}

function sectionHeader(ctx: DrawCtx, title: string) {
  ensureSpace(ctx, 44)
  // Gold left bar
  drawRect(ctx, ML, ctx.y - 2, 3, 18, GOLD)
  ctx.page.drawText(title.toUpperCase(), {
    x: ML + 10, y: ctx.y,
    size: 9, color: NAVY, font: ctx.bold,
    letterSpacing: 1.2,
  })
  ctx.y -= 22
  // Hairline
  ctx.page.drawLine({ start: { x: ML, y: ctx.y }, end: { x: W - MR, y: ctx.y }, thickness: 0.5, color: rgb(0.88, 0.89, 0.9) })
  ctx.y -= 12
}

function statRow(ctx: DrawCtx, label: string, value: string) {
  ensureSpace(ctx, 18)
  ctx.page.drawText(label, { x: ML + 4, y: ctx.y, size: 10, color: SLATE, font: ctx.font })
  ctx.page.drawText(value, { x: ML + 200, y: ctx.y, size: 10, color: BLACK, font: ctx.bold })
  ctx.y -= 16
}

function tableHeader(ctx: DrawCtx, cols: { label: string; x: number }[]) {
  ensureSpace(ctx, 20)
  drawRect(ctx, ML, ctx.y - 3, CONTENT_W, 16, LIGHT)
  for (const col of cols) {
    ctx.page.drawText(col.label.toUpperCase(), {
      x: col.x, y: ctx.y,
      size: 8, color: SLATE, font: ctx.bold, letterSpacing: 0.8,
    })
  }
  ctx.y -= 18
}

function tableRow(ctx: DrawCtx, cells: { text: string; x: number }[], shade: boolean) {
  ensureSpace(ctx, 16)
  if (shade) drawRect(ctx, ML, ctx.y - 3, CONTENT_W, 14, rgb(0.97, 0.98, 0.99))
  for (const cell of cells) {
    ctx.page.drawText(cell.text, { x: cell.x, y: ctx.y, size: 9, color: BLACK, font: ctx.font })
  }
  ctx.y -= 15
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Main render ────────────────────────────────────────────────────────────

export async function renderCohortPdf(
  orgName: string,
  periodLabel: string,
  sections: CohortReportSections
): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let currentPage = doc.addPage([W, H])

  const ctx: DrawCtx = {
    page: currentPage,
    font,
    bold,
    y: H - 48,
    doc,
    addPage: () => {
      currentPage = doc.addPage([W, H])
      ctx.page = currentPage
      ctx.y = H - 48
      // mini header on continuation pages
      ctx.page.drawText(`Meridian Arc · ${orgName}`, {
        x: ML, y: H - 28, size: 8, color: SLATE, font,
      })
      ctx.page.drawText(periodLabel, {
        x: W - MR - 120, y: H - 28, size: 8, color: SLATE, font,
      })
      ctx.page.drawLine({
        start: { x: ML, y: H - 34 }, end: { x: W - MR, y: H - 34 },
        thickness: 0.5, color: rgb(0.88, 0.89, 0.9),
      })
      ctx.y = H - 52
    },
  }

  // ── Cover header ──────────────────────────────────────────────────────────
  // Navy header bar
  ctx.page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: NAVY })
  // Gold accent line
  ctx.page.drawRectangle({ x: 0, y: H - 93, width: W, height: 3, color: GOLD })
  ctx.page.drawText('MERIDIAN ARC', { x: ML, y: H - 36, size: 11, color: GOLD, font: bold, letterSpacing: 2 })
  ctx.page.drawText('Outcome Intelligence Platform', { x: ML, y: H - 52, size: 9, color: rgb(0.7, 0.76, 0.84), font })
  ctx.page.drawText(orgName, { x: ML, y: H - 70, size: 18, color: WHITE, font: bold })
  ctx.page.drawText(periodLabel, { x: W - MR - 130, y: H - 70, size: 9, color: rgb(0.7, 0.76, 0.84), font })

  ctx.y = H - 110

  // ── Sections ──────────────────────────────────────────────────────────────

  // 1. Cohort Overview
  if (sections.cohortOverview) {
    const d = sections.cohortOverview
    ctx.y -= 8
    sectionHeader(ctx, 'Cohort Overview')
    statRow(ctx, 'Total enrolled', String(d.totalEnrolled))
    statRow(ctx, 'Active this week', String(d.activeThisWeek))
    statRow(ctx, 'Sweep completion rate', `${d.sweepCompletionRate}%`)
    statRow(ctx, 'Avg objectives / user', String(d.avgObjectivesPerUser))
    ctx.y -= 8
  }

  // 2. Objective Tracking
  if (sections.objectiveTracking) {
    const d = sections.objectiveTracking
    ctx.y -= 4
    sectionHeader(ctx, 'Objective Tracking')
    statRow(ctx, '% with target date', `${d.pctWithTargetDate}%`)
    ctx.y -= 4

    if (d.byCategory.length > 0) {
      tableHeader(ctx, [
        { label: 'Category', x: ML + 4 },
        { label: 'Count', x: ML + 160 },
        { label: 'Avg Confidence', x: ML + 240 },
      ])
      d.byCategory.forEach((row, i) => {
        tableRow(ctx, [
          { text: capitalize(row.category), x: ML + 4 },
          { text: String(row.count), x: ML + 160 },
          { text: `${row.avgConfidence}%`, x: ML + 240 },
        ], i % 2 === 0)
      })
    }
    ctx.y -= 8
  }

  // 3. Confidence Trends
  if (sections.confidenceTrends) {
    const d = sections.confidenceTrends
    ctx.y -= 4
    sectionHeader(ctx, 'Confidence Trends')

    if (d.cycles.length === 0) {
      drawText(ctx, 'No sweep data available for this period.', ML + 4, 10, SLATE)
      ctx.y -= 16
    } else {
      // Simple bar-style text chart
      const barWidth = Math.floor((CONTENT_W - 40) / d.cycles.length)
      for (const cycle of d.cycles) {
        ensureSpace(ctx, 50)
        const barH = Math.max(4, Math.round((cycle.avgConfidence / 100) * 40))
        const barX = ML + 4 + d.cycles.indexOf(cycle) * barWidth
        // Bar
        ctx.page.drawRectangle({ x: barX, y: ctx.y - barH, width: barWidth - 6, height: barH, color: NAVY })
        // Value label
        ctx.page.drawText(`${cycle.avgConfidence}%`, {
          x: barX + 2, y: ctx.y - barH - 12, size: 8, color: BLACK, font: bold,
        })
        // Date label
        ctx.page.drawText(cycle.label, {
          x: barX, y: ctx.y - barH - 22, size: 7, color: SLATE, font,
        })
      }
      ctx.y -= 52
    }
    ctx.y -= 8
  }

  // 4. Sweep Activity
  if (sections.sweepActivity) {
    const d = sections.sweepActivity
    ctx.y -= 4
    sectionHeader(ctx, 'Sweep Activity')
    statRow(ctx, 'Sweeps completed this period', String(d.sweepsThisPeriod))
    statRow(ctx, '% users with ≥1 sweep', `${d.pctUsersWithSweep}%`)
    statRow(ctx, 'Users with no sweep (missed)', String(d.missedSweepCount))
    ctx.y -= 8
  }

  // 5. Cross-Dep Flags
  if (sections.crossDepFlags) {
    const d = sections.crossDepFlags
    ctx.y -= 4
    sectionHeader(ctx, 'Cross-Objective Dependency Flags')
    statRow(ctx, 'Total cross-dep flags surfaced', String(d.totalCrossDepFlags))
    statRow(ctx, 'Objectives with flags', String(d.objectivesWithFlags))
    ctx.y -= 8
  }

  // 6. Engagement Summary
  if (sections.engagementSummary) {
    const d = sections.engagementSummary
    ctx.y -= 4
    sectionHeader(ctx, 'Engagement Summary')
    statRow(ctx, 'Ask Meridian queries this period', String(d.askQueriesTotal))
    statRow(ctx, 'Actions logged this period', String(d.actionsLoggedTotal))
    ctx.y -= 4

    if (d.lastActiveDistribution.length > 0) {
      ctx.page.drawText('Last-active distribution', { x: ML + 4, y: ctx.y, size: 8, color: SLATE, font: bold })
      ctx.y -= 12
      tableHeader(ctx, [
        { label: 'Bucket', x: ML + 4 },
        { label: 'Users', x: ML + 180 },
      ])
      d.lastActiveDistribution.forEach((row, i) => {
        tableRow(ctx, [
          { text: row.bucket, x: ML + 4 },
          { text: String(row.count), x: ML + 180 },
        ], i % 2 === 0)
      })
    }
    ctx.y -= 8
  }

  // 7. Predictions Active
  if (sections.predictionsActive) {
    const d = sections.predictionsActive
    ctx.y -= 4
    sectionHeader(ctx, 'Active Predictions')
    statRow(ctx, 'Total predictions across cohort', String(d.totalPredictions))
    statRow(ctx, 'Avg days to horizon', d.avgHorizonDays > 0 ? String(d.avgHorizonDays) : 'Past horizon')
    statRow(ctx, '% with pending outcome', `${d.pctPendingOutcome}%`)
    ctx.y -= 8
  }

  // 8. Top Signals
  if (sections.topSignals && sections.topSignals.keywords.length > 0) {
    const d = sections.topSignals
    ctx.y -= 4
    sectionHeader(ctx, 'Top Signals (Anonymized)')
    tableHeader(ctx, [
      { label: 'Keyword / Signal', x: ML + 4 },
      { label: 'Occurrences', x: ML + 280 },
    ])
    d.keywords.forEach((kw, i) => {
      tableRow(ctx, [
        { text: kw.keyword, x: ML + 4 },
        { text: String(kw.count), x: ML + 280 },
      ], i % 2 === 0)
    })
    ctx.y -= 8
  }

  // ── Footer on all pages ────────────────────────────────────────────────────
  const pages = doc.getPages()
  const footerText = `Data shared under ${orgName} × Meridian Arc partnership agreement. Individual data anonymized. Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
  for (const p of pages) {
    p.drawLine({ start: { x: ML, y: 42 }, end: { x: W - MR, y: 42 }, thickness: 0.5, color: rgb(0.88, 0.89, 0.9) })
    p.drawText(footerText, { x: ML, y: 28, size: 7, color: SLATE, font, maxWidth: CONTENT_W })
    p.drawText(`meridianarc.ai · Confidential`, { x: W - MR - 110, y: 28, size: 7, color: SLATE, font })
  }

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
