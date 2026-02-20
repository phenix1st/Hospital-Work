import { db } from './firebase-config.js';
import { logout } from './auth.js';
import { generateInvoice } from './pdf-generator.js';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.getElementById('logoutBtn')?.addEventListener('click', logout);

// Initialize Dashboard Stats
function initStats() {
    // Count Doctors
    const doctorsQuery = query(collection(db, "users"), where("role", "==", "doctor"), where("status", "==", "approved"));
    onSnapshot(doctorsQuery, (snapshot) => {
        document.getElementById('count-doctors').innerText = snapshot.size;
    });

    // Count Patients (Only those not yet discharged)
    const patientsQuery = query(collection(db, "users"), where("role", "==", "patient"), where("status", "==", "approved"), where("discharged", "==", false));
    onSnapshot(patientsQuery, (snapshot) => {
        document.getElementById('count-patients').innerText = snapshot.size;
        renderAdmittedPatients(snapshot);
    });

    // Count Pending
    const pendingQuery = query(collection(db, "users"), where("status", "==", "pending"));
    onSnapshot(pendingQuery, (snapshot) => {
        document.getElementById('count-pending').innerText = snapshot.size;
        renderPendingUsers(snapshot);
    });

    // Count Appointments (Total)
    const appointmentsQuery = collection(db, "appointments");
    onSnapshot(appointmentsQuery, (snapshot) => {
        document.getElementById('count-appointments').innerText = snapshot.size;
    });
}

function renderPendingUsers(snapshot) {
    const tableBody = document.getElementById('pending-users-table');
    tableBody.innerHTML = '';

    if (snapshot.empty) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No pending approvals.</td></tr>';
        return;
    }

    snapshot.forEach((userDoc) => {
        const user = userDoc.data();
        const id = userDoc.id;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                        ${user.fullName ? user.fullName.charAt(0) : '?'}
                    </div>
                    <div>
                        <div class="fw-bold">${user.fullName || 'Unknown'}</div>
                        <small class="text-muted">${user.email}</small>
                    </div>
                </div>
            </td>
            <td><span class="badge bg-secondary text-capitalize">${user.role}</span></td>
            <td>
                <small>
                    ${user.role === 'doctor' ? `Dept: ${user.department}` : `Symptoms: ${user.symptoms ? user.symptoms.substring(0, 20) : 'None'}...`}
                </small>
            </td>
            <td>
                <button class="btn btn-sm btn-success me-1" onclick="approveUser('${id}')"><i class="fas fa-check"></i></button>
                <button class="btn btn-sm btn-danger" onclick="rejectUser('${id}')"><i class="fas fa-times"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderAdmittedPatients(snapshot) {
    const tableBody = document.getElementById('admitted-patients-table');
    tableBody.innerHTML = '';

    if (snapshot.empty) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4">No patients admitted.</td></tr>';
        return;
    }

    snapshot.forEach((userDoc) => {
        const user = userDoc.data();
        const id = userDoc.id;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="fw-bold">${user.fullName}</div>
                <small class="text-muted">${user.email}</small>
            </td>
            <td>${user.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="dischargePatient('${id}')">
                    <i class="fas fa-file-invoice-dollar me-1"></i> Discharge
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

window.approveUser = async (userId) => {
    try {
        await updateDoc(doc(db, "users", userId), {
            status: 'approved',
            discharged: false // Initialize discharged flag
        });
    } catch (error) {
        alert("Error approving user: " + error.message);
    }
};

window.rejectUser = async (userId) => {
    if (confirm("Are you sure you want to reject and delete this user?")) {
        try {
            await deleteDoc(doc(db, "users", userId));
        } catch (error) {
            alert("Error rejecting user: " + error.message);
        }
    }
};

window.dischargePatient = async (patientId) => {
    const room = parseFloat(prompt("Enter Room Charges:") || 0);
    const medicine = parseFloat(prompt("Enter Medicine Costs:") || 0);
    const doctor = parseFloat(prompt("Enter Doctor Fees:") || 0);
    const total = room + medicine + doctor;

    try {
        // Fetch user data for the PDF
        const docRef = doc(db, "users", patientId);
        const userSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", patientId)));
        const userData = userSnap.docs[0].data();

        const billData = {
            patientId,
            roomCharges: room,
            medicineCosts: medicine,
            doctorFees: doctor,
            total,
            createdAt: new Date()
        };

        await addDoc(collection(db, "bills"), billData);
        await updateDoc(doc(db, "users", patientId), { discharged: true });

        await generateInvoice(userData, billData);
        alert("Patient discharged and invoice generated!");
    } catch (error) {
        alert("Error discharging patient: " + error.message);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', initStats);
