import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs";

/**
 * Converts the first page of a PDF file to a JPG blob.
 * @param {File} pdfFile 
 * @returns {Promise<Blob>}
 */
export async function pdfToJpgBlob(pdfFile) {
    const buffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(buffer).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

    return new Promise(resolve =>
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9)
    );
}

/**
 * Uploads a file (converts PDF to JPG if necessary) to Cloudinary.
 * @param {File} file 
 * @param {Function} onProgress Optional progress callback
 * @returns {Promise<Object>}
 */
export async function uploadToCloudinary(file) {
    let uploadFile = file;
    let fileName = file.name;

    try {
        // Convert PDF to JPG if needed
        if (file.type === 'application/pdf') {
            uploadFile = await pdfToJpgBlob(file);
            fileName = file.name.replace(/\.pdf$/i, '.jpg');
        }

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('upload_preset', 'hms_unsigned_preset');

        const res = await fetch(
            'https://api.cloudinary.com/v1_1/dp3yvgmiy/image/upload',
            { method: 'POST', body: formData }
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || 'Upload failed');
        }

        const data = await res.json();
        return {
            url: data.secure_url,
            publicId: data.public_id,
            fileName: fileName
        };
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw error;
    }
}
