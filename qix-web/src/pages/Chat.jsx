import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Logo from '../components/Logo';
import { importKey, encryptMessage, decryptMessage } from '../utils/crypto';
import { getVault, saveVault, destroyVault } from '../utils/vaultManager';
import { CHAT_THEMES } from '../utils/themes';

const MessageStatus = ({ isRead }) => {
    const [stage, setStage] = useState(0);

    useEffect(() => {
        if (isRead) {
            setStage(4);
            return;
        }
        if (stage < 3) {
            const timer = setTimeout(() => setStage(prev => prev + 1), 350);
            return () => clearTimeout(timer);
        }
    }, [stage, isRead]);

    const icons = [
        <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
        <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
        <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></>,
        <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
        <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
    ];

    return (
        <div className="flex items-center overflow-hidden ml-1.5 opacity-90" key={stage}>
            <svg className="w-3.5 h-3.5 animate-fade-in drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                {icons[stage]}
            </svg>
        </div>
    );
};

export default function Chat() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sessionTerminated, setSessionTerminated] = useState(false);

    const [viewportConfig, setViewportConfig] = useState({ height: window.innerHeight, top: 0 });

    const [vaultData, setVaultData] = useState(null);

    const [currentTheme, setCurrentTheme] = useState(() => {
        const vault = getVault(roomId);
        if (vault && vault.room_theme) return vault.room_theme;
        const themeKeys = Object.keys(CHAT_THEMES);
        return themeKeys[Math.floor(Math.random() * themeKeys.length)];
    });

    const [showThemePicker, setShowThemePicker] = useState(false);
    const [activeTag, setActiveTag] = useState('All');
    const [isObfuscated, setIsObfuscated] = useState(false);

    const ws = useRef(null);
    const messagesEndRef = useRef(null);
    const cryptoKeyRef = useRef(null);
    const intentionalClose = useRef(false);

    const allTags = Array.from(new Set(
        Object.values(CHAT_THEMES).flatMap(t => t.tags || [])
    )).sort();

    const filteredThemes = activeTag === 'All'
        ? Object.values(CHAT_THEMES)
        : Object.values(CHAT_THEMES).filter(t => t.tags?.includes(activeTag));

    const generateUserIdentity = (senderId) => {
        if (!senderId) return { name: 'Unknown', color: 'bg-slate-600' };

        const colors = [
            'bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
            'bg-fuchsia-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-violet-500'
        ];

        let hash = 0;
        for (let i = 0; i < senderId.length; i++) {
            hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
        }

        const colorIndex = Math.abs(hash) % colors.length;
        const shortId = senderId.substring(senderId.length - 4).toUpperCase();

        return { name: `Agent ${shortId}`, color: colors[colorIndex], initial: shortId.substring(2) };
    };

    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;

        const origHtmlBg = html.style.backgroundColor;
        const origBodyBg = body.style.backgroundColor;
        const origBodyPos = body.style.position;
        const origBodyOv = body.style.overflow;
        const origBodyW = body.style.width;
        const origBodyH = body.style.height;

        html.style.backgroundColor = '#020617';
        body.style.backgroundColor = '#020617';
        body.style.position = 'fixed';
        body.style.overflow = 'hidden';
        body.style.width = '100%';
        body.style.height = '100%';

        const updateViewport = () => {
            if (window.visualViewport) {
                setViewportConfig({
                    height: window.visualViewport.height,
                    top: window.visualViewport.offsetTop
                });
                window.scrollTo(0, 0);
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateViewport);
            window.visualViewport.addEventListener('scroll', updateViewport);
            updateViewport();
        }

        return () => {
            html.style.backgroundColor = origHtmlBg;
            body.style.backgroundColor = origBodyBg;
            body.style.position = origBodyPos;
            body.style.overflow = origBodyOv;
            body.style.width = origBodyW;
            body.style.height = origBodyH;

            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', updateViewport);
                window.visualViewport.removeEventListener('scroll', updateViewport);
            }
        };
    }, []);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsObfuscated(document.hidden);
        };
        const handleBlur = () => setIsObfuscated(true);
        const handleFocus = () => setIsObfuscated(false);

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleBlur);
        window.addEventListener("focus", handleFocus);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleBlur);
            window.removeEventListener("focus", handleFocus);
        };
    }, []);

    useEffect(() => {
        const vault = getVault(roomId);

        if (!vault) {
            navigate('/');
            return;
        }

        setVaultData(vault);

        if (!vault.room_theme) {
            saveVault(roomId, { room_theme: currentTheme });
        }

        const { auth_token: authToken, e2e_key: rawKey } = vault;
        let isMounted = true;
        let reconnectTimer = null;

        const fetchHistory = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/messages`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                if (response.ok) {
                    const encryptedHistory = await response.json();
                    const decryptedHistory = [];
                    for (const msg of encryptedHistory) {
                        try {
                            const plainText = await decryptMessage(msg.content, msg.iv, cryptoKeyRef.current);
                            decryptedHistory.push({ ...msg, content: plainText, isRead: true });
                        } catch (err) {
                            console.error("Could not decrypt historical message", err);
                        }
                    }

                    if (isMounted) {
                        setMessages(prev => {
                            const historyIds = new Set(decryptedHistory.map(m => m.message_id));
                            const pendingRealtime = prev.filter(m => !historyIds.has(m.message_id));
                            return [...decryptedHistory, ...pendingRealtime];
                        });
                    }
                } else if (response.status === 401 || response.status === 403) {
                    setSessionTerminated(true);
                }
            } catch (error) {
                console.error("Error Fetching History:", error);
            }
        };

        const connectWebSocket = () => {
            if (intentionalClose.current || !isMounted || sessionTerminated) return;

            if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
                return;
            }

            if (reconnectTimer) clearTimeout(reconnectTimer);

            const socket = new WebSocket(`${import.meta.env.VITE_WS_URL}?token=${authToken}`);
            ws.current = socket;

            socket.onopen = () => {
                if (!isMounted) return;
                setIsConnected(true);
                fetchHistory();

                socket.pingInterval = setInterval(() => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: 'PING' }));
                    }
                    fetch(`${import.meta.env.VITE_API_URL}/ping`).catch(() => { });
                }, 20000);
            };

            socket.onmessage = async (event) => {
                const incomingMsg = JSON.parse(event.data);

                if (incomingMsg.type === 'TERMINATE') {
                    setSessionTerminated(true);
                    destroyVault(roomId);
                    return;
                }

                if (incomingMsg.type === 'THEME_UPDATE') {
                    if (isMounted) {
                        setCurrentTheme(incomingMsg.theme);
                        saveVault(roomId, { room_theme: incomingMsg.theme });
                    }
                    return;
                }

                if (incomingMsg.type === 'ACK') {
                    setMessages((prev) =>
                        prev.map(m => m.message_id === incomingMsg.message_id ? { ...m, isRead: true } : m)
                    );
                    return;
                }

                if (incomingMsg.type === 'MESSAGE') {
                    try {
                        const plainText = await decryptMessage(incomingMsg.content, incomingMsg.iv, cryptoKeyRef.current);
                        setMessages((prev) => {
                            if (prev.some(m => m.message_id === incomingMsg.message_id)) return prev;
                            return [...prev, { ...incomingMsg, content: plainText, isMine: false }];
                        });

                        socket.send(JSON.stringify({
                            type: 'ACK',
                            message_id: incomingMsg.message_id
                        }));
                    } catch (err) {
                        console.error("Failed to decrypt incoming message", err);
                    }
                }
            };

            socket.onclose = () => {
                if (ws.current === socket) {
                    clearInterval(socket.pingInterval);
                }
                if (isMounted && !intentionalClose.current && !sessionTerminated) {
                    setIsConnected(false);
                    reconnectTimer = setTimeout(connectWebSocket, 3000);
                }
            };

            socket.onerror = () => {
                socket.close();
            };
        };

        const initializeChat = async () => {
            try {
                cryptoKeyRef.current = await importKey(rawKey);
            } catch (err) {
                console.error("Failed to load encryption key", err);
                navigate('/');
                return;
            }
            await fetchHistory();
            if (isMounted && !sessionTerminated) connectWebSocket();
        };

        initializeChat();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !intentionalClose.current && !sessionTerminated) {
                if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
                    connectWebSocket();
                } else {
                    fetchHistory();
                }
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            isMounted = false;
            intentionalClose.current = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (ws.current) {
                clearInterval(ws.current.pingInterval);
                ws.current.onclose = null;
                ws.current.close();
            }
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [roomId, navigate, sessionTerminated]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !ws.current || !cryptoKeyRef.current) return;

        if (ws.current.readyState !== WebSocket.OPEN) {
            alert("Reconnecting to the secure router. Please wait a moment.");
            return;
        }

        try {
            const { ciphertext, iv } = await encryptMessage(input, cryptoKeyRef.current);

            const newMsg = {
                type: 'MESSAGE',
                content: ciphertext,
                iv: iv,
                message_id: 'msg_' + Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString()
            };

            ws.current.send(JSON.stringify(newMsg));
            setMessages((prev) => [...prev, { ...newMsg, content: input, isMine: true, isRead: false }]);
            setInput('');

            setTimeout(scrollToBottom, 50);
        } catch (err) {
            console.error("Encryption failed", err);
            alert("Failed to encrypt message.");
        }
    };

    const changeTheme = async (themeId) => {
        setCurrentTheme(themeId);
        setShowThemePicker(false);
        saveVault(roomId, { room_theme: themeId });

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'THEME_UPDATE', theme: themeId }));
        }

        try {
            const vault = getVault(roomId);
            await fetch(`${import.meta.env.VITE_API_URL}/theme`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${vault.auth_token}`
                },
                body: JSON.stringify({ theme: themeId })
            });
        } catch (e) {
            console.error("Failed to persist theme to backend", e);
        }
    };

    const leaveRoom = async () => {
        intentionalClose.current = true;
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'TERMINATE' }));
        } else {
            const vault = getVault(roomId);
            if (vault) {
                try {
                    await fetch(`${import.meta.env.VITE_API_URL}/terminate`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${vault.auth_token}` }
                    });
                } catch (error) {
                    console.error("Failed to send terminate signal", error);
                }
            }
        }

        destroyVault(roomId);
        navigate('/');
    };

    const getInviteLink = () => {
        const vault = getVault(roomId);
        return vault ? vault.invite_link : '';
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(getInviteLink());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareLink = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Qix - Let's talk something private.",
                    text: 'Join my private, self-destructing secure vault. No signup. No digital trail.',
                    url: getInviteLink(),
                });
            } catch (err) {
                console.error('Share failed or was cancelled:', err);
            }
        }
    };

    const formatMessageDate = (validDate) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (validDate.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (validDate.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return validDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        }
    };

    const formatHeaderDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div
            className="fixed left-0 w-full flex flex-col bg-[#020617] text-slate-200 font-sans overflow-hidden overscroll-none selection:bg-violet-500/30 select-none"
            style={{ height: `${viewportConfig.height}px`, top: `${viewportConfig.top}px` }}
        >
            <style>{`
                .sleek-scroll::-webkit-scrollbar { width: 3px; height: 3px; }
                .sleek-scroll::-webkit-scrollbar-track { background: transparent; }
                .sleek-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
                .sleek-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
                .sleek-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.1) transparent; }
            `}</style>

            <div className={`absolute inset-0 z-50 bg-[#020617]/80 backdrop-blur-2xl transition-opacity duration-300 pointer-events-none flex flex-col items-center justify-center ${isObfuscated && !sessionTerminated ? 'opacity-100' : 'opacity-0'}`}>
                <Logo className="w-16 h-16 opacity-30 grayscale" />
                <p className="mt-4 text-white/30 text-sm tracking-widest uppercase font-semibold">Vault Secured</p>
            </div>

            {sessionTerminated && (
                <div className="absolute inset-0 z-[100] bg-[#020617]/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 animate-fade-in">
                    <div className="w-16 h-16 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-400 border border-rose-500/20 shadow-[0_0_30px_-5px_rgba(244,63,94,0.3)] mb-6">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Vault Terminated</h2>
                    <p className="text-slate-400 text-center max-w-sm mb-8 font-light leading-relaxed">
                        This secure session has been permanently closed and shredded. The encrypted tunnel no longer exists.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-8 py-3.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-white font-medium transition-all shadow-lg"
                    >
                        Return to Dashboard
                    </button>
                </div>
            )}

            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#020617]">
                <div
                    className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out opacity-80 mix-blend-screen"
                    style={{ backgroundImage: `url('${CHAT_THEMES[currentTheme]?.bg}')` }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/40 via-[#020617]/60 to-[#020617]/90"></div>
            </div>

            {showThemePicker && (
                <div className="absolute inset-0 z-[100] flex flex-col bg-[#020617]/80 backdrop-blur-3xl animate-fade-in">
                    <div className="shrink-0 px-5 py-4 flex items-center justify-between border-b border-white/10 bg-black/20">
                        <h2 className="text-xl font-bold text-white tracking-wide">Select Theme</h2>
                        <button onClick={() => setShowThemePicker(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-300 transition-colors" title="Close">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="shrink-0 border-b border-white/5 bg-black/20">
                        <div className="flex overflow-x-auto px-4 py-3 gap-2 sleek-scroll">
                            {['All', ...allTags].map(tag => (
                                <button key={tag} onClick={() => setActiveTag(tag)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 shadow-sm border ${activeTag === tag ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'}`}>
                                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-6 sleek-scroll">
                        <div className="w-full max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
                            {filteredThemes.map(t => (
                                <div key={t.id} onClick={() => changeTheme(t.id)} className={`relative w-full aspect-[9/16] sm:aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group shadow-xl transition-all duration-300 ${currentTheme === t.id ? 'ring-2 ring-emerald-400 scale-[0.98]' : 'ring-1 ring-white/10 hover:ring-white/30 hover:scale-[1.02]'}`}>
                                    <img src={t.bg} alt={t.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                    {currentTheme === t.id && (
                                        <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg backdrop-blur-md">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 w-full p-3 flex flex-col gap-1.5">
                                        <span className="text-white text-sm font-semibold truncate drop-shadow-md">{t.name}</span>
                                        <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${t.bubbles} shadow-inner opacity-90`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className={`shrink-0 bg-black/30 border-b border-white/5 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center z-20 backdrop-blur-md relative transition-all duration-300 ${isObfuscated ? 'blur-sm' : ''}`}>
                <div className="flex items-center gap-2 sm:gap-4">
                    <button onClick={() => navigate('/')} className="p-2 sm:px-3 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors flex items-center justify-center shrink-0" title="Back to Dashboard">
                        <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <Logo className="w-7 h-7 sm:w-10 sm:h-10 drop-shadow-[0_0_10px_rgba(139,92,246,0.3)] shrink-0 hidden sm:block" />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-lg font-semibold tracking-wide text-white leading-tight truncate">{vaultName}</h2>
                            {vaultData?.room_type === 'group' && (
                                <span className="bg-violet-500/20 text-violet-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-violet-500/30">GROUP</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center text-[10px] sm:text-xs">
                                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1.5 sm:mr-2 shadow-sm shrink-0 ${isConnected ? 'bg-emerald-400 shadow-emerald-400/50 animate-pulse' : 'bg-rose-400 shadow-rose-400/50'}`}></span>
                                <span className="text-slate-400 font-light truncate">{isConnected ? 'E2E Active' : 'Reconnecting...'}</span>
                            </div>
                            {vaultCreatedAt && (
                                <>
                                    <span className="text-white/20 text-[10px]">•</span>
                                    <span className="text-[10px] sm:text-xs text-slate-400 font-sans tracking-wide truncate">{formatHeaderDate(vaultCreatedAt)}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button onClick={() => setShowThemePicker(true)} className="transition-all duration-300 p-2 sm:px-3 sm:py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl shadow-sm text-slate-300 hover:text-white flex items-center justify-center" title="Change Theme">
                        <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                    </button>
                    <button onClick={copyToClipboard} className={`transition-all duration-300 p-2 sm:px-3 sm:py-2.5 border rounded-xl shadow-sm flex items-center justify-center ${copied ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'}`} title="Copy Invite Link">
                        {copied ? (
                            <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        )}
                    </button>
                    {navigator.share && (
                        <button onClick={shareLink} className="text-slate-300 hover:text-white transition-all duration-300 p-2 sm:px-3 sm:py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl shadow-sm flex items-center justify-center" title="Share Invite Link">
                            <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        </button>
                    )}
                    <button onClick={leaveRoom} className="group flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-rose-300 hover:text-rose-200 transition-all duration-300 p-2 sm:px-4 sm:py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 rounded-xl shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)] whitespace-nowrap ml-1" title="End Session">
                        <svg className="w-4 h-4 sm:w-4 sm:h-4 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        <span className="hidden sm:inline">End & Shred</span>
                    </button>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto scroll-smooth relative z-10 p-4 sm:p-6 sleek-scroll transition-all duration-300 ${isObfuscated ? 'blur-sm opacity-50' : ''}`}>
                <div className="w-full max-w-6xl mx-auto flex flex-col space-y-4 sm:space-y-6 min-h-full">
                    {messages.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500/50 font-light space-y-4 my-auto py-10">
                            <Logo className="w-12 h-12 sm:w-16 sm:h-16 opacity-20 grayscale" />
                            <p className="text-sm sm:text-base text-center px-4 drop-shadow-md">This room is secured. Awaiting transmission.</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        const currentMsgDate = msg.timestamp ? new Date(msg.timestamp) : new Date();
                        const currentDateStr = currentMsgDate.toDateString();
                        const prevMsgDate = idx > 0 ? (messages[idx - 1].timestamp ? new Date(messages[idx - 1].timestamp) : new Date()) : null;
                        const prevDateStr = prevMsgDate ? prevMsgDate.toDateString() : null;
                        const showDivider = currentDateStr !== prevDateStr;

                        const isSameSenderAsPrev = idx > 0 && messages[idx - 1].sender_id === msg.sender_id && !showDivider;
                        const identity = !msg.isMine ? generateUserIdentity(msg.sender_id) : null;

                        return (
                            <div key={idx} className="flex flex-col w-full">
                                {showDivider && (
                                    <div className="flex justify-center my-6 animate-fade-in-up w-full">
                                        <span className="bg-black/40 backdrop-blur-xl border border-white/10 text-slate-300 text-[10px] px-4 py-1.5 rounded-full uppercase tracking-widest font-semibold shadow-xl text-center">
                                            {formatMessageDate(currentMsgDate)}
                                        </span>
                                    </div>
                                )}

                                <div className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'} animate-fade-in-up ${isSameSenderAsPrev ? 'mt-1' : 'mt-4'}`}>

                                    {!msg.isMine && vaultData?.room_type === 'group' && (
                                        <div className="flex items-end mr-2 shrink-0 pb-1 w-6">
                                            {!isSameSenderAsPrev && (
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-md border border-white/20 ${identity.color}`}>
                                                    {identity.initial}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className={`max-w-[85%] sm:max-w-[65%] px-4 py-2.5 sm:px-5 sm:py-3.5 text-[14px] sm:text-[15px] leading-relaxed relative group flex flex-col ${msg.isMine
                                        ? `bg-gradient-to-br ${CHAT_THEMES[currentTheme]?.bubbles || 'from-blue-600 to-violet-600'} text-white shadow-[0_8px_30px_-4px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-4px_6px_rgba(0,0,0,0.2)] border border-white/20 backdrop-blur-xl rounded-2xl rounded-br-sm`
                                        : 'bg-[#ffffff0f] text-slate-100 backdrop-blur-3xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.1),inset_0_-4px_6px_rgba(0,0,0,0.2)] border border-white/10 rounded-2xl rounded-bl-sm'
                                        }`}>

                                        {!msg.isMine && vaultData?.room_type === 'group' && !isSameSenderAsPrev && (
                                            <span className="text-[10px] font-bold tracking-wide mb-1 opacity-70">
                                                {identity.name}
                                            </span>
                                        )}

                                        <span className="break-words">{msg.content}</span>

                                        <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${msg.isMine ? 'text-white/80' : 'text-slate-400'}`}>
                                            <span className="drop-shadow-md">
                                                {msg.timestamp
                                                    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {msg.isMine && <MessageStatus isRead={msg.isRead} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} className="h-2" />
                </div>
            </div>

            <form onSubmit={sendMessage} className={`shrink-0 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 bg-black/30 border-t border-white/5 backdrop-blur-xl relative z-20 transition-all duration-300 ${isObfuscated ? 'blur-sm opacity-50' : ''}`}>
                <div className="flex gap-2 sm:gap-3 w-full max-w-6xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onFocus={() => setTimeout(scrollToBottom, 150)}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type an ephemeral message..."
                        disabled={!isConnected}
                        className="flex-1 bg-black/50 text-slate-100 placeholder:text-slate-500 text-[16px] px-4 sm:px-6 py-3 sm:py-4 rounded-2xl border border-white/10 focus:outline-none focus:border-white/20 focus:bg-black/70 transition-all duration-300 disabled:opacity-50 shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!isConnected || !input.trim()}
                        className={`text-white font-medium px-4 sm:px-8 py-3 sm:py-4 rounded-2xl transition-all duration-300 border border-white/10 disabled:opacity-50 shadow-lg flex justify-center items-center gap-2 shrink-0 bg-gradient-to-br ${CHAT_THEMES[currentTheme]?.bubbles || 'from-blue-600 to-violet-600'} hover:brightness-110`}
                    >
                        <span className="hidden sm:inline">Send</span>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7M21 12H3" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
}