// lib/utils/reportGenerator.ts
import type {
  AnalysisData,
  SubjectAnalysis,
  TopicAnalysis,
  SubtopicAnalysis,
} from "@/lib/utils/studentAnalysis";

interface ReportOptions {
  studentName: string;
  studentEmail?: string;
  testTitle?: string;
  analysisData: AnalysisData;
  generatedAt: Date;
}

/**
 * Generate CSV content for the report
 */
export function generateCSVReport(options: ReportOptions): string {
  const { studentName, studentEmail, testTitle, analysisData, generatedAt } = options;
  
  const lines: string[] = [];
  
  // Header
  lines.push("Student Performance Report");
  lines.push(`Student Name: ${studentName}`);
  if (studentEmail) {
    lines.push(`Student Email: ${studentEmail}`);
  }
  if (testTitle) {
    lines.push(`Test: ${testTitle}`);
  } else {
    lines.push("Report Type: Combined (All Tests)");
  }
  lines.push(`Generated At: ${generatedAt.toLocaleString()}`);
  lines.push("");
  
  // Subject-wise analysis
  if (analysisData.subjectWise.length > 0) {
    lines.push("SUBJECT-WISE ANALYSIS");
    lines.push("Subject,Total Questions,Correct,Incorrect,Unanswered,Accuracy (%),Marks Obtained,Marks Possible");
    analysisData.subjectWise.forEach(item => {
      const accuracy = item.stats.answered > 0 
        ? ((item.stats.correct / item.stats.answered) * 100).toFixed(2)
        : "0.00";
      lines.push(
        `"${item.subject}",${item.stats.total},${item.stats.correct},${item.stats.incorrect},${item.stats.unanswered},${accuracy},${item.stats.marksObtained.toFixed(2)},${item.stats.marksPossible.toFixed(2)}`
      );
    });
    lines.push("");
  }
  
  // Topic-wise analysis
  if (analysisData.topicWise.length > 0) {
    lines.push("TOPIC-WISE ANALYSIS");
    lines.push("Subject,Topic,Total Questions,Correct,Incorrect,Unanswered,Accuracy (%),Marks Obtained,Marks Possible");
    analysisData.topicWise.forEach(item => {
      const accuracy = item.stats.answered > 0 
        ? ((item.stats.correct / item.stats.answered) * 100).toFixed(2)
        : "0.00";
      lines.push(
        `"${item.subject}","${item.topic}",${item.stats.total},${item.stats.correct},${item.stats.incorrect},${item.stats.unanswered},${accuracy},${item.stats.marksObtained.toFixed(2)},${item.stats.marksPossible.toFixed(2)}`
      );
    });
    lines.push("");
  }
  
  // Subtopic-wise analysis
  if (analysisData.subtopicWise.length > 0) {
    lines.push("SUBTOPIC-WISE ANALYSIS");
    lines.push("Subject,Topic,Subtopic,Total Questions,Correct,Incorrect,Unanswered,Accuracy (%),Marks Obtained,Marks Possible");
    analysisData.subtopicWise.forEach(item => {
      const accuracy = item.stats.answered > 0 
        ? ((item.stats.correct / item.stats.answered) * 100).toFixed(2)
        : "0.00";
      lines.push(
        `"${item.subject}","${item.topic}","${item.subtopic}",${item.stats.total},${item.stats.correct},${item.stats.incorrect},${item.stats.unanswered},${accuracy},${item.stats.marksObtained.toFixed(2)},${item.stats.marksPossible.toFixed(2)}`
      );
    });
  }
  
  return lines.join("\n");
}

/**
 * Generate HTML report content
 */
