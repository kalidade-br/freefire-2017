import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

if (!getApps().length) {
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;

  if (serviceAccountRaw) {
    try {
      const parsed = JSON.parse(serviceAccountRaw) as ServiceAccount;
      initializeApp({
        credential: cert(parsed),
        projectId: parsed.projectId || projectId,
      });
    } catch (err) {
      console.warn('Invalid FIREBASE_SERVICE_ACCOUNT_JSON, falling back to projectId:', err);
      initializeApp({ projectId });
    }
  } else {
    initializeApp({ projectId });
  }
}

export const adminAuth = getAuth();

export interface VerifiedFirebaseToken {
  uid: string;
  name?: string;
  email?: string;
  emailVerified?: boolean;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
      emailVerified: Boolean(decoded.email_verified),
    };
  } catch (adminErr) {
    const apiKey = process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
    if (!apiKey) {
      throw adminErr;
    }
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('Firebase token lookup failed:', res.status, errBody);
      throw adminErr;
    }
    const data = (await res.json()) as {
      users?: Array<{
        localId?: string;
        displayName?: string;
        email?: string;
        emailVerified?: boolean;
      }>;
    };
    const user = data.users?.[0];
    if (!user?.localId) {
      throw adminErr;
    }
    return {
      uid: user.localId,
      name: user.displayName,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
    };
  }
}

