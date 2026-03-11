/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, X, Image as ImageIcon, Loader2, LogIn, LogOut, Trash2, ChevronLeft, ChevronRight, Lock, Globe, Heart, MessageCircle, Share2, Reply, Home, Wallet, User as UserIcon, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, onSnapshot, query, serverTimestamp, Timestamp, deleteDoc, doc, where, or, updateDoc, arrayUnion, arrayRemove, orderBy, getDoc, setDoc, increment } from 'firebase/firestore';
import { onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { db, auth, signInWithGoogle, logOut } from './firebase';

interface Post {
  id: string;
  name: string;
  caption: string;
  imageUrl: string;
  createdAt: any;
  uid: string;
  visibility?: 'public' | 'private';
  likes?: string[];
  photoURL?: string;
}

interface Comment {
  id: string;
  text: string;
  uid: string;
  name: string;
  photoURL: string;
  createdAt: any;
  replyTo?: string | null;
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  balance: number;
}

interface UserPublicProfile {
  uid: string;
  name: string;
  photoURL?: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  accountNumber: string;
  status: string;
  createdAt: any;
  adminEmail?: string;
  userEmail?: string;
}

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<Post | null>(null);
  const [isTitleComplete, setIsTitleComplete] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  // New state for tabs and wallet
  const [activeTab, setActiveTab] = useState<'home' | 'wallet' | 'profile' | 'messages'>('home');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [withdrawMethod, setWithdrawMethod] = useState('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Messaging state
  const [chatUsers, setChatUsers] = useState<UserPublicProfile[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<UserPublicProfile | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Form state
  const [name, setName] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let profileUnsub: (() => void) | undefined;
    let wUnsub: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && !name) {
        setName(currentUser.displayName || '');
      }
      setIsAuthReady(true);
      
      // Clean up previous listeners if any
      if (profileUnsub) profileUnsub();
      if (wUnsub) wUnsub();
      
      if (currentUser) {
        try {
          // Create or get user profile
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            const newProfile = {
              uid: currentUser.uid,
              name: currentUser.displayName || 'Anonymous',
              email: currentUser.email || '',
              balance: 0
            };
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
            
            // Create public profile for chat
            await setDoc(doc(db, 'users_public', currentUser.uid), {
              uid: currentUser.uid,
              name: currentUser.displayName || 'Anonymous',
              photoURL: currentUser.photoURL || ''
            });
          } else {
            setUserProfile(userSnap.data() as UserProfile);
            // Ensure public profile exists
            await setDoc(doc(db, 'users_public', currentUser.uid), {
              uid: currentUser.uid,
              name: currentUser.displayName || 'Anonymous',
              photoURL: currentUser.photoURL || ''
            }, { merge: true });
          }

          // Listen to profile changes
          profileUnsub = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              setUserProfile(doc.data() as UserProfile);
            }
          }, (error) => {
            console.error("Profile snapshot error:", error);
          });

          // Listen to withdrawals
          const wQuery = query(collection(db, 'withdrawals'), where('uid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
          wUnsub = onSnapshot(wQuery, (snapshot) => {
            setWithdrawals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Withdrawal)));
          }, (error) => {
            console.error("Withdrawals snapshot error:", error);
          });

        } catch (error) {
          console.error("Error setting up user profile:", error);
        }
      } else {
        setUserProfile(null);
        setWithdrawals([]);
      }
    });

    return () => {
      unsubscribeAuth();
      if (profileUnsub) profileUnsub();
      if (wUnsub) wUnsub();
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      
      const visiblePosts = postsData.filter(post => 
        !post.visibility || post.visibility === 'public' || (user && post.uid === user.uid)
      );

      setPosts(visiblePosts);
    }, (error) => {
      console.error("Error fetching posts:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!selectedImage) {
      setComments([]);
      setCommentText('');
      setReplyingTo(null);
      return;
    }
    const q = query(collection(db, `posts/${selectedImage.id}/comments`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(commentsData);
    });
    return () => unsubscribe();
  }, [selectedImage]);

  useEffect(() => {
    if (!user) {
      setChatUsers([]);
      return;
    }
    const q = query(collection(db, 'users_public'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs
        .map(doc => ({ ...doc.data() } as UserPublicProfile))
        .filter(u => u.uid !== user.uid);
      setChatUsers(users);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedChatUser) {
      setChatMessages([]);
      return;
    }
    const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
    });
    return () => unsubscribe();
  }, [user, selectedChatUser]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Sign in error:", error);
      const isIframe = window.self !== window.top;
      let message = "Sign in failed: " + (error.message || "Unknown error");
      
      if (isIframe && (error.code === 'auth/network-request-failed' || error.code === 'auth/internal-error' || error.message?.includes('popup'))) {
        message += "\n\nTip: Google Chrome often blocks sign-in inside an iframe. Please try opening the app in a new tab using the 'Open in new tab' button at the top right of the preview.";
      }
      
      alert(message);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedChatUser || !newMessage.trim()) return;
    
    const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: newMessage.trim(),
      senderId: user.uid,
      createdAt: serverTimestamp()
    });
    setNewMessage('');
  };

  const uploadToImgBB = (file: File, onProgress: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
      if (!apiKey) {
        reject(new Error("ImgBB API Key is missing. Please add VITE_IMGBB_API_KEY to your environment variables."));
        return;
      }

      const formData = new FormData();
      formData.append('image', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.imgbb.com/1/upload?key=${apiKey}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.data.url);
          } catch (error) {
            reject(new Error("Failed to parse ImgBB response"));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error during upload"));
      };

      xhr.send(formData);
    });
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      let newPhotoURL = user.photoURL;
      if (editPhotoFile) {
        newPhotoURL = await uploadToImgBB(editPhotoFile, () => {});
      }
      
      await updateProfile(user, {
        displayName: editName || user.displayName,
        photoURL: newPhotoURL
      });
      
      // Update user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        name: editName || user.displayName,
        photoURL: newPhotoURL,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setUser({ ...user, displayName: editName || user.displayName, photoURL: newPhotoURL } as User);
      setIsEditingProfile(false);
      setEditPhotoFile(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (!user) {
      alert("Please sign in to upload pictures.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const imageUrl = await uploadToImgBB(file, setUploadProgress);
      
      await addDoc(collection(db, 'posts'), {
        name: name || user.displayName || 'Anonymous',
        caption: caption || '',
        imageUrl,
        createdAt: serverTimestamp(),
        uid: user.uid,
        visibility,
        photoURL: user.photoURL || ''
      });
      
      // Increment user balance by 0.10 BDT
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        balance: increment(0.10)
      });
      
      setCaption('');
      setFile(null);
      setVisibility('public');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error("Upload error:", error);
      alert(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = (post: Post) => {
    window.location.href = `/api/download?url=${encodeURIComponent(post.imageUrl)}`;
  };

  const confirmDelete = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'posts', postToDelete.id));
      setPostToDelete(null);
      if (selectedImage?.id === postToDelete.id) {
        setSelectedImage(null);
      }
    } catch (error: any) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post.");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleLike = async (post: Post) => {
    if (!user) {
      alert("Please sign in to like pictures.");
      return;
    }
    const postRef = doc(db, 'posts', post.id);
    const isLiked = post.likes?.includes(user.uid);
    try {
      await updateDoc(postRef, {
        likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to comment.");
      return;
    }
    if (!selectedImage || !commentText.trim()) return;

    try {
      await addDoc(collection(db, `posts/${selectedImage.id}/comments`), {
        text: commentText.trim(),
        uid: user.uid,
        name: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        replyTo: replyingTo?.id || null
      });
      setCommentText('');
      setReplyingTo(null);
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment.");
    }
  };

  const handleShare = async (post: Post) => {
    const url = `${window.location.origin}?post=${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Picture by ${post.name}`,
          text: post.caption,
          url: url,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError' && !error.message?.includes('canceled')) {
          console.error("Error sharing:", error);
        }
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < 100 || amount > userProfile.balance) {
      alert("Invalid amount. Minimum withdrawal is 100 BDT and cannot exceed your balance.");
      return;
    }

    if (!accountNumber.trim()) {
      alert("Please enter a valid account number.");
      return;
    }

    try {
      // Create withdrawal request
      await addDoc(collection(db, 'withdrawals'), {
        uid: user.uid,
        userEmail: user.email,
        amount: amount,
        method: withdrawMethod,
        accountNumber: accountNumber.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        adminEmail: 'sabihait20@gmail.com'
      });

      // Deduct balance
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        balance: increment(-amount)
      });

      setWithdrawAmount('');
      setAccountNumber('');
      alert("Withdrawal request submitted successfully! Your request has been sent to sabihait20@gmail.com for approval.");
    } catch (error) {
      console.error("Error submitting withdrawal:", error);
      alert("Failed to submit withdrawal request.");
    }
  };

  const filteredPosts = posts.filter(post => 
    post.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    post.caption?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const currentPosts = filteredPosts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.3 } }
              }}
              onAnimationComplete={() => setIsTitleComplete(true)}
              className={`flex font-bold text-2xl tracking-tight font-bengali ${isTitleComplete ? 'glitch-effect' : ''}`}
            >
              <motion.span
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 }
                }}
                className="bg-white text-[#102a5e] px-2 py-0.5 border-b-[3px] border-[#c8102e]"
              >
                আমাদের
              </motion.span>
              <motion.span
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 }
                }}
                className="bg-[#c8102e] text-white px-2 py-0.5 border-b-[3px] border-[#c8102e]"
              >
                শ্রীবরদী
              </motion.span>
            </motion.div>
          </div>
          
          <div className="flex items-center gap-4">
            
            {user ? (
              <div className="flex items-center gap-3 ml-2 border-l border-slate-800 pl-4">
                <img src={user.photoURL || ''} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full border border-slate-800" referrerPolicy="no-referrer" />
                <button onClick={logOut} className="p-2 text-slate-500 hover:text-red-600 transition-colors" title="Sign Out">
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <button onClick={handleSignIn} className="ml-2 flex items-center gap-2 px-4 py-1.5 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 rounded-full text-sm font-medium transition-colors">
                  <LogIn size={16} />
                  Sign In
                </button>
                <p className="text-[10px] text-slate-500 hidden sm:block">Chrome user? Open in new tab if sign-in fails.</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24">
        {activeTab === 'home' && (
          <>
            {/* Upload Section */}
        {user && (
          <section className="mb-8 max-w-2xl mx-auto">
            <div className="bg-[#0f172a]/80 p-4 rounded-2xl shadow-sm border border-slate-800">
              <form onSubmit={handlePost} className="space-y-3">
                <div className="flex gap-3">
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full border border-slate-800/50 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea 
                      placeholder={`What's on your mind, ${user.displayName?.split(' ')[0] || 'there'}?`}
                      className="w-full bg-transparent resize-none outline-none text-lg pt-1.5 placeholder:text-slate-500"
                      rows={file ? 2 : 3}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      required
                    />
                    
                    {/* Image Preview Area */}
                    {file && (
                      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900/40">
                        <button 
                          type="button"
                          onClick={() => setFile(null)}
                          className="absolute top-2 right-2 p-1.5 bg-[#0a1128]/80 hover:bg-[#0f172a]/80 rounded-full text-slate-300 backdrop-blur-sm transition-colors z-10 shadow-sm"
                        >
                          <X size={18} />
                        </button>
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Preview" 
                          className="w-full max-h-[300px] object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="border-t border-slate-800/50 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800/60 rounded-lg transition-colors text-slate-500 font-medium text-sm"
                      >
                        <ImageIcon size={20} className="text-green-500" />
                        <span className="hidden sm:inline">Photo/Video</span>
                      </button>
                      
                      <div className="relative group">
                        <button 
                          type="button"
                          className="flex items-center gap-1.5 px-3 py-2 hover:bg-slate-800/60 rounded-lg transition-colors text-slate-500 font-medium text-sm"
                        >
                          {visibility === 'public' ? <Globe size={16} className="text-slate-500" /> : <Lock size={16} className="text-slate-500" />}
                          <span className="capitalize">{visibility}</span>
                        </button>
                        {/* Dropdown for visibility */}
                        <div className="absolute top-full left-0 mt-1 w-32 bg-[#0f172a]/80 border border-slate-800 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 overflow-hidden">
                          <button 
                            type="button"
                            onClick={() => setVisibility('public')}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-900/40 ${visibility === 'public' ? 'bg-indigo-900/30 text-indigo-300' : 'text-slate-300'}`}
                          >
                            <Globe size={14} /> Public
                          </button>
                          <button 
                            type="button"
                            onClick={() => setVisibility('private')}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-900/40 ${visibility === 'private' ? 'bg-indigo-900/30 text-indigo-300' : 'text-slate-300'}`}
                          >
                            <Lock size={14} /> Private
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={!file || isUploading}
                      className="px-6 py-2 bg-indigo-500 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          {uploadProgress}%
                        </>
                      ) : (
                        'Post'
                      )}
                    </button>
                  </div>
                </div>

                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
              </form>
            </div>
          </section>
        )}

        {/* Feed Section */}
        <section>
          <div className="max-w-2xl mx-auto space-y-8">
            {currentPosts.map((post) => (
              <motion.div 
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0f172a]/80 rounded-2xl shadow-sm border border-slate-800 overflow-hidden"
              >
                {/* Post Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {post.photoURL ? (
                      <img 
                        src={post.photoURL} 
                        alt={post.name} 
                        className="w-10 h-10 rounded-full object-cover border border-slate-800/50"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-indigo-900/50 text-indigo-400 rounded-full flex items-center justify-center font-bold text-lg">
                        {post.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{post.name}</h3>
                        {user && user.uid !== post.uid && (
                          <button 
                            onClick={() => {
                              const chatUser = chatUsers.find(u => u.uid === post.uid) || {
                                uid: post.uid,
                                name: post.name,
                                photoURL: post.photoURL
                              };
                              setSelectedChatUser(chatUser);
                              setActiveTab('messages');
                            }}
                            className="text-indigo-400 hover:text-indigo-800 transition-colors"
                            title="Message"
                          >
                            <MessageCircle size={16} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {post.visibility === 'private' ? <Lock size={12} /> : <Globe size={12} />}
                        <span>{post.visibility === 'private' ? 'Private' : 'Public'}</span>
                      </div>
                    </div>
                  </div>
                  {user?.uid === post.uid && (
                    <button 
                      onClick={() => setPostToDelete(post)}
                      className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Delete post"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                {/* Post Caption */}
                {post.caption && (
                  <div className="px-4 pb-3 text-slate-200 text-[15px]">
                    {post.caption}
                  </div>
                )}

                {/* Post Image */}
                <div 
                  className="w-full bg-slate-800/60 cursor-pointer border-y border-slate-800/50"
                  onClick={() => setSelectedImage(post)}
                >
                  <img 
                    src={post.imageUrl} 
                    alt={post.caption} 
                    className="w-full max-h-[600px] object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Post Actions */}
                <div className="p-2 px-4">
                  <div className="flex items-center gap-2 py-2">
                    <button 
                      onClick={() => toggleLike(post)} 
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-500 hover:bg-slate-900/40 rounded-lg transition-colors font-medium"
                    >
                      <Heart size={20} className={post.likes?.includes(user?.uid || '') ? "fill-red-500 text-red-500" : ""} />
                      <span>{post.likes?.length || 0} Like{post.likes?.length !== 1 ? 's' : ''}</span>
                    </button>
                    <button 
                      onClick={() => setSelectedImage(post)} 
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-500 hover:bg-slate-900/40 rounded-lg transition-colors font-medium"
                    >
                      <MessageCircle size={20} />
                      <span>Comment</span>
                    </button>
                    <button 
                      onClick={() => handleShare(post)} 
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-500 hover:bg-slate-900/40 rounded-lg transition-colors font-medium"
                    >
                      <Share2 size={20} />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {filteredPosts.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
              <p>No pictures found. Be the first to upload!</p>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-12">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-4 py-2 bg-[#0f172a]/80 border border-slate-800 rounded-xl font-medium text-slate-300 hover:bg-slate-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              <span className="text-sm font-medium text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-4 py-2 bg-[#0f172a]/80 border border-slate-800 rounded-xl font-medium text-slate-300 hover:bg-slate-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </section>
        </>
        )}

        {activeTab === 'wallet' && user && (
          <section className="max-w-2xl mx-auto">
            <div className="bg-[#0f172a]/80 rounded-2xl shadow-sm border border-slate-800 p-6 mb-8 text-center">
              <h2 className="text-lg font-medium text-slate-500 mb-2">Current Balance</h2>
              <div className="text-4xl font-bold text-white mb-4">৳ {userProfile?.balance?.toFixed(2) || '0.00'}</div>
              <p className="text-sm text-slate-500">Earn ৳ 0.10 for every post you upload!</p>
            </div>

            <div className="bg-[#0f172a]/80 rounded-2xl shadow-sm border border-slate-800 p-6 mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">Withdraw Funds</h3>
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Payment Method</label>
                  <select 
                    value={withdrawMethod}
                    onChange={(e) => setWithdrawMethod(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-900/300 outline-none"
                  >
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Account Number</label>
                  <input 
                    type="text" 
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 017XXXXXXXX"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-900/300 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Amount (Min ৳ 100)</label>
                  <input 
                    type="number" 
                    min="100"
                    step="0.01"
                    max={userProfile?.balance || 0}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="100"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-900/300 outline-none"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!userProfile || userProfile.balance < 100}
                  className="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Request
                </button>
              </form>
            </div>

            {withdrawals.length > 0 && (
              <div className="bg-[#0f172a]/80 rounded-2xl shadow-sm border border-slate-800 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Withdrawal History</h3>
                <div className="space-y-3">
                  {withdrawals.map(w => (
                    <div key={w.id} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-800/50">
                      <div>
                        <div className="font-medium text-white capitalize">{w.method}</div>
                        <div className="text-xs text-slate-500">{w.accountNumber}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white">৳ {w.amount.toFixed(2)}</div>
                        <div className={`text-xs font-medium ${
                          w.status === 'approved' ? 'text-green-600' : 
                          w.status === 'rejected' ? 'text-red-600' : 'text-orange-500'
                        }`}>
                          {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'profile' && user && (
          <section className="max-w-2xl mx-auto">
            <div className="bg-[#0f172a]/80 rounded-2xl shadow-sm border border-slate-800 p-6 mb-8 text-center relative">
              {!isEditingProfile ? (
                <>
                  <button 
                    onClick={() => {
                      setEditName(user.displayName || '');
                      setIsEditingProfile(true);
                    }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    Edit Profile
                  </button>
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                    alt="Profile" 
                    className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-indigo-900/30 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <h2 className="text-2xl font-bold text-white">{user.displayName}</h2>
                  <p className="text-slate-500 mb-6">{user.email}</p>
                  
                  <button 
                    onClick={logOut}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-slate-800/60 text-slate-300 rounded-full font-medium hover:bg-slate-700/60 transition-colors"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="space-y-4 max-w-sm mx-auto">
                  <h2 className="text-xl font-bold text-white mb-4">Edit Profile</h2>
                  
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <img 
                      src={editPhotoFile ? URL.createObjectURL(editPhotoFile) : (user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`)} 
                      alt="Profile Preview" 
                      className="w-24 h-24 rounded-full object-cover border-4 border-indigo-900/30"
                      referrerPolicy="no-referrer"
                    />
                    <button 
                      onClick={() => profileFileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors"
                    >
                      <Upload size={14} />
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={profileFileInputRef}
                      onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1 text-left">Display Name</label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      placeholder="Your name"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => {
                        setIsEditingProfile(false);
                        setEditPhotoFile(null);
                      }}
                      className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors"
                      disabled={isSavingProfile}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="flex-1 px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                    >
                      {isSavingProfile ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <h3 className="text-xl font-semibold text-white mb-4">Your Posts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {posts.filter(p => p.uid === user.uid).map(post => (
                <div key={post.id} className="aspect-square rounded-xl overflow-hidden bg-slate-800/60 cursor-pointer" onClick={() => setSelectedImage(post)}>
                  <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'messages' && user && (
          <section className="max-w-4xl mx-auto h-[calc(100vh-12rem)] min-h-[500px] bg-[#0f172a]/80 rounded-2xl shadow-sm border border-slate-800 overflow-hidden flex">
            {/* Users List */}
            <div className={`w-full md:w-80 border-r border-slate-800 flex flex-col ${selectedChatUser ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-slate-800 bg-slate-900/40">
                <h2 className="text-lg font-bold text-white">Messages</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chatUsers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No users found.</div>
                ) : (
                  chatUsers.map(chatUser => (
                    <button
                      key={chatUser.uid}
                      onClick={() => setSelectedChatUser(chatUser)}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-slate-900/40 transition-colors border-b border-slate-800/50 text-left ${selectedChatUser?.uid === chatUser.uid ? 'bg-indigo-900/30/50' : ''}`}
                    >
                      <div className="w-12 h-12 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center font-bold text-lg shrink-0">
                        {chatUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h3 className="font-semibold text-white truncate">{chatUser.name}</h3>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col bg-slate-900/40 ${!selectedChatUser ? 'hidden md:flex' : 'flex'}`}>
              {selectedChatUser ? (
                <>
                  <div className="p-4 bg-[#0f172a]/80 border-b border-slate-800 flex items-center gap-3 sticky top-0 z-10">
                    <button 
                      onClick={() => setSelectedChatUser(null)}
                      className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-200"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center font-bold text-lg">
                      {selectedChatUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{selectedChatUser.name}</h3>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.map(msg => {
                      const isMe = msg.senderId === user.uid;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-[#0f172a]/80 border border-slate-800 text-slate-200 rounded-bl-sm'}`}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })}
                    {chatMessages.length === 0 && (
                      <div className="h-full flex items-center justify-center text-slate-500">
                        Say hi to {selectedChatUser.name}!
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-[#0f172a]/80 border-t border-slate-800">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2.5 bg-slate-800/60 border-transparent focus:bg-[#0f172a]/80 border focus:border-indigo-900/300 rounded-full outline-none transition-all"
                      />
                      <button 
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-2.5 bg-indigo-500 text-white rounded-full hover:bg-indigo-500 transition-colors disabled:opacity-50"
                      >
                        <Reply size={20} className="rotate-180" />
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                  <MessageCircle size={48} className="text-slate-300 mb-4" />
                  <h3 className="text-xl font-medium text-slate-300 mb-2">Your Messages</h3>
                  <p>Select a user from the list to start chatting.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/80 backdrop-blur-lg border-t border-slate-800 px-6 py-3 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between relative">
          <button 
            onClick={() => setActiveTab('home')}
            className={`p-2 transition-colors ${activeTab === 'home' ? 'text-[#38bdf8]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Home size={24} />
          </button>
          
          <button 
            onClick={() => {
              if (!user) {
                handleSignIn();
                return;
              }
              setActiveTab('wallet');
            }}
            className={`p-2 transition-colors ${activeTab === 'wallet' ? 'text-[#38bdf8]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Wallet size={24} />
          </button>
          
          {/* Center Add Button */}
          <div className="relative -top-6">
            <button 
              onClick={() => {
                if (!user) {
                  handleSignIn();
                  return;
                }
                setActiveTab('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                // Focus file input if possible, or just scroll to top
              }}
              className="w-14 h-14 bg-[#38bdf8] rounded-2xl flex items-center justify-center text-black shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:scale-105 transition-transform"
            >
              <Plus size={28} strokeWidth={2.5} />
            </button>
          </div>
          
          <button 
            onClick={() => {
              if (!user) {
                handleSignIn();
                return;
              }
              setActiveTab('messages');
            }}
            className={`p-2 transition-colors ${activeTab === 'messages' ? 'text-[#38bdf8]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <MessageCircle size={24} />
          </button>
          
          <button 
            onClick={() => {
              if (!user) {
                handleSignIn();
                return;
              }
              setActiveTab('profile');
            }}
            className={`p-2 transition-colors ${activeTab === 'profile' ? 'text-[#38bdf8]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <UserIcon size={24} />
          </button>
        </div>
      </nav>

      {/* Modal */}
      <AnimatePresence>
        {postToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !isDeleting && setPostToDelete(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f172a]/80 rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Picture?</h3>
              <p className="text-slate-500 mb-6">Are you sure you want to delete this picture? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setPostToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-800/60 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={18} className="animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedImage && !postToDelete && (() => {
          const currentPost = posts.find(p => p.id === selectedImage.id) || selectedImage;
          return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-6xl w-full h-[90vh] flex flex-col md:flex-row bg-[#0f172a]/80 rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left: Image */}
              <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh] md:min-h-0">
                <img 
                  src={currentPost.imageUrl} 
                  alt={currentPost.caption} 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              {/* Right: Sidebar */}
              <div className="w-full md:w-[400px] flex flex-col h-[50vh] md:h-full bg-[#0f172a]/80 border-l border-slate-800">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0f172a]/80 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-900/50 text-indigo-400 rounded-full flex items-center justify-center font-bold">
                      {currentPost.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-white">{currentPost.name}</span>
                  </div>
                  <button 
                    className="text-slate-500 hover:text-slate-300 p-2"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X size={20} />
                  </button>
                </div>
                
                {/* Comments Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-900/40/50">
                  {/* Caption */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-indigo-900/50 text-indigo-400 rounded-full flex items-center justify-center font-bold shrink-0">
                      {currentPost.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-white mr-2">{currentPost.name}</span>
                      <span className="text-slate-300">{currentPost.caption}</span>
                    </div>
                  </div>
                  
                  {/* Comments List */}
                  <div className="space-y-4">
                    {comments.filter(c => !c.replyTo).map(comment => (
                      <div key={comment.id} className="space-y-3">
                        <div className="flex gap-3">
                          {comment.photoURL ? (
                            <img src={comment.photoURL} className="w-8 h-8 rounded-full shrink-0" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 bg-slate-700/60 text-slate-500 rounded-full flex items-center justify-center font-bold shrink-0">
                              {comment.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-white mr-2">{comment.name}</span>
                            <span className="text-slate-300">{comment.text}</span>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                              <button onClick={() => setReplyingTo(comment)} className="font-medium hover:text-slate-300">Reply</button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Replies */}
                        {comments.filter(c => c.replyTo === comment.id).map(reply => (
                          <div key={reply.id} className="flex gap-3 ml-11">
                            {reply.photoURL ? (
                              <img src={reply.photoURL} className="w-6 h-6 rounded-full shrink-0" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-6 h-6 bg-slate-700/60 text-slate-500 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                                {reply.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-white mr-2">{reply.name}</span>
                              <span className="text-slate-300">{reply.text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Actions & Input */}
                <div className="p-4 border-t border-slate-800 bg-[#0f172a]/80 shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <button onClick={() => toggleLike(currentPost)} className="hover:opacity-70 transition-opacity">
                        <Heart size={24} className={currentPost.likes?.includes(user?.uid || '') ? "fill-red-500 text-red-500" : "text-slate-300"} />
                      </button>
                      <button className="hover:opacity-70 transition-opacity text-slate-300">
                        <MessageCircle size={24} />
                      </button>
                      <button onClick={() => handleShare(currentPost)} className="hover:opacity-70 transition-opacity text-slate-300">
                        <Share2 size={24} />
                      </button>
                    </div>
                    <button 
                      onClick={() => handleDownload(currentPost)}
                      className="text-slate-300 hover:opacity-70 transition-opacity"
                      title="Download"
                    >
                      <Download size={24} />
                    </button>
                  </div>
                  
                  <div className="font-medium text-white mb-4">
                    {currentPost.likes?.length || 0} likes
                  </div>
                  
                  {/* Comment Input */}
                  {replyingTo && (
                    <div className="text-xs text-slate-500 mb-2 flex items-center justify-between bg-slate-900/40 p-2 rounded-lg">
                      <span>Replying to <span className="font-medium">{replyingTo.name}</span></span>
                      <button onClick={() => setReplyingTo(null)} className="hover:text-slate-300"><X size={14}/></button>
                    </div>
                  )}
                  <form onSubmit={handleAddComment} className="flex items-center gap-2">
                    <input 
                      value={commentText} 
                      onChange={e => setCommentText(e.target.value)} 
                      placeholder={user ? "Add a comment..." : "Sign in to comment..."}
                      disabled={!user}
                      className="flex-1 outline-none text-sm py-2 bg-transparent"
                    />
                    <button 
                      type="submit" 
                      disabled={!commentText.trim() || !user} 
                      className="text-indigo-400 font-medium disabled:opacity-50 px-2"
                    >
                      Post
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
