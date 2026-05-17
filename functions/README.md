# Biome Aura Admin Notifications (Cloud Functions)

This directory contains Firebase Cloud Functions that listen for new requests in Firestore and notify admins via email.

## Setup

1.  **Install dependencies**:
    ```bash
    cd functions
    npm install
    ```

2.  **Configure environment variables**:
    You need to set the following environment variables for the functions to work. You can use a `.env` file in the `functions` directory or set them in the Firebase Console / Google Cloud Secret Manager.

    ```env
    GOOGLE_OAUTH_CLIENT_ID=your_client_id
    GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
    GOOGLE_OAUTH_REDIRECT_URI=your_redirect_uri
    ADMIN_NOTIFY_EMAILS=admin1@example.com,admin2@example.com
    PUBLIC_BASE_URL=https://dashboard.biome-aura.com
    ```

    *Note: These should match the Gmail OAuth credentials used by the Next.js app.*

3.  **Deploy**:
    ```bash
    firebase deploy --only functions
    ```

## Triggers

- `onVerificationRequestCreated`: Triggered when a new document is created in `verificationRequests`.
- `onContentRequestCreated`: Triggered when a new document is created in `contentRequests`.
- `onBmidBoxRequestCreated`: Triggered when a new document is created in `bmidBoxRequests`.

## Email Logic

- The functions use the Gmail OAuth connection stored in Firestore at `adminSettings/gmail`.
- To prevent duplicate emails, the functions write `adminNotificationStatus: "sent"` or `"failed"` to the request document.
- If sending fails, the error is logged in `adminNotificationError`.
