import { rtdb, auth, storage } from './firebase-config.js';
import { logout } from './auth.js';
import {
    ref as dbRef, onValue, push, get
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import {
    ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

document.getElementById('logoutBtn')?.addEventListener('click', logout);

window.showSection = (sectionId) => {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(sec => sec.classList.add('d-none'));
    // Show target section
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('d-none');

    // Update active class in sidebar
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(`'${sectionId}'`)) {
            link.classList.add('active');
        }
    });

    if (window.innerWidth < 992) {
        // Close sidebar on mobile (assumes toggleSidebar is available globally)
        if (typeof toggleSidebar === 'function') toggleSidebar();
    }
};

// ─── Time Slots ───────────────────────────────────────────────────────────────
const ALL_TIME_SLOTS = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30"
];

async function refreshTimeSlots() {
    const doctorId = document.getElementById('doctorSelect').value;
    const date = document.getElementById('appDate').value;
    const timeSelect = document.getElementById('timeSlot');

    timeSelect.innerHTML = '<option value="">' + (translations[currentLanguage]?.time_slot || 'Select Time') + '</option>';

    // Only fetch if both doctor and date are selected
    if (!doctorId || !date) return;

    try {
        const snap = await get(dbRef(rtdb, 'appointments'));
        const takenSlots = [];

        if (snap.exists()) {
            Object.values(snap.val()).forEach(app => {
                // If it's the same doctor, same date, and not cancelled/rejected
                if (app.doctorId === doctorId && app.date === date && app.status !== 'rejected' && app.status !== 'cancelled') {
                    takenSlots.push(app.time);
                }
            });
        }

        ALL_TIME_SLOTS.forEach(slot => {
            if (!takenSlots.includes(slot)) {
                const o = document.createElement('option');
                o.value = slot; o.textContent = slot;
                timeSelect.appendChild(o);
            }
        });
    } catch (err) {
        console.error("Error refreshing slots:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('doctorSelect')?.addEventListener('change', refreshTimeSlots);
    document.getElementById('appDate')?.addEventListener('change', refreshTimeSlots);
});

// ─── Load Doctors by Department ───────────────────────────────────────────────
document.getElementById('deptSelect')?.addEventListener('change', async (e) => {
    const dept = e.target.value;
    const doctorSelect = document.getElementById('doctorSelect');
    doctorSelect.innerHTML = '<option value="">' + (translations[currentLanguage]?.doctor_select || 'Select Doctor') + '</option>';
    if (!dept) return;

    try {
        const snap = await get(dbRef(rtdb, 'users'));
        if (!snap.exists()) return;
        Object.entries(snap.val()).forEach(([id, user]) => {
            if (user.role === 'doctor' && user.department === dept && user.status === 'approved') {
                const o = document.createElement('option');
                o.value = id; o.textContent = user.fullName;
                doctorSelect.appendChild(o);
            }
        });
    } catch (err) {
        console.error("Error loading doctors:", err);
    }
});

// ─── Upload Files to Firebase Storage ────────────────────────────────────────
async function uploadFiles(files, folder) {
    console.log("Starting upload for", files.length, "files to", folder);
    const urls = [];
    const progressBar = document.getElementById('progress-bar');
    const uploadStatus = document.getElementById('upload-status');
    const progressDiv = document.getElementById('upload-progress');

    if (progressDiv) progressDiv.classList.remove('d-none');

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const path = `${folder}/${Date.now()}_${file.name}`;
            console.log("Uploading file:", file.name, "to path:", path);
            const fileRef = storageRef(storage, path);

            // Using uploadBytes for simpler, more reliable uploads
            // Including a safety timeout of 30 seconds
            const uploadPromise = uploadBytes(fileRef, file);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Upload timed out (30s)")), 30000)
            );

            if (uploadStatus) {
                const uploadingText = translations[currentLanguage]?.uploading || 'Uploading...';
                uploadStatus.textContent = `${uploadingText} ${i + 1} / ${files.length}`;
            }

            await Promise.race([uploadPromise, timeoutPromise]);
            console.log("File uploaded successfully, getting download URL...");

            const url = await getDownloadURL(fileRef);
            console.log("Got URL:", url);
            urls.push(url);

            if (progressBar) {
                const pct = Math.round(((i + 1) / files.length) * 100);
                progressBar.style.width = pct + '%';
            }
        }
    } catch (err) {
        console.error("Upload process aborted:", err);
        // Alert the user specifically about upload failures
        const errorLabel = translations[currentLanguage]?.upload_error || 'Upload failed: ';
        alert(errorLabel + (err.message || err.code || "Unknown error"));
        throw err;
    } finally {
        if (progressDiv) progressDiv.classList.add('d-none');
    }

    console.log("Upload complete. URLs:", urls);
    return urls;
}

