
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Save, User, GraduationCap, Briefcase, Target, Hash, X, Palette, Lock, LifeBuoy, Mail, CheckCircle2, AlertCircle, Bell, ShoppingBag, Send, Clock, MessageCircle, HelpCircle, ChevronRight, History, Eye, EyeOff, Edit2, Tag, Info, ChevronDown, ChevronUp, ShieldAlert, Users, KeyRound, Zap, Trash2 } from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs, orderBy, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface OnboardingModalProps {
  user: UserProfile;
  onUpdate: (updatedUser: UserProfile) => void;
  onCancel?: () => void;
  theme: string;
  setTheme: (theme: string) => void;
}

const ADMIN_EMAIL = 'electrorescuehelp@gmail.com';

const DOMAINS = [
  "VLSI DESIGN",
  "EMBEDDED SYSTEMS & IOT",
  "ROBOTICS & AUTOMATION",
  "POWER ELECTRONICS & EV",
  "AI & MACHINE LEARNING IN ELECTRONICS",
  "COMMUNICATION SYSTEMS",
  "CONTROL SYSTEMS & INSTRUMENTATION",
  "RENEWABLE ENERGY & SMART GRID",
  "PCB DESIGN & HARDWARE DEVELOPMENT",
  "BIOMEDICAL ELECTRONICS"
];

const TECHNICAL_INTERESTS_LIST = [
  "PCB Analysis", "Embedded Systems", "VLSI Design",
  "Component Recovery", "Repair & Diagnostics", "AI Vision",
  "E-Waste Recycling", "IoT Development", "Power Electronics", "Robotics"
];

const ROLES = [
  "Student",
  "Engineer",
  "Researcher",
  "Hobbyist"
];

const USAGE_CONTEXTS = [
  "Learning",
  "Research",
  "Repair",
  "Resale"
];

const THEMES = [
  { id: 'theme-dark', name: 'Dark', color: '#0f172a' },
  { id: 'theme-white', name: 'White', color: '#f8fafc' },
  { id: 'theme-green', name: 'Green', color: '#064e3b' },
  { id: 'theme-cherry', name: 'Cherry', color: '#881337' },
  { id: 'theme-midnight', name: 'Midnight', color: '#000000' }
];

const FAQ_DATA = [
    {
        question: "How accurate is the estimated salvage value?",
        answer: "The valuation is an AI-generated estimate based on current market rates for salvaged components. It's designed to be conservative (generally < ₹200 for small lots) to manage expectations. Real-world resale value may vary based on buyer demand."
    },
    {
        question: "Can I sell damaged PCBs?",
        answer: "Yes! Even damaged boards often have valuable components (ICs, connectors). When analyzing, our system grades the condition (A-D). Items graded 'D' might only be valuable for raw material recycling rather than component reuse."
    },
    {
        question: "How do I list an item in the ResQ-Store?",
        answer: "After analyzing a PCB image, click the 'Add to Market' button in the valuation panel. This sends a request to our Admin team. Once approved, it will appear in the public store."
    },
    {
        question: "Why was my sell request rejected?",
        answer: "Requests are usually rejected if the image is blurry, the components are too damaged to be viable, or the description is insufficient. You can try analyzing a clearer photo and submitting again."
    },
    {
        question: "Is my personal data safe?",
        answer: "Yes. We only store essential profile data to personalize your experience. We do not share your contact details publicly on the store; buyers contact the Admin team first, who then facilitate the connection."
    },
    {
        question: "How does the 'Project Creator' work?",
        answer: "Enter a list of components you currently have (e.g., 'Arduino, Servo, LED'). Our AI will generate custom project ideas that use those specific parts, telling you exactly what extra parts (if any) you might need."
    }
];

