
import React, { useState, useEffect } from 'react';
import { MarketplaceItem, UserProfile } from '../types';
import { ShieldAlert, CheckCircle2, XCircle, Clock, ShoppingBag, DollarSign, User } from 'lucide-react';
import { db } from '../services/firebase';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { sendGeneralEmail } from '../services/emailService';

interface ERResQProps {
  user: UserProfile;
}

const ERResQ: React.FC<ERResQProps> = ({ user }) => {
  const [pendingItems, setPendingItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingItems = async () => {
    try {
        // Query for items in er_requests
        const q = query(
            collection(db, "er_requests"), 
            orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);
        const loadedItems: MarketplaceItem[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data() as any;
            // Ensure we capture the firestore document ID as _docId
            loadedItems.push({ ...data, _docId: doc.id });
        });
        setPendingItems(loadedItems);
    } catch (error) {
        console.error("Error fetching pending items:", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingItems();
  }, []);

  const handleAccept = async (docId: string, item: MarketplaceItem) => {
      if(!window.confirm("Mark this request as Approved? (It will stay in ER-ResQ)")) return;
      try {
          // Update status in er_requests ONLY. Do not move to marketplace.
          const docRef = doc(db, "er_requests", docId);
          await updateDoc(docRef, { status: 'approved' });
          
          // Send Email
          await sendGeneralEmail(
              item.contactInfo, 
              "ResQ Update: Product Approved!",
              `Great news ${item.sellerName},\n\nYour item "${item.title}" has been approved by the Admin. Our team will proceed with the listing process.\n\nThank you for using ElectroRescue.`
          );

          // Update local state
          setPendingItems(prev => prev.map(i => {
             if ((i as any)._docId === docId) {
                 return { ...i, status: 'approved' };
             }
             return i;
          }));
      } catch (error) {
          console.error("Error approving item:", error);
          alert("Failed to update status.");
      }
  };

  const handleReject = async (docId: string, item: MarketplaceItem) => {
      if(!window.confirm("Reject this request? The user will be notified via email.")) return;
      try {
          // Mark as rejected instead of deleting, so user sees the notification
          const docRef = doc(db, "er_requests", docId);
          await updateDoc(docRef, { status: 'rejected' });
          
          // Send Email
          await sendGeneralEmail(
              item.contactInfo,
              "ResQ Update: Product Rejected",
              `Hello ${item.sellerName},\n\nYour item "${item.title}" has been rejected by the Admin. This might be due to insufficient details or quality standards.\n\nPlease contact Admin Support via the Helpdesk if you have questions.`
          );

          setPendingItems(prev => prev.map(i => {
              if ((i as any)._docId === docId) {
                  return { ...i, status: 'rejected' };
              }
              return i;
          }));
      } catch (error) {
          console.error("Error rejecting item:", error);
          alert("Failed to reject item. Please try again.");
      }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 pb-24">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-amber-500" />
          ER-ResQ Panel
        </h2>
        <p className="text-slate-400">
          Incoming user requests to sell components. These are stored securely for Admin review.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Loading requests...</div>
      ) : pendingItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 rounded-xl border border-dashed border-slate-700">
            <CheckCircle2 className="w-16 h-16 text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-slate-500">All Caught Up!</h3>
            <p className="text-slate-600">No pending sell requests from users.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
            {pendingItems.map((item) => (
                <div key={item.id} className={`border rounded-xl p-6 flex flex-col md:flex-row gap-6 animate-in slide-in-from-bottom-2 duration-500 
                  ${item.status === 'approved' ? 'bg-emerald-900/10 border-emerald-500/30' : 
                    item.status === 'rejected' ? 'bg-red-900/10 border-red-500/30' : 
                    'bg-slate-800/50 border-slate-700'}`}>
                    
                    {/* Image */}
                    <div className="w-full md:w-48 h-48 bg-slate-900 rounded-lg overflow-hidden shrink-0 border border-slate-700">
                        {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <ShoppingBag className="w-12 h-12 opacity-20" />
                            </div>
                        )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold text-white">{item.title}</h3>
                                {item.status === 'approved' && (
                                    <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Approved
                                    </span>
                                )}
                                {item.status === 'rejected' && (
                                    <span className="bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full border border-red-500/30 flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> Rejected
                                    </span>
                                )}
                                {(!item.status || item.status === 'pending') && (
                                    <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Pending Review
                                    </span>
                                )}
                            </div>
                            
                            <p className="text-slate-400 text-sm mb-4">{item.description}</p>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                                    <span className="block text-xs text-slate-500 uppercase">Fixed Cost (Agreed)</span>
                                    <span className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                                        <DollarSign className="w-4 h-4" /> ₹{item.price}
                                    </span>
                                </div>
                                <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                                    <span className="block text-xs text-slate-500 uppercase">Seller</span>
                                    <span className="text-slate-200 flex items-center gap-2">
                                        <User className="w-4 h-4 text-blue-400" /> {item.sellerName}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="w-3 h-3" />
                                Submitted: {new Date(item.timestamp).toLocaleString()}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 mt-6">
                            {item.status === 'approved' ? (
                                <div className="flex-1 bg-emerald-900/20 text-emerald-400 py-3 rounded-lg font-bold flex items-center justify-center gap-2 border border-emerald-500/20 cursor-default opacity-50">
                                    <CheckCircle2 className="w-5 h-5" />
                                    Already Approved
                                </div>
                            ) : (
                                <button 
                                    onClick={() => handleAccept((item as any)._docId, item)}
                                    disabled={item.status === 'rejected'}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                    Approve Request
                                </button>
                            )}
                            
                            {item.status === 'rejected' ? (
                                <div className="px-6 bg-red-900/20 text-red-400 py-3 rounded-lg font-bold flex items-center justify-center gap-2 border border-red-500/20 cursor-default opacity-50">
                                    <XCircle className="w-5 h-5" />
                                    Rejected
                                </div>
                            ) : (
                                <button 
                                    onClick={() => handleReject((item as any)._docId, item)}
                                    disabled={item.status === 'approved'}
                                    className="px-6 bg-slate-800 hover:bg-red-900/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900/50 rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <XCircle className="w-5 h-5" />
                                    Reject
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default ERResQ;