// ─── Booking Form ─────────────────────────────────────────────────────────────
document.getElementById('bookingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('bookBtn');
    const doctorSel = document.getElementById('doctorSelect');
    const appDate = document.getElementById('appDate').value;
    const appTime = document.getElementById('timeSlot').value;

    btn.disabled = true;
    btn.textContent = translations[currentLanguage]?.loading || 'Booking...';

    try {
        // Double check if slot is still available (to avoid race conditions)
        const snap = await get(dbRef(rtdb, 'appointments'));
        let isTaken = false;
        if (snap.exists()) {
            isTaken = Object.values(snap.val()).some(app =>
                app.doctorId === doctorSel.value &&
                app.date === appDate &&
                app.time === appTime &&
                app.status !== 'rejected' && app.status !== 'cancelled'
            );
        }

        if (isTaken) {
            alert(translations[currentLanguage]?.slot_taken || 'Sorry, this time slot was just taken. Please choose another one.');
            refreshTimeSlots();
            btn.disabled = false;
            btn.textContent = translations[currentLanguage]?.confirm_booking || 'Confirm Booking';
            return;
        }

        const filesInput = document.getElementById('medicalFiles');
        const files = filesInput ? Array.from(filesInput.files) : [];

        // Upload medical files if any
        let medicalFileURLs = [];
        if (files.length > 0) {
            medicalFileURLs = await uploadFiles(files, `medical-files/${user.uid}`);
        }

        const userSnap = await get(dbRef(rtdb, 'users/' + user.uid));
        const bookingData = {
            patientId: user.uid,
            patientName: userSnap.val()?.fullName || user.email,
            doctorId: doctorSel.value,
            doctorName: doctorSel.options[doctorSel.selectedIndex].text,
            date: appDate,
            time: appTime,
            description: document.getElementById('appDesc').value,
            medicalFiles: medicalFileURLs,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        await push(dbRef(rtdb, 'appointments'), bookingData);
        alert(translations[currentLanguage]?.appointment_booked || 'Appointment booked successfully!');
        bootstrap.Modal.getInstance(document.getElementById('bookingModal')).hide();
        document.getElementById('bookingForm').reset();
        document.getElementById('file-preview-list').innerHTML = '';
        refreshTimeSlots();
    } catch (err) {
        alert((translations[currentLanguage]?.error_label || 'Error: ') + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = translations[currentLanguage]?.confirm_booking || 'Confirm Booking';
    }
});

// ─── My Appointments & Bills ──────────────────────────────────────────────────
function renderDoctorsTeam() {
    const previewList = document.getElementById('doctors-team-list');
    const fullList = document.getElementById('all-doctors-list');
    if (!previewList) return;

    onValue(dbRef(rtdb, 'users'), (snap) => {
        if (!snap.exists()) return;
        const doctors = Object.values(snap.val()).filter(u => u.role === 'doctor' && u.status === 'approved');

        // Render 3 for the dashboard preview
        previewList.innerHTML = doctors.slice(0, 3).map(d => `
            <div class="col-md-4">
                <div class="p-3 border rounded-3 text-center bg-light bg-opacity-10 h-100">
                    <div class="avatar-circle mx-auto mb-2 bg-primary bg-opacity-25 d-flex align-items-center justify-content-center" style="width: 50px; height: 50px; border-radius: 50%;">
                        <i class="fas fa-user-md text-primary fs-4"></i>
                    </div>
                    <div class="fw-bold small text-truncate">${d.fullName || d.name || '—'}</div>
                    <div class="text-muted" style="font-size: 11px;">${translations[currentLanguage]?.[d.specialization || d.department] || d.specialization || d.department || '—'}</div>
                </div>
            </div>
        `).join('') || `<div class="col-12 text-muted small">${translations[currentLanguage]?.no_doctors || 'No doctors found.'}</div>`;

        // Render all for the modal
        if (fullList) {
            fullList.innerHTML = doctors.map(d => `
                <div class="col-md-6 col-lg-4">
                    <div class="glass-card p-4 text-center h-100">
                        <div class="avatar-circle mx-auto mb-3 bg-primary bg-opacity-25 d-flex align-items-center justify-content-center" style="width: 60px; height: 60px; border-radius: 50%;">
                            <i class="fas fa-user-md text-primary fs-3"></i>
                        </div>
                        <h6 class="fw-bold mb-1">${d.fullName || d.name || '—'}</h6>
                        <p class="text-primary small mb-2">${translations[currentLanguage]?.[d.specialization || d.department] || d.specialization || d.department || '—'}</p>
                        <hr class="my-3 opacity-25">
                        <div class="d-flex justify-content-center gap-2">
                             <span class="badge bg-light text-dark border"><i class="fas fa-phone-alt me-1 text-muted"></i> ${d.mobile || '—'}</span>
                        </div>
                        <p class="small text-muted mt-3 mb-0">${d.department ? (translations[currentLanguage]?.[d.department] || d.department) : ''}</p>
                        <button class="btn btn-sm btn-outline-primary mt-3 w-100" data-bs-toggle="modal" data-bs-target="#bookingModal" onclick="preSelectDoctor('${d.department}', '${doctors.find(doc => doc.fullName === d.fullName) ? Object.keys(snap.val()).find(key => snap.val()[key].fullName === d.fullName) : ''}')">
                            <i class="fas fa-calendar-check me-1"></i> <span data-i18n="book_now">${translations[currentLanguage]?.book_now || 'Book Now'}</span>
                        </button>
                    </div>
                </div>
            `).join('') || `<div class="col-12 text-muted text-center py-5">${translations[currentLanguage]?.no_doctors || 'No doctors found.'}</div>`;
        }
    });
}

window.preSelectDoctor = (dept, docId) => {
    // Basic helper to pre-fill the booking modal
    const deptSel = document.getElementById('deptSelect');
    const docSel = document.getElementById('doctorSelect');
    if (deptSel) {
        deptSel.value = dept;
        // Trigger the change event to load doctors for this dept
        deptSel.dispatchEvent(new Event('change'));
        // Wait for doctors to load then select
        setTimeout(() => {
            if (docSel) docSel.value = docId;
        }, 300);
    }
};

function initData() {
    const user = auth.currentUser;
    if (!user) return;

    renderDoctorsTeam();

    onValue(dbRef(rtdb, 'appointments'), (snap) => {
        const tbody = document.getElementById('appointments-status-table');
        const nextDiv = document.getElementById('next-appointment');
        if (!tbody) return;
        tbody.innerHTML = '';
        let next = null;

        if (!snap.exists()) { tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-3">${translations[currentLanguage]?.no_appointments_yet || 'No appointments yet.'}</td></tr>`; return; }

        const today = new Date().toISOString().split('T')[0];
        const appointments = Object.entries(snap.val())
            .filter(([id, app]) => app.patientId === user.uid && app.status !== 'deleted')
            .sort((a, b) => new Date(b[1].date) - new Date(a[1].date));

        appointments.forEach(([id, app]) => {
            if (!next && app.status === 'approved' && app.date >= today) next = app;

            const filesHTML = (app.medicalFiles && app.medicalFiles.length > 0)
                ? app.medicalFiles.map((url, i) => `<a href="${url}" target="_blank" class="btn btn-sm btn-outline-secondary me-1" title="File ${i + 1}"><i class="fas fa-file"></i></a>`).join('')
                : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><div class="fw-bold mb-0">${app.doctorName}</div></td>
                <td><small>${app.date} | ${app.time}</small></td>
                <td><span class="badge bg-${app.status === 'completed' ? 'info' : (app.status === 'approved' ? 'success' : (app.status === 'pending' ? 'warning text-dark' : 'danger'))}">${translations[currentLanguage]?.[app.status] || app.status}</span></td>
                <td><div class="d-flex gap-1">${filesHTML}</div></td>`;
            tbody.appendChild(row);
        });

        nextDiv.innerHTML = next
            ? `<div class="text-primary fw-bold">${next.date} at ${next.time}</div><small class="text-muted">Dr. ${next.doctorName}</small>`
            : `<p class="text-muted mb-0">${translations[currentLanguage]?.no_appointments || 'No upcoming appointments'}</p>`;
    });

    // Check if user is discharged and show a detailed notice
    onValue(dbRef(rtdb, 'users/' + user.uid), (snap) => {
        const userData = snap.val();
        const noticeDiv = document.getElementById('session-ended-notice');
        if (userData?.discharged) {
            // Find the latest bill for this user to show details
            get(dbRef(rtdb, 'bills')).then(billSnap => {
                let latestBill = null;
                if (billSnap.exists()) {
                    latestBill = Object.values(billSnap.val())
                        .filter(b => b.patientId === user.uid)
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                }

                if (noticeDiv) {
                    noticeDiv.classList.remove('d-none');
                    let billDetails = latestBill ? `
                        <div class="mt-2 small border-top pt-2 opacity-75">
                            <span class="me-3"><b>${translations[currentLanguage]?.room_charges || 'Room'}:</b> ${latestBill.roomCharges} ${translations[currentLanguage]?.currency || 'DA'}</span>
                            <span class="me-3"><b>${translations[currentLanguage]?.medicine_costs || 'Med'}:</b> ${latestBill.medicineCosts} ${translations[currentLanguage]?.currency || 'DA'}</span>
                            <span class="me-3"><b>${translations[currentLanguage]?.doctor_fees || 'Fees'}:</b> ${latestBill.doctorFees} ${translations[currentLanguage]?.currency || 'DA'}</span>
                            <span class="fw-bold text-primary"><b>${translations[currentLanguage]?.total || 'Total'}:</b> ${latestBill.total} ${translations[currentLanguage]?.currency || 'DA'}</span>
                        </div>
                    ` : '';

                    noticeDiv.innerHTML = `
                        <div class="alert alert-info alert-dismissible fade show mb-4 glass-card border-0 border-start border-4 border-info" role="alert">
                            <h5 class="alert-heading fw-bold"><i class="fas fa-info-circle me-2"></i><span data-i18n="session_ended">${translations[currentLanguage]?.session_ended || 'Session Ended'}</span></h5>
                            <p class="mb-0">${translations[currentLanguage]?.discharge_message || 'Your session has ended. You are free to go! Please check your bills below.'}</p>
                            ${billDetails}
                            <button type="button" class="btn-close" data-bs-dismiss="alert" onclick="acknowledgeDischarge()"></button>
                        </div>
                    `;
                }
            });
        } else if (noticeDiv) {
            noticeDiv.classList.add('d-none');
        }
    });

    onValue(dbRef(rtdb, 'bills'), (snap) => {
        const tbody = document.getElementById('patient-bills-table');
        if (!tbody) return;
        tbody.innerHTML = '';
        const trans = window.translations || {};
        const lang = window.currentLanguage || 'en';
        if (!snap.exists()) { tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-center py-3">${trans[lang]?.no_bills_yet || 'No bills yet.'}</td></tr>`; return; }

        const bills = Object.entries(snap.val())
            .filter(([id, bill]) => bill.patientId === user.uid)
            .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));

        bills.forEach(([id, bill]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><small>${bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : '—'}</small></td>
                <td class="fw-bold text-primary">${bill.total} ${translations[currentLanguage]?.currency || 'DA'}</td>
                <td><button class="btn btn-sm btn-outline-primary" onclick="downloadBill('${id}')"><i class="fas fa-download me-1"></i>PDF</button></td>`;
            tbody.appendChild(row);
        });
    });

    onValue(dbRef(rtdb, 'certificates'), (snap) => {
        const tbody = document.getElementById('patient-certificates-table');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!snap.exists()) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-3">${translations[currentLanguage]?.no_certificates || 'No certificates available.'}</td></tr>`;
            return;
        }

        const trans = window.translations || {};
        const lang = window.currentLanguage || 'en';
        const certs = Object.entries(snap.val())
            .filter(([id, c]) => c.patientId === user.uid)
            .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt));

        if (certs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-3">${trans[lang]?.no_certificates || 'No certificates available.'}</td></tr>`;
            return;
        }

        certs.forEach(([id, c]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><div class="fw-bold mb-0">${c.doctorName}</div></td>
                <td><small>${c.sessionDate}</small></td>
                <td><div class="small text-muted text-truncate" style="max-width: 250px;" title="${c.note}">${c.note || '—'}</div></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="downloadCertificate('${id}')">
                        <i class="fas fa-download me-1"></i> <span data-i18n="download">${trans[lang]?.download || 'Download'}</span>
                    </button>
                </td>`;
            tbody.appendChild(row);
        });
    });
}

window.downloadCertificate = async (certId) => {
    try {
        const { generateCertificate } = await import('./pdf-generator.js');
        const certSnap = await get(dbRef(rtdb, 'certificates/' + certId));
        if (!certSnap.exists()) throw new Error("Certificate not found");
        const certData = certSnap.val();

        const userSnap = await get(dbRef(rtdb, 'users/' + certData.patientId));
        const patientData = userSnap.val() || { fullName: certData.patientName || 'Patient' };

        const doctorId = certData.doctorId;
        const doctorSnap = await get(dbRef(rtdb, 'users/' + doctorId));
        const doctorData = doctorSnap.val() || { fullName: certData.doctorName || 'Doctor' };

        await generateCertificate(doctorData, patientData, {
            sessionDate: certData.sessionDate,
            diagnosis: certData.note || certData.diagnosis,
            medications: certData.medications || '—'
        }, true);
    } catch (error) {
        console.error("Download failed:", error);
        alert("Error generating PDF: " + error.message);
    }
};

window.acknowledgeDischarge = async () => {
    const user = auth.currentUser;
    if (user) {
        await update(dbRef(rtdb, 'users/' + user.uid), { discharged: false });
    }
};

window.downloadBill = async (billId) => {
    const { jsPDF } = window.jspdf;
    const billSnap = await get(dbRef(rtdb, 'bills/' + billId));
    const bill = billSnap.val();
    const userSnap = await get(dbRef(rtdb, 'users/' + bill.patientId));
    const patient = userSnap.val() || {};

    const doc = new jsPDF();
    const trans = window.translations || {};
    const lang = window.currentLanguage || 'en';
    const clinicName = trans[lang]?.title || 'Clinique Online';
    doc.setFontSize(20); doc.text(`${clinicName} Invoice`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Patient: ${patient.fullName || '—'}`, 14, 40);
    doc.text(`Date: ${bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : '—'}`, 14, 50);
    doc.text(`Room Charges: ${bill.roomCharges || 0} DA`, 14, 70);
    doc.text(`Medicine Costs: ${bill.medicineCosts || 0} DA`, 14, 80);
    doc.text(`Doctor Fees: ${bill.doctorFees || 0} DA`, 14, 90);
    doc.setFontSize(14); doc.text(`Total: ${bill.total || 0} DA`, 14, 105);
    doc.save(`invoice-${billId}.pdf`);
};

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => { if (user) initData(); });
});
