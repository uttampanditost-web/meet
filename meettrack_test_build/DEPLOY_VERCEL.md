# 🚀 Deploying MeetTrack to Vercel

This app is fully optimized for **Vercel** with a Vite React SPA frontend, Serverless API endpoints, and direct real-time **Firebase Firestore** cloud synchronization.

---

## 📋 Prerequisites
1. A [Vercel](https://vercel.com) account.
2. Your Firebase project (`stoked-strength-c3bk6`) configured in the Firebase Console.

---

## ⚡ Option 1: Deploy via GitHub (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Deploy MeetTrack to Vercel with iOS Glass Theme and Firebase sync"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. **Import Project into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your GitHub repository.
   - **Framework Preset**: Select `Vite` (or `Other`).
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Configure Environment Variables (Optional)**:
   In Vercel Project Settings > Environment Variables, you can optionally configure:
   - `GEMINI_API_KEY`: Your Google Gemini API Key (for AI Insights).
   - `ADMIN_EMAILS`: Comma-separated admin emails (e.g., `koabhi3@gmail.com`).
   - `VITE_FIREBASE_API_KEY`: (Optional override, defaults to `firebase-applet-config.json`).
   - `VITE_FIREBASE_PROJECT_ID`: (Optional override, defaults to `stoked-strength-c3bk6`).

4. **Click Deploy**:
   Vercel will build and deploy your application in under a minute!

---

## ⚡ Option 2: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Run deploy command:
   ```bash
   vercel
   ```
   Follow the prompts to link the project and deploy to preview.

3. Deploy to production:
   ```bash
   vercel --prod
   ```

---

## 🔐 Crucial Post-Deployment Step: Firebase Authorized Domains

To ensure Google Sign-In and Firebase Authentication work properly from your custom Vercel domain:

1. Open your **[Firebase Console](https://console.firebase.google.com/)**.
2. Select your project (`stoked-strength-c3bk6`).
3. Navigate to **Authentication** > **Settings** > **Authorized domains**.
4. Click **Add domain** and enter your Vercel deployment URL (e.g., `your-app.vercel.app`).
5. Save changes.

---

## 🛡️ Firestore Security Rules

Ensure your Firestore Rules in Firebase Console match the repository's `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if true;
      match /{document=**} {
        allow read, write: if true;
      }
    }
    match /trainers/{trainerId} {
      allow read, write: if true;
    }
    match /slots/{slotId} {
      allow read, write: if true;
    }
    match /attendanceLogs/{logId} {
      allow read, write: if true;
    }
    match /userAccess/{docId} {
      allow read, write: if true;
    }
  }
}
```

Now, your app will run 100% cloud-synced on Vercel with real-time Firestore reactivity!
