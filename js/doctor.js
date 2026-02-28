import { rtdb, auth, storage } from './firebase-config.js';
import { logout, changeUserEmail } from './auth.js';
import {
    ref,
    onValue,
    update,
    get,
    push
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import {
    ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

document.getElementById('logoutBtn')?.addEventListener('click', logout);

import { generateInvoice, generateCertificate } from './pdf-generator.js';

let currentUploadAppId = null;
let allUsers = {};
let allBills = {};
let allCertificates = {};
let allAppointments = {};

// ─── Navigation & UI Toggling ────────────────────────────────────────────────
window.showSection = (sectionId) => {
    document.getElementById('requests-section').classList.add('d-none');
    document.getElementById('patients-section').classList.add('d-none');
    document.getElementById('history-section').classList.add('d-none');
    document.getElementById('certificates-section')?.classList.add('d-none');
    document.getElementById('settings-section')?.classList.add('d-none');
    document.getElementById(sectionId).classList.remove('d-none');

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (sectionId === 'requests-section') document.querySelector('[data-i18n="my_schedule"]')?.classList.add('active');
    if (sectionId === 'patients-section') document.querySelector('[data-i18n="my_patients"]')?.classList.add('active');
    if (sectionId === 'history-section') document.querySelector('[data-i18n="history"]')?.classList.add('active');
    if (sectionId === 'certificates-section') document.querySelector('[data-i18n="session_certificates"]')?.classList.add('active');
    if (sectionId === 'settings-section') document.querySelector('[data-i18n="account_settings"]')?.classList.add('active');

    if (sectionId === 'certificates-section') renderCertificatesList();
};

window.showHistorySection = () => {
    showSection('history-section');
    renderHistory();
};

function initDoctorDashboard() {
    const user = auth.currentUser;
    if (!user) return;

    // Load Users (for patient data)
    onValue(ref(rtdb, 'users'), (snap) => {
        allUsers = snap.exists() ? snap.val() : {};
        if (Object.keys(allAppointments).length > 0) {
            renderMyPatients();
            renderHistory();
            populateCertPatientSelect();
        }
    });

    // Load Bills (for history)
    onValue(ref(rtdb, 'bills'), (snap) => {
        allBills = snap.exists() ? snap.val() : {};
        if (Object.keys(allAppointments).length > 0) renderHistory();
    });

    // Load Certificates
    onValue(ref(rtdb, 'certificates'), (snap) => {
        allCertificates = snap.exists() ? snap.val() : {};
        renderCertificatesList();
    });

    // Load Appointments for this Doctor
    onValue(ref(rtdb, 'appointments'), (snapshot) => {
        allAppointments = snapshot.exists() ? snapshot.val() : {};
        const tableBody = document.getElementById('doctor-appointments-table');
        if (tableBody) tableBody.innerHTML = '';

        let pending = 0;
        let today = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        Object.entries(allAppointments).forEach(([id, app]) => {
            if (app.doctorId !== user.uid) return;

            // Only show active (pending/approved) in the main schedule
            if (app.status === 'completed' || app.status === 'rejected' || app.status === 'deleted') return;

            if (app.status === 'pending') pending++;
            if (app.date === todayStr) today++;

            const filesHTML = (app.medicalFiles && app.medicalFiles.length > 0)
                ? app.medicalFiles.map((fileObj, i) => {
                    const url = typeof fileObj === 'string' ? fileObj : fileObj.url;
                    const name = typeof fileObj === 'string' ? `File ${i + 1}` : (fileObj.name || `File ${i + 1}`);
                    return `<a href="${url}" target="_blank" class="btn btn-sm btn-outline-secondary me-1" title="${name}"><i class="fas fa-file"></i> ${i + 1}</a>`;
                }).join('')
                : `<span class="text-muted small">${translations[currentLanguage]?.no_medical_files || 'None'}</span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.patientName}</td>
                <td>${app.date} | ${app.time}</td>
                <td><small>${app.description || (translations[currentLanguage]?.not_available || 'N/A')}</small></td>
                <td>
                    <div class="d-flex align-items-center">
                        ${filesHTML}
                    </div>
                </td>
                <td>
                    <div class="d-flex gap-1">
                        ${app.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" onclick="updateAppStatus('${id}', 'approved')"><i class="fas fa-check"></i></button>
                            <button class="btn btn-sm btn-warning" onclick="updateAppStatus('${id}', 'rejected')"><i class="fas fa-times"></i></button>
                        ` : app.status === 'approved' ? `
                            <button class="btn btn-sm btn-outline-danger" onclick="dischargeFromDoctor('${id}', '${app.patientId}')">
                                <i class="fas fa-sign-out-alt me-1"></i> <span data-i18n="discharge_patient">${translations[currentLanguage]?.discharge_patient || 'Discharge'}</span>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteAppointment('${id}')" title="${translations[currentLanguage]?.delete || 'Delete'}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            if (tableBody) tableBody.appendChild(row);
        });

        const pendingEl = document.getElementById('pending-appointments');
        const todayEl = document.getElementById('today-load');
        const dischargedEl = document.getElementById('discharged-count');

        if (pendingEl) pendingEl.innerText = pending;
        if (todayEl) todayEl.innerText = today;

        const dischargedCount = Object.values(allAppointments).filter(a => a.doctorId === user.uid && a.status === 'completed').length;
        if (dischargedEl) dischargedEl.innerText = dischargedCount;

        renderMyPatients();
        renderHistory();
        populateCertPatientSelect();
    });
}

window.populateCertPatientSelect = () => {
    const user = auth.currentUser;
    const select = document.getElementById('certPatientSelect');
    if (!select || !user) return;

    const patientMap = new Map();
    Object.values(allAppointments).forEach(app => {
        if (app.doctorId === user.uid) {
            const pId = app.patientId;
            const pData = allUsers[pId] || { fullName: app.patientName };
            if (pId && !patientMap.has(pId)) {
                patientMap.set(pId, pData.fullName || app.patientName);
            }
        }
    });

    const currentVal = select.value;
    select.innerHTML = '<option value="">' + (translations[currentLanguage]?.patient || 'Select Patient') + '</option>';
    patientMap.forEach((name, id) => {
        const opt = document.createElement('option');
        opt.value = id; opt.textContent = name;
        select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
};

window.renderMyPatients = (query = '') => {
    const user = auth.currentUser;
    const tbody = document.getElementById('my-patients-table');
    if (!tbody) return;
    tbody.innerHTML = '';

    const patientMap = new Map();
    Object.values(allAppointments).forEach(app => {
        if (app.doctorId === user.uid) {
            const pId = app.patientId;
            const pData = allUsers[pId] || { fullName: app.patientName, email: '—' };
            const symptoms = (app.description || '').toLowerCase();
            const name = (pData.fullName || '').toLowerCase();
            const q = query.toLowerCase();

            if (!query || name.includes(q) || symptoms.includes(q)) {
                if (!patientMap.has(pId) || new Date(app.date) > new Date(patientMap.get(pId).date)) {
                    patientMap.set(pId, { ...pData, lastVisit: app.date, id: pId });
                }
            }
        }
    });

    patientMap.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div class="fw-bold">${p.fullName}</div></td>
            <td>${p.email}</td>
            <td>${p.lastVisit}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewPatientHistory('${p.id}')">
                    <i class="fas fa-history me-1"></i> <span data-i18n="history_records">${translations[currentLanguage]?.history_records || 'Records'}</span>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
};

window.renderHistory = () => {
    const user = auth.currentUser;
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const history = Object.entries(allAppointments)
        .filter(([id, a]) => a.doctorId === user.uid && (a.status === 'completed' || a.status === 'rejected'))
        .sort((a, b) => new Date(b[1].date) - new Date(a[1].date));

    history.forEach(([id, a]) => {
        const bill = Object.values(allBills).find(b => b.appointmentId === id);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${a.patientName}</td>
            <td>${a.date}</td>
            <td><small>${a.description || ''}</small></td>
            <td>
                ${bill ? `<button class="btn btn-sm btn-link" onclick="downloadPatientInvoice('${id}')"><i class="fas fa-file-pdf me-1"></i>${bill.total} ${translations[currentLanguage]?.currency || 'DA'}</button>` : '—'}
            </td>
            <td><span class="badge bg-${a.status === 'completed' ? 'info' : 'secondary'}">${translations[currentLanguage]?.[a.status] || a.status}</span></td>
        `;
        tbody.appendChild(row);
    });
};

window.downloadPatientInvoice = async (appId) => {
    const bill = Object.values(allBills).find(b => b.appointmentId === appId);
    if (!bill) return;
    const patient = allUsers[bill.patientId] || { fullName: (translations[currentLanguage]?.unknown || 'Patient'), address: '—' };
    await generateInvoice(patient, bill);
};

window.handlePatientSearch = (val) => renderMyPatients(val);

window.viewPatientHistory = (pId) => {
    const p = allUsers[pId] || { fullName: (translations[currentLanguage]?.unknown || 'Patient') };
    const history = Object.values(allAppointments).filter(a => a.patientId === pId && a.status !== 'deleted');
    const bills = Object.values(allBills).filter(b => b.patientId === pId);

    let html = `<div class="mb-4">
        <h6 class="fw-bold text-primary">${p.fullName}</h6>
        <p class="small text-muted mb-0">${p.email || ''}</p>
    </div>
    <div class="row">
        <div class="col-md-6">
            <h6 class="border-bottom pb-2 mb-3" data-i18n="appointments">${translations[currentLanguage]?.appointments || 'Appointments'}</h6>
            <ul class="list-group list-group-flush mb-4 scrollable-list" style="max-height: 300px; overflow-y: auto;">
                ${history.map(a => `
                    <li class="list-group-item px-0 bg-transparent">
                        <div class="d-flex justify-content-between small fw-bold">
                            <span>${a.date}</span>
                            <span class="badge bg-${a.status === 'completed' ? 'info' : (a.status === 'approved' ? 'success' : (a.status === 'pending' ? 'warning' : 'secondary'))}">${translations[currentLanguage]?.[a.status] || a.status}</span>
                        </div>
                        <div class="small text-muted">${a.description || ''}</div>
                    </li>
                `).reverse().join('')}
            </ul>
        </div>
        <div class="col-md-6 border-start">
            <h6 class="border-bottom pb-2 mb-3" data-i18n="billing">${translations[currentLanguage]?.billing || 'Billing & Discharges'}</h6>
            <ul class="list-group list-group-flush scrollable-list mb-4" style="max-height: 200px; overflow-y: auto;">
                ${bills.map(b => `
                    <li class="list-group-item px-0 bg-transparent">
                        <div class="d-flex justify-content-between small fw-bold">
                            <span>${new Date(b.createdAt).toLocaleDateString()}</span>
                            <span class="text-primary">${b.total} ${translations[currentLanguage]?.currency || 'DA'}</span>
                        </div>
                        <button class="btn btn-xs btn-outline-info py-0 px-1 mt-1" style="font-size: 9px;" onclick="downloadPatientInvoice('${b.appointmentId}')"><i class="fas fa-file-pdf"></i> PDF</button>
                    </li>
                `).reverse().join('')}
                ${bills.length === 0 ? `<li class="list-group-item px-0 bg-transparent text-muted small">${translations[currentLanguage]?.no_bills_yet || 'No records found.'}</li>` : ''}
            </ul>

            <h6 class="border-bottom pb-2 mb-3" data-i18n="certificates">${translations[currentLanguage]?.certificates || 'Medical Certificates'}</h6>
            <ul class="list-group list-group-flush scrollable-list" style="max-height: 200px; overflow-y: auto;">
                ${Object.entries(allCertificates).filter(([id, c]) => c.patientId === pId).map(([id, c]) => `
                    <li class="list-group-item px-0 bg-transparent">
                        <div class="d-flex justify-content-between small fw-bold">
                            <span>${c.sessionDate}</span>
                            <button class="btn btn-xs btn-outline-primary py-0 px-1" style="font-size: 9px;" onclick="downloadCertificate('${id}')"><i class="fas fa-download"></i></button>
                        </div>
                        <div class="x-small text-muted text-truncate" style="font-size: 10px;">${c.note || ''}</div>
                    </li>
                `).reverse().join('')}
                ${Object.values(allCertificates).filter(c => c.patientId === pId).length === 0 ? `<li class="list-group-item px-0 bg-transparent text-muted small">${translations[currentLanguage]?.no_certificates || 'No certificates found.'}</li>` : ''}
            </ul>
        </div>
    </div>`;

    document.getElementById('patient-history-content').innerHTML = html;
    new bootstrap.Modal(document.getElementById('patientHistoryModal')).show();
};

window.deleteAppointment = async (id) => {
    if (confirm(translations[currentLanguage]?.confirm_delete_appointment || 'Delete this appointment?')) {
        try {
            await update(ref(rtdb, 'appointments/' + id), { status: 'deleted' }); // Soft delete better for records
            // Or use remove(ref(rtdb, 'appointments/' + id));
        } catch (err) {
            alert(err.message);
        }
    }
};

window.dischargeFromDoctor = async (appId, patientId) => {
    if (!confirm(translations[currentLanguage]?.confirm_discharge || 'Are you sure you want to end this session and discharge the patient?')) return;

    const medicine = parseFloat(prompt(translations[currentLanguage]?.enter_medicine_costs || 'Enter Medicine Costs:') || 0);
    const doctor = parseFloat(prompt(translations[currentLanguage]?.enter_doctor_fees || 'Enter Doctor Fees:') || 0);
    const total = medicine + doctor;

    try {
        const billData = {
            patientId,
            appointmentId: appId,
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

    // Use centralized utility for uploads
    const { uploadToCloudinary } = await import('./utils.js');

    try {
        const uploadedFiles = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (statusText) {
                const uploadingText = translations[currentLanguage]?.uploading || 'Uploading';
                statusText.textContent = `${uploadingText} ${i + 1}/${files.length}...`;
            }

            try {
                const result = await uploadToCloudinary(file);
                uploadedFiles.push({
                    url: result.url,
                    publicId: result.publicId,
                    name: result.fileName,
                    date: new Date().toISOString()
                });
            } catch (uploadErr) {
                console.error(`Upload failed for ${file.name}:`, uploadErr);
                // Continue with others or throw? Let's throw for now to be safe.
                throw new Error(`Upload failed for ${file.name}: ${uploadErr.message}`);
            }

            if (progressBar) {
                progressBar.style.width = Math.round(((i + 1) / files.length) * 100) + '%';
            }
        }

        // Fetch existing files to append
        const snap = await get(ref(rtdb, `appointments/${currentUploadAppId}/medicalFiles`));
        let existingFiles = snap.exists() ? snap.val() : [];
        if (!Array.isArray(existingFiles)) existingFiles = [];

        await update(ref(rtdb, `appointments/${currentUploadAppId}`), {
            medicalFiles: [...existingFiles, ...uploadedFiles]
        });

        alert(translations[currentLanguage]?.upload_success || "Files uploaded successfully!");
        const modalEl = document.getElementById('doctorUploadModal');
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.hide();
    } catch (error) {
        console.error("Doctor upload failed:", error);
        alert((translations[currentLanguage]?.upload_error || "Upload failed: ") + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = translations[currentLanguage]?.confirm_booking || 'Confirm Upload';
        if (progressDiv) progressDiv.classList.add('d-none');
    }
});

window.updateAppStatus = async (appId, status) => {
    try {
        await update(ref(rtdb, 'appointments/' + appId), { status });
    } catch (error) {
        alert((translations[currentLanguage]?.error_updating_appointment || "Error updating appointment: ") + error.message);
    }
};

// ─── Certificates Management ────────────────────────────────────────────────
window.downloadCertificate = async (certId) => {
    try {
        const certSnap = await get(ref(rtdb, 'certificates/' + certId));
        if (!certSnap.exists()) throw new Error("Certificate not found");
        const certData = certSnap.val();

        const patientData = allUsers[certData.patientId] || { fullName: certData.patientName || 'Patient' };
        const doctorData = allUsers[certData.doctorId] || { fullName: certData.doctorName || 'Doctor' };

        await generateCertificate(doctorData, patientData, {
            sessionDate: certData.sessionDate,
            diagnosis: certData.note || certData.diagnosis,
            medications: certData.medications || '—',
            medicalCosts: certData.medicalCosts || 0,
            doctorFees: certData.doctorFees || 0,
            totalCost: certData.totalCost || 0
        }, true);
    } catch (error) {
        console.error("Download failed:", error);
        alert("Error generating PDF: " + error.message);
    }
};

window.renderCertificatesList = () => {
    const user = auth.currentUser;
    const tbody = document.getElementById('certificates-table-body');
    if (!tbody || !user) return;
    tbody.innerHTML = '';

    const certs = Object.entries(allCertificates)
        .filter(([id, c]) => c.doctorId === user.uid)
        .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));

    if (certs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-4">${translations[currentLanguage]?.no_certificates || 'No certificates issued yet.'}</td></tr>`;
        return;
    }

    certs.forEach(([id, c]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div class="fw-bold">${c.patientName}</div></td>
            <td><small>${c.sessionDate}</small></td>
            <td><div class="text-truncate" style="max-width: 200px;" title="${c.note}">${c.note || '—'}</div></td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="downloadCertificate('${id}')">
                    <i class="fas fa-download me-1"></i> <span data-i18n="download">${translations[currentLanguage]?.download || 'Download'}</span>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
};


document.getElementById('certificateUploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const patientSelect = document.getElementById('certPatientSelect');
    const sessionDate = document.getElementById('certSessionDate').value;
    const diagnosis = document.getElementById('certDiagnosis').value;
    const medications = document.getElementById('certMedications').value;
    const patientId = patientSelect.value;

    if (!patientId || !sessionDate || !diagnosis || !medications) {
        alert("Please fill all fields.");
        return;
    }

    const btn = document.getElementById('certUploadBtn');
    btn.disabled = true;
    const loadingText = (window.translations && window.currentLanguage) ? window.translations[window.currentLanguage]?.loading : 'Processing...';
    btn.textContent = loadingText;

    const progressBar = document.getElementById('cert-progress-bar');
    const statusText = document.getElementById('cert-upload-status');
    const progressDiv = document.getElementById('cert-upload-progress');

    progressDiv.classList.remove('d-none');

    try {
        const trans = window.translations || {};
        const lang = window.currentLanguage || 'en';

        statusText.textContent = trans[lang]?.saving_data || 'Saving data...';
        progressBar.style.width = '50%';

        const patientData = allUsers[patientId] || { fullName: patientSelect.options[patientSelect.selectedIndex].text };
        const doctorData = allUsers[user.uid] || { fullName: user.email };

        const medicalCosts = parseFloat(document.getElementById('certMedicalCosts').value || 0);
        const doctorFees = parseFloat(document.getElementById('certDoctorFees').value || 0);
        const totalCost = medicalCosts + doctorFees;

        const certData = {
            patientId: patientId,
            patientName: patientData.fullName,
            doctorId: user.uid,
            doctorName: doctorData.fullName,
            sessionDate,
            diagnosis,
            medications,
            medicalCosts,
            doctorFees,
            totalCost,
            note: diagnosis, // compatibility
            createdAt: new Date().toISOString()
        };

        await push(ref(rtdb, 'certificates'), certData);
        progressBar.style.width = '100%';

        alert(trans[lang]?.certificate_added_success || "Certificate saved successfully!");
        bootstrap.Modal.getInstance(document.getElementById('certificateUploadModal')).hide();
        document.getElementById('certificateUploadForm').reset();
    } catch (error) {
        console.error("Certificate process failed:", error);
        alert((trans[lang]?.error_label || "Error: ") + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = translations[currentLanguage]?.save_and_generate || 'Save & Generate Certificate';
        progressDiv.classList.add('d-none');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            initDoctorDashboard();
            // Pre-fill current email in settings
            const emailInput = document.getElementById('currentEmail');
            if (emailInput) emailInput.value = user.email || '';
        }
    });
});
// ─── Account Settings ────────────────────────────────────────────────────────
import { changeUserPassword } from './auth.js';

document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const errorBox = document.getElementById('passwordError');
    const successBox = document.getElementById('passwordSuccess');
    const btn = document.getElementById('updatePasswordBtn');

    errorBox.classList.add('d-none');
    successBox.classList.add('d-none');

    if (newPass !== confirmPass) {
        errorBox.textContent = translations[currentLanguage]?.password_mismatch || "Passwords do not match!";
        errorBox.classList.remove('d-none');
        return;
    }

    if (newPass.length < 6) {
        errorBox.textContent = translations[currentLanguage]?.password_too_short || "Password must be at least 6 characters.";
        errorBox.classList.remove('d-none');
        return;
    }

    btn.disabled = true;
    try {
        await changeUserPassword(newPass);
        successBox.classList.remove('d-none');
        e.target.reset();
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('d-none');
    } finally {
        btn.disabled = false;
    }
});

document.getElementById('changeEmailForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail = document.getElementById('newEmail').value;
    const errorBox = document.getElementById('emailError');
    const successBox = document.getElementById('emailSuccess');
    const btn = document.getElementById('updateEmailBtn');

    errorBox.classList.add('d-none');
    successBox.classList.add('d-none');

    if (!newEmail || !newEmail.includes('@')) {
        errorBox.textContent = translations[currentLanguage]?.invalid_email || "Please enter a valid email address.";
        errorBox.classList.remove('d-none');
        return;
    }

    btn.disabled = true;
    try {
        await changeUserEmail(newEmail);
        successBox.classList.remove('d-none');
        e.target.reset();
        const emailInput = document.getElementById('currentEmail');
        if (emailInput) emailInput.value = newEmail;
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('d-none');
    } finally {
        btn.disabled = false;
    }
});
