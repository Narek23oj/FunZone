import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, getDoc, where, runTransaction } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';
import { useAuth } from './AuthContext';

export interface Event {
  id: string;
  title: string;
  description: string;
  type: 'Seminar' | 'Volunteering' | 'Event';
  image: string;
  date: string;
  createdBy: string;
  coinsAwarded?: boolean;
  price?: number;
  registrationDeadline?: string;
  location?: string;
  isOnline?: boolean;
  meetingLink?: string;
  dressCode?: string;
}

export interface Application {
  id: string;
  eventId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  telegramLink?: string;
  attended?: boolean;
  paymentRequired?: number;
  paidAmount?: number;
}

export interface Certificate {
  id: string;
  userId: string;
  recipientName: string;
  title: string;
  issuedAt: string;
  isMandatory?: boolean;
  type?: string;
  templateData?: string;
  pdfUrl?: string;
  eventId?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'info' | 'warning' | 'success';
}

export interface Asset {
  id: string;
  name: string;
  url: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'add' | 'subtract' | 'award' | 'spend';
  reason: string;
  date: string;
  adminId?: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  imageUrl: string;
  description?: string;
  createdAt: string;
}

interface DataContextType {
  events: Event[];
  applications: Application[];
  certificates: Certificate[];
  announcements: Announcement[];
  assets: Asset[];
  certificateTemplates: CertificateTemplate[];
  transactions: Transaction[];
  addEvent: (event: Omit<Event, 'id'>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  applyForEvent: (eventId: string, userId: string, paymentRequired?: number) => Promise<void>;
  updateApplicationStatus: (appId: string, status: 'approved' | 'rejected', telegramLink?: string, attended?: boolean) => Promise<void>;
  updateAttendance: (appId: string, attended: boolean) => Promise<void>;
  updateEvent: (eventId: string, updates: Partial<Event>) => Promise<void>;
  removeApplication: (appId: string) => Promise<void>;
  issueCertificate: (cert: Omit<Certificate, 'id' | 'issuedAt' | 'recipientName'>) => Promise<void>;
  addAnnouncement: (ann: Omit<Announcement, 'id' | 'date'>) => Promise<void>;
  addAsset: (asset: Omit<Asset, 'id'>) => Promise<void>;
  addCertificateTemplate: (template: Omit<CertificateTemplate, 'id' | 'createdAt'>) => Promise<void>;
  deleteCertificateTemplate: (id: string) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthReady, user } = useAuth();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [certificateTemplates, setCertificateTemplates] = useState<CertificateTemplate[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const userId = user.id;

    const unsubEvents = onSnapshot(query(collection(db, 'events')), (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'events'));

    const unsubApps = onSnapshot(
      isAdmin 
        ? query(collection(db, 'applications')) 
        : query(collection(db, 'applications'), where('userId', '==', userId)),
      (snapshot) => {
        setApplications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Application)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'applications'));

