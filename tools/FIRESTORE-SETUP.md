# Firestore Setup Guide for License Requests

This document explains how to configure Firebase Firestore to support the license request system.

## Collection Schema

### `licenseRequests` Collection

Each document represents a user license request submitted via the public portal.

**Document Structure:**
```javascript
{
  // User-submitted fields
  machineCode: string,      // Required - Device fingerprint from Electron app
  email: string,            // Required - User contact email (lowercase)
  tier: "free" | "pro",     // Required - Requested license tier
  message: string,          // Optional - Additional context from user
  
  // System-generated fields
  status: "pending" | "approved" | "completed" | "rejected",  // Request lifecycle status
  createdAt: timestamp,     // Server-side timestamp when request created
  updatedAt: timestamp      // Server-side timestamp when status last changed (optional)
}
```

**Field Validations:**
- `machineCode`: Non-empty string, typically 64-char hex format
- `email`: Valid email format, stored as lowercase
- `tier`: Enum limited to "free" or "pro"
- `status`: Defaults to "pending" on creation
- `createdAt`: Auto-populated via `serverTimestamp()`

**Status Workflow:**
1. **pending** - Initial state when user submits request
2. **approved** - Admin reviewed and decided to issue license
3. **completed** - Admin generated JWT and delivered to user
4. **rejected** - Admin declined request

## Firestore Indexes

To enable efficient querying and sorting, create these composite indexes:

### Index 1: Status + Created Date
- **Collection**: `licenseRequests`
- **Fields indexed**:
  - `status` (Ascending)
  - `createdAt` (Descending)
- **Query scope**: Collection
- **Purpose**: Filter by status and sort by date (e.g., "show all pending requests, newest first")

**Firebase Console Path:**
Firestore Database → Indexes → Composite → Create Index

**Index Configuration:**
```
Collection ID: licenseRequests
Fields:
  - status (Ascending)
  - createdAt (Descending)
Query scopes: Collection
```

**Example Query Using This Index:**
```javascript
const q = query(
  collection(db, 'licenseRequests'),
  where('status', '==', 'pending'),
  orderBy('createdAt', 'desc')
);
```

## Security Rules

Configure Firestore Security Rules to protect data while allowing public submissions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function: Check if user is admin
    function isAdmin() {
      return request.auth != null && 
             request.auth.token.email in [
               'xuankien090103@gmail.com'
             ];
    }
    
    // License requests collection
    match /licenseRequests/{requestId} {
      // Anyone can create (public request form)
      allow create: if true &&
                       request.resource.data.status == 'pending' &&
                       request.resource.data.machineCode is string &&
                       request.resource.data.email is string &&
                       request.resource.data.tier in ['free', 'pro'];
      
      // Only admins can read
      allow read: if isAdmin();
      
      // Only admins can update/delete
      allow update: if isAdmin() &&
                       request.resource.data.status in ['pending', 'approved', 'completed', 'rejected'];
      allow delete: if isAdmin();
    }
  }
}
```

**Security Rule Explanation:**

1. **Public Create Access**:
   - No authentication required (anonymous users can submit)
   - Enforced validations: status must be "pending", required fields present
   - Prevents abuse: Users cannot set arbitrary status values

2. **Admin-Only Read Access**:
   - Only admin emails can view requests
   - Protects user privacy (machineCode, email)

3. **Admin-Only Updates**:
   - Only admins can change status
   - Validates status enum values

4. **Admin-Only Deletes**:
   - Only admins can remove spam/duplicate requests

**How to Apply Rules:**
1. Go to Firebase Console → Firestore Database → Rules
2. Replace existing rules with the above configuration
3. Click "Publish" to activate

## Testing Firestore Setup

### Test 1: Public Request Submission (Anonymous)

Open browser console on `https://browser.hl-mck.store/license-request`:

```javascript
// This should succeed (create operation allowed)
const testData = {
  machineCode: 'TEST-1234567890ABCDEF',
  email: 'test@example.com',
  tier: 'pro',
  message: 'Test request',
  status: 'pending',
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
};

await firebase.firestore().collection('licenseRequests').add(testData);
```

