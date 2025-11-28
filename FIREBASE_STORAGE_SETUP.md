# Firebase Storage Setup Guide

## CORS Error Fix

If you're getting CORS errors when uploading images, you need to configure Firebase Storage security rules.

## Step 1: Open Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`testseries-53dbe`)
3. Navigate to **Storage** in the left sidebar
4. Click on the **Rules** tab

## Step 2: Update Storage Rules

Replace the default rules with the following to allow authenticated users to upload images:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload images to questions folder
    match /questions/{imageId} {
      // Allow read access to everyone
      allow read: if true;
      
      // Allow write (upload/delete) only to authenticated users
      allow write: if request.auth != null 
                   && request.resource.size < 5 * 1024 * 1024  // 5MB limit
                   && request.resource.contentType.matches('image/.*');
    }
    
    // Deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## Step 3: Publish Rules

1. Click **Publish** button
2. Wait for the rules to be deployed (usually takes a few seconds)

## Alternative: More Permissive Rules (Development Only)

⚠️ **Warning: Only use this for development/testing. Not recommended for production.**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /questions/{imageId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Step 4: Verify Setup

After updating the rules:

1. Make sure you're logged in as an admin user
2. Try uploading an image again
3. The upload should work now

## Troubleshooting

### Still getting CORS errors?

1. **Check Authentication**: Make sure you're logged in
   - Check browser console for auth status
   - Try logging out and logging back in

2. **Verify Rules**: 
   - Go to Storage > Rules
   - Make sure rules are published (not just saved)
   - Check that rules match the format above

3. **Check Browser Console**:
   - Look for specific error messages
   - Check if authentication token is present

4. **Clear Browser Cache**:
   - Sometimes cached rules can cause issues
   - Try hard refresh (Ctrl+Shift+R)

### Permission Denied Errors

If you see "Permission denied" errors:

1. Make sure `request.auth != null` is in your rules
2. Verify you're logged in (check Firebase Auth)
3. Check that the file path matches the rule pattern (`questions/{imageId}`)

### File Size Errors

If upload fails due to size:

1. The rules include a 5MB limit
2. Compress your image before uploading
3. Or increase the limit in the rules (not recommended)

## Production Recommendations

For production, use more restrictive rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /questions/{imageId} {
      // Only admins can upload
      allow read: if true;
      allow write: if request.auth != null 
                   && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

This requires checking the user's role in Firestore, which is more secure.

