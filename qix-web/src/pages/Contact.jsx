import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function Contact() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-[100dvh] w-full bg-[#020617] text-slate-300 font-sans p-6 sm:p-12 overflow-y-auto selection:bg-violet-500/30">
            <div className="max-w-2xl mx-auto bg-white/[0.01] backdrop-blur-3xl border border-white/5 p-6 sm:p-12 rounded-[2.5rem] shadow-2xl relative">
                <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                    <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
                        ← Back
                    </button>
                    <Logo className="w-8 h-8 drop-shadow-[0_0_10px_rgba(139,92,246,0.3)]" />
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">Contact Node</h1>
                </div>

                <div className="space-y-6 text-sm sm:text-base font-light leading-relaxed">
                    <p>Because Qix operates with a complete focus on zero metadata logs, we do not monitor support tickets inside private channels, or track incoming request chains.</p>

                    <p>If you encounter technical performance vulnerabilities, want to submit security bug disclosures, or have operational administrative inquiries, reach out through our dedicated out-of-band networks:</p>

                    <div className="space-y-3 mt-6">
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0">
                            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Security & Administration</span>
                            <span className="text-white select-all font-mono text-sm">qix.admin@gmail.com</span>
                        </div>
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-0">
                            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Development Node (GitHub)</span>
                            <span className="text-white font-mono text-sm">https://github.com/MrV3nomous/qix</span>
                        </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-2xl text-xs mt-6 leading-relaxed">
                        <strong>Notice:</strong> Please do not send sensitive text logs, operational credentials, or private message fragments when contacting support. We cannot verify your cryptographic identity or help you unlock any active or deleted vaults.
                    </div>
                </div>
            </div>
        </div>
    );
}