import { db, auth } from './firebase-config.js';
import { logout } from './auth.js';
import { generateTimeSlots } from './appointments.js';
import { generateInvoice } from './pdf-generator.js';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    getDocs,
    serverTimestamp,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

document.getElementById('logoutBtn')?.addEventListener('click', logout);

// Initialize Time Slots
const slots = generateTimeSlots();
const timeSelect = document.getElementById('timeSlot');
slots.forEach(slot => {
    const option = document.createElement('option');
    option.value = slot;
    option.textContent = slot;
    timeSelect.appendChild(option);
});

// Load Doctors based on Department
document.getElementById('deptSelect').addEventListener('change', async (e) => {
    const dept = e.target.value;
    const doctorSelect = document.getElementById('doctorSelect');
    doctorSelect.innerHTML = '<option value="">Select Doctor</option>';

    if (!dept) return;

    const q = query(collection(db, "users"), where("role", "==", "doctor"), where("department", "==", dept), where("status", "==", "approved"));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
        const data = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = data.fullName;
        doctorSelect.appendChild(option);
    });
});

// Booking Form Logic
document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const bookingData = {
        patientId: user.uid,
        patientName: document.getElementById('fullName')?.value || user.email,
        doctorId: document.getElementById('doctorSelect').value,
        doctorName: document.getElementById('doctorSelect').options[document.getElementById('doctorSelect').selectedIndex].text,
        date: document.getElementById('appDate').value,
        time: document.getElementById('timeSlot').value,
        description: document.getElementById('appDesc').value,
        status: 'pending',
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "appointments"), bookingData);
        alert("Appointment booked successfully! Pending doctor approval.");
        bootstrap.Modal.getInstance(document.getElementById('bookingModal')).hide();
    } catch (error) {
        alert("Error booking appointment: " + error.message);
    }
});

// Observe My Appointments & Bills
function initData() {
    const user = auth.currentUser;
    if (!user) return;

    // Load Appointments
    const q = query(collection(db, "appointments"), where("patientId", "==", user.uid));
    onSnapshot(q, (snapshot) => {
        const tableBody = document.getElementById('appointments-status-table');
        tableBody.innerHTML = '';

        snapshot.forEach(doc => {
            const app = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.doctorName}</td>
                <td>${app.date}</td>
                <td>${app.time}</td>
                <td><span class="badge bg-${app.status === 'approved' ? 'success' : (app.status === 'pending' ? 'warning' : 'danger')}">${app.status}</span></td>
            `;
            tableBody.appendChild(row);
        });
    });

    // Load Bills
    const billQuery = query(collection(db, "bills"), where("patientId", "==", user.uid));
    onSnapshot(billQuery, (snapshot) => {
        const tableBody = document.getElementById('patient-bills-table');
        tableBody.innerHTML = '';

        snapshot.forEach(billDoc => {
            const bill = billDoc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${bill.createdAt?.toDate ? bill.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
                <td>${bill.total}$</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="downloadBill('${billDoc.id}')">
                        <i class="fas fa-download"></i> PDF
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    });
}

window.downloadBill = async (billId) => {
    try {
        const billSnap = await getDoc(doc(db, "bills", billId));
        const billData = billSnap.data();

        const userSnap = await getDoc(doc(db, "users", billData.patientId));
        const userData = userSnap.data();

        await generateInvoice(userData, billData);
    } catch (error) {
        alert("Error downloading bill: " + error.message);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) initData();
    });
});
