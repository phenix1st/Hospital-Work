import { rtdb, auth } from './firebase-config.js';
import { logout } from './auth.js';
import {
    ref,
    onValue,
    update
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

document.getElementById('logoutBtn')?.addEventListener('click', logout);

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
                <td>${filesHTML}</td>
                <td>
                    ${app.status === 'pending' ? `
                        <button class="btn btn-sm btn-success me-1" onclick="updateAppStatus('${id}', 'approved')"><i class="fas fa-check"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="updateAppStatus('${id}', 'rejected')"><i class="fas fa-times"></i></button>
                    ` : `<span class="badge bg-${app.status === 'approved' ? 'success' : 'danger'}">${translations[currentLanguage]?.[app.status] || app.status}</span>`}
                </td>
            `;
            tableBody.appendChild(row);
        });

        document.getElementById('pending-appointments').innerText = pending;
        document.getElementById('today-load').innerText = today;
    });
}

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
