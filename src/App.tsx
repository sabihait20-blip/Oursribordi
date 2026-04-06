/// <reference types="vite/client" />
import React, { useState, useEffect, useRef, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, Link } from 'react-router-dom';
import { Upload, Download, X, Image as ImageIcon, Loader2, LogIn, LogOut, Trash2, ChevronLeft, ChevronRight, Lock, Globe, Heart, MessageCircle, Share2, Reply, Home, Wallet, User as UserIcon, Plus, Check, CheckCheck, Search, Edit2, UserPlus, UserMinus, Bookmark, Shield, Trophy, Award, Bell, Camera, Eye, AtSign, ShoppingBag, Store, ShoppingCart, Users, BarChart3, Megaphone, FileText, Mic, MicOff, Phone, Paperclip, Video, VideoOff, SwitchCamera, PhoneOff, PhoneIncoming, PhoneOutgoing, Volume2, VolumeX, ShieldCheck, Ban } from 'lucide-react';
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

interface Story {
  id: string;
  uid: string;
  name: string;
  photoURL: string;
  imageUrl: string;
  createdAt: any;
  expiresAt: any;
}

interface Post {
  id: string;
  name: string;
  caption: string;
  imageUrl: string;
  createdAt: any;
  uid: string;
  username?: string;
  visibility?: 'public' | 'private';
  likes?: string[];
  photoURL?: string;
  views?: number;
}

interface Comment {
  id: string;
  text: string;
  uid: string;
  name: string;
  username?: string;
  photoURL: string;
  createdAt: any;
  replyTo?: string | null;
}

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  balance: number;
  role: 'admin' | 'client';
  username?: string;
  savedPosts?: string[];
  isVerified?: boolean;
  fcmToken?: string;
  isPrivate?: boolean;
  blockedUsers?: string[];
  isOnline?: boolean;
  lastSeen?: any;
}

interface UserPublicProfile {
  uid: string;
  name: string;
  photoURL?: string;
  username?: string;
  fcmToken?: string;
  isPrivate?: boolean;
  isOnline?: boolean;
  lastSeen?: any;
}

interface Withdrawal {
  id: string;
  uid: string;
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
  status: 'sent' | 'read';
  type?: 'text' | 'voice' | 'file' | 'image';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  reactions?: { [emoji: string]: string[] };
}

interface CallSession {
  id: string;
  callerId: string;
  receiverId: string;
  callerName?: string;
  callerPhoto?: string;
  receiverName?: string;
  receiverPhoto?: string;
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'busy' | 'no-answer';
  type: 'voice' | 'video';
  createdAt: any;
  offer?: any;
  answer?: any;
}

interface CallLog {
  id: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  receiverName: string;
  type: 'voice' | 'video';
  status: 'missed' | 'received' | 'dialed';
  duration?: number;
  createdAt: any;
}

interface ChatConversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: any;
  lastSenderId: string;
  isRead: boolean;
  status?: 'pending' | 'accepted';
  initiatedBy?: string;
}

interface AdBanner {
  id: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  createdAt: any;
}

interface VerificationRequest {
  id: string;
  uid: string;
  name: string;
  email: string;
  username?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  state: { hasError: boolean, error: Error | null } = { hasError: false, error: null };

