
import React, { useState, useEffect } from 'react';
import { ProjectIdea, UserProfile } from '../types';
import { generateProjectIdeas, getRecommendedProjects, getProjectGuide } from '../services/geminiService';
import { Lightbulb, PenTool, Loader2, AlertCircle, CheckCircle2, ListOrdered, ShoppingBag, Clock, ChevronRight, ChevronDown, ChevronUp, Sparkles, Zap, Cpu, Signal, Wrench, Search, ArrowLeft, ArrowRight, Mail, RefreshCw } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';
import Marketplace from './Marketplace';

interface ProjectCreatorProps {
  onGoToStore?: () => void;
  onSaveHistory: (project: ProjectIdea, type: 'inventory' | 'recommended') => void;
  initialProject: ProjectIdea | null;
  user: UserProfile | null;
}

const ADMIN_EMAIL = 'electrorescuehelp@gmail.com';

const ProjectCreator: React.FC<ProjectCreatorProps> = ({ onGoToStore, onSaveHistory, initialProject, user }) => {
  const [view, setView] = useState<'landing' | 'create' | 'explore' | 'guide'>('landing');
  
  // Create Your Own State
  const [components, setComponents] = useState('');
  const [generatedProjects, setGeneratedProjects] = useState<ProjectIdea[]>([]);
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
  
  // Explore State
  const [recommendedProjects, setRecommendedProjects] = useState<ProjectIdea[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Beginner' | 'Intermediate' | 'Advanced'>('All');
  const [seenProjectTitles, setSeenProjectTitles] = useState<Set<string>>(new Set());

  // Guide View State
  const [currentProject, setCurrentProject] = useState<ProjectIdea | null>(null);
  // Changed from boolean to string to track specific loading item
  const [loadingGuideTitle, setLoadingGuideTitle] = useState<string | null>(null);
  const [requestingKit, setRequestingKit] = useState(false);

  // Store Overlay State (Keeps ProjectCreator mounted to preserve state)
  const [showStore, setShowStore] = useState(false);

  // Shared State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effect to handle incoming project from history or other components
  useEffect(() => {
    if (initialProject) {
      // Direct access to guide if project is passed
      setCurrentProject(initialProject);
      setView('guide');
      onSaveHistory(initialProject, 'inventory'); // Assuming default inventory, or logic to track source
    }
  }, [initialProject]);

  const fetchRecommended = async (refresh = false) => {
      // If we already have projects and not refreshing, don't fetch
      if(!refresh && recommendedProjects.length > 0) return;
      
      setLoadingRecommended(true);
      try {
          // Pass the list of already seen titles to avoid duplicates
          const excludeList = Array.from(seenProjectTitles) as string[];
          const res = await getRecommendedProjects(excludeList);
          
          setRecommendedProjects(res);
          
          // Add new titles to seen set
          const newSet = new Set(seenProjectTitles);
          res.forEach(p => newSet.add(p.title));
          setSeenProjectTitles(newSet);
          
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingRecommended(false);
      }
  };

  useEffect(() => {
      if(view === 'explore') {
          fetchRecommended();
      }
  }, [view]);

  const handleGenerate = async () => {
    if (!components.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setGeneratedProjects([]);
    setExpandedProjectId(null);

    try {
      const results = await generateProjectIdeas(components);
      setGeneratedProjects(results);
    } catch (err) {
      setError("Failed to generate ideas. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpandProject = (index: number, project: ProjectIdea) => {
      if(expandedProjectId === index) {
          setExpandedProjectId(null);
      } else {
          setExpandedProjectId(index);
          // Save to global history when viewed
          onSaveHistory(project, 'inventory');
      }
  };

  // Reset Create state when leaving the view to Landing
  const handleBackFromCreate = () => {
      setView('landing');
      // Wipe data to allow fresh creation next time
      setComponents('');
      setGeneratedProjects([]);
      setExpandedProjectId(null);
      setError(null);
  };

  const handleViewGuide = async (project: ProjectIdea, source: 'inventory' | 'recommended') => {
      setLoadingGuideTitle(project.title);
      
      let projectToView = { ...project };
      
      // Fetch steps if missing
      if (!projectToView.steps || projectToView.steps.length === 0) {
          try {
              const steps = await getProjectGuide(project.title, project.missingComponents);
              projectToView.steps = steps;
              
              // Update local lists so we don't refetch
              if (source === 'recommended') {
                  setRecommendedProjects(prev => prev.map(p => p.title === project.title ? projectToView : p));
              } else {
                  setGeneratedProjects(prev => prev.map(p => p.title === project.title ? projectToView : p));
              }

          } catch (e) {
              console.error("Failed to fetch guide");
          }
      }

      setCurrentProject(projectToView);
      onSaveHistory(projectToView, source);
      setLoadingGuideTitle(null);
      setView('guide');
  };

  const handleContactAdmin = async () => {
    if (!user || !currentProject) return;
    if (!window.confirm(`Request a kit quote for "${currentProject.title}" from the Admin?`)) return;

    setRequestingKit(true);
    try {
        await addDoc(collection(db, "buy_requests"), {
            itemId: `KIT-${Date.now()}`,
            itemTitle: `Project Kit: ${currentProject.title}`,
            itemPrice: 'Quote Requested',
            buyerName: user.name,
            buyerEmail: user.email,
            buyerPhone: '', // Optional, or prompt user
            buyerAddress: '', // Optional
            buyerDomain: user.domain || '',
            timestamp: Date.now(),
            status: 'requested',
            type: 'project_kit' // Explicit type for Admin filtering
        });
        alert("Request sent successfully! Admin will see this in 'Project Requests'.");
    } catch (e) {
        console.error("Error sending request:", e);
        alert("Failed to send request. Please try again.");
    } finally {
        setRequestingKit(false);
    }
  };

  const getDifficultyStyle = (diff: string) => {
    switch (diff) {
      case 'Beginner': return { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: <Signal className="w-3 h-3" /> };
      case 'Intermediate': return { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Zap className="w-3 h-3" /> };
      case 'Advanced': return { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: <Cpu className="w-3 h-3" /> };
      default: return { color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700', icon: <Signal className="w-3 h-3" /> };
    }
  };

  // --- INTERNAL STORE OVERLAY ---
  if (showStore && user) {
      return (
          <div className="h-full flex flex-col bg-slate-950 animate-in fade-in slide-in-from-bottom-10 duration-300">
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setShowStore(false)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 flex items-center gap-2 transition-all group"
                      >
                          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
                          <span className="text-sm font-bold">Back to Project</span>
                      </button>
                      <div className="h-6 w-px bg-slate-800 mx-2"></div>
                      <span className="text-sm text-slate-400">ResQ-Store Overlay</span>
                  </div>
              </div>
              <div className="flex-1 overflow-hidden">
                  <Marketplace user={user} isAdmin={user.email === ADMIN_EMAIL} />
              </div>
          </div>
      );
  }

  // --- VIEW: LANDING PAGE ---
  if (view === 'landing') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 h-full flex flex-col justify-center">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
               <PenTool className="w-8 h-8 text-white" />
           </div>
           <h2 className="text-4xl font-bold text-white mb-4">Project Engineer</h2>
           <p className="text-slate-400 text-lg max-w-2xl mx-auto">
             Transform your components into working prototypes. Choose how you want to start building today.
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
           {/* Card 1: Create Your Own */}
           <button 
             onClick={() => setView('create')}
             className="group relative bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-8 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 overflow-hidden"
           >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <PenTool className="w-24 h-24 text-emerald-500" />
              </div>
              <div className="relative z-10">
                 <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                     <Sparkles className="w-6 h-6 text-emerald-500" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">Create Your Own</h3>
                 <p className="text-slate-400 mb-6 leading-relaxed">
                    Input your inventory list and let our AI generate tailored projects based on exactly what you have on hand.
                 </p>
                 <span className="inline-flex items-center text-sm font-bold text-emerald-500 group-hover:gap-2 transition-all">
                    Start Building <ArrowRight className="w-4 h-4 ml-1" />
                 </span>
              </div>
           </button>

           {/* Card 2: Explore Ideas */}
           <button 
             onClick={() => setView('explore')}
             className="group relative bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-8 text-left transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 overflow-hidden"
           >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Lightbulb className="w-24 h-24 text-blue-500" />
              </div>
              <div className="relative z-10">
                 <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                     <Lightbulb className="w-6 h-6 text-blue-500" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Explore Ideas</h3>
                 <p className="text-slate-400 mb-6 leading-relaxed">
                    Browse our curated list of 10 recommended projects ranging from beginner circuits to advanced robotics.
                 </p>
                 <span className="inline-flex items-center text-sm font-bold text-blue-500 group-hover:gap-2 transition-all">
                    View Catalog <ArrowRight className="w-4 h-4 ml-1" />
                 </span>
              </div>
           </button>
        </div>
      </div>
    );
  }

  // --- VIEW: BUILD GUIDE (New Page) ---
  if (view === 'guide' && currentProject) {
      const style = getDifficultyStyle(currentProject.difficulty);
      
      return (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-64px)] flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-4 mb-6 shrink-0">
                  <button 
                    onClick={() => setView(expandedProjectId !== null ? 'create' : 'explore')} 
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-800 hover:border-slate-700 flex items-center gap-2"
                  >
                      <ArrowLeft className="w-5 h-5" /> <span className="text-sm font-bold hidden sm:inline">Back</span>
                  </button>
                  <div>
                      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                         {currentProject.title}
                         <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${style.color} ${style.bg} ${style.border}`}>
                              {style.icon} {currentProject.difficulty}
                          </span>
                      </h2>
                  </div>
              </div>

              {/* Main Content Split */}
              <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
                  
                  {/* Left Column: Info & Parts */}
                  <div className="w-full lg:w-1/3 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                       <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
                           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Project Overview</h3>
                           <p className="text-slate-300 leading-relaxed text-sm">
                               {currentProject.description}
                           </p>
                       </div>

                       <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex-1">
                           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                               <Cpu className="w-4 h-4 text-emerald-500" /> Required Components
                           </h3>
                           <div className="flex flex-wrap gap-2">
                               {currentProject.missingComponents.map((component, idx) => (
                                   <div key={idx} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
                                       <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div>
                                       <span className="text-sm text-slate-200">{component}</span>
                                   </div>
                               ))}
                           </div>
                           
                           {/* Action Buttons */}
                           <div className="mt-8 space-y-3">
                               {projectCreatorCanAccessStore && currentProject.missingComponents.length > 0 && (
                                   <button 
                                      onClick={() => setShowStore(true)}
                                      className="w-full py-3 bg-slate-800 hover:bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/10"
                                   >
                                      <ShoppingBag className="w-5 h-5" /> Check ResQ Store
                                   </button>
                               )}
                               
                               <button 
                                  onClick={handleContactAdmin}
                                  disabled={requestingKit}
                                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
                               >
                                  {requestingKit ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                  Contact Admin (Request Kit)
                               </button>
                               <p className="text-center text-[10px] text-slate-500 mt-2">
                                   Request a quote for the complete kit from the admin team.
                               </p>
                           </div>
                       </div>
                  </div>

                  {/* Right Column: Steps */}
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 overflow-y-auto custom-scrollbar shadow-xl">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                          <ListOrdered className="w-6 h-6 text-blue-500" /> Build Instructions
                      </h3>
                      
                      {currentProject.steps && currentProject.steps.length > 0 ? (
                          <div className="space-y-8 relative">
                              {/* Connector Line */}
                              <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-800"></div>

                              {currentProject.steps.map((step, idx) => (
                                  <div key={idx} className="relative flex gap-6 group">
                                      <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-blue-500/50 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0 z-10 group-hover:border-blue-400 group-hover:scale-110 transition-all shadow-lg shadow-blue-900/20">
                                          {idx + 1}
                                      </div>
                                      <div className="flex-1 pt-1">
                                          <p className="text-slate-300 leading-relaxed text-base group-hover:text-white transition-colors">
                                              {step}
                                          </p>
                                      </div>
                                  </div>
                              ))}
                              
                              <div className="relative flex gap-6 pt-4">
                                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0 z-10">
                                      <CheckCircle2 className="w-5 h-5" />
                                  </div>
                                  <div className="pt-1">
                                      <h4 className="text-emerald-400 font-bold">Project Complete!</h4>
                                      <p className="text-sm text-slate-500 mt-1">Share your build with the community.</p>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="h-64 flex flex-col items-center justify-center text-slate-500">
                             <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                             <p>Loading build guide...</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  // --- VIEW: CREATE YOUR OWN (Inventory Matcher) ---
  if (view === 'create') {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-64px)] flex flex-col">
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={handleBackFromCreate} 
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center gap-2 group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold hidden sm:inline">Back</span>
                </button>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-emerald-500" /> Create Your Own
                </h2>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden bg-slate-950/30 rounded-2xl border border-slate-800/50 animate-in fade-in slide-in-from-right-4 duration-500">
                 {/* Left: Input Panel */}
                 <div className="w-full md:w-1/3 p-6 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
                        <div className="mb-6">
                            <label className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-3 block flex items-center gap-2">
                                <Search className="w-4 h-4 text-emerald-500" />
                                Your Inventory
                            </label>
                            <textarea
                                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none leading-relaxed transition-all shadow-inner"
                                placeholder="List your components here...&#10;Example:&#10;- Arduino Uno&#10;- 2x Servo Motors&#10;- Ultrasonic Sensor&#10;- Breadboard&#10;- Jumper Wires"
                                value={components}
                                onChange={(e) => setComponents(e.target.value)}
                            />
                        </div>
                        
                        {error && (
                            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !components.trim()}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-900/20 group"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:text-yellow-200 transition-colors" />}
                            Generate 5 Projects
                        </button>
                    </div>

                    {/* Right: Results Panel */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-950/50">
                        {generatedProjects.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60">
                                <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800">
                                    <Sparkles className="w-10 h-10 text-emerald-900" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-500">Ready to build?</h3>
                                <p className="text-sm max-w-xs text-center mt-2">Enter your components on the left to generate tailored project ideas.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-3xl mx-auto">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                                    <h3 className="text-lg font-bold text-white">Project Matches</h3>
                                    <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                                        {generatedProjects.length} Results
                                    </span>
                                </div>

                                {generatedProjects.map((project, idx) => {
                                     const isExpanded = expandedProjectId === idx;
                                     const style = getDifficultyStyle(project.difficulty);
                                     
                                     return (
                                         <div 
                                            key={idx} 
                                            onClick={() => handleExpandProject(idx, project)}
                                            className={`bg-slate-900 border transition-all duration-300 rounded-xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-xl
                                                ${isExpanded ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-slate-800 hover:border-slate-700'}
                                            `}
                                         >
                                             <div className="p-5 flex items-center gap-5">
                                                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${style.bg} ${style.border}`}>
                                                     {style.icon}
                                                 </div>
                                                 <div className="flex-1 min-w-0">
                                                     <div className="flex items-center gap-3 mb-1">
                                                         <h4 className={`font-bold text-lg truncate ${isExpanded ? 'text-emerald-400' : 'text-white group-hover:text-emerald-400'} transition-colors`}>{project.title}</h4>
                                                         <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${style.color} ${style.bg} ${style.border}`}>{project.difficulty}</span>
                                                     </div>
                                                     <p className="text-slate-400 text-sm line-clamp-1">{project.description}</p>
                                                 </div>
                                                 <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180 text-emerald-500' : ''}`} />
                                             </div>

                                             {/* Details (Expanded) */}
                                             {isExpanded && (
                                                 <div className="px-6 pb-6 pt-2 border-t border-slate-800/50 bg-slate-950/30 animate-in slide-in-from-top-2 duration-200">
                                                     <p className="text-slate-300 text-sm mb-6 leading-relaxed bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                                         {project.description}
                                                     </p>
                                                     
                                                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                                         <div>
                                                             <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Missing Components</h5>
                                                             {project.missingComponents.length > 0 ? (
                                                                 <div className="flex flex-wrap gap-2">
                                                                     {project.missingComponents.map((c, i) => (
                                                                         <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1.5 rounded-md border border-slate-700">{c}</span>
                                                                     ))}
                                                                 </div>
                                                             ) : (
                                                                 <div className="text-green-400 text-sm flex items-center gap-2 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                                                                     <CheckCircle2 className="w-4 h-4" /> Build Ready!
                                                                 </div>
                                                             )}
                                                             
                                                             {/* LARGE RESQ STORE BUTTON */}
                                                             {projectCreatorCanAccessStore && project.missingComponents.length > 0 && (
                                                                 <button onClick={(e) => { e.stopPropagation(); setShowStore(true); }} className="mt-6 w-full py-4 bg-slate-800 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl transition-all text-lg font-bold flex items-center justify-center gap-3 shadow-lg group/btn">
                                                                     <ShoppingBag className="w-6 h-6 group-hover/btn:scale-110 transition-transform" /> 
                                                                     Find parts in ResQ-Store
                                                                 </button>
                                                             )}
                                                         </div>

                                                         <div>
                                                             <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Build Guide</h5>
                                                             <div className="space-y-3">
                                                                 {project.steps?.map((step, i) => (
                                                                     <div key={i} className="flex gap-3 text-sm text-slate-300">
                                                                         <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i+1}</span>
                                                                         <span className="leading-snug">{step}</span>
                                                                     </div>
                                                                 ))}
                                                             </div>
                                                         </div>
                                                     </div>

                                                     {/* Close/Back Button Inside Card */}
                                                     <div className="flex justify-center pt-2 border-t border-slate-800/50">
                                                         <button 
                                                            onClick={(e) => { e.stopPropagation(); setExpandedProjectId(null); }}
                                                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors py-2"
                                                         >
                                                             <ChevronUp className="w-4 h-4" /> Close Details
                                                         </button>
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     );
                                 })}
                            </div>
                        )}
                    </div>
            </div>
        </div>
      );
  }

  // --- VIEW: EXPLORE IDEAS (Recommended) ---
  if (view === 'explore') {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-64px)] flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setView('landing')} 
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center gap-2 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-bold hidden sm:inline">Back</span>
                    </button>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Lightbulb className="w-6 h-6 text-blue-500" /> Explore Ideas
                    </h2>
                </div>
                
                <button 
                  onClick={() => fetchRecommended(true)}
                  disabled={loadingRecommended}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 hover:text-white transition-all disabled:opacity-50"
                  title="Generate new unique ideas"
                >
                    <RefreshCw className={`w-4 h-4 ${loadingRecommended ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh Ideas</span>
                </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-950/30 rounded-2xl border border-slate-800/50 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Curated Projects</h3>
                            <p className="text-slate-400 text-sm">Hand-picked builds from simple circuits to advanced robotics.</p>
                        </div>
                        <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
                            {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => setDifficultyFilter(level)}
                                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${difficultyFilter === level ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loadingRecommended ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <p className="text-slate-500 text-sm">Curating best projects for you...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {recommendedProjects
                                .filter(p => difficultyFilter === 'All' || p.difficulty === difficultyFilter)
                                .map((project, idx) => {
                                    const style = getDifficultyStyle(project.difficulty);
                                    
                                    return (
                                        <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-slate-600 transition-all hover:-translate-y-1 shadow-lg group h-full">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`p-2.5 rounded-xl border ${style.bg} ${style.border}`}>
                                                    {style.icon}
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${style.color} ${style.bg} ${style.border}`}>
                                                    {project.difficulty}
                                                </span>
                                            </div>
                                            
                                            <h4 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{project.title}</h4>
                                            <p className="text-slate-400 text-sm leading-relaxed mb-6">{project.description}</p>
                                            
                                            <div className="mt-auto">
                                                <div className="mb-6 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Required Components</span>
                                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                                        {project.missingComponents.map((c, i) => (
                                                            <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">{c}</span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={() => handleViewGuide(project, 'recommended')}
                                                    disabled={loadingGuideTitle !== null}
                                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
                                                >
                                                    {loadingGuideTitle === project.title ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                                                    View Build Guide
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
            </div>
        </div>
      );
  }

  // Fallback
  return null;
};

// Helper constant for code readability
const projectCreatorCanAccessStore = true; 

export default ProjectCreator;
