import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Plus, Edit2, Trash2, Image as ImageIcon, X, Users, Shield, Settings, Calendar, CheckCircle, XCircle, Award, Megaphone, Palette, Activity, Search, Filter, ArrowUpDown, Clock, Download, Phone, Copy } from 'lucide-react';
import { useAuth, User } from '../../contexts/AuthContext';
import { useData, Event, Application, Certificate, CertificateTemplate } from '../../contexts/DataContext';
import { toast } from 'sonner';
import { Logo } from '../../components/Logo';
import { jsPDF } from 'jspdf';

const DEPARTMENTS = ['Certificate', 'Volunteering', 'Seminar', 'SMM', 'Engineering'];
const DEPARTMENT_LABELS: Record<string, string> = {
  'Certificate': 'Սերտիֆիկատ',
  'Volunteering': 'Կամավորություն',
  'Seminar': 'Սեմինար',
  'SMM': 'SMM',
  'Engineering': 'Ինժեներիա'
};

const EVENT_TYPES = ['Seminar', 'Volunteering', 'Event'];
const EVENT_TYPE_LABELS: Record<string, string> = {
  'Seminar': 'Սեմինար',
  'Volunteering': 'Կամավորություն',
  'Event': 'Միջոցառում'
};

export default function AdminDashboard() {
  const { logout, user, users, addUser, updateUser: updateAuthUser, deleteUser } = useAuth();
  const { 
    events, applications, certificates, announcements, assets, transactions, certificateTemplates,
    addEvent, deleteEvent, updateEvent, updateApplicationStatus, updateAttendance, removeApplication, issueCertificate, addAnnouncement, addAsset, addTransaction, addCertificateTemplate, deleteCertificateTemplate
  } = useData();
  
  const [activeTab, setActiveTab] = useState<'staff' | 'users' | 'events' | 'applications' | 'department' | 'certificates' | 'coins'>('staff');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedAttendanceEvent, setSelectedAttendanceEvent] = useState<Event | null>(null);
  const [templateData, setTemplateData] = useState({ name: '', description: '', imageUrl: '' });
  
  const [formData, setFormData] = useState({ username: '', name: '', email: '', phone: '', department: 'Certificate', image: '', password: '' });
  const [eventData, setEventData] = useState({ title: '', description: '', type: 'Event', image: '', date: '', price: 0, registrationDeadline: '' });

  // Department specific states
  const [certData, setCertData] = useState<{ eventId: string, title: string, isMandatory: boolean, type: string, templateData: string | null }>({ eventId: '', title: '', isMandatory: false, type: 'Event', templateData: null });
  const [annData, setAnnData] = useState({ title: '', content: '' });
  
  const [approvingAppId, setApprovingAppId] = useState<string | null>(null);
  const [telegramLink, setTelegramLink] = useState('');
  const [selectedEventForVolunteers, setSelectedEventForVolunteers] = useState<Event | null>(null);
  const [volunteerSearch, setVolunteerSearch] = useState('');
  const [deptAppSearch, setDeptAppSearch] = useState('');
  const [deptAppStatus, setDeptAppStatus] = useState('all');

  const [isCoinModalOpen, setIsCoinModalOpen] = useState(false);
  const [selectedUserForCoins, setSelectedUserForCoins] = useState<User | null>(null);
  const [coinAdjustment, setCoinAdjustment] = useState({ amount: 0, reason: '', type: 'add' as 'add' | 'subtract' });
  const [coinSearchQuery, setCoinSearchQuery] = useState('');
  
  const [userFilters, setUserFilters] = useState({
    eventId: 'all',
    status: 'all', // 'all', 'new', 'registered'
    sort: 'newest' as 'newest' | 'oldest' | 'name'
  });

  // Application filters
  const [appFilters, setAppFilters] = useState({
    eventId: 'all',
    status: 'all',
    search: '',
    role: 'all',
    dateRange: 'all',
    sort: 'newest' as 'newest' | 'oldest'
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user?.role === 'superadmin') {
      setActiveTab('staff');
    } else {
      setActiveTab('department');
    }
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEvent = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Խնդրում ենք վերբեռնել նկար:');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('Նկարի չափը պետք է լինի 5MB-ից պակաս:');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = () => {
        toast.error('Չհաջողվեց բեռնել նկարը:');
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimensions
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            toast.error('Չհաջողվեց մշակել նկարը:');
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          if (isEvent) {
            setEventData(prev => ({ ...prev, image: dataUrl }));
          } else {
            setFormData(prev => ({ ...prev, image: dataUrl }));
          }
        } catch (err) {
          console.error('Image processing error:', err);
          toast.error('Նկարի մշակման սխալ:');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        addAsset({ name: file.name, url: reader.result as string });
        toast.success('Ակտիվը հաջողությամբ վերբեռնվեց:');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = formData.username.trim();
    if (!formData.name || !trimmedUsername) {
      toast.error('Խնդրում ենք տրամադրել օգտանուն և անուն:');
      return;
    }

    const submissionData = { ...formData, username: trimmedUsername };

    if (editingId) {
      await updateAuthUser(editingId, submissionData);
      toast.success('Հաջողությամբ թարմացվեց:');
    } else {
      if (users.find(u => u.username === trimmedUsername)) {
        toast.error('Օգտանունն արդեն գոյություն ունի:');
        return;
      }

      const newUser: any = {
        username: trimmedUsername,
        name: formData.name,
        role: activeTab === 'staff' ? 'admin' : 'user',
        hasPassword: !!formData.password,
        image: formData.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.username}`
      };
      
      if (formData.email) newUser.email = formData.email;
      if (formData.phone) newUser.phone = formData.phone;
      if (formData.password) newUser.password = formData.password;
      if (activeTab === 'staff' && formData.department) newUser.department = formData.department;
      
      await addUser(newUser as Omit<User, 'id'> & { password?: string });
      toast.success(`${newUser.role === 'admin' ? 'Ադմինը' : 'Օգտատերը'} հաջողությամբ ստեղծվեց:`);
    }
    closeModal();
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Միջոցառում ստեղծելու համար պետք է մուտք գործած լինեք:');
      return;
    }

    // Validation
    if (!eventData.title.trim()) {
      toast.error('Խնդրում ենք տրամադրել միջոցառման վերնագիր:');
      return;
    }
    if (!eventData.description.trim()) {
      toast.error('Խնդրում ենք տրամադրել միջոցառման նկարագրություն:');
      return;
    }
    if (!eventData.date) {
      toast.error('Խնդրում ենք տրամադրել միջոցառման ամսաթիվ:');
      return;
    }
    if (eventData.type === 'Seminar' && (eventData.price === undefined || eventData.price < 0)) {
      toast.error('Խնդրում ենք տրամադրել վավեր գին սեմինարի համար:');
      return;
    }

    const submissionData: any = {
      title: eventData.title.trim(),
      description: eventData.description.trim(),
      type: eventData.type as any,
      image: eventData.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(eventData.title)}`,
      date: eventData.date,
      registrationDeadline: eventData.registrationDeadline || eventData.date,
    };

    if (eventData.type === 'Seminar') {
      submissionData.price = Number(eventData.price) || 0;
    }

    try {
      if (selectedEvent) {
        await toast.promise(updateEvent(selectedEvent.id, submissionData), {
          loading: 'Միջոցառումը թարմացվում է...',
          success: 'Միջոցառումը հաջողությամբ թարմացվեց:',
          error: (err) => `Չհաջողվեց թարմացնել միջոցառումը: ${err.message || 'Անհայտ սխալ'}`
        });
      } else {
        submissionData.createdBy = user.id;
        await toast.promise(addEvent(submissionData), {
          loading: 'Միջոցառումը ստեղծվում է...',
          success: 'Միջոցառումը հաջողությամբ ստեղծվեց:',
          error: (err) => `Չհաջողվեց ստեղծել միջոցառումը: ${err.message || 'Անհայտ սխալ'}`
        });
      }
      closeEventModal();
    } catch (error) {
      console.error('Event submission error:', error);
    }
  };

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certData.eventId || !certData.title) return toast.error('Ընտրեք միջոցառումը և լրացրեք վերնագիրը:');
    
    const eventParticipants = applications.filter(app => 
      app.eventId === certData.eventId && 
      app.status === 'approved' && 
      app.attended === true
    );

    if (eventParticipants.length === 0) {
      return toast.error('Այս միջոցառման համար ներկա մասնակիցներ չեն գտնվել:');
    }
    
    const event = events.find(e => e.id === certData.eventId);
    const isVolunteering = event?.type === 'Volunteering';
    
    for (const app of eventParticipants) {
      try {
        // Issue certificate
        await issueCertificate({
          userId: app.userId,
          title: certData.title,
          isMandatory: certData.isMandatory,
          type: certData.type,
          templateData: certData.templateData || undefined,
          eventId: certData.eventId
        });

        // Award 1000 FZ coins if it's a volunteering event
        if (isVolunteering) {
          const appUser = users.find(u => u.id === app.userId);
          if (appUser) {
            const newBalance = (appUser.fzCoins || 0) + 1000;
            await updateAuthUser(appUser.id, { fzCoins: newBalance });
            await addTransaction({
              userId: appUser.id,
              amount: 1000,
              type: 'award',
              reason: `Մասնակցություն կամավորությանը՝ ${event.title}`,
              adminId: user?.id
            });
          }
        }
      } catch (err) {
        console.error(`Failed to issue certificate for ${app.userId}:`, err);
      }
    }
    
    toast.success(`Սերտիֆիկատը հաջողությամբ տրամադրվեց ${eventParticipants.length} մասնակցի:${isVolunteering ? ' 1000 FZ Coins նույնպես փոխանցվեց:' : ''}`);
    setCertData({ eventId: '', title: '', isMandatory: false, type: 'Event', templateData: null });
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCertData({ ...certData, templateData: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateData.name || !templateData.imageUrl) {
      toast.error('Լրացրեք բոլոր դաշտերը:');
      return;
    }

    try {
      await addCertificateTemplate(templateData);
      toast.success('Ձևանմուշը հաջողությամբ ավելացվեց:');
      setIsTemplateModalOpen(false);
      setTemplateData({ name: '', description: '', imageUrl: '' });
    } catch (error) {
      console.error('Template creation error:', error);
      toast.error('Չհաջողվեց ավելացնել ձևանմուշը:');
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annData.title || !annData.content) return;
    await addAnnouncement(annData);
    toast.success('Հայտարարությունը հաջողությամբ տեղադրվեց:');
    setAnnData({ title: '', content: '' });
  };

  const handleTemplateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTemplateData({ ...templateData, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAttendanceToggle = async (applicationId: string, attended: boolean) => {
    try {
      await updateAttendance(applicationId, attended);
      
      if (attended) {
        const app = applications.find(a => a.id === applicationId);
        const event = events.find(e => e.id === app?.eventId);
        const participant = users.find(u => u.id === app?.userId);
        
        if (app && event && participant) {
          const template = certificateTemplates[0];
          if (template) {
            await generateCertificate(participant, event, template);
            toast.success(`${participant.name}-ի սերտիֆիկատը գեներացվեց:`);
          }
        }
      }
      
      toast.success('Հաճախելիությունը թարմացվեց:');
    } catch (error) {
      console.error('Attendance update error:', error);
      toast.error('Չհաջողվեց թարմացնել հաճախելիությունը:');
    }
  };

  const generateCertificate = async (participant: User, event: Event, template: CertificateTemplate) => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Add template image
      doc.addImage(template.url, 'JPEG', 0, 0, 297, 210);

      // Add text
      doc.setFontSize(40);
      doc.setTextColor(0, 0, 0);
      doc.text(event.title, 148.5, 105, { align: 'center' });

      doc.setFontSize(24);
      doc.text(participant.name, 148.5, 130, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(new Date().toLocaleDateString('hy-AM'), 148.5, 150, { align: 'center' });

      const pdfData = doc.output('datauristring');
      
      await issueCertificate({
        userId: participant.id,
        eventId: event.id,
        pdfUrl: pdfData,
        templateData: template.id,
        title: event.title
      });

      return pdfData;
    } catch (error) {
      console.error('Certificate generation error:', error);
      throw error;
    }
  };

  const handleDistributeCoins = async (event: Event) => {
    if (event.coinsAwarded) {
      toast.error('Այս միջոցառման համար մետաղադրամներն արդեն բաշխվել են:');
      return;
    }

    const eventApps = applications.filter(a => a.eventId === event.id && a.status === 'approved' && a.attended !== false);
    if (eventApps.length === 0) {
      toast.error('Համապատասխան կամավորներ չեն գտնվել:');
      return;
    }

    const template = certificateTemplates[0];

    for (const app of eventApps) {
      const appUser = users.find(u => u.id === app.userId);
      if (appUser) {
        try {
          // Award coins
          await updateAuthUser(appUser.id, { fzCoins: (appUser.fzCoins || 0) + 1000 });
          
          await addTransaction({
            userId: appUser.id,
            amount: 1000,
            type: 'award',
            reason: `Կամավորություն՝ ${event.title}`,
            adminId: user?.id
          });

          // Issue certificate if template exists
          if (template) {
            await generateCertificate(appUser, event, template);
          }
        } catch (err) {
          console.error(`Failed to process volunteer ${appUser.name}:`, err);
        }
      }
    }
    
    await updateEvent(event.id, { coinsAwarded: true });
    setSelectedEventForVolunteers({ ...event, coinsAwarded: true });
    toast.success(`1000 FZ Coins և սերտիֆիկատներ բաշխվեցին ${eventApps.length} կամավորների:`);
  };

  const handleDeleteUser = async (id: string) => {
    await deleteUser(id);
    toast.success('Հաջողությամբ հեռացվեց:');
  };

  const openEditUser = (editUser: User) => {
    setFormData({ 
      username: editUser.username, 
      name: editUser.name, 
      email: editUser.email || '',
      phone: editUser.phone || '',
      department: editUser.department || 'Certificate', 
      image: editUser.image || '',
      password: ''
    });
    setEditingId(editUser.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ username: '', name: '', email: '', phone: '', department: 'Certificate', image: '', password: '' });
  };

  const openEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setEventData({
      title: event.title,
      description: event.description,
      type: event.type,
      image: event.image,
      date: event.date,
      price: event.price || 0,
      registrationDeadline: event.registrationDeadline || event.date
    });
    setIsEventModalOpen(true);
  };

  const closeEventModal = () => {
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setEventData({ title: '', description: '', type: 'Event', image: '', date: '', price: 0, registrationDeadline: '' });
  };

  const displayedUsers = users.filter(u => {
    let matchRole = false;
    if (activeTab === 'staff') matchRole = u.role === 'admin' || u.role === 'superadmin';
    if (activeTab === 'users') matchRole = u.role === 'user';
    
    if (!matchRole) return false;
    
    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = (
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q))
      );
      if (!match) return false;
    }

    // Event Filter
    if (activeTab === 'users' && userFilters.eventId !== 'all') {
      const hasApplied = applications.some(app => app.userId === u.id && app.eventId === userFilters.eventId);
      if (!hasApplied) return false;
    }

    // Status Filter
    if (activeTab === 'users' && userFilters.status !== 'all') {
      if (userFilters.status === 'new' && u.hasPassword) return false;
      if (userFilters.status === 'registered' && !u.hasPassword) return false;
    }
    
    return true;
  }).sort((a, b) => {
    if (userFilters.sort === 'name') return a.name.localeCompare(b.name);
    
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    
    return userFilters.sort === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const regularUsers = users.filter(u => u.role === 'user');

  const filteredApplications = applications.filter(app => {
    const appUser = users.find(u => u.id === app.userId);
    const appEvent = events.find(e => e.id === app.eventId);
    
    if (!appUser || !appEvent) return false;

    // Event Filter
    if (appFilters.eventId !== 'all' && app.eventId !== appFilters.eventId) return false;

    // Status Filter
    if (appFilters.status !== 'all' && app.status !== appFilters.status) return false;

    // Role/Category Filter
    if (appFilters.role !== 'all') {
      if (appUser.role !== appFilters.role && appUser.department !== appFilters.role) return false;
    }

    // Search Filter (Name or Email)
    if (appFilters.search) {
      const q = appFilters.search.toLowerCase();
      const nameMatch = appUser.name.toLowerCase().includes(q);
      const emailMatch = appUser.email?.toLowerCase().includes(q);
      const usernameMatch = appUser.username.toLowerCase().includes(q);
      if (!nameMatch && !emailMatch && !usernameMatch) return false;
    }

    // Date Range Filter
    if (appFilters.dateRange !== 'all') {
      const appliedDate = new Date(app.appliedAt);
      const now = new Date();
      if (appFilters.dateRange === 'today') {
        if (appliedDate.toDateString() !== now.toDateString()) return false;
      } else if (appFilters.dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (appliedDate < weekAgo) return false;
      } else if (appFilters.dateRange === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (appliedDate < monthAgo) return false;
      }
    }

    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.appliedAt).getTime();
    const dateB = new Date(b.appliedAt).getTime();
    return appFilters.sort === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const handleCoinAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCoins || !coinAdjustment.amount || !coinAdjustment.reason) {
      toast.error('Խնդրում ենք լրացնել բոլոր դաշտերը:');
      return;
    }

    const amount = Number(coinAdjustment.amount);
    const finalAmount = coinAdjustment.type === 'add' ? amount : -amount;
    const newBalance = (selectedUserForCoins.fzCoins || 0) + finalAmount;

    if (newBalance < 0) {
      toast.error('Օգտատերը չի կարող ունենալ բացասական հաշվեկշիռ:');
      return;
    }

    try {
      await updateAuthUser(selectedUserForCoins.id, { fzCoins: newBalance });
      await addTransaction({
        userId: selectedUserForCoins.id,
        amount: finalAmount,
        type: coinAdjustment.type === 'add' ? 'add' : 'subtract',
        reason: coinAdjustment.reason,
        adminId: user?.id
      });
      toast.success('Մետաղադրամները հաջողությամբ փոփոխվեցին:');
      setIsCoinModalOpen(false);
      setCoinAdjustment({ amount: 0, reason: '', type: 'add' });
      setSelectedUserForCoins(null);
    } catch (error) {
      toast.error('Չհաջողվեց փոփոխել մետաղադրամները:');
    }
  };

  const renderCertificatesTab = () => {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">Սերտիֆիկատների Կառավարում</h2>
            <p className="text-secondary text-sm font-medium">Կառավարեք սերտիֆիկատների ձևանմուշները և տրամադրումը</p>
          </div>
          <button 
            onClick={() => setIsTemplateModalOpen(true)}
            className="minimal-button-primary py-2.5 px-5 flex items-center gap-2"
          >
            <Plus size={18} /> Ավելացնել Ձևանմուշ
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {certificateTemplates.map((template) => (
            <div key={template.id} className="minimal-card group overflow-hidden">
              <div className="aspect-[1.414/1] relative overflow-hidden bg-white/5">
                <img 
                  src={template.imageUrl} 
                  alt={template.name} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button 
                    onClick={() => deleteCertificateTemplate(template.id)}
                    className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg mb-1">{template.name}</h3>
                <p className="text-secondary text-xs">{template.description}</p>
              </div>
            </div>
          ))}
          {certificateTemplates.length === 0 && (
            <div className="col-span-full py-20 text-center glass rounded-3xl">
              <Award size={48} className="mx-auto text-secondary/20 mb-4" />
              <p className="text-secondary italic">Ձևանմուշներ չեն գտնվել:</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold mb-4">Տրված Սերտիֆիկատներ</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {certificates.map((cert) => {
              const certUser = users.find(u => u.id === cert.userId);
              const certEvent = events.find(e => e.id === cert.eventId);
              return (
                <motion.div
                  key={cert.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="minimal-card p-6 flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <img src={certUser?.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'} alt="" className="w-10 h-10 rounded-full object-cover border border-border" referrerPolicy="no-referrer" />
                    <div>
                      <div className="font-bold text-sm text-white">{certUser?.name || 'Անհայտ'}</div>
                      <div className="text-[10px] text-secondary uppercase tracking-widest">@{certUser?.username}</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="font-bold text-sm mb-1">{cert.title}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-primary uppercase tracking-widest font-bold">{certEvent?.title || 'Անհայտ'}</div>
                      <div className="text-[10px] text-secondary font-bold">{new Date(cert.issuedAt).toLocaleDateString('hy-AM')}</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleDownloadCertificate(cert)}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-primary transition-colors font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Download size={16} /> Ներբեռնել PDF
                  </button>
                </motion.div>
              );
            })}
            {certificates.length === 0 && (
              <div className="col-span-full py-12 text-center text-secondary italic">
                Սերտիֆիկատներ դեռ չեն տրամադրվել:
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCoinsTab = () => {
    const filteredUsers = users.filter(u => u.role === 'user' && (
      u.name.toLowerCase().includes(coinSearchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(coinSearchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(coinSearchQuery.toLowerCase()))
    ));

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">FZ Coins-ի Կառավարում</h2>
            <p className="text-secondary text-sm font-medium">Դիտեք և փոփոխեք օգտատերերի մետաղադրամների հաշվեկշիռը</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
            <input
              type="text"
              placeholder="Փնտրել օգտատերերին..."
              value={coinSearchQuery}
              onChange={(e) => setCoinSearchQuery(e.target.value)}
              className="minimal-input pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredUsers.map(u => (
                <motion.div
                  key={u.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="minimal-card p-6 flex flex-col gap-4"
                >
                  <div className="flex items-center gap-4">
                    <img src={u.image} alt={u.name} className="w-12 h-12 rounded-full border border-border" />
                    <div>
                      <div className="font-bold text-primary">{u.name}</div>
                      <div className="text-xs text-secondary">@{u.username}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="text-[10px] text-secondary uppercase tracking-widest font-bold">Հաշվեկշիռ</div>
                    <div className="flex items-center gap-2 font-bold text-yellow-500">
                      <span>🪙</span>
                      <span>{u.fzCoins || 0}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedUserForCoins(u);
                      setIsCoinModalOpen(true);
                    }}
                    className="w-full minimal-button-secondary py-3 text-xs font-bold"
                  >
                    Փոփոխել Հաշվեկշիռը
                  </button>
                </motion.div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="col-span-full py-20 text-center text-secondary italic">
                  Օգտատերեր չեն գտնվել:
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="minimal-card">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Clock className="text-accent" size={20} /> Վերջին Գործարքները
              </h3>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20).map(t => {
                  const tUser = users.find(u => u.id === t.userId);
                  const tAdmin = users.find(u => u.id === t.adminId);
                  return (
                    <div key={t.id} className="p-4 rounded-xl bg-surface border border-border space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <img src={tUser?.image} alt={tUser?.name} className="w-6 h-6 rounded-full border border-border" />
                          <span className="text-sm font-bold text-primary">{tUser?.name}</span>
                        </div>
                        <span className={`text-sm font-bold ${t.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {t.amount > 0 ? '+' : ''}{t.amount} 🪙
                        </span>
                      </div>
                      <p className="text-xs text-secondary italic">"{t.reason}"</p>
                      <div className="flex justify-between items-center text-[10px] text-secondary/60">
                        <span>{new Date(t.date).toLocaleString('hy-AM')}</span>
                        {tAdmin && <span>{tAdmin.name}-ի կողմից</span>}
                      </div>
                    </div>
                  );
                })}
                {transactions.length === 0 && (
                  <div className="text-center py-8 text-secondary italic">Դեռևս գործարքներ չկան</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleDownloadCertificate = async (cert: Certificate) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Certificate Design
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // Background
      doc.setFillColor(15, 23, 42); // Slate-900
      doc.rect(0, 0, width, height, 'F');

      // Border
      doc.setDrawColor(168, 85, 247); // Purple-500
      doc.setLineWidth(2);
      doc.rect(10, 10, width - 20, height - 20);

      // Content
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(40);
      doc.text('ՍԵՐՏԻՖԻԿԱՏ', width / 2, 50, { align: 'center' });
      doc.setFontSize(20);
      doc.text('ՀԱՎԱՍՏԱԳԻՐ', width / 2, 65, { align: 'center' });

      doc.setFontSize(16);
      doc.setTextColor(156, 163, 175); // Gray-400
      doc.text('Սույնով հավաստվում է, որ', width / 2, 90, { align: 'center' });

      doc.setFontSize(30);
      doc.setTextColor(255, 255, 255);
      doc.text(cert.recipientName, width / 2, 110, { align: 'center' });

      doc.setFontSize(16);
      doc.setTextColor(156, 163, 175);
      doc.text('հաջողությամբ ավարտել է', width / 2, 130, { align: 'center' });

      doc.setFontSize(22);
      doc.setTextColor(168, 85, 247);
      doc.text(cert.title, width / 2, 150, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(156, 163, 175);
      doc.text(`Տրված է: ${new Date(cert.issuedAt).toLocaleDateString('hy-AM')}`, width / 2, 170, { align: 'center' });
      doc.text(`Սերտիֆիկատի ID: ${cert.id}`, width / 2, 180, { align: 'center' });

      // Signature
      doc.setDrawColor(255, 255, 255);
      doc.line(width / 2 - 40, 210, width / 2 + 40, 210);
      doc.text('Լիազորված Ստորագրություն', width / 2, 220, { align: 'center' });

      doc.save(`Certificate_${cert.recipientName.replace(/\s+/g, '_')}.pdf`);
      toast.success('Սերտիֆիկատը հաջողությամբ ներբեռնվեց:');
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast.error('Չհաջողվեց ներբեռնել սերտիֆիկատը:');
    }
  };

  // Render specific department workspaces
  const renderDepartmentWorkspace = () => {
    if (!user) return null;

    switch (user.department) {
      case 'Certificate':
        return (
          <div className="space-y-8">
            <div className="glass p-8 rounded-3xl">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3"><Award className="text-purple-400" /> Տրամադրել Սերտիֆիկատ ըստ Միջոցառման</h3>
              <form onSubmit={handleIssueCertificate} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Ընտրել Միջոցառումը / Սեմինարը / Կամավորությունը</label>
                  <select 
                    value={certData.eventId}
                    onChange={e => {
                      const selectedEvent = events.find(ev => ev.id === e.target.value);
                      setCertData({
                        ...certData, 
                        eventId: e.target.value,
                        title: selectedEvent ? `${selectedEvent.title}-ի ավարտական սերտիֆիկատ` : '',
                        type: selectedEvent ? selectedEvent.type : 'Event'
                      });
                    }}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm bg-slate-900"
                    required
                  >
                    <option value="">Ընտրեք միջոցառումը...</option>
                    {events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(ev => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({new Date(ev.date).toLocaleDateString('hy-AM')})
                      </option>
                    ))}
                  </select>
                  {certData.eventId && (
                    <div className="mt-2 text-xs text-purple-400 ml-1">
                      Ներկա մասնակիցներ՝ {
                        applications.filter(app => 
                          app.eventId === certData.eventId && 
                          app.status === 'approved' && 
                          app.attended === true
                        ).length
                      }
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Սերտիֆիկատի Ձևանմուշ (PDF կամ Նկար)</label>
                  <input 
                    type="file" 
                    accept=".pdf,image/*"
                    onChange={handleTemplateUpload}
                    className="w-full glass-input rounded-xl px-4 py-2 text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                  />
                  {certData.templateData && <p className="text-xs text-green-400 mt-1 ml-1">Ձևանմուշը հաջողությամբ բեռնվել է</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Սերտիֆիկատի Վերնագիր</label>
                  <input 
                    type="text" 
                    value={certData.title}
                    onChange={e => setCertData({...certData, title: e.target.value})}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                    placeholder="օր. React Masterclass-ի ավարտական"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Տեսակ</label>
                    <select 
                      value={certData.type} 
                      onChange={e => setCertData({...certData, type: e.target.value})}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm bg-slate-900"
                    >
                      <option value="Event">Միջոցառում</option>
                      <option value="Seminar">Սեմինար</option>
                      <option value="Volunteering">Կամավորություն</option>
                      <option value="Other">Այլ</option>
                    </select>
                  </div>
                  <div className="flex items-center mt-6">
                    <label className="flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={certData.isMandatory}
                        onChange={e => setCertData({...certData, isMandatory: e.target.checked})}
                        className="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-slate-900"
                      />
                      <span className="ml-2 text-sm text-gray-300">Պարտադիր սերտիֆիկատ</span>
                    </label>
                  </div>
                </div>
                <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-lg">
                  Տրամադրել Սերտիֆիկատ
                </button>
              </form>
            </div>
            
            <div className="glass p-8 rounded-3xl">
              <h3 className="text-xl font-bold mb-4">Վերջին Սերտիֆիկատները</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {certificates.map(cert => {
                  const certUser = users.find(u => u.id === cert.userId);
                  return (
                    <div key={cert.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">{cert.title}</div>
                        <div className="text-sm text-gray-400">Տրված է՝ {certUser?.name || 'Անհայտ'}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleDownloadCertificate(cert)}
                          className="p-2 glass-button rounded-xl text-purple-400 hover:text-purple-300 transition-colors"
                          title="Ներբեռնել PDF"
                        >
                          <Download size={18} />
                        </button>
                        <Award className="text-purple-400 opacity-50" size={32} />
                      </div>
                    </div>
                  );
                })}
                {certificates.length === 0 && <div className="text-gray-500">Սերտիֆիկատներ դեռ չեն տրամադրվել:</div>}
              </div>
            </div>
          </div>
        );

      case 'SMM':
        return (
          <div className="space-y-8">
            <div className="glass p-8 rounded-3xl">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3"><Megaphone className="text-blue-400" /> Տեղադրել Հայտարարություն</h3>
              <form onSubmit={handlePostAnnouncement} className="space-y-4 max-w-lg">
                <input 
                  type="text" 
                  value={annData.title}
                  onChange={e => setAnnData({...annData, title: e.target.value})}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                  placeholder="Հայտարարության Վերնագիր"
                  required
                />
                <textarea 
                  value={annData.content}
                  onChange={e => setAnnData({...annData, content: e.target.value})}
                  className="w-full glass-input rounded-xl px-4 py-3 text-sm h-32 resize-none"
                  placeholder="Գրեք ձեր հայտարարությունը այստեղ..."
                  required
                />
                <button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold shadow-lg">
                  Հրապարակել
                </button>
              </form>
            </div>
            <div className="glass p-8 rounded-3xl">
              <h3 className="text-xl font-bold mb-4">Վերջին Հայտարարությունները</h3>
              <div className="space-y-4">
                {announcements.map(ann => (
                  <div key={ann.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="font-bold text-lg text-white mb-1">{ann.title}</div>
                    <div className="text-xs text-blue-400 mb-2">{new Date(ann.date).toLocaleString('hy-AM')}</div>
                    <p className="text-sm text-gray-300">{ann.content}</p>
                  </div>
                ))}
                {announcements.length === 0 && <div className="text-gray-500">Հայտարարություններ չկան:</div>}
              </div>
            </div>
          </div>
        );

      case 'Engineering':
        return (
          <div className="space-y-8">
            <div className="glass p-8 rounded-3xl">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3"><Activity className="text-green-400" /> Համակարգի Վիճակը</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-sm text-gray-400 mb-2">Սերվերի Աշխատաժամանակ</div>
                  <div className="text-3xl font-bold text-green-400">99.9%</div>
                </div>
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-sm text-gray-400 mb-2">Ակտիվ Օգտատերեր</div>
                  <div className="text-3xl font-bold text-blue-400">{users.length}</div>
                </div>
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-sm text-gray-400 mb-2">Տվյալների Բազայի Ծանրաբեռնվածություն</div>
                  <div className="text-3xl font-bold text-purple-400">12%</div>
                </div>
              </div>
              <h4 className="font-bold mb-4">Համակարգի Վերջին Գրանցումները</h4>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-3 rounded bg-slate-900/50 text-green-300">[INFO] Համակարգի պահուստավորումը հաջողությամբ ավարտվեց:</div>
                <div className="p-3 rounded bg-slate-900/50 text-blue-300">[INFO] Նոր օգտատիրոջ գրանցում: {users[users.length-1]?.username || 'N/A'}</div>
                <div className="p-3 rounded bg-slate-900/50 text-yellow-300">[WARN] Հիշողության բարձր օգտագործում է հայտնաբերվել:</div>
              </div>
            </div>
          </div>
        );

      case 'Seminar':
      case 'Volunteering':
        const deptEvents = events.filter(e => e.type === user.department);
        const deptApps = applications.filter(a => {
          const isDeptEvent = deptEvents.some(e => e.id === a.eventId);
          if (!isDeptEvent) return false;
          
          if (deptAppStatus !== 'all' && a.status !== deptAppStatus) return false;
          
          if (deptAppSearch) {
            const q = deptAppSearch.toLowerCase();
            const appUser = users.find(u => u.id === a.userId);
            const appEvent = events.find(e => e.id === a.eventId);
            if (!appUser || !appEvent) return false;
            return (
              appUser.name.toLowerCase().includes(q) ||
              appUser.username.toLowerCase().includes(q) ||
              appEvent.title.toLowerCase().includes(q)
            );
          }
          
          return true;
        });
        
        const deptName = user.department === 'Seminar' ? 'Սեմինար' : 'Կամավորություն';
        
        return (
          <div className="space-y-8">
            <div className="glass p-8 rounded-3xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Calendar className="text-orange-400" /> Կառավարել {deptName}ները
                </h3>
                <button
                  onClick={() => { setEventData(prev => ({...prev, type: user.department as any})); setIsEventModalOpen(true); }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold shadow-lg text-sm flex items-center gap-2"
                >
                  <Plus size={16} /> Ստեղծել {deptName}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {deptEvents.map(event => (
                  <div key={event.id} className="rounded-2xl overflow-hidden bg-white/5 border border-white/10">
                    <div className="h-32 overflow-hidden relative">
                      <img src={event.image} alt={event.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button onClick={() => deleteEvent(event.id)} className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/80 text-white">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-white">{event.title}</h4>
                        {event.price ? (
                          <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-md">
                            🪙 {event.price}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-gray-400">{new Date(event.date).toLocaleDateString('hy-AM')}</div>
                        <button 
                          onClick={() => setSelectedEventForVolunteers(event)}
                          className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                          Դիտել Կամավորներին
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {deptEvents.length === 0 && <div className="col-span-full text-gray-500">Դեռևս {deptName}ներ չեն ստեղծվել:</div>}
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h4 className="text-xl font-bold">Վերջին Հայտերը</h4>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Փնտրել..."
                      value={deptAppSearch}
                      onChange={(e) => setDeptAppSearch(e.target.value)}
                      className="w-full md:w-48 glass-input rounded-lg pl-8 pr-3 py-1.5 text-xs"
                    />
                  </div>
                  <select
                    value={deptAppStatus}
                    onChange={(e) => setDeptAppStatus(e.target.value)}
                    className="glass-input rounded-lg px-3 py-1.5 text-xs bg-slate-900"
                  >
                    <option value="all">Բոլորը</option>
                    <option value="pending">Սպասվող</option>
                    <option value="approved">Հաստատված</option>
                    <option value="rejected">Մերժված</option>
                  </select>
                </div>
              </div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-gray-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Օգտատեր</th>
                      <th className="px-4 py-3 font-medium">Հեռախոս</th>
                      <th className="px-4 py-3 font-medium">Միջոցառում</th>
                      <th className="px-4 py-3 font-medium">Կարգավիճակ</th>
                      <th className="px-4 py-3 font-medium text-right">Գործողություններ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {deptApps.map(app => {
                      const appUser = users.find(u => u.id === app.userId);
                      const appEvent = events.find(e => e.id === app.eventId);
                      if (!appUser || !appEvent) return null;
                      return (
                        <tr key={app.id} className="hover:bg-white/5">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img src={appUser.image} alt={appUser.name} className="w-8 h-8 rounded-full border border-border" />
                              <div className="text-white font-medium">{appUser.name}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {appUser.phone ? (
                              <div className="flex items-center gap-2">
                                <a 
                                  href={`tel:${appUser.phone}`}
                                  className="text-primary hover:underline flex items-center gap-1.5 font-medium"
                                >
                                  <Phone size={12} />
                                  {appUser.phone}
                                </a>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(appUser.phone);
                                    toast.success('Համարը պատճենվեց');
                                  }}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-secondary transition-colors"
                                  title="Պատճենել"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-secondary italic text-xs">Նշված չէ</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-white">{appEvent.title}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-1">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                app.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                                app.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                                'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                {app.status === 'pending' ? 'Սպասվող' : app.status === 'approved' ? 'Հաստատված' : 'Մերժված'}
                              </span>
                              {app.paidAmount && app.paidAmount > 0 ? (
                                <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest">
                                  Վճարված է: {app.paidAmount} 🪙
                                </span>
                              ) : app.paymentRequired && app.paymentRequired > 0 ? (
                                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest bg-orange-400/5 px-2 py-1 rounded-lg border border-orange-400/10">
                                  Տեղում վճարում: {app.paymentRequired} ֏
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {app.status === 'pending' && approvingAppId !== app.id && (
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setApprovingAppId(app.id)} className="text-green-400 hover:text-green-300"><CheckCircle size={16} /></button>
                                <button onClick={() => updateApplicationStatus(app.id, 'rejected')} className="text-red-400 hover:text-red-300"><XCircle size={16} /></button>
                              </div>
                            )}
                            {approvingAppId === app.id && (
                              <div className="flex items-center justify-end gap-2">
                                <input
                                  type="text"
                                  placeholder="Telegram հղում"
                                  value={telegramLink}
                                  onChange={(e) => setTelegramLink(e.target.value)}
                                  className="glass-input rounded-lg px-2 py-1 text-xs w-32"
                                />
                                <button
                                  onClick={() => {
                                    updateApplicationStatus(app.id, 'approved', telegramLink);
                                    setApprovingAppId(null);
                                    setTelegramLink('');
                                    toast.success('Հայտը հաստատվեց');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-green-600 text-white text-xs hover:bg-green-500"
                                >
                                  Հաստատել
                                </button>
                                <button
                                  onClick={() => {
                                    setApprovingAppId(null);
                                    setTelegramLink('');
                                  }}
                                  className="p-1 rounded-full text-gray-400 hover:text-white"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden grid grid-cols-1 gap-4">
                {deptApps.map(app => {
                  const appUser = users.find(u => u.id === app.userId);
                  const appEvent = events.find(e => e.id === app.eventId);
                  if (!appUser || !appEvent) return null;
                  return (
                    <motion.div
                      key={app.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="minimal-card p-6 flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={appUser.image} alt={appUser.name} className="w-10 h-10 rounded-full border border-border" />
                          <div>
                            <div className="font-bold text-sm text-white">{appUser.name}</div>
                            <div className="text-[10px] text-secondary uppercase tracking-widest">@{appUser.username}</div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                          app.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                          app.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {app.status === 'pending' ? 'Սպասվող' : app.status === 'approved' ? 'Հաստատված' : 'Մերժված'}
                        </span>
                      </div>

                      {appUser.phone && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-primary" />
                            <a href={`tel:${appUser.phone}`} className="text-sm font-bold text-white hover:underline">
                              {appUser.phone}
                            </a>
                          </div>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(appUser.phone);
                              toast.success('Համարը պատճենվեց');
                            }}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-secondary"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      )}

                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="font-bold text-sm mb-1">{appEvent.title}</div>
                        {app.paidAmount && app.paidAmount > 0 ? (
                          <div className="text-[10px] text-green-400 font-bold uppercase tracking-widest">
                            Վճարված է: {app.paidAmount} 🪙
                          </div>
                        ) : app.paymentRequired && app.paymentRequired > 0 ? (
                          <div className="text-[10px] text-orange-400 font-bold uppercase tracking-widest bg-orange-400/5 px-2 py-1 rounded-lg border border-orange-400/10 inline-block">
                            Տեղում վճարում: {app.paymentRequired} ֏
                          </div>
                        ) : null}
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        {app.status === 'pending' && approvingAppId !== app.id && (
                          <>
                            <button 
                              onClick={() => setApprovingAppId(app.id)}
                              className="flex-1 py-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors font-bold text-[10px] flex items-center justify-center gap-2"
                            >
                              <CheckCircle size={14} /> Հաստատել
                            </button>
                            <button 
                              onClick={() => updateApplicationStatus(app.id, 'rejected')}
                              className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors font-bold text-[10px] flex items-center justify-center gap-2"
                            >
                              <XCircle size={14} /> Մերժել
                            </button>
                          </>
                        )}
                        {approvingAppId === app.id && (
                          <div className="w-full flex flex-col gap-2">
                            <input
                              type="text"
                              placeholder="Telegram հղում"
                              value={telegramLink}
                              onChange={(e) => setTelegramLink(e.target.value)}
                              className="w-full minimal-input py-2.5 text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  updateApplicationStatus(app.id, 'approved', telegramLink);
                                  setApprovingAppId(null);
                                  setTelegramLink('');
                                  toast.success('Հայտը հաստատվեց');
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-[10px] hover:bg-green-500 transition-all"
                              >
                                Հաստատել
                              </button>
                              <button
                                onClick={() => {
                                  setApprovingAppId(null);
                                  setTelegramLink('');
                                }}
                                className="p-2.5 rounded-xl bg-white/5 text-secondary hover:text-primary"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {deptApps.length === 0 && (
                <div className="py-12 text-center text-secondary italic">
                  Հայտեր դեռ չկան:
                </div>
              )}
            </div>
          </div>
        );

      default:
        return <div className="text-center py-20 text-gray-500">Department workspace not configured.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col pb-20 lg:pb-0">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Logo className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tighter">
                FunZone Group | {user?.role === 'superadmin' ? 'Գլխավոր Ադմին' : 'Ադմին'}
              </h1>
              <p className="text-[10px] text-secondary font-medium uppercase tracking-widest">Բարի գալուստ, {user?.name.split(' ')[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-primary font-bold text-sm">
              <span className="text-yellow-500">🪙</span>
              <span>{user?.fzCoins || 0}</span>
            </div>
            <button 
              onClick={logout}
              className="minimal-button-secondary py-2 px-4 flex items-center gap-2"
            >
              <LogOut size={16} /> <span className="hidden sm:inline">Ելք</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-4 py-8">
        {/* Tabs (Desktop) */}
        <div className="hidden lg:flex flex-wrap gap-2 mb-8">
          {user?.role === 'superadmin' && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'staff' ? 'bg-primary text-bg' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
            >
              <Shield size={16} /> Անձնակազմ
            </button>
          )}
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'users' ? 'bg-primary text-bg' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
          >
            <Users size={16} /> Օգտատերեր
          </button>
          
          {user?.role === 'superadmin' && (
            <>
              <button
                onClick={() => setActiveTab('events')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'events' ? 'bg-primary text-bg' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
              >
                <Calendar size={16} /> Միջոցառումներ
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'applications' ? 'bg-primary text-bg' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
              >
                <CheckCircle size={16} /> Հայտեր
              </button>
            </>
          )}

          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('department')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'department' ? 'bg-primary text-bg' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
            >
              <Settings size={16} /> {user.department} Բաժին
            </button>
          )}

          {user?.role === 'superadmin' && (
            <button
              onClick={() => setActiveTab('certificates')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'certificates' ? 'bg-primary text-bg' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
            >
              <Award size={16} /> Սերտիֆիկատներ
            </button>
          )}

          {user?.role === 'superadmin' && (
            <button
              onClick={() => setActiveTab('coins')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-medium ${activeTab === 'coins' ? 'bg-primary text-bg' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
            >
              <span className="text-sm">🪙</span> FZ Coins
            </button>
          )}
        </div>

      {/* Main Content Area */}
      {activeTab === 'department' && renderDepartmentWorkspace()}
      {activeTab === 'coins' && renderCoinsTab()}

      {(activeTab === 'staff' || activeTab === 'users') && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">
                {activeTab === 'staff' ? 'Անձնակազմի Ցուցակ' : 'Օգտատերերի Ցուցակ'}
              </h2>
              <p className="text-secondary text-sm font-medium">
                {activeTab === 'staff' ? 'Կառավարեք համակարգի ադմինիստրատորներին և նրանց իրավունքները' : 'Կառավարեք գրանցված օգտատերերին'}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              {activeTab === 'users' && (
                <div className="flex flex-wrap gap-2">
                  <select
                    value={userFilters.eventId}
                    onChange={(e) => setUserFilters({ ...userFilters, eventId: e.target.value })}
                    className="minimal-input py-2 text-xs w-auto"
                  >
                    <option value="all">Բոլոր Միջոցառումները</option>
                    {events.map(e => (
                      <option key={e.id} value={e.id}>{e.title}</option>
                    ))}
                  </select>
                  <select
                    value={userFilters.status}
                    onChange={(e) => setUserFilters({ ...userFilters, status: e.target.value })}
                    className="minimal-input py-2 text-xs w-auto"
                  >
                    <option value="all">Բոլոր Կարգավիճակները</option>
                    <option value="new">Նոր (Սպասող)</option>
                    <option value="registered">Գրանցված</option>
                  </select>
                  <select
                    value={userFilters.sort}
                    onChange={(e) => setUserFilters({ ...userFilters, sort: e.target.value as any })}
                    className="minimal-input py-2 text-xs w-auto"
                  >
                    <option value="newest">Նորերը սկզբում</option>
                    <option value="oldest">Հները սկզբում</option>
                    <option value="name">Ըստ անվան</option>
                  </select>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                <input
                  type="text"
                  placeholder="Փնտրել..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="minimal-input pl-10 w-full sm:w-64"
                />
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="minimal-button-primary flex items-center justify-center gap-2 px-6"
              >
                <Plus size={20} /> Ավելացնել {activeTab === 'staff' ? 'Ադմին' : 'Օգտատեր'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {displayedUsers.map(u => (
                <motion.div
                  key={u.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="minimal-card flex flex-col items-center text-center relative group p-6"
                >
                  <div className="absolute top-4 right-4 flex gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                    {activeTab === 'users' && user?.role === 'superadmin' && (
                      <button 
                        onClick={() => {
                          setSelectedUserForCoins(u);
                          setIsCoinModalOpen(true);
                        }} 
                        className="p-2.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 transition-colors border border-yellow-500/20"
                        title="Կառավարել Մետաղադրամները"
                      >
                        <span className="text-xs">🪙</span>
                      </button>
                    )}
                    <button onClick={() => openEditUser(u)} className="p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors border border-blue-500/20">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteUser(u.id)} className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors border border-red-500/20">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="w-24 h-24 rounded-full p-0.5 border border-border mb-4 relative">
                    <img src={u.image} alt={u.name} className="w-full h-full rounded-full object-cover bg-surface" />
                    {!u.hasPassword && (
                      <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-bg text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-bg">
                        ՆՈՐ
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-bold mb-1">{u.name}</h3>
                  <p className="text-xs text-secondary mb-2 font-medium tracking-widest uppercase">@{u.username}</p>
                  
                  {u.phone && (
                    <div className="flex items-center gap-2 mb-4">
                      <a 
                        href={`tel:${u.phone}`}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
                      >
                        <Phone size={12} />
                        {u.phone}
                      </a>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(u.phone);
                          toast.success('Համարը պատճենվեց');
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-secondary transition-colors"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap justify-center gap-2">
                    {u.role === 'admin' && (
                      <span className="px-3 py-1 rounded-lg bg-primary/5 text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/10">
                        {DEPARTMENT_LABELS[u.department] || u.department}
                      </span>
                    )}
                    {u.role === 'user' && (
                      <span className="px-3 py-1 rounded-lg bg-white/5 text-[10px] font-bold uppercase tracking-widest text-secondary border border-border">
                        Անդամ
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {displayedUsers.length === 0 && (
              <div className="col-span-full py-20 text-center text-secondary italic">
                {activeTab === 'staff' ? 'Ադմինիստրատորներ' : 'Օգտատերեր'} չեն գտնվել:
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'events' && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">Միջոցառումներ</h2>
              <p className="text-secondary text-sm font-medium">Կառավարեք գլոբալ միջոցառումները և դասընթացները</p>
            </div>
            <button
              onClick={() => setIsEventModalOpen(true)}
              className="minimal-button-primary flex items-center justify-center gap-2 px-6"
            >
              <Plus size={20} /> Ստեղծել Միջոցառում
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {events.map(event => (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => openEditEvent(event)}
                  className="minimal-card flex flex-col group cursor-pointer hover:border-primary/30 transition-all"
                >
                  <div className="h-48 overflow-hidden relative rounded-xl mb-4">
                    <img src={event.image} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEvent(event.id);
                        }} 
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors backdrop-blur-md"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <span className="absolute bottom-2 left-2 px-3 py-1 rounded-lg bg-bg/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20">
                      {event.type === 'Seminar' ? 'Սեմինար' : event.type === 'Volunteering' ? 'Կամավորություն' : 'Միջոցառում'}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold">{event.title}</h3>
                      {event.price ? (
                        <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-lg whitespace-nowrap ml-2 border border-yellow-500/20">
                          🪙 {event.price}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-secondary mb-4 line-clamp-2">{event.description}</p>
                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                      <div className="flex items-center text-[10px] font-bold uppercase tracking-widest text-secondary">
                        <Calendar size={12} className="mr-2" />
                        {new Date(event.date).toLocaleDateString('hy-AM')}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAttendanceEvent(event);
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-green-400 transition-colors"
                          title="Հաճախելիություն"
                        >
                          <Users size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditEvent(event);
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-primary transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {events.length === 0 && (
              <div className="col-span-full py-20 text-center text-secondary italic">
                Միջոցառումներ դեռ չկան:
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'applications' && (
        <>
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-3xl font-bold mb-2">Բոլոր Հայտերը</h2>
              <p className="text-secondary text-sm font-medium">Վերանայեք և կառավարեք օգտատերերի հայտերը</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-[10px] font-bold uppercase tracking-widest text-secondary">
              <Users size={14} />
              <span>Գտնվել է {filteredApplications.length} հայտ</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="minimal-card p-6 mb-8 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                <input
                  type="text"
                  placeholder="Փնտրել ըստ անվան, էլ. փոստի..."
                  value={appFilters.search}
                  onChange={(e) => setAppFilters({ ...appFilters, search: e.target.value })}
                  className="w-full minimal-input pl-10 pr-4 py-2.5 text-sm"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-secondary" />
                <select
                  value={appFilters.eventId}
                  onChange={(e) => setAppFilters({ ...appFilters, eventId: e.target.value })}
                  className="minimal-input py-2.5 text-xs w-auto"
                >
                  <option value="all">Բոլոր Միջոցառումները</option>
                  {events.map(e => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={appFilters.status}
                  onChange={(e) => setAppFilters({ ...appFilters, status: e.target.value })}
                  className="minimal-input py-2.5 text-xs w-auto"
                >
                  <option value="all">Բոլոր Կարգավիճակները</option>
                  <option value="pending">Սպասող</option>
                  <option value="approved">Ընդունված</option>
                  <option value="rejected">Մերժված</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={appFilters.role}
                  onChange={(e) => setAppFilters({ ...appFilters, role: e.target.value })}
                  className="minimal-input py-2.5 text-xs w-auto"
                >
                  <option value="all">Բոլոր Կատեգորիաները</option>
                  {DEPARTMENTS.map(dep => (
                    <option key={dep} value={dep}>{DEPARTMENT_LABELS[dep] || dep}</option>
                  ))}
                  <option value="user">Ընդհանուր Օգտատերեր</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Clock size={16} className="text-secondary" />
                <select
                  value={appFilters.dateRange}
                  onChange={(e) => setAppFilters({ ...appFilters, dateRange: e.target.value })}
                  className="minimal-input py-2.5 text-xs w-auto"
                >
                  <option value="all">Ցանկացած Ժամանակ</option>
                  <option value="today">Այսօր</option>
                  <option value="week">Վերջին 7 Օրը</option>
                  <option value="month">Վերջին 30 Օրը</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown size={16} className="text-secondary" />
                <select
                  value={appFilters.sort}
                  onChange={(e) => setAppFilters({ ...appFilters, sort: e.target.value as any })}
                  className="minimal-input py-2.5 text-xs w-auto"
                >
                  <option value="newest">Նորերը սկզբում</option>
                  <option value="oldest">Հները սկզբում</option>
                </select>
              </div>

              <button 
                onClick={() => setAppFilters({ eventId: 'all', status: 'all', search: '', role: 'all', dateRange: 'all', sort: 'newest' })}
                className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors underline underline-offset-4"
              >
                Մաքրել Ֆիլտրերը
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredApplications.map(app => {
                const appUser = users.find(u => u.id === app.userId);
                const appEvent = events.find(e => e.id === app.eventId);
                
                if (!appUser || !appEvent) return null;

                return (
                  <motion.div
                    key={app.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="minimal-card p-6 flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={appUser.image} alt={appUser.name} className="w-12 h-12 rounded-full border border-border" />
                        <div>
                          <div className="font-bold text-sm">{appUser.name}</div>
                          <div className="text-[10px] text-secondary uppercase tracking-widest">@{appUser.username}</div>
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${
                        app.status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                        app.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                      }`}>
                        {app.status === 'approved' ? 'Ընդունված' : app.status === 'rejected' ? 'Մերժված' : 'Սպասող'}
                      </div>
                    </div>

                    {appUser.phone && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-primary" />
                          <a href={`tel:${appUser.phone}`} className="text-sm font-bold text-white hover:underline">
                            {appUser.phone}
                          </a>
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(appUser.phone);
                            toast.success('Համարը պատճենվեց');
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-secondary"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    )}

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                      <div className="font-bold text-sm mb-1">{appEvent.title}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-primary uppercase tracking-widest font-bold">{appEvent.type}</div>
                        <div className="text-[10px] text-secondary font-bold">{new Date(app.appliedAt).toLocaleDateString('hy-AM')}</div>
                      </div>
                    </div>

                    {app.paymentRequired && app.paymentRequired > 0 && (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-orange-500 bg-orange-500/5 p-2 rounded-lg border border-orange-500/10 text-center">
                        Վճարելու է իրական գումար
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      {app.status === 'pending' && approvingAppId !== app.id && (
                        <>
                          <button 
                            onClick={() => setApprovingAppId(app.id)}
                            className="flex-1 py-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-500 transition-colors font-bold text-xs flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={16} /> Ընդունել
                          </button>
                          <button 
                            onClick={() => updateApplicationStatus(app.id, 'rejected')}
                            className="flex-1 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors font-bold text-xs flex items-center justify-center gap-2"
                          >
                            <XCircle size={16} /> Մերժել
                          </button>
                        </>
                      )}
                      {approvingAppId === app.id && (
                        <div className="w-full flex flex-col gap-2">
                          <input
                            type="text"
                            placeholder="Telegram Խմբի Հղում"
                            value={telegramLink}
                            onChange={(e) => setTelegramLink(e.target.value)}
                            className="minimal-input py-3 text-sm w-full"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                updateApplicationStatus(app.id, 'approved', telegramLink);
                                setApprovingAppId(null);
                                setTelegramLink('');
                                toast.success('Հայտը ընդունված է');
                              }}
                              className="flex-1 minimal-button-primary py-3 text-xs"
                            >
                              Հաստատել
                            </button>
                            <button
                              onClick={() => {
                                setApprovingAppId(null);
                                setTelegramLink('');
                              }}
                              className="p-3 rounded-xl bg-white/5 text-secondary hover:text-primary"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {filteredApplications.length === 0 && (
              <div className="col-span-full py-20 text-center text-secondary italic">
                Հայտեր չեն գտնվել:
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'certificates' && renderCertificatesTab()}
      </div>

      {/* Bottom Navigation (Mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-xl border-t border-border px-4 py-2 z-50 flex justify-between items-center overflow-x-auto no-scrollbar">
        <div className="flex min-w-full justify-between items-center gap-1">
          {user?.role === 'superadmin' && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-all ${activeTab === 'staff' ? 'text-primary' : 'text-secondary'}`}
            >
              <div className={`p-2 rounded-xl transition-all ${activeTab === 'staff' ? 'bg-primary/10' : ''}`}>
                <Shield size={20} />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-widest">Անձնակազմ</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('users')}
            className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-all ${activeTab === 'users' ? 'text-primary' : 'text-secondary'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${activeTab === 'users' ? 'bg-primary/10' : ''}`}>
              <Users size={20} />
            </div>
            <span className="text-[8px] font-bold uppercase tracking-widest">Օգտատերեր</span>
          </button>
          
          {user?.role === 'superadmin' && (
            <>
              <button
                onClick={() => setActiveTab('events')}
                className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-all ${activeTab === 'events' ? 'text-primary' : 'text-secondary'}`}
              >
                <div className={`p-2 rounded-xl transition-all ${activeTab === 'events' ? 'bg-primary/10' : ''}`}>
                  <Calendar size={20} />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest">Միջոցառումներ</span>
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-all ${activeTab === 'applications' ? 'text-primary' : 'text-secondary'}`}
              >
                <div className={`p-2 rounded-xl transition-all ${activeTab === 'applications' ? 'bg-primary/10' : ''}`}>
                  <CheckCircle size={20} />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-widest">Հայտեր</span>
              </button>
            </>
          )}

          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('department')}
              className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-all ${activeTab === 'department' ? 'text-primary' : 'text-secondary'}`}
            >
              <div className={`p-2 rounded-xl transition-all ${activeTab === 'department' ? 'bg-primary/10' : ''}`}>
                <Settings size={20} />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-widest">Բաժին</span>
            </button>
          )}

          {user?.role === 'superadmin' && (
            <button
              onClick={() => setActiveTab('certificates')}
              className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-all ${activeTab === 'certificates' ? 'text-primary' : 'text-secondary'}`}
            >
              <div className={`p-2 rounded-xl transition-all ${activeTab === 'certificates' ? 'bg-primary/10' : ''}`}>
                <Award size={20} />
              </div>
              <span className="text-[8px] font-bold uppercase tracking-widest">Սերտիֆիկատ</span>
            </button>
          )}
        </div>
      </nav>

      {/* User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-panel w-full max-w-md rounded-3xl p-8 relative z-10 shadow-2xl border border-white/10"
            >
              <button onClick={closeModal} className="absolute top-6 right-6 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                {editingId ? 'Խմբագրել' : 'Ավելացնել Նոր'} {activeTab === 'staff' ? 'Ադմին' : 'Օգտատեր'}
              </h2>
              
              <form onSubmit={handleUserSubmit} className="space-y-5">
                <div className="flex justify-center mb-6">
                  <label className="relative cursor-pointer group">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-purple-500/50 flex items-center justify-center bg-white/5 overflow-hidden group-hover:border-purple-400 transition-colors">
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="text-purple-400/50" size={32} />
                      )}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false)} />
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-white font-medium">Բեռնել</span>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Օգտանուն (մուտքի համար)</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                    placeholder="օր. johndoe"
                    disabled={!!editingId}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Ամբողջական Անուն</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                    placeholder="օր. John Doe"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Էլ. Փոստ</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Հեռախոս</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                </div>

                {activeTab === 'staff' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Բաժին</label>
                    <select
                      value={formData.department}
                      onChange={e => setFormData({...formData, department: e.target.value})}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm appearance-none bg-slate-800/50"
                    >
                      {DEPARTMENTS.map(dep => (
                        <option key={dep} value={dep} className="bg-slate-900 text-white">{DEPARTMENT_LABELS[dep] || dep}</option>
                      ))}
                    </select>
                  </div>
                )}

                {!editingId && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Գաղտնաբառ (ըստ ցանկության)</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                      placeholder="••••••••"
                    />
                    <p className="text-[10px] text-gray-500 mt-1 ml-1">
                      Եթե դատարկ թողնեք, նրանք կառաջարկվեն ստեղծել իրենց գաղտնաբառը առաջին մուտքի ժամանակ:
                    </p>
                  </div>
                )}

                {!editingId && !formData.password && (
                  <div className="text-xs text-purple-300 bg-purple-500/10 p-3 rounded-lg border border-purple-500/20">
                    Նշում. Նրանք կառաջարկվեն ստեղծել իրենց սեփական գաղտնաբառը առաջին մուտքի ժամանակ:
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-lg"
                >
                  {editingId ? 'Պահպանել Փոփոխությունները' : `Ստեղծել ${activeTab === 'staff' ? 'Ադմին' : 'Օգտատեր'}`}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Modal */}
      <AnimatePresence>
        {isEventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={closeEventModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-panel w-full max-w-md rounded-3xl p-8 relative z-10 shadow-2xl border border-white/10"
            >
              <button onClick={closeEventModal} className="absolute top-6 right-6 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                {selectedEvent ? 'Խմբագրել Միջոցառումը' : 'Ստեղծել Միջոցառում'}
              </h2>
              
              <form onSubmit={handleEventSubmit} className="space-y-4">
                <div className="flex justify-center mb-2">
                  <label className="relative cursor-pointer group w-full h-32">
                    <div className="w-full h-full rounded-xl border-2 border-dashed border-purple-500/50 flex items-center justify-center bg-white/5 overflow-hidden group-hover:border-purple-400 transition-colors">
                      {eventData.image ? (
                        <img src={eventData.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center text-purple-400/50">
                          <ImageIcon className="mx-auto mb-2" size={24} />
                          <span className="text-xs">Բեռնել Շապիկի Նկարը</span>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true)} />
                  </label>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Միջոցառման Վերնագիր</label>
                  <input
                    type="text"
                    value={eventData.title}
                    onChange={e => setEventData({...eventData, title: e.target.value})}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                    placeholder="օր. Tech Conference 2026"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Տեսակ</label>
                    <select
                      value={eventData.type}
                      onChange={e => setEventData({...eventData, type: e.target.value})}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm appearance-none bg-slate-800/50"
                      disabled={user?.department === 'Seminar' || user?.department === 'Volunteering'}
                    >
                      {EVENT_TYPES.map(type => (
                        <option key={type} value={type} className="bg-slate-900 text-white">{EVENT_TYPE_LABELS[type] || type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Ամսաթիվ</label>
                    <input
                      type="date"
                      value={eventData.date}
                      onChange={e => {
                        const newDate = e.target.value;
                        setEventData({
                          ...eventData, 
                          date: newDate,
                          registrationDeadline: eventData.registrationDeadline || newDate
                        });
                      }}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm [color-scheme:dark]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Գրանցման Վերջնաժամկետ (Լռելյայն՝ միջոցառման օրը)</label>
                  <input
                    type="date"
                    value={eventData.registrationDeadline}
                    onChange={e => setEventData({...eventData, registrationDeadline: e.target.value})}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm [color-scheme:dark]"
                  />
                </div>

                {eventData.type === 'Seminar' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Գին (FZ Coins)</label>
                    <input
                      type="number"
                      min="0"
                      value={eventData.price}
                      onChange={e => setEventData({...eventData, price: parseInt(e.target.value) || 0})}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm"
                      placeholder="0"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Նկարագրություն</label>
                  <textarea
                    value={eventData.description}
                    onChange={e => setEventData({...eventData, description: e.target.value})}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm resize-none h-24"
                    placeholder="Նկարագրեք միջոցառումը..."
                    required
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-lg"
                >
                  {selectedEvent ? 'Պահպանել Փոփոխությունները' : 'Ստեղծել Միջոցառում'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Volunteers Modal */}
      <AnimatePresence>
        {selectedEventForVolunteers && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setSelectedEventForVolunteers(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-panel w-full max-w-4xl max-h-[80vh] flex flex-col rounded-3xl p-8 relative z-10 shadow-2xl border border-white/10"
            >
              <button onClick={() => setSelectedEventForVolunteers(null)} className="absolute top-6 right-6 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
              
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                    Կամավորներ՝ {selectedEventForVolunteers.title}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Կառավարեք հաճախելիությունը և բաշխեք մետաղադրամները</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Փնտրել կամավորներին..."
                      value={volunteerSearch}
                      onChange={(e) => setVolunteerSearch(e.target.value)}
                      className="glass-input rounded-xl pl-9 pr-4 py-2 text-sm w-64"
                    />
                  </div>
                  {selectedEventForVolunteers.type !== 'Seminar' && (
                    <>
                      {!selectedEventForVolunteers.coinsAwarded && (
                        <button
                          onClick={() => handleDistributeCoins(selectedEventForVolunteers)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold shadow-lg hover:shadow-orange-500/25 transition-all"
                        >
                          <span className="text-lg">🪙</span> Բաշխել 1000 FZ Coins
                        </button>
                      )}
                      {selectedEventForVolunteers.coinsAwarded && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30">
                          <CheckCircle size={16} /> Մետաղադրամները Բաշխված են
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-gray-400 sticky top-0 backdrop-blur-md z-10">
                    <tr>
                      <th className="px-6 py-4 font-medium rounded-tl-xl">Կամավոր</th>
                      <th className="px-6 py-4 font-medium">Հեռախոս</th>
                      <th className="px-6 py-4 font-medium">Կարգավիճակ</th>
                      <th className="px-6 py-4 font-medium">Հաճախելիություն</th>
                      <th className="px-6 py-4 font-medium text-right rounded-tr-xl">Գործողություններ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {applications
                      .filter(app => {
                        if (app.eventId !== selectedEventForVolunteers.id) return false;
                        if (volunteerSearch) {
                          const q = volunteerSearch.toLowerCase();
                          const appUser = users.find(u => u.id === app.userId);
                          return appUser?.name.toLowerCase().includes(q) || appUser?.username.toLowerCase().includes(q);
                        }
                        return true;
                      })
                      .map(app => {
                        const appUser = users.find(u => u.id === app.userId);
                        if (!appUser) return null;

                        return (
                          <tr key={app.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={appUser.image} alt={appUser.name} className="w-8 h-8 rounded-full bg-slate-800" />
                                <div>
                                  <div className="font-medium text-white">{appUser.name}</div>
                                  <div className="text-xs text-gray-400">@{appUser.username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {appUser.phone ? (
                                <div className="flex items-center gap-2">
                                  <a 
                                    href={`tel:${appUser.phone}`}
                                    className="text-primary hover:underline flex items-center gap-1.5 font-medium"
                                  >
                                    <Phone size={12} />
                                    {appUser.phone}
                                  </a>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(appUser.phone);
                                      toast.success('Համարը պատճենվեց');
                                    }}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-secondary transition-colors"
                                    title="Պատճենել"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-500 italic text-xs">Նշված չէ</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs border ${
                                app.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                app.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                              }`}>
                                {app.status === 'approved' ? 'ՀԱՍՏԱՏՎԱԾ' : app.status === 'rejected' ? 'ՄԵՐԺՎԱԾ' : 'ՍՊԱՍՈՂ'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {app.status === 'approved' && (
                                <button
                                  onClick={() => updateApplicationStatus(app.id, 'approved', app.telegramLink, app.attended === false ? true : false)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    app.attended !== false 
                                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  }`}
                                  disabled={selectedEventForVolunteers.coinsAwarded}
                                >
                                  {app.attended !== false ? 'Հաճախել է' : 'Չի հաճախել'}
                                </button>
                              )}
                              {app.status !== 'approved' && (
                                <span className="text-gray-500 text-xs italic">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => {
                                  removeApplication(app.id);
                                  toast.success('Կամավորը հեռացվեց');
                                }}
                                className="p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                title="Հեռացնել Կամավորին"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {applications.filter(app => app.eventId === selectedEventForVolunteers.id).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          Այս միջոցառման համար կամավորներ չեն գտնվել:
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Coin Adjustment Modal */}
      <AnimatePresence>
        {isCoinModalOpen && selectedUserForCoins && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCoinModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[2.5rem] shadow-2xl"
            >
              <button
                onClick={() => setIsCoinModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-r from-yellow-500 to-orange-500 mx-auto mb-4">
                  <img src={selectedUserForCoins.image} alt={selectedUserForCoins.name} className="w-full h-full rounded-full object-cover border-4 border-slate-900" />
                </div>
                <h2 className="text-2xl font-bold text-white">Փոփոխել Մետաղադրամները</h2>
                <p className="text-gray-400">{selectedUserForCoins.name}-ի համար</p>
                <div className="mt-2 text-yellow-400 font-bold flex items-center justify-center gap-2">
                  <span>Ընթացիկ Հաշվեկշիռ՝</span>
                  <span>🪙 {selectedUserForCoins.fzCoins || 0}</span>
                </div>
              </div>

              <form onSubmit={handleCoinAdjustment} className="space-y-6">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setCoinAdjustment({ ...coinAdjustment, type: 'add' })}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${coinAdjustment.type === 'add' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'bg-white/5 text-gray-400'}`}
                  >
                    Ավելացնել
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinAdjustment({ ...coinAdjustment, type: 'subtract' })}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${coinAdjustment.type === 'subtract' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white/5 text-gray-400'}`}
                  >
                    Հանել
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Քանակ</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🪙</span>
                      <input
                        type="number"
                        value={coinAdjustment.amount || ''}
                        onChange={(e) => setCoinAdjustment({ ...coinAdjustment, amount: Number(e.target.value) })}
                        className="w-full glass-input rounded-2xl pl-12 pr-4 py-3 text-lg font-bold"
                        placeholder="0"
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Պատճառ / Նշում</label>
                    <textarea
                      value={coinAdjustment.reason}
                      onChange={(e) => setCoinAdjustment({ ...coinAdjustment, reason: e.target.value })}
                      className="w-full glass-input rounded-2xl px-4 py-3 text-sm h-24 resize-none"
                      placeholder="օր. Բոնուս լրացուցից օգնության համար, Սխալի ուղղում..."
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-xl hover:shadow-purple-500/25 transition-all"
                >
                  Հաստատել Փոփոխությունը
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Attendance Modal */}
      <AnimatePresence>
        {selectedAttendanceEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAttendanceEvent(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass p-8 rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedAttendanceEvent(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Մասնակիցների Ցուցակ</h2>
                <p className="text-gray-400">{selectedAttendanceEvent.title}</p>
              </div>

              <div className="space-y-4">
                {applications
                  .filter(a => a.eventId === selectedAttendanceEvent.id && a.status === 'approved')
                  .map(app => {
                    const participant = users.find(u => u.id === app.userId);
                    return (
                      <div key={app.id} className="flex items-center justify-between p-4 glass rounded-2xl">
                        <div className="flex items-center gap-4">
                          <img 
                            src={participant?.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'} 
                            alt="" 
                            className="w-10 h-10 rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-bold text-white">{participant?.name || 'Անհայտ'}</div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-gray-400">@{participant?.username}</div>
                              {participant?.phone && (
                                <>
                                  <span className="text-gray-600">•</span>
                                  <div className="flex items-center gap-2">
                                    <a 
                                      href={`tel:${participant.phone}`}
                                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                    >
                                      <Phone size={10} />
                                      {participant.phone}
                                    </a>
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(participant.phone);
                                        toast.success('Համարը պատճենվեց');
                                      }}
                                      className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-secondary transition-colors"
                                    >
                                      <Copy size={10} />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAttendanceToggle(app.id, true)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${app.attended === true ? 'bg-green-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                          >
                            Ներկա ✅
                          </button>
                          <button
                            onClick={() => handleAttendanceToggle(app.id, false)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${app.attended === false ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                          >
                            Բացակա ❌
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {applications.filter(a => a.eventId === selectedAttendanceEvent.id && a.status === 'approved').length === 0 && (
                  <div className="text-center py-12 text-gray-500 italic">
                    Հաստատված հայտեր չկան:
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Template Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[2.5rem] shadow-2xl"
            >
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="text-2xl font-bold text-white mb-6">Ավելացնել Ձևանմուշ</h2>

              <form onSubmit={handleTemplateSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Անվանում</label>
                  <input
                    type="text"
                    value={templateData.name}
                    onChange={(e) => setTemplateData({ ...templateData, name: e.target.value })}
                    className="w-full glass-input rounded-2xl px-4 py-3 text-sm"
                    placeholder="օր. Կամավորության Սերտիֆիկատ"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Նկարագրություն</label>
                  <textarea
                    value={templateData.description}
                    onChange={(e) => setTemplateData({ ...templateData, description: e.target.value })}
                    className="w-full glass-input rounded-2xl px-4 py-3 text-sm h-24 resize-none"
                    placeholder="Հակիրճ նկարագրություն..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Ձևանմուշի Նկար (A4 Landscape)</label>
                  <div className="relative group">
                    <input
                      type="file"
                      onChange={handleTemplateImageUpload}
                      className="hidden"
                      id="template-image"
                      accept="image/*"
                    />
                    <label
                      htmlFor="template-image"
                      className="flex flex-col items-center justify-center w-full h-40 glass rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/50 transition-all cursor-pointer overflow-hidden"
                    >
                      {templateData.imageUrl ? (
                        <img src={templateData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <ImageIcon className="text-gray-400 mb-2" size={32} />
                          <span className="text-xs text-gray-400">Ընտրել նկար</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-primary text-bg font-bold shadow-xl hover:shadow-primary/25 transition-all"
                >
                  Պահպանել Ձևանմուշը
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