const OnboardingModal: React.FC<OnboardingModalProps> = ({ user, onUpdate, onCancel, theme, setTheme }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'security' | 'updates' | 'helpdesk'>('profile');
  const isAdmin = user.email === ADMIN_EMAIL || user.role === 'Admin';
  // Strict check for Main Admin
  const isMainAdmin = user.email === ADMIN_EMAIL;
  
  // Profile Form State
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    age: user.age || '',
    role: user.role || ROLES[0],
    university: user.university || '',
    domain: user.domain || DOMAINS[0],
    technicalInterests: user.technicalInterests || [] as string[],
    usageContext: user.usageContext || USAGE_CONTEXTS[0],
    engineeringSummary: user.engineeringSummary || ''
  });

  // Calculate Profile Completion
  const completionPercentage = React.useMemo(() => {
    let score = 0;
    const total = 3; // Role, Institution, Interests
    
    // 1. Role (Always has a default, but checking just in case)
    if (formData.role) score++;
    
    // 2. Institution
    if (formData.university && formData.university.trim().length > 0) score++;
    
    // 3. Interests
    if (formData.technicalInterests && formData.technicalInterests.length > 0) score++;

    return Math.round((score / total) * 100);
  }, [formData.role, formData.university, formData.technicalInterests]);

  // Password Form State
  const [passData, setPassData] = useState({
      current: '',
      newPass: '',
      confirm: ''
  });
  const [passMessage, setPassMessage] = useState({ type: '', text: '' });
  
  // Visibility States
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Master Key Management (Main Admin Only)
  const [masterKeyInput, setMasterKeyInput] = useState('');
  const [masterKeyStatus, setMasterKeyStatus] = useState('');
  
  // Personal Login Key Management (All Admins)
  const [personalLoginKey, setPersonalLoginKey] = useState('');
  const [personalKeyStatus, setPersonalKeyStatus] = useState('');

  // Admin List State
  const [adminList, setAdminList] = useState<UserProfile[]>([]);

  // Updates Tab State - Sell requests only
  const [userUpdates, setUserUpdates] = useState<any[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  // Helpdesk State
  const [helpHistory, setHelpHistory] = useState<any[]>([]);
  const [loadingHelp, setLoadingHelp] = useState(false);
  const [helpSent, setHelpSent] = useState(false);
  
  // FAQ & Query Flow State
  const [showQueryInput, setShowQueryInput] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  
  const [queryText, setQueryText] = useState('');
  const [queryType, setQueryType] = useState<'general' | 'admin'>('general');
  const [activeQueryCount, setActiveQueryCount] = useState(0);

  // Fetch Updates (Sell Requests) & Admin List
  useEffect(() => {
    if (activeTab === 'updates' && !isAdmin) {
        fetchSellUpdates();
    }
    if (activeTab === 'helpdesk') {
        fetchHelpHistory();
    }
    if (activeTab === 'security' && isMainAdmin) {
        fetchAdminList();
    }
  }, [activeTab, user.id, isAdmin, isMainAdmin]);

  const fetchAdminList = async () => {
      try {
          const q = query(collection(db, "users"), where("role", "==", "Admin"));
          const snapshot = await getDocs(q);
          const admins: UserProfile[] = [];
          snapshot.forEach(doc => {
              const data = doc.data() as UserProfile;
              // Exclude main admin from the list of "Additional Admins"
              if (data.email !== ADMIN_EMAIL) {
                  admins.push(data);
              }
          });
          setAdminList(admins);
      } catch (e) {
          console.error("Error fetching admins", e);
      }
  };

  const fetchSellUpdates = async () => {
      setLoadingUpdates(true);
      try {
          const sellQ = query(
              collection(db, "er_requests"), 
              where("sellerId", "==", user.id)
          );
          const sellSnap = await getDocs(sellQ);
          const sellItems = sellSnap.docs.map(d => ({
              ...d.data(), 
              _id: d.id,
              _type: 'sell_request'
          }));
          sellItems.sort((a: any, b: any) => b.timestamp - a.timestamp);
          setUserUpdates(sellItems);
      } catch (e) {
          console.error("Error fetching updates:", e);
      } finally {
          setLoadingUpdates(false);
      }
  };

  const fetchHelpHistory = async () => {
      setLoadingHelp(true);
      try {
          const helpQ = query(
              collection(db, "help_requests"),
              where("userId", "==", user.id)
          );
          const helpSnap = await getDocs(helpQ);
          const helpItems = helpSnap.docs.map(d => ({
              ...d.data(), 
              _id: d.id,
              _type: 'help_request'
          }));
          
          // Calculate active queries
          const activeCount = helpItems.filter((i: any) => i.status === 'pending').length;
          setActiveQueryCount(activeCount);

          // Sort by timestamp desc (newest first)
          helpItems.sort((a: any, b: any) => b.timestamp - a.timestamp);
          setHelpHistory(helpItems);
      } catch (e) {
          console.error("Error fetching help history:", e);
      } finally {
          setLoadingHelp(false);
      }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
        ...user,
        ...formData
    });
    setIsEditing(false);
  };

  const toggleInterest = (interest: string) => {
    setFormData(prev => {
        const current = prev.technicalInterests;
        if (current.includes(interest)) {
            return { ...prev, technicalInterests: current.filter(i => i !== interest) };
        } else {
            if (current.length >= 5) return prev; // Limit to 5
            return { ...prev, technicalInterests: [...current, interest] };
        }
    });
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      setPassMessage({ type: '', text: '' });

      if (passData.newPass !== passData.confirm) {
          setPassMessage({ type: 'error', text: 'New passwords do not match.' });
          return;
      }
      if (passData.newPass.length < 6) {
          setPassMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
          return;
      }
      
      // Simple check against current user object
      if (user.password && passData.current !== user.password) {
          setPassMessage({ type: 'error', text: 'Incorrect current password.' });
          return;
      }

      try {
          const userRef = doc(db, "users", user.email);
          await updateDoc(userRef, { password: passData.newPass });
          onUpdate({ ...user, password: passData.newPass });
          setPassMessage({ type: 'success', text: 'Password updated successfully.' });
          setPassData({ current: '', newPass: '', confirm: '' });
      } catch (err) {
          setPassMessage({ type: 'error', text: 'Failed to update password.' });
      }
  };

  const handleUpdateMasterKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (masterKeyInput.length < 8) {
        setMasterKeyStatus('Key must be at least 8 characters.');
        return;
    }
    try {
        await setDoc(doc(db, 'system_config', 'admin_settings'), {
            masterKey: masterKeyInput,
            updatedBy: user.email,
            updatedAt: Date.now()
        }, { merge: true });
        setMasterKeyStatus('Master Key Updated Successfully!');
        setMasterKeyInput('');
    } catch (e) {
        setMasterKeyStatus('Failed to update key.');
    }
  };

  const handleUpdatePersonalLoginKey = async (e: React.FormEvent) => {
      e.preventDefault();
      if (personalLoginKey.length < 6) {
          setPersonalKeyStatus('Key must be at least 6 characters.');
          return;
      }
      try {
          const userRef = doc(db, "users", user.email);
          await updateDoc(userRef, { loginKey: personalLoginKey });
          // Update local user state
          onUpdate({ ...user, loginKey: personalLoginKey });
          setPersonalKeyStatus('Login Key Updated! You can now use Quick Login.');
          setPersonalLoginKey('');
      } catch (e) {
          setPersonalKeyStatus('Failed to update login key.');
      }
  };

  const handleRemoveAdmin = async (adminEmail: string) => {
      if (!window.confirm(`Are you sure you want to revoke Admin access for ${adminEmail}? They will become a regular user.`)) return;
      
      try {
          const userRef = doc(db, "users", adminEmail);
          await updateDoc(userRef, { role: 'Student' }); // Demote to Student
          setAdminList(prev => prev.filter(a => a.email !== adminEmail)); // Optimistic UI update
          alert("Admin access revoked successfully.");
      } catch (e) {
          console.error("Error removing admin:", e);
          alert("Failed to remove admin access.");
      }
  };

  const handleInitiateHelp = async (type: 'general' | 'admin') => {
      if (activeQueryCount >= 2) {
          return;
      }
      setQueryType(type);
      
      if (type === 'general') {
          // If general help, show FAQ first
          setShowFAQ(true);
          setShowQueryInput(false);
      } else {
          // If admin support, go straight to input
          setShowFAQ(false);
          setShowQueryInput(true);
      }
  };

  const submitHelpRequest = async () => {
      if (!queryText.trim()) return;

      try {
          const newDoc = {
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              type: queryType,
              queryText: queryText,
              timestamp: Date.now(),
              status: 'pending'
          };
          
          await addDoc(collection(db, "help_requests"), newDoc);
          
          setHelpSent(true);
          setShowQueryInput(false);
          setQueryText('');
          
          // Refresh list locally
          fetchHelpHistory();
          
          setTimeout(() => setHelpSent(false), 5000); 
      } catch (e) {
          console.error("Failed to send help request", e);
          alert("Failed to send request. Please try again.");
      }
  };

  // ... (renderHelpTicket and other renders remain the same) ...
  const renderHelpTicket = (item: any) => (
    <div key={item._id} className="group relative bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 transition-all hover:bg-slate-800/50 mb-4 animate-in fade-in slide-in-from-right-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 pb-2 border-b border-slate-700/30">
            <div className="flex items-center gap-2">
                 <div className={`p-1.5 rounded-md ${item.type === 'admin' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                     {item.type === 'admin' ? <Mail className="w-3.5 h-3.5" /> : <LifeBuoy className="w-3.5 h-3.5" />}
                 </div>
                 <div className="flex flex-col">
                    <span className="text-sm font-bold text-white leading-none">
                        {item.type === 'admin' ? 'Admin Support' : 'General Help'}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                        {new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                 </div>
            </div>
            {item.status === 'resolved' ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Solved
                </span>
            ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="w-3 h-3" /> Pending
                </span>
            )}
        </div>

        {/* Conversation Thread */}
        <div className="space-y-4 pl-3 border-l-2 border-slate-800 ml-1">
            
            {/* User Query */}
            <div className="relative">
                <div className="absolute -left-[1.85rem] top-0 bg-slate-800 rounded-full p-1 border border-slate-700 shadow-sm z-10">
                    <User className="w-3 h-3 text-slate-400" />
                </div>
                <div className="bg-slate-950/80 rounded-lg rounded-tl-none p-3 text-sm text-slate-300 border border-slate-800 shadow-sm">
                    {item.queryText}
                </div>
            </div>

            {/* Admin Response */}
            {item.status === 'resolved' && (
                <div className="relative">
                    <div className="absolute -left-[1.85rem] top-0 bg-emerald-900/50 rounded-full p-1 border border-emerald-500/30 z-10">
                        <MessageCircle className="w-3 h-3 text-emerald-400" />
                    </div>
                     <div className="bg-emerald-900/10 rounded-lg rounded-tl-none p-3 text-sm text-white border border-emerald-500/20 shadow-inner">
                        <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider block mb-1">Admin Response</span>
                        {item.responseText}
                    </div>
                </div>
            )}
            
            {/* Pending State */}
            {item.status === 'pending' && (
                 <div className="relative pt-1 opacity-60">
                    <div className="absolute -left-[1.85rem] top-0 bg-slate-800 rounded-full p-1 border border-slate-700 border-dashed">
                         <Clock className="w-3 h-3 text-slate-500" />
                    </div>
                     <div className="text-xs text-slate-500 italic pl-1 flex items-center gap-2">
                        <span>Waiting for response...</span>
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
       {/* Blurred Backdrop */}
       <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onCancel} />

       <div className="relative bg-slate-900 w-full max-w-4xl h-[90vh] md:h-[600px] rounded-2xl border border-slate-700 shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95">
          {onCancel && (
             <button onClick={onCancel} className="absolute top-4 right-4 text-slate-500 hover:text-white z-20 md:z-10 bg-slate-900/50 rounded-full p-1 md:bg-transparent">
                <X className="w-5 h-5" />
             </button>
          )}

          {/* Sidebar Navigation */}
          <div className="w-full md:w-64 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800 p-4 md:p-6 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible shrink-0 no-scrollbar items-center md:items-stretch">
              <div className="mb-0 md:mb-8 pl-2 hidden md:block">
                  <h2 className="text-xl font-bold text-white">Settings</h2>
                  <p className="text-xs text-slate-500">Manage your account</p>
              </div>

              <button 
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
              >
                  <User className="w-4 h-4" /> Profile
              </button>
              
              {!isAdmin && (
                  <button 
                    onClick={() => setActiveTab('updates')}
                    className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'updates' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
                  >
                      <Bell className="w-4 h-4" /> Updates
                  </button>
              )}

              <button 
                onClick={() => setActiveTab('appearance')}
                className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'appearance' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
              >
                  <Palette className="w-4 h-4" /> Appearance
              </button>
              <button 
                onClick={() => setActiveTab('security')}
                className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'security' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
              >
                  <Lock className="w-4 h-4" /> Security
              </button>
              <button 
                onClick={() => setActiveTab('helpdesk')}
                className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'helpdesk' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
              >
                  <LifeBuoy className="w-4 h-4" /> Helpdesk
              </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-slate-900/50 pb-20 md:pb-8 relative">
              
              {/* --- PROFILE TAB --- */}
              {activeTab === 'profile' && (
                  <div className="max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300 mx-auto md:mx-0">
                      
                      {/* Top Info Banner (Refined) */}
                      <div className="mb-6 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl flex gap-3 items-start">
                          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                          <div>
                              <h4 className="text-sm font-bold text-blue-400 mb-1">Personalizing your experience</h4>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                  Your profile details are used to personalize the platform experience, influencing analysis depth, component valuation, project recommendations, and ResQ-Store suggestions. Please complete and maintain an accurate profile to ensure the best results.
                              </p>
                          </div>
                      </div>

                      {/* --- USER IDENTITY CARD (Rebuilt) --- */}
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center gap-6">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                          
                          {/* Completion Percentage Badge */}
                          <div className={`absolute top-4 right-4 text-xs font-mono font-bold px-2 py-1 rounded border shadow-sm ${completionPercentage === 100 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'}`}>
                              Profile Completion: {completionPercentage}%
                          </div>

                          {/* Avatar */}
                          <div className="w-20 h-20 shrink-0 rounded-full bg-slate-700 flex items-center justify-center border-4 border-slate-700/50 shadow-md relative z-10">
                              <User className="w-10 h-10 text-slate-300" />
                          </div>

                          {/* Identity Fields */}
                          <div className="flex-1 w-full relative z-10 space-y-3">
                              {/* 1. Full Name */}
                              <div>
                                  <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5 block">Full Name</label>
                                  <h2 className="text-2xl font-bold text-white tracking-tight leading-none">{user.name}</h2>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-4 w-full">
                                  {/* 2. Role / Level */}
                                  <div className="flex-1">
                                      <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1 block">Role / Level</label>
                                      {isEditing ? (
                                          <select
                                              value={formData.role}
                                              onChange={e => setFormData({...formData, role: e.target.value})}
                                              className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 px-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                                          >
                                              {ROLES.map(role => (
                                                  <option key={role} value={role}>{role}</option>
                                              ))}
                                          </select>
                                      ) : (
                                          <span className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-blue-500 shadow-sm">
                                              {formData.role}
                                          </span>
                                      )}
                                  </div>

                                  {/* 3. Primary Focus */}
                                  <div className="flex-1">
                                      <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1 block">Primary Focus</label>
                                      {isEditing ? (
                                          <select
                                              value={formData.domain}
                                              onChange={e => setFormData({...formData, domain: e.target.value})}
                                              className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 px-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                                          >
                                              {DOMAINS.map(domain => (
                                                  <option key={domain} value={domain}>{domain}</option>
                                              ))}
                                          </select>
                                      ) : (
                                          <span className="text-slate-300 text-sm flex items-center gap-1.5 font-medium mt-1">
                                              <Target className="w-4 h-4 text-emerald-500" />
                                              {formData.domain}
                                          </span>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* --- SECONDARY DETAILS GRID --- */}
                      <form onSubmit={handleProfileSubmit} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* University */}
                              <div className={`p-4 rounded-xl border transition-all ${isEditing ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-900/30 border-slate-800'}`}>
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">University / Organization</span>
                                  {isEditing ? (
                                      <input 
                                          type="text" 
                                          required
                                          value={formData.university}
                                          onChange={e => setFormData({...formData, university: e.target.value})}
                                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                                      />
                                  ) : (
                                      <div className="flex items-center gap-2 text-slate-200">
                                          <GraduationCap className="w-4 h-4 text-slate-400" />
                                          {formData.university}
                                      </div>
                                  )}
                              </div>

                              {/* Age (Moved Here) */}
                              <div className={`p-4 rounded-xl border transition-all ${isEditing ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-900/30 border-slate-800'}`}>
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Age</span>
                                  {isEditing ? (
                                       <input 
                                          type="number" 
                                          required
                                          value={formData.age}
                                          onChange={e => setFormData({...formData, age: e.target.value})}
                                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:border-blue-500 focus:outline-none"
                                      />
                                  ) : (
                                      <div className="flex items-center gap-2 text-slate-200">
                                          <span className="font-mono bg-slate-800 px-2 rounded text-xs text-slate-400">#</span>
                                          {formData.age} Years Old
                                      </div>
                                  )}
                              </div>

                               {/* Engineering Summary (New Field) */}
                               <div className="col-span-1 md:col-span-2 space-y-1 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Engineering Summary <span className="text-slate-600">(Optional)</span></label>
                                        {isEditing && <span className="text-[10px] text-slate-500">{formData.engineeringSummary.length}/150</span>}
                                    </div>
                                    {isEditing ? (
                                        <textarea
                                            value={formData.engineeringSummary}
                                            onChange={e => setFormData({...formData, engineeringSummary: e.target.value.slice(0, 150)})}
                                            placeholder="Briefly describe your technical focus or goals (e.g., Focused on PCB failure analysis...)"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-white focus:border-blue-500 focus:outline-none resize-none h-20 text-sm"
                                        />
                                    ) : (
                                        <p className="text-sm text-slate-300 italic leading-relaxed">
                                            {formData.engineeringSummary || "No summary provided."}
                                        </p>
                                    )}
                                </div>
                          </div>

                          {isEditing && (
                              <div className="space-y-1 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                                  <label className="text-xs font-medium text-slate-400 uppercase">Usage Context (AI Enhancement)</label>
                                  <select
                                      required
                                      value={formData.usageContext}
                                      onChange={e => setFormData({...formData, usageContext: e.target.value})}
                                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 text-white focus:border-blue-500 focus:outline-none"
                                  >
                                      {USAGE_CONTEXTS.map(ctx => (
                                          <option key={ctx} value={ctx}>{ctx}</option>
                                      ))}
                                  </select>
                                  <p className="text-[10px] text-slate-500 mt-1">This field is used for system personalization and is not public.</p>
                              </div>
                          )}

                          {/* Technical Interests */}
                          <div>
                              <div className="flex justify-between items-center mb-3">
                                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                      <Tag className="w-4 h-4 text-emerald-500" /> Technical Interests
                                  </h4>
                                  {isEditing && <span className="text-xs text-slate-500">{formData.technicalInterests.length}/5 selected</span>}
                              </div>
                              
                              {isEditing ? (
                                  <div className="flex flex-wrap gap-2 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                                      {TECHNICAL_INTERESTS_LIST.map(tag => {
                                          const isSelected = formData.technicalInterests.includes(tag);
                                          return (
                                              <button
                                                  key={tag}
                                                  type="button"
                                                  onClick={() => toggleInterest(tag)}
                                                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${isSelected ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/20' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                              >
                                                  {tag}
                                              </button>
                                          );
                                      })}
                                  </div>
                              ) : (
                                  <div className="flex flex-wrap gap-2">
                                      {formData.technicalInterests.length > 0 ? (
                                          formData.technicalInterests.map(tag => (
                                              <span key={tag} className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700">
                                                  {tag}
                                              </span>
                                          ))
                                      ) : (
                                          <span className="text-slate-500 text-xs italic">No interests selected.</span>
                                      )}
                                  </div>
                              )}
                          </div>

                          {/* Bottom Disclaimer */}
                          <div className="text-center pb-2">
                              <p className="text-[10px] text-slate-500 italic">
                                  Your profile influences analysis depth, component valuation, and project recommendations.
                              </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-0">
                              {!isEditing ? (
                                  <button 
                                      type="button"
                                      onClick={() => setIsEditing(true)}
                                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-700 hover:border-slate-600 shadow-sm"
                                  >
                                      <Edit2 className="w-4 h-4" /> Edit Profile
                                  </button>
                              ) : (
                                  <div className="flex gap-3">
                                      <button 
                                          type="button" 
                                          onClick={() => {
                                              setIsEditing(false);
                                              // Reset form data to prop values if cancelled
                                              setFormData({
                                                  age: user.age || '',
                                                  role: user.role || ROLES[0],
                                                  university: user.university || '',
                                                  domain: user.domain || DOMAINS[0],
                                                  technicalInterests: user.technicalInterests || [],
                                                  usageContext: user.usageContext || USAGE_CONTEXTS[0],
                                                  engineeringSummary: user.engineeringSummary || ''
                                              });
                                          }}
                                          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors border border-slate-700"
                                      >
                                          Cancel
                                      </button>
                                      <button 
                                          type="submit" 
                                          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
                                      >
                                          <Save className="w-4 h-4" /> Save Changes
                                      </button>
                                  </div>
                              )}
                          </div>
                      </form>
                  </div>
              )}

              {/* --- UPDATES TAB (Sell Requests Only Now) --- */}
              {activeTab === 'updates' && !isAdmin && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                      <h3 className="text-xl font-bold text-white mb-2">Marketplace Requests</h3>
                      <p className="text-slate-400 text-sm mb-6">Status of your items submitted to ResQ-Store.</p>

                      {loadingUpdates ? (
                          <div className="text-center py-10 text-slate-500">Loading...</div>
                      ) : userUpdates.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 bg-slate-950/50 rounded-xl border border-dashed border-slate-800">
                              <ShoppingBag className="w-12 h-12 text-slate-700 mb-4" />
                              <h4 className="text-slate-400 font-medium">No sell requests</h4>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              {userUpdates.map((item) => (
                                <div key={item._id} className="p-4 rounded-xl border flex gap-4 bg-slate-950 border-slate-800">
                                   <div className="w-16 h-16 bg-slate-900 rounded-lg shrink-0 border border-slate-800 overflow-hidden">
                                      {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <ShoppingBag className="w-full h-full p-4 text-slate-700" />}
                                   </div>
                                   <div>
                                      <h4 className="text-white font-bold">{item.title}</h4>
                                      <div className={`text-xs font-bold inline-block px-2 py-0.5 rounded mt-1 ${item.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : item.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                          {item.status || 'pending'}
                                      </div>
                                   </div>
                                </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              {/* --- APPEARANCE & SECURITY (Simplified for Brevity) --- */}
              {activeTab === 'appearance' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                       <h3 className="text-xl font-bold text-white mb-6">Theme</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {THEMES.map(t => (
                              <button key={t.id} onClick={() => setTheme(t.id)} className={`p-4 rounded-xl border-2 text-left transition-all ${theme === t.id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-950'}`}>
                                  <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full" style={{background: t.color}}></div><span className="text-white">{t.name}</span></div>
                              </button>
                          ))}
                      </div>
                  </div>
              )}
               {activeTab === 'security' && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-lg">
                      <h3 className="text-xl font-bold text-white mb-6">Security</h3>
                      
                      {/* Password Change Form */}
                      <form onSubmit={handlePasswordUpdate} className="space-y-4 mb-8">
                           {passMessage.text && <div className={`p-3 rounded text-sm ${passMessage.type === 'error' ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'}`}>{passMessage.text}</div>}
                           
                           <div className="relative">
                             <input type={showCurrentPass ? "text" : "password"} placeholder="Current Password" required value={passData.current} onChange={e => setPassData({...passData, current: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 pr-10 text-white"/>
                             <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-3 text-slate-500 hover:text-white">
                                {showCurrentPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                             </button>
                           </div>

                           <div className="relative">
                             <input type={showNewPass ? "text" : "password"} placeholder="New Password" required value={passData.newPass} onChange={e => setPassData({...passData, newPass: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 pr-10 text-white"/>
                              <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-3 text-slate-500 hover:text-white">
                                {showNewPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                             </button>
                           </div>

                           <div className="relative">
                             <input type={showConfirmPass ? "text" : "password"} placeholder="Confirm Password" required value={passData.confirm} onChange={e => setPassData({...passData, confirm: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-4 pr-10 text-white"/>
                             <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-3 top-3 text-slate-500 hover:text-white">
                                {showConfirmPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                             </button>
                           </div>

                           <button type="submit" className="w-full bg-slate-800 text-white py-3 rounded-lg border border-slate-700">Update Password</button>
                      </form>

                      {isAdmin && (
                        <div className="mt-8 pt-8 border-t border-slate-800 animate-in fade-in">
                            <h3 className="text-lg font-bold text-amber-500 mb-4 flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5" /> Admin Security Controls
                            </h3>
                            
                            {/* --- PERSONAL LOGIN KEY (ALL ADMINS) --- */}
                            <form onSubmit={handleUpdatePersonalLoginKey} className="space-y-4 mb-6">
                                <div className="p-4 bg-amber-900/10 border border-amber-500/20 rounded-lg">
                                    <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-2 flex items-center gap-2">
                                        <Zap className="w-3 h-3" /> Your Personal Login Key
                                    </label>
                                    <p className="text-xs text-slate-400 mb-3">
                                        Set a secure key to use "Quick Login" and bypass email OTP verification.
                                    </p>
                                    <div className="flex gap-2">
                                        <input 
                                            type="password"
                                            value={personalLoginKey}
                                            onChange={(e) => setPersonalLoginKey(e.target.value)}
                                            placeholder="Set new login key..."
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-amber-500 focus:outline-none"
                                        />
                                        <button 
                                            type="submit"
                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors"
                                        >
                                            Save Key
                                        </button>
                                    </div>
                                    {personalKeyStatus && (
                                        <p className={`text-xs mt-2 ${personalKeyStatus.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                                            {personalKeyStatus}
                                        </p>
                                    )}
                                </div>
                            </form>
                            
                            {/* MASTER KEY UPDATE - MAIN ADMIN ONLY */}
                            {isMainAdmin && (
                                <form onSubmit={handleUpdateMasterKey} className="space-y-4 mb-6">
                                    <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-2">
                                            <KeyRound className="w-3 h-3" /> Update Master Key (System Wide)
                                        </label>
                                        <p className="text-xs text-slate-500 mb-3">
                                            This key is required to register new Admin accounts. Only you can change this.
                                        </p>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={masterKeyInput}
                                                onChange={(e) => setMasterKeyInput(e.target.value)}
                                                placeholder="Enter new master key..."
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-slate-500 focus:outline-none"
                                            />
                                            <button 
                                                type="submit"
                                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors border border-slate-600"
                                            >
                                                Update
                                            </button>
                                        </div>
                                        {masterKeyStatus && (
                                            <p className={`text-xs mt-2 ${masterKeyStatus.includes('Success') ? 'text-green-400' : 'text-red-400'}`}>
                                                {masterKeyStatus}
                                            </p>
                                        )}
                                    </div>
                                </form>
                            )}

                            {/* ADMIN LIST - MAIN ADMIN ONLY */}
                            {isMainAdmin && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Authorized Admin Team
                                    </h4>
                                    {adminList.length > 0 ? (
                                        adminList.map((admin, idx) => (
                                            <div key={idx} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex justify-between items-center group">
                                                <div>
                                                    <p className="text-sm font-bold text-white">{admin.name}</p>
                                                    <p className="text-xs text-slate-500">{admin.email}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">Admin</span>
                                                    <button 
                                                        onClick={() => handleRemoveAdmin(admin.email)}
                                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                                        title="Revoke Access"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-4 border border-dashed border-slate-800 rounded-lg">
                                            <p className="text-xs text-slate-500 italic">No additional admins registered.</p>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2">
                                        <p className="text-[10px] text-slate-600">Max 2 additional admins allowed.</p>
                                        <span className="text-[10px] text-slate-500">{adminList.length}/2 Used</span>
                                    </div>
                                </div>
                            )}
                        </div>
                      )}
                  </div>
              )}

              {/* --- HELPDESK TAB (Updated with History) --- */}
              {activeTab === 'helpdesk' && !showQueryInput && !showFAQ && (
                   <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
                      <div className="flex justify-between items-center mb-4">
                         <div>
                            <h3 className="text-xl font-bold text-white">Helpdesk Support</h3>
                            <p className="text-slate-400 text-sm">Create tickets and view admin responses.</p>
                         </div>
                      </div>

                      {helpSent && (
                          <div className="mb-4 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-lg flex items-center gap-3 text-emerald-400 animate-in fade-in">
                              <CheckCircle2 className="w-5 h-5" />
                              <span>Request Sent!</span>
                          </div>
                      )}
                      
                      {activeQueryCount >= 2 && (
                          <div className="mb-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg flex items-center gap-2 text-amber-400 text-sm">
                              <AlertCircle className="w-4 h-4" />
                              <span>Max 2 active queries reached. Please wait for a response.</span>
                          </div>
                      )}

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                          <button 
                             onClick={() => handleInitiateHelp('general')}
                             // Allow opening FAQ even if query limit reached, as FAQ doesn't create a ticket yet
                             className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-left hover:border-blue-500/50 transition-all"
                          >
                              <LifeBuoy className="w-6 h-6 text-blue-500 mb-2" />
                              <h4 className="font-bold text-white text-sm">General Help</h4>
                              <p className="text-xs text-slate-500">FAQs & Usage</p>
                          </button>
                          <button 
                             onClick={() => handleInitiateHelp('admin')}
                             disabled={activeQueryCount >= 2}
                             className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-left hover:border-emerald-500/50 transition-all disabled:opacity-50"
                          >
                              <Mail className="w-6 h-6 text-emerald-500 mb-2" />
                              <h4 className="font-bold text-white text-sm">Admin Support</h4>
                              <p className="text-xs text-slate-500">Account & Billing</p>
                          </button>
                      </div>

                      {/* Ticket History */}
                      <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <History className="w-4 h-4" /> Ticket History
                      </h4>
                      
                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1">
                          {loadingHelp ? (
                              <div className="text-center py-4 text-slate-500">Loading history...</div>
                          ) : helpHistory.length === 0 ? (
                              <div className="text-center py-8 text-slate-600 border border-dashed border-slate-800 rounded-lg">
                                  No previous tickets.
                              </div>
                          ) : (
                              helpHistory.map((item) => renderHelpTicket(item))
                          )}
                      </div>
                   </div>
              )}

              {/* --- FAQ VIEW --- */}
              {activeTab === 'helpdesk' && showFAQ && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                             <HelpCircle className="w-6 h-6 text-blue-400" />
                             Frequently Asked Questions
                          </h3>
                          <button onClick={() => setShowFAQ(false)} className="text-slate-500 hover:text-white flex items-center gap-1 text-sm font-medium">
                              Back
                          </button>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                          {FAQ_DATA.map((faq, index) => {
                              const isOpen = openFaqIndex === index;
                              return (
                                  <div 
                                    key={index} 
                                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                                    className={`bg-slate-800/30 border transition-all rounded-xl cursor-pointer overflow-hidden ${isOpen ? 'border-blue-500/30 bg-slate-800/50' : 'border-slate-800 hover:bg-slate-800/50'}`}
                                  >
                                      <div className="p-4 flex justify-between items-center gap-4">
                                          <h4 className={`text-sm font-medium ${isOpen ? 'text-blue-400' : 'text-white'}`}>{faq.question}</h4>
                                          {isOpen ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                      </div>
                                      {isOpen && (
                                          <div className="px-4 pb-4 text-sm text-slate-400 leading-relaxed border-t border-slate-700/50 pt-3 animate-in slide-in-from-top-1">
                                              {faq.answer}
                                          </div>
                                      )}
                                  </div>
                              );
                          })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-800">
                          <p className="text-center text-sm text-slate-500 mb-3">Still have doubts?</p>
                          <button 
                             onClick={() => {
                                 if (activeQueryCount >= 2) {
                                     alert("You have reached the maximum number of active queries. Please wait for a response.");
                                     return;
                                 }
                                 setShowFAQ(false);
                                 setShowQueryInput(true);
                             }}
                             className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                          >
                             <Send className="w-4 h-4" /> Submit a Ticket
                          </button>
                      </div>
                  </div>
              )}

              {/* --- HELPDESK INPUT --- */}
              {activeTab === 'helpdesk' && showQueryInput && (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full max-h-[400px]">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                             {queryType === 'admin' ? <Mail className="w-6 h-6 text-emerald-500" /> : <LifeBuoy className="w-6 h-6 text-blue-400" />}
                             {queryType === 'admin' ? 'Ask Admin' : 'General Support'}
                          </h3>
                          <button onClick={() => setShowQueryInput(false)} className="text-slate-500 hover:text-white">Cancel</button>
                      </div>
                      <div className="flex-1 flex flex-col">
                          <label className="text-sm text-slate-400 mb-2">Describe your issue:</label>
                          <textarea 
                              className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-lg p-4 text-white resize-none focus:border-blue-500 focus:outline-none placeholder:text-slate-600"
                              placeholder="Type here..."
                              value={queryText}
                              onChange={(e) => setQueryText(e.target.value)}
                          />
                          <button 
                             onClick={submitHelpRequest}
                             disabled={!queryText.trim()}
                             className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                          >
                             <Send className="w-4 h-4" /> Submit Query
                          </button>
                      </div>
                  </div>
              )}

          </div>
       </div>
    </div>
  );
};

export default OnboardingModal;
