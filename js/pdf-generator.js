// Simplified PDF generator using jsPDF
// Note: In a real environment, you'd include the jsPDF library via CDN in the HTML.
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

export async function generateInvoice(patientData, billData) {
    const translations = window.translations || {};
    const currentLanguage = window.currentLanguage || 'en';
    const isRTL = currentLanguage === 'ar';

    const clinicName = translations[currentLanguage]?.title || "Online Clinic";
    const dateLabel = translations[currentLanguage]?.date || 'Date';
    const patientLabel = translations[currentLanguage]?.patient || 'Patient';
    const addressLabel = translations[currentLanguage]?.address_label || 'Address';
    const descLabel = translations[currentLanguage]?.description || 'Description';
    const costLabel = translations[currentLanguage]?.cost || 'Cost';
    const roomLabel = translations[currentLanguage]?.room_charges || 'Room Charges';
    const medLabel = translations[currentLanguage]?.medicine_costs || 'Medicine Costs';
    const doctorLabel = translations[currentLanguage]?.doctor_fees || 'Doctor Fees';
    const totalLabel = translations[currentLanguage]?.total_cost || 'TOTAL COST';
    const currency = translations[currentLanguage]?.currency || 'DA';
    const footerMsg = translations[currentLanguage]?.footer_thanks || "Thank you for choosing {clinic}. Get well soon!";

    const element = document.createElement('div');
    element.style.padding = '40px';
    element.style.fontFamily = "'Inter', sans-serif";
    element.style.color = '#333';
    element.style.width = '700px';
    element.style.background = 'white';
    element.dir = isRTL ? 'rtl' : 'ltr';

    element.innerHTML = `
        <div style="border: 1px solid #eee; padding: 30px; min-height: 800px;">
            <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="color: #0d6efd; margin: 0; font-size: 28px;">${clinicName}</h1>
                <p style="text-transform: uppercase; letter-spacing: 2px; color: #666; margin-top: 5px;">HOSPITAL INVOICE</p>
            </div>

            <div style="margin-bottom: 30px; display: flex; justify-content: space-between; flex-direction: ${isRTL ? 'row-reverse' : 'row'};">
                <div>
                   <p><strong>${patientLabel}:</strong> ${patientData.fullName}</p>
                </div>
                <div style="text-align: ${isRTL ? 'left' : 'right'};">
                    <p><strong>${dateLabel}:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="border-bottom: 2px solid #0d6efd;">
                        <th style="text-align: ${isRTL ? 'right' : 'left'}; padding: 10px;">${descLabel}</th>
                        <th style="text-align: ${isRTL ? 'left' : 'right'}; padding: 10px;">${costLabel}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 15px 10px;">${medLabel}</td>
                        <td style="text-align: ${isRTL ? 'left' : 'right'}; padding: 15px 10px;">${billData.medicineCosts} ${currency}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 15px 10px;">${doctorLabel}</td>
                        <td style="text-align: ${isRTL ? 'left' : 'right'}; padding: 15px 10px;">${billData.doctorFees} ${currency}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td style="padding: 20px 10px; font-weight: bold; font-size: 18px; color: #0d6efd;">${totalLabel}</td>
                        <td style="padding: 20px 10px; text-align: ${isRTL ? 'left' : 'right'}; font-weight: bold; font-size: 20px; color: #0d6efd;">${billData.total} ${currency}</td>
                    </tr>
                </tfoot>
            </table>

            <div style="text-align: center; margin-top: 50px; color: #888; border-top: 1px dashed #ccc; padding-top: 20px;">
                <p>${footerMsg.replace("{clinic}", clinicName)}</p>
            </div>
        </div>
    `;

    const opt = {
        margin: [0, 0, 0, 0],
        filename: `invoice_${patientData.fullName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
    };

    return html2pdf().set(opt).from(element).save();
}

export async function generateCertificate(doctorData, patientData, certData, shouldSave = false) {
    const translations = window.translations || {};
    const currentLanguage = window.currentLanguage || 'en';
    const isRTL = currentLanguage === 'ar';

    const clinicName = translations[currentLanguage]?.title || "CLINIQUE ONLINE";
    const dateLabel = translations[currentLanguage]?.date || 'Date';
    const doctorLabel = translations[currentLanguage]?.doctor || 'Doctor';
    const patientLabel = translations[currentLanguage]?.patient || 'Patient';
    const diagLabel = translations[currentLanguage]?.diagnosis_label || 'Diagnosis';
    const medLabel = translations[currentLanguage]?.medications_label || 'Recommended Medications';
    const certHeader = translations[currentLanguage]?.certificate_header || "MEDICAL CERTIFICATE";

    // Create a temporary container for the PDF content
    const element = document.createElement('div');
    element.style.padding = '40px';
    element.style.fontFamily = "'Inter', sans-serif";
    element.style.color = '#333';
    element.style.width = '700px';
    element.style.background = 'white';
    element.dir = isRTL ? 'rtl' : 'ltr';

    element.innerHTML = `
        <div style="border: 4px solid #0d6efd; padding: 20px; position: relative; min-height: 900px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #0d6efd; margin-bottom: 5px; font-size: 32px; font-weight: bold; text-transform: uppercase;">${clinicName}</h1>
                <p style="color: #666; font-size: 14px; margin: 0;">Your health is in Safe Hands | +213123456789</p>
                <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
                <h2 style="color: #333; font-size: 24px; font-weight: bold; margin: 20px 0;">${certHeader}</h2>
            </div>

            <div style="margin-bottom: 30px; line-height: 1.6;">
                <p><strong>${dateLabel}:</strong> ${certData.sessionDate}</p>
                <p><strong>${doctorLabel}:</strong> ${doctorData.fullName}</p>
                <p><strong>${patientLabel}:</strong> ${patientData.fullName}</p>
            </div>

            <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">

            <div style="margin-bottom: 30px;">
                <h3 style="color: #333; font-size: 18px; font-weight: bold; margin-bottom: 10px;">${diagLabel}:</h3>
                <p style="white-space: pre-wrap; line-height: 1.5;">${certData.diagnosis}</p>
            </div>

            <div style="margin-bottom: 30px;">
                <h3 style="color: #333; font-size: 18px; font-weight: bold; margin-bottom: 10px;">${medLabel}:</h3>
                <p style="white-space: pre-wrap; line-height: 1.5;">${certData.medications}</p>
            </div>

            <div style="position: absolute; bottom: 80px; ${isRTL ? 'left: 40px;' : 'right: 40px;'} text-align: center; width: 250px;">
                <div style="border-top: 1px solid #333; margin-top: 50px; padding-top: 10px;">
                    <p style="font-size: 14px; margin: 0;">Doctor's Signature & Stamp</p>
                </div>
            </div>

            <div style="position: absolute; bottom: 20px; width: 100%; text-align: center; left: 0;">
                <p style="font-size: 12px; color: #999;">This is an electronically generated document.</p>
            </div>
        </div>
    `;

    // Options for html2pdf
    const opt = {
        margin: [0, 0, 0, 0],
        filename: `certificate_${patientData.fullName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
    };

    if (shouldSave) {
        return html2pdf().set(opt).from(element).save();
    } else {
        return html2pdf().set(opt).from(element).outputPdf();
    }
}
