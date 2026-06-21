import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { generateKey, exportKey } from '../utils/crypto';
import { getAllVaults, saveVault, destroyAllVaults, destroyVault } from '../utils/vaultManager';

export default function Home() {
    const [isLoading, setIsLoading] = useState(false);
    const [inviteData, setInviteData] = useState(null);
    const [copied, setCopied] = useState(false);
    const [vaults, setVaults] = useState({});
    const navigate = useNavigate();

    useEffect(() => {
        setVaults(getAllVaults());
    }, []);

    const createRoom = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/room`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to create room');
            const data = await response.json();

            const cryptoKey = await generateKey();
            const exportedKey = await exportKey(cryptoKey);

            const fullInviteLink = `${data.invite_link}#key=${exportedKey}`;

            saveVault(data.room_id, {
                invite_link: fullInviteLink,
                e2e_key: exportedKey,
                session_id: data.session_id,
                auth_token: data.auth_token,
                role: 'creator'
            });

            setInviteData({ ...data, invite_link: fullInviteLink });
        } catch (error) {
            console.error(error);
            alert('Oops! We couldn’t connect to the server. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(inviteData.invite_link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareLink = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Qix Secure Session',
                    text: 'Join my private, self-destructing chat room:',
                    url: inviteData.invite_link,
                });
            } catch (err) {
                console.error('Share failed or was cancelled:', err);
            }
        }
    };

    const activeVaultKeys = Object.keys(vaults);

    return (
        <div className="min-h-screen w-full bg-[#020617] text-slate-200 font-sans relative selection:bg-violet-500/30">
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-violet-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse duration-1000"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-fuchsia-600/10 rounded-full mix-blend-screen filter blur-[120px]"></div>
                <div className="absolute top-[20%] right-[20%] w-[40vw] h-[40vw] bg-blue-600/15 rounded-full mix-blend-screen filter blur-[100px]"></div>
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
            </div>

            <div className="relative z-10 w-full flex flex-col items-center">
                <div className="min-h-[90vh] flex flex-col justify-center items-center w-full max-w-5xl mx-auto px-6 py-20 text-center">
                    <div className="mb-10 sm:mb-14 flex flex-col items-center">
                        <div className="flex items-center gap-4 mb-8">
                            <Logo className="w-12 h-12 drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
                            <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-violet-200 to-fuchsia-200 tracking-wide">
                                Qix.
                            </span>
                        </div>
                        <div className="inline-flex items-center justify-center p-0.5 mb-8 rounded-full bg-gradient-to-b from-white/20 to-white/0 shadow-2xl">
                            <div className="px-6 py-2 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 text-sm font-medium text-slate-300 shadow-inner">
                                Total Privacy. Zero Friction.
                            </div>
                        </div>
                        <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 tracking-tight leading-[1.1] drop-shadow-sm">
                            Speak freely. <br className="hidden sm:block" /> Leave no digital trail.
                        </h1>
                        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-light mb-12">
                            Discuss sensitive deals, share confidential information, or talk privately. Send a secure link, and with one click, the entire conversation is permanently erased from existence.
                        </p>
                    </div>

                    <div className="w-full max-w-xl bg-white/[0.02] backdrop-blur-3xl border border-white/10 p-8 sm:p-12 rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] transition-all duration-500 relative group">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 rounded-[2.5rem] transition-opacity duration-500 pointer-events-none"></div>

                        {activeVaultKeys.length > 0 && !inviteData ? (
                            <div className="flex flex-col items-center space-y-4 relative z-10 animate-fade-in-up w-full">
                                <div className="bg-emerald-500/10 text-emerald-300 p-4 w-full rounded-2xl border border-emerald-500/20 mb-2">
                                    <h3 className="font-semibold mb-1">Active Vaults Detected</h3>
                                    <p className="text-sm font-light">You have {activeVaultKeys.length} secure session(s) open.</p>
                                </div>

                                <div className="w-full space-y-3 max-h-[40vh] overflow-y-auto scrollbar-hide pb-2">
                                    {activeVaultKeys.map(id => (
                                        <div key={id} className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center justify-between">
                                            <span className="text-xs font-mono text-slate-300 truncate w-32">{id}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => navigate(`/chat/${id}`)} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-xl hover:bg-emerald-500/30 transition-colors shadow-sm">Enter</button>
                                                <button onClick={() => { destroyVault(id); setVaults(getAllVaults()); }} className="px-4 py-2 bg-rose-500/10 text-rose-400 text-xs font-medium rounded-xl hover:bg-rose-500/20 transition-colors shadow-sm">Shred</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={createRoom}
                                    disabled={isLoading}
                                    className="w-full py-4 mt-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
                                >
                                    {isLoading ? 'Creating...' : '+ Create Another Vault'}
                                </button>
                                <button
                                    onClick={() => { destroyAllVaults(); setVaults({}); }}
                                    className="w-full py-3 px-8 bg-transparent text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 rounded-2xl text-sm font-medium transition-all duration-300"
                                >
                                    Shred All Sessions
                                </button>
                            </div>
                        ) : !inviteData ? (
                            <div className="flex flex-col items-center space-y-6 relative z-10">
                                <button
                                    onClick={createRoom}
                                    disabled={isLoading}
                                    className="w-full py-5 px-8 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium rounded-2xl text-lg shadow-[0_0_40px_-10px_rgba(124,58,237,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isLoading ? 'Creating secure connection...' : 'Start a Secure Conversation'}
                                </button>
                                <p className="text-sm text-slate-400/80 font-light">No signup. No app to download. 100% anonymous.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fade-in-up relative z-10">
                                <div className="bg-violet-500/10 text-violet-300 p-5 rounded-2xl border border-violet-500/20 flex items-start gap-4">
                                    <div className="text-2xl mt-0.5">✨</div>
                                    <div className="text-left">
                                        <h3 className="font-semibold text-white mb-1">Your secure link is ready</h3>
                                        <p className="text-sm font-light leading-relaxed">Send this to your recipient. The conversation is fully encrypted.</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteData.invite_link}
                                        className="w-full bg-slate-950/50 text-slate-300 text-sm px-6 py-4 rounded-2xl border border-slate-800 focus:outline-none focus:border-violet-500/50 shadow-inner"
                                    />
                                    <div className="flex gap-3">
                                        <button
                                            onClick={copyToClipboard}
                                            className={`flex-1 py-3.5 rounded-2xl font-medium transition-all duration-300 shadow-sm flex justify-center items-center gap-2 ${copied
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]'
                                                : 'bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            {copied ? 'Copied!' : 'Copy Link'}
                                        </button>
                                        {navigator.share && (
                                            <button
                                                onClick={shareLink}
                                                className="flex-1 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-2xl font-medium transition-all shadow-sm flex justify-center items-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                                Share Via...
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => navigate(`/chat/${inviteData.room_id}`)}
                                    className="w-full text-slate-400 hover:text-white pt-4 text-sm font-medium transition-colors group/btn flex justify-center items-center gap-2"
                                >
                                    Enter the Chat Room
                                    <span className="transform group-hover/btn:translate-x-1 transition-transform">→</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full bg-black/40 border-t border-white/5 py-24 px-6 relative z-10 backdrop-blur-lg">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Privacy shouldn't be complicated.</h2>
                            <p className="text-slate-400 max-w-2xl mx-auto font-light">We removed the friction so you can focus on the conversation. Stop worrying about data leaks, hacked servers, or leaving a permanent record.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl hover:bg-white/[0.04] transition-colors flex flex-col">
                                <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-400 mb-6 border border-rose-500/20 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </div>
                                <h3 className="text-white font-semibold text-xl mb-3">Absolute Peace of Mind</h3>
                                <p className="text-slate-400 text-sm font-light leading-relaxed mb-4">
                                    When the conversation is over, it's over. Click "End Chat" and your messages are instantly and permanently wiped from existence. No backups, no recovery.
                                </p>
                                <div className="mt-auto pt-4 border-t border-white/5 text-xs text-slate-500">
                                    + Failsafe automatic wipe after 48h of inactivity.
                                </div>
                            </div>

                            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl hover:bg-white/[0.04] transition-colors flex flex-col">
                                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 mb-6 border border-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </div>
                                <h3 className="text-white font-semibold text-xl mb-3">Protect Sensitive Information</h3>
                                <p className="text-slate-400 text-sm font-light leading-relaxed mb-4">
                                    Discuss intellectual property, financial details, or personal matters safely. Your words are mathematically locked before they ever leave your device.
                                </p>
                                <div className="mt-auto pt-4 border-t border-white/5 text-xs text-slate-500">
                                    End-to-End Encrypted via AES-256-GCM.
                                </div>
                            </div>

                            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl hover:bg-white/[0.04] transition-colors flex flex-col">
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mb-6 border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <h3 className="text-white font-semibold text-xl mb-3">No Software to Install</h3>
                                <p className="text-slate-400 text-sm font-light leading-relaxed mb-4">
                                    Don't force clients or partners to create an account or download another app. Just generate a link and they can join instantly from any browser.
                                </p>
                                <div className="mt-auto pt-4 border-t border-white/5 text-xs text-slate-500">
                                    100% Web-based and Anonymous.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="w-full border-t border-white/5 py-8 text-center bg-black/60 backdrop-blur-lg relative z-10">
                    <p className="text-slate-500 text-sm font-light">Qix. Designed for conversations that belong only to you.</p>
                </footer>
            </div>
        </div>
    );
}