// Simplified PDF generator using jsPDF
// Note: In a real environment, you'd include the jsPDF library via CDN in the HTML.
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

export async function generateInvoice(patientData, billData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.text("HMS - HOSPITAL INVOICE", 105, 20, { align: "center" });

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
    doc.text(`${billData.roomCharges}$`, 170, 95);

    doc.text("Medicine Costs", 20, 105);
    doc.text(`${billData.medicineCosts}$`, 170, 105);

    doc.text("Doctor Fees", 20, 115);
    doc.text(`${billData.doctorFees}$`, 170, 115);

    doc.line(20, 125, 190, 125);
    doc.setFontSize(14);
    doc.setTextColor(13, 110, 253); // text-primary
    doc.text("TOTAL COST", 20, 135);
    doc.text(`${billData.total}$`, 170, 135);

    // Footer
    doc.setTextColor(100);
    doc.setFontSize(10);
    doc.text("Thank you for choosing HMS. Get well soon!", 105, 160, { align: "center" });

    // Save PDF
    doc.save(`invoice_${patientData.fullName.replace(/\s+/g, '_')}.pdf`);
}
