export default function Logo({ className = "w-10 h-10" }) {
    return (
        <svg
            className={className}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="bubble-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>

                <linearGradient id="leaf-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
            </defs>

            <path
                d="M 25 15 
           H 75 
           A 10 10 0 0 1 85 25 
           V 55 
           A 10 10 0 0 1 75 65 
           H 60 
           L 40 80 
           L 45 65 
           H 25 
           A 10 10 0 0 1 15 55 
           V 25 
           A 10 10 0 0 1 25 15 Z"
                stroke="url(#bubble-gradient)"
                strokeWidth="6"
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            <path
                d="M 60 25 
           C 60 40, 50 50, 40 50 
           C 40 35, 50 25, 60 25 Z"
                fill="url(#leaf-gradient)"
            />
        </svg>
    );
}