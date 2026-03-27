import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseAppletConfig from '../firebase-applet-config.json';

// Use environment variables if available (for Vercel/GitHub), 
// otherwise fallback to the local config file.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId,
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, databaseId || '(default)');
export const auth = getAuth(app);
export const storage = getStorage(app);

// Test connection to Firestore
import { getDocFromServer, doc } from 'firebase/firestore';
async function testConnection(retries = 3) {
  console.log(`Starting Firestore connection test (attempt ${4 - retries})...`);
  try {
    // Try to get a non-existent document from the server to test connectivity
    const testDoc = doc(db, '_connection_test_', 'test');
    console.log("Attempting to get doc from path:", testDoc.path);
    await getDocFromServer(testDoc);
    console.log("Firestore connection successful to database:", databaseId || '(default)');
  } catch (error: any) {
    console.error("Firestore connection test failed with error:", error.code, error.message);
    if (retries > 0 && error.message.includes('the client is offline')) {
      console.log("Retrying in 5 seconds...");
      setTimeout(() => testConnection(retries - 1), 5000);
    } else if (error.message.includes('the client is offline')) {
      console.error("CRITICAL: Firestore is offline after multiple retries. This usually means the databaseId is incorrect or the database is not provisioned. If this is a remixed app, please run the Firebase Setup again.");
    }
  }
}
testConnection();