export function generateHTMLReport(options: ReportOptions): string {
  const { studentName, studentEmail, testTitle, analysisData, generatedAt } = options;
  
  const formatAccuracy = (stats: SubjectAnalysis["stats"]) => {
    if (stats.answered === 0) return "N/A";
    return `${stats.accuracy.toFixed(2)}%`;
  };
  
  const getAccuracyClass = (accuracy: number) => {
    if (accuracy >= 70) return "text-green-600";
    if (accuracy >= 50) return "text-yellow-600";
    return "text-red-600";
  };
  
  const renderTable = (
    title: string,
    headers: string[],
    rows: string[][]
  ) => {
    if (rows.length === 0) return "";
    
    return `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">${title}</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #f9fafb; border-bottom: 2px solid #d1d5db;">
              ${headers.map(h => `<th style="padding: 10px; text-align: left; font-weight: 600; color: #374151;">${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, idx) => `
              <tr style="border-bottom: 1px solid #e5e7eb; ${idx % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f9fafb;'}">
                ${row.map(cell => `<td style="padding: 10px; color: #1f2937;">${cell}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  };
  
  // Subject-wise rows
  const subjectRows = analysisData.subjectWise.map(item => [
    item.subject,
    item.stats.total.toString(),
    `<span style="color: #16a34a; font-weight: 600;">${item.stats.correct}</span>`,
    `<span style="color: #dc2626; font-weight: 600;">${item.stats.incorrect}</span>`,
    item.stats.unanswered.toString(),
    item.stats.answered > 0 
      ? `<span style="color: ${getAccuracyClass(item.stats.accuracy)}; font-weight: 600;">${formatAccuracy(item.stats)}</span>`
      : "N/A",
    `${item.stats.marksObtained.toFixed(2)} / ${item.stats.marksPossible.toFixed(2)}`
  ]);
  
  // Topic-wise rows
  const topicRows = analysisData.topicWise.map(item => [
    item.subject,
    item.topic,
    item.stats.total.toString(),
    `<span style="color: #16a34a; font-weight: 600;">${item.stats.correct}</span>`,
    `<span style="color: #dc2626; font-weight: 600;">${item.stats.incorrect}</span>`,
    item.stats.unanswered.toString(),
    item.stats.answered > 0 
      ? `<span style="color: ${getAccuracyClass(item.stats.accuracy)}; font-weight: 600;">${formatAccuracy(item.stats)}</span>`
      : "N/A",
    `${item.stats.marksObtained.toFixed(2)} / ${item.stats.marksPossible.toFixed(2)}`
  ]);
  
  // Subtopic-wise rows
  const subtopicRows = analysisData.subtopicWise.map(item => [
    item.subject,
    item.topic,
    item.subtopic,
    item.stats.total.toString(),
    `<span style="color: #16a34a; font-weight: 600;">${item.stats.correct}</span>`,
    `<span style="color: #dc2626; font-weight: 600;">${item.stats.incorrect}</span>`,
    item.stats.unanswered.toString(),
    item.stats.answered > 0 
      ? `<span style="color: ${getAccuracyClass(item.stats.accuracy)}; font-weight: 600;">${formatAccuracy(item.stats)}</span>`
      : "N/A",
    `${item.stats.marksObtained.toFixed(2)} / ${item.stats.marksPossible.toFixed(2)}`
  ]);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Student Performance Report - ${studentName}</title>
      <style>
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px; background-color: #ffffff; color: #1f2937; max-width: 1200px; margin: 0 auto;">
      <div style="margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px;">
        <h1 style="color: #1f2937; font-size: 28px; font-weight: 700; margin: 0 0 10px 0;">Student Performance Report</h1>
        <div style="color: #6b7280; font-size: 14px; line-height: 1.8;">
          <p style="margin: 5px 0;"><strong>Student Name:</strong> ${studentName}</p>
          ${studentEmail ? `<p style="margin: 5px 0;"><strong>Email:</strong> ${studentEmail}</p>` : ""}
          ${testTitle ? `<p style="margin: 5px 0;"><strong>Test:</strong> ${testTitle}</p>` : '<p style="margin: 5px 0;"><strong>Report Type:</strong> Combined (All Tests)</p>'}
          <p style="margin: 5px 0;"><strong>Generated At:</strong> ${generatedAt.toLocaleString()}</p>
        </div>
      </div>
      
      ${renderTable(
        "Subject-wise Analysis",
        ["Subject", "Total", "Correct", "Incorrect", "Unanswered", "Accuracy", "Marks"],
        subjectRows
      )}
      
      ${renderTable(
        "Topic-wise Analysis",
        ["Subject", "Topic", "Total", "Correct", "Incorrect", "Unanswered", "Accuracy", "Marks"],
        topicRows
      )}
      
      ${renderTable(
        "Subtopic-wise Analysis",
        ["Subject", "Topic", "Subtopic", "Total", "Correct", "Incorrect", "Unanswered", "Accuracy", "Marks"],
        subtopicRows
      )}
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #6b7280; font-size: 11px; text-align: center;">
        <p>This report was generated automatically by TestPrep Pro</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Download report as CSV
 */
export function downloadCSVReport(options: ReportOptions, filename?: string): void {
  const csvContent = generateCSVReport(options);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename || `student-report-${Date.now()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download report as HTML (can be printed as PDF)
 */
export function downloadHTMLReport(options: ReportOptions, filename?: string): void {
  const htmlContent = generateHTMLReport(options);
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename || `student-report-${Date.now()}.html`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Open report in new window for printing
 */
export function printReport(options: ReportOptions): void {
  const htmlContent = generateHTMLReport(options);
  const printWindow = window.open("", "_blank");
  
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

