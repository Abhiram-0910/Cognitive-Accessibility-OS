import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FileDown, Loader2, Stethoscope, AlertCircle } from 'lucide-react';

export const ClinicalExport: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);

  const generatePDF = async () => {
    setIsExporting(true);
    try {
      // Look for a specific dashboard container, fallback to the whole body if not found
      const targetElement = document.getElementById('clinical-export-target') || document.body;

      // Capture the DOM element as a high-res canvas
      const canvas = await html2canvas(targetElement, {
        scale: 2, // 2x scale for crisp retina-quality text in the PDF
        useCORS: true,
        logging: false,
        backgroundColor: '#F8FAFC', // Match your slate-50 background
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Initialize A4 PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate image height to maintain aspect ratio
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Add the captured dashboard image
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);

      // --- ADD EXPLICIT CLINICAL DISCLAIMER FOOTER ---
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139); // Tailwind slate-500
      
      const disclaimerText = "This is observational data, not a diagnostic tool.";
      
      // If the image is shorter than the page, put it at the bottom. 
      // If it's longer, put it at the bottom of the first page anyway.
      const footerY = Math.min(imgHeight + 15, pageHeight - 10);
      
      pdf.text(
        disclaimerText,
        pdfWidth / 2,
        footerY,
        { align: 'center' }
      );

      // Trigger the browser download
      pdf.save("Cognitive_Pattern_Summary.pdf");

    } catch (error) {
      console.error("Failed to generate Clinical Export PDF:", error);
      alert("Failed to generate the export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 w-full">
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-light text-slate-800 flex items-center gap-2 tracking-tight">
            <Stethoscope className="w-5 h-5 text-indigo-500" />
            Clinical Data Export
          </h3>
          <p className="text-slate-500 mt-1 text-sm">
            Generate a standardized snapshot for therapists or ADHD coaches.
          </p>
        </div>
        
        <button
          onClick={generatePDF}
          disabled={isExporting}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isExporting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Compiling...</>
          ) : (
            <><FileDown className="w-4 h-4" /> Export PDF</>
          )}
        </button>
      </header>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 items-start">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">
          <strong>Privacy Note:</strong> This report is generated entirely on your local machine. No health data is transmitted to our servers during this process. This export is for observational use only and should not replace professional medical diagnosis.
        </p>
      </div>
    </div>
  );
};