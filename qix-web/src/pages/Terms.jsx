import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function Terms() {
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
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">Terms of Service</h1>
                </div>

                <div className="space-y-6 text-sm sm:text-base font-light leading-relaxed">
                    <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Last Updated: June 24, 2026</p>

                    <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-5 rounded-2xl text-xs sm:text-sm leading-relaxed">
                        <strong>CRITICAL LEGAL NOTICE:</strong> PLEASE READ THESE TERMS CAREFULLY. THEY CONTAIN STRICT LIMITATIONS OF LIABILITY, TOTAL DISCLAIMERS OF WARRANTIES, AN EXPLICIT ASSUMPTION OF CRYPTOGRAPHIC RISK, AND AN IRONCLAD AGREEMENT TO INDEMNIFY THE OPERATOR AGAINST ALL CLAIMS.
                    </div>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance & Binding Agreement</h2>
                        <p>By accessing, deploying, or utilizing any component of Qix ("the Service"), you express absolute and irrevocable consent to be bound by these Terms of Service. If you do not agree to these terms, you possess no legal authorization to use the Service and must terminate your session immediately.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">2. Nature of Service & Absolute Data Disclaimers</h2>
                        <p>Qix functions exclusively as an automated, transient cryptographic routing infrastructure.
                            Messages are encrypted client-side prior to transit and are automatically purged upon manual termination or forty-eight (48) consecutive hours of channel inactivity.
                            You explicitly acknowledge that once shredded, data is permanently mathematically non-recoverable.
                            The Service does not guarantee data persistence, sequential delivery, or packet completion. You assume all operational hazards regarding data loss, corruption, or session death.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">3. No-Bailment & Zero Custodial Duty</h2>
                        <p>You explicitly agree that the hosting, routing, or transient buffering of encrypted payloads by our infrastructure does **not** constitute a bailment, escrow, or custodial relationship.
                            The Operator owes you no duty of care, safety, preservation, or recovery. Cryptographic keys exist solely within your local browser window memory space and the URL parameter fragment identifier hash (`#key=...`).
                            Because this parameter never touches our servers, losing your link or key means permanent truncation of access. The Operator cannot reset, bypass, recover, or crack any vault.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">4. Prohibited Misuse & Aggressive Civil/Criminal Liability</h2>
                        <p>You are strictly prohibited from utilizing the Service to execute, facilitate, fund, mask, or orchestrate illicit actions, including but not limited to: terrorism, child exploitation, extortion, unauthorized cyber-intrusions, financial fraud, malware distribution, or violations of privacy laws.
                            <strong>Any unauthorized exploitation, reverse engineering, infrastructure stress-testing, or utilization of Qix for illegal activity will result in immediate termination of transport tunnels and may subject the perpetrator to aggressive civil litigation, monetary damages, and direct criminal referral to global law enforcement agencies.</strong></p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">5. ABSOLUTE DISCLAIMER OF WARRANTIES</h2>
                        <p className="font-mono text-xs uppercase tracking-tight text-slate-400 bg-black/30 p-4 rounded-xl border border-white/5">
                            THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. THE OPERATOR DOES NOT WARRANT THAT THE UTILITY WILL BE SECURE, UNINTERRUPTED, VIRUS-FREE, ERROR-FREE, OR IMMUNE TO COMPROMISE BY ADVANCED CRYPTOGRAPHIC EXPLOITATION TECHNIQUES.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">6. UNCONDITIONAL LIMITATION OF LIABILITY</h2>
                        <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE OPERATOR, DEVELOPERS, MAINTAINERS, HOSTING PARTNERS, OR ASSOCIATES BE LIABLE FOR ANY DAMAGES WHATSOEVER (INCLUDING, WITHOUT LIMITATION, DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, LOSS OF PROFITS, BUSINESS INTERRUPTION, LOSS OF DIGITAL ASSETS, OR DATA COMPROMISE) ARISING OUT OF THE USE OF, INABILITY TO USE, OR THE PERFORMANCE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">7. Ironclad Indemnification</h2>
                        <p>You agree to defend, indemnify, and hold completely harmless the Operator, its developers, contractors, and hosting providers from and against any and all claims, damages, obligations, losses, liabilities, costs, debt, and expenses (including but not limited to attorney's fees and court costs) arising directly or indirectly from: (a) your misuse of or access to the Service; (b) your violation of any third-party right or global law; or (c) any unlawful payload routed through your generated rooms.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-2">8. Severability & Governing Law</h2>
                        <p>If any provision of these Terms is found to be invalid or unenforceable by a court of competent jurisdiction, that specific provision shall be severed, and the remaining provisions shall continue in full force and effect. These Terms are governed by and construed in accordance with the laws of your operating jurisdiction, without regard to its conflict of law principles.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}