  constructor(props: { children: ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(error?.message || "");
        if (parsedError.error) {
          errorMessage = `Firestore Error: ${parsedError.error} (${parsedError.operationType} on ${parsedError.path})`;
        }
      } catch (e) {
        errorMessage = error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
            <Shield className="text-red-500 mx-auto mb-4" size={48} />
            <h1 className="text-2xl font-bold text-white mb-2">Application Error</h1>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function MainApp() {
  const { username: urlUsername } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [adBanners, setAdBanners] = useState<AdBanner[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<Post | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isLoudspeaker, setIsLoudspeaker] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const addedCandidates = useRef<Set<string>>(new Set());
  const ringtoneAudio = useRef<HTMLAudioElement | null>(null);
  const callingAudio = useRef<HTMLAudioElement | null>(null);
  const recordingTimer = useRef<any>(null);

  // Initialize Sound Effects
  useEffect(() => {
    ringtoneAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
    ringtoneAudio.current.loop = true;
    callingAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1358/1358-preview.mp3');
    callingAudio.current.loop = true;

    return () => {
      ringtoneAudio.current?.pause();
      callingAudio.current?.pause();
    };
  }, []);

  // Handle Ringtone for Incoming Call
  useEffect(() => {
    if (incomingCall && !activeCall) {
      ringtoneAudio.current?.play().catch(e => console.log("Audio play blocked", e));
    } else {
      ringtoneAudio.current?.pause();
      if (ringtoneAudio.current) {
        ringtoneAudio.current.currentTime = 0;
      }
    }
    return () => {
      ringtoneAudio.current?.pause();
    };
  }, [incomingCall, activeCall]);

  // Handle Dial Tone for Outgoing Call
  useEffect(() => {
    if (activeCall && activeCall.status === 'ringing' && activeCall.callerId === user?.uid) {
      callingAudio.current?.play().catch(e => console.log("Audio play blocked", e));
    } else {
      callingAudio.current?.pause();
      if (callingAudio.current) {
        callingAudio.current.currentTime = 0;
      }
    }
    return () => {
      callingAudio.current?.pause();
    };
  }, [activeCall?.status, activeCall?.callerId, user?.uid]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'call_logs'),
      or(where('callerId', '==', user.uid), where('receiverId', '==', user.uid)),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCallLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching call logs:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Call Signaling Listeners
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CallSession));
      if (calls.length > 0 && !activeCall) {
        setIncomingCall(calls[0]);
      }
    });

    return () => unsubscribe();
  }, [user, activeCall]);

  useEffect(() => {
    if (!activeCall || !user) {
      addedCandidates.current.clear();
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'calls', activeCall.id), (snapshot) => {
      const data = snapshot.data() as any;
      if (!data) return;

      if (data.status === 'ended' || data.status === 'declined' || data.status === 'busy' || data.status === 'no-answer') {
        handleEndCall();
      }

      if (data.answer && !peerConnection.current?.remoteDescription) {
        peerConnection.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
      }

      // Handle ICE candidates from the other party
      const otherId = data.callerId === user.uid ? data.receiverId : data.callerId;
      const candidates = data.iceCandidates?.[otherId];
      if (candidates && peerConnection.current?.remoteDescription) {
        candidates.forEach((candidate: any) => {
          const candidateStr = JSON.stringify(candidate);
          if (!addedCandidates.current.has(candidateStr)) {
            peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate))
              .then(() => addedCandidates.current.add(candidateStr))
              .catch(e => console.error("Error adding ICE candidate", e));
          }
        });
      }
    });

    return () => unsubscribe();
  }, [activeCall, user]);

  // Voice Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await sendVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(recordingTimer.current);
    }
  };

  const sendVoiceMessage = async (blob: Blob) => {
    if (!selectedChatUser || !user) return;

    setIsUploadingFile(true);
    try {
      // For demo purposes, we'll use base64 if it's small, or a mock upload
      // In a real app, upload to Firebase Storage
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        const isNewChat = !chatDoc.exists();
        
        const messageData = {
          text: '🎤 Voice Message',
          senderId: user.uid,
          createdAt: serverTimestamp(),
          status: 'sent',
          type: 'voice',
          fileUrl: base64data, // Using base64 for demo
          duration: recordingDuration
        };

        await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
        
        const chatData: any = {
          lastMessage: '🎤 Voice Message',
          lastSenderId: user.uid,
          lastMessageTime: serverTimestamp(),
          participants: [user.uid, selectedChatUser.uid],
          isRead: false
        };

        if (isNewChat) {
          chatData.status = 'pending';
          chatData.initiatedBy = user.uid;
        }

        await setDoc(doc(db, 'chats', chatId), chatData, { merge: true });
      };
    } catch (err) {
      console.error("Error sending voice message:", err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChatUser || !user) return;

    setIsUploadingFile(true);
    try {
      // Mock file upload - in real app use Firebase Storage
      // For demo, we'll use base64 for small files
      if (file.size > 1024 * 1024) {
        alert("File too large for demo (max 1MB)");
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
        const chatDoc = await getDoc(doc(db, 'chats', chatId));
        const isNewChat = !chatDoc.exists();
        
        const messageData = {
          text: `📁 ${file.name}`,
          senderId: user.uid,
          createdAt: serverTimestamp(),
          status: 'sent',
          type: 'file',
          fileUrl: base64data,
          fileName: file.name,
          fileSize: file.size
        };

        await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
        
        const chatData: any = {
          lastMessage: `📁 ${file.name}`,
          lastSenderId: user.uid,
          lastMessageTime: serverTimestamp(),
          participants: [user.uid, selectedChatUser.uid],
          isRead: false
        };

        if (isNewChat) {
          chatData.status = 'pending';
          chatData.initiatedBy = user.uid;
        }

        await setDoc(doc(db, 'chats', chatId), chatData, { merge: true });
      };
    } catch (err) {
      console.error("Error uploading file:", err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [callDuration, setCallDuration] = useState(0);
  const durationInterval = useRef<any>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Reliable stream attachment
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && activeCall?.type === 'video') {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, activeCall]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream && activeCall?.type === 'voice') {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, activeCall]);

  useEffect(() => {
    if (activeCall && activeCall.status === 'accepted') {
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(durationInterval.current);
      setCallDuration(0);
    }
    return () => clearInterval(durationInterval.current);
  }, [activeCall]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  const toggleLoudspeaker = () => {
    setIsLoudspeaker(!isLoudspeaker);
    // On mobile browsers, we can't easily force earpiece vs speaker via JS, 
    // but we can toggle the state for UI feedback. 
    // Most browsers default to speaker for video calls.
  };

  const switchCamera = async () => {
    if (!localStream || activeCall?.type !== 'video') return;
    
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    try {
      // Stop existing video tracks
      localStream.getVideoTracks().forEach(track => track.stop());

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: { 
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      if (newVideoTrack) {
        // Replace track in peer connection
        if (peerConnection.current) {
          const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
        }

        // Update local stream state
        const updatedStream = new MediaStream([
          ...localStream.getAudioTracks(),
          newVideoTrack
        ]);
        setLocalStream(updatedStream);
      }
    } catch (err) {
      console.error("Error switching camera:", err);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calling Logic
  const initiateCall = async (type: 'voice' | 'video', targetUser?: UserPublicProfile) => {
    const callTarget = targetUser || selectedChatUser;
    if (!callTarget || !user) return;

    // Check if blocked
    const recipientDoc = await getDoc(doc(db, 'users', callTarget.uid));
    const recipientData = recipientDoc.data();
    if (recipientData?.blockedUsers?.includes(user.uid)) {
      alert("You cannot call this user.");
      return;
    }
    if (userProfile?.blockedUsers?.includes(callTarget.uid)) {
      alert("Unblock this user to call.");
      return;
    }

    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }, 
        video: type === 'video' ? { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false
      });
      setLocalStream(stream);

      const callRef = collection(db, 'calls');
      const newCall = {
        callerId: user.uid,
        callerName: user.displayName || 'User',
        callerPhoto: user.photoURL || '',
        receiverId: callTarget.uid,
        receiverName: callTarget.name,
        receiverPhoto: callTarget.photoURL || '',
        status: 'ringing',
        type,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(callRef, newCall);
      setActiveCall({ id: docRef.id, ...newCall } as CallSession);
      // isConnecting remains true until WebRTC connects

      // WebRTC Setup
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      pc.ontrack = (event) => {
        console.log("Remote track received:", event.track.kind);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setIsConnecting(false);
        }
      };

      // ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          updateDoc(docRef, { 
            [`iceCandidates.${user.uid}`]: arrayUnion(event.candidate.toJSON()) 
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateDoc(docRef, { offer: { type: offer.type, sdp: offer.sdp } });

      // Send Push Notification for Call
      try {
        const recipientDoc = await getDoc(doc(db, 'users', selectedChatUser.uid));
        const recipientData = recipientDoc.data();
        if (recipientData?.fcmToken) {
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: recipientData.fcmToken,
              title: `Incoming ${type} call`,
              body: `${user.displayName || 'Someone'} is calling you...`,
              data: {
                type: 'call',
                callId: docRef.id,
                callType: type,
                callerId: user.uid,
                callerName: user.displayName || 'User'
              }
            })
          });
        }
      } catch (error) {
        console.error('Error sending call notification:', error);
      }

      // Timeout for no answer (30 seconds)
      setTimeout(async () => {
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().status === 'ringing') {
          await updateDoc(docRef, { status: 'no-answer' });
          handleEndCall();
        }
      }, 30000);

    } catch (err) {
      console.error("Error starting call:", err);
      alert("Could not start call. Check camera/mic permissions.");
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !user) return;

    setIsConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }, 
        video: incomingCall.type === 'video' ? { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false
      });
      setLocalStream(stream);
      setActiveCall(incomingCall);
      setIncomingCall(null);
      // isConnecting remains true until WebRTC connects

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      pc.ontrack = (event) => {
        console.log("Remote track received (Accept):", event.track.kind);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE Connection State (Accept):", pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setIsConnecting(false);
        }
      };

      // ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          updateDoc(doc(db, 'calls', incomingCall.id), { 
            [`iceCandidates.${user.uid}`]: arrayUnion(event.candidate.toJSON()) 
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await updateDoc(doc(db, 'calls', incomingCall.id), { 
        status: 'accepted',
        answer: { type: answer.type, sdp: answer.sdp }
      });

    } catch (err) {
      console.error("Error accepting call:", err);
      setIsConnecting(false);
      handleDeclineCall();
    }
  };

  const handleDeclineCall = async () => {
    if (incomingCall) {
      await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'declined' });
      
      // Log missed call
      await addDoc(collection(db, 'call_logs'), {
        callerId: incomingCall.callerId,
        receiverId: incomingCall.receiverId,
        callerName: incomingCall.callerName || 'Unknown',
        receiverName: incomingCall.receiverName || 'Unknown',
        callerPhoto: incomingCall.callerPhoto || '',
        receiverPhoto: incomingCall.receiverPhoto || '',
        type: incomingCall.type,
        status: 'missed',
        createdAt: serverTimestamp()
      });

      setIncomingCall(null);
    }
  };

  const handleDeleteCallLog = async (e: React.MouseEvent, logId: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'call_logs', logId));
    } catch (error) {
      console.error("Error deleting call log:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChatUser || !user) return;
    const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!user) return;
    
    const confirmDelete = window.confirm("Are you sure you want to delete this entire conversation? This cannot be undone.");
    if (!confirmDelete) return;

    try {
      // Delete all messages in the conversation first
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const messagesSnap = await getDocs(messagesRef);
      const deletePromises = messagesSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Delete the conversation document itself
      await deleteDoc(doc(db, 'chats', chatId));
      
      if (selectedChatUser && [user.uid, selectedChatUser.uid].sort().join('_') === chatId) {
        setSelectedChatUser(null);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const handleEndCall = async () => {
    if (activeCall) {
      const callRef = doc(db, 'calls', activeCall.id);
      const snap = await getDoc(callRef);
      const data = snap.data() as CallSession;

      if (data?.status !== 'ended') {
        await updateDoc(callRef, { status: 'ended' });
      }

      // Log call
      if (data) {
        await addDoc(collection(db, 'call_logs'), {
          callerId: data.callerId,
          receiverId: data.receiverId,
          callerName: data.callerName || 'Unknown',
          receiverName: data.receiverName || 'Unknown',
          callerPhoto: data.callerPhoto || '',
          receiverPhoto: data.receiverPhoto || '',
          type: data.type,
          status: data.callerId === user?.uid ? 'dialed' : 'received',
          duration: callDuration,
          createdAt: serverTimestamp()
        });
      }
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallDuration(0);
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
  };
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleTestNotification = async () => {
    if (!user || !userProfile?.fcmToken) {
      alert("Notification token not found. Please ensure you have granted notification permission and provided the VAPID key in settings.");
      return;
    }

    setIsTestingNotification(true);
    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: userProfile.fcmToken,
          title: 'Test Notification',
          body: 'This is a test notification from আমাদের শ্রীবরদী!',
          data: { type: 'test' }
        })
      });
      const result = await response.json();
      if (result.success) {
        alert("Test notification sent! Check your device.");
      } else {
        alert("Failed to send test notification: " + result.error);
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      alert("Error sending test notification. Check console for details.");
    } finally {
      setIsTestingNotification(false);
    }
  };

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaptionText, setEditCaptionText] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
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
  const [activeTab, setActiveTab] = useState<'home' | 'wallet' | 'profile' | 'messages' | 'admin' | 'calls'>('home');
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
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);

  // Profile viewing state
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewingUserProfile, setViewingUserProfile] = useState<UserPublicProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [allWithdrawals, setAllWithdrawals] = useState<Withdrawal[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [isEditingUserBalance, setIsEditingUserBalance] = useState<string | null>(null);
  const [newUserBalance, setNewUserBalance] = useState(0);
  const [adminActiveSubTab, setAdminActiveSubTab] = useState<'withdrawals' | 'users' | 'posts' | 'ads' | 'verification'>('withdrawals');
  const [globalNotifications, setGlobalNotifications] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalBalance: 0,
    pendingWithdrawals: 0,
    totalWithdrawals: 0,
    totalPosts: 0
  });
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [postSearchQuery, setPostSearchQuery] = useState('');
  const [adminNotificationTitle, setAdminNotificationTitle] = useState('');
  const [adminNotificationBody, setAdminNotificationBody] = useState('');
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [allAdBanners, setAllAdBanners] = useState<AdBanner[]>([]);
  const [newAdLink, setNewAdLink] = useState('');
  const [newAdFile, setNewAdFile] = useState<File | null>(null);
  const [isUploadingAd, setIsUploadingAd] = useState(false);
  const [adUploadProgress, setAdUploadProgress] = useState(0);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [isRequestingVerification, setIsRequestingVerification] = useState(false);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [profileViewTab, setProfileViewTab] = useState<'posts' | 'saved'>('posts');
  const isAdmin = user?.email === 'sabihait20@gmail.com' || userProfile?.role === 'admin';

  const navigateToProfile = (uid: string, username?: string) => {
    if (username) {
      navigate(`/${username}`);
    } else {
      setViewingUserId(uid);
      setActiveTab('profile');
      if (urlUsername) navigate('/');
    }
  };

  useEffect(() => {
    if (urlUsername) {
      const lookupUsername = async () => {
        try {
          const usernameRef = doc(db, 'usernames', urlUsername.toLowerCase());
          const usernameSnap = await getDoc(usernameRef);
          if (usernameSnap.exists()) {
            const targetUid = usernameSnap.data().uid;
            setViewingUserId(targetUid);
            setActiveTab('profile');
          } else {
            navigate('/');
          }
        } catch (error) {
          console.error("Error looking up username:", error);
          navigate('/');
        }
      };
      lookupUsername();
    } else {
      setViewingUserId(null);
      // Only reset tab if we were on a profile from URL
      // if (activeTab === 'profile') setActiveTab('home');
    }
  }, [urlUsername]);

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
            // Only attempt to get token if a valid-looking VAPID key is provided
            // The previous placeholder was causing an 'atob' error
            const vapidKey = import.meta.env.VITE_VAPID_KEY || ''; // User needs to provide a real VAPID key from Firebase Console
            if (vapidKey) {
              try {
                const token = await getToken(messaging, {
                  vapidKey: vapidKey
                });
                if (token) {
                  console.log('FCM Token obtained:', token);
                  try {
                    await setDoc(doc(db, 'users', user.uid), {
                      uid: user.uid,
                      fcmToken: token
                    }, { merge: true });
                    console.log('FCM Token saved to Firestore');
                  } catch (fsError: any) {
                    console.error('Error saving FCM token to Firestore:', fsError);
                    if (fsError.code === 'permission-denied') {
                      handleFirestoreError(fsError, OperationType.WRITE, `users/${user.uid}`);
                    }
                  }
                }
              } catch (tokenError: any) {
                if (tokenError instanceof Error && tokenError.message.includes('authInfo')) {
                  // This is a Firestore error thrown by handleFirestoreError, rethrow it
                  throw tokenError;
                }
                console.error('Error calling getToken:', tokenError);
                if (tokenError instanceof Error && tokenError.message.includes('permission')) {
                  console.warn('FCM Permission Error: Please ensure "Firebase Cloud Messaging API (V1)" is enabled in Google Cloud Console and your VAPID key is correct.');
                }
              }
            } else {
              console.warn('VITE_VAPID_KEY is missing. FCM token will not be generated.');
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
          console.log("Setting up profile for:", currentUser.uid);
          // Create or get user profile
          const userRef = doc(db, 'users', currentUser.uid);
          let userSnap;
          try {
            console.log("Fetching user document...");
            userSnap = await getDoc(userRef);
            console.log("User document fetched. Exists:", userSnap.exists());
          } catch (e) {
            console.error("Error fetching user document:", e);
            handleFirestoreError(e, OperationType.GET, `users/${currentUser.uid}`);
          }
          
          if (!userSnap?.exists()) {
            const displayName = (currentUser.displayName || 'Anonymous').substring(0, 100);
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              name: displayName,
              email: currentUser.email || '',
              balance: 0,
              role: currentUser.email === 'sabihait20@gmail.com' ? 'admin' : 'client'
            };
            try {
              console.log("Creating new user profile:", newProfile);
              await setDoc(userRef, newProfile);
              console.log("User profile created.");
            } catch (e) {
              console.error("Error creating user profile:", e);
              handleFirestoreError(e, OperationType.CREATE, `users/${currentUser.uid}`);
            }
            setUserProfile(newProfile);
            
            // Create public profile for chat
            try {
              console.log("Creating public profile...");
              await setDoc(doc(db, 'users_public', currentUser.uid), {
                uid: currentUser.uid,
                name: displayName,
                photoURL: currentUser.photoURL || '',
                balance: 0,
                isVerified: false
              });
              console.log("Public profile created.");
            } catch (e) {
              console.error("Error creating public profile:", e);
              handleFirestoreError(e, OperationType.CREATE, `users_public/${currentUser.uid}`);
            }
          } else {
            const data = userSnap.data() as UserProfile;
            setUserProfile(data);
            const displayName = (currentUser.displayName || 'Anonymous').substring(0, 100);
            // Ensure public profile exists
            const publicData: any = {
              uid: currentUser.uid,
              name: displayName,
              photoURL: currentUser.photoURL || '',
              balance: data.balance || 0,
              isVerified: data.isVerified || false
            };
            try {
              console.log("Updating public profile:", publicData);
              await setDoc(doc(db, 'users_public', currentUser.uid), publicData, { merge: true });
              console.log("Public profile updated.");
            } catch (e) {
              console.error("Error updating public profile:", e);
              handleFirestoreError(e, OperationType.UPDATE, `users_public/${currentUser.uid}`);
            }
          }

          // Listen to profile changes
          console.log("Setting up profile snapshot listener...");
          profileUnsub = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              const data = doc.data() as UserProfile;
              setUserProfile(data);
            }
          }, (error) => {
            console.error("Profile snapshot error:", error);
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          });

          // Listen to withdrawals
          console.log("Setting up withdrawals snapshot listener...");
          const wQuery = query(collection(db, 'withdrawals'), where('uid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
          wUnsub = onSnapshot(wQuery, (snapshot) => {
            setWithdrawals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Withdrawal)));
          }, (error) => {
            console.error("Withdrawals snapshot error:", error);
            handleFirestoreError(error, OperationType.LIST, 'withdrawals');
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
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const publicUserRef = doc(db, 'users_public', user.uid);

    const setOnlineStatus = async (status: boolean) => {
      try {
        await setDoc(userRef, { 
          isOnline: status, 
          lastSeen: serverTimestamp() 
        }, { merge: true });
        await setDoc(publicUserRef, { 
          isOnline: status, 
          lastSeen: serverTimestamp() 
        }, { merge: true });
      } catch (error) {
        console.error("Error updating online status:", error);
        // If it's a permission error, it might be due to rules. 
        // The rules have been updated, but we keep this for debugging.
      }
    };

    setOnlineStatus(true);

    const handleVisibilityChange = () => {
      setOnlineStatus(document.visibilityState === 'visible');
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => setOnlineStatus(false));

    return () => {
      setOnlineStatus(false);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  useEffect(() => {
    if (!isAuthReady) return;

    // Fetch Leaderboard (Top 10 users by balance)
    const qLeaderboard = query(collection(db, 'users_public'), orderBy('balance', 'desc'));
    const unsubLeaderboard = onSnapshot(qLeaderboard, (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => !u.isPrivate)
        .slice(0, 10);
      setLeaderboard(usersData);
    });

    // Fetch all withdrawals for Admin
    let unsubAllWithdrawals: (() => void) | undefined;
    if (isAdmin) {
      const qAllWithdrawals = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
      unsubAllWithdrawals = onSnapshot(qAllWithdrawals, (snapshot) => {
        const wData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Withdrawal[];
        setAllWithdrawals(wData);
        
        // Update Stats
        const pending = wData.filter(w => w.status === 'pending').length;
        setAdminStats(prev => ({
          ...prev,
          pendingWithdrawals: pending,
          totalWithdrawals: wData.length
        }));
      });

      const unsubAllBanners = onSnapshot(query(collection(db, 'ad_banners'), orderBy('createdAt', 'desc')), (snapshot) => {
        setAllAdBanners(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdBanner)));
      });

      const unsubAdminUsers = onSnapshot(query(collection(db, 'users'), orderBy('balance', 'desc')), (snapshot) => {
        const users = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as UserProfile[];
        setAdminUsers(users);
        
        // Update Stats
        const totalBal = users.reduce((acc, u) => acc + (u.balance || 0), 0);
        setAdminStats(prev => ({
          ...prev,
          totalUsers: users.length,
          totalBalance: totalBal
        }));
      });

      const unsubAdminPosts = onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc')), (snapshot) => {
        const postsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Post[];
        setAllPosts(postsData);
        setAdminStats(prev => ({
          ...prev,
          totalPosts: postsData.length
        }));
      });

      return () => {
        unsubAllWithdrawals?.();
        unsubAllBanners?.();
        unsubAdminUsers?.();
        unsubAdminPosts?.();
      };
    }

    const qStories = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    const unsubStories = onSnapshot(qStories, (snapshot) => {
      const now = new Date();
      const storiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      // Filter out expired stories (24 hours)
      const activeStories = storiesData.filter(story => {
        if (!story.expiresAt) return true;
        return story.expiresAt.toDate() > now;
      });
      setStories(activeStories);
    });

    const unsubGlobalNotifications = onSnapshot(query(collection(db, 'global_notifications'), orderBy('createdAt', 'desc')), (snapshot) => {
      setGlobalNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubVerificationRequests = onSnapshot(query(collection(db, 'verification_requests'), orderBy('createdAt', 'desc')), (snapshot) => {
      setVerificationRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VerificationRequest)));
    });

    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

    const unsubBanners = onSnapshot(query(collection(db, 'ad_banners'), where('active', '==', true), orderBy('createdAt', 'desc')), (snapshot) => {
      setAdBanners(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AdBanner)));
    });

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      
      const visiblePosts = postsData.filter(post => 
        !post.visibility || post.visibility === 'public' || (user && post.uid === user.uid)
      );

      const searchedPosts = postSearchQuery.trim() === '' 
        ? visiblePosts 
        : visiblePosts.filter(post => 
            post.caption?.toLowerCase().includes(postSearchQuery.toLowerCase()) ||
            post.name?.toLowerCase().includes(postSearchQuery.toLowerCase()) ||
            post.username?.toLowerCase().includes(postSearchQuery.toLowerCase())
          );

      setPosts(searchedPosts);
    }, (error) => {
      console.error("Error fetching posts:", error);
    });

    return () => {
      unsubscribe();
      unsubLeaderboard();
      if (unsubAllWithdrawals) unsubAllWithdrawals();
      unsubStories();
      unsubBanners();
      unsubGlobalNotifications();
      unsubVerificationRequests();
    };
  }, [isAuthReady, user, isAdmin, postSearchQuery]);

  useEffect(() => {
    if (adBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % adBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [adBanners.length]);

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
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        console.log("Sign-in popup was cancelled by user or another request.");
        return;
      }
      
      console.error("Sign in error:", error);
      const isIframe = window.self !== window.top;
      let message = "Sign in failed: " + (error.message || "Unknown error");
      
      if (error.code === 'auth/popup-blocked') {
        message = "Sign-in popup was blocked by your browser. Please allow popups for this site or click the 'Open in new tab' button at the top right.";
      } else if (isIframe && (error.code === 'auth/network-request-failed' || error.code === 'auth/internal-error' || error.message?.includes('popup') || error.code === 'auth/web-storage-unsupported')) {
        message = "Google Chrome blocks sign-in inside this preview window for security.\n\nTo fix this:\n1. Click the 'Open in new tab' button at the top right of this screen.\n2. Sign in from the new tab.\n\nThis is a standard Chrome security measure for embedded apps.";
      }
      
      alert(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAcceptChat = async (chatId: string) => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        status: 'accepted'
      });
    } catch (err) {
      console.error("Error accepting chat:", err);
    }
  };

  const handleRejectChat = async (chatId: string) => {
    try {
      // Delete all messages first
      const messagesSnap = await getDocs(collection(db, 'chats', chatId, 'messages'));
      const deletePromises = messagesSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      
      // Delete the chat document
      await deleteDoc(doc(db, 'chats', chatId));
      setSelectedChatUser(null);
    } catch (err) {
      console.error("Error rejecting chat:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedChatUser || !newMessage.trim()) return;

    // Check if blocked
    const recipientDoc = await getDoc(doc(db, 'users', selectedChatUser.uid));
    const recipientData = recipientDoc.data();
    if (recipientData?.blockedUsers?.includes(user.uid)) {
      alert("You cannot message this user.");
      return;
    }
    if (userProfile?.blockedUsers?.includes(selectedChatUser.uid)) {
      alert("Unblock this user to send a message.");
      return;
    }
    
    const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    const isNewChat = !chatDoc.exists();
    
    const messageText = newMessage.trim();
    setNewMessage('');

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: messageText,
      senderId: user.uid,
      createdAt: serverTimestamp(),
      status: 'sent',
      type: 'text'
    });

    const chatData: any = {
      participants: [user.uid, selectedChatUser.uid],
      lastMessage: messageText,
      lastMessageTime: serverTimestamp(),
      lastSenderId: user.uid,
      isRead: false
    };

    if (isNewChat) {
      chatData.status = 'pending';
      chatData.initiatedBy = user.uid;
    }

    await setDoc(doc(db, 'chats', chatId), chatData, { merge: true });

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

  useEffect(() => {
    if (!editUsername || editUsername === userProfile?.username) {
      setUsernameError('');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(editUsername)) {
      setUsernameError('Username must be 3-20 characters and only contain letters, numbers, and underscores.');
      return;
    }

    const checkUsername = async () => {
      setIsCheckingUsername(true);
      try {
        const usernameRef = doc(db, 'usernames', editUsername.toLowerCase());
        const usernameSnap = await getDoc(usernameRef);
        if (usernameSnap.exists()) {
          setUsernameError('Username is already taken.');
        } else {
          setUsernameError('');
        }
      } catch (error) {
        console.error("Error checking username:", error);
      } finally {
        setIsCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [editUsername, userProfile?.username]);

  const handleBlockUser = async (targetUid: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const isBlocked = userProfile?.blockedUsers?.includes(targetUid);
    
    try {
      await updateDoc(userRef, {
        blockedUsers: isBlocked ? arrayRemove(targetUid) : arrayUnion(targetUid)
      });
    } catch (error) {
      console.error("Error blocking user:", error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user || !selectedChatUser) return;
    const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    
    try {
      const msgSnap = await getDoc(messageRef);
      if (!msgSnap.exists()) return;
      
      const reactions = msgSnap.data().reactions || {};
      const uids = reactions[emoji] || [];
      
      if (uids.includes(user.uid)) {
        reactions[emoji] = uids.filter((id: string) => id !== user.uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...uids, user.uid];
      }
      
      await updateDoc(messageRef, { reactions });
      setReactionPickerMessageId(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const handleRequestVerification = async () => {
    if (!user || !userProfile) return;
    setIsRequestingVerification(true);
    try {
      await addDoc(collection(db, 'verification_requests'), {
        uid: user.uid,
        name: userProfile.name,
        email: userProfile.email,
        username: userProfile.username || '',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert("Verification request submitted!");
    } catch (error) {
      console.error("Error requesting verification:", error);
      alert("Failed to submit verification request.");
    } finally {
      setIsRequestingVerification(false);
    }
  };

  const handleApproveVerification = async (request: VerificationRequest) => {
    try {
      await updateDoc(doc(db, 'users', request.uid), { isVerified: true });
      await updateDoc(doc(db, 'users_public', request.uid), { isVerified: true });
      await updateDoc(doc(db, 'verification_requests', request.id), { status: 'approved' });
      alert("Verification approved!");
    } catch (error) {
      console.error("Error approving verification:", error);
    }
  };

  const handleRejectVerification = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'verification_requests', requestId), { status: 'rejected' });
      alert("Verification rejected.");
    } catch (error) {
      console.error("Error rejecting verification:", error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (usernameError) {
      alert(usernameError);
      return;
    }

    setIsSavingProfile(true);
    setProfileUploadProgress(0);
    try {
      let newPhotoURL = user.photoURL || '';
      if (editPhotoFile) {
        newPhotoURL = await uploadToImgBB(editPhotoFile, setProfileUploadProgress);
      }
      
      const displayName = (editName || user.displayName || 'Anonymous').substring(0, 50);
      const newUsername = editUsername.toLowerCase();
      const oldUsername = userProfile?.username;
      const newIsPrivate = isPrivate;

      // Update username mapping if changed
      if (newUsername && newUsername !== oldUsername) {
        // Create new mapping
        await setDoc(doc(db, 'usernames', newUsername), { uid: user.uid });
        // Delete old mapping if it existed
        if (oldUsername) {
          await deleteDoc(doc(db, 'usernames', oldUsername));
        }
      }
      
      await updateProfile(user, {
        displayName: displayName,
        photoURL: newPhotoURL
      });
      
      // Update user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        name: displayName,
        photoURL: newPhotoURL,
        username: newUsername,
        isPrivate: newIsPrivate,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update public profile for chat
      const publicUserRef = doc(db, 'users_public', user.uid);
      await setDoc(publicUserRef, {
        uid: user.uid,
        name: displayName,
        photoURL: newPhotoURL,
        username: newUsername,
        isPrivate: newIsPrivate
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
        uid: user.uid,
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

  const handleAddAdBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newAdFile || !newAdLink.trim()) return;

    setIsUploadingAd(true);
    setAdUploadProgress(0);
    try {
      const imageUrl = await uploadToImgBB(newAdFile, setAdUploadProgress);
      await addDoc(collection(db, 'ad_banners'), {
        imageUrl,
        linkUrl: newAdLink.trim(),
        active: true,
        createdAt: serverTimestamp()
      });
      setNewAdFile(null);
      setNewAdLink('');
    } catch (error) {
      console.error("Error adding ad banner:", error);
      alert("Failed to add ad banner");
    } finally {
      setIsUploadingAd(false);
      setAdUploadProgress(0);
    }
  };

  const handleUpdateUserBalance = async (userId: string, amount: number) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), { 
        balance: amount,
        uid: userId
      });
      await updateDoc(doc(db, 'users_public', userId), { 
        balance: amount,
        uid: userId
      });
      setIsEditingUserBalance(null);
    } catch (error) {
      console.error('Error updating user balance:', error);
    }
  };

  const handleToggleUserVerification = async (userId: string, currentStatus: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), { 
        isVerified: !currentStatus,
        uid: userId
      });
      await updateDoc(doc(db, 'users_public', userId), { 
        isVerified: !currentStatus,
        uid: userId
      });
    } catch (error) {
      console.error('Error toggling verification:', error);
    }
  };

  const handleSendGlobalNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !adminNotificationTitle.trim() || !adminNotificationBody.trim()) return;

    setIsSendingNotification(true);
    try {
      await addDoc(collection(db, 'global_notifications'), {
        title: adminNotificationTitle,
        body: adminNotificationBody,
        createdAt: serverTimestamp(),
        senderId: user?.uid
      });
      
      setAdminNotificationTitle('');
      setAdminNotificationBody('');
      alert('Global notification sent successfully!');
    } catch (error) {
      console.error('Error sending global notification:', error);
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleDeleteAdBanner = async (id: string) => {
    if (!isAdmin || !confirm("Are you sure you want to delete this ad?")) return;
    try {
      await deleteDoc(doc(db, 'ad_banners', id));
    } catch (error) {
      console.error("Error deleting ad banner:", error);
    }
  };

  const toggleAdStatus = async (id: string, currentStatus: boolean) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'ad_banners', id), { active: !currentStatus });
    } catch (error) {
      console.error("Error toggling ad status:", error);
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

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingStory(true);
    try {
      const imageUrl = await uploadToImgBB(file, () => {});
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await addDoc(collection(db, 'stories'), {
        uid: user.uid,
        name: userProfile?.name || user.displayName || 'Anonymous',
        photoURL: userProfile?.photoURL || user.photoURL || '',
        username: userProfile?.username || '',
        imageUrl,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt)
      });
      
    } catch (error: any) {
      console.error("Story upload error:", error);
      alert(error.message || 'Failed to upload story');
    } finally {
      setIsUploadingStory(false);
      // Reset input
      e.target.value = '';
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
        username: userProfile?.username || '',
        visibility,
        photoURL: user.photoURL || ''
      });
      
      // Increment user balance by 0.10 BDT
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        balance: increment(0.10)
      }, { merge: true });
      
      await setDoc(doc(db, 'users_public', user.uid), {
        uid: user.uid,
        name: name || user.displayName || 'Anonymous',
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

  const handleViewPost = async (post: Post) => {
    setSelectedImage(post);
    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        views: increment(1)
      });
    } catch (error) {
      console.error("Error incrementing views:", error);
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
        username: userProfile?.username || '',
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

  const handleSavePost = async (postId: string) => {
    if (!user || !userProfile) {
      alert("Please sign in to save posts.");
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    try {
      if (userProfile.savedPosts?.includes(postId)) {
        await updateDoc(userRef, { savedPosts: arrayRemove(postId) });
      } else {
        await updateDoc(userRef, { savedPosts: arrayUnion(postId) });
      }
    } catch (error) {
      console.error("Error saving post:", error);
    }
  };

  const handleShareProfile = async (uid: string, name: string, username?: string) => {
    const origin = window.location.origin.replace('ais-dev-', 'ais-pre-');
    const url = username ? `${origin}/${username}` : `${origin}?user=${uid}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name}'s Profile`,
          url: url,
        });
      } catch (error: any) {
        if (error.name !== 'AbortError' && !error.message?.includes('canceled')) {
          console.error("Error sharing profile:", error);
        }
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Profile link copied to clipboard!");
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
      await setDoc(doc(db, 'users_public', user.uid), {
        uid: user.uid,
        name: user.displayName || 'Anonymous',
        balance: increment(-amount)
      }, { merge: true });

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
      if (viewingUserId === user?.uid && profileViewTab === 'saved') {
        return matchesSearch && userProfile?.savedPosts?.includes(post.id);
      }
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
                  disabled={isSigningIn}
                  className="ml-2 flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-full text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSigningIn ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
                  {isSigningIn ? 'Signing In...' : 'Sign In'}
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
            {/* Post Search Bar */}
            <section className="mb-8 max-w-2xl mx-auto">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={20} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input 
                  type="text" 
                  value={postSearchQuery}
                  onChange={(e) => setPostSearchQuery(e.target.value)}
                  placeholder="Search posts, captions, or users..."
                  className="w-full pl-12 pr-4 py-4 bg-[#0f172a]/80 border border-slate-800 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-xl"
                />
                {postSearchQuery && (
                  <button 
                    onClick={() => setPostSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </section>

            {/* Global Announcements */}
            {globalNotifications.length > 0 && (
              <section className="mb-8 max-w-2xl mx-auto space-y-4">
                {globalNotifications.slice(0, 2).map(notification => (
                  <motion.div 
                    key={notification.id}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-2xl relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                      <Megaphone size={48} className="rotate-12" />
                    </div>
                    <div className="flex items-start gap-3 relative z-10">
                      <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                        <Megaphone size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-white text-sm mb-1">{notification.title}</h4>
                        <p className="text-xs text-indigo-100 leading-relaxed">{notification.body}</p>
                        <div className="text-[10px] text-indigo-400 mt-2 font-medium">
                          {notification.createdAt?.toDate().toLocaleString()}
                        </div>
                      </div>
                      {isAdmin && (
                        <button 
                          onClick={async () => {
                            if (confirm('Delete this announcement?')) {
                              await deleteDoc(doc(db, 'global_notifications', notification.id));
                            }
                          }}
                          className="p-1.5 text-indigo-400 hover:text-red-500 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </section>
            )}

            {/* Ad Banner Slideshow */}
            <section className="mb-8 max-w-2xl mx-auto">
              <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden bg-slate-900 shadow-2xl shadow-indigo-500/10 border border-slate-800/50">
                {adBanners.length > 0 ? (
                  <AnimatePresence mode="wait">
                    <motion.a
                      key={adBanners[currentAdIndex].id}
                      href={adBanners[currentAdIndex].linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                      className="absolute inset-0 block"
                    >
                      <img 
                        src={adBanners[currentAdIndex].imageUrl} 
                        alt="Advertisement" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-yellow-500 text-black text-[10px] font-bold rounded uppercase tracking-wider">Sponsored</span>
                        </div>
                      </div>
                    </motion.a>
                  </AnimatePresence>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                    <ImageIcon size={40} className="opacity-20" />
                    <p className="text-sm font-medium opacity-40">Premium Ad Space Available</p>
                  </div>
                )}

                {/* Indicators */}
                {adBanners.length > 1 && (
                  <div className="absolute bottom-4 right-4 flex gap-1.5">
                    {adBanners.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentAdIndex(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${currentAdIndex === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

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
                      onClick={() => navigateToProfile(post.uid, post.username)}
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
                          onClick={() => navigateToProfile(post.uid, post.username)}
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
                  {(user?.uid === post.uid || isAdmin) && (
                    <div className="flex items-center gap-1">
                      {user?.uid === post.uid && (
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
                      )}
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
                    onClick={() => handleViewPost(post)}
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
                      onClick={() => handleViewPost(post)} 
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
                    <div className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-500 font-medium">
                      <Eye size={20} />
                      <span>{post.views || 0} View{post.views !== 1 ? 's' : ''}</span>
                    </div>
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

            {/* Leaderboard Section */}
            <div className="bg-[#0f172a]/80 rounded-2xl shadow-sm border border-slate-800 p-6 mt-8">
              <div className="flex items-center gap-2 mb-6">
                <Trophy className="text-yellow-500" size={24} />
                <h3 className="text-xl font-semibold text-white">Top Earners</h3>
              </div>
              <div className="space-y-4">
                {leaderboard.map((u, index) => (
                  <div key={u.uid} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                        index === 1 ? 'bg-slate-400/20 text-slate-300' :
                        index === 2 ? 'bg-amber-700/20 text-amber-600' :
                        'bg-slate-800 text-slate-500'
                      }`}>
                        #{index + 1}
                      </div>
                      <div className="font-medium text-white flex items-center gap-1">
                        {u.name}
                        {u.balance > 1000 && <Award size={14} className="text-indigo-400" />}
                      </div>
                    </div>
                    <div className="font-bold text-indigo-400">৳ {u.balance.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'calls' && user && (
          <section className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <div className="px-4 pt-8">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-4xl font-black text-white tracking-tight">Calls</h1>
                <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-xl">
                  <Phone size={24} className="text-[#38bdf8]" />
                </div>
              </div>

              {callLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-[#0f172a]/80 rounded-3xl border border-slate-800/50 border-dashed">
                  <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                    <Phone size={40} className="text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No recent calls</h3>
                  <p className="text-slate-500 max-w-xs mx-auto">Your call history will appear here once you start making or receiving calls.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {callLogs.map((log: any) => (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex items-center gap-4 p-4 bg-[#0f172a]/80 hover:bg-slate-800/50 rounded-2xl border border-slate-800/50 transition-all cursor-pointer"
                      onClick={() => {
                        const targetUid = log.callerId === user?.uid ? log.receiverId : log.callerId;
                        const targetName = log.callerId === user?.uid ? log.receiverName : log.callerName;
                        const targetPhoto = log.callerId === user?.uid ? log.receiverPhoto : log.callerPhoto;
                        setSelectedChatUser({ uid: targetUid, name: targetName, photoURL: targetPhoto });
                        setActiveTab('messages');
                      }}
                    >
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700">
                          {log.callerId === user?.uid ? (
                            log.receiverPhoto ? <img src={log.receiverPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-xl text-white font-bold">{log.receiverName?.charAt(0)}</div>
                          ) : (
                            log.callerPhoto ? <img src={log.callerPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-xl text-white font-bold">{log.callerName?.charAt(0)}</div>
                          )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-lg border-2 border-[#020617] ${log.type === 'video' ? 'bg-blue-500' : 'bg-green-500'}`}>
                          {log.type === 'video' ? <Video size={12} className="text-white" /> : <Phone size={12} className="text-white" />}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-lg truncate mb-0.5">
                          {log.callerId === user?.uid ? log.receiverName : log.callerName}
                        </h3>
                        <div className="flex items-center gap-2 text-sm">
                          {log.status === 'missed' ? (
                            <PhoneIncoming size={14} className="text-red-500" />
                          ) : log.callerId === user?.uid ? (
                            <PhoneOutgoing size={14} className="text-[#38bdf8]" />
                          ) : (
                            <PhoneIncoming size={14} className="text-green-400" />
                          )}
                          <span className={`${log.status === 'missed' ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                            {log.status === 'missed' ? 'Missed' : log.status === 'dialed' ? 'Outgoing' : 'Incoming'}
                          </span>
                          <span className="text-slate-700">•</span>
                          <span className="text-slate-500">
                            {log.createdAt?.toDate ? new Date(log.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handleDeleteCallLog(e, log.id)}
                          className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                          title="Delete Log"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetUid = log.callerId === user?.uid ? log.receiverId : log.callerId;
                            const targetName = log.callerId === user?.uid ? log.receiverName : log.callerName;
                            const targetPhoto = log.callerId === user?.uid ? log.receiverPhoto : log.callerPhoto;
                            const targetUser = { uid: targetUid, name: targetName, photoURL: targetPhoto };
                            setSelectedChatUser(targetUser);
                            initiateCall(log.type, targetUser);
                          }}
                          className="p-3 bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8] hover:text-white rounded-xl transition-all"
                        >
                          {log.type === 'video' ? <Video size={20} /> : <Phone size={20} />}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
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
                        setEditUsername(userProfile?.username || '');
                        setIsPrivate(userProfile?.isPrivate || false);
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
                    <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                      {user.displayName}
                    </h2>
                    {userProfile?.username && (
                      <p className="text-indigo-400 font-medium mb-1">@{userProfile.username}</p>
                    )}
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

                    <div className="flex justify-center gap-3 flex-wrap">
                      <button 
                        onClick={logOut}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-slate-800/60 text-slate-300 rounded-full font-medium hover:bg-slate-700/60 transition-colors"
                      >
                        <LogOut size={18} />
                        Sign Out
                      </button>
                      {!userProfile?.isVerified && (
                        <button 
                          onClick={handleRequestVerification}
                          className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full font-medium hover:bg-indigo-500/20 transition-colors"
                        >
                          <ShieldCheck size={18} />
                          Request Verification
                        </button>
                      )}
                      <button 
                        onClick={() => handleShareProfile(user.uid, userProfile?.name || user.displayName || 'Anonymous', userProfile?.username)}
                        className="p-2 bg-slate-800/60 text-slate-300 rounded-full hover:bg-slate-700/60 transition-colors"
                        title="Share Profile"
                      >
                        <Share2 size={18} />
                      </button>
                    </div>

                    <div className="mt-6 p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 text-left max-w-sm mx-auto">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                          <Bell size={14} className={notificationPermission === 'granted' ? 'text-green-400' : 'text-slate-500'} />
                          Notifications
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          notificationPermission === 'granted' ? 'bg-green-500/10 text-green-400' : 
                          notificationPermission === 'denied' ? 'bg-red-500/10 text-red-400' : 
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {notificationPermission.charAt(0).toUpperCase() + notificationPermission.slice(1)}
                        </span>
                      </div>
                      
                      {notificationPermission !== 'granted' && (
                        <button 
                          onClick={async () => {
                            const p = await Notification.requestPermission();
                            setNotificationPermission(p);
                          }}
                          className="w-full py-2 bg-indigo-600/20 text-indigo-400 text-xs rounded-xl hover:bg-indigo-600/30 transition-colors font-medium"
                        >
                          Enable Notifications
                        </button>
                      )}
                      
                      {notificationPermission === 'granted' && (
                        <div className="space-y-2">
                          {userProfile?.fcmToken ? (
                            <button 
                              onClick={handleTestNotification}
                              disabled={isTestingNotification}
                              className="w-full py-2 bg-slate-700/40 text-slate-300 text-xs rounded-xl hover:bg-slate-700/60 transition-colors flex items-center justify-center gap-2 font-medium"
                            >
                              {isTestingNotification ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                              Send Test Notification
                            </button>
                          ) : (
                            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <p className="text-[10px] text-amber-400/90 leading-relaxed">
                                <span className="font-bold">Token not found:</span> Please ensure you have added the <code className="bg-slate-900 px-1 rounded">VITE_VAPID_KEY</code> in settings and refreshed the page.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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

                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1 text-left">Username</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <AtSign size={16} className="text-slate-500" />
                        </div>
                        <input 
                          type="text" 
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className={`w-full pl-10 pr-4 py-2 bg-slate-900 border ${usernameError ? 'border-red-500' : 'border-slate-700'} rounded-lg text-white focus:outline-none focus:border-indigo-500`}
                          placeholder="username"
                        />
                        {isCheckingUsername && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <Loader2 size={16} className="animate-spin text-indigo-500" />
                          </div>
                        )}
                      </div>
                      {usernameError && (
                        <p className="text-xs text-red-500 mt-1 text-left">{usernameError}</p>
                      )}
                      {!usernameError && editUsername && !isCheckingUsername && (
                        <p className="text-xs text-green-500 mt-1 text-left">Username is available!</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-medium text-white">Privacy Mode</span>
                        <span className="text-[10px] text-slate-500">Hide from leaderboard and search</span>
                      </div>
                      <button 
                        onClick={() => setIsPrivate(!isPrivate)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${isPrivate ? 'bg-indigo-600' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isPrivate ? 'right-1' : 'left-1'}`} />
                      </button>
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
                    <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                      {viewingUserProfile.name}
                    </h2>
                    {viewingUserProfile.username && (
                      <p className="text-indigo-400 font-medium mb-4">@{viewingUserProfile.username}</p>
                    )}
                    
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

                    <div className="flex justify-center gap-3 flex-wrap">
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
                      <button 
                        onClick={() => handleBlockUser(viewingUserProfile.uid)}
                        className={`inline-flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-colors ${
                          userProfile?.blockedUsers?.includes(viewingUserProfile.uid) 
                            ? 'bg-red-500 text-white hover:bg-red-600' 
                            : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/60'
                        }`}
                      >
                        <Ban size={18} />
                        {userProfile?.blockedUsers?.includes(viewingUserProfile.uid) ? 'Unblock' : 'Block'}
                      </button>
                      <button 
                        onClick={() => handleShareProfile(viewingUserProfile.uid, viewingUserProfile.name, viewingUserProfile.username)}
                        className="p-2 bg-slate-800/60 text-slate-300 rounded-full hover:bg-slate-700/60 transition-colors"
                        title="Share Profile"
                      >
                        <Share2 size={18} />
                      </button>
                    </div>
                  </>
                )
              )}
            </div>

            {viewingUserId === user.uid && (
              <div className="flex justify-center gap-4 mb-6">
                <button
                  onClick={() => setProfileViewTab('posts')}
                  className={`px-6 py-2 rounded-full font-medium transition-colors ${profileViewTab === 'posts' ? 'bg-indigo-500 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'}`}
                >
                  My Posts
                </button>
                <button
                  onClick={() => setProfileViewTab('saved')}
                  className={`px-6 py-2 rounded-full font-medium transition-colors ${profileViewTab === 'saved' ? 'bg-indigo-500 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'}`}
                >
                  Saved Posts
                </button>
              </div>
            )}

            <h3 className="text-xl font-semibold text-white mb-4">
              {viewingUserId === user.uid ? (
                profileViewTab === 'posts' ? 'Your Posts' : 'Saved Posts'
              ) : (
                `${viewingUserProfile?.name}'s Posts`
              )}
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {posts.filter(p => {
                if (viewingUserId === user.uid && profileViewTab === 'saved') {
                  return userProfile?.savedPosts?.includes(p.id);
                }
                return p.uid === viewingUserId;
              }).map(post => (
                <div key={post.id} className="aspect-square rounded-xl overflow-hidden bg-slate-800/60 cursor-pointer relative" onClick={() => handleViewPost(post)}>
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
                            {conv.status === 'pending' && conv.initiatedBy !== user.uid ? (
                              <span className="text-xs font-bold text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded">Message Request</span>
                            ) : (
                              <>
                                {conv.lastSenderId === user.uid && (
                                  <span className="shrink-0">
                                    {conv.isRead ? <CheckCheck size={14} className="text-emerald-500" /> : <Check size={14} className="text-slate-400" />}
                                  </span>
                                )}
                                <p className={`text-sm truncate ${isUnread ? 'font-bold text-white' : 'text-slate-400'}`}>
                                  {conv.lastSenderId === user.uid ? 'You: ' : ''}{conv.lastMessage}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {isUnread && (
                            <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                          )}
                          <button 
                            onClick={(e) => handleDeleteConversation(e, conv.id)}
                            className="p-1.5 text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Conversation"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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
                  <div className="p-4 bg-[#0f172a]/80 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedChatUser(null)}
                        className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-200"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <div className="relative">
                        {selectedChatUser.photoURL ? (
                          <img src={selectedChatUser.photoURL} alt={selectedChatUser.name} className="w-10 h-10 rounded-full border border-slate-700 object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center font-bold text-lg">
                            {selectedChatUser.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {selectedChatUser.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#020617] rounded-full" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm sm:text-base">{selectedChatUser.name}</h3>
                        <p className="text-[10px] text-slate-500">
                          {selectedChatUser.isOnline ? 'Online' : selectedChatUser.lastSeen ? `Last seen ${selectedChatUser.lastSeen.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Offline'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => initiateCall('voice')}
                        className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
                        title="Voice Call"
                      >
                        <Phone size={20} />
                      </button>
                      <button 
                        onClick={() => initiateCall('video')}
                        className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
                        title="Video Call"
                      >
                        <Video size={20} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.map(msg => {
                      const isMe = msg.senderId === user.uid;
                      return (
                        <div key={msg.id} className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-2 max-w-[85%]">
                            {isMe && (
                              <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                title="Delete Message"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            <div className={`rounded-2xl px-4 py-2 relative ${isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-[#0f172a]/80 border border-slate-800 text-slate-200 rounded-bl-sm'}`}>
                              {msg.type === 'voice' ? (
                                <div className="flex items-center gap-3 py-1">
                                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <Mic size={16} />
                                  </div>
                                  <audio src={msg.fileUrl} controls className="h-8 w-40 filter invert brightness-200" />
                                  <span className="text-[10px] opacity-70">{msg.duration}s</span>
                                </div>
                              ) : msg.type === 'file' ? (
                                <a href={msg.fileUrl} download={msg.fileName} className="flex items-center gap-3 py-1 hover:underline">
                                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <Paperclip size={16} />
                                  </div>
                                  <div className="overflow-hidden">
                                    <div className="text-sm font-medium truncate">{msg.fileName}</div>
                                    <div className="text-[10px] opacity-70">{(msg.fileSize || 0) / 1024 > 1024 ? `${((msg.fileSize || 0) / (1024 * 1024)).toFixed(1)} MB` : `${((msg.fileSize || 0) / 1024).toFixed(1)} KB`}</div>
                                  </div>
                                </a>
                              ) : (
                                msg.text
                              )}

                              {/* Reactions Display */}
                              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                <div className={`absolute -bottom-3 flex gap-1 ${isMe ? 'right-0' : 'left-0'}`}>
                                  {Object.entries(msg.reactions).map(([emoji, uids]) => (
                                    <div key={emoji} className="bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-1 shadow-lg">
                                      <span>{emoji}</span>
                                      <span className="text-slate-400">{(uids as string[]).length}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {!isMe && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setReactionPickerMessageId(msg.id)}
                                  className="p-1 text-slate-600 hover:text-yellow-500 transition-colors"
                                  title="React"
                                >
                                  <Heart size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="p-1 text-slate-600 hover:text-red-500 transition-colors"
                                  title="Delete Message"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}

                            {/* Reaction Picker */}
                            {reactionPickerMessageId === msg.id && (
                              <div className={`absolute z-50 bg-slate-800 border border-slate-700 rounded-full p-1 flex gap-1 shadow-2xl ${isMe ? 'right-full mr-2' : 'left-full ml-2'}`}>
                                {['❤️', '👍', '😂', '😮', '😢', '🔥'].map(emoji => (
                                  <button 
                                    key={emoji}
                                    onClick={() => handleReaction(msg.id, emoji)}
                                    className="hover:bg-slate-700 p-1.5 rounded-full transition-colors text-lg"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                                <button onClick={() => setReactionPickerMessageId(null)} className="p-1 text-slate-500 hover:text-white">
                                  <X size={14} />
                                </button>
                              </div>
                            )}
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

                  {/* Message Request UI */}
                  {conversations.find(c => c.id === [user.uid, selectedChatUser.uid].sort().join('_'))?.status === 'pending' && 
                   conversations.find(c => c.id === [user.uid, selectedChatUser.uid].sort().join('_'))?.initiatedBy !== user.uid ? (
                    <div className="p-8 bg-slate-900/40 border-t border-slate-800 flex flex-col items-center justify-center gap-4 text-center">
                      <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2">
                        <MessageCircle size={32} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-lg font-bold text-white">Message Request</h4>
                        <p className="text-sm text-slate-400 max-w-xs">
                          {selectedChatUser.name} wants to message you. Accept to start chatting or reject to delete.
                        </p>
                      </div>
                      <div className="flex gap-3 w-full max-w-xs">
                        <button 
                          onClick={() => handleAcceptChat([user.uid, selectedChatUser.uid].sort().join('_'))}
                          className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => handleRejectChat([user.uid, selectedChatUser.uid].sort().join('_'))}
                          className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-2xl font-bold hover:bg-slate-700 transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#0f172a]/80 border-t border-slate-800">
                      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <label className="p-2 text-slate-400 hover:text-indigo-400 cursor-pointer transition-colors">
                            <Paperclip size={20} />
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                          </label>
                          <button 
                            type="button"
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onMouseLeave={stopRecording}
                            className={`p-2 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-indigo-400'}`}
                            title="Hold to record voice"
                          >
                            <Mic size={20} />
                          </button>
                        </div>
                        
                        <div className="flex-1 relative">
                          <input 
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={isRecording ? `Recording... ${recordingDuration}s` : "Type a message..."}
                            className="w-full px-4 py-2.5 bg-slate-800/60 border-transparent focus:bg-[#0f172a]/80 border focus:border-indigo-900/300 rounded-full outline-none transition-all"
                            disabled={isRecording}
                          />
                          {isUploadingFile && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 size={16} className="animate-spin text-indigo-400" />
                            </div>
                          )}
                        </div>
                        
                        <button 
                          type="submit"
                          disabled={!newMessage.trim() || isRecording || isUploadingFile}
                          className="p-2.5 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors disabled:opacity-50"
                        >
                          <Reply size={20} className="rotate-180" />
                        </button>
                      </form>
                    </div>
                  )}
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
                  {userSearchQuery.trim() === '' ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center px-4">
                      <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                        <Search size={32} className="text-slate-600" />
                      </div>
                      <h4 className="text-white font-medium mb-1">Search for Users</h4>
                      <p className="text-xs max-w-[200px]">Enter a name to find someone and start a new chat or call.</p>
                    </div>
                  ) : (
                    <>
                      {allUsers.filter(u => {
                        const query = userSearchQuery.toLowerCase();
                        const nameMatch = u.name.toLowerCase().includes(query);
                        const usernameMatch = u.username?.toLowerCase().includes(query);
                        
                        // If user is private, only show if exact username match or very close
                        if (u.isPrivate) {
                          return u.username?.toLowerCase() === query;
                        }
                        
                        return nameMatch || usernameMatch;
                      }).map(u => (
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
                          <div className="flex-1 overflow-hidden">
                            <span className="font-medium text-white block truncate">{u.name}</span>
                            {u.username && <span className="text-[10px] text-slate-500">@{u.username}</span>}
                          </div>
                        </button>
                      ))}
                      {allUsers.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase())).length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                          <p className="text-sm">No users found matching "{userSearchQuery}"</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
        {activeTab === 'admin' && isAdmin && (
          <section className="max-w-4xl mx-auto pb-24 px-2">
            <div className="bg-[#0f172a]/80 rounded-2xl shadow-sm border border-slate-800 p-4 md:p-6 mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <Shield className="text-indigo-400" size={28} />
                  <h2 className="text-xl md:text-2xl font-bold text-white">Admin Dashboard</h2>
                </div>
                <div className="flex gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar max-w-full">
                  <button 
                    onClick={() => setAdminActiveSubTab('verification')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 flex items-center gap-2 ${adminActiveSubTab === 'verification' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                  >
                    <ShieldCheck size={16} />
                    Verification
                    {verificationRequests.length > 0 && (
                      <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{verificationRequests.length}</span>
                    )}
                  </button>
                  <button 
                    onClick={() => setAdminActiveSubTab('withdrawals')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${adminActiveSubTab === 'withdrawals' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                  >
                    Withdrawals
                  </button>
                  <button 
                    onClick={() => setAdminActiveSubTab('users')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${adminActiveSubTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                  >
                    Users
                  </button>
                  <button 
                    onClick={() => setAdminActiveSubTab('posts')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${adminActiveSubTab === 'posts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                  >
                    Posts
                  </button>
                  <button 
                    onClick={() => setAdminActiveSubTab('ads')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${adminActiveSubTab === 'ads' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                  >
                    Ads
                  </button>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Users size={14} />
                    Total Users
                  </div>
                  <div className="text-xl font-bold text-white">{adminStats.totalUsers}</div>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Wallet size={14} />
                    Total Balance
                  </div>
                  <div className="text-xl font-bold text-white">৳ {adminStats.totalBalance.toFixed(2)}</div>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <Download size={14} />
                    Pending W/D
                  </div>
                  <div className="text-xl font-bold text-orange-400">{adminStats.pendingWithdrawals}</div>
                </div>
                <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                    <FileText size={14} />
                    Total Posts
                  </div>
                  <div className="text-xl font-bold text-indigo-400">{adminStats.totalPosts}</div>
                </div>
              </div>
              
              {/* Withdrawals Tab */}
              {adminActiveSubTab === 'withdrawals' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Download size={20} className="text-indigo-400" />
                    Withdrawal Requests
                  </h3>
                  {allWithdrawals.length === 0 ? (
                    <p className="text-slate-500 bg-slate-900/20 p-8 rounded-2xl text-center border border-dashed border-slate-800">No withdrawal requests found.</p>
                  ) : (
                    <div className="space-y-4">
                      {allWithdrawals.map(w => (
                        <div key={w.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/40 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-colors gap-4">
                          <div className="flex-1">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <div className="font-medium text-white capitalize">{w.method} - {w.accountNumber}</div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                w.status === 'pending' ? 'bg-orange-500/20 text-orange-500' :
                                w.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                                'bg-red-500/20 text-red-500'
                              }`}>
                                {w.status}
                              </span>
                            </div>
                            <div className="text-sm text-slate-400 truncate max-w-full">User: {w.userEmail || 'Unknown'}</div>
                            <div className="text-[10px] text-slate-500 mt-1">{w.createdAt?.toDate().toLocaleString()}</div>
                          </div>
                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0">
                            <div className="font-bold text-white text-lg">৳ {w.amount.toFixed(2)}</div>
                            {w.status === 'pending' && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'withdrawals', w.id), { status: 'approved' });
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20"
                                >
                                  Approve
                                </button>
                                <button 
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'withdrawals', w.id), { status: 'rejected' });
                                      if (w.uid) {
                                        await updateDoc(doc(db, 'users', w.uid), { balance: increment(w.amount), uid: w.uid });
                                        await updateDoc(doc(db, 'users_public', w.uid), { balance: increment(w.amount), uid: w.uid });
                                      }
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Verification Tab */}
              {adminActiveSubTab === 'verification' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <ShieldCheck size={20} className="text-indigo-400" />
                    Verification Requests
                  </h3>
                  <div className="space-y-4">
                    {verificationRequests.map(req => (
                      <div key={req.id} className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {req.photoURL ? (
                            <img src={req.photoURL} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 font-bold">
                              {req.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white">{req.name}</div>
                            <div className="text-xs text-slate-500">@{req.username || 'no-username'}</div>
                            <div className="text-[10px] text-slate-600">{req.requestedAt?.toDate().toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleApproveVerification(req)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleRejectVerification(req.id)}
                            className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-700 transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                    {verificationRequests.length === 0 && (
                      <div className="text-center py-12 text-slate-500">
                        No pending verification requests.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Users Tab */}
              {adminActiveSubTab === 'users' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2 shrink-0">
                      <Users size={20} className="text-indigo-400" />
                      User Management
                    </h3>
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text"
                        placeholder="Search users..."
                        value={adminSearchQuery}
                        onChange={(e) => setAdminSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900/20 rounded-2xl border border-slate-800 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-800">
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Balance</th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {adminUsers.filter(u => 
                          u.name.toLowerCase().includes(adminSearchQuery.toLowerCase()) || 
                          u.email?.toLowerCase().includes(adminSearchQuery.toLowerCase())
                        ).map(u => (
                          <tr key={u.uid} className="hover:bg-slate-800/20 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt={u.name} className="w-8 h-8 rounded-full border border-slate-700 object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center font-bold text-xs">
                                    {u.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-medium text-white flex items-center gap-1">
                                    {u.name}
                                    {u.isVerified && <Award size={12} className="text-indigo-400 fill-indigo-400/20" />}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {isEditingUserBalance === u.uid ? (
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number"
                                    value={newUserBalance}
                                    onChange={(e) => setNewUserBalance(Number(e.target.value))}
                                    className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none"
                                  />
                                  <button 
                                    onClick={() => handleUpdateUserBalance(u.uid, newUserBalance)}
                                    className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button 
                                    onClick={() => setIsEditingUserBalance(null)}
                                    className="p-1 bg-slate-700 text-white rounded hover:bg-slate-600"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group">
                                  <span className="text-sm font-bold text-white">৳ {u.balance?.toFixed(2) || '0.00'}</span>
                                  <button 
                                    onClick={() => {
                                      setIsEditingUserBalance(u.uid);
                                      setNewUserBalance(u.balance || 0);
                                    }}
                                    className="p-1 text-slate-500 hover:text-indigo-400 md:opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-500' : 'bg-slate-800 text-slate-500'
                              }`}>
                                {u.role || 'client'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => handleToggleUserVerification(u.uid, u.isVerified || false)}
                                className={`p-2 rounded-lg transition-all ${
                                  u.isVerified ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700'
                                }`}
                                title={u.isVerified ? "Remove Verification" : "Verify User"}
                              >
                                <Award size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Posts Tab */}
              {adminActiveSubTab === 'posts' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FileText size={20} className="text-indigo-400" />
                    Post Moderation
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {allPosts.map(post => (
                      <div key={post.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
                        <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                          <div className="text-xs text-white font-medium mb-1 truncate">@{post.username || 'anonymous'}</div>
                          <div className="text-[10px] text-slate-300 line-clamp-2 mb-3">{post.caption}</div>
                          <button 
                            onClick={async () => {
                              if (confirm('Are you sure you want to delete this post?')) {
                                try {
                                  await deleteDoc(doc(db, 'posts', post.id));
                                } catch (e) {
                                  console.error(e);
                                }
                              }
                            }}
                            className="w-full py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
                          >
                            <Trash2 size={12} />
                            Delete Post
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ads Tab */}
              {adminActiveSubTab === 'ads' && (
                <div className="space-y-8">
                  <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/50">
                    <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                      <ImageIcon size={20} className="text-indigo-400" />
                      Add New Banner Ad
                    </h3>
                    <form onSubmit={handleAddAdBanner} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-400">Banner Image</label>
                          <div className="relative h-40 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 flex flex-col items-center justify-center overflow-hidden group hover:border-indigo-500/50 transition-colors">
                            {newAdFile ? (
                              <>
                                <img src={URL.createObjectURL(newAdFile)} className="w-full h-full object-cover" />
                                <button 
                                  type="button"
                                  onClick={() => setNewAdFile(null)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <Camera size={32} className="text-slate-500 mb-2" />
                                <span className="text-xs text-slate-500">Click to upload banner (16:9 recommended)</span>
                              </>
                            )}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => setNewAdFile(e.target.files?.[0] || null)}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400">Target Link URL</label>
                            <input 
                              type="url"
                              placeholder="https://example.com"
                              value={newAdLink}
                              onChange={(e) => setNewAdLink(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"
                              required
                            />
                          </div>
                          <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <p className="text-xs text-indigo-300 leading-relaxed">
                              Banner ads appear at the top of the home feed. Ensure the image is high quality and the link is valid.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {isUploadingAd && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Uploading banner...</span>
                            <span>{adUploadProgress}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${adUploadProgress}%` }} />
                          </div>
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={isUploadingAd || !newAdFile || !newAdLink.trim()}
                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                      >
                        {isUploadingAd ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
                        Publish Banner Ad
                      </button>
                    </form>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Active Banners</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allAdBanners.map(ad => (
                        <div key={ad.id} className="bg-slate-900/40 rounded-xl border border-slate-800/50 overflow-hidden group">
                          <div className="aspect-video relative">
                            <img src={ad.imageUrl} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <button 
                                onClick={() => toggleAdStatus(ad.id, ad.active)}
                                className={`p-3 rounded-xl backdrop-blur-md transition-all hover:scale-110 ${ad.active ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                                title={ad.active ? "Deactivate" : "Activate"}
                              >
                                <Check size={20} />
                              </button>
                              <button 
                                onClick={() => handleDeleteAdBanner(ad.id)}
                                className="p-3 bg-red-500 text-white rounded-xl backdrop-blur-md hover:bg-red-600 hover:scale-110 transition-all"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </div>
                          <div className="p-4 flex items-center justify-between">
                            <div className="truncate flex-1 mr-4">
                              <div className="text-xs text-white font-medium truncate">{ad.linkUrl}</div>
                              <div className="text-[10px] text-slate-500">{ad.createdAt?.toDate().toLocaleDateString()}</div>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${ad.active ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                              {ad.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Global Notification Section */}
                  <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/50 mt-12">
                    <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                      <Megaphone size={20} className="text-indigo-400" />
                      Send Global Announcement
                    </h3>
                    <form onSubmit={handleSendGlobalNotification} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">Announcement Title</label>
                        <input 
                          type="text"
                          placeholder="Important Update"
                          value={adminNotificationTitle}
                          onChange={(e) => setAdminNotificationTitle(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">Message Content</label>
                        <textarea 
                          placeholder="Enter your message here..."
                          value={adminNotificationBody}
                          onChange={(e) => setAdminNotificationBody(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                          required
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={isSendingNotification || !adminNotificationTitle.trim() || !adminNotificationBody.trim()}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSendingNotification ? <Loader2 size={20} className="animate-spin" /> : <Megaphone size={20} />}
                        Send to All Users
                      </button>
                    </form>
                  </div>
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

          <button 
            onClick={() => {
              if (!user) {
                handleSignIn();
                return;
              }
              setActiveTab('calls');
            }}
            className={`p-2 transition-colors ${activeTab === 'calls' ? 'text-[#38bdf8]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Phone size={24} />
          </button>
          
          {/* Center Add Button removed as requested */}
          
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
              navigateToProfile(user.uid, userProfile?.username);
            }}
            className={`p-2 transition-colors ${activeTab === 'profile' ? 'text-[#38bdf8]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <UserIcon size={24} />
          </button>

          {isAdmin && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={`p-2 transition-colors ${activeTab === 'admin' ? 'text-[#38bdf8]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Shield size={24} />
            </button>
          )}
        </div>
      </nav>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 left-4 right-4 z-50 bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Download size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">অ্যাপটি ইনস্টল করুন</p>
                <p className="text-xs text-indigo-100">সহজ ব্যবহারের জন্য হোম স্ক্রিনে যোগ করুন</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="px-3 py-1.5 text-xs font-medium hover:bg-white/10 rounded-lg transition-colors"
              >
                পরে
              </button>
              <button 
                onClick={handleInstallClick}
                className="px-4 py-1.5 bg-white text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-50 transition-colors"
              >
                ইনস্টল
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Overlays */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 z-[100] bg-[#020617] flex flex-col items-center justify-between overflow-hidden"
          >
            {/* Background Blur Effect */}
            <div className="absolute inset-0 opacity-20 blur-3xl pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
            </div>

            {/* Call Info Header */}
            <div className="relative z-10 text-center mt-24 w-full">
              <div className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-slate-800 p-1 shadow-2xl relative">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-800">
                  {incomingCall.callerPhoto ? (
                    <img src={incomingCall.callerPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-white font-bold">
                      {incomingCall.callerName?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 animate-ping opacity-20" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-md">
                {incomingCall.callerName}
              </h2>
              <p className="text-indigo-300 font-medium tracking-wide uppercase text-sm drop-shadow-md animate-pulse">
                Incoming {incomingCall.type} call...
              </p>
            </div>

            {/* Call Controls */}
            <div className="relative z-10 flex items-center justify-center gap-12 pb-24 w-full">
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={handleDeclineCall} 
                  className="p-5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-xl shadow-red-500/30 hover:scale-110 active:scale-95"
                >
                  <PhoneOff size={32} />
                </button>
                <span className="text-white/70 text-sm font-medium">Decline</span>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={handleAcceptCall} 
                  className="p-5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all shadow-xl shadow-green-500/30 hover:scale-110 active:scale-95 animate-bounce"
                >
                  <Phone size={32} className="animate-pulse" />
                </button>
                <span className="text-white/70 text-sm font-medium">Accept</span>
              </div>
            </div>
          </motion.div>
        )}

        {activeCall && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 z-[100] bg-[#020617] flex flex-col items-center justify-between overflow-hidden"
          >
            {/* Background Blur Effect for Voice Calls */}
            {activeCall.type === 'voice' && (
              <div className="absolute inset-0 opacity-20 blur-3xl pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
              </div>
            )}

            {/* Video Streams Container (Full Screen for Remote) */}
            {activeCall.type === 'video' && (
              <div className="absolute inset-0 z-0 bg-black">
                {remoteStream ? (
                  <video 
                    autoPlay 
                    playsInline 
                    ref={remoteVideoRef}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="text-indigo-500 animate-spin" size={48} />
                  </div>
                )}
                
                {/* Local Video Preview (Picture-in-Picture) */}
                <motion.div 
                  drag
                  dragConstraints={{ left: 16, right: window.innerWidth - 144, top: 16, bottom: window.innerHeight - 200 }}
                  className="absolute top-4 right-4 w-28 md:w-40 aspect-[3/4] bg-slate-800 rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700/50 z-20 cursor-move"
                >
                  {localStream && !isCameraOff ? (
                    <video 
                      autoPlay 
                      playsInline 
                      muted
                      ref={el => { if (el) el.srcObject = localStream; }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <UserIcon className="text-slate-500" size={32} />
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            {/* Hidden Audio for Voice Calls */}
            {activeCall.type === 'voice' && remoteStream && (
              <audio 
                autoPlay 
                playsInline 
                ref={remoteAudioRef}
              />
            )}

            {/* Call Info Header */}
            <div className={`relative z-10 text-center mt-16 ${activeCall.type === 'video' ? 'bg-gradient-to-b from-black/70 to-transparent w-full pt-8 pb-12 absolute top-0 left-0' : ''}`}>
              {activeCall.type === 'voice' && (
                <div className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-slate-800 p-1 shadow-2xl relative">
                  <div className="w-full h-full rounded-full overflow-hidden bg-slate-800">
                    {activeCall.callerId === user?.uid ? (
                      activeCall.receiverPhoto ? (
                        <img src={activeCall.receiverPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl text-white font-bold">
                          {activeCall.receiverName?.charAt(0)}
                        </div>
                      )
                    ) : (
                      activeCall.callerPhoto ? (
                        <img src={activeCall.callerPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl text-white font-bold">
                          {activeCall.callerName?.charAt(0)}
                        </div>
                      )
                    )}
                  </div>
                  {activeCall.status === 'ringing' && (
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500 animate-ping opacity-20" />
                  )}
                </div>
              )}
              <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-md">
                {activeCall.callerId === user?.uid ? activeCall.receiverName : activeCall.callerName}
              </h2>
              <p className="text-indigo-300 font-medium tracking-wide uppercase text-sm drop-shadow-md">
                {activeCall.status === 'accepted' && isConnecting ? 'Connecting...' : (activeCall.status === 'ringing' ? 'Ringing...' : formatDuration(callDuration))}
              </p>
            </div>

            {/* Call Controls */}
            <div className={`relative z-10 flex items-center justify-center gap-6 pb-12 w-full ${activeCall.type === 'video' ? 'bg-gradient-to-t from-black/80 to-transparent pt-12 absolute bottom-0 left-0' : ''}`}>
              <button 
                onClick={toggleMute}
                className={`p-4 rounded-full transition-all border ${isMuted ? 'bg-white text-slate-900 border-white' : 'bg-slate-800/60 text-white border-slate-600 hover:bg-slate-700 backdrop-blur-md'}`}
              >
                {isMuted ? <MicOff size={26} /> : <Mic size={26} />}
              </button>

              <button 
                onClick={toggleLoudspeaker}
                className={`p-4 rounded-full transition-all border ${isLoudspeaker ? 'bg-white text-slate-900 border-white' : 'bg-slate-800/60 text-white border-slate-600 hover:bg-slate-700 backdrop-blur-md'}`}
              >
                {isLoudspeaker ? <Volume2 size={26} /> : <VolumeX size={26} />}
              </button>
              
              {activeCall.type === 'video' && (
                <>
                  <button 
                    onClick={toggleCamera}
                    className={`p-4 rounded-full transition-all border ${isCameraOff ? 'bg-white text-slate-900 border-white' : 'bg-slate-800/60 text-white border-slate-600 hover:bg-slate-700 backdrop-blur-md'}`}
                  >
                    {isCameraOff ? <VideoOff size={26} /> : <Video size={26} />}
                  </button>
                  <button 
                    onClick={switchCamera}
                    className="p-4 rounded-full transition-all border bg-slate-800/60 text-white border-slate-600 hover:bg-slate-700 backdrop-blur-md"
                  >
                    <SwitchCamera size={26} />
                  </button>
                </>
              )}

              <button 
                onClick={handleEndCall}
                className="p-5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-xl shadow-red-500/30 hover:scale-110 active:scale-95 ml-2"
              >
                <PhoneOff size={30} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                        navigateToProfile(currentPost.uid, currentPost.username);
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
                          navigateToProfile(currentPost.uid, currentPost.username);
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
                              navigateToProfile(comment.uid, comment.username);
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
                                navigateToProfile(comment.uid, comment.username);
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
                                navigateToProfile(reply.uid, reply.username);
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
                                  navigateToProfile(reply.uid, reply.username);
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

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/:username" element={<MainApp />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
