import { rtdb, auth, storage } from './firebase-config.js';
import { logout } from './auth.js';
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

import { generateInvoice } from './pdf-generator.js';

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
    document.getElementById(sectionId).classList.remove('d-none');

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    if (sectionId === 'requests-section') document.querySelector('[data-i18n="my_schedule"]')?.classList.add('active');
    if (sectionId === 'patients-section') document.querySelector('[data-i18n="my_patients"]')?.classList.add('active');
    if (sectionId === 'history-section') document.querySelector('[data-i18n="history"]')?.classList.add('active');
    if (sectionId === 'certificates-section') document.querySelector('[data-i18n="session_certificates"]')?.classList.add('active');

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
                ${bill ? `<button class="btn btn-sm btn-link" onclick="downloadPatientInvoice('${id}')"><i class="fas fa-file-pdf me-1"></i>${bill.total} DA</button>` : '—'}
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
        <div class="col-md-6">
            <h6 class="border-bottom pb-2 mb-3" data-i18n="billing">${translations[currentLanguage]?.billing || 'Billing & Discharges'}</h6>
            <ul class="list-group list-group-flush scrollable-list" style="max-height: 300px; overflow-y: auto;">
                ${bills.map(b => `
                    <li class="list-group-item px-0 bg-transparent">
                        <div class="d-flex justify-content-between small fw-bold">
                            <span>${new Date(b.createdAt).toLocaleDateString()}</span>
                            <span class="text-primary">$${b.total}</span>
                        </div>
                        <div class="x-small text-muted" style="font-size: 10px;">
                            ${translations[currentLanguage]?.room_charges || 'Room'}: $${b.roomCharges} | 
                            ${translations[currentLanguage]?.medicine_costs || 'Med'}: $${b.medicineCosts} | 
                            ${translations[currentLanguage]?.doctor_fees || 'Fees'}: $${b.doctorFees}
                        </div>
                        <button class="btn btn-xs btn-outline-info py-0 px-1 mt-1" style="font-size: 9px;" onclick="downloadPatientInvoice('${b.appointmentId}')"><i class="fas fa-file-pdf"></i> PDF</button>
                    </li>
                `).reverse().join('')}
                ${bills.length === 0 ? `<li class="list-group-item px-0 bg-transparent text-muted small">${translations[currentLanguage]?.no_bills_yet || 'No records found.'}</li>` : ''}
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

// ─── Certificates Management ────────────────────────────────────────────────
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
                <a href="${c.fileUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
                    <i class="fas fa-external-link-alt me-1"></i> <span data-i18n="view_content">${translations[currentLanguage]?.view_content || 'View'}</span>
                </a>
            </td>
        `;
        tbody.appendChild(row);
    });
};

document.getElementById('certFileInput')?.addEventListener('change', (e) => {
    const nameDiv = document.getElementById('cert-file-name');
    if (nameDiv && e.target.files[0]) {
        nameDiv.textContent = e.target.files[0].name;
    }
});

document.getElementById('certificateUploadForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const patientSelect = document.getElementById('certPatientSelect');
    const sessionDate = document.getElementById('certSessionDate').value;
    const note = document.getElementById('certDiagnosisNote').value;
    const fileInput = document.getElementById('certFileInput');
    const file = fileInput.files[0];

    if (!patientSelect.value || !file) return;

    const btn = document.getElementById('certUploadBtn');
    btn.disabled = true;
    btn.textContent = translations[currentLanguage]?.loading || 'Uploading...';

    const progressBar = document.getElementById('cert-progress-bar');
    const statusText = document.getElementById('cert-upload-status');
    const progressDiv = document.getElementById('cert-upload-progress');

    progressDiv.classList.remove('d-none');

    try {
        const path = `certificates/${patientSelect.value}/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, path);

        const uploadPromise = uploadBytes(fileRef, file);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 30000));

        statusText.textContent = translations[currentLanguage]?.uploading || 'Uploading...';
        await Promise.race([uploadPromise, timeoutPromise]);

        const url = await getDownloadURL(fileRef);

        const certData = {
            patientId: patientSelect.value,
            patientName: patientSelect.options[patientSelect.selectedIndex].text,
            doctorId: user.uid,
            doctorName: allUsers[user.uid]?.fullName || user.email,
            sessionDate,
            note,
            fileUrl: url,
            filePath: path,
            createdAt: new Date().toISOString()
        };

        await push(ref(rtdb, 'certificates'), certData);

        alert(translations[currentLanguage]?.certificate_added_success || "Certificate uploaded successfully!");
        bootstrap.Modal.getInstance(document.getElementById('certificateUploadModal')).hide();
        document.getElementById('certificateUploadForm').reset();
        document.getElementById('cert-file-name').textContent = '';
    } catch (error) {
        console.error("Certificate upload failed:", error);
        alert((translations[currentLanguage]?.upload_error || "Upload failed: ") + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = translations[currentLanguage]?.upload_certificate || 'Upload Certificate';
        progressDiv.classList.add('d-none');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) initDoctorDashboard();
    });
});
