import { rtdb, auth, firebaseConfig } from './firebase-config.js';
import { logout } from './auth.js';
import { generateInvoice } from './pdf-generator.js';
import {
    ref, onValue, update, remove, push, get
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Initialize a secondary Firebase app for creating users without logging out admin
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

document.getElementById('logoutBtn')?.addEventListener('click', logout);

// ─── Global State ─────────────────────────────────────────────────────────────
let allUsers = {};
let allAppointments = {};
let allBills = {};
let userFilter = 'all';

// ─── Real-time Listeners ──────────────────────────────────────────────────────
function initListeners() {
    // Users
    onValue(ref(rtdb, 'users'), snap => {
        allUsers = snap.val() || {};
        updateOverviewCounts();
        renderPendingUsers();
        renderUsers();
        renderDepartments();
    });

    // Appointments
    onValue(ref(rtdb, 'appointments'), snap => {
        allAppointments = snap.val() || {};
        updateOverviewCounts();
        renderAllAppointments();
    });

    // Bills
    onValue(ref(rtdb, 'bills'), snap => {
        allBills = snap.val() || {};
        renderBilling();
    });
}

// ─── Overview Counts ─────────────────────────────────────────────────────────
function updateOverviewCounts() {
    let doctors = 0, patients = 0, pending = 0;
    Object.values(allUsers).forEach(u => {
        if (u.status === 'pending') pending++;
        if (u.role === 'doctor' && u.status === 'approved') doctors++;
        if (u.role === 'patient' && u.status === 'approved') patients++;
    });
    document.getElementById('count-doctors').innerText = doctors;
    document.getElementById('count-patients').innerText = patients;
    document.getElementById('count-pending').innerText = pending;
    document.getElementById('count-appointments').innerText = Object.keys(allAppointments).length;
}

// ─── Pending Users (Overview) ─────────────────────────────────────────────────
function renderPendingUsers() {
    const tbody = document.getElementById('pending-users-table');
    const pending = Object.entries(allUsers).filter(([, u]) => u.status === 'pending');
    if (pending.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">${translations[currentLanguage]?.no_pending_approvals || 'No pending approvals.'}</td></tr>`;
        return;
    }
    tbody.innerHTML = pending.map(([id, u]) => `
        <tr>
            <td>
                <div class="fw-bold">${u.fullName || 'Unknown'}</div>
                <small class="text-muted">${u.email}</small>
            </td>
            <td><span class="badge bg-${u.role === 'doctor' ? 'primary' : 'success'} text-capitalize">${translations[currentLanguage]?.[u.role] || u.role}</span></td>
            <td><small>${u.role === 'doctor' ? `${translations[currentLanguage]?.department || 'Dept'}: ${translations[currentLanguage]?.[u.department] || u.department || '-'}` : `${translations[currentLanguage]?.symptoms || 'Symptoms'}: ${(u.symptoms || 'None').substring(0, 30)}...`}</small></td>
            <td>
                ${u.certificateURL
            ? `<a href="${u.certificateURL}" target="_blank" class="btn btn-sm btn-outline-info cert-link"><i class="fas fa-file-pdf me-1"></i>${translations[currentLanguage]?.view_certificate || 'View'}</a>`
            : '<span class="text-muted">—</span>'}
            </td>
            <td>
                <button class="btn btn-sm btn-success me-1" onclick="approveUser('${id}')"><i class="fas fa-check"></i></button>
                <button class="btn btn-sm btn-danger" onclick="rejectUser('${id}')"><i class="fas fa-times"></i></button>
            </td>
        </tr>
    `).join('');
}

// ─── Manage Users ─────────────────────────────────────────────────────────────
window.filterUsers = (f) => { userFilter = f; renderUsers(); };

window.renderUsers = () => {
    const tbody = document.getElementById('all-users-table');
    const search = (document.getElementById('userSearch')?.value || '').toLowerCase();

    let entries = Object.entries(allUsers).filter(([, u]) => u.role !== 'admin');

    if (userFilter === 'pending') entries = entries.filter(([, u]) => u.status === 'pending');
    else if (userFilter !== 'all') entries = entries.filter(([, u]) => u.role === userFilter);

    if (search) entries = entries.filter(([, u]) =>
        (u.fullName || '').toLowerCase().includes(search) ||
        (u.email || '').toLowerCase().includes(search)
    );

    if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">${translations[currentLanguage]?.no_users_found || 'No users found.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = entries.map(([id, u]) => `
        <tr>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold" style="width:38px;height:38px;flex-shrink:0;">
                        ${(u.fullName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="fw-bold">${u.fullName || '—'}</div>
                        <small class="text-muted">${u.email || ''}</small>
                    </div>
                </div>
            </td>
            <td><span class="badge bg-${u.role === 'doctor' ? 'primary' : 'success'} text-capitalize">${translations[currentLanguage]?.[u.role] || u.role}</span></td>
            <td>
                <span class="badge bg-${u.status === 'approved' ? 'success' : u.status === 'pending' ? 'warning text-dark' : 'secondary'} text-capitalize">${translations[currentLanguage]?.[u.status] || u.status}</span>
            </td>
            <td>
                ${u.certificateURL
            ? `<a href="${u.certificateURL}" target="_blank" class="btn btn-sm btn-outline-info cert-link"><i class="fas fa-file-pdf me-1"></i>${translations[currentLanguage]?.view_certificate || 'View'}</a>`
            : '<span class="text-muted small">—</span>'}
            </td>
            <td class="d-flex gap-1 flex-wrap">
                <button class="btn btn-sm btn-outline-primary" onclick="viewUserContent('${id}')"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-outline-secondary" onclick="openEditModal('${id}')"><i class="fas fa-edit"></i></button>
                ${u.status === 'pending'
            ? `<button class="btn btn-sm btn-success" onclick="approveUser('${id}')"><i class="fas fa-check"></i></button>`
            : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteUser('${id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
};

window.approveUser = async (uid) => {
    await update(ref(rtdb, 'users/' + uid), { status: 'approved', discharged: false });
};

window.rejectUser = async (uid) => {
    if (confirm(translations[currentLanguage]?.confirm_reject || 'Reject and delete this user?')) await remove(ref(rtdb, 'users/' + uid));
};

window.deleteUser = async (uid) => {
    if (confirm(translations[currentLanguage]?.confirm_delete_user || 'Permanently delete this user? This cannot be undone.')) {
        await remove(ref(rtdb, 'users/' + uid));
    }
};

// ─── Add/Edit User Logic ──────────────────────────────────────────────────────
window.toggleAddUserFields = (role) => {
    document.getElementById('add-doctor-fields').style.display = role === 'doctor' ? 'block' : 'none';
    document.getElementById('add-patient-fields').style.display = role === 'patient' ? 'block' : 'none';
};

window.toggleEditUserFields = (role) => {
    document.getElementById('edit-doctor-fields').style.display = role === 'doctor' ? 'block' : 'none';
    document.getElementById('edit-patient-fields').style.display = role === 'patient' ? 'block' : 'none';
};

document.getElementById('addUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const role = formData.get('role');
    const fullName = formData.get('fullName');
    const department = formData.get('department');
    const symptoms = formData.get('symptoms');

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;

        const userData = {
            email,
            role,
            fullName,
            status: 'approved',
            createdAt: new Date().toISOString()
        };

        if (role === 'doctor') userData.department = department;
        if (role === 'patient') userData.symptoms = symptoms;

        await update(ref(rtdb, 'users/' + uid), userData);
        await secondaryAuth.signOut(); // Security: sign out from secondary session

        bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
        e.target.reset();
        alert(translations[currentLanguage]?.user_added_success || 'User added successfully!');
    } catch (err) {
        alert("Error creating user: " + err.message);
    }
});

window.openEditModal = (uid) => {
    const u = allUsers[uid];
    const form = document.getElementById('editUserForm');
    form.uid.value = uid;
    form.fullName.value = u.fullName || '';
    form.role.value = u.role;
    form.department.value = u.department || 'cardiology';
    form.symptoms.value = u.symptoms || '';

    toggleEditUserFields(u.role);
    new bootstrap.Modal(document.getElementById('editUserModal')).show();
};

document.getElementById('editUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const uid = formData.get('uid');
    const role = formData.get('role');
    const fullName = formData.get('fullName');
    const department = formData.get('department');
    const symptoms = formData.get('symptoms');

    try {
        const updates = { fullName, role };
        if (role === 'doctor') {
            updates.department = department;
            updates.symptoms = null;
        } else {
            updates.symptoms = symptoms;
            updates.department = null;
        }

        await update(ref(rtdb, 'users/' + uid), updates);
        bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
        alert(translations[currentLanguage]?.user_updated_success || 'User updated successfully!');
    } catch (err) {
        alert("Error updating user: " + err.message);
    }
});

window.viewUserContent = (uid) => {
    const u = allUsers[uid];
    const appointments = Object.values(allAppointments).filter(a => a.patientId === uid || a.doctorId === uid);
    const bills = Object.values(allBills).filter(b => b.patientId === uid);

    let html = `<h6>${translations[currentLanguage]?.account_details || 'Account Details'}</h6>
                <p><strong>${translations[currentLanguage]?.full_name || 'Name'}:</strong> ${u.fullName}<br>
                <strong>${translations[currentLanguage]?.email_label || 'Email'}:</strong> ${u.email}<br>
                <strong>${translations[currentLanguage]?.role || 'Role'}:</strong> ${u.role}</p>
                <hr>
                <h6>${translations[currentLanguage]?.appointments || 'Appointments'}</h6>`;

    if (appointments.length === 0) {
        html += `<p class="text-muted small">${translations[currentLanguage]?.no_appointments || 'No appointments'}</p>`;
    } else {
        html += `<ul class="list-group list-group-flush mb-3">` + appointments.map(a => {
            const filesHTML = (a.medicalFiles && a.medicalFiles.length > 0)
                ? `<div class="mt-1">` + a.medicalFiles.map((url, i) => `<a href="${url}" target="_blank" class="btn btn-xs btn-outline-info me-1 py-0 px-1" style="font-size: 10px;"><i class="fas fa-file"></i> ${i + 1}</a>`).join('') + `</div>`
                : '';

            return `
            <li class="list-group-item px-0 bg-transparent">
                <div class="d-flex justify-content-between">
                    <span>${a.date} ${a.time}</span>
                    <span class="badge bg-${a.status === 'approved' ? 'success' : 'warning text-dark'}">${a.status}</span>
                </div>
                <div class="text-muted small">${a.description || ''}</div>
                ${filesHTML}
            </li>`;
        }).join('') + `</ul>`;
    }

    if (u.role === 'patient') {
        html += `<h6>${translations[currentLanguage]?.billing || 'Billing'}</h6>`;
        if (bills.length === 0) {
            html += `<p class="text-muted small">${translations[currentLanguage]?.no_bills_yet || 'No bills'}</p>`;
        } else {
            html += `<ul class="list-group list-group-flush">` + bills.map(b => `
                <li class="list-group-item px-0 bg-transparent">
                    <div class="d-flex justify-content-between fw-bold">
                        <span>${new Date(b.createdAt).toLocaleDateString()}</span>
                        <span>$${b.total}</span>
                    </div>
                </li>
            `).join('') + `</ul>`;
        }
    }

    document.getElementById('user-content-body').innerHTML = html;
    new bootstrap.Modal(document.getElementById('viewContentModal')).show();
};

// ─── All Appointments ─────────────────────────────────────────────────────────
function renderAllAppointments() {
    const tbody = document.getElementById('all-appointments-table');
    const entries = Object.entries(allAppointments);
    if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">${translations[currentLanguage]?.no_appointments_yet || 'No appointments yet.'}</td></tr>`;
        return;
    }
    tbody.innerHTML = entries.map(([id, a]) => `
        <tr>
            <td><div class="fw-bold">${a.patientName || '—'}</div></td>
            <td>${a.doctorName || '—'}</td>
            <td>${a.date} ${a.time}</td>
            <td><small>${(a.description || '—').substring(0, 40)}</small></td>
            <td>
                ${(a.medicalFiles && a.medicalFiles.length > 0)
            ? a.medicalFiles.map((url, i) => `<a href="${url}" target="_blank" class="btn btn-sm btn-outline-secondary me-1 mb-1 cert-link"><i class="fas fa-file me-1"></i>${translations[currentLanguage]?.file || 'File'} ${i + 1}</a>`).join('')
            : '<span class="text-muted small">—</span>'}
            </td>
            <td><span class="badge bg-${a.status === 'approved' ? 'success' : a.status === 'pending' ? 'warning text-dark' : 'danger'} text-capitalize">${translations[currentLanguage]?.[a.status] || a.status}</span></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteAppointment('${id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.deleteAppointment = async (id) => {
    if (confirm(translations[currentLanguage]?.confirm_delete_appointment || 'Delete this appointment?')) await remove(ref(rtdb, 'appointments/' + id));
};

// ─── Departments ──────────────────────────────────────────────────────────────
const DEPARTMENTS = [
    { id: 'cardiology', name: 'Cardiology', icon: 'fas fa-heartbeat', color: 'danger' },
    { id: 'neurology', name: 'Neurology', icon: 'fas fa-brain', color: 'primary' },
    { id: 'pediatrics', name: 'Pediatrics', icon: 'fas fa-baby', color: 'success' },
    { id: 'orthopedics', name: 'Orthopedics', icon: 'fas fa-bone', color: 'warning' },
    { id: 'dermatology', name: 'Dermatology', icon: 'fas fa-spa', color: 'info' },
    { id: 'oncology', name: 'Oncology', icon: 'fas fa-ribbon', color: 'secondary' },
];

function renderDepartments() {
    const grid = document.getElementById('departments-grid');
    grid.innerHTML = DEPARTMENTS.map(dept => {
        const deptDoctors = Object.values(allUsers).filter(u => u.role === 'doctor' && u.department === dept.id && u.status === 'approved');
        const deptName = translations[currentLanguage]?.[dept.id] || dept.name;
        const countTxt = deptDoctors.length + ' ' + (deptDoctors.length === 1 ? (translations[currentLanguage]?.doctor_assigned || 'doctor') : (translations[currentLanguage]?.doctors_assigned || 'doctors'));

        return `
        <div class="col-md-4">
            <div class="glass-card p-4">
                <div class="d-flex align-items-center mb-3">
                    <div class="rounded-circle bg-${dept.color} text-white d-flex align-items-center justify-content-center me-3" style="width:48px;height:48px;">
                        <i class="${dept.icon}"></i>
                    </div>
                    <div>
                        <h5 class="mb-0">${deptName}</h5>
                        <small class="text-muted">${countTxt}</small>
                    </div>
                </div>
                ${deptDoctors.length > 0
                ? `<ul class="list-unstyled mb-0">${deptDoctors.map(d => `<li class="d-flex align-items-center gap-2 mb-2"><i class="fas fa-user-md text-${dept.color}"></i><span>${d.fullName}</span></li>`).join('')}</ul>`
                : `<p class="text-muted small mb-0">${translations[currentLanguage]?.no_doctors_assigned || 'No doctors assigned yet.'}</p>`}
            </div>
        </div>`;
    }).join('');
}

// ─── Billing ──────────────────────────────────────────────────────────────────
function renderBilling() {
    const tbody = document.getElementById('billing-table');
    const entries = Object.entries(allBills);
    if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">${translations[currentLanguage]?.no_bills_yet || 'No bills yet.'}</td></tr>`;
        return;
    }
    tbody.innerHTML = entries.map(([id, b]) => {
        const patient = allUsers[b.patientId];
        return `
        <tr>
            <td><div class="fw-bold">${patient?.fullName || (translations[currentLanguage]?.unknown || 'Unknown')}</div><small class="text-muted">${patient?.email || ''}</small></td>
            <td>$${b.roomCharges || 0}</td>
            <td>$${b.medicineCosts || 0}</td>
            <td>$${b.doctorFees || 0}</td>
            <td class="fw-bold text-primary">$${b.total || 0}</td>
            <td>${b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '—'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="downloadAdminInvoice('${id}')"><i class="fas fa-download me-1"></i>PDF</button>
            </td>
        </tr>`;
    }).join('');
}

window.downloadAdminInvoice = async (billId) => {
    const bill = allBills[billId];
    const patient = allUsers[bill.patientId] || { fullName: (translations[currentLanguage]?.unknown || 'Unknown'), address: '' };
    await generateInvoice(patient, bill);
};

// ─── Discharge a Patient ──────────────────────────────────────────────────────
window.dischargePatient = async (patientId) => {
    const room = parseFloat(prompt(translations[currentLanguage]?.enter_room_charges || 'Enter Room Charges:') || 0);
    const medicine = parseFloat(prompt(translations[currentLanguage]?.enter_medicine_costs || 'Enter Medicine Costs:') || 0);
    const doctor = parseFloat(prompt(translations[currentLanguage]?.enter_doctor_fees || 'Enter Doctor Fees:') || 0);
    const total = room + medicine + doctor;
    try {
        const billData = { patientId, roomCharges: room, medicineCosts: medicine, doctorFees: doctor, total, createdAt: new Date().toISOString() };
        await push(ref(rtdb, 'bills'), billData);
        await update(ref(rtdb, 'users/' + patientId), { discharged: true });
        await generateInvoice(allUsers[patientId] || {}, billData);
        alert(translations[currentLanguage]?.discharge_success || 'Patient discharged and invoice generated!');
    } catch (err) { alert((translations[currentLanguage]?.error_label || 'Error: ') + err.message); }
};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) initListeners();
    });
});
