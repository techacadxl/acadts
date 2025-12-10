# Firestore Rules Update - Enrollments Collection

## Issue
Students are getting "Missing or insufficient permissions" error when trying to enroll in test series because the `enrollments` collection doesn't have security rules.

## Solution
The `firestore.rules` file has been updated to include permissions for the `enrollments` collection.

## What Changed
Added rules for the `enrollments` collection that allow:
- **Students**: Can read, create, update, and delete their own enrollments
- **Admins**: Can read, update, and delete any enrollment

## How to Deploy

### Option 1: Firebase Console (Easiest)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules` file
5. Paste into the rules editor
6. Click **Publish**

### Option 2: Firebase CLI
```bash
firebase deploy --only firestore:rules
```

## Rules Summary

The updated rules now allow:
- ✅ **Authenticated users**: Can read questions, tests, and test series
- ✅ **Admins only**: Can create, update, delete questions, tests, and test series
- ✅ **Students**: Can create and manage their own enrollments
- ✅ **Admins**: Can view and manage all enrollments
- ✅ **Users**: Can manage their own user document

## Verify After Deployment

1. Try enrolling in a test series as a student
2. The enrollment should work without permission errors
3. Check that the enrollment appears in "My Enrolled Series"







