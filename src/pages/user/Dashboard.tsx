import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Calendar, CheckCircle, Clock, XCircle, Search, Award, Megaphone, Download, Users, Menu, X, Info, Video, MapPin, ExternalLink, Shirt } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Logo } from '../../components/Logo';

const EVENT_TYPE_LABELS: Record<string, string> = {
  'Seminar': 'Սեմինար',
  'Volunteering': 'Կամավորություն',
  'Event': 'Միջոցառում'
};

const DEPARTMENT_LABELS: Record<string, string> = {
  'Certificate': 'Սերտիֆիկատ',
  'Volunteering': 'Կամավորություն',
  'Seminar': 'Սեմինար',
  'SMM': 'SMM',
  'Engineering': 'Ինժեներիա'
};

export default function UserDashboard() {
  const { logout, user, users, updateUser } = useAuth();
  const { events, applications, applyForEvent, certificates, announcements } = useData();
  const [activeTab, setActiveTab] = useState<'explore' | 'applications' | 'certificates' | 'announcements' | 'directory'>('explore');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<any | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<number>(0);
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);

  const handleApplyClick = (eventId: string) => {
    if (processingEventId) return;
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const price = event.price || 0;
    const userCoins = user?.fzCoins || 0;

    if (price > 0 && userCoins < price) {
      setPendingEventId(eventId);
      setPendingPayment(price - userCoins);
      setPaymentModalOpen(true);
    } else {
      processApplication(eventId);
    }
  };

  const processApplication = async (eventId: string) => {
    if (processingEventId || !user) return;
    setProcessingEventId(eventId);
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) throw new Error('Միջոցառումը չի գտնվել');

      const price = event.price || 0;
      
      await applyForEvent(eventId, user.id, price);
      
      if (price > 0) {
        toast.success(`Գրանցումը հաջողությամբ կատարվեց: ${price} FZ Coin գանձվեց:`);
      } else {
        toast.success('Գրանցումը հաջողությամբ կատարվեց:');
      }
    } catch (error: any) {
      let message = error.message;
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) message = parsed.error;
      } catch (e) {
        // Not a JSON error
      }
      toast.error(message);
    } finally {
      setProcessingEventId(null);
      setPaymentModalOpen(false);
      setPendingEventId(null);
    }
  };

  const userApplications = applications;
  const userCertificates = certificates;
  const allUsers = users;
  
  const displayedUsers = allUsers.filter(u => {
    if (u.id === user?.id) return false;
    if (!searchQuery) return true;
    
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q))
    );
  });

  const downloadCertificate = async (cert: any) => {
    try {
      if (cert.templateData && cert.templateData.startsWith('data:application/pdf')) {
        const existingPdfBytes = await fetch(cert.templateData).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const nameText = user?.name || 'Օգտատեր';
        const fontSize = 36;
        const textWidth = font.widthOfTextAtSize(nameText, fontSize);
        
        firstPage.drawText(nameText, {
          x: (width / 2) - (textWidth / 2),
          y: height / 2,
          size: fontSize,
          font: font,
          color: rgb(0.1, 0.1, 0.3),
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Certificate_${cert.title.replace(/\s+/g, '_')}.pdf`;
        link.click();
        toast.success('Սերտիֆիկատը հաջողությամբ ներբեռնվեց:');
        return;
      }

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      if (cert.templateData && cert.templateData.startsWith('data:image/')) {
        doc.addImage(cert.templateData, 'JPEG', 0, 0, 297, 210);
      } else {
        doc.setFillColor(245, 247, 250);
        doc.rect(0, 0, 297, 210, 'F');
        doc.setDrawColor(100, 100, 250);
        doc.setLineWidth(2);
        doc.rect(10, 10, 277, 190);
        doc.setLineWidth(0.5);
        doc.rect(12, 12, 273, 186);
      }

      if (cert.isMandatory) {
        doc.setFontSize(12);
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'bold');
        doc.text('Սա պարտադիր սերտիֆիկատ է', 148.5, 22, { align: 'center' });
      }

      if (!cert.templateData) {
        doc.setFillColor(0, 0, 0);
        doc.circle(148.5, 40, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('FUN ZONE', 148.5, 41.5, { align: 'center' });
      }

      doc.setTextColor(50, 50, 100);
      doc.setFontSize(36);
      doc.setFont('helvetica', 'bold');
      if (cert.type === 'Seminar') {
        doc.text('ՍԵՄԻՆԱՐԻ ՍԵՐՏԻՖԻԿԱՏ', 148.5, 70, { align: 'center' });
      } else {
        doc.text('ՁԵՌՔԲԵՐՄԱՆ ՍԵՐՏԻՖԻԿԱՏ', 148.5, 70, { align: 'center' });
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Սույնով հավաստվում է, որ', 148.5, 95, { align: 'center' });

      doc.setFontSize(36);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 80);
      doc.text(user?.name || 'Օգտատեր', 148.5, 115, { align: 'center' });

      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      if (cert.type === 'Seminar') {
        doc.text('հաջողությամբ մասնակցել և ավարտել է սեմինարը', 148.5, 135, { align: 'center' });
      } else {
        doc.text('հաջողությամբ կատարել է պահանջները', 148.5, 135, { align: 'center' });
      }

      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 150);
      doc.text(cert.title, 148.5, 155, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      const dateStr = new Date(cert.issuedAt).toLocaleDateString('hy-AM');
      doc.text(`Տրված է՝ ${dateStr}`, 50, 180, { align: 'center' });
      doc.text(`Սերտիֆիկատի ID՝ ${cert.id.toUpperCase()}`, 247, 180, { align: 'center' });

      doc.save(`Certificate_${cert.title.replace(/\s+/g, '_')}.pdf`);
      toast.success('Սերտիֆիկատը հաջողությամբ ներբեռնվեց:');
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.error('Չհաջողվեց ստեղծել PDF');
    }
  };

  const tabs = [
    { id: 'explore', icon: Search, label: 'Միջոցառումներ' },
    { id: 'applications', icon: CheckCircle, label: 'Իմ Հայտերը', count: userApplications.length },
    { id: 'certificates', icon: Award, label: 'Սերտիֆիկատներ' },
    { id: 'announcements', icon: Megaphone, label: 'Հայտարարություններ' },
    { id: 'directory', icon: Users, label: 'Օգտատերեր' }
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col pb-20 lg:pb-0">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Logo className="w-10 h-10 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tighter">FunZone Group</h1>
              <p className="text-[10px] text-secondary font-medium uppercase tracking-widest">Բարի գալուստ, {user?.name.split(' ')[0]}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-primary font-bold text-sm">
              <span className="text-yellow-500">🪙</span>
              <span>{user?.fzCoins || 0}</span>
            </div>
            
            <button 
              onClick={logout}
              className="hidden sm:flex minimal-button-secondary py-2 px-4 items-center gap-2"
            >
              <LogOut size={16} /> Ելք
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation (Desktop) */}
        <aside className="hidden lg:block w-64 flex-shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-primary text-bg' : 'text-secondary hover:text-primary hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <tab.icon size={18} />
                <span className="text-sm font-medium">{tab.label}</span>
              </div>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-bg text-primary' : 'bg-white/10 text-primary'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-500/5 transition-colors text-sm font-medium mt-4"
          >
            <LogOut size={18} /> Ելք
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'explore' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {events.map((event) => {
                const hasApplied = applications.some(a => a.eventId === event.id && a.userId === user?.id);
                const deadline = event.registrationDeadline || event.date;
                const today = new Date().toISOString().split('T')[0];
                const isPastDeadline = today > deadline;
                const canRegister = !hasApplied && !isPastDeadline;

                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="minimal-card flex flex-col h-full p-0 overflow-hidden"
                  >
                    <div className="h-48 relative overflow-hidden">
                      <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                      <div className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white border border-white/10">
                        {event.type === 'Seminar' ? 'Սեմինար' : event.type === 'Volunteering' ? 'Կամավորություն' : 'Միջոցառում'}
                      </div>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h3 className="text-xl font-bold leading-tight">{event.title}</h3>
                        {event.price ? (
                          <span className="flex-shrink-0 flex items-center gap-1 text-yellow-500 font-bold bg-yellow-500/5 px-2 py-1 rounded-lg text-xs border border-yellow-500/10">
                            🪙 {event.price}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center text-xs text-secondary mb-2">
                        <Calendar size={14} className="mr-2" />
                        {new Date(event.date).toLocaleDateString('hy-AM', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                      
                      {event.registrationDeadline && event.registrationDeadline !== event.date && (
                        <div className={`text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 ${isPastDeadline ? 'text-red-500' : 'text-orange-500'}`}>
                          <Clock size={12} />
                          Գրանցման վերջնաժամկետ՝ {new Date(event.registrationDeadline).toLocaleDateString('hy-AM')}
                        </div>
                      )}

                      <p className="text-sm text-secondary mb-6 flex-1 line-clamp-3">{event.description}</p>
                      
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setSelectedEventForDetails(event)}
                          className="w-full py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 bg-white/5 text-primary border border-primary/20 hover:bg-primary/10"
                        >
                          <Info size={14} /> Մանրամասներ
                        </button>
                        
                        <button
                          onClick={() => canRegister && !processingEventId && handleApplyClick(event.id)}
                          disabled={!canRegister || !!processingEventId}
                          className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                            !canRegister || !!processingEventId
                              ? 'bg-white/5 text-secondary cursor-not-allowed border border-border' 
                              : 'minimal-button-primary'
                          }`}
                        >
                          {processingEventId === event.id ? (
                            'Մշակվում է...'
                          ) : hasApplied ? (
                            <><CheckCircle size={18} /> Գրանցված է</>
                          ) : isPastDeadline ? (
                            <><XCircle size={18} /> Գրանցումը փակ է</>
                          ) : (
                            'Գրանցվել Հիմա'
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {events.length === 0 && (
                <div className="col-span-full py-20 text-center text-secondary font-medium italic">
                  Միջոցառումներ չկան այս պահին:
                </div>
              )}
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userApplications.map(app => {
                const appEvent = events.find(e => e.id === app.eventId);
                if (!appEvent) return null;

                return (
                  <motion.div
                    key={app.id}
                    layout
                    className="minimal-card p-4 flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <img src={appEvent.image} alt={appEvent.title} className="w-16 h-16 rounded-2xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-lg truncate">{appEvent.title}</div>
                        <div className="text-[10px] text-secondary uppercase tracking-widest font-bold">
                          {EVENT_TYPE_LABELS[appEvent.type] || appEvent.type}
                        </div>
                        <div className="flex items-center text-xs text-secondary mt-1">
                          <Calendar size={12} className="mr-1" />
                          {new Date(appEvent.date).toLocaleDateString('hy-AM')}
                        </div>
                        {appEvent.isOnline ? (
                          <div className="flex items-center text-[10px] text-primary mt-1 font-bold">
                            <Video size={10} className="mr-1" /> Օնլայն
                          </div>
                        ) : appEvent.location && (
                          <div className="flex items-center text-[10px] text-secondary mt-1 truncate">
                            <MapPin size={10} className="mr-1" /> {appEvent.location}
                          </div>
                        )}
                      </div>
                    </div>

                    {app.status === 'approved' && appEvent.isOnline && appEvent.meetingLink && (
                      <a 
                        href={appEvent.meetingLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-primary/10 text-primary font-bold text-[10px] border border-primary/20 hover:bg-primary/20 transition-all"
                      >
                        <ExternalLink size={12} /> Միանալ Հանդիպմանը
                      </a>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${
                        app.status === 'approved' ? 'bg-green-500/5 text-green-500 border-green-500/20' :
                        app.status === 'rejected' ? 'bg-red-500/5 text-red-500 border-red-500/20' :
                        'bg-yellow-500/5 text-yellow-500 border-yellow-500/20'
                      }`}>
                        {app.status === 'approved' ? 'Հաստատված' : app.status === 'rejected' ? 'Մերժված' : 'Սպասման մեջ'}
                      </div>
                      
                      {app.paymentRequired && app.paymentRequired > 0 && (
                        <div className="text-[10px] text-orange-500 font-bold uppercase tracking-widest bg-orange-500/5 px-2 py-1 rounded-lg border border-orange-500/10">
                          Տեղում վճարում
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {userApplications.length === 0 && (
                <div className="col-span-full py-20 text-center text-secondary italic">
                  Դուք դեռ չունեք հայտեր:
                </div>
              )}
            </div>
          )}

          {activeTab === 'certificates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {userCertificates.map((cert) => (
                <motion.div
                  key={cert.id}
                  layout
                  className="minimal-card flex flex-col items-center text-center group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Award size={32} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">{cert.title}</h3>
                  <p className="text-xs text-secondary mb-6">Տրված է՝ {new Date(cert.issuedAt).toLocaleDateString('hy-AM')}</p>
                  
                  <button
                    onClick={() => downloadCertificate(cert)}
                    className="minimal-button-primary w-full flex items-center justify-center gap-2"
                  >
                    <Download size={16} /> Ներբեռնել PDF
                  </button>

                  <div className="mt-6 pt-4 border-t border-border w-full">
                    <span className="text-[10px] text-secondary font-mono tracking-widest">ID: {cert.id.toUpperCase()}</span>
                  </div>
                </motion.div>
              ))}
              {userCertificates.length === 0 && (
                <div className="col-span-full py-20 text-center text-secondary italic">
                  Դուք դեռ չունեք սերտիֆիկատներ:
                </div>
              )}
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="max-w-3xl space-y-6">
              {announcements.map((ann) => (
                <motion.div
                  key={ann.id}
                  layout
                  className="minimal-card"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center">
                      <Megaphone size={20} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{ann.title}</h3>
                      <p className="text-[10px] text-secondary uppercase tracking-widest font-bold">{new Date(ann.date).toLocaleString('hy-AM')}</p>
                    </div>
                  </div>
                  <p className="text-secondary leading-relaxed whitespace-pre-wrap text-sm">{ann.content}</p>
                </motion.div>
              ))}
              {announcements.length === 0 && (
                <div className="py-20 text-center text-secondary italic">
                  Հայտարարություններ չկան:
                </div>
              )}
            </div>
          )}

          {activeTab === 'directory' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                  <input
                    type="text"
                    placeholder="Փնտրել օգտատեր..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="minimal-input pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {displayedUsers.map((u) => (
                  <motion.div
                    key={u.id}
                    layout
                    className="minimal-card flex flex-col items-center text-center"
                  >
                    <div className="w-20 h-20 rounded-full p-0.5 border border-border mb-4">
                      <img src={u.image} alt={u.name} className="w-full h-full rounded-full object-cover bg-surface" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">{u.name}</h3>
                    <p className="text-xs text-secondary mb-4 font-medium tracking-widest uppercase">@{u.username}</p>
                    
                    <div className="w-full space-y-2 pt-4 border-t border-border text-left">
                      {u.email && (
                        <div className="text-[10px] text-secondary truncate">
                          <span className="font-bold uppercase tracking-widest opacity-50 mr-2">Էլ. Փոստ:</span> {u.email}
                        </div>
                      )}
                      {u.department && (
                        <div className="text-[10px] text-secondary truncate">
                          <span className="font-bold uppercase tracking-widest opacity-50 mr-2">Բաժին:</span> {DEPARTMENT_LABELS[u.department] || u.department}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {displayedUsers.length === 0 && (
                  <div className="col-span-full py-20 text-center text-secondary italic">
                    Օգտատերեր չեն գտնվել:
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Bottom Navigation (Mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-xl border-t border-border px-4 py-2 z-50 flex justify-between items-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-all ${activeTab === tab.id ? 'text-primary' : 'text-secondary'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-primary/10' : ''}`}>
              <tab.icon size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label.split(' ')[0]}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="absolute top-2 right-2 bg-primary text-bg text-[8px] font-bold px-1 rounded-full min-w-[14px] h-[14px] flex items-center justify-center">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
              onClick={() => setPaymentModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md minimal-card text-center"
            >
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🪙</span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Անբավարար Միջոցներ</h2>
              <p className="text-secondary mb-8 text-sm leading-relaxed">
                Ձեր FZ Coin հաշվեկշիռը բավարար չէ այս միջոցառման համար: Դուք կարող եք գրանցվել հիմա և վճարել մնացած <span className="text-primary font-bold">{pendingPayment} դրամը</span> տեղում:
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => processApplication(pendingEventId!)}
                  className="minimal-button-primary w-full"
                >
                  Հաստատել Գրանցումը
                </button>
                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="minimal-button-secondary w-full"
                >
                  Չեղարկել
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Details Modal */}
      <AnimatePresence>
        {selectedEventForDetails && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg/90 backdrop-blur-md"
              onClick={() => setSelectedEventForDetails(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto minimal-card p-0 custom-scrollbar"
            >
              <button 
                onClick={() => setSelectedEventForDetails(null)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="h-64 relative">
                <img src={selectedEventForDetails.image} alt={selectedEventForDetails.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
                    {EVENT_TYPE_LABELS[selectedEventForDetails.type] || selectedEventForDetails.type}
                  </div>
                  <h2 className="text-3xl font-bold leading-tight">{selectedEventForDetails.title}</h2>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-secondary">
                      <Calendar className="text-primary" size={20} />
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest opacity-50">Ամսաթիվ</div>
                        <div className="text-sm font-medium">
                          {new Date(selectedEventForDetails.date).toLocaleDateString('hy-AM', { 
                            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </div>

                    {selectedEventForDetails.isOnline ? (
                      <div className="flex items-center gap-3 text-secondary">
                        <Video className="text-primary" size={20} />
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-widest opacity-50">Հարթակ</div>
                          <div className="text-sm font-medium">Օնլայն (Online)</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-secondary">
                        <MapPin className="text-primary" size={20} />
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-widest opacity-50">Վայրը</div>
                          <div className="text-sm font-medium">{selectedEventForDetails.location || 'Նշված չէ'}</div>
                        </div>
                      </div>
                    )}

                    {selectedEventForDetails.price && (
                      <div className="flex items-center gap-3 text-secondary">
                        <span className="text-xl">🪙</span>
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-widest opacity-50">Արժեքը</div>
                          <div className="text-sm font-medium">{selectedEventForDetails.price} FZ Coins</div>
                        </div>
                      </div>
                    )}

                    {selectedEventForDetails.dressCode && (
                      <div className="flex items-center gap-3 text-secondary">
                        <Shirt className="text-primary" size={20} />
                        <div>
                          <div className="text-[10px] uppercase font-bold tracking-widest opacity-50">Դրես Կոդ</div>
                          <div className="text-sm font-medium">{selectedEventForDetails.dressCode}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {selectedEventForDetails.isOnline && selectedEventForDetails.meetingLink && (
                      <a 
                        href={selectedEventForDetails.meetingLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm border border-primary/20 hover:bg-primary/20 transition-all"
                      >
                        <ExternalLink size={18} /> Միանալ Հանդիպմանը
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-l-4 border-primary pl-4">Նկարագրություն</h3>
                  <p className="text-secondary leading-relaxed whitespace-pre-wrap">
                    {selectedEventForDetails.description}
                  </p>
                </div>

                {!selectedEventForDetails.isOnline && selectedEventForDetails.location && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold border-l-4 border-primary pl-4">Միջոցառման Վայրը</h3>
                    <div className="w-full p-8 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center text-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <MapPin size={32} />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-primary mb-1">{selectedEventForDetails.location}</p>
                        <p className="text-xs text-secondary">Խնդրում ենք ժամանել միջոցառման սկզբից 15 րոպե շուտ:</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
