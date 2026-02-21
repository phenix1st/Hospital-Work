import { rtdb, auth, storage } from './firebase-config.js';
import { logout } from './auth.js';
import {
    ref,
    onValue,
    update,
    get
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import {
    ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

document.getElementById('logoutBtn')?.addEventListener('click', logout);

let currentUploadAppId = null;

function initDoctorDashboard() {
    const user = auth.currentUser;
    if (!user) return;

    // Load Appointments for this Doctor
    onValue(ref(rtdb, 'appointments'), (snapshot) => {
        const tableBody = document.getElementById('doctor-appointments-table');
        tableBody.innerHTML = '';

        let pending = 0;
        let today = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        if (!snapshot.exists()) return;

        Object.entries(snapshot.val()).forEach(([id, app]) => {
            if (app.doctorId !== user.uid) return;

            if (app.status === 'pending') pending++;
            if (app.date === todayStr) today++;

            const filesHTML = (app.medicalFiles && app.medicalFiles.length > 0)
                ? app.medicalFiles.map((url, i) => `<a href="${url}" target="_blank" class="btn btn-sm btn-outline-secondary me-1"><i class="fas fa-file"></i> ${i + 1}</a>`).join('')
                : '<span class="text-muted small">—</span>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.patientName}</td>
                <td>${app.date} | ${app.time}</td>
                <td><small>${app.description || (translations[currentLanguage]?.not_available || 'N/A')}</small></td>
                <td>
                    <div class="d-flex align-items-center">
                        ${filesHTML}
                        <button class="btn btn-sm btn-link p-0 ms-2 text-primary" onclick="openDoctorUploadModal('${id}')" title="Upload File">
                            <i class="fas fa-plus-circle"></i>
                        </button>
                    </div>
                </td>
                <td>
                    ${app.status === 'pending' ? `
                        <button class="btn btn-sm btn-success me-1" onclick="updateAppStatus('${id}', 'approved')"><i class="fas fa-check"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="updateAppStatus('${id}', 'rejected')"><i class="fas fa-times"></i></button>
                    ` : app.status === 'approved' ? `
                        <button class="btn btn-sm btn-outline-danger" onclick="dischargeFromDoctor('${id}', '${app.patientId}')">
                            <i class="fas fa-sign-out-alt me-1"></i> <span data-i18n="discharge_patient">${translations[currentLanguage]?.discharge_patient || 'Discharge'}</span>
                        </button>
                    ` : `<span class="badge bg-${app.status === 'completed' ? 'info' : (app.status === 'approved' ? 'success' : 'danger')}">${translations[currentLanguage]?.[app.status] || app.status}</span>`}
                </td>
            `;
            tableBody.appendChild(row);
        });

        document.getElementById('pending-appointments').innerText = pending;
        document.getElementById('today-load').innerText = today;

        // Count discharged patients (completed status)
        const dischargedCount = Object.values(snapshot.val()).filter(a => a.doctorId === user.uid && a.status === 'completed').length;
        document.getElementById('discharged-count').innerText = dischargedCount;
    });
}

window.dischargeFromDoctor = async (appId, patientId) => {
    if (!confirm(translations[currentLanguage]?.confirm_discharge || 'Are you sure you want to end this session and discharge the patient?')) return;

    const room = parseFloat(prompt(translations[currentLanguage]?.enter_room_charges || 'Enter Room Charges:') || 0);
    const medicine = parseFloat(prompt(translations[currentLanguage]?.enter_medicine_costs || 'Enter Medicine Costs:') || 0);
    const doctor = parseFloat(prompt(translations[currentLanguage]?.enter_doctor_fees || 'Enter Doctor Fees:') || 0);
    const total = room + medicine + doctor;

    try {
        const billData = {
            patientId,
            appointmentId: appId,
            roomCharges: room,
            medicineCosts: medicine,
            doctorFees: doctor,
            total,
            createdAt: new Date().toISOString()
        };

        // 1. Create bill
        await push(ref(rtdb, 'bills'), billData);
        // 2. Mark appointment completed
        await update(ref(rtdb, 'appointments/' + appId), { status: 'completed' });
        // 3. Mark user discharged
        await update(ref(rtdb, 'users/' + patientId), { discharged: true });

        alert(translations[currentLanguage]?.discharge_success || 'Patient discharged and session ended!');
    } catch (err) {
        alert((translations[currentLanguage]?.error_label || 'Error: ') + err.message);
    }
};

window.openDoctorUploadModal = (appId) => {
    currentUploadAppId = appId;
    const modal = new bootstrap.Modal(document.getElementById('doctorUploadModal'));
    modal.show();
    document.getElementById('doctorUploadForm').reset();
    document.getElementById('doctor-file-preview-list').innerHTML = '';
};

window.handleFileSelect = (input) => {
    const list = document.getElementById('doctor-file-preview-list');
    list.innerHTML = '';
    Array.from(input.files).forEach(file => {
        const item = document.createElement('div');
        item.className = 'small text-muted mb-1';
        item.innerHTML = `<i class="fas fa-file-medical me-2"></i>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        list.appendChild(item);
    });
};

document.getElementById('doctorUploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUploadAppId) return;

    const filesInput = document.getElementById('doctorFilesInput');
    const files = Array.from(filesInput.files);
    if (files.length === 0) return;

    const btn = document.getElementById('doctorUploadBtn');
    btn.disabled = true;
    btn.textContent = translations[currentLanguage]?.loading || 'Uploading...';

    const progressBar = document.getElementById('doctor-progress-bar');
    const statusText = document.getElementById('doctor-upload-status');
    const progressDiv = document.getElementById('doctor-upload-progress');

    progressDiv.classList.remove('d-none');

    try {
        const newUrls = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const path = `medical-files/${currentUploadAppId}/${Date.now()}_${file.name}`;
            const fileRef = storageRef(storage, path);

            // Robust upload logic with timeout
            const uploadPromise = uploadBytes(fileRef, file);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 30000)
            );

            statusText.textContent = `${translations[currentLanguage]?.uploading || 'Uploading'} ${i + 1}/${files.length}...`;
            await Promise.race([uploadPromise, timeoutPromise]);

            const url = await getDownloadURL(fileRef);
            newUrls.push(url);

            progressBar.style.width = Math.round(((i + 1) / files.length) * 100) + '%';
        }

        // Fetch existing files to append
        const snap = await get(ref(rtdb, `appointments/${currentUploadAppId}/medicalFiles`));
        let existingFiles = snap.exists() ? snap.val() : [];
        if (!Array.isArray(existingFiles)) existingFiles = [];

        await update(ref(rtdb, `appointments/${currentUploadAppId}`), {
            medicalFiles: [...existingFiles, ...newUrls]
        });

        alert(translations[currentLanguage]?.upload_success || "Files uploaded successfully!");
        bootstrap.Modal.getInstance(document.getElementById('doctorUploadModal')).hide();
    } catch (error) {
        console.error("Doctor upload failed:", error);
        alert((translations[currentLanguage]?.upload_error || "Upload failed: ") + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = translations[currentLanguage]?.confirm_booking || 'Confirm Upload';
        progressDiv.classList.add('d-none');
    }
});

window.updateAppStatus = async (appId, status) => {
    try {
        await update(ref(rtdb, 'appointments/' + appId), { status });
    } catch (error) {
        alert((translations[currentLanguage]?.error_updating_appointment || "Error updating appointment: ") + error.message);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) initDoctorDashboard();
    });
});
