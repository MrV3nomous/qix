import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Logo from '../components/Logo';
import { importKey, encryptMessage, decryptMessage } from '../utils/crypto';
import { getVault, saveVault, destroyVault } from '../utils/vaultManager';
import { CHAT_THEMES } from '../pages/Home';

export default function Chat() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [copied, setCopied] = useState(false);

    const [viewportConfig, setViewportConfig] = useState({ height: window.innerHeight, top: 0 });

    const [vaultCreatedAt, setVaultCreatedAt] = useState(null);
    const [vaultName, setVaultName] = useState('Secure Vault');
    const [currentTheme, setCurrentTheme] = useState('aurora');
    const [showThemePicker, setShowThemePicker] = useState(false);

    const [isObfuscated, setIsObfuscated] = useState(false);

    const ws = useRef(null);
    const messagesEndRef = useRef(null);
    const cryptoKeyRef = useRef(null);
    const intentionalClose = useRef(false);

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

        setVaultCreatedAt(vault.createdAt);
        setVaultName(vault.room_name || 'Secure Vault');
        setCurrentTheme(vault.room_theme || 'aurora');

        const { auth_token: authToken, e2e_key: rawKey } = vault;
        let isMounted = true;

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
                } else if (response.status === 401) {
                    destroyVault(roomId);
                    navigate('/');
                }
            } catch (error) {
                console.error("Error Fetching History:", error);
            }
        };

        const connectWebSocket = () => {
            if (intentionalClose.current || !isMounted) return;

            if (ws.current) {
                ws.current.close();
            }

            const socket = new WebSocket(`${import.meta.env.VITE_WS_URL}?token=${authToken}`);

            socket.onopen = () => {
                if (isMounted) {
                    setIsConnected(true);
                    fetchHistory();
                }
            };

            socket.onmessage = async (event) => {
                const incomingMsg = JSON.parse(event.data);

                if (incomingMsg.type === 'TERMINATE') {
                    alert("The other user has ended the secure session. All data has been shredded.");
                    destroyVault(roomId);
                    navigate('/');
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
                if (isMounted) {
                    setIsConnected(false);
                    if (!intentionalClose.current) {
                        setTimeout(connectWebSocket, 2000);
                    }
                }
            };

            socket.onerror = () => {
                socket.close();
            };

            ws.current = socket;
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
            if (isMounted) connectWebSocket();
        };

        initializeChat();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !intentionalClose.current) {
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
            if (ws.current) ws.current.close();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [roomId, navigate]);

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
                    title: 'Qix Secure Session',
                    text: 'Join my private, self-destructing chat room:',
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
            style={{
                height: `${viewportConfig.height}px`,
                top: `${viewportConfig.top}px`
            }}
        >
            <style>{`
                .sleek-scroll::-webkit-scrollbar {
                    width: 3px;
                    height: 3px;
                }
                .sleek-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .sleek-scroll::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .sleek-scroll::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                .sleek-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
                }
            `}</style>

            <div className={`absolute inset-0 z-50 bg-[#020617]/80 backdrop-blur-2xl transition-opacity duration-300 pointer-events-none flex flex-col items-center justify-center ${isObfuscated ? 'opacity-100' : 'opacity-0'}`}>
                <Logo className="w-16 h-16 opacity-30 grayscale" />
                <p className="mt-4 text-white/30 text-sm tracking-widest uppercase font-semibold">Vault Secured</p>
            </div>

            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#020617]">
                <div
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out opacity-40 mix-blend-screen"
                    style={{ backgroundImage: `url('${CHAT_THEMES[currentTheme]?.bg}')` }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/80 via-[#020617]/60 to-[#020617]/95"></div>
            </div>

            <div className={`shrink-0 bg-black/30 border-b border-white/5 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center z-20 backdrop-blur-md relative transition-all duration-300 ${isObfuscated ? 'blur-sm' : ''}`}>
                <div className="flex items-center gap-2 sm:gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 sm:px-3 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors flex items-center justify-center shrink-0"
                        title="Back to Dashboard"
                    >
                        <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>

                    <Logo className="w-7 h-7 sm:w-10 sm:h-10 drop-shadow-[0_0_10px_rgba(139,92,246,0.3)] shrink-0 hidden sm:block" />

                    <div className="min-w-0">
                        <h2 className="text-sm sm:text-lg font-semibold tracking-wide text-white leading-tight truncate">{vaultName}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center text-[10px] sm:text-xs">
                                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1.5 sm:mr-2 shadow-sm shrink-0 ${isConnected ? 'bg-emerald-400 shadow-emerald-400/50 animate-pulse' : 'bg-rose-400 shadow-rose-400/50'}`}></span>
                                <span className="text-slate-400 font-light truncate">
                                    {isConnected ? 'E2E Active' : 'Connecting...'}
                                </span>
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

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">

                    <div className="relative">
                        <button
                            onClick={() => setShowThemePicker(!showThemePicker)}
                            className={`transition-all duration-300 p-2 sm:px-3 sm:py-2.5 border rounded-xl shadow-sm flex items-center justify-center ${showThemePicker ? 'bg-white/15 border-white/20 text-white' : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'}`}
                            title="Change Theme"
                        >
                            <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                        </button>

                        {showThemePicker && (
                            <div className="absolute top-14 right-0 bg-[#020617]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 z-50 shadow-2xl flex flex-col gap-1 w-44">
                                <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-1">Room Theme</div>
                                {Object.values(CHAT_THEMES).map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => changeTheme(t.id)}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors w-full text-left ${currentTheme === t.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-slate-300'}`}
                                    >
                                        <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${t.bubbles} shadow-inner`}></div>
                                        <span className="text-xs font-medium">{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={copyToClipboard}
                        className={`transition-all duration-300 p-2 sm:px-3 sm:py-2.5 border rounded-xl shadow-sm flex items-center justify-center ${copied
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
                            }`}
                        title="Copy Invite Link"
                    >
                        {copied ? (
                            <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={leaveRoom}
                        className="group flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-rose-300 hover:text-rose-200 transition-all duration-300 p-2 sm:px-4 sm:py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 rounded-xl shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)] whitespace-nowrap ml-1"
                        title="End Session"
                    >
                        <svg className="w-4 h-4 sm:w-4 sm:h-4 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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

                        return (
                            <div key={idx} className="flex flex-col w-full">
                                {showDivider && (
                                    <div className="flex justify-center my-6 animate-fade-in-up w-full">
                                        <span className="bg-black/40 backdrop-blur-xl border border-white/10 text-slate-300 text-[10px] px-4 py-1.5 rounded-full uppercase tracking-widest font-semibold shadow-xl text-center">
                                            {formatMessageDate(currentMsgDate)}
                                        </span>
                                    </div>
                                )}
                                <div className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                    <div className={`max-w-[85%] sm:max-w-[65%] px-4 py-2.5 sm:px-5 sm:py-3.5 rounded-2xl text-[14px] sm:text-[15px] leading-relaxed shadow-lg relative group flex flex-col ${msg.isMine
                                        ? `bg-gradient-to-br ${CHAT_THEMES[currentTheme]?.bubbles} text-white rounded-br-sm shadow-xl`
                                        : 'bg-black/40 border border-white/10 text-slate-100 rounded-bl-sm backdrop-blur-xl shadow-xl'
                                        }`}>
                                        <span className="break-words">{msg.content}</span>

                                        <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${msg.isMine ? 'text-white/70' : 'text-slate-400'}`}>
                                            <span>
                                                {msg.timestamp
                                                    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {msg.isMine && (
                                                <span className="ml-1 tracking-tighter">
                                                    {msg.isRead ? '✓✓' : '✓'}
                                                </span>
                                            )}
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
                        className={`text-white font-medium px-4 sm:px-8 py-3 sm:py-4 rounded-2xl transition-all duration-300 border border-white/10 disabled:opacity-50 shadow-lg flex justify-center items-center gap-2 shrink-0 bg-gradient-to-br ${CHAT_THEMES[currentTheme]?.bubbles} hover:brightness-110`}
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