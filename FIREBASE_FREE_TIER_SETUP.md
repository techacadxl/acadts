# Firebase Storage Free Tier Setup

## ✅ Firebase Storage is FREE!

Firebase Storage has a generous **free tier (Spark plan)** that includes:
- **5GB storage** - Plenty for images
- **1GB/day downloads** - Good for serving images
- **20K uploads/day** - More than enough for development
- **No credit card required** - Completely free!

## Setup Instructions

### Step 1: Configure Firebase Storage Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Storage** → **Rules** tab
4. Replace the rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload images to questions folder
    match /questions/{imageId} {
      // Allow read access to everyone (for displaying images)
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

5. Click **Publish**

### Step 2: Verify Setup

1. Make sure you're logged in as an admin user
2. Try uploading an image
3. It should work now! 🎉

## How It Works

The app uses **Firebase Storage** by default (free tier). If Firebase Storage fails for any reason, it automatically falls back to **base64 encoding** (stored directly in Firestore) for images under 500KB.

### Storage Options:

1. **Firebase Storage (Primary)** - Best for all images
   - Free: 5GB storage, 1GB/day downloads
   - Professional CDN delivery
   - Automatic optimization
   - Max file size: 5MB

2. **Base64 (Fallback)** - For small images if Storage fails
   - Stored directly in Firestore
   - No separate storage needed
   - Max file size: 500KB
   - Good for thumbnails or small diagrams

## Troubleshooting

### CORS Error?

1. **Check Security Rules**: Make sure rules are published (not just saved)
2. **Verify Authentication**: Make sure you're logged in
3. **Check Rules Format**: Copy the exact rules from above

### Permission Denied?

1. Make sure `request.auth != null` is in your rules
2. Verify you're logged in (check browser console)
3. Check that file path matches `questions/{imageId}`

### Quota Exceeded?

If you hit the free tier limits:
- **5GB storage**: Delete old unused images
- **1GB/day downloads**: Images are cached, so this is rarely an issue
- Consider compressing images before upload

## Production Tips

For production, you can make rules more restrictive:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /questions/{imageId} {
      allow read: if true;
      // Only admins can upload (requires Firestore check)
      allow write: if request.auth != null 
                   && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

## Cost

**Free tier is completely free!** No credit card required.

If you exceed free tier limits:
- Storage: $0.026/GB/month (after 5GB)
- Downloads: $0.12/GB (after 1GB/day)

For a typical app with images, you'll likely stay within the free tier.

