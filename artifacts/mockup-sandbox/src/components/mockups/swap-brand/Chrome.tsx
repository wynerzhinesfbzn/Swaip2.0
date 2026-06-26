export function Chrome() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0a0a0f 0%, #12141a 60%, #0a0c14 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Montserrat', sans-serif",
      gap: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
        @keyframes chrome-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .chrome-word {
          font-size: clamp(80px, 22vw, 158px);
          font-weight: 900;
          letter-spacing: -0.02em;
          background: linear-gradient(
            105deg,
            #888 0%,
            #ccc 15%,
            #fff 25%,
            #e8e8e8 35%,
            #aaa 50%,
            #e0e0e0 65%,
            #fff 75%,
            #bbb 85%,
            #888 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: chrome-shimmer 3s linear infinite;
          filter: drop-shadow(0 2px 16px rgba(200,220,255,0.18)) drop-shadow(0 0 2px rgba(255,255,255,0.4));
          user-select: none;
        }
        .chrome-sub {
          color: #666;
          font-size: 11px;
          letter-spacing: 0.4em;
          text-transform: uppercase;
        }
        .chrome-bar {
          width: 48px;
          height: 2px;
          background: linear-gradient(90deg, #555, #ccc, #555);
          border-radius: 2px;
        }
      `}</style>
      <div className="chrome-word">SWAP</div>
      <div className="chrome-bar" />
      <div className="chrome-sub">social platform</div>
    </div>
  );
}
