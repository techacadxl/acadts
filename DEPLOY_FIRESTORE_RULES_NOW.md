# ⚠️ URGENT: Deploy Firestore Rules to Fix Enrollment Error

## The Problem
You're getting "Missing or insufficient permissions" when clicking Purchase because the Firestore rules haven't been deployed to Firebase yet.

## Quick Fix - Deploy Rules Now

### Step 1: Open Firebase Console
1. Go to: https://console.firebase.google.com/
2. Select your project

### Step 2: Navigate to Firestore Rules
1. Click **"Firestore Database"** in the left sidebar
2. Click the **"Rules"** tab at the top

### Step 3: Copy and Paste Rules
1. Open the file: `acadts/firestore.rules` in your project
2. **Select ALL** the text (Ctrl+A or Cmd+A)
3. **Copy** it (Ctrl+C or Cmd+C)
4. **Paste** it into the Firebase Console Rules editor (replace everything)
5. Click **"Publish"** button

### Step 4: Wait for Deployment
- You'll see "Rules published successfully" message
- Rules take effect immediately (no restart needed)

### Step 5: Test
1. Go back to your app
2. Try clicking "Purchase" on a test series
3. It should work now! ✅

## What the Rules Do

The updated rules allow:
- ✅ **Students**: Can create and read their own enrollments
- ✅ **Students**: Can query enrollments (needed for checking if already enrolled)
- ✅ **Admins**: Can read all enrollments

## If It Still Doesn't Work

1. **Check Rules Syntax**: Make sure there are no red error indicators in Firebase Console
2. **Refresh Browser**: Clear cache and refresh your app
3. **Check User Authentication**: Make sure you're logged in
4. **Check Console**: Look for any other error messages

## Alternative: Use Firebase CLI

If you have Firebase CLI installed:
```bash
cd acadts
firebase deploy --only firestore:rules
```

---

**Important**: The rules file is updated in your code, but Firebase is still using the old rules. You MUST deploy them to Firebase Console for the fix to work!