    const unsubCerts = onSnapshot(
      isAdmin
        ? query(collection(db, 'certificates'))
        : query(collection(db, 'certificates'), where('userId', '==', userId)),
      (snapshot) => {
        setCertificates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Certificate)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'certificates'));

    const unsubAnns = onSnapshot(query(collection(db, 'announcements')), (snapshot) => {
      setAnnouncements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'announcements'));

    const unsubAssets = onSnapshot(query(collection(db, 'assets')), (snapshot) => {
      setAssets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Asset)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'assets'));

    const unsubTemplates = onSnapshot(query(collection(db, 'certificate_templates')), (snapshot) => {
      setCertificateTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CertificateTemplate)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'certificate_templates'));

    const unsubTransactions = onSnapshot(
      isAdmin
        ? query(collection(db, 'transactions'))
        : query(collection(db, 'transactions'), where('userId', '==', userId)),
      (snapshot) => {
        setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    return () => {
      unsubEvents();
      unsubApps();
      unsubCerts();
      unsubAnns();
      unsubAssets();
      unsubTemplates();
      unsubTransactions();
    };
  }, [isAuthReady, user?.id, user?.role]);

  const addEvent = async (eventData: Omit<Event, 'id'>) => {
    try {
      const newRef = doc(collection(db, 'events'));
      await setDoc(newRef, { ...eventData });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));
      // Also delete related applications (in a real app, use a batch or cloud function)
      const relatedApps = applications.filter(a => a.eventId === id);
      for (const app of relatedApps) {
        await deleteDoc(doc(db, 'applications', app.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
    }
  };

  const applyForEvent = async (eventId: string, userId: string, price: number = 0) => {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const eventRef = doc(db, 'events', eventId);
        const appRef = doc(db, 'applications', `${userId}_${eventId}`);

        const [userDoc, eventDoc, appDoc] = await Promise.all([
          transaction.get(userRef),
          transaction.get(eventRef),
          transaction.get(appRef)
        ]);

        if (!userDoc.exists()) {
          throw new Error('Օգտատերը չի գտնվել');
        }

        if (!eventDoc.exists()) {
          throw new Error('Միջոցառումը չի գտնվել');
        }

        if (appDoc.exists()) {
          throw new Error('Այս միջոցառման համար արդեն դիմել եք:');
        }

        const userData = userDoc.data();
        const eventData = eventDoc.data();
        const currentCoins = userData.fzCoins || 0;

        // Calculate payment
        // We allow registration even if coins are insufficient, as per "pay on spot" logic in UI
        const amountToDeduct = Math.min(currentCoins, price);
        const remainingPayment = Math.max(0, price - amountToDeduct);

        // Update user coins
        transaction.update(userRef, { fzCoins: currentCoins - amountToDeduct });

        // Create application
        const newApp = {
          eventId,
          userId,
          status: 'pending',
          appliedAt: new Date().toISOString(),
          paymentRequired: remainingPayment,
          paidAmount: amountToDeduct
        };
        transaction.set(appRef, newApp);

        // Add transaction record if any coins were deducted
        if (amountToDeduct > 0) {
          const transRef = doc(collection(db, 'transactions'));
          transaction.set(transRef, {
            userId,
            amount: -amountToDeduct,
            type: 'spend',
            reason: `Վճարում միջոցառման համար՝ ${eventData.title}`,
            date: new Date().toISOString()
          });
        }
      });
    } catch (error: any) {
      if (error.message === 'Այս միջոցառման համար արդեն դիմել եք:' || 
          error.message === 'Միջոցառումը չի գտնվել' || 
          error.message === 'Օգտատերը չի գտնվել') {
        throw error;
      }
      handleFirestoreError(error, OperationType.CREATE, 'applications');
    }
  };

  const updateApplicationStatus = async (appId: string, status: 'approved' | 'rejected', telegramLink?: string, attended?: boolean) => {
    try {
      const updates: any = { status };
      if (telegramLink !== undefined) updates.telegramLink = telegramLink;
      if (attended !== undefined) updates.attended = attended;
      
      await updateDoc(doc(db, 'applications', appId), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `applications/${appId}`);
    }
  };

  const updateAttendance = async (appId: string, attended: boolean) => {
    try {
      await updateDoc(doc(db, 'applications', appId), { attended });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `applications/${appId}`);
    }
  };

  const updateEvent = async (eventId: string, updates: Partial<Event>) => {
    try {
      await updateDoc(doc(db, 'events', eventId), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}`);
    }
  };

  const removeApplication = async (appId: string) => {
    try {
      await deleteDoc(doc(db, 'applications', appId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `applications/${appId}`);
    }
  };

  const issueCertificate = async (cert: Omit<Certificate, 'id' | 'issuedAt' | 'recipientName'>) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', cert.userId));
      const recipientName = userDoc.exists() ? userDoc.data()?.name : 'Անհայտ';
      
      const newRef = doc(collection(db, 'certificates'));
      await setDoc(newRef, {
        ...cert,
        recipientName,
        issuedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'certificates');
    }
  };

  const addAnnouncement = async (ann: Omit<Announcement, 'id' | 'date'>) => {
    try {
      const newRef = doc(collection(db, 'announcements'));
      await setDoc(newRef, {
        ...ann,
        date: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'announcements');
    }
  };

  const addAsset = async (asset: Omit<Asset, 'id'>) => {
    try {
      const newRef = doc(collection(db, 'assets'));
      await setDoc(newRef, { ...asset });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'assets');
    }
  };

  const addCertificateTemplate = async (template: Omit<CertificateTemplate, 'id' | 'createdAt'>) => {
    try {
      const newRef = doc(collection(db, 'certificate_templates'));
      await setDoc(newRef, {
        ...template,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'certificate_templates');
    }
  };

  const deleteCertificateTemplate = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'certificate_templates', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `certificate_templates/${id}`);
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'date'>) => {
    try {
      const newRef = doc(collection(db, 'transactions'));
      await setDoc(newRef, {
        ...transaction,
        date: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `announcements/${id}`);
    }
  };

  return (
    <DataContext.Provider value={{ 
      events, applications, certificates, announcements, assets, certificateTemplates, transactions,
      addEvent, deleteEvent, applyForEvent, updateApplicationStatus, updateAttendance,
      issueCertificate, addAnnouncement, deleteAnnouncement, addAsset, updateEvent, removeApplication,
      addCertificateTemplate, deleteCertificateTemplate, addTransaction
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext)!;
