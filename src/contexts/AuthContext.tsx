import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  getAuth
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  deleteDoc 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';
import { toast } from 'sonner';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId,
};

// Initialize a secondary app for creating users without signing out the current admin
const secondaryApp = getApps().length > 1 
  ? getApp('SecondaryApp') 
  : initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'superadmin' | 'admin' | 'user';
  department?: string;
  password?: string;
  hasPassword: boolean;
  image?: string;
  fzCoins?: number;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  users: User[];
  checkUsername: (username: string, isAdminMode: boolean) => Promise<{ exists: boolean; hasPassword?: boolean; wrongPortal?: boolean; role?: string }>;
  login: (username: string, pass: string) => Promise<void>;
  register: (data: { username: string; name: string; email: string; phone: string; password: string }) => Promise<void>;
  createPassword: (username: string, pass: string) => Promise<void>;
  logout: () => void;
  addUser: (user: Omit<User, 'id'> & { password?: string }) => Promise<void>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Sync users from Firestore ONLY if the current user is an admin or superadmin
  useEffect(() => {
    if (!isAuthReady || !currentUser) {
      setUsers([]);
      return;
    }

    if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(usersData);
      }, (error) => {
        // Only log if it's not a permission error for a non-admin (which shouldn't happen but just in case)
        if (error.message.includes('permissions')) {
          console.warn("Permission denied for users fetch. This is expected if you are not an admin.");
        } else {
          console.error("Error fetching users:", error);
        }
      });

      return () => unsubscribe();
    } else {
      setUsers([]);
    }
  }, [isAuthReady, currentUser]);

  // Listen to Firebase Auth state
  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (firebaseUser) {
        // Listen to user document changes in real-time
        userUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), async (docSnapshot) => {
          const isSuperAdminEmail = firebaseUser.email === 'narekexiazaryan95@gmail.com' || firebaseUser.email === 'narek@funzone.am';
          
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data() as User;
            setCurrentUser({ id: docSnapshot.id, ...userData } as User);
            
            // Recovery: Ensure public_users entry exists for superadmin
            if (isSuperAdminEmail) {
              const username = firebaseUser.email === 'narekexiazaryan95@gmail.com' ? 'funzone' : 'narek';
              const publicUserDoc = await getDoc(doc(db, 'public_users', username));
              if (!publicUserDoc.exists()) {
                await setDoc(doc(db, 'public_users', username), {
                  role: 'superadmin',
                  hasPassword: true
                });
              }
            }
          } else {
            // If user document doesn't exist, maybe it's the superadmin logging in for the first time or after deletion
            if (isSuperAdminEmail) {
              const username = firebaseUser.email === 'narekexiazaryan95@gmail.com' ? 'funzone' : 'narek';
              const name = username === 'funzone' ? 'Super Admin' : 'Narek';
              const superAdminData: User = {
                id: firebaseUser.uid,
                username,
                name,
                role: 'superadmin',
                hasPassword: true,
                image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
                fzCoins: 0,
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), superAdminData);
              // Also create public_users entry
              await setDoc(doc(db, 'public_users', username), {
                role: 'superadmin',
                hasPassword: true
              });
              // The snapshot listener will trigger and set the user
            }
          }
        }, (error) => {
          console.error("Error listening to user profile:", error);
        });
      } else {
        setCurrentUser(null);
      }
      setIsAuthReady(true);
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  const checkUsername = async (username: string, isAdminMode: boolean) => {
    try {
      const normalizedUsername = username.trim().toLowerCase();
      // Super admin bootstrap check
      if ((normalizedUsername === 'funzone' || normalizedUsername === 'narek') && isAdminMode) {
        const publicUserDoc = await getDoc(doc(db, 'public_users', normalizedUsername));
        if (!publicUserDoc.exists()) {
          // Super admin first login!
          return { exists: true, hasPassword: false, role: 'superadmin' };
        }
      }

      // Query public_users directly to check if username exists without exposing PII
      const publicUserDoc = await getDoc(doc(db, 'public_users', normalizedUsername));
      
      if (!publicUserDoc.exists()) return { exists: false };
      
      const found = publicUserDoc.data();
      const role = found.role;
      
      // Check role access
      const isRoleAdmin = role === 'admin' || role === 'superadmin';
      if (isAdminMode && !isRoleAdmin) return { exists: true, wrongPortal: true, role };
      if (!isAdminMode && isRoleAdmin) return { exists: true, wrongPortal: true, role };
      
      return { exists: true, hasPassword: found.hasPassword, role, email: found.email };
    } catch (error) {
      console.error("Error checking username", error);
      return { exists: false };
    }
  };

  const login = async (username: string, pass: string) => {
    try {
      const normalizedUsername = username.trim().toLowerCase();
      let email: string;
      
      // Try to get email from public_users first
      const publicUserDoc = await getDoc(doc(db, 'public_users', normalizedUsername));
      if (publicUserDoc.exists() && publicUserDoc.data().email) {
        email = publicUserDoc.data().email;
      } else if (normalizedUsername === 'funzone') {
        email = 'narekexiazaryan95@gmail.com';
      } else if (normalizedUsername === 'narek') {
        email = 'narek@funzone.am';
      } else {
        email = `${normalizedUsername.replace(/\s/g, '')}@funzone.am`;
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      
      // Manually fetch and set user to avoid race condition with onAuthStateChanged
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (userDoc.exists()) {
        setCurrentUser({ id: userDoc.id, ...userDoc.data() } as User);
      }
    } catch (error: any) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        throw new Error('Սխալ գաղտնաբառ: Խնդրում ենք փորձել նորից:');
      }
      throw new Error('Մուտքը ձախողվեց: Խնդրում ենք փորձել մի փոքր ուշ:');
    }
  };

  const register = async (data: { username: string; name: string; email: string; phone: string; password: string }) => {
    const normalizedUsername = data.username.trim().toLowerCase();
    const normalizedEmail = data.email.trim().toLowerCase();
    const normalizedPhone = data.phone.trim();

    // 1. Check username availability
    const publicUserDoc = await getDoc(doc(db, 'public_users', normalizedUsername));
    if (publicUserDoc.exists()) {
      throw new Error('Այս օգտանունը արդեն զբաղված է:');
    }

    // 2. Check email availability in our public collection
    const publicEmailDoc = await getDoc(doc(db, 'public_emails', normalizedEmail));
    if (publicEmailDoc.exists()) {
      throw new Error('Այս էլ. փոստը արդեն զբաղված է:');
    }

    // 3. Check phone availability
    const publicPhoneDoc = await getDoc(doc(db, 'public_phones', normalizedPhone));
    if (publicPhoneDoc.exists()) {
      throw new Error('Այս հեռախոսահամարը արդեն զբաղված է:');
    }

    // 4. Create Auth account
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Այս էլ. փոստը արդեն զբաղված է:');
      }
      throw error;
    }

    const uid = userCredential.user.uid;

    try {
      const userData: User = {
        id: uid,
        username: normalizedUsername,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: 'user',
        hasPassword: true,
        image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalizedUsername}`,
        fzCoins: 0,
        createdAt: new Date().toISOString()
      };

      // 5. Create user documents
      await setDoc(doc(db, 'users', uid), userData);
      await setDoc(doc(db, 'public_users', normalizedUsername), {
        role: 'user',
        hasPassword: true,
        email: normalizedEmail
      });
      await setDoc(doc(db, 'public_emails', normalizedEmail), { uid });
      await setDoc(doc(db, 'public_phones', normalizedPhone), { uid });

      setCurrentUser(userData);
    } catch (error: any) {
      // Cleanup if something fails after auth creation
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }
      throw error;
    }
  };

  const createPassword = async (username: string, pass: string) => {
    try {
      const normalizedUsername = username.trim().toLowerCase();
      let email: string;
      
      // Try to get email from public_users first
      const publicUserDoc = await getDoc(doc(db, 'public_users', normalizedUsername));
      if (publicUserDoc.exists() && publicUserDoc.data().email) {
        email = publicUserDoc.data().email;
      } else if (normalizedUsername === 'funzone') {
        email = 'narekexiazaryan95@gmail.com';
      } else if (normalizedUsername === 'narek') {
        email = 'narek@funzone.am';
      } else {
        email = `${normalizedUsername.replace(/\s/g, '')}@funzone.am`;
      }
      
      let userCredential;
      try {
        // Try to create the auth account
        userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          // If it already exists, it means the Auth account was created but Firestore wasn't updated.
          // We should try to sign in with the provided password.
          try {
            userCredential = await signInWithEmailAndPassword(auth, email, pass);
          } catch (signInError: any) {
            // If sign in fails, it means the password is wrong or something else is up.
            if (signInError.code === 'auth/wrong-password' || signInError.code === 'auth/invalid-credential') {
              throw new Error('Այս էլ. փոստը արդեն զբաղված է Firebase-ում: Եթե սա ձեր հաշիվն է, խնդրում ենք օգտագործել ձեր նախկին գաղտնաբառը կամ դիմել ադմինիստրատորին:');
            }
            throw new Error('Գաղտնաբառը սահմանելիս խնդիր առաջացավ: Այս էլ. փոստը արդեն զբաղված է:');
          }
        } else if (error.code === 'auth/weak-password') {
          throw new Error('Գաղտնաբառը շատ թույլ է: Խնդրում ենք օգտագործել առնվազն 6 նիշ:');
        } else {
          throw error;
        }
      }

      const newUid = userCredential.user.uid;
      let finalUserData: User;

      if (normalizedUsername === 'funzone' || normalizedUsername === 'narek') {
        // Super admin creation
        const name = normalizedUsername === 'funzone' ? 'Super Admin' : 'Narek';
        finalUserData = {
          id: newUid,
          username: normalizedUsername,
          name,
          role: 'superadmin',
          hasPassword: true,
          image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${normalizedUsername}`,
          fzCoins: 0,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', newUid), finalUserData);
        await setDoc(doc(db, 'public_users', normalizedUsername), {
          role: 'superadmin',
          hasPassword: true,
          email: normalizedUsername === 'funzone' ? 'narekexiazaryan95@gmail.com' : 'narek@funzone.am'
        });
        setCurrentUser(finalUserData);
        return;
      }

      // Now they are authenticated! We can get their pending document directly by username
      const pendingUserDoc = await getDoc(doc(db, 'users', normalizedUsername));
      
      if (!pendingUserDoc.exists()) {
        // Check if the user document already exists with the new UID (maybe it was already migrated)
        const migratedUserDoc = await getDoc(doc(db, 'users', newUid));
        if (migratedUserDoc.exists()) {
          const migratedData = { id: migratedUserDoc.id, ...migratedUserDoc.data() } as User;
          setCurrentUser(migratedData);
          return;
        }
        
        throw new Error('Your profile could not be initialized. Please try again later.');
      }
      
      const pendingUser = { id: pendingUserDoc.id, ...pendingUserDoc.data() } as User;

      // Create the real user document with the new UID
      finalUserData = {
        ...pendingUser,
        id: newUid,
        hasPassword: true,
        password: '', // Don't store plain text password in Firestore
        createdAt: pendingUser.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'users', newUid), finalUserData);
      
      // Update public_users
      await updateDoc(doc(db, 'public_users', normalizedUsername), { 
        hasPassword: true,
        email: email
      });
      
      // Manually set current user to avoid race condition
      setCurrentUser(finalUserData);

      // Delete the old pending document (which had the username as ID)
      try {
        await deleteDoc(doc(db, 'users', normalizedUsername));
      } catch (e) {
        console.error("Could not delete pending user", e);
      }

    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const addUser = async (newUser: Omit<User, 'id'> & { password?: string }) => {
    try {
      const normalizedUsername = newUser.username.trim().toLowerCase();
      const normalizedEmail = newUser.email ? newUser.email.trim().toLowerCase() : `${normalizedUsername.replace(/\s/g, '')}@funzone.am`;
      
      // 1. Check username availability
      const publicUserDoc = await getDoc(doc(db, 'public_users', normalizedUsername));
      if (publicUserDoc.exists()) {
        throw new Error('Այս օգտանունը արդեն զբաղված է:');
      }

      // 2. Check email availability
      const publicEmailDoc = await getDoc(doc(db, 'public_emails', normalizedEmail));
      if (publicEmailDoc.exists()) {
        throw new Error('Այս էլ. փոստը արդեն զբաղված է:');
      }

      let uid = normalizedUsername; // Default for pending users

      // 3. If password is provided, create Auth account using secondary app
      if (newUser.password) {
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, newUser.password);
          uid = userCredential.user.uid;
          // Sign out from secondary app immediately
          await signOut(secondaryAuth);
        } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
            throw new Error('Այս էլ. փոստը արդեն զբաղված է Firebase-ում:');
          }
          throw error;
        }
      }

      const userToSave: any = {
        ...newUser,
        username: normalizedUsername,
        id: uid,
        hasPassword: !!newUser.password,
        createdAt: new Date().toISOString()
      };
      
      // Remove password from Firestore document
      delete userToSave.password;

      // 4. Create user documents
      await setDoc(doc(db, 'users', uid), userToSave);
      
      // 5. Create public_users entry
      await setDoc(doc(db, 'public_users', normalizedUsername), {
        role: newUser.role,
        hasPassword: !!newUser.password,
        email: normalizedEmail
      });

      // 6. Create uniqueness entries
      await setDoc(doc(db, 'public_emails', normalizedEmail), { uid });
      if (newUser.phone) {
        await setDoc(doc(db, 'public_phones', newUser.phone.trim()), { uid });
      }
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.CREATE, 'users');
      }
      throw error;
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return;
      
      const oldData = userDoc.data() as User;
      const normalizedUsername = updates.username ? updates.username.trim().toLowerCase() : oldData.username;
      
      // If this is a pending user (hasPassword === false) and the username changed,
      // we need to create a new document with the new username as ID, and delete the old one.
      if (!oldData.hasPassword && updates.username && updates.username.trim().toLowerCase() !== oldData.username) {
        const newId = updates.username.trim().toLowerCase();
        await setDoc(doc(db, 'users', newId), { ...oldData, ...updates, username: newId, id: newId });
        await deleteDoc(doc(db, 'users', userId));
        
        // Also update public_users
        await setDoc(doc(db, 'public_users', newId), {
          role: updates.role || oldData.role,
          hasPassword: updates.hasPassword !== undefined ? updates.hasPassword : oldData.hasPassword,
          email: updates.email || oldData.email || `${newId.replace(/\s/g, '')}@funzone.am`
        });
        await deleteDoc(doc(db, 'public_users', oldData.username));

        // Update email/phone uniqueness if changed
        if (updates.email && updates.email !== oldData.email) {
          if (oldData.email) await deleteDoc(doc(db, 'public_emails', oldData.email.trim().toLowerCase()));
          await setDoc(doc(db, 'public_emails', updates.email.trim().toLowerCase()), { id: newId });
        }
        if (updates.phone && updates.phone !== oldData.phone) {
          if (oldData.phone) await deleteDoc(doc(db, 'public_phones', oldData.phone.trim()));
          await setDoc(doc(db, 'public_phones', updates.phone.trim()), { id: newId });
        }
      } else {
        const finalUpdates = { ...updates };
        if (finalUpdates.username) finalUpdates.username = finalUpdates.username.trim().toLowerCase();
        
        await updateDoc(doc(db, 'users', userId), finalUpdates);
        
        // Update public_users if role or hasPassword or email changed
        if (updates.role !== undefined || updates.hasPassword !== undefined || updates.username !== undefined || updates.email !== undefined) {
          const publicUpdates: any = {};
          if (updates.role !== undefined) publicUpdates.role = updates.role;
          if (updates.hasPassword !== undefined) publicUpdates.hasPassword = updates.hasPassword;
          if (updates.email !== undefined) publicUpdates.email = updates.email.trim().toLowerCase();
          await updateDoc(doc(db, 'public_users', oldData.username), publicUpdates);
        }

        // Update email/phone uniqueness if changed
        if (updates.email && updates.email !== oldData.email) {
          if (oldData.email) await deleteDoc(doc(db, 'public_emails', oldData.email.trim().toLowerCase()));
          await setDoc(doc(db, 'public_emails', updates.email.trim().toLowerCase()), { id: userId });
        }
        if (updates.phone && updates.phone !== oldData.phone) {
          if (oldData.phone) await deleteDoc(doc(db, 'public_phones', oldData.phone.trim()));
          await setDoc(doc(db, 'public_phones', updates.phone.trim()), { id: userId });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        
        // Prevent deletion of superadmins
        if (userData.role === 'superadmin' || userData.username === 'funzone' || userData.username === 'narek') {
          toast.error('Super Admin հաշիվները չեն կարող ջնջվել:');
          return;
        }

        const username = userData.username;
        await deleteDoc(doc(db, 'public_users', username));
        if (userData.email) await deleteDoc(doc(db, 'public_emails', userData.email.trim().toLowerCase()));
        if (userData.phone) await deleteDoc(doc(db, 'public_phones', userData.phone.trim()));
      }
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user: currentUser, 
      users,
      checkUsername, 
      login, 
      register,
      createPassword, 
      logout, 
      addUser,
      updateUser,
      deleteUser,
      isAuthReady 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