### Test 2: Public Read Access (Should Fail)

```javascript
// This should fail with "Missing or insufficient permissions"
await firebase.firestore().collection('licenseRequests').get();
```

### Test 3: Admin Read Access (Should Succeed)

After logging in as admin at `/login`:

```javascript
// This should succeed
const snapshot = await firebase.firestore()
  .collection('licenseRequests')
  .orderBy('createdAt', 'desc')
  .get();

console.log('Requests:', snapshot.docs.length);
```

### Test 4: Admin Update Status (Should Succeed)

```javascript
// Update a request to approved status
await firebase.firestore()
  .collection('licenseRequests')
  .doc('REQUEST_ID_HERE')
  .update({ 
    status: 'approved',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
```

## Manual Setup Steps

### Step 1: Create Index via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `hl-mck`
3. Navigate to **Firestore Database**
4. Click **Indexes** tab
5. Click **Create Index**
6. Enter configuration:
   - Collection ID: `licenseRequests`
   - Field 1: `status` (Ascending)
   - Field 2: `createdAt` (Descending)
   - Query scope: Collection
7. Click **Create** and wait for index to build (~5 minutes)

### Step 2: Apply Security Rules

1. In Firestore Database, click **Rules** tab
2. Copy the rules from "Security Rules" section above
3. Replace existing rules
4. Click **Publish**
5. Verify no syntax errors appear

### Step 3: Verify Setup

1. Deploy web admin: `npm run build` in `src/web-admin`
2. Navigate to `/license-request` (public page)
3. Submit test request
4. Log in as admin at `/login`
5. Navigate to `/dashboard/license-requests`
6. Verify request appears in list

## Alternative: Index Creation via Firebase CLI

If you prefer command-line setup:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firestore (if not already done)
firebase init firestore

# Create firestore.indexes.json
cat > firestore.indexes.json << 'EOF'
{
  "indexes": [
    {
      "collectionGroup": "licenseRequests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
EOF

# Deploy indexes
firebase deploy --only firestore:indexes
```

## Troubleshooting

### Issue: "The query requires an index"

**Symptom**: Error when loading license requests in admin dashboard

**Solution**: 
1. Check if index is built (Firebase Console → Indexes → status should be "Enabled")
2. If status is "Building", wait 5-10 minutes
3. If index is missing, create it manually per Step 1 above

### Issue: "Missing or insufficient permissions" on public request

**Symptom**: Cannot submit license request from public page

**Solution**:
1. Verify security rules allow `create: if true` for licenseRequests
2. Check browser console for detailed error
3. Ensure `status` field is set to "pending" in request

### Issue: Admin cannot read requests

**Symptom**: Empty list or permission error in admin dashboard

**Solution**:
1. Verify admin is logged in (check Firebase Auth console)
2. Confirm admin email matches email in security rules
3. Check browser console for auth token presence

### Issue: Requests not appearing in real-time

**Symptom**: Need to refresh page to see new requests

**Solution**:
- Check if `onSnapshot` listener is properly set up in Manage.jsx
- Verify component is not unmounting/remounting unexpectedly
- Check browser console for WebSocket connection errors

## Maintenance

### Adding Admin Users

Edit security rules to add new admin emails:

```javascript
function isAdmin() {
  return request.auth != null && 
         request.auth.token.email in [
           'xuankien090103@gmail.com',
           'new-admin@example.com'  // Add here
         ];
}
```

### Cleaning Up Old Requests

Run periodically via Firebase Functions or manually:

```javascript
// Delete completed requests older than 30 days
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 30);

const oldRequests = await firebase.firestore()
  .collection('licenseRequests')
  .where('status', '==', 'completed')
  .where('createdAt', '<', cutoff)
  .get();

const batch = firebase.firestore().batch();
oldRequests.forEach(doc => batch.delete(doc.ref));
await batch.commit();
```

## Additional Resources

- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firestore Indexes Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
