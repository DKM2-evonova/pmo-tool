/**
 * Meeting Summary Export Functions
 * Supports PDF and DOCX (Word/Google Docs) formats
 */

import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from 'docx';
import type { Meeting, MeetingRecap, MeetingTone } from '@/types/database';

interface MeetingExportData {
  meeting: Meeting & { project: { id: string; name: string } };
  recap: MeetingRecap;
  tone?: MeetingTone | null;
  showTone?: boolean;
}

// Helper to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Helper to wrap text for PDF
function splitTextForPDF(
  pdf: jsPDF,
  text: string,
  maxWidth: number
): string[] {
  return pdf.splitTextToSize(text, maxWidth);
}

/**
 * Generate PDF from meeting summary
 */
export async function generateMeetingSummaryPDF(
  data: MeetingExportData
): Promise<Blob> {
  const { meeting, recap, tone, showTone } = data;
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = 20;
  const lineHeight = 7;

  // Helper function to add page break if needed
  const checkPageBreak = (requiredSpace: number) => {
    const pageHeight = pdf.internal.pageSize.getHeight();
    if (yPosition + requiredSpace > pageHeight - 20) {
      pdf.addPage();
      yPosition = 20;
    }
  };

  // Title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(meeting.title || 'Meeting Summary', margin, yPosition);
  yPosition += 10;

  // Meeting metadata
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100);
  pdf.text(`Project: ${(meeting.project as any).name}`, margin, yPosition);
  yPosition += 5;
  pdf.text(`Date: ${formatDate(meeting.date)}`, margin, yPosition);
  yPosition += 5;
  if (meeting.category) {
    pdf.text(`Category: ${meeting.category}`, margin, yPosition);
    yPosition += 5;
  }
  if (meeting.attendees && meeting.attendees.length > 0) {
    const attendeeNames = meeting.attendees.map((a) => a.name).join(', ');
    const attendeeLines = splitTextForPDF(
      pdf,
      `Attendees: ${attendeeNames}`,
      contentWidth
    );
    attendeeLines.forEach((line) => {
      pdf.text(line, margin, yPosition);
      yPosition += 4;
    });
  }

  yPosition += 10;
  pdf.setTextColor(0);

  // Executive Summary
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Executive Summary', margin, yPosition);
  yPosition += lineHeight;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const summaryLines = splitTextForPDF(pdf, recap.summary, contentWidth);
  summaryLines.forEach((line) => {
    checkPageBreak(lineHeight);
    pdf.text(line, margin, yPosition);
    yPosition += 5;
  });

  // Key Highlights
  if (recap.highlights && recap.highlights.length > 0) {
    yPosition += 10;
    checkPageBreak(20);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Key Highlights', margin, yPosition);
    yPosition += lineHeight;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    recap.highlights.forEach((highlight, index) => {
      const highlightLines = splitTextForPDF(
        pdf,
        `${index + 1}. ${highlight}`,
        contentWidth - 5
      );
      highlightLines.forEach((line, lineIndex) => {
        checkPageBreak(lineHeight);
        pdf.text(line, margin + (lineIndex === 0 ? 0 : 5), yPosition);
        yPosition += 5;
      });
    });
  }

  // Key Discussion Topics
  if (recap.key_topics && recap.key_topics.length > 0) {
    yPosition += 10;
    checkPageBreak(20);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Key Discussion Topics', margin, yPosition);
    yPosition += lineHeight;

    recap.key_topics.forEach((topic) => {
      checkPageBreak(30);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const topicLines = splitTextForPDF(pdf, topic.topic, contentWidth);
      topicLines.forEach((line) => {
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const discussionLines = splitTextForPDF(pdf, topic.discussion, contentWidth);
      discussionLines.forEach((line) => {
        checkPageBreak(lineHeight);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      if (topic.outcome) {
        pdf.setFont('helvetica', 'italic');
        const outcomeLines = splitTextForPDF(
          pdf,
          `Outcome: ${topic.outcome}`,
          contentWidth
        );
        outcomeLines.forEach((line) => {
          checkPageBreak(lineHeight);
          pdf.text(line, margin, yPosition);
          yPosition += 5;
        });
        pdf.setFont('helvetica', 'normal');
      }
      yPosition += 5;
    });
  }

  // Action Items
  if (recap.action_items_summary && recap.action_items_summary.length > 0) {
    yPosition += 10;
    checkPageBreak(40);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Meeting Action Items', margin, yPosition);
    yPosition += lineHeight + 3;

    // Table header
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, yPosition - 4, contentWidth, 8, 'F');
    pdf.text('Action Item', margin + 2, yPosition);
    pdf.text('Owner', margin + 85, yPosition);
    pdf.text('Due Date', margin + 125, yPosition);
    pdf.text('Status', margin + 155, yPosition);
    yPosition += 8;

    pdf.setFont('helvetica', 'normal');
    recap.action_items_summary.forEach((item) => {
      checkPageBreak(12);
      const titleLines = splitTextForPDF(pdf, item.title, 80);
      const rowHeight = titleLines.length * 5 + 3;

      // Draw row background for alternating rows
      pdf.text(titleLines[0], margin + 2, yPosition);
      pdf.text(item.owner || 'Unassigned', margin + 85, yPosition);
      pdf.text(
        item.due_date ? new Date(item.due_date).toLocaleDateString() : '—',
        margin + 125,
        yPosition
      );
      pdf.text(item.status, margin + 155, yPosition);
      yPosition += rowHeight;
    });
  }

  // Outstanding Topics
  if (recap.outstanding_topics && recap.outstanding_topics.length > 0) {
    yPosition += 10;
    checkPageBreak(30);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Outstanding Topics (Unresolved)', margin, yPosition);
    yPosition += lineHeight;

    recap.outstanding_topics.forEach((topic) => {
      checkPageBreak(25);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      const topicLines = splitTextForPDF(pdf, topic.topic, contentWidth);
      topicLines.forEach((line) => {
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const contextLines = splitTextForPDF(pdf, topic.context, contentWidth);
      contextLines.forEach((line) => {
        checkPageBreak(lineHeight);
        pdf.text(line, margin, yPosition);
        yPosition += 5;
      });

      if (topic.blockers && topic.blockers.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Blockers:', margin + 5, yPosition);
        yPosition += 5;
        pdf.setFont('helvetica', 'normal');
        topic.blockers.forEach((blocker) => {
          checkPageBreak(lineHeight);
          const blockerLines = splitTextForPDF(pdf, `• ${blocker}`, contentWidth - 10);
          blockerLines.forEach((line) => {
            pdf.text(line, margin + 10, yPosition);
            yPosition += 5;
          });
        });
      }

      if (topic.suggested_next_steps && topic.suggested_next_steps.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Suggested Next Steps:', margin + 5, yPosition);
        yPosition += 5;
        pdf.setFont('helvetica', 'normal');
        topic.suggested_next_steps.forEach((step) => {
          checkPageBreak(lineHeight);
          const stepLines = splitTextForPDF(pdf, `→ ${step}`, contentWidth - 10);
          stepLines.forEach((line) => {
            pdf.text(line, margin + 10, yPosition);
            yPosition += 5;
          });
        });
      }
      yPosition += 5;
    });
  }

  // Tone Analysis
  if (showTone && tone) {
    yPosition += 10;
    checkPageBreak(30);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Tone Analysis', margin, yPosition);
    yPosition += lineHeight;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const overallLines = splitTextForPDF(
      pdf,
      `Overall: ${tone.overall}`,
      contentWidth
    );
    overallLines.forEach((line) => {
      checkPageBreak(lineHeight);
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });

    if (tone.participants && tone.participants.length > 0) {
      yPosition += 5;
      tone.participants.forEach((participant) => {
        checkPageBreak(15);
        pdf.setFont('helvetica', 'bold');
        pdf.text(participant.name, margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(
          ` - Happiness: ${participant.happiness}, Buy-in: ${participant.buy_in}`,
          margin + pdf.getTextWidth(participant.name),
          yPosition
        );
        yPosition += 5;
        if (participant.tone) {
          const toneLines = splitTextForPDF(pdf, participant.tone, contentWidth - 10);
          toneLines.forEach((line) => {
            checkPageBreak(lineHeight);
            pdf.text(line, margin + 5, yPosition);
            yPosition += 5;
          });
        }
      });
    }
  }

  // Footer
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
      margin,
      pdf.internal.pageSize.getHeight() - 10
    );
  }

  return pdf.output('blob');
}

/**
 * Generate DOCX from meeting summary (compatible with Word and Google Docs)
 */
export async function generateMeetingSummaryDOCX(
  data: MeetingExportData
): Promise<Blob> {
  const { meeting, recap, tone, showTone } = data;

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: meeting.title || 'Meeting Summary',
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    })
  );

  // Metadata
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Project: ', bold: true }),
        new TextRun({ text: (meeting.project as any).name }),
      ],
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Date: ', bold: true }),
        new TextRun({ text: formatDate(meeting.date) }),
      ],
      spacing: { after: 100 },
    })
  );

  if (meeting.category) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Category: ', bold: true }),
          new TextRun({ text: meeting.category }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  if (meeting.attendees && meeting.attendees.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Attendees: ', bold: true }),
          new TextRun({ text: meeting.attendees.map((a) => a.name).join(', ') }),
        ],
        spacing: { after: 300 },
      })
    );
  }

  // Executive Summary
  children.push(
    new Paragraph({
      text: 'Executive Summary',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      text: recap.summary,
      spacing: { after: 200 },
    })
  );

  // Key Highlights
  if (recap.highlights && recap.highlights.length > 0) {
    children.push(
      new Paragraph({
        text: 'Key Highlights',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );

    recap.highlights.forEach((highlight, index) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${index + 1}. `, bold: true }),
            new TextRun({ text: highlight }),
          ],
          spacing: { after: 100 },
        })
      );
    });
  }

  // Key Discussion Topics
  if (recap.key_topics && recap.key_topics.length > 0) {
    children.push(
      new Paragraph({
        text: 'Key Discussion Topics',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    recap.key_topics.forEach((topic) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: topic.topic, bold: true }),
            new TextRun({
              text: topic.outcome ? ' (Resolved)' : ' (Open)',
              italics: true,
              color: topic.outcome ? '22C55E' : 'F59E0B',
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );

      children.push(
        new Paragraph({
          text: topic.discussion,
          spacing: { after: 100 },
        })
      );

      if (topic.participants && topic.participants.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Participants: ', italics: true, color: '6B7280' }),
              new TextRun({ text: topic.participants.join(', '), color: '6B7280' }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      if (topic.outcome) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Outcome: ', bold: true, color: '16A34A' }),
              new TextRun({ text: topic.outcome }),
            ],
            spacing: { after: 200 },
          })
        );
      }
    });
  }

  // Action Items Table
  if (recap.action_items_summary && recap.action_items_summary.length > 0) {
    children.push(
      new Paragraph({
        text: 'Meeting Action Items',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const tableRows = [
      // Header row
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Action Item', alignment: AlignmentType.LEFT })],
            shading: { fill: 'F3F4F6' },
            width: { size: 40, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Owner', alignment: AlignmentType.LEFT })],
            shading: { fill: 'F3F4F6' },
            width: { size: 20, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Due Date', alignment: AlignmentType.LEFT })],
            shading: { fill: 'F3F4F6' },
            width: { size: 20, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Status', alignment: AlignmentType.LEFT })],
            shading: { fill: 'F3F4F6' },
            width: { size: 20, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
      // Data rows
      ...recap.action_items_summary.map(
        (item) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ text: item.title })],
              }),
              new TableCell({
                children: [new Paragraph({ text: item.owner || 'Unassigned' })],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    text: item.due_date
                      ? new Date(item.due_date).toLocaleDateString()
                      : '—',
                  }),
                ],
              }),
              new TableCell({
                children: [new Paragraph({ text: item.status })],
              }),
            ],
          })
      ),
    ];

    const table = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });

    children.push(table as unknown as Paragraph);
  }

  // Outstanding Topics
  if (recap.outstanding_topics && recap.outstanding_topics.length > 0) {
    children.push(
      new Paragraph({
        text: 'Outstanding Topics (Unresolved)',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    recap.outstanding_topics.forEach((topic) => {
      children.push(
        new Paragraph({
          text: topic.topic,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );

      children.push(
        new Paragraph({
          text: topic.context,
          spacing: { after: 100 },
        })
      );

      if (topic.blockers && topic.blockers.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Blockers:', bold: true, color: 'DC2626' })],
            spacing: { before: 100, after: 50 },
          })
        );
        topic.blockers.forEach((blocker) => {
          children.push(
            new Paragraph({
              text: `• ${blocker}`,
              indent: { left: 360 },
              spacing: { after: 50 },
            })
          );
        });
      }

      if (topic.suggested_next_steps && topic.suggested_next_steps.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Suggested Next Steps:', bold: true, color: '2563EB' })],
            spacing: { before: 100, after: 50 },
          })
        );
        topic.suggested_next_steps.forEach((step) => {
          children.push(
            new Paragraph({
              text: `→ ${step}`,
              indent: { left: 360 },
              spacing: { after: 50 },
            })
          );
        });
      }
    });
  }

  // Tone Analysis
  if (showTone && tone) {
    children.push(
      new Paragraph({
        text: 'Tone Analysis',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Overall Meeting Tone: ', bold: true }),
          new TextRun({ text: tone.overall }),
        ],
        spacing: { after: 200 },
      })
    );

    if (tone.participants && tone.participants.length > 0) {
      children.push(
        new Paragraph({
          text: 'Participant Analysis',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      tone.participants.forEach((participant) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: participant.name, bold: true }),
              new TextRun({
                text: ` — Happiness: ${participant.happiness}, Buy-in: ${participant.buy_in}`,
              }),
            ],
            spacing: { before: 100, after: 50 },
          })
        );
        if (participant.tone) {
          children.push(
            new Paragraph({
              text: participant.tone,
              indent: { left: 360 },
              spacing: { after: 100 },
            })
          );
        }
      });
    }
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString()}`,
          italics: true,
          color: '9CA3AF',
          size: 18,
        }),
      ],
      spacing: { before: 400 },
    })
  );

  const doc = new Document({
    sections: [
      {
        children: children as any[],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Download meeting summary in specified format
 */
export async function downloadMeetingSummary(
  data: MeetingExportData,
  format: 'pdf' | 'docx'
): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  const projectName = (data.meeting.project as any).name.replace(/\s+/g, '_');
  const meetingTitle = (data.meeting.title || 'meeting').replace(/\s+/g, '_');
  const filename = `${projectName}_${meetingTitle}_${timestamp}`;

  let blob: Blob;
  let extension: string;
  let mimeType: string;

  if (format === 'pdf') {
    blob = await generateMeetingSummaryPDF(data);
    extension = 'pdf';
    mimeType = 'application/pdf';
  } else {
    blob = await generateMeetingSummaryDOCX(data);
    extension = 'docx';
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  // Create download link
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}





















