const translations = {
    en: {
        title: "Hospital Management System",
        login: "Login",
        register: "Register",
        welcome: "Welcome to HMS",
        admin_dashboard: "Admin Dashboard",
        doctor_dashboard: "Doctor Dashboard",
        patient_dashboard: "Patient Dashboard",
        pending_approval: "Your account is pending approval.",
        select_language: "Select Language",
        footer_text: "© 2026 Hospital Management System",
        dashboard: "Dashboard",
        manage_users: "Manage Users",
        appointments: "Appointments",
        departments: "Departments",
        billing: "Billing",
        logout: "Logout",
        overview: "Overview",
        total_doctors: "Total Doctors",
        total_patients: "Total Patients",
        pending_requests: "Pending Requests",
        book_appointment: "Book Appointment",
        my_appointments: "My Appointments",
        bills_invoices: "Bills & Invoices",
        status: "Status",
        doctor: "Doctor",
        patient: "Patient",
        date: "Date",
        time: "Time",
        action: "Action",
        approve: "Approve",
        reject: "Reject",
        discharge: "Discharge",
        room_charges: "Room Charges",
        medicine_costs: "Medicine Costs",
        doctor_fees: "Doctor Fees",
        total_cost: "Total Cost",
        confirm_booking: "Confirm Booking",
        department: "Department",
        doctor_select: "Select Doctor",
        time_slot: "Select Time",
        visit_reason: "Reason for Visit",
        symptoms: "Symptoms",
        full_name: "Full Name",
        address: "Address",
        mobile: "Mobile Number",
        password: "Password",
        no_appointments: "No appointments found.",
        registration_success: "Registration successful! Pending admin approval."
    },
    fr: {
        title: "Système de Gestion Hospitalière",
        login: "Connexion",
        register: "S'inscrire",
        welcome: "Bienvenue sur HMS",
        admin_dashboard: "Tableau de Bord Admin",
        doctor_dashboard: "Tableau de Bord Docteur",
        patient_dashboard: "Tableau de Bord Patient",
        pending_approval: "Votre compte est en attente d'approbation.",
        select_language: "Choisir la langue",
        footer_text: "© 2026 Système de Gestion Hospitalière",
        dashboard: "Tableau de bord",
        manage_users: "Gérer les utilisateurs",
        appointments: "Rendez-vous",
        departments: "Départements",
        billing: "Facturation",
        logout: "Déconnexion",
        overview: "Aperçu",
        total_doctors: "Total Docteurs",
        total_patients: "Total Patients",
        pending_requests: "Demandes en attente",
        book_appointment: "Prendre RDV",
        my_appointments: "Mes Rendez-vous",
        bills_invoices: "Factures",
        status: "Statut",
        doctor: "Docteur",
        patient: "Patient",
        date: "Date",
        time: "Heure",
        action: "Action",
        approve: "Approuver",
        reject: "Rejeter",
        discharge: "Sortie (Facture)",
        room_charges: "Frais de chambre",
        medicine_costs: "Frais de médicaments",
        doctor_fees: "Honoraires médecin",
        total_cost: "Coût Total",
        confirm_booking: "Confirmer la réservation",
        department: "Département",
        doctor_select: "Choisir un docteur",
        time_slot: "Choisir un créneau",
        visit_reason: "Raison de la visite",
        symptoms: "Symptômes",
        full_name: "Nom complet",
        address: "Adresse",
        mobile: "Mobile",
        password: "Mot de passe",
        no_appointments: "Aucun rendez-vous trouvé.",
        registration_success: "Inscription réussie ! En attente d'approbation."
    },
    ar: {
        title: "نظام إدارة المستشفى",
        login: "تسجيل الدخول",
        register: "تسجيل",
        welcome: "مرحباً بك في نظام إدارة المستشفى",
        admin_dashboard: "لوحة تحكم المشرف",
        doctor_dashboard: "لوحة تحكم الطبيب",
        patient_dashboard: "لوحة تحكم المريض",
        pending_approval: "حسابك قيد انتظار الموافقة.",
        select_language: "اختر اللغة",
        footer_text: "© 2026 نظام إدارة المستشفى",
        dashboard: "لوحة التحكم",
        manage_users: "إدارة المستخدمين",
        appointments: "المواعيد",
        departments: "الأقسام",
        billing: "الفواتير",
        logout: "تسجيل الخروج",
        overview: "نظرة عامة",
        total_doctors: "إجمالي الأطباء",
        total_patients: "إجمالي المرضى",
        pending_requests: "الطلبات المعلقة",
        book_appointment: "حجز موعد",
        my_appointments: "مواعيدي",
        bills_invoices: "الفواتير",
        status: "الحالة",
        doctor: "الطبيب",
        patient: "المريض",
        date: "التاريخ",
        time: "الوقت",
        action: "الإجراء",
        approve: "موافقة",
        reject: "رفض",
        discharge: "إخراج المريض",
        room_charges: "مصاريف الغرفة",
        medicine_costs: "تكاليف الأدوية",
        doctor_fees: "أتعاب الطبيب",
        total_cost: "التكلفة الإجمالية",
        confirm_booking: "تأكيد الحجز",
        department: "القسم",
        doctor_select: "اختر الطبيب",
        time_slot: "اختر الوقت",
        visit_reason: "سبب الزيارة",
        symptoms: "الأعراض",
        full_name: "الإسم الكامل",
        address: "العنوان",
        mobile: "رقم الجوال",
        password: "كلمة المرور",
        no_appointments: "لا توجد مواعيد.",
        registration_success: "تم التسجيل بنجاح! بانتظار موافقة المشرف."
    }
};

let currentLanguage = localStorage.getItem('hms_lang') || 'en';

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('hms_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    updateContent();
}

function updateContent() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[currentLanguage][key]) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translations[currentLanguage][key];
            } else {
                element.innerText = translations[currentLanguage][key];
            }
        }
    });

    // Handle Bootstrap RTL if needed
    const bootstrapLink = document.getElementById('bootstrap-link');
    if (currentLanguage === 'ar') {
        bootstrapLink?.setAttribute('href', 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css');
    } else {
        bootstrapLink?.setAttribute('href', 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLanguage);
});
