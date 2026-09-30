import jsPDF from 'jspdf';
import { CaseSessionState } from '../types';

export function generateSettlementPdf(caseState: CaseSessionState): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Background border (Official Certificate Frame)
  doc.setDrawColor(15, 12, 27);
  doc.setLineWidth(1.5);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // Header Banner
  doc.setFillColor(124, 58, 237);
  doc.rect(14, 14, pageWidth - 28, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('REFEREE TRIBUNAL · ALTERNATIVE DISPUTE RESOLUTION', pageWidth / 2, 25, { align: 'center' });

  y = 42;

  // Title
  doc.setTextColor(15, 12, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CERTIFICATE OF MEDIATED SETTLEMENT', pageWidth / 2, y, { align: 'center' });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110, 104, 142);
  doc.text(`Governed by Cryptographic Verbatim Evidence · Case ID: ${caseState.id}`, pageWidth / 2, y, { align: 'center' });

  y += 12;

  // Case Metadata Box
  doc.setFillColor(244, 242, 255);
  doc.setDrawColor(15, 12, 27);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'FD');

  doc.setTextColor(15, 12, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);

  doc.text('DISPUTE TITLE:', margin + 6, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(caseState.title, margin + 42, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('CLAIMANT (PARTY A):', margin + 6, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(caseState.partyA, margin + 48, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('RESPONDENT (PARTY B):', margin + 6, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.text(caseState.partyB, margin + 50, y + 21);

  y += 33;

  // Section 1: Agreed Settlement Terms
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(124, 58, 237);
  doc.text('1. BINDING SETTLEMENT AGREEMENT', margin, y);

  y += 6;
  doc.setTextColor(15, 12, 27);
  doc.setFontSize(9.5);

  const oblA = doc.splitTextToSize(`• Party A Obligation: ${caseState.settlement.obligationA}`, contentWidth);
  doc.text(oblA, margin, y);
  y += oblA.length * 5 + 2;

  const oblB = doc.splitTextToSize(`• Party B Obligation: ${caseState.settlement.obligationB}`, contentWidth);
  doc.text(oblB, margin, y);
  y += oblB.length * 5 + 2;

  const fin = doc.splitTextToSize(`• Financial Settlement: ${caseState.settlement.financialAmount}`, contentWidth);
  doc.text(fin, margin, y);
  y += fin.length * 5 + 2;

  const ddl = doc.splitTextToSize(`• Execution Deadline: ${caseState.settlement.executionDeadline}`, contentWidth);
  doc.text(ddl, margin, y);
  y += ddl.length * 5 + 6;

  // Section 2: Grounded Verbatim Claims
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(124, 58, 237);
  doc.text('2. GROUNDED VERBATIM TESTIMONY (EVIDENCE MATRIX)', margin, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(68, 63, 99);

  const claimsToRender = caseState.pinnedClaims.slice(0, 5);
  if (claimsToRender.length === 0) {
    doc.text('No claims on record.', margin, y);
    y += 6;
  } else {
    claimsToRender.forEach((c) => {
      const line = `[${c.timestamp}] ${c.speakerName}: "${c.quote}" — Extracted: ${c.commitment} (${c.category})`;
      const wrapped = doc.splitTextToSize(line, contentWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4.5 + 2;
    });
  }

  y += 6;

  // Section 3: Dual Signatures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(124, 58, 237);
  doc.text('3. BILATERAL DIGITAL SIGNATURES', margin, y);

  y += 8;

  // Party A Signature Box
  doc.setFillColor(244, 242, 255);
  doc.rect(margin, y, (contentWidth - 8) / 2, 22, 'FD');
  doc.setFontSize(9);
  doc.setTextColor(15, 12, 27);
  doc.text(caseState.partyA, margin + 4, y + 6);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(124, 58, 237);
  doc.text(caseState.signedA ? '✓ DIGITALLY SIGNED' : 'PENDING SIGNATURE', margin + 4, y + 14);

  // Party B Signature Box
  const col2X = margin + (contentWidth - 8) / 2 + 8;
  doc.setFillColor(254, 243, 199);
  doc.rect(col2X, y, (contentWidth - 8) / 2, 22, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 12, 27);
  doc.text(caseState.partyB, col2X + 4, y + 6);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(217, 119, 6);
  doc.text(caseState.signedB ? '✓ DIGITALLY SIGNED' : 'PENDING SIGNATURE', col2X + 4, y + 14);

  y += 30;

  // Cryptographic Proof Receipt Footer
  doc.setFillColor(15, 12, 27);
  doc.rect(margin, y, contentWidth, 20, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(250, 204, 21);
  doc.text('CRYPTOGRAPHIC SHA-256 TAMPER-PROOF RECEIPT HASH:', margin + 4, y + 6);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(caseState.recordHash || 'SEAL_PENDING_BILATERAL_EXECUTION', margin + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(188, 183, 217);
  doc.text(`Sealed At: ${caseState.sealedTimestamp || 'Pending'} · Verified by Referee ADR Engine`, margin + 4, y + 17);

  // Save the PDF
  doc.save(`Referee_Settlement_${caseState.id}.pdf`);
}
