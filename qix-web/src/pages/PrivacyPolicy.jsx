import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-[100dvh] w-full bg-[#020617] text-slate-300 font-sans p-6 sm:p-12 overflow-y-auto selection:bg-violet-500/30">
            <div className="max-w-4xl mx-auto bg-white/[0.01] backdrop-blur-3xl border border-white/5 p-6 sm:p-12 rounded-[2.5rem] shadow-2xl relative">
                <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                    <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
                        ← Back
                    </button>
                    <Logo className="w-8 h-8 drop-shadow-[0_0_10px_rgba(139,92,246,0.3)]" />
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">Privacy Policy</h1>
                </div>

                <div className="space-y-6 text-sm sm:text-base font-light leading-relaxed">
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Last Updated: June 24, 2026</p>

                    <div className="bg-violet-500/10 border border-violet-500/20 text-violet-300 p-5 rounded-2xl text-sm">
                        <strong>Zero-Knowledge Mandate:</strong> This privacy policy serves as an architecture confirmation. We do not require authentication, user accounts, registration parameters, or persistent metadata mapping. We maintain zero data assets to monetize, parse, or track.
                    </div>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">1. Data Minimization & Non-Collection Baseline</h2>
                        <p>Our routing protocols ensure we never collect, intercept, parse, or structurally retain:</p>
                        <ul className="list-disc pl-6 space-y-1 mt-2 text-slate-400">
                            <li>Names, phone numbers, email addresses, or verified identities</li>
                            <li>Plaintext communication content, cryptographic keys, or metadata logs</li>
                            <li>Long-term historical records of Internet Protocol (IP) addresses</li>
                            <li>Tracking cookies, cross-site analytics, or user profiling parameters</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">2. Cryptographic Execution Space</h2>
                        <p>All communication layers across the Service utilize End-to-End Encryption (E2EE) powered by symmetric AES-256-GCM algorithms processing locally inside your native browser runtime. Keys exist exclusively within volatile device memory and the URL window location hash parameter. Because URL hash fragment indices are structurally isolated by web standards and never transmitted to the host server during HTTP workflows, the Operator operates in absolute blindness regarding your message payloads.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">3. Ephemeral Erasure & Automated Shredding Routines</h2>
                        <p>Binary encrypted payloads stored temporarily within our data cluster exist purely as transient queues awaiting asynchronous client delivery. These payloads undergo absolute structural destruction via two parallel paradigms: (a) explicit room termination signaled by an active participant session, or (b) an automated 48-hour Time-To-Live (TTL) index sweep driven by backend processes over inactive records. Once shredded, storage blocks are entirely overwritten, rendering data completely unrecoverable.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">4. Abuse Counter-Measures & Volatile Infrastructure Logs</h2>
                        <p>To defend infrastructure security against malicious high-volume Distributed Denial of Service (DDoS) exploitation, automated bot orchestration, and structural platform abuse, our reverse proxy layers utilize highly transient rate-limiting counters.
                            This security telemetry processes internet network addresses temporarily within volatile RAM spaces. These memory registers are continuously overwritten and cycled out dynamically over 60-second rolling increments. No long-term persistent logging databases receive this data under normal operation.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">5. Compliance with Law Enforcement & Judicial Warrants</h2>
                        <p>The Operator will fully cooperate with legitimate, legally binding subpoenas, warrants, and judicial orders originating from competent jurisdictions. However, due to the immutability of the platform’s technical architecture, **the Operator mathematically cannot supply plaintext data streams, decryption keys, or metadata profiles.** Any database extractions executed under judicial enforcement will yield nothing but unreadable, structurally encrypted binary blobs and transient time signatures.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}