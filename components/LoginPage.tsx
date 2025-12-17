
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Loader2, Mail, Lock, User, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck, Info, ShieldAlert, KeyRound, RefreshCw, Save, Eye, EyeOff, ShieldPlus, Zap, ChevronRight } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { sendSecureOTP, sendGeneralEmail } from '../services/emailService';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    User as FirebaseUser
} from 'firebase/auth';

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
}

const ADMIN_EMAIL = 'electrorescuehelp@gmail.com';
const DEFAULT_MASTER_KEY = 'ER_ADMIN_2025'; // Fallback if not set in DB

const ElectroRescueLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="8" cy="8" r="2" />
    <circle cx="16" cy="8" r="2" />
    <path d="M8 10V12L12 14" />
    <path d="M16 10V12L12 14" />
    <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    <path d="M3 14H8C9.1 14 10 14.9 10 16V21H7C4.8 21 3 19.2 3 17V14Z" fill="currentColor" stroke="none" />
    <path d="M5.5 19L6.5 16.5H5L7 14.5L6 17H7.5L5.5 19Z" fill="#1e293b" stroke="none" />
  </svg>
);

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  // Added 'admin-select-method' and 'admin-key-entry' to view state
  const [view, setView] = useState<'login' | 'register' | 'forgot-password' | 'forgot-password-otp' | 'reset-password-form' | 'register-otp' | 'admin-login' | 'admin-select-method' | 'admin-key-entry' | 'admin-otp' | 'admin-register'>('login');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    masterKey: '', // For admin creation
    loginKey: ''   // For admin quick login
  });

  // Password Visibility States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // State for Admin Flow
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [tempAdminUser, setTempAdminUser] = useState<FirebaseUser | null>(null);
  
  // State for User Registration OTP
  const [registerOtpInput, setRegisterOtpInput] = useState('');
  const [registerGeneratedOtp, setRegisterGeneratedOtp] = useState<string | null>(null);
  const [tempRegisterUser, setTempRegisterUser] = useState<FirebaseUser | null>(null);

  // State for Password Reset Flow
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtpInput, setResetOtpInput] = useState('');
  const [resetGeneratedOtp, setResetGeneratedOtp] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Helper to reset password visibility when changing views
  const changeView = (newView: typeof view) => {
    setView(newView);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setSuccess('');
  };

  // Sync Firebase Auth User with Firestore Profile
  const fetchUserProfile = async (firebaseUser: FirebaseUser) => {
    const userRef = doc(db, "users", firebaseUser.email!);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const profile = userSnap.data() as UserProfile;
        
        // Check verification status from Firestore (primary source of truth now)
        // or Firebase Auth (legacy/link source)
        if (profile.verified || firebaseUser.emailVerified) {
             if (!profile.verified) {
                 await updateDoc(userRef, { verified: true });
                 profile.verified = true;
             }
             onLogin(profile);
        } else {
             // User exists but not verified
             setError("Account not verified. Please complete verification.");
             await auth.signOut();
        }
    } else {
        // Create profile if missing (fallback)
        const fallbackProfile: UserProfile = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || formData.name || 'User',
            email: firebaseUser.email!,
            role: 'Student',
            verified: firebaseUser.emailVerified
        };
        await setDoc(userRef, fallbackProfile);
        
        if (fallbackProfile.verified) {
            onLogin(fallbackProfile);
        } else {
             setError("Account created but not verified.");
             await auth.signOut();
        }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Input Validation
    if (!formData.email || !formData.password) {
        setError("Please enter both email and password.");
        return;
    }

    const email = formData.email.trim();
    
    // 1. Security Check: Prevent Admin login via User form
    if (view === 'login' && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setError("Restricted Access: This email is reserved for Administrators. Please use the Admin Portal.");
        return;
    }

    setIsLoading(true);

    try {
        // Attempt Standard Firebase Auth Login
        const userCredential = await signInWithEmailAndPassword(auth, email, formData.password);
        const user = userCredential.user;
        await handleSuccessfulAuth(user);

    } catch (err: any) {
        // FALLBACK STRATEGY: Hybrid Auth
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
             try {
                 const userRef = doc(db, "users", email);
                 const userSnap = await getDoc(userRef);

                 if (userSnap.exists()) {
                     const profile = userSnap.data() as UserProfile;
                     
                     // Verify against stored password (Simulated Auth)
                     if (profile.password === formData.password) {
                         
                         // Admin Check
                         if (view === 'admin-login') {
                            if (profile.role !== 'Admin') {
                                setError("Access Denied: Not an admin account.");
                                setIsLoading(false);
                                return;
                            }
                            // MOCK User for admin flow state
                            const mockUser = { email: email, uid: profile.id } as FirebaseUser;
                            setTempAdminUser(mockUser);
                            changeView('admin-select-method'); // Go to Method Selection
                            setIsLoading(false);
                            return;
                         }

                         // Regular User Login
                         if (profile.verified) {
                             onLogin(profile);
                             return;
                         } else {
                             setError("Account not verified.");
                             setIsLoading(false);
                             return;
                         }
                     }
                 }
             } catch (firestoreErr) {
                 console.error("Fallback login error", firestoreErr);
             }
        }

        // Handle standard errors
        const code = err.code;
        if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
            setError("Invalid email or password.");
        } else if (code === 'auth/invalid-email') {
            setError("The email address is badly formatted.");
        } else if (code === 'auth/too-many-requests') {
            setError("Too many attempts. Try again later.");
        } else {
            console.error("Login Error:", err);
            setError("Login failed. Please try again.");
        }
    } finally {
        // Stop loading only if we are staying on this view (error case) or standard user login
        if (view === 'login' || error) {
            setIsLoading(false);
        }
    }
  };

  const handleSuccessfulAuth = async (user: FirebaseUser) => {
    // 2. Admin Login Logic
    if (view === 'admin-login') {
        // Fetch user role from Firestore to confirm Admin status
        const userRef = doc(db, "users", user.email!);
        const userSnap = await getDoc(userRef);
        
        let isAdmin = false;
        if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            isAdmin = data.role === 'Admin' || user.email === ADMIN_EMAIL;
        }

        if (!isAdmin) {
            setError("Access Denied: This account does not have admin privileges.");
            await auth.signOut();
            setIsLoading(false);
            return;
        }

        // --- CHANGE: Move to Selection Screen instead of sending OTP immediately ---
        setTempAdminUser(user);
        changeView('admin-select-method');
        setIsLoading(false);
        return;
    }

    // 3. Regular User Login Logic
    const userRef = doc(db, "users", user.email!);
    const userSnap = await getDoc(userRef);
    let isVerified = user.emailVerified;

    if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.verified === true) isVerified = true;
    }

    if (isVerified) {
        await fetchUserProfile(user);
    } else {
        setError("Email not verified. Please verify your account.");
        await auth.signOut();
    }
  };

  const handleInitiateOTP = async () => {
      if (!tempAdminUser || !tempAdminUser.email) return;
      setIsLoading(true);
      setError('');

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const sentMessage = await sendSecureOTP(tempAdminUser.email, code, 'verification');
        
      if (!sentMessage) {
          setError("Failed to send OTP. Please try Access Key.");
          setIsLoading(false);
          return;
      }

      setGeneratedOtp(code);
      changeView('admin-otp');
      setIsLoading(false);
  };

  const handleAccessKeyLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.loginKey) {
          setError("Please enter your Access Key.");
          return;
      }
      if (!tempAdminUser || !tempAdminUser.email) return;

      setIsLoading(true);
      try {
          const userRef = doc(db, "users", tempAdminUser.email);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
              const profile = userSnap.data() as UserProfile;
              if (profile.loginKey === formData.loginKey) {
                  setSuccess("Access Granted.");
                  setTimeout(() => {
                      onLogin(profile);
                  }, 800);
              } else {
                  setError("Invalid Access Key.");
                  setIsLoading(false);
              }
          } else {
              setError("Profile not found.");
              setIsLoading(false);
          }
      } catch (err) {
          setError("Verification failed.");
          setIsLoading(false);
      }
  };

  const handleAdminRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');

      if (!formData.name || !formData.email || !formData.password || !formData.masterKey) {
          setError("All fields are required, including the Master Key.");
          return;
      }

      if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match.");
          return;
      }

      setIsLoading(true);

      try {
          // 1. Verify Master Key
          let currentMasterKey = DEFAULT_MASTER_KEY;
          try {
              const configRef = doc(db, 'system_config', 'admin_settings');
              const configSnap = await getDoc(configRef);
              if (configSnap.exists() && configSnap.data().masterKey) {
                  currentMasterKey = configSnap.data().masterKey;
              }
          } catch (err) {
              console.warn("Could not fetch dynamic master key, using default.");
          }

          if (formData.masterKey !== currentMasterKey) {
              setError("Invalid Master Security Key. Authorization failed.");
              setIsLoading(false);
              return;
          }

          // 2. CHECK ADMIN LIMIT (Max 3: 1 Main + 2 Additional)
          const adminQuery = query(collection(db, "users"), where("role", "==", "Admin"));
          const adminSnap = await getDocs(adminQuery);
          if (adminSnap.size >= 3) {
              setError("Admin limit reached (Max 3). Cannot create more admins.");
              setIsLoading(false);
              return;
          }

          // 3. Create User in Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          const user = userCredential.user;

          // 4. Create Admin Profile in Firestore
          const userRef = doc(db, "users", formData.email);
          const newAdmin: UserProfile = {
              id: user.uid,
              name: formData.name,
              email: formData.email,
              role: 'Admin', // Set Role to Admin
              verified: true, // Auto-verify admins created with Master Key
              password: formData.password
          };
          await setDoc(userRef, newAdmin);

          setSuccess("Admin Account Created Successfully!");
          
          setTimeout(() => {
              setSuccess('');
              changeView('admin-login');
              setFormData({ name: '', email: formData.email, password: '', confirmPassword: '', masterKey: '', loginKey: '' });
          }, 1500);

      } catch (err: any) {
          console.error("Admin Registration Error:", err);
          setError(err.message || "Failed to create admin account.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleAdminOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (otpInput === generatedOtp && tempAdminUser) {
        setSuccess("Identity Verified. Logging in...");
        
        try {
            await sendGeneralEmail(
                ADMIN_EMAIL,
                "🚨 Security Alert: Admin Login Detected",
                `An Admin login session was authorized for ${tempAdminUser.email} via OTP.\n\nTime: ${new Date().toLocaleString()}`
            );
        } catch (emailErr) {
            console.warn("Failed to send admin login alert:", emailErr);
        }

        // If we are in fallback mode (tempAdminUser is a mock), fetch profile directly
        if (!tempAdminUser.reload) { // .reload exists on real FirebaseUser
             const userRef = doc(db, "users", tempAdminUser.email!);
             const userSnap = await getDoc(userRef);
             if (userSnap.exists()) {
                 onLogin(userSnap.data() as UserProfile);
             }
        } else {
             await fetchUserProfile(tempAdminUser);
        }

    } else {
        setError("Invalid OTP Code. Please try again.");
        setIsLoading(false);
    }
  };

  // ... rest of user register/reset handlers (omitted for brevity as they haven't changed, but must be included in final file)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name || !formData.email || !formData.password) {
        setError("Please fill in all fields.");
        return;
    }

    const email = formData.email.trim();

    if (email === ADMIN_EMAIL) {
        setError("Cannot register with this email address.");
        return;
    }
    if (formData.password.length < 6) {
        setError("Password should be at least 6 characters.");
        return;
    }
    if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match.");
        return;
    }

    setIsLoading(true);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
        const user = userCredential.user;

        const userRef = doc(db, "users", email);
        const newUser: UserProfile = {
            id: user.uid,
            name: formData.name,
            email: email,
            role: 'Student',
            verified: false,
            password: formData.password 
        };
        await setDoc(userRef, newUser);

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const sent = await sendSecureOTP(email, code, 'verification');

        if (sent) {
            setRegisterGeneratedOtp(code);
            setTempRegisterUser(user);
            changeView('register-otp'); 
        } else {
            setError("Account created, but failed to send email. Please try logging in to resend.");
            await auth.signOut();
        }

    } catch (err: any) {
        const code = err.code;
        if (code === 'auth/email-already-in-use') {
            setError("Email already registered. Please login.");
        } else if (code === 'auth/invalid-email') {
            setError("The email address is badly formatted.");
        } else {
            console.error("Register Error:", err);
            setError("Registration failed: " + err.message);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegisterOtpVerify = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      if (registerOtpInput === registerGeneratedOtp && tempRegisterUser) {
          try {
              const userRef = doc(db, "users", tempRegisterUser.email!);
              await updateDoc(userRef, { verified: true });
              setSuccess("Verification Successful! Logging you in...");
              setTimeout(async () => {
                  await fetchUserProfile(tempRegisterUser);
              }, 1000);
          } catch (err) {
              console.error("Verification update failed:", err);
              setError("Failed to update verification status. Please contact support.");
              setIsLoading(false);
          }
      } else {
          setError("Invalid Verification Code.");
          setIsLoading(false);
      }
  };

  const handleResendRegisterOtp = async () => {
      if (!tempRegisterUser) return;
      setIsLoading(true);
      setError('');
      setSuccess('');
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const sent = await sendSecureOTP(tempRegisterUser.email!, code, 'verification');
      if (sent) {
          setRegisterGeneratedOtp(code);
          setSuccess("New code sent!");
      } else {
          setError("Failed to resend code.");
      }
      setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      if (!formData.email) {
          setError("Please enter your registered email address.");
          return;
      }
      const email = formData.email.trim();
      setIsLoading(true);
      try {
          const userRef = doc(db, "users", email);
          const docSnap = await getDoc(userRef);
          if (!docSnap.exists()) {
             setError("No account found with this email.");
             setIsLoading(false);
             return;
          }
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const sent = await sendSecureOTP(email, code, 'reset');
          if (sent) {
             setResetGeneratedOtp(code);
             setResetEmail(email);
             setSuccess("OTP sent to your email!");
             setTimeout(() => {
                 setSuccess('');
                 changeView('forgot-password-otp');
             }, 1000);
          } else {
             setError("Failed to send OTP. Please try again.");
          }
      } catch (err: any) {
          console.error("Forgot Pass Error", err);
          setError("Something went wrong. Please try again.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleResetOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    if (resetOtpInput === resetGeneratedOtp) {
        setSuccess("Code Verified!");
        setTimeout(() => {
            setSuccess('');
            changeView('reset-password-form');
            setIsLoading(false);
        }, 800);
    } else {
        setError("Invalid Code. Please try again.");
        setIsLoading(false);
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (newPassword.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
      }
      if (newPassword !== confirmNewPassword) {
          setError("Passwords do not match.");
          return;
      }
      setIsLoading(true);
      try {
          const userRef = doc(db, "users", resetEmail);
          await updateDoc(userRef, { password: newPassword });
          setSuccess("Password Reset Successfully!");
          setTimeout(() => {
              changeView('login');
              setResetEmail('');
              setResetGeneratedOtp(null);
              setResetOtpInput('');
              setNewPassword('');
              setConfirmNewPassword('');
              setFormData({ ...formData, email: resetEmail, password: '', masterKey: '', loginKey: '' });
              setSuccess('Please sign in with your new password.');
          }, 1500);
      } catch (err) {
          console.error("Reset Update Error", err);
          setError("Failed to update password.");
      } finally {
          setIsLoading(false);
      }
  };

  // Updated class with extra padding for the eye icon
  const inputWithIconClass = "w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-10 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      
      {/* Card Container */}
      <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-800 shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
        
        {/* --- LOGIN VIEW --- */}
        {view === 'login' && (
            <div className="space-y-6">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 mb-4 shadow-lg shadow-emerald-900/10">
                        <ElectroRescueLogo className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">ElectroRescue AI</h1>
                    <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-in slide-in-from-top-2">
                           <AlertCircle className="w-4 h-4 shrink-0" />
                           {error}
                        </div>
                    )}
                     {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type="email" 
                                className={inputWithIconClass}
                                placeholder="name@university.edu"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                             <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                             <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors" onClick={() => changeView('forgot-password')}>
                                Forgot Password?
                             </button>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                className={inputWithIconClass}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
                    </button>
                </form>

                <div className="text-center text-sm text-slate-400 pt-2">
                    New to ElectroRescue?{' '}
                    <button onClick={() => changeView('register')} className="text-blue-400 font-medium hover:text-blue-300 hover:underline transition-colors">
                        Create Account
                    </button>
                </div>

                {/* Admin Shortcut */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-slate-900 px-2 text-slate-500">or</span>
                    </div>
                </div>

                <div className="text-center text-sm text-slate-400">
                    Are you an Admin?{' '}
                    <button 
                        onClick={() => {
                            changeView('admin-login');
                            setFormData({ name: '', email: '', password: '', confirmPassword: '', masterKey: '', loginKey: '' });
                        }} 
                        className="text-blue-400 font-medium hover:text-blue-300 hover:underline transition-colors"
                    >
                        Login as Admin
                    </button>
                </div>
            </div>
        )}

        {/* ... [Register, OTP, Forgot Password views remain same, included in previous block] ... */}
        {view === 'register' && (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Create Account</h1>
                    <p className="text-slate-400 text-sm">Join the community to start analyzing.</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                className={inputWithIconClass}
                                placeholder="Your Name"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type="email" 
                                className={inputWithIconClass}
                                placeholder="email@example.com"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type={showPassword ? "text" : "password"}
                                className={inputWithIconClass}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type={showConfirmPassword ? "text" : "password"}
                                className={inputWithIconClass}
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign Up & Verify"}
                    </button>
                </form>

                <div className="text-center text-sm text-slate-400">
                    Already have an account?{' '}
                    <button onClick={() => changeView('login')} className="text-blue-400 font-medium hover:text-blue-300 hover:underline transition-colors">
                        Sign In
                    </button>
                </div>
            </div>
        )}

        {view === 'register-otp' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-blue-900/20 p-3 rounded-xl border border-blue-500/30 mb-4 shadow-lg shadow-blue-900/10">
                        <Mail className="w-8 h-8 text-blue-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Verify Email</h1>
                    <p className="text-slate-400 text-sm mt-1">We sent a 6-digit code to</p>
                    <p className="text-white font-medium text-sm">{formData.email}</p>
                </div>

                <form onSubmit={handleRegisterOtpVerify} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-in slide-in-from-top-2">
                           <AlertCircle className="w-4 h-4 shrink-0" />
                           {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    <div className="space-y-2">
                         <label className="text-xs font-semibold text-blue-500 uppercase tracking-wider text-center block">Verification Code</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-center tracking-[0.5em] text-lg"
                                placeholder="000000"
                                maxLength={6}
                                value={registerOtpInput}
                                onChange={e => setRegisterOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                        </div>
                    </div>

                     <button 
                        type="submit" 
                        disabled={isLoading || registerOtpInput.length !== 6}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Account"}
                    </button>

                    <button
                        type="button"
                        onClick={handleResendRegisterOtp}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-white transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" /> Resend Code
                    </button>
                </form>

                <div className="text-center">
                     <button 
                        onClick={() => {
                            changeView('login');
                            setRegisterOtpInput('');
                            setRegisterGeneratedOtp(null);
                            auth.signOut();
                        }} 
                        className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 mx-auto text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Cancel Registration
                    </button>
                </div>
             </div>
        )}

        {view === 'forgot-password' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
                        <ShieldCheck className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
                        Reset Password
                    </h1>
                    <div className="text-slate-400 text-sm px-2">
                        Enter your email. We'll send you an OTP to reset your password.
                    </div>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type="email" 
                                className={inputWithIconClass}
                                placeholder="email@example.com"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-indigo-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send OTP"}
                    </button>
                </form>

                <div className="text-center">
                    <button 
                        onClick={() => changeView('login')} 
                        className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 mx-auto text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Login
                    </button>
                </div>
             </div>
        )}

        {view === 'forgot-password-otp' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
                        <KeyRound className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
                        Enter OTP
                    </h1>
                    <div className="text-slate-400 text-sm px-2">
                        Enter the 6-digit code sent to <span className="text-white font-mono">{resetEmail}</span>
                    </div>
                </div>

                <form onSubmit={handleResetOtpVerify} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    <div className="space-y-2">
                         <label className="text-xs font-semibold text-indigo-500 uppercase tracking-wider text-center block">Reset Code</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-center tracking-[0.5em] text-lg"
                                placeholder="000000"
                                maxLength={6}
                                value={resetOtpInput}
                                onChange={e => setResetOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading || resetOtpInput.length !== 6}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-indigo-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
                    </button>
                </form>

                 <div className="text-center">
                    <button 
                        onClick={() => {
                            changeView('login');
                            setResetEmail('');
                            setResetGeneratedOtp(null);
                        }} 
                        className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 mx-auto text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Cancel
                    </button>
                </div>
             </div>
        )}

        {view === 'reset-password-form' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                        <Save className="w-8 h-8 text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
                        New Password
                    </h1>
                    <div className="text-slate-400 text-sm px-2">
                        Create a new secure password for your account.
                    </div>
                </div>

                <form onSubmit={handleNewPasswordSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type={showPassword ? "text" : "password"}
                                className={inputWithIconClass}
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                             <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type={showConfirmPassword ? "text" : "password"}
                                className={inputWithIconClass}
                                placeholder="••••••••"
                                value={confirmNewPassword}
                                onChange={e => setConfirmNewPassword(e.target.value)}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
                    </button>
                </form>
             </div>
        )}

        {/* --- ADMIN LOGIN VIEW (Step 1: Credentials) --- */}
        {view === 'admin-login' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-amber-900/20 p-3 rounded-xl border border-amber-500/30 mb-4 shadow-lg shadow-amber-900/10">
                        <ElectroRescueLogo className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
                    <p className="text-slate-400 text-sm mt-1">Authorized Personnel Only</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                     {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-in slide-in-from-top-2">
                           <AlertCircle className="w-4 h-4 shrink-0" />
                           {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Admin Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type="email" 
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                                placeholder="admin@electrorescue.ai"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type={showPassword ? "text" : "password"}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-10 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Credentials"}
                    </button>
                </form>

                <div className="text-center space-y-4">
                    <button 
                        onClick={() => {
                            changeView('admin-register');
                            setFormData({ name: '', email: '', password: '', confirmPassword: '', masterKey: '', loginKey: '' });
                        }}
                        className="text-xs text-amber-500/80 hover:text-amber-400 transition-colors uppercase tracking-wider font-bold"
                    >
                        + Register New Admin
                    </button>

                    <button 
                        onClick={() => {
                            changeView('login');
                            setFormData({ name: '', email: '', password: '', confirmPassword: '', masterKey: '', loginKey: '' });
                        }} 
                        className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 mx-auto text-sm w-full"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to User Login
                    </button>
                </div>
            </div>
        )}

        {/* --- ADMIN SELECT METHOD (Step 2: Choice) --- */}
        {view === 'admin-select-method' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex flex-col items-center mb-2">
                    <div className="bg-amber-900/20 p-3 rounded-xl border border-amber-500/30 mb-4 shadow-lg shadow-amber-900/10">
                        <ShieldCheck className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Security Verification</h1>
                    <p className="text-slate-400 text-sm mt-1 text-center">
                        Welcome, {tempAdminUser?.email?.split('@')[0]}<br/>
                        Please choose a method to complete login.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <button 
                        onClick={() => changeView('admin-key-entry')}
                        className="group relative flex items-center p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-amber-500/50 hover:bg-slate-900 transition-all text-left"
                    >
                        <div className="bg-amber-500/10 p-3 rounded-lg mr-4 border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                            <KeyRound className="w-6 h-6 text-amber-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white font-semibold text-sm">Use Login Key</h3>
                            <p className="text-slate-500 text-xs">Instant access with your private key</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-500 transition-colors" />
                    </button>

                    <button 
                        onClick={handleInitiateOTP}
                        disabled={isLoading}
                        className="group relative flex items-center p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500/50 hover:bg-slate-900 transition-all text-left disabled:opacity-60"
                    >
                        <div className="bg-blue-500/10 p-3 rounded-lg mr-4 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                            <Mail className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-white font-semibold text-sm">Login using OTP</h3>
                            <p className="text-slate-500 text-xs">Send a code to your email</p>
                        </div>
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-500 transition-colors" />}
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm mt-4">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="text-center pt-4">
                     <button 
                        onClick={() => {
                            changeView('admin-login');
                            setTempAdminUser(null);
                            auth.signOut();
                        }} 
                        className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 mx-auto text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Cancel
                    </button>
                </div>
            </div>
        )}

        {/* --- ADMIN KEY ENTRY (Step 3A: Key) --- */}
        {view === 'admin-key-entry' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-amber-900/20 p-3 rounded-xl border border-amber-500/30 mb-4 shadow-lg shadow-amber-900/10">
                        <Zap className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Quick Access</h1>
                    <p className="text-slate-400 text-sm mt-1">Enter your personal login key</p>
                </div>

                <form onSubmit={handleAccessKeyLogin} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-in slide-in-from-top-2">
                           <AlertCircle className="w-4 h-4 shrink-0" />
                           {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    <div className="space-y-2">
                         <label className="text-xs font-semibold text-amber-500 uppercase tracking-wider text-center block">Access Key</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type="password" 
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-center tracking-widest text-lg"
                                placeholder="KEY-XXXX"
                                value={formData.loginKey}
                                onChange={e => setFormData({...formData, loginKey: e.target.value})}
                            />
                        </div>
                    </div>

                     <button 
                        type="submit" 
                        disabled={isLoading || !formData.loginKey}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authenticate"}
                    </button>
                </form>

                <div className="text-center">
                     <button 
                        onClick={() => changeView('admin-select-method')}
                        className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 mx-auto text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Selection
                    </button>
                </div>
            </div>
        )}

        {/* --- ADMIN OTP VERIFICATION VIEW (Step 3B: OTP) --- */}
        {view === 'admin-otp' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-blue-900/20 p-3 rounded-xl border border-blue-500/30 mb-4 shadow-lg shadow-blue-900/10">
                        <Mail className="w-8 h-8 text-blue-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Email Verification</h1>
                    <p className="text-slate-400 text-sm mt-1">Enter code sent to {tempAdminUser?.email}</p>
                    <p className="text-[10px] text-slate-600 mt-2 font-mono">
                       (Dev: Check Console if emails not configured)
                    </p>
                </div>

                <form onSubmit={handleAdminOtpVerify} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-in slide-in-from-top-2">
                           <AlertCircle className="w-4 h-4 shrink-0" />
                           {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    <div className="space-y-2">
                         <label className="text-xs font-semibold text-blue-500 uppercase tracking-wider text-center block">One-Time Password</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-center tracking-[0.5em] text-lg"
                                placeholder="000000"
                                maxLength={6}
                                value={otpInput}
                                onChange={e => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                        </div>
                    </div>

                     <button 
                        type="submit" 
                        disabled={isLoading || otpInput.length !== 6}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
                    </button>
                </form>

                <div className="text-center">
                     <button 
                        onClick={() => changeView('admin-select-method')} 
                        className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 mx-auto text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Selection
                    </button>
                </div>
             </div>
        )}

        {/* --- ADMIN REGISTRATION VIEW --- */}
        {view === 'admin-register' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-amber-900/20 p-3 rounded-xl border border-amber-500/30 mb-4 shadow-lg shadow-amber-900/10">
                        <ShieldPlus className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Create Admin</h1>
                    <p className="text-slate-400 text-sm mt-1">Authorized Creation Only</p>
                </div>

                <form onSubmit={handleAdminRegister} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            {success}
                        </div>
                    )}

                    {/* Master Key Field */}
                    <div className="space-y-2 bg-amber-900/10 p-3 rounded-lg border border-amber-500/20">
                        <label className="text-xs font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-2">
                            <KeyRound className="w-3 h-3" /> Master Security Key
                        </label>
                        <input 
                            type="password"
                            className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all font-mono"
                            placeholder="Enter Secret Key"
                            value={formData.masterKey}
                            onChange={e => setFormData({...formData, masterKey: e.target.value})}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all"
                            placeholder="Admin Name"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Admin Email</label>
                        <input 
                            type="email" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all"
                            placeholder="admin@electrorescue.ai"
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                        <input 
                            type="password" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirm Password</label>
                        <input 
                            type="password" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all"
                            placeholder="••••••••"
                            value={formData.confirmPassword}
                            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-amber-900/20 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authorize & Create"}
                    </button>
                </form>

                <div className="text-center">
                    <button 
                        onClick={() => changeView('admin-login')} 
                        className="text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 mx-auto text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Admin Login
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default LoginPage;
