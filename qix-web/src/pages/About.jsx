import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function About() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-[100dvh] w-full bg-[#020617] text-slate-300 font-sans p-6 sm:p-12 overflow-y-auto selection:bg-violet-500/30">
            <div className="max-w-3xl mx-auto bg-white/[0.01] backdrop-blur-3xl border border-white/5 p-6 sm:p-12 rounded-[2.5rem] shadow-2xl relative">
                <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                    <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
                        ← Back
                    </button>
                    <Logo className="w-8 h-8 drop-shadow-[0_0_10px_rgba(139,92,246,0.3)]" />
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">About Qix</h1>
                </div>

                <div className="space-y-6 text-sm sm:text-base font-light leading-relaxed">
                    <p className="text-lg text-slate-200 font-medium">Privacy shouldn't require an installation file or an account signup.</p>

                    <p>Qix was conceived out of a fundamental engineering question: *Why does modern digital privacy feel so heavy?* Most secure messaging utilities require you to supply a verified mobile phone number, hand over your biological contact book, download a heavy desktop client, or sign away metadata trails to persistent servers.</p>

                    <p>Qix is architected as an alternative: **an instantaneous, 100% web-native, zero-knowledge communication node.** It is built to facilitate absolute transactional conversations—delicate business arrangements, security keys handoffs, legal counseling, or true confidential exchanges—with completely zero digital footprint left behind.</p>

                    <h2 className="text-lg font-semibold text-white mt-8 mb-2">Our Architecture Blueprint:</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                            <h3 className="text-white font-medium mb-1">Cryptographic Isolation</h3>
                            <p className="text-xs text-slate-400 font-light">Symmetric encryption keys are born via the Web Crypto API on your device. The server never tastes the plaintext key or payloads.</p>
                        </div>
                        <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                            <h3 className="text-white font-medium mb-1">True Ephemerality</h3>
                            <p className="text-xs text-slate-400 font-light">When you trigger an "End Chat", structural database records are cleanly erased. Failsafe mechanisms cycle inactive rooms out every 48 hours.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}