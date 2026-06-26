export function Aurora() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 80% 60% at 50% 40%, #1b5eb0 0%, #0a1e4a 45%, #020514 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Montserrat', sans-serif",
      gap: 12,
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
        @keyframes aurora-pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.015); }
        }
        .aurora-word {
          font-size: clamp(80px, 22vw, 160px);
          font-weight: 900;
          letter-spacing: -0.02em;
          background: linear-gradient(160deg, #f0fbff 10%, #7dd8f8 45%, #1a9fe0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 40px rgba(56,189,248,0.7)) drop-shadow(0 0 80px rgba(56,189,248,0.35));
          animation: aurora-pulse 3s ease-in-out infinite;
          user-select: none;
        }
      `}</style>
      <div className="aurora-word">SWAP</div>
      <div style={{ color: "#5bb8e8", fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.75 }}>
        текущий стиль
      </div>
    </div>
  );
}
