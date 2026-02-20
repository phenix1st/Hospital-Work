import { db, auth } from './firebase-config.js';
import { logout } from './auth.js';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.getElementById('logoutBtn')?.addEventListener('click', logout);

function initDoctorDashboard() {
    const user = auth.currentUser;
    if (!user) return;

    // Load Appointments for this Doctor
    const q = query(collection(db, "appointments"), where("doctorId", "==", user.uid));
    onSnapshot(q, (snapshot) => {
        const tableBody = document.getElementById('doctor-appointments-table');
        tableBody.innerHTML = '';

        let pending = 0;
        let today = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        snapshot.forEach(doc => {
            const app = doc.data();
            const id = doc.id;

            if (app.status === 'pending') pending++;
            if (app.date === todayStr) today++;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.patientName}</td>
                <td>${app.date} | ${app.time}</td>
                <td><small>${app.description || 'N/A'}</small></td>
                <td>
                    ${app.status === 'pending' ? `
                        <button class="btn btn-sm btn-success me-1" onclick="updateAppStatus('${id}', 'approved')"><i class="fas fa-check"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="updateAppStatus('${id}', 'rejected')"><i class="fas fa-times"></i></button>
                    ` : `<span class="badge bg-${app.status === 'approved' ? 'success' : 'danger'}">${app.status}</span>`}
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
        await updateDoc(doc(db, "appointments", appId), { status });
    } catch (error) {
        alert("Error updating appointment: " + error.message);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) initDoctorDashboard();
    });
});
