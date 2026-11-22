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
