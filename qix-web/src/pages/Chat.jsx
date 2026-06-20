import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { importKey, encryptMessage, decryptMessage } from '../utils/crypto';

export default function Chat() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [copied, setCopied] = useState(false);

    const ws = useRef(null);
    const messagesEndRef = useRef(null);
    const cryptoKeyRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
        window.addEventListener('resize', scrollToBottom);
        return () => window.removeEventListener('resize', scrollToBottom);
    }, [messages]);

    useEffect(() => {
        const roomId = sessionStorage.getItem('qix_room_id');
        const rawKey = sessionStorage.getItem('qix_e2e_key');
        const authToken = sessionStorage.getItem('qix_auth_token');

        if (!roomId || !rawKey || !authToken) {
            navigate('/');
            return;
        }

        let isMounted = true;
        let socket = null;

        const initializeChat = async () => {
            try {
                cryptoKeyRef.current = await importKey(rawKey);
            } catch (err) {
                console.error("Failed to load encryption key", err);
                navigate('/');
                return;
            }

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
                    if (isMounted) setMessages(decryptedHistory);
                } else if (response.status === 401) {
                    sessionStorage.clear();
                    navigate('/');
                    return;
                }
            } catch (error) {
                console.error("Error Fetching History:", error);
            }

            if (!isMounted) return;

            socket = new WebSocket(`${import.meta.env.VITE_WS_URL}?token=${authToken}`);

            socket.onopen = () => {
                if (isMounted) setIsConnected(true);
            };

            socket.onmessage = async (event) => {
                const incomingMsg = JSON.parse(event.data);

                if (incomingMsg.type === 'TERMINATE') {
                    alert("The other user has ended the secure session. All data has been shredded.");
                    sessionStorage.clear();
                    navigate('/');
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
                console.log('Disconnected from Qix Router');
                if (isMounted) setIsConnected(false);
            };

            ws.current = socket;
        };

        initializeChat();

        return () => {
            isMounted = false;
            if (socket) socket.close();
        };
    }, [navigate]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !ws.current || !cryptoKeyRef.current) return;

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
        } catch (err) {
            console.error("Encryption failed", err);
            alert("Failed to encrypt message.");
        }
    };

    const leaveRoom = async () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'TERMINATE' }));
        } else {
            try {
                const token = sessionStorage.getItem('qix_auth_token');
                await fetch(`${import.meta.env.VITE_API_URL}/terminate`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (error) {
                console.error("Failed to send terminate signal", error);
            }
        }

        sessionStorage.clear();
        navigate('/');
    };

    const getInviteLink = () => {
        return sessionStorage.getItem('qix_invite_link');
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

    return (
        <div className="fixed inset-0 w-full bg-[#020617] text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-violet-500/30">

            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-violet-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse duration-1000"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-fuchsia-600/10 rounded-full mix-blend-screen filter blur-[120px]"></div>
                <div className="absolute top-[20%] right-[20%] w-[40vw] h-[40vw] bg-blue-600/15 rounded-full mix-blend-screen filter blur-[100px]"></div>
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
            </div>

            <div className="flex-1 w-full flex flex-col bg-white/[0.02] backdrop-blur-3xl overflow-hidden relative z-10">

                <div className="bg-black/20 border-b border-white/5 px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center z-20 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <Logo className="w-7 h-7 sm:w-10 sm:h-10 drop-shadow-[0_0_10px_rgba(139,92,246,0.3)] shrink-0" />
                        <div className="min-w-0">
                            <h2 className="text-sm sm:text-lg font-semibold tracking-wide text-white leading-tight truncate">Secure Vault</h2>
                            <div className="flex items-center text-[10px] sm:text-xs mt-0.5">
                                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mr-1.5 sm:mr-2 shadow-sm shrink-0 ${isConnected ? 'bg-emerald-400 shadow-emerald-400/50 animate-pulse' : 'bg-rose-400 shadow-rose-400/50'}`}></span>
                                <span className="text-slate-400 font-light truncate">
                                    {isConnected ? 'E2E Active' : 'Connecting...'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
                                <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            )}
                        </button>

                        {navigator.share && (
                            <button
                                onClick={shareLink}
                                className="text-slate-300 hover:text-white transition-all duration-300 p-2 sm:px-3 sm:py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl shadow-sm flex items-center justify-center"
                                title="Share Invite Link"
                            >
                                <svg className="w-4 h-4 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                            </button>
                        )}

                        <button
                            onClick={leaveRoom}
                            className="group flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-rose-300 hover:text-rose-200 transition-all duration-300 p-2 sm:px-4 sm:py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 rounded-xl shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)] whitespace-nowrap"
                            title="End Session"
                        >
                            <svg className="w-4 h-4 sm:w-4 sm:h-4 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="hidden sm:inline">End & Shred</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">

                    <div className="w-full max-w-6xl mx-auto flex flex-col space-y-4 sm:space-y-6 min-h-full">
                        {messages.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500/50 font-light space-y-4 my-auto">
                                <Logo className="w-12 h-12 sm:w-16 sm:h-16 opacity-20 grayscale" />
                                <p className="text-sm sm:text-base text-center px-4">This room is secured. Awaiting transmission.</p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                <div className={`max-w-[85%] sm:max-w-[65%] px-4 py-2.5 sm:px-5 sm:py-3.5 rounded-2xl text-[14px] sm:text-[15px] leading-relaxed shadow-sm relative group flex flex-col ${msg.isMine
                                    ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-br-sm shadow-[0_4px_20px_-5px_rgba(124,58,237,0.4)]'
                                    : 'bg-white/10 border border-white/5 text-slate-200 rounded-bl-sm backdrop-blur-md'
                                    }`}>
                                    <span className="break-words">{msg.content}</span>

                                    <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${msg.isMine ? 'text-blue-200' : 'text-slate-400'}`}>
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
                        ))}
                        <div ref={messagesEndRef} className="h-2" />
                    </div>
                </div>

                <form onSubmit={sendMessage} className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6 bg-black/20 border-t border-white/5 backdrop-blur-md z-20 shrink-0">
                    <div className="flex gap-2 sm:gap-3 w-full max-w-6xl mx-auto">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type an ephemeral message..."
                            disabled={!isConnected}
                            className="flex-1 bg-black/40 text-slate-200 placeholder:text-slate-500 text-[16px] px-4 sm:px-6 py-3 sm:py-4 rounded-2xl border border-white/10 focus:outline-none focus:border-violet-500/50 focus:bg-black/60 transition-all duration-300 disabled:opacity-50 shadow-inner"
                        />
                        <button
                            type="submit"
                            disabled={!isConnected || !input.trim()}
                            className="bg-white/10 hover:bg-white/20 text-white font-medium px-4 sm:px-8 py-3 sm:py-4 rounded-2xl transition-all duration-300 border border-white/10 hover:border-white/20 disabled:opacity-50 shadow-sm flex justify-center items-center gap-2 shrink-0"
                        >
                            <span className="hidden sm:inline">Send</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7M21 12H3" />
                            </svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}