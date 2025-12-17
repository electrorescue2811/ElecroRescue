
import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ImageUpload from './components/ImageUpload';
import ComponentList from './components/ComponentList';
import DamageReport from './components/DamageReport';
import ValuationPanel from './components/ValuationPanel';
import ChatWidget from './components/ChatWidget';
import HistoryPanel from './components/HistoryPanel';
import ProjectCreator from './components/ProjectCreator';
import LoginPage from './components/LoginPage';
import DashboardSidebar from './components/DashboardSidebar';
import OnboardingModal from './components/OnboardingModal';
import Marketplace from './components/Marketplace';
import ERResQ from './components/ERResQ';
import AdminNotifications from './components/AdminNotifications';
import { analyzePCBImage } from './services/geminiService';
import { AnalysisResult, AnalysisState, HistoryItem, UserProfile, ProjectIdea } from './types';
import { Lightbulb, PenTool, Sparkles, ArrowRight, X, Home, Store, User, Edit2, LogOut, ShieldAlert } from 'lucide-react';
import { db } from './services/firebase';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { sendGeneralEmail } from './services/emailService';

const STORAGE_KEY = 'electro_rescue_history';
const USER_KEY = 'electro_rescue_user';
const ADMIN_EMAIL = 'electrorescuehelp@gmail.com';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'marketplace' | 'er-resq' | 'projects'>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // New States for Theme and Sidebar
  const [theme, setTheme] = useState('theme-dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [state, setState] = useState<AnalysisState>({
    isLoading: false,
    result: null,
    error: null,
    imagePreview: null,
  });

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAdminNotifOpen, setIsAdminNotifOpen] = useState(false);
  
  // Pass this to ProjectCreator to load from history
  const [selectedProject, setSelectedProject] = useState<ProjectIdea | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.email === ADMIN_EMAIL || user?.role === 'Admin';

  // Theme Effect
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Check for logged in user on mount
  useEffect(() => {
    try {
        const savedUser = localStorage.getItem(USER_KEY);
        if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            // Check if profile is complete
            if (!parsedUser.age || !parsedUser.university || !parsedUser.domain) {
                setShowOnboarding(true);
            }
        }
    } catch (e) {
        console.error("Failed to load user session", e);
    }
  }, []);

  // Load history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  // Save history helper
  const saveToHistory = (newItem: HistoryItem) => {
    setHistory(prev => {
      // Check for duplicates before adding
      if (newItem.type === 'project' && newItem.project) {
          const exists = prev.some(item => item.type === 'project' && item.project?.title === newItem.project?.title);
          if (exists) return prev;
      }
      
      const updated = [newItem, ...prev].slice(0, 20); // Keep last 20 items
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Storage quota exceeded", e);
      }
      return updated;
    });
  };

  const removeFromHistory = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleLogin = (userData: UserProfile) => {
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      if (!userData.age || !userData.university) {
          setShowOnboarding(true);
      }
  };

  const handleUpdateProfile = async (updatedUser: UserProfile) => {
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      
      try {
        const userRef = doc(db, "users", updatedUser.email);
        await updateDoc(userRef, {
            age: updatedUser.age,
            university: updatedUser.university,
            domain: updatedUser.domain,
            role: updatedUser.role,
            technicalInterests: updatedUser.technicalInterests || [],
            usageContext: updatedUser.usageContext || 'Learning',
            engineeringSummary: updatedUser.engineeringSummary || ''
        });
      } catch (e) {
        console.error("Failed to sync profile update to cloud", e);
      }

      setShowOnboarding(false);
  };

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem(USER_KEY);
      handleReset();
      setCurrentView('dashboard');
      setIsMobileMenuOpen(false);
  };

  const handleAddToMarket = async (itemPrice: string, imageUrl: string | null) => {
      if (!user || !state.result) return;

      try {
          const newItem = {
              sellerId: user.id,
              sellerName: user.name,
              timestamp: Date.now(),
              title: `${state.result.pcbCategory} - Salvage Lot`,
              description: `Automated Listing: ${state.result.summary.join(', ')}. Condition: ${state.result.damageAssessment.conditionGrade}.`,
              price: itemPrice.replace(/[^0-9]/g, ''), 
              condition: state.result.damageAssessment.conditionGrade === 'A' ? 'Used - Like New' : 'Salvaged / For Parts',
              contactInfo: user.email,
              imageUrl: imageUrl || '',
              status: 'pending'
          };

          await addDoc(collection(db, "er_requests"), { ...newItem, id: Date.now().toString() });
          
          await sendGeneralEmail(
              user.email,
              "Request Received - ER-ResQ Market",
              `Hello ${user.name},\n\nWe have received your request to sell a ${state.result.pcbCategory} lot.\n\nOur Admin team will review your submission and update the status shortly.`
          );

          alert("Item submitted to ER-ResQ! A confirmation email has been sent.");
          setCurrentView('dashboard');
      } catch (error) {
          console.error("Error adding to er_requests:", error);
          alert("Failed to list item.");
      }
  };

  const handleImageSelect = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      imagePreview: objectUrl,
      result: null 
    }));

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        const mimeType = file.type;

        try {
          const result = await analyzePCBImage(base64Data, mimeType);
          
          setState(prev => ({
            ...prev,
            isLoading: false,
            result
          }));

          saveToHistory({
            id: Date.now().toString(),
            timestamp: Date.now(),
            type: 'analysis',
            result,
            imageData: base64String 
          });
          
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);

        } catch (apiError: any) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: apiError.message || "Failed to analyze image. Please try again."
          }));
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Error processing image file."
      }));
    }
  };

  const handleHistorySelect = (item: HistoryItem) => {
    if (item.type === 'project' && item.project) {
       // Switch to Project Creator and load the project
       setCurrentView('projects');
       setSelectedProject(item.project);
    } else if (item.result && item.imageData) {
       // Switch to Analyzer and load the result
       setCurrentView('dashboard');
       setState({
         isLoading: false,
         result: item.result,
         error: null,
         imagePreview: item.imageData
       });
       setTimeout(() => {
         scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
       }, 100);
    }
    setIsHistoryOpen(false);
  };

  const handleReset = () => {
    setState({
      isLoading: false,
      result: null,
      error: null,
      imagePreview: null
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const capabilities = [
    { icon: "🔍", text: "Intelligent component identification for ICs, resistors, capacitors, and more" },
    { icon: "🔠", text: "High-accuracy OCR for part numbers, labels, and manufacturer markings" },
    { icon: "🔥", text: "Automatic detection of burn, heat, moisture, and corrosion damage" },
    { icon: "🟩", text: "Component condition grading (A–D) for fast evaluation 🟨🟧🟥" },
    { icon: "⚡", text: "Real-time defect detection using vision-based AI models" },
    { icon: "📋", text: "Instant component list generation with specifications" },
    { icon: "💰", text: "Estimation of component value and pricing—often lower than market rate" },
    { icon: "🚀", text: "Fast processing with clean, structured reports" }
  ];

  if (!user) {
      return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 overflow-hidden flex">
      
      <DashboardSidebar 
        user={user} 
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={handleLogout}
        onEditProfile={() => setShowOnboarding(true)}
        theme={theme}
        setTheme={setTheme}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="flex-1 h-screen overflow-y-auto flex flex-col transition-all duration-300 ease-in-out">
        
        <div className="sticky top-0 z-50">
             <Header 
                onNewAnalysis={handleReset} 
                onToggleHistory={() => setIsHistoryOpen(true)}
                onToggleNotifications={isAdmin ? () => setIsAdminNotifOpen(true) : undefined}
                user={null}
                onLogout={handleLogout}
            />
        </div>

        <div className="flex-1 pb-24 md:pb-0">
            <HistoryPanel 
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                history={history}
                onSelect={handleHistorySelect}
                onClear={clearHistory}
                onDelete={removeFromHistory}
            />

            <AdminNotifications 
              isOpen={isAdminNotifOpen} 
              onClose={() => setIsAdminNotifOpen(false)} 
            />
            
            {showOnboarding && (
            <OnboardingModal 
                user={user} 
                onUpdate={handleUpdateProfile}
                onCancel={user.age ? () => setShowOnboarding(false) : undefined}
                theme={theme}
                setTheme={setTheme}
            />
            )}

            {currentView === 'er-resq' && isAdmin && (
                <ERResQ user={user} />
            )}

            {currentView === 'marketplace' && (
                <Marketplace user={user} isAdmin={isAdmin} />
            )}

            {currentView === 'projects' && (
                <ProjectCreator 
                    onGoToStore={() => setCurrentView('marketplace')}
                    onSaveHistory={(project, type) => saveToHistory({
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        type: 'project',
                        project: project,
                        projectSource: type
                    })}
                    initialProject={selectedProject}
                    user={user}
                />
            )}

            {currentView === 'dashboard' && (
                <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 space-y-6 md:space-y-8 pb-24 transition-all duration-300">
                {/* Dashboard content omitted for brevity, logic remains same */}
                <div className="space-y-6 max-w-4xl">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-3">
                    Don’t Throw – Re-Grow
                    </h2>
                    <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-3xl">
                    Get a quick, intelligent overview of your PCB before taking any action. ELECTRORESCUE.AI analyzes the image and provides insights such as component detection, damage identification, and salvage valuation—all in one place.
                    </p>
                </div>

                <div className="bg-slate-900/30 border-l-4 border-emerald-500/50 pl-6 py-2 rounded-r-lg">
                    <h3 className="text-base md:text-lg font-bold text-white mb-2">
                    Overview
                    </h3>
                    <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-3xl">
                    Upload a clear photo of any printed circuit board. Our system identifies the components, detects issues like burns, corrosion, or missing parts, and calculates component-level salvage value.
                    <br className="my-2 block" />
                    You can upload one PCB image at a time, and each analysis will automatically be saved in your History for later review.
                    </p>
                </div>
                </div>

                <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-emerald-500/10 rounded-2xl blur-xl" />
                
                <div className="relative bg-slate-900/40 rounded-2xl p-4 md:p-6 border border-slate-800/50 backdrop-blur-sm shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    System Capabilities
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {capabilities.map((item, i) => (
                        <div 
                        key={i} 
                        className="group p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/5 relative overflow-hidden"
                        >
                        <div className="absolute -top-2 -right-2 text-6xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity grayscale group-hover:grayscale-0 select-none">
                            {item.icon}
                        </div>
                        
                        <div className="relative z-10 flex flex-col gap-2">
                            <span className="text-2xl mb-1 filter drop-shadow-md">{item.icon}</span>
                            <p className="text-sm text-slate-300 group-hover:text-white font-medium leading-relaxed">
                                {item.text}
                            </p>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                </div>

                <div className="grid grid-cols-1 gap-8 items-start">
                
                <div className="relative flex flex-col h-full max-w-4xl w-full mx-auto">
                    {state.imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 shadow-2xl h-full min-h-[400px]">
                        <img 
                        src={state.imagePreview} 
                        alt="PCB Preview" 
                        className="w-full h-full object-contain mx-auto bg-slate-950/50"
                        />
                        {!state.isLoading && (
                        <button 
                            onClick={handleReset}
                            className="absolute top-4 right-4 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-full backdrop-blur-sm border border-slate-700 transition-colors"
                            title="Remove Image"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        )}
                        {state.isLoading && (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                            <div className="text-center">
                                <div className="inline-block w-16 h-1 w-16 bg-blue-500 rounded-full animate-ping mb-4"></div>
                                <p className="text-white font-mono animate-pulse">Scanning PCB topology...</p>
                            </div>
                        </div>
                        )}
                    </div>
                    ) : (
                    <ImageUpload onImageSelect={handleImageSelect} isLoading={state.isLoading} />
                    )}
                    {state.error && (
                    <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm">
                        {state.error}
                    </div>
                    )}
                </div>
                </div>

                {state.result && (
                <div ref={scrollRef} className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <h2 className="text-2xl font-bold text-white">Analysis Report</h2>
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-mono rounded-full border border-blue-500/20">
                        {state.result.pcbCategory || "General PCB"}
                    </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <ComponentList components={state.result.components} summary={state.result.summary} />
                        
                        <div className="bg-slate-800/20 p-6 rounded-lg border border-slate-800">
                        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-yellow-400" />
                            Technical Insights
                        </h3>
                        <p className="text-slate-300 leading-relaxed text-sm">
                            {state.result.technicalInsights}
                        </p>
                        
                        {state.result.suggestions.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-800/50">
                                <h4 className="text-sm font-medium text-slate-400 mb-2">Suggestions</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
                                {state.result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        )}
                        </div>

                        <DamageReport assessment={state.result.damageAssessment} />
                    </div>

                    <div className="space-y-6">
                        <ValuationPanel 
                            cost={state.result.costAnalysis} 
                            valuation={state.result.finalValuation}
                            onAddToMarket={() => handleAddToMarket(state.result!.finalValuation.asIsValue, state.imagePreview)}
                        />
                    </div>
                    </div>
                </div>
                )}
                </main>
            )}

            <ChatWidget userRole={user.role} />
        </div>
        
        {/* Mobile menu and other elements remain the same */}
      </div>
    </div>
  );
};

export default App;
