# AcadTS

A modern Next.js application with Firebase authentication and Firestore database.

## 🚀 Tech Stack

- **Framework**: Next.js 16.0.5 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Storage**: Firebase Storage

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project with Authentication and Firestore enabled

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

#### Firebase Client Configuration (Public)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

#### Firebase Admin Configuration (Server-side only)
```env
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

**⚠️ Important**: 
- Never commit `.env.local` or any `.env` files to version control
- The `FIREBASE_PRIVATE_KEY` should include the `\n` characters or be properly escaped
- Get these values from your Firebase Console → Project Settings

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
acadts/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth route group
│   │   ├── login/         # Login page
│   │   └── register/      # Registration page
│   ├── dashboard/         # Protected dashboard
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── context/               # React Context providers
│   └── AuthContext.tsx    # Authentication context
├── lib/                   # Utility libraries
│   ├── db/               # Database utilities
│   │   └── users.ts      # User document operations
│   └── firebase/         # Firebase configuration
│       ├── client.ts     # Client-side Firebase
│       └── admin.ts     # Server-side Firebase Admin
└── public/               # Static assets
```

## 🔐 Authentication Flow

1. **Registration**: Users can create accounts at `/register`
   - Creates Firebase Auth user
   - Sets display name
   - Creates Firestore user document

2. **Login**: Users authenticate at `/login`
   - Validates credentials with Firebase Auth
   - Redirects to dashboard on success

3. **Dashboard**: Protected route at `/dashboard`
   - Requires authentication
   - Shows user information
   - Provides logout functionality

## 🧩 Key Features

- ✅ TypeScript for type safety
- ✅ Firebase Authentication integration
- ✅ Firestore database operations
- ✅ Protected routes
- ✅ Responsive UI with Tailwind CSS
- ✅ Client-side and server-side Firebase support

## 📜 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🔒 Security Notes

- Environment variables are properly configured for client/server separation
- Firebase Admin SDK is only used server-side
- Sensitive files are excluded via `.gitignore`
- Authentication state is managed through React Context

## 🚀 Deployment

This app is ready to deploy on platforms like:
- Vercel (recommended for Next.js)
- Netlify
- Any Node.js hosting platform

Make sure to set all environment variables in your deployment platform's settings.

## 📝 License

Private project

