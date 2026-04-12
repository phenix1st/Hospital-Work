# Online Clinic - Hospital Management System

Welcome to the **Online Clinic** (Hospital Management System) repository! 

This project is a modern, responsive, and multilingual web application designed to streamline hospital operations, manage medical records securely, and facilitate seamless interaction between Patients, Doctors, and Administrators.

---

## 🌟 Key Features

### 🌍 Multilingual Support
The platform features an advanced Internationalization (i18n) system that supports dynamic content translation across three languages:
*   **English** (Online Clinic)
*   **French** (Clinique Online)
*   **Arabic** (العيادة اونلاين) - Fully supports Right-To-Left (RTL) text rendering.

### 👥 Role-Based Portals

#### 1. Patient Portal
*   **Appointments**: Book time slots with specific specialists. 
*   **Medical Files**: Upload and manage pre-visit certificates, lab records, prescriptions, and scans (PDF, JPG, PNG).
*   **Billing & Invoices**: View detailed breakdowns of medical costs, doctor fees, and overall billing history.
*   **Profile**: Manage personal account information, securely change passwords, and update emails.

#### 2. Doctor Portal (Medical Staff)
*   **Patient Management**: View assigned and requesting patients, discharge patients after their session ends.
*   **Session Management**: Review patient symptoms securely before they enter the room.
*   **Records & History**: Browse through complete medical files uploaded by the patients.
*   **Certificates & Invoices**: Issue session certificates natively, which are then converted directly into downloadable PDFs.

#### 3. Admin Control Center
*   **Account Approvals**: Every new registration defaults to a 'pending' state. Admins review and approve/reject doctors and patients.
*   **System Overview**: Global visibility of total patients, doctors, and pending metrics.
*   **Billing & Discharges**: Process final room charges, medicine costs, and doctor fees when handling patient discharges.
*   **Database Management**: Search the user database and manage platform roles securely.

### 🛡 Security & Backend
*   **Firebase Authentication**: Robust user authentication handling secure sign-ins, JWTs, and session resets.
*   **Firebase Realtime Database (RTDB)**: Lightning-fast, real-time sync for patient histories and booking slots to prevent double-booking.
*   **Approval-First Access**: Accounts cannot interact with system endpoints until manually verified by an Admin.

---

## 💻 Tech Stack

*   **Frontend HTML/CSS**: Vanilla HTML5 elements styled with modern CSS features like Glassmorphism (`glass-card` styling), hover animations, and fade-ins.
*   **Frontend Logic/Scripts**: Modular Vanilla JavaScript (`auth.js`, `i18n.js`, `patient.js`, `doctor.js`, `admin.js`).
*   **Database & Auth**: Firebase (Auth & Realtime Database v10.x).
*   **PDF Generation**: Client-side dynamic PDF rendering using embedded JavaScript tooling.

---

## 📁 Project Structure

```text
Hospital-Work/
├── css/                   # Custom styling, animations, and responsive utilities
├── js/                    # Core business logic and modular scripts
│   ├── admin.js           # Admin portal controls and DB manipulation
│   ├── auth.js            # Firebase authentication hooks
│   ├── doctor.js          # Doctor portal logic
│   ├── i18n.js            # Internationalization dictionary & state manager
│   ├── patient.js         # Patient portal workflows
│   └── pdf-generator.js   # PDF receipt and certificate scripting
├── images/                # Static image assets (including logos)
├── *Dashboard HTML*       # admin-dashboard.html, doctor-dashboard.html, patient-dashboard.html
├── index.html             # The public landing page
├── login.html             # Authentication gateway
├── register.html          # New account creation
└── doctors.html           # Public listing of available medical specialists
```

---

## 🚀 Installation & Setup

Because this is a completely serverless frontend application (powered by Firebase), it is incredibly easy to run!

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/Hospital-Work.git
    cd Hospital-Work
    ```

2.  **Environment Setup (Firebase)**
    *   Go to your [Firebase Console](https://console.firebase.google.com/).
    *   Create a Web App and retrieve your configuration config.
    *   Make sure `js/firebase-config.js` exists and paste your configuration variables into it.

3.  **Run the Project Locally**
    *   You can serve the directory using any local web server.
    *   *Using VSCode:* Right-click `index.html` and click **"Open with Live Server"**.
    *   *Using Python:* Run `python -m http.server 8000` from the root directory and visit `http://localhost:8000`.

---

## 📖 Usage Flow

1.  **Registration**: A user navigates to `/register.html`, chooses their intended role (Patient/Doctor), and submits their details.
2.  **Approval Queue**: The new user is immediately placed into the `pending` state. If they attempt to log in via `/login.html`, they will be prompted to wait for approval.
3.  **Admin Intervention**: An Administrator logs into the `admin-dashboard.html`, reviews the details, and clicks "Approve".
4.  **Dashboard Access**: The user can now log in and is automatically routed to their respective dashboard (`patient-dashboard.html` or `doctor-dashboard.html`).

---

## 🎨 Design Philosophy
The UI follows a clean, medical-friendly esthetic prioritizing calm color palettes and readable typography. Interactive elements rely on lightweight CSS transitions. The "Glassmorphism" technique is utilized to give dashboards a modern, premium feel without compromising on performance.
