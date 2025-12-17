
import React, { useState, useEffect } from 'react';
import { MarketplaceItem, UserProfile } from '../types';
import { ShoppingBag, Plus, Tag, Phone, Calendar, X, User, ArrowRight, Mail, ImageIcon, MapPin, Settings, Save, Loader2, Trash2, Edit, Target, GraduationCap, CheckCircle2, ClipboardList, Box, Cpu } from 'lucide-react';
import { db, storage } from '../services/firebase';
import { collection, addDoc, getDocs, query, orderBy, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

interface MarketplaceProps {
  user: UserProfile;
  isAdmin?: boolean;
}

const Marketplace: React.FC<MarketplaceProps> = ({ user, isAdmin = false }) => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isSelling, setIsSelling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBuyerSettings, setShowBuyerSettings] = useState(false);
  // ADMIN ONLY: State to show requested products
  const [showAdminRequests, setShowAdminRequests] = useState(false);
  const [buyRequests, setBuyRequests] = useState<any[]>([]);
  const [requestFilter, setRequestFilter] = useState<'store' | 'projects'>('store');

  const [viewSeller, setViewSeller] = useState<UserProfile | null>(null);
  const [buyItem, setBuyItem] = useState<MarketplaceItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    price: '',
    condition: 'Used - Good',
    contactInfo: user.email,
    imageUrl: '',
    stock: '1' // Default stock
  });

  const [buyerInfo, setBuyerInfo] = useState({
    name: user.name,
    phone: '',
    address: '',
    preferredDomain: user.domain || ''
  });

  // Load Items from Firestore
  useEffect(() => {
    const fetchItems = async () => {
        try {
            const q = query(collection(db, "marketplace"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            const loadedItems: MarketplaceItem[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data() as any;
                loadedItems.push({ ...data, _docId: doc.id } as unknown as MarketplaceItem & { _docId?: string });
            });
            setItems(loadedItems);
        } catch (error) {
            console.error("Error fetching marketplace items:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchItems();

    // Load buyer info from local storage
    const savedBuyerInfo = localStorage.getItem('electro_buyer_info');
    if (savedBuyerInfo) {
      const parsed = JSON.parse(savedBuyerInfo);
      setBuyerInfo({
        name: parsed.name || user.name,
        phone: parsed.phone || '',
        address: parsed.address || '',
        preferredDomain: parsed.preferredDomain || user.domain || ''
      });
    } else {
       setBuyerInfo({
         name: user.name,
         phone: '',
         address: '',
         preferredDomain: user.domain || ''
       });
    }
  }, [user]);

  // Fetch Buy Requests for Admin
  useEffect(() => {
      if (isAdmin && showAdminRequests) {
          const fetchRequests = async () => {
              const q = query(collection(db, "buy_requests"), orderBy("timestamp", "desc"));
              const snapshot = await getDocs(q);
              const reqs: any[] = [];
              snapshot.forEach(doc => {
                  const data = doc.data() as any;
                  reqs.push({ ...data, id: doc.id });
              });
              setBuyRequests(reqs);
          };
          fetchRequests();
      }
  }, [isAdmin, showAdminRequests]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewItem(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const openEditModal = (item: MarketplaceItem) => {
    setNewItem({
        title: item.title,
        description: item.description,
        price: item.price,
        condition: item.condition,
        contactInfo: item.contactInfo,
        imageUrl: item.imageUrl || '',
        stock: item.stock !== undefined ? item.stock.toString() : '1'
    });
    setEditingId((item as any)._docId);
    setIsSelling(true);
  };

  const deleteItem = async (docId: string, itemId: string) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) return;
    
    try {
        await deleteDoc(doc(db, "marketplace", docId));
        setItems(prev => prev.filter(i => (i as any)._docId !== docId));
    } catch (error) {
        console.error("Error deleting item:", error);
        alert("Failed to delete item.");
    }
  };

  const saveItem = async () => {
    if (!newItem.title || !newItem.price) return;
    setIsSubmitting(true);

    try {
        let imageUrl = newItem.imageUrl;
        
        // 1. Upload Image to Firebase Storage if exists and is new (base64)
        if (newItem.imageUrl && newItem.imageUrl.startsWith('data:')) {
            const imageRef = ref(storage, `marketplace/${Date.now()}_${user.id}`);
            await uploadString(imageRef, newItem.imageUrl, 'data_url');
            imageUrl = await getDownloadURL(imageRef);
        }

        const itemData = {
            sellerId: user.id,
            sellerName: user.name,
            timestamp: Date.now(),
            title: newItem.title,
            description: newItem.description,
            price: newItem.price,
            condition: newItem.condition,
            contactInfo: newItem.contactInfo,
            imageUrl: imageUrl,
            status: 'approved' as const, // Items added by admin via panel are auto-approved
            stock: parseInt(newItem.stock) || 0
        };

        if (editingId) {
            // Update Existing
            const docRef = doc(db, "marketplace", editingId);
            await updateDoc(docRef, itemData);
            
            setItems(prev => prev.map(i => {
                if ((i as any)._docId === editingId) {
                    return { ...i, ...itemData, id: i.id };
                }
                return i;
            }));
        } else {
            // Create New
            const docRef = await addDoc(collection(db, "marketplace"), { ...itemData, id: Date.now().toString() });
            const newItemObj: MarketplaceItem & { _docId?: string } = { ...itemData, id: Date.now().toString(), _docId: docRef.id };
            setItems([newItemObj, ...items]);
        }
        
        setIsSelling(false);
        setEditingId(null);
        setNewItem({ title: '', description: '', price: '', condition: 'Used - Good', contactInfo: user.email, imageUrl: '', stock: '1' });
    } catch (error) {
        console.error("Error saving item:", error);
        alert("Failed to save item. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const saveBuyerSettings = () => {
    localStorage.setItem('electro_buyer_info', JSON.stringify(buyerInfo));
    setShowBuyerSettings(false);
  };

  const handleViewSeller = async (email: string) => {
    try {
        const userRef = doc(db, "users", email);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            setViewSeller(userSnap.data() as UserProfile);
        } else {
            setViewSeller({
                id: 'unknown',
                name: 'Unknown Seller',
                email: email,
                role: 'Member'
            });
        }
    } catch (error) {
        console.error("Error fetching seller:", error);
        // Fallback
        setViewSeller({
            id: 'unknown',
            name: 'Seller',
            email: email,
            role: 'Member'
        });
    }
  };

  const handleContactSeller = async () => {
    if (!buyItem) return;
    
    // Auto-save buyer info
    localStorage.setItem('electro_buyer_info', JSON.stringify(buyerInfo));

    try {
        // Save to 'buy_requests' collection (Admin's "Requested_Products")
        await addDoc(collection(db, "buy_requests"), {
            itemId: buyItem.id,
            itemTitle: buyItem.title,
            itemPrice: buyItem.price,
            buyerName: buyerInfo.name,
            buyerPhone: buyerInfo.phone,
            buyerAddress: buyerInfo.address,
            buyerDomain: buyerInfo.preferredDomain,
            buyerEmail: user.email,
            timestamp: Date.now(),
            status: 'requested',
            type: 'store_buy' // Identify source
        });

        alert("Request sent to ResQ Team! We will contact you shortly.");
        setBuyItem(null);
    } catch (e) {
        console.error("Error sending buy request:", e);
        alert("Failed to send request. Please try again.");
    }
  };

  // Filter items based on Admin status
  // Admin sees ALL items. Public Users only see APPROVED items.
  const displayItems = isAdmin 
    ? items 
    : items.filter(i => i.status === 'approved' || i.sellerId === user.id); // Users see their own items too

  // Filter for Admin Requests Panel
  const displayedRequests = buyRequests.filter(req => {
      if (requestFilter === 'store') return !req.type || req.type === 'store_buy';
      if (requestFilter === 'projects') return req.type === 'project_kit' || req.type === 'project_kit_request';
      return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 pb-24">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-8 h-8 text-emerald-500" />
            ResQ-Store
          </h2>
          <p className="text-slate-400">
            {isAdmin 
              ? "Admin Control Panel - Manage Marketplace Inventory" 
              : "Buy salvaged components directly from the ER Team and Community."
            }
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
             <button 
              onClick={() => isAdmin ? setShowAdminRequests(true) : setShowBuyerSettings(true)}
              className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium border border-slate-700 transition-all"
            >
              {isAdmin ? (
                  <>
                    <ClipboardList className="w-4 h-4" />
                    Requested_Products
                  </>
              ) : (
                  <>
                    <Settings className="w-4 h-4" />
                    Buyer Profile
                  </>
              )}
            </button>
            {isAdmin && (
              <button 
                onClick={() => {
                    setEditingId(null);
                    setNewItem({ title: '', description: '', price: '', condition: 'Used - Good', contactInfo: user.email, imageUrl: '', stock: '1' });
                    setIsSelling(true);
                }}
                className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium shadow-lg shadow-emerald-900/20 transition-all"
              >
                <Plus className="w-5 h-5" />
                Add Inventory
              </button>
            )}
        </div>
      </div>

      {/* --- MODAL: ADMIN "Requested_Products" --- */}
      {showAdminRequests && isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAdminRequests(false)} />
            <div className="relative bg-slate-900 w-full max-w-2xl rounded-xl border border-slate-700 shadow-2xl p-6 animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <ClipboardList className="w-6 h-6 text-emerald-500" />
                        Requested Products
                    </h3>
                    <button onClick={() => setShowAdminRequests(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6 bg-slate-800/50 p-1 rounded-lg border border-slate-700 w-fit">
                    <button 
                        onClick={() => setRequestFilter('store')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${requestFilter === 'store' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        <ShoppingBag className="w-4 h-4" /> Store Orders
                    </button>
                    <button 
                        onClick={() => setRequestFilter('projects')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${requestFilter === 'projects' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Cpu className="w-4 h-4" /> Project Requests
                    </button>
                </div>
                
                {displayedRequests.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                        No active requests in this category.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayedRequests.map((req, idx) => (
                            <div key={idx} className={`p-4 rounded-lg border flex flex-col md:flex-row gap-4 justify-between items-start ${requestFilter === 'projects' ? 'bg-blue-900/10 border-blue-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-white text-lg">{req.itemTitle}</h4>
                                        {requestFilter === 'projects' && (
                                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">KIT QUOTE</span>
                                        )}
                                    </div>
                                    <p className="text-emerald-400 font-mono text-sm">{req.itemPrice}</p>
                                    <div className="mt-2 text-sm text-slate-400 space-y-1">
                                        <p><span className="text-slate-500 uppercase text-xs">Buyer:</span> {req.buyerName} ({req.buyerPhone})</p>
                                        <p><span className="text-slate-500 uppercase text-xs">Email:</span> {req.buyerEmail}</p>
                                        <p><span className="text-slate-500 uppercase text-xs">Address:</span> {req.buyerAddress}</p>
                                        <p><span className="text-slate-500 uppercase text-xs">Interest:</span> {req.buyerDomain}</p>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 whitespace-nowrap flex flex-col items-end gap-2">
                                    <span>{new Date(req.timestamp).toLocaleDateString()}</span>
                                    <button 
                                        onClick={() => window.location.href = `mailto:${req.buyerEmail}?subject=ElectroRescue Quote: ${req.itemTitle}`}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-600 text-xs font-medium transition-colors"
                                    >
                                        Reply via Email
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- MODAL: BUYER SETTINGS (User Only) --- */}
      {showBuyerSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowBuyerSettings(false)} />
            <div className="relative bg-slate-900 w-full max-w-lg rounded-xl border border-slate-700 shadow-2xl p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white">Buyer Profile Settings</h3>
                        <p className="text-sm text-slate-400">Save your info for faster checkout & contact.</p>
                    </div>
                    <button onClick={() => setShowBuyerSettings(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="text-xs text-slate-400 uppercase">Your Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 pl-9 text-white focus:border-blue-500 outline-none" 
                                    value={buyerInfo.name}
                                    onChange={e => setBuyerInfo({...buyerInfo, name: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="text-xs text-slate-400 uppercase">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input 
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 pl-9 text-white focus:border-blue-500 outline-none" 
                                    value={buyerInfo.phone}
                                    onChange={e => setBuyerInfo({...buyerInfo, phone: e.target.value})}
                                    placeholder="+91..."
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-slate-400 uppercase">Preferred Domain / Interest</label>
                        <div className="relative">
                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 pl-9 text-white focus:border-blue-500 outline-none" 
                                value={buyerInfo.preferredDomain}
                                onChange={e => setBuyerInfo({...buyerInfo, preferredDomain: e.target.value})}
                                placeholder="e.g. Robotics, IoT, Power Systems"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Helps sellers understand your project needs.</p>
                    </div>

                    <div>
                        <label className="text-xs text-slate-400 uppercase">Default Shipping Address</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <textarea 
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 pl-9 text-white focus:border-blue-500 outline-none h-20 resize-none" 
                                value={buyerInfo.address}
                                onChange={e => setBuyerInfo({...buyerInfo, address: e.target.value})}
                                placeholder="Street, City, Zip..."
                            />
                        </div>
                    </div>

                    <button 
                        onClick={saveBuyerSettings}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 mt-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Preferences
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL: SELL/EDIT ITEM (Admin Only) --- */}
      {isSelling && isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && setIsSelling(false)} />
          <div className="relative bg-slate-900 w-full max-w-lg rounded-xl border border-slate-700 shadow-2xl p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Listing' : 'List Item for Sale'}</h3>
                <button onClick={() => setIsSelling(false)} disabled={isSubmitting}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
             </div>
             
             <div className="space-y-4">
                <div className="w-full h-40 border-2 border-dashed border-slate-700 rounded-lg bg-slate-800/50 flex flex-col items-center justify-center relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                  {newItem.imageUrl ? (
                    <>
                      <img src={newItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-sm font-medium">Change Image</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Upload Product Image</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>

                <div>
                   <label className="text-xs text-slate-400 uppercase">Item Title</label>
                   <input 
                     className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-emerald-500 outline-none" 
                     value={newItem.title}
                     onChange={e => setNewItem({...newItem, title: e.target.value})}
                     placeholder="Arduino Uno R3 (Original)"
                   />
                </div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs text-slate-400 uppercase">Price (INR)</label>
                        <input 
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-emerald-500 outline-none" 
                            value={newItem.price}
                            onChange={e => setNewItem({...newItem, price: e.target.value})}
                            placeholder="450"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-slate-400 uppercase">Stock Qty</label>
                        <input 
                            type="number"
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-emerald-500 outline-none"
                            value={newItem.stock}
                            onChange={e => setNewItem({...newItem, stock: e.target.value})}
                            placeholder="1"
                            min="0"
                        />
                    </div>
                </div>
                <div>
                     <label className="text-xs text-slate-400 uppercase">Condition</label>
                     <select 
                         className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-emerald-500 outline-none"
                         value={newItem.condition}
                         onChange={e => setNewItem({...newItem, condition: e.target.value})}
                     >
                         <option>New</option>
                         <option>Used - Like New</option>
                         <option>Used - Good</option>
                         <option>Salvaged / For Parts</option>
                     </select>
                </div>
                <div>
                   <label className="text-xs text-slate-400 uppercase">Description</label>
                   <textarea 
                     className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-emerald-500 outline-none h-24 resize-none" 
                     value={newItem.description}
                     onChange={e => setNewItem({...newItem, description: e.target.value})}
                     placeholder="Fully functional, minimal scratches..."
                   />
                </div>
                 <div>
                   <label className="text-xs text-slate-400 uppercase">Contact Info (Email)</label>
                   <input 
                     className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white focus:border-emerald-500 outline-none" 
                     value={newItem.contactInfo}
                     readOnly
                   />
                </div>
                <button 
                    onClick={saveItem} 
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {editingId ? 'Updating Item...' : 'Listing Item...'}
                        </>
                    ) : (editingId ? "Update Listing" : "List Item")}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* --- MODAL: VIEW SELLER PROFILE --- */}
      {viewSeller && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setViewSeller(null)} />
            <div className="relative bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-0 animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="h-24 bg-gradient-to-r from-blue-600 to-emerald-600 relative shrink-0">
                    <button onClick={() => setViewSeller(null)} className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-1 rounded-full backdrop-blur-sm">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="px-6 pb-6 relative overflow-y-auto custom-scrollbar">
                    <div className="w-20 h-20 rounded-full bg-slate-900 p-1 absolute -top-10 left-6">
                         <div className="w-full h-full bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                             <User className="w-10 h-10 text-slate-400" />
                         </div>
                    </div>

                    <div className="mt-12 space-y-4">
                        <div>
                            <h3 className="text-xl font-bold text-white">{viewSeller.name}</h3>
                            <span className="text-emerald-400 text-sm font-medium">{viewSeller.role || 'Member'}</span>
                        </div>
                        
                        {isAdmin && (
                            <div className="space-y-3 pt-4 border-t border-slate-800">
                                {viewSeller.university && (
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <GraduationCap className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm">{viewSeller.university}</span>
                                    </div>
                                )}
                                {viewSeller.domain && (
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <Target className="w-4 h-4 text-slate-500" />
                                        <span className="text-sm">{viewSeller.domain}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-slate-300">
                                    <Mail className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm">{viewSeller.email}</span>
                                </div>

                                <button 
                                    onClick={() => window.location.href = `mailto:${viewSeller.email}`}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                                >
                                    <Mail className="w-4 h-4" />
                                    Send Email
                                </button>
                            </div>
                        )}

                        <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400 leading-relaxed border border-slate-800">
                            Verified Seller By ER Team
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL: CONFIRM CONTACT (Buy Item) --- */}
      {buyItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setBuyItem(null)} />
            <div className="relative bg-slate-900 w-full max-w-md rounded-xl border border-slate-700 p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white">Request Item</h3>
                    <button onClick={() => setBuyItem(null)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg mb-6 flex gap-4 border border-slate-700">
                     <div className="w-16 h-16 bg-slate-900 rounded-md overflow-hidden shrink-0 border border-slate-700">
                        {buyItem.imageUrl && isAdmin ? (
                             <img src={buyItem.imageUrl} alt={buyItem.title} className="w-full h-full object-cover" />
                        ) : (
                             <ShoppingBag className="w-full h-full p-4 text-slate-600" />
                        )}
                     </div>
                     <div>
                        <h4 className="font-bold text-white text-sm">{buyItem.title}</h4>
                        <p className="text-emerald-400 font-bold text-sm">₹{buyItem.price}</p>
                        <p className="text-xs text-slate-500 mt-1">Sold by: {buyItem.sellerName}</p>
                     </div>
                </div>
                
                <p className="text-slate-400 text-sm mb-6">
                    This will send a purchase request to the ResQ Team. We will facilitate the transaction.
                </p>

                <button 
                    onClick={handleContactSeller}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
                >
                    <Mail className="w-5 h-5" />
                    Send Request
                </button>
            </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayItems.map(item => {
                const stock = item.stock !== undefined ? item.stock : 1; // Default to 1 if not set
                const isOutOfStock = stock <= 0;

                return (
                <div key={item.id} className={`bg-slate-800/50 border border-slate-700 hover:border-emerald-500/30 rounded-xl flex flex-col transition-all hover:-translate-y-1 overflow-hidden group relative ${isOutOfStock ? 'opacity-75 grayscale-[0.8]' : ''}`}>
                    {/* Image Section - Restricted for Non-Admin */}
                    <div className="w-full h-48 bg-slate-900 relative overflow-hidden border-b border-slate-700/50">
                        {isAdmin && item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600 flex-col gap-2">
                                <ShoppingBag className="w-12 h-12 opacity-20" />
                                {!isAdmin && <span className="text-xs text-slate-600">Image Hidden (User View)</span>}
                            </div>
                        )}
                        
                        {/* Out of Stock Overlay */}
                        {isOutOfStock && (
                            <div className="absolute inset-0 bg-slate-950/60 z-10 flex items-center justify-center backdrop-blur-[2px]">
                                <span className="text-white font-bold text-xl border-2 border-white px-4 py-2 rounded -rotate-12 tracking-widest bg-red-600/50 shadow-2xl">
                                    OUT OF STOCK
                                </span>
                            </div>
                        )}

                        <div className="absolute top-3 right-3 flex gap-2 z-20">
                            {item.sellerId === user.id && (
                                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg">You</span>
                            )}
                            {isAdmin && (
                                <span className={`text-xs font-bold px-2 py-1 rounded backdrop-blur-sm border shadow-lg ${item.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                                    {item.status || 'approved'}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                             {/* Stock Badge */}
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isOutOfStock ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-slate-700/50 text-slate-300 border border-slate-600'}`}>
                                <Box className="w-3 h-3" />
                                {isOutOfStock ? '0 Stock' : `${stock} in Stock`}
                            </span>
                        </div>
                        
                        {/* Title - Visible to All */}
                        <h3 className="text-lg font-bold text-white mb-2 line-clamp-1">{item.title}</h3>
                        
                        {/* Description - Hidden for Non-Admin */}
                        {isAdmin ? (
                             <p className="text-slate-400 text-sm mb-4 line-clamp-2 flex-1">{item.description}</p>
                        ) : (
                             <p className="text-slate-600 text-sm mb-4 flex-1 italic">Description restricted to Admin.</p>
                        )}
                        
                        <div className="pt-4 border-t border-slate-700/50">
                            {/* Price - Hidden in generic view for non-admin, visible to admin */}
                            <div className="flex items-center gap-2 text-slate-300 text-sm mb-4">
                                <Tag className="w-5 h-5 text-emerald-500" />
                                {isAdmin ? (
                                    <span className="text-2xl font-bold text-white">₹{item.price}</span>
                                ) : (
                                    <span className="text-lg font-bold text-slate-500 blur-sm">₹XXX</span>
                                )}
                            </div>

                            {/* Seller Name - Visible to All */}
                            <div 
                                onClick={() => handleViewSeller(item.contactInfo)}
                                className="bg-slate-900/50 rounded-lg p-3 mb-3 flex items-center gap-3 cursor-pointer border border-slate-800 hover:border-blue-500/50 transition-all group/seller"
                            >
                                <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover/seller:bg-blue-500/20">
                                    <User className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Seller</span>
                                    <span className="text-sm font-bold text-slate-200 group-hover/seller:text-blue-400 transition-colors">{item.sellerName}</span>
                                </div>
                                {isAdmin && (
                                     <ArrowRight className="w-4 h-4 text-slate-600 ml-auto group-hover/seller:text-blue-400 transition-colors" />
                                )}
                            </div>

                            {/* Actions - Contact for User, Edit/Delete for Admin */}
                            {isAdmin ? (
                                <div className="flex flex-col gap-2">
                                    {/* Approve Button Removed - Approvals are handled via ER-ResQ panel */}

                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => openEditModal(item)}
                                            className="flex-1 bg-slate-800 hover:bg-blue-600/20 hover:text-blue-400 text-slate-400 py-2.5 rounded-lg text-sm font-medium transition-all border border-slate-700 hover:border-blue-500/30 flex items-center justify-center gap-2"
                                        >
                                            <Edit className="w-4 h-4" /> Edit
                                        </button>
                                        <button 
                                            onClick={() => deleteItem((item as any)._docId, item.id)}
                                            className="flex-1 bg-slate-800 hover:bg-red-600/20 hover:text-red-400 text-slate-400 py-2.5 rounded-lg text-sm font-medium transition-all border border-slate-700 hover:border-red-500/30 flex items-center justify-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" /> Delete
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                onClick={() => setBuyItem(item)}
                                disabled={isOutOfStock}
                                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg flex items-center justify-center gap-2
                                    ${isOutOfStock 
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none' 
                                        : 'bg-slate-700 hover:bg-emerald-600 hover:text-white text-slate-200 shadow-slate-900/20 hover:shadow-emerald-900/20'
                                    }`}
                                >
                                    <ShoppingBag className="w-4 h-4" />
                                    {isOutOfStock ? 'Out of Stock' : 'Request to Buy'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )})}
            {displayItems.length === 0 && (
                <div className="col-span-full py-20 text-center">
                    <ShoppingBag className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-500">ResQ-Store is Empty</h3>
                    <p className="text-slate-600">Inventory coming soon.</p>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
