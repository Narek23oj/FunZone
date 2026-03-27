# FunZone Group Application

A modern, responsive web application for FunZone Group with Admin and User panels, role-based access, event management, and certificate distribution.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Firebase project

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_DATABASE_ID=your_database_id
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## 📦 Deployment

### Deploying to GitHub

1. Create a new repository on GitHub.
2. Push your code to the repository:
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

### Deploying to Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **New Project** and select your GitHub repository.
3. In the **Environment Variables** section, add all the variables from your `.env` file (prefixed with `VITE_`).
4. Click **Deploy**.

Vercel will automatically detect the Vite project and build it using `npm run build`. The `vercel.json` file handles the SPA routing.

## 🛠 Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Motion
- **Backend/Database:** Firebase (Auth, Firestore, Storage)
- **PDF Generation:** jsPDF, pdf-lib
- **Icons:** Lucide React
- **Notifications:** Sonner

## 📄 License

This project is licensed under the MIT License.
