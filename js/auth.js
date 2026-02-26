import { auth, rtdb } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updatePassword
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
    ref,
    set,
    get
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const ADMIN_EMAILS = ["azizhospital@gmail.com", "hospitalbiskra@gmail.com"];

// Check User Role and Status
onAuthStateChanged(auth, async (user) => {
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath.includes('login.html') || currentPath.includes('register.html') || currentPath === '/' || currentPath.includes('index.html');

    if (user) {
        try {
            const userSnap = await get(ref(rtdb, 'users/' + user.uid));
            if (userSnap.exists()) {
                const userData = userSnap.val();

                // Special Admin Check
                if (userData.role === 'admin') {
                    if (!ADMIN_EMAILS.includes(user.email)) {
                        alert("Access Denied: Unauthorized admin email.");
                        logout();
                        return;
                    }
                }

                // Status Check
                if (userData.status === 'pending') {
                    if (!isAuthPage) {
                        alert("Your account is pending admin approval.");
                        logout();
                    }
                    return;
                }

                // Redirect approved users away from auth pages
                if (userData.status === 'approved' && isAuthPage) {
                    if (userData.role === 'admin') window.location.href = 'admin-dashboard.html';
                    else if (userData.role === 'doctor') window.location.href = 'doctor-dashboard.html';
                    else if (userData.role === 'patient') window.location.href = 'patient-dashboard.html';
                }
            } else {
                // User authenticated but no record in RTDB (e.g. newly created admin via Firebase Console)
                if (user.email === ADMIN_EMAILS[0] || user.email === ADMIN_EMAILS[1]) {
                    // This case is usually handled by login.html for the first admin
                    if (!isAuthPage && !currentPath.includes('admin-dashboard.html')) {
                        window.location.href = 'admin-dashboard.html';
                    }
                } else {
                    if (!isAuthPage) logout();
                }
            }
        } catch (error) {
            console.error("Auth state change error:", error);
        }
    } else {
        if (!isAuthPage) {
            window.location.href = 'login.html';
        }
    }
});

export async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
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

export async function changeUserPassword(newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user.");
    return updatePassword(user, newPassword);
}
