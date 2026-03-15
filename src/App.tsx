/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, X, Image as ImageIcon, Loader2, LogIn, LogOut, Trash2, ChevronLeft, ChevronRight, Lock, Globe, Heart, MessageCircle, Share2, Reply, Home, Wallet, User as UserIcon, Plus, Check, CheckCheck, Search, Edit2, UserPlus, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, onSnapshot, query, serverTimestamp, Timestamp, deleteDoc, doc, where, or, updateDoc, arrayUnion, arrayRemove, orderBy, getDoc, getDocs, setDoc, increment } from 'firebase/firestore';
import { onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { 
  signInWithGoogle, 
  logOut, 
  db, 
  auth,
  messaging
} from './firebase';

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
  status?: 'sent' | 'read';
}

interface ChatConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: any;
  lastSenderId: string;
  isRead: boolean;
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<Post | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaptionText, setEditCaptionText] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileUploadProgress, setProfileUploadProgress] = useState(0);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const directProfileFileInputRef = useRef<HTMLInputElement>(null);
  
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
  const [allUsers, setAllUsers] = useState<UserPublicProfile[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<UserPublicProfile | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Profile viewing state
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewingUserProfile, setViewingUserProfile] = useState<UserPublicProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (!viewingUserId) {
      setViewingUserProfile(null);
      return;
    }
    
    // Fetch user profile if it's not the current user
    if (user && viewingUserId !== user.uid) {
      const u = allUsers.find(u => u.uid === viewingUserId);
      if (u) {
        setViewingUserProfile(u);
      } else {
        // fetch from users_public
        getDoc(doc(db, 'users_public', viewingUserId)).then(snap => {
          if (snap.exists()) setViewingUserProfile(snap.data() as UserPublicProfile);
        });
      }
    } else {
      setViewingUserProfile(null);
    }

    // Listen to followers count
    const followersQuery = query(collection(db, 'followers'), where('followingId', '==', viewingUserId));
    const unsubFollowers = onSnapshot(followersQuery, (snap) => {
      setFollowersCount(snap.size);
      if (user) {
        setIsFollowing(snap.docs.some(doc => doc.data().followerId === user.uid));
      }
    });

    // Listen to following count
    const followingQuery = query(collection(db, 'followers'), where('followerId', '==', viewingUserId));
    const unsubFollowing = onSnapshot(followingQuery, (snap) => {
      setFollowingCount(snap.size);
    });

    return () => {
      unsubFollowers();
      unsubFollowing();
    };
  }, [viewingUserId, user, allUsers]);

  // Form state
  const [name, setName] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && messaging && 'Notification' in window) {
      const requestPermission = async () => {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const token = await getToken(messaging, {
              vapidKey: 'BId_z_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X' 
            });
            if (token) {
              console.log('FCM Token:', token);
              await setDoc(doc(db, 'users', user.uid), {
                fcmToken: token
              }, { merge: true });
            }
          }
        } catch (error) {
          console.error('Error getting FCM token:', error);
        }
      };

      requestPermission();

      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Message received in foreground:', payload);
        // Show a simple browser notification if the app is in foreground
        if (payload.notification) {
          new Notification(payload.notification.title || 'New Message', {
            body: payload.notification.body,
            icon: '/firebase-logo.png'
          });
        }
      });

      return () => unsubscribe();
    }
  }, [user]);

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
            const displayName = (currentUser.displayName || 'Anonymous').substring(0, 50);
            const newProfile = {
              uid: currentUser.uid,
              name: displayName,
              email: currentUser.email || '',
              balance: 0
            };
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
            
            // Create public profile for chat
            await setDoc(doc(db, 'users_public', currentUser.uid), {
              uid: currentUser.uid,
              name: displayName,
              photoURL: currentUser.photoURL || ''
            });
          } else {
            setUserProfile(userSnap.data() as UserProfile);
            const displayName = (currentUser.displayName || 'Anonymous').substring(0, 50);
            // Ensure public profile exists
            await setDoc(doc(db, 'users_public', currentUser.uid), {
              uid: currentUser.uid,
              name: displayName,
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
      setAllUsers([]);
      setConversations([]);
      return;
    }
    const qUsers = query(collection(db, 'users_public'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const users = snapshot.docs
        .map(doc => ({ ...doc.data() } as UserPublicProfile))
        .filter(u => u.uid !== user.uid);
      setAllUsers(users);
    });

    const qChats = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid), orderBy('lastMessageTime', 'desc'));
    const unsubChats = onSnapshot(qChats, (snapshot) => {
      setConversations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatConversation)));
    });

    return () => {
      unsubUsers();
      unsubChats();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedChatUser) {
      setChatMessages([]);
      return;
    }
    const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setChatMessages(msgs);

      // Mark messages as read
      const unreadMsgs = snapshot.docs.filter(doc => doc.data().senderId !== user.uid && doc.data().status !== 'read');
      unreadMsgs.forEach(async (msgDoc) => {
        await updateDoc(doc(db, 'chats', chatId, 'messages', msgDoc.id), { status: 'read' });
      });

      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== user.uid) {
          updateDoc(doc(db, 'chats', chatId), { isRead: true }).catch(console.error);
        }
      }
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
      
      if (error.code === 'auth/popup-blocked') {
        message = "Sign-in popup was blocked by your browser. Please allow popups for this site or click the 'Open in new tab' button at the top right.";
      } else if (isIframe && (error.code === 'auth/network-request-failed' || error.code === 'auth/internal-error' || error.message?.includes('popup') || error.code === 'auth/web-storage-unsupported')) {
        message = "Google Chrome blocks sign-in inside this preview window for security.\n\nTo fix this:\n1. Click the 'Open in new tab' button at the top right of this screen.\n2. Sign in from the new tab.\n\nThis is a standard Chrome security measure for embedded apps.";
      }
      
      alert(message);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedChatUser || !newMessage.trim()) return;
    
    const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
    const messageText = newMessage.trim();
    setNewMessage('');

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: messageText,
      senderId: user.uid,
      createdAt: serverTimestamp(),
      status: 'sent'
    });

    await setDoc(doc(db, 'chats', chatId), {
      participants: [user.uid, selectedChatUser.uid],
      lastMessage: messageText,
      lastMessageTime: serverTimestamp(),
      lastSenderId: user.uid,
      isRead: false
    }, { merge: true });

    // Send Push Notification
    try {
      const recipientDoc = await getDoc(doc(db, 'users', selectedChatUser.uid));
      const recipientData = recipientDoc.data();
      if (recipientData?.fcmToken) {
        await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: recipientData.fcmToken,
            title: `New message from ${user.displayName || 'User'}`,
            body: messageText,
            data: {
              chatId: chatId,
              senderId: user.uid
            }
          })
        });
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  };

  const uploadToImgBB = (file: File, onProgress: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Use the provided API key as the primary key, fallback to env if available
      const apiKey = import.meta.env.VITE_IMGBB_API_KEY || '5a96450548a710e6f8cf39c709ed732a';
      
      if (!apiKey || apiKey === 'YOUR_IMGBB_API_KEY') {
        console.error("ImgBB API Key is missing or placeholder");
        reject(new Error("ImgBB API Key is missing. Please contact the administrator."));
        return;
      }

      console.log("Starting upload to ImgBB with key:", apiKey.substring(0, 5) + "...");
      const formData = new FormData();
      formData.append('image', file);

      const xhr = new XMLHttpRequest();
      // ImgBB API endpoint
      const uploadUrl = `https://api.imgbb.com/1/upload?key=${apiKey}`;
      xhr.open('POST', uploadUrl);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        console.log("ImgBB Upload Status:", xhr.status);
        try {
          const response = JSON.parse(xhr.responseText);
          if (xhr.status === 200 && response.success) {
            console.log("ImgBB Upload Success:", response.data.url);
            resolve(response.data.url);
          } else {
            const errorMessage = response.error?.message || `Upload failed (Status ${xhr.status})`;
            console.error("ImgBB Upload Error Details:", response.error);
            reject(new Error(errorMessage));
          }
        } catch (error) {
          console.error("Failed to parse ImgBB response:", xhr.responseText);
          reject(new Error(`Failed to parse server response (Status ${xhr.status})`));
        }
      };

      xhr.onerror = () => {
        console.error("ImgBB XHR Network Error");
        reject(new Error("Network error during upload. Please check your connection."));
      };

      xhr.ontimeout = () => {
        console.error("ImgBB XHR Timeout");
        reject(new Error("Upload timed out. Please try again with a smaller file."));
      };

      // Set a reasonable timeout (60 seconds)
      xhr.timeout = 60000;
      xhr.send(formData);
    });
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    setProfileUploadProgress(0);
    try {
      let newPhotoURL = user.photoURL || '';
      if (editPhotoFile) {
        newPhotoURL = await uploadToImgBB(editPhotoFile, setProfileUploadProgress);
      }
      
      const displayName = (editName || user.displayName || 'Anonymous').substring(0, 50);
      
      await updateProfile(user, {
        displayName: displayName,
        photoURL: newPhotoURL
      });
      
      // Update user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        name: displayName,
        photoURL: newPhotoURL,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update public profile for chat
      const publicUserRef = doc(db, 'users_public', user.uid);
      await setDoc(publicUserRef, {
        uid: user.uid,
        name: displayName,
        photoURL: newPhotoURL
      }, { merge: true });
      
      setUser({ ...user, displayName: displayName, photoURL: newPhotoURL } as User);
      setIsEditingProfile(false);
      setEditPhotoFile(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    } finally {
      setIsSavingProfile(false);
      setProfileUploadProgress(0);
    }
  };

  const handleDirectProfilePictureUpdate = async (file: File) => {
    if (!user) return;
    setIsSavingProfile(true);
    setProfileUploadProgress(0);
    try {
      const newPhotoURL = await uploadToImgBB(file, setProfileUploadProgress);
      
      await updateProfile(user, {
        photoURL: newPhotoURL
      });
      
      // Update user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        photoURL: newPhotoURL,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update public profile for chat
      const publicUserRef = doc(db, 'users_public', user.uid);
      await setDoc(publicUserRef, {
        uid: user.uid,
        photoURL: newPhotoURL
      }, { merge: true });

      // Update local user object to reflect changes immediately
      setUser({ ...user, photoURL: newPhotoURL } as User);
    } catch (error) {
      console.error("Error updating profile picture:", error);
      alert("Failed to update profile picture.");
    } finally {
      setIsSavingProfile(false);
      setProfileUploadProgress(0);
    }
  };

  const handleFollow = async () => {
    if (!user || !viewingUserId || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      await addDoc(collection(db, 'followers'), {
        followerId: user.uid,
        followingId: viewingUserId,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error following user:", error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!user || !viewingUserId || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      const q = query(
        collection(db, 'followers'), 
        where('followerId', '==', user.uid),
        where('followingId', '==', viewingUserId)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(async (docSnap) => {
        await deleteDoc(doc(db, 'followers', docSnap.id));
      });
    } catch (error) {
      console.error("Error unfollowing user:", error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !caption.trim()) return;
    if (!user) {
      alert("Please sign in to post.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let imageUrl = '';
      if (file) {
        imageUrl = await uploadToImgBB(file, setUploadProgress);
      }
      
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
      await setDoc(userRef, {
        balance: increment(0.10)
      }, { merge: true });
      
      setCaption('');
      setFile(null);
      setVisibility('public');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error("Upload error:", error);
      alert(error.message || 'Failed to create post');
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

  const handleSaveCaption = async (postId: string) => {
    if (!user) return;
    setIsSavingCaption(true);
    try {
      await updateDoc(doc(db, 'posts', postId), {
        caption: editCaptionText
      });
      setEditingPost(null);
      setEditCaptionText('');
    } catch (error) {
      console.error("Error updating caption:", error);
      alert("Failed to update caption.");
    } finally {
      setIsSavingCaption(false);
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
    // Replace ais-dev- with ais-pre- to ensure the shared link is publicly accessible by social media crawlers
    const origin = window.location.origin.replace('ais-dev-', 'ais-pre-');
    const url = `${origin}?post=${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.name}`,
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

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.caption?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'profile' && viewingUserId) {
      return matchesSearch && post.uid === viewingUserId;
    }
    return matchesSearch;
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const currentPosts = filteredPosts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex font-bold text-2xl tracking-tight font-bengali animate-heartbeat-neon">
              <span className="bg-white text-[#102a5e] px-2 py-0.5 border-b-[3px] border-[#c8102e] animate-fade-in-left-big">
                আমাদের
              </span>
              <span className="bg-[#c8102e] text-white px-2 py-0.5 border-b-[3px] border-[#c8102e] animate-fade-in-right-big">
                শ্রীবরদী
              </span>
            </div>
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
                <button 
                  onClick={handleSignIn} 
                  className="ml-2 flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-full text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <LogIn size={16} />
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Marquee Section */}
      <div className="bg-[#020617] border-b border-slate-800/50 py-2.5 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4">
          <marquee className="text-lg md:text-xl text-yellow-400 font-bengali font-semibold drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" behavior="scroll" direction="left" scrollamount="7">
            আমাদের শ্রীবরদীর পক্ষ থেকে সকলকে শুভেচ্ছা। আমাদের শ্রীবরদী একটি স্বপ্নযাত্রা। এ যাত্রায় শ্রীবরদীবাসীকে সঙ্গে নিয়ে থাকতে চাই আমরা। সীমান্তবর্তী শ্রীবরদী উপজেলাকে বিশ্ব দরবারে তুলে ধরবো আমরা। মূলত সুন্দর ও স্বপ্নীল একটি শ্রীবরদী গড়ার প্রত্যয়ে আমাদের যাত্রা।
          </marquee>
        </div>
      </div>

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
                      disabled={(!file && !caption.trim()) || isUploading}
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
                    <button 
                      onClick={() => {
                        setViewingUserId(post.uid);
                        setActiveTab('profile');
                      }}
                      className="flex-shrink-0 focus:outline-none"
                    >
                      {post.photoURL ? (
                        <img 
                          src={post.photoURL} 
                          alt={post.name} 
                          className="w-10 h-10 rounded-full object-cover border border-slate-800/50 hover:border-indigo-500 transition-colors"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-indigo-900/50 text-indigo-400 rounded-full flex items-center justify-center font-bold text-lg hover:bg-indigo-800/50 transition-colors border border-transparent hover:border-indigo-500">
                          {post.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setViewingUserId(post.uid);
                            setActiveTab('profile');
                          }}
                          className="font-semibold text-white hover:text-indigo-400 transition-colors focus:outline-none text-left"
                        >
                          {post.name}
                        </button>
                        {user && user.uid !== post.uid && (
                          <button 
                            onClick={() => {
                              const chatUser = allUsers.find(u => u.uid === post.uid) || {
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
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => {
                          setEditingPost(post);
                          setEditCaptionText(post.caption || '');
                        }}
                        className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-50/10 rounded-full transition-colors"
                        title="Edit caption"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => setPostToDelete(post)}
                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50/10 rounded-full transition-colors"
                        title="Delete post"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Post Caption */}
                {editingPost?.id === post.id ? (
                  <div className="px-4 pb-3">
                    <textarea
                      value={editCaptionText}
                      onChange={(e) => setEditCaptionText(e.target.value)}
                      className="w-full bg-slate-800/50 text-slate-200 rounded-xl p-3 border border-slate-700 focus:outline-none focus:border-indigo-500 resize-none"
                      rows={3}
                      placeholder="Write a caption..."
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => {
                          setEditingPost(null);
                          setEditCaptionText('');
                        }}
                        disabled={isSavingCaption}
                        className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveCaption(post.id)}
                        disabled={isSavingCaption}
                        className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        {isSavingCaption ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : post.caption && (
                  <div className="px-4 pb-3 text-slate-200 text-[15px]">
                    {post.caption}
                  </div>
                )}

                {/* Post Image */}
                {post.imageUrl && (
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
                )}

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
              {viewingUserId === user.uid ? (
                // Current User Profile
                !isEditingProfile ? (
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
                    <div className="relative w-24 h-24 mx-auto mb-4 group cursor-pointer" onClick={() => !isSavingProfile && directProfileFileInputRef.current?.click()}>
                      <img 
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                        alt="Profile" 
                        className={`w-24 h-24 rounded-full border-4 border-indigo-900/30 object-cover transition-opacity ${isSavingProfile ? 'opacity-50' : 'group-hover:opacity-75'}`}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload size={20} className="text-white" />
                      </div>
                      {isSavingProfile && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                          <span className="text-white font-bold text-sm">{profileUploadProgress}%</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={directProfileFileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDirectProfilePictureUpdate(file);
                        }}
                        disabled={isSavingProfile}
                      />
                    </div>
                    <h2 className="text-2xl font-bold text-white">{user.displayName}</h2>
                    <p className="text-slate-500 mb-4">{user.email}</p>
                    
                    <div className="flex justify-center gap-6 mb-6 text-slate-300">
                      <div className="text-center">
                        <span className="block font-bold text-white text-lg">{followersCount}</span>
                        <span className="text-sm text-slate-500">Followers</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-white text-lg">{followingCount}</span>
                        <span className="text-sm text-slate-500">Following</span>
                      </div>
                    </div>

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
                        className={`w-24 h-24 rounded-full object-cover border-4 border-indigo-900/30 ${isSavingProfile ? 'opacity-50' : ''}`}
                        referrerPolicy="no-referrer"
                      />
                      {isSavingProfile && editPhotoFile && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                          <span className="text-white font-bold text-sm">{profileUploadProgress}%</span>
                        </div>
                      )}
                      <button 
                        onClick={() => profileFileInputRef.current?.click()}
                        disabled={isSavingProfile}
                        className="absolute bottom-0 right-0 p-1.5 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors disabled:opacity-50"
                      >
                        <Upload size={14} />
                      </button>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={profileFileInputRef}
                        onChange={(e) => setEditPhotoFile(e.target.files?.[0] || null)}
                        disabled={isSavingProfile}
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
                )
              ) : (
                // Other User Profile
                viewingUserProfile && (
                  <>
                    <div className="relative w-24 h-24 mx-auto mb-4">
                      <img 
                        src={viewingUserProfile.photoURL || `https://ui-avatars.com/api/?name=${viewingUserProfile.name}`} 
                        alt="Profile" 
                        className="w-24 h-24 rounded-full border-4 border-indigo-900/30 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">{viewingUserProfile.name}</h2>
                    
                    <div className="flex justify-center gap-6 mb-6 text-slate-300">
                      <div className="text-center">
                        <span className="block font-bold text-white text-lg">{followersCount}</span>
                        <span className="text-sm text-slate-500">Followers</span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-white text-lg">{followingCount}</span>
                        <span className="text-sm text-slate-500">Following</span>
                      </div>
                    </div>

                    <div className="flex justify-center gap-3">
                      <button 
                        onClick={() => {
                          setSelectedChatUser(viewingUserProfile);
                          setActiveTab('messages');
                        }}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600/20 text-indigo-400 rounded-full font-medium hover:bg-indigo-600/30 transition-colors"
                      >
                        <MessageCircle size={18} />
                        Message
                      </button>
                      <button 
                        onClick={isFollowing ? handleUnfollow : handleFollow}
                        disabled={isFollowLoading}
                        className={`inline-flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-colors disabled:opacity-50 ${
                          isFollowing 
                            ? 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {isFollowLoading ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : isFollowing ? (
                          <>
                            <UserMinus size={18} />
                            Unfollow
                          </>
                        ) : (
                          <>
                            <UserPlus size={18} />
                            Follow
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )
              )}
            </div>

            <h3 className="text-xl font-semibold text-white mb-4">
              {viewingUserId === user.uid ? 'Your Posts' : `${viewingUserProfile?.name}'s Posts`}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {posts.filter(p => p.uid === viewingUserId).map(post => (
                <div key={post.id} className="aspect-square rounded-xl overflow-hidden bg-slate-800/60 cursor-pointer relative" onClick={() => setSelectedImage(post)}>
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full p-4 flex items-center justify-center text-center text-slate-300 bg-slate-800">
                      <p className="line-clamp-4 text-sm font-medium">{post.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'messages' && user && (
          <section className="max-w-4xl mx-auto h-[calc(100vh-12rem)] min-h-[500px] bg-[#0f172a]/80 rounded-2xl shadow-sm border border-slate-800 overflow-hidden flex relative">
            {/* Users List */}
            <div className={`w-full md:w-80 border-r border-slate-800 flex flex-col ${selectedChatUser ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">Messages</h2>
                <button onClick={() => setShowNewChatModal(true)} className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-full text-white transition-colors">
                  <Plus size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No messages yet. Start a new chat!</div>
                ) : (
                  conversations.map(conv => {
                    const otherUserId = conv.participants.find(id => id !== user.uid);
                    const otherUser = allUsers.find(u => u.uid === otherUserId);
                    if (!otherUser) return null;

                    const isUnread = conv.lastSenderId !== user.uid && !conv.isRead;

                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedChatUser(otherUser)}
                        className={`w-full p-4 flex items-center gap-3 hover:bg-slate-900/40 transition-colors border-b border-slate-800/50 text-left ${selectedChatUser?.uid === otherUser.uid ? 'bg-indigo-900/30/50' : ''}`}
                      >
                        <div className="relative shrink-0">
                          {otherUser.photoURL ? (
                            <img src={otherUser.photoURL} alt={otherUser.name} className="w-12 h-12 rounded-full border border-slate-700 object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center font-bold text-lg">
                              {otherUser.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h3 className={`truncate ${isUnread ? 'font-bold text-white' : 'font-semibold text-slate-200'}`}>{otherUser.name}</h3>
                          <div className="flex items-center gap-1 mt-0.5">
                            {conv.lastSenderId === user.uid && (
                              <span className="shrink-0">
                                {conv.isRead ? <CheckCheck size={14} className="text-emerald-500" /> : <Check size={14} className="text-slate-400" />}
                              </span>
                            )}
                            <p className={`text-sm truncate ${isUnread ? 'font-bold text-white' : 'text-slate-400'}`}>
                              {conv.lastSenderId === user.uid ? 'You: ' : ''}{conv.lastMessage}
                            </p>
                          </div>
                        </div>
                        {isUnread && (
                          <div className="w-3 h-3 bg-indigo-500 rounded-full shrink-0"></div>
                        )}
                      </button>
                    );
                  })
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
                    {selectedChatUser.photoURL ? (
                      <img src={selectedChatUser.photoURL} alt={selectedChatUser.name} className="w-10 h-10 rounded-full border border-slate-700 object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center font-bold text-lg">
                        {selectedChatUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-white">{selectedChatUser.name}</h3>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.map(msg => {
                      const isMe = msg.senderId === user.uid;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-[#0f172a]/80 border border-slate-800 text-slate-200 rounded-bl-sm'}`}>
                            {msg.text}
                          </div>
                          {isMe && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                              {msg.status === 'read' ? (
                                <CheckCheck size={12} className="text-emerald-500" />
                              ) : (
                                <Check size={12} />
                              )}
                            </div>
                          )}
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
                        className="p-2.5 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors disabled:opacity-50"
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
                  <p>Select a conversation to start chatting.</p>
                </div>
              )}
            </div>
            
            {/* New Chat Modal */}
            {showNewChatModal && (
              <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-sm flex flex-col">
                <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                  <button onClick={() => setShowNewChatModal(false)} className="p-2 -ml-2 text-slate-400 hover:text-white">
                    <ChevronLeft size={24} />
                  </button>
                  <h3 className="font-bold text-white text-lg">New Chat</h3>
                </div>
                <div className="p-4 border-b border-slate-800">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text"
                      placeholder="Search users..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {allUsers.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase())).map(u => (
                    <button
                      key={u.uid}
                      onClick={() => {
                        setSelectedChatUser(u);
                        setShowNewChatModal(false);
                        setUserSearchQuery('');
                      }}
                      className="w-full p-3 flex items-center gap-3 hover:bg-slate-800/50 rounded-xl transition-colors text-left"
                    >
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.name} className="w-10 h-10 rounded-full border border-slate-700 object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center font-bold text-lg shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-white">{u.name}</span>
                    </button>
                  ))}
                  {allUsers.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase())).length === 0 && (
                    <div className="p-8 text-center text-slate-500">No users found.</div>
                  )}
                </div>
              </div>
            )}
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
              setViewingUserId(user.uid);
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
              {/* Left: Image or Text */}
              <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh] md:min-h-0">
                {currentPost.imageUrl ? (
                  <img 
                    src={currentPost.imageUrl} 
                    alt={currentPost.caption} 
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="p-8 text-center text-2xl md:text-4xl font-medium text-slate-200 leading-relaxed overflow-y-auto max-h-full w-full flex items-center justify-center">
                    {currentPost.caption}
                  </div>
                )}
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
                    <button 
                      onClick={() => {
                        setViewingUserId(currentPost.uid);
                        setActiveTab('profile');
                        setSelectedImage(null);
                      }}
                      className="shrink-0 focus:outline-none"
                    >
                      {currentPost.photoURL ? (
                        <img src={currentPost.photoURL} className="w-8 h-8 rounded-full hover:opacity-80 transition-opacity" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 bg-indigo-900/50 text-indigo-400 rounded-full flex items-center justify-center font-bold hover:bg-indigo-800/50 transition-colors">
                          {currentPost.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>
                    <div className="flex-1">
                      <button 
                        onClick={() => {
                          setViewingUserId(currentPost.uid);
                          setActiveTab('profile');
                          setSelectedImage(null);
                        }}
                        className="font-medium text-white mr-2 hover:text-indigo-400 transition-colors focus:outline-none"
                      >
                        {currentPost.name}
                      </button>
                      {editingPost?.id === currentPost.id ? (
                        <div className="mt-2">
                          <textarea
                            value={editCaptionText}
                            onChange={(e) => setEditCaptionText(e.target.value)}
                            className="w-full bg-slate-800/50 text-slate-200 rounded-xl p-3 border border-slate-700 focus:outline-none focus:border-indigo-500 resize-none"
                            rows={3}
                            placeholder="Write a caption..."
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => {
                                setEditingPost(null);
                                setEditCaptionText('');
                              }}
                              disabled={isSavingCaption}
                              className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveCaption(currentPost.id)}
                              disabled={isSavingCaption}
                              className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                              {isSavingCaption ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300">{currentPost.caption}</span>
                      )}
                    </div>
                    {user?.uid === currentPost.uid && editingPost?.id !== currentPost.id && (
                      <button 
                        onClick={() => {
                          setEditingPost(currentPost);
                          setEditCaptionText(currentPost.caption || '');
                        }}
                        className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-50/10 rounded-full transition-colors self-start"
                        title="Edit caption"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </div>
                  
                  {/* Comments List */}
                  <div className="space-y-4">
                    {comments.filter(c => !c.replyTo).map(comment => (
                      <div key={comment.id} className="space-y-3">
                        <div className="flex gap-3">
                          <button 
                            onClick={() => {
                              setViewingUserId(comment.uid);
                              setActiveTab('profile');
                              setSelectedImage(null);
                            }}
                            className="shrink-0 focus:outline-none"
                          >
                            {comment.photoURL ? (
                              <img src={comment.photoURL} className="w-8 h-8 rounded-full hover:opacity-80 transition-opacity" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-8 h-8 bg-slate-700/60 text-slate-500 rounded-full flex items-center justify-center font-bold hover:bg-slate-600/60 transition-colors">
                                {comment.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </button>
                          <div>
                            <button 
                              onClick={() => {
                                setViewingUserId(comment.uid);
                                setActiveTab('profile');
                                setSelectedImage(null);
                              }}
                              className="font-medium text-white mr-2 hover:text-indigo-400 transition-colors focus:outline-none"
                            >
                              {comment.name}
                            </button>
                            <span className="text-slate-300">{comment.text}</span>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                              <button onClick={() => setReplyingTo(comment)} className="font-medium hover:text-slate-300">Reply</button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Replies */}
                        {comments.filter(c => c.replyTo === comment.id).map(reply => (
                          <div key={reply.id} className="flex gap-3 ml-11">
                            <button 
                              onClick={() => {
                                setViewingUserId(reply.uid);
                                setActiveTab('profile');
                                setSelectedImage(null);
                              }}
                              className="shrink-0 focus:outline-none"
                            >
                              {reply.photoURL ? (
                                <img src={reply.photoURL} className="w-6 h-6 rounded-full hover:opacity-80 transition-opacity" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-6 h-6 bg-slate-700/60 text-slate-500 rounded-full flex items-center justify-center font-bold text-xs hover:bg-slate-600/60 transition-colors">
                                  {reply.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </button>
                            <div>
                              <button 
                                onClick={() => {
                                  setViewingUserId(reply.uid);
                                  setActiveTab('profile');
                                  setSelectedImage(null);
                                }}
                                className="font-medium text-white mr-2 hover:text-indigo-400 transition-colors focus:outline-none"
                              >
                                {reply.name}
                              </button>
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
