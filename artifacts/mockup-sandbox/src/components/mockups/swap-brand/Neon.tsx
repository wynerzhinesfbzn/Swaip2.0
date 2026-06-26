export function Neon() {
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
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
        @keyframes neon-flicker {
          0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
            text-shadow:
              0 0 7px #fff,
              0 0 10px #fff,
              0 0 21px #fff,
              0 0 42px #00f7ff,
              0 0 82px #00f7ff,
              0 0 92px #00f7ff,
              0 0 102px #00f7ff,
              0 0 151px #00f7ff;
            opacity: 1;
          }
          20%, 24%, 55% { text-shadow: none; opacity: 0.85; }
        }
        .neon-word {
          font-size: clamp(80px, 22vw, 155px);
          font-weight: 900;
          letter-spacing: 0.05em;
          color: #e0fffe;
          animation: neon-flicker 5s infinite;
          user-select: none;
        }
        .neon-line {
          width: 60%;
          height: 1px;
          background: linear-gradient(90deg, transparent, #00f7ff, transparent);
          box-shadow: 0 0 8px #00f7ff;
        }
      `}</style>
      <div className="neon-line" />
      <div className="neon-word">SWAP</div>
      <div className="neon-line" />
      <div style={{ color: "#00f7ff", fontSize: 11, letterSpacing: "0.35em", marginTop: 8, opacity: 0.6 }}>
        SOCIAL · PLATFORM
      </div>
    </div>
  );
}
