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

console.log("Initializing Firebase with Project ID:", firebaseConfig.projectId);
console.log("Using Firestore Database ID:", databaseId || '(default)');

const app = initializeApp(firebaseConfig);
// If databaseId is '(default)' or empty, use the default database
export const db = (databaseId && databaseId !== '(default)') 
  ? getFirestore(app, databaseId) 
  : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Test connection to Firestore
import { getDocFromServer, doc } from 'firebase/firestore';
async function testConnection(retries = 5) {
  const currentAttempt = 6 - retries;
  console.log(`Starting Firestore connection test (attempt ${currentAttempt})...`);
  try {
    // Try to get a non-existent document from the server to test connectivity
    const testDoc = doc(db, '_connection_test_', 'test');
    await getDocFromServer(testDoc);
    console.log("Firestore connection successful to database:", databaseId || '(default)');
  } catch (error: any) {
    console.error(`Firestore connection test failed (attempt ${currentAttempt}) with error:`, error.code, error.message);
    
    if (retries > 0) {
      const delay = 5000;
      console.log(`Retrying in ${delay/1000} seconds...`);
      setTimeout(() => testConnection(retries - 1), delay);
    } else {
      console.error("CRITICAL: Firestore is offline after multiple retries. Possible causes:");
      console.error("1. The databaseId is incorrect (current:", databaseId || '(default)', ")");
      console.error("2. The database is not provisioned in the project:", firebaseConfig.projectId);
      console.error("3. Network/Proxy issues in the environment.");
      console.error("If this is a remixed app, please run the Firebase Setup again.");
    }
  }
}
testConnection();
