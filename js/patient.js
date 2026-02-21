import { rtdb, auth, storage } from './firebase-config.js';
import { logout } from './auth.js';
import {
    ref as dbRef, onValue, push, get
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import {
    ref as storageRef, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

document.getElementById('logoutBtn')?.addEventListener('click', logout);

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
    const urls = [];
    const progressBar = document.getElementById('progress-bar');
    const uploadStatus = document.getElementById('upload-status');
    const progressDiv = document.getElementById('upload-progress');

    if (progressDiv) progressDiv.classList.remove('d-none');

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `${folder}/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, path);

        await new Promise((resolve, reject) => {
            const task = uploadBytesResumable(fileRef, file);
            task.on('state_changed',
                (snapshot) => {
                    const progress = snapshot.totalBytes > 0 ? (snapshot.bytesTransferred / snapshot.totalBytes) : 0;
                    const pct = Math.round(((i + progress) / files.length) * 100);
                    if (progressBar) progressBar.style.width = pct + '%';
                    if (uploadStatus) {
                        const uploadingText = translations[currentLanguage]?.uploading || 'Uploading...';
                        uploadStatus.textContent = `${uploadingText} ${i + 1} / ${files.length}`;
                    }
                },
                (error) => {
                    console.error("Upload failed:", error);
                    reject(error);
                },
                async () => {
                    try {
                        const url = await getDownloadURL(task.snapshot.ref);
                        urls.push(url);
                        resolve();
                    } catch (err) {
                        console.error("Error getting download URL:", err);
                        reject(err);
                    }
                }
            );
        });
    }

    if (progressDiv) progressDiv.classList.add('d-none');
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
function initData() {
    const user = auth.currentUser;
    if (!user) return;

    onValue(dbRef(rtdb, 'appointments'), (snap) => {
        const tbody = document.getElementById('appointments-status-table');
        const nextDiv = document.getElementById('next-appointment');
        tbody.innerHTML = '';
        let next = null;

        if (!snap.exists()) { tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">${translations[currentLanguage]?.no_appointments_yet || 'No appointments yet.'}</td></tr>`; return; }

        const today = new Date().toISOString().split('T')[0];
        Object.entries(snap.val()).forEach(([id, app]) => {
            if (app.patientId !== user.uid) return;
            if (!next && app.status === 'approved' && app.date >= today) next = app;

            const filesHTML = (app.medicalFiles && app.medicalFiles.length > 0)
                ? app.medicalFiles.map((url, i) => `<a href="${url}" target="_blank" class="btn btn-sm btn-outline-secondary me-1"><i class="fas fa-file"></i> ${i + 1}</a>`).join('')
                : '—';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.doctorName}</td>
                <td>${app.date}</td>
                <td>${app.time}</td>
                <td><span class="badge bg-${app.status === 'approved' ? 'success' : app.status === 'pending' ? 'warning text-dark' : 'danger'}">${translations[currentLanguage]?.[app.status] || app.status}</span></td>
                <td>${filesHTML}</td>`;
            tbody.appendChild(row);
        });

        nextDiv.innerHTML = next
            ? `<div class="text-primary fw-bold">${next.date} at ${next.time}</div><small class="text-muted">Dr. ${next.doctorName}</small>`
            : `<p class="text-muted mb-0">${translations[currentLanguage]?.no_appointments || 'No upcoming appointments'}</p>`;
    });

    onValue(dbRef(rtdb, 'bills'), (snap) => {
        const tbody = document.getElementById('patient-bills-table');
        tbody.innerHTML = '';
        if (!snap.exists()) { tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-center py-3">${translations[currentLanguage]?.no_bills_yet || 'No bills yet.'}</td></tr>`; return; }

        Object.entries(snap.val()).forEach(([id, bill]) => {
            if (bill.patientId !== user.uid) return;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : '—'}</td>
                <td class="fw-bold">$${bill.total}</td>
                <td><button class="btn btn-sm btn-outline-primary" onclick="downloadBill('${id}')"><i class="fas fa-download me-1"></i>PDF</button></td>`;
            tbody.appendChild(row);
        });
    });
}

window.downloadBill = async (billId) => {
    const { jsPDF } = window.jspdf;
    const billSnap = await get(dbRef(rtdb, 'bills/' + billId));
    const bill = billSnap.val();
    const userSnap = await get(dbRef(rtdb, 'users/' + bill.patientId));
    const patient = userSnap.val() || {};

    const doc = new jsPDF();
    doc.setFontSize(20); doc.text('Hospital Invoice', 14, 20);
    doc.setFontSize(12);
    doc.text(`Patient: ${patient.fullName || '—'}`, 14, 40);
    doc.text(`Date: ${bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : '—'}`, 14, 50);
    doc.text(`Room Charges: $${bill.roomCharges || 0}`, 14, 70);
    doc.text(`Medicine Costs: $${bill.medicineCosts || 0}`, 14, 80);
    doc.text(`Doctor Fees: $${bill.doctorFees || 0}`, 14, 90);
    doc.setFontSize(14); doc.text(`Total: $${bill.total || 0}`, 14, 105);
    doc.save(`invoice-${billId}.pdf`);
};

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => { if (user) initData(); });
});
