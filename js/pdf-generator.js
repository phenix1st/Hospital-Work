// Simplified PDF generator using jsPDF
// Note: In a real environment, you'd include the jsPDF library via CDN in the HTML.
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

export async function generateInvoice(patientData, billData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const translations = window.translations || {};
    const currentLanguage = window.currentLanguage || 'en';

    // Header
    doc.setFontSize(22);
    const clinicName = translations[currentLanguage]?.title || "Clinique Online";
    doc.text(`${clinicName} - HOSPITAL INVOICE`, 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.text(`Invoice Date: ${new Date().toLocaleDateString()}`, 20, 40);
    doc.text(`Patient Name: ${patientData.fullName}`, 20, 50);
    doc.text(`Address: ${patientData.address}`, 20, 60);

    // Bill Details
    doc.line(20, 70, 190, 70);
    doc.text("Description", 20, 80);
    doc.text("Cost", 170, 80);
    doc.line(20, 85, 190, 85);

    doc.text("Room Charges", 20, 95);
    doc.text(`${billData.roomCharges} ${translations[currentLanguage]?.currency || 'DA'}`, 170, 95);

    doc.text("Medicine Costs", 20, 105);
    doc.text(`${billData.medicineCosts} ${translations[currentLanguage]?.currency || 'DA'}`, 170, 105);

    doc.text("Doctor Fees", 20, 115);
    doc.text(`${billData.doctorFees} ${translations[currentLanguage]?.currency || 'DA'}`, 170, 115);

    doc.line(20, 125, 190, 125);
    doc.setFontSize(14);
    doc.setTextColor(13, 110, 253); // text-primary
    doc.text("TOTAL COST", 20, 135);
    doc.text(`${billData.total} ${translations[currentLanguage]?.currency || 'DA'}`, 170, 135);

    // Footer
    doc.setTextColor(100);
    doc.setFontSize(10);
    const footerMsg = translations[currentLanguage]?.footer_thanks || "Thank you for choosing us. Get well soon!";
    doc.text(footerMsg.replace("{clinic}", clinicName), 105, 160, { align: "center" });

    // Save PDF
    doc.save(`invoice_${patientData.fullName.replace(/\s+/g, '_')}.pdf`);
}

export async function generateCertificate(doctorData, patientData, certData, shouldSave = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    const translations = window.translations || {};
    const currentLanguage = window.currentLanguage || 'en';

    try {
        // Border
        doc.setDrawColor(13, 110, 253); // Primary color
        doc.setLineWidth(1);
        doc.rect(10, 10, pageWidth - 20, doc.internal.pageSize.getHeight() - 20);

        // Header - Clinic Branding
        doc.setFontSize(24);
        doc.setTextColor(13, 110, 253);
        doc.setFont("helvetica", "bold");
        const clinicName = translations[currentLanguage]?.title || "CLINIQUE ONLINE";
        doc.text(clinicName.toUpperCase(), pageWidth / 2, 30, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text("123 Medical Drive, Health City, Algeria | +213 555 123 456", pageWidth / 2, 38, { align: "center" });
        doc.line(margin, 45, pageWidth - margin, 45);

        // Title
        doc.setFontSize(18);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(translations[currentLanguage]?.certificate_header || "MEDICAL CERTIFICATE", pageWidth / 2, 60, { align: "center" });

        // Certificate Details
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");

        let y = 80;
        doc.setFont("helvetica", "bold");
        const dateLabel = translations[currentLanguage]?.date || 'Date';
        doc.text(`${dateLabel}:`, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(certData.sessionDate, margin + 40, y);

        y += 10;
        doc.setFont("helvetica", "bold");
        const doctorLabel = translations[currentLanguage]?.doctor || 'Doctor';
        doc.text(`${doctorLabel}:`, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(doctorData.fullName, margin + 40, y);

        y += 10;
        doc.setFont("helvetica", "bold");
        const patientLabel = translations[currentLanguage]?.patient || 'Patient';
        doc.text(`${patientLabel}:`, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(patientData.fullName, margin + 40, y);

        y += 20;
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

        // Diagnosis Section
        doc.setFont("helvetica", "bold");
        const diagLabel = translations[currentLanguage]?.diagnosis_label || 'Diagnosis';
        doc.text(`${diagLabel}:`, margin, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        const diagLines = doc.splitTextToSize(certData.diagnosis, pageWidth - (margin * 2));
        doc.text(diagLines, margin, y);
        y += (diagLines.length * 6) + 10;

        // Medications Section
        doc.setFont("helvetica", "bold");
        const medLabel = translations[currentLanguage]?.medications_label || 'Recommended Medications';
        doc.text(`${medLabel}:`, margin, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        const medLines = doc.splitTextToSize(certData.medications, pageWidth - (margin * 2));
        doc.text(medLines, margin, y);

        // Signature Area
        y = doc.internal.pageSize.getHeight() - 50;
        doc.line(pageWidth - 80, y, pageWidth - margin, y);
        doc.setFontSize(10);
        doc.text("Doctor's Signature & Stamp", pageWidth - 50, y + 5, { align: "center" });

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("This is an electronically generated document.", pageWidth / 2, doc.internal.pageSize.getHeight() - 15, { align: "center" });

        if (shouldSave) {
            doc.save(`certificate_${patientData.fullName.replace(/\s+/g, '_')}.pdf`);
        }
        return doc;
    } catch (error) {
        console.error("PDF Generation failed:", error);
        throw error;
    }
}
