import { auth, rtdb } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    ref,
    set,
    get
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const ADMIN_EMAIL = "azizhospital@gmail.com";

// Check User Role and Status
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userSnap = await get(ref(rtdb, 'users/' + user.uid));
        if (userSnap.exists()) {
            const userData = userSnap.val();
            const currentPath = window.location.pathname;

            // Special Admin Check
            if (userData.role === 'admin') {
                if (user.email !== ADMIN_EMAIL) {
                    alert("Access Denied: Only the authorized hospital administrator can access this dashboard.");
                    logout();
                    return;
                }
            }

            if (userData.status === 'pending' && !currentPath.includes('login.html')) {
                alert("Your account is pending admin approval.");
                logout();
                return;
            }

            if (userData.status === 'approved') {
                if (userData.role === 'admin' && !currentPath.includes('admin-dashboard.html')) {
                    window.location.href = 'admin-dashboard.html';
                } else if (userData.role === 'doctor' && !currentPath.includes('doctor-dashboard.html')) {
                    window.location.href = 'doctor-dashboard.html';
                } else if (userData.role === 'patient' && !currentPath.includes('patient-dashboard.html')) {
                    window.location.href = 'patient-dashboard.html';
                }
            }
        }
    } else {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('login.html') && !currentPath.includes('register.html') && currentPath !== '/' && !currentPath.includes('index.html')) {
            window.location.href = 'login.html';
        }
    }
});

export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        throw error;
    }
}

export async function register(email, password, role, profileData) {
    try {
        // Prevent manual 'admin' registration
        if (role === 'admin') throw new Error("Unauthorized role assignment.");

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await set(ref(rtdb, 'users/' + user.uid), {
            email: email,
            role: role,
            status: 'pending',
            createdAt: new Date().toISOString(),
            ...profileData
        });

        return user;
    } catch (error) {
        throw error;
    }
}

export function logout() {
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    });
}
