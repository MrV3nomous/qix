import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Logo from '../components/Logo';

export default function Join() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('Establishing secure connection...');
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const inviteToken = searchParams.get('token');

        const hashMatch = window.location.hash.match(/#key=(.+)/);

        if (!inviteToken || !hashMatch) {
            setStatus('Invalid link. Missing decryption keys.');
            setHasError(true);
            return;
        }

        const encryptionKey = hashMatch[1];

        const joinRoom = async () => {
            try {
                localStorage.clear();

                const response = await fetch(`${import.meta.env.VITE_API_URL}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invite_token: inviteToken })
                });

                if (response.status === 403) {
                    throw new Error('This secure link has already been used by someone else.');
                } else if (!response.ok) {
                    throw new Error('Invite expired or invalid');
                }

                const data = await response.json();

                const fullInviteLink = `${window.location.origin}/join?token=${inviteToken}#key=${encryptionKey}`;

                localStorage.setItem('qix_room_id', data.room_id);
                localStorage.setItem('qix_invite_link', fullInviteLink);
                localStorage.setItem('qix_e2e_key', encryptionKey);
                localStorage.setItem('qix_session_id', data.session_id);
                localStorage.setItem('qix_auth_token', data.auth_token);

                navigate('/chat');
            } catch (error) {
                console.error(error);
                setStatus(error.message || 'This room has been destroyed or the link has expired.');
                setHasError(true);
            }
        };

        const timer = setTimeout(() => {
            joinRoom();
        }, 800);

        return () => clearTimeout(timer);
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen w-full bg-[#020617] text-slate-200 font-sans relative flex flex-col justify-center items-center p-6 selection:bg-violet-500/30">

            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-violet-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse duration-1000"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-fuchsia-600/10 rounded-full mix-blend-screen filter blur-[120px]"></div>
                <div className="absolute top-[20%] right-[20%] w-[40vw] h-[40vw] bg-blue-600/15 rounded-full mix-blend-screen filter blur-[100px]"></div>
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
            </div>

            <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center animate-fade-in-up">
                <div className="w-full bg-white/[0.02] backdrop-blur-3xl border border-white/10 p-10 rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden">

                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col items-center">
                        <Logo className="w-16 h-16 mb-8 drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />

                        {!hasError ? (
                            <div className="flex flex-col items-center space-y-6">
                                <h2 className="text-2xl font-semibold text-white tracking-tight">Decrypting Vault</h2>

                                <div className="relative flex justify-center items-center w-12 h-12">
                                    <div className="absolute w-full h-full border-4 border-white/5 rounded-full"></div>
                                    <div className="absolute w-full h-full border-4 border-violet-500 rounded-full border-t-transparent animate-spin"></div>
                                </div>

                                <p className="text-slate-400 font-light text-sm">{status}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center space-y-6 animate-fade-in">
                                <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-400 border border-rose-500/20 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]">
                                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>

                                <div>
                                    <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">Access Denied</h2>
                                    <p className="text-slate-400 font-light text-sm leading-relaxed">{status}</p>
                                </div>

                                <Link
                                    to="/"
                                    className="mt-4 w-full py-4 bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:border-white/20 rounded-2xl font-medium transition-all duration-300 shadow-sm flex justify-center items-center"
                                >
                                    Return to Home
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}