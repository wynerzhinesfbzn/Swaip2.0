export function Matrix() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Montserrat', sans-serif",
      gap: 16,
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
        @keyframes matrix-pulse {
          0%, 100% {
            text-shadow:
              0 0 7px #00ff41,
              0 0 20px #00ff41,
              0 0 50px #00cc33,
              0 0 100px #009922;
            opacity: 1;
          }
          50% {
            text-shadow:
              0 0 4px #00ff41,
              0 0 12px #00ff41,
              0 0 30px #00cc33;
            opacity: 0.85;
          }
        }
        @keyframes scan {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        .matrix-word {
          font-size: clamp(80px, 22vw, 156px);
          font-weight: 900;
          letter-spacing: 0.04em;
          color: #00ff41;
          animation: matrix-pulse 2s ease-in-out infinite;
          user-select: none;
          position: relative;
          z-index: 2;
        }
        .matrix-sub {
          color: #00aa2a;
          font-size: 11px;
          letter-spacing: 0.4em;
          text-transform: uppercase;
          font-family: monospace;
          opacity: 0.6;
          z-index: 2;
        }
        .matrix-scan {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(0,255,65,0.4), transparent);
          animation: scan 4s linear infinite;
          z-index: 1;
        }
        .matrix-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }
      `}</style>
      <div className="matrix-grid" />
      <div className="matrix-scan" />
      <div className="matrix-word">SWAP</div>
      <div className="matrix-sub">// social platform</div>
    </div>
  );
}
