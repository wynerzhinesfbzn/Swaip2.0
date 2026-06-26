export function Ice() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #010c18 0%, #021a30 50%, #010c1e 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Montserrat', sans-serif",
      gap: 20,
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
        @keyframes ice-breathe {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.008); }
        }
        .ice-glass {
          padding: 28px 52px;
          border-radius: 24px;
          background: rgba(180, 230, 255, 0.05);
          border: 1px solid rgba(180, 230, 255, 0.18);
          backdrop-filter: blur(12px);
          box-shadow:
            0 0 0 1px rgba(180,230,255,0.08),
            0 8px 48px rgba(0,130,200,0.12),
            inset 0 1px 0 rgba(255,255,255,0.12);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          animation: ice-breathe 4s ease-in-out infinite;
        }
        .ice-word {
          font-size: clamp(70px, 20vw, 140px);
          font-weight: 900;
          letter-spacing: -0.01em;
          background: linear-gradient(170deg, #ffffff 0%, #c8eeff 35%, #8bd4f5 65%, #4ab8e8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 20px rgba(120,200,255,0.45));
          user-select: none;
          line-height: 1;
        }
        .ice-sub {
          color: rgba(140, 210, 250, 0.5);
          font-size: 10px;
          letter-spacing: 0.45em;
          text-transform: uppercase;
        }
        .ice-crystal {
          position: absolute;
          color: rgba(160, 220, 255, 0.08);
          font-size: 80px;
          pointer-events: none;
          user-select: none;
        }
      `}</style>
      <div className="ice-crystal" style={{ top: "8%", left: "6%" }}>❄</div>
      <div className="ice-crystal" style={{ top: "12%", right: "8%", fontSize: 50 }}>❄</div>
      <div className="ice-crystal" style={{ bottom: "10%", left: "12%", fontSize: 45 }}>❄</div>
      <div className="ice-crystal" style={{ bottom: "8%", right: "6%", fontSize: 65 }}>❄</div>
      <div className="ice-glass">
        <div className="ice-word">SWAP</div>
        <div className="ice-sub">social platform</div>
      </div>
    </div>
  );
}
