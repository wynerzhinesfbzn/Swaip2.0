export function Plasma() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 80% 60% at 50% 45%, #1a0535 0%, #09011e 55%, #010008 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Montserrat', sans-serif",
      gap: 16,
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
        @keyframes plasma-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes plasma-glow {
          0%, 100% { filter: drop-shadow(0 0 30px rgba(200,60,255,0.6)) drop-shadow(0 0 70px rgba(255,60,200,0.3)); }
          50% { filter: drop-shadow(0 0 50px rgba(255,80,255,0.8)) drop-shadow(0 0 100px rgba(200,60,255,0.45)); }
        }
        .plasma-word {
          font-size: clamp(80px, 22vw, 156px);
          font-weight: 900;
          letter-spacing: -0.01em;
          background: linear-gradient(
            125deg,
            #b832ff,
            #ff3dca,
            #ff6ef0,
            #c44dff,
            #ff3dca,
            #b832ff
          );
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: plasma-shift 4s ease-in-out infinite, plasma-glow 3s ease-in-out infinite;
          user-select: none;
        }
        .plasma-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.15;
          pointer-events: none;
        }
        .plasma-sub {
          color: #b05ae0;
          font-size: 11px;
          letter-spacing: 0.38em;
          text-transform: uppercase;
          opacity: 0.65;
        }
      `}</style>
      <div className="plasma-orb" style={{ width: 200, height: 200, background: "#c832ff", top: "15%", left: "10%" }} />
      <div className="plasma-orb" style={{ width: 180, height: 180, background: "#ff3dc8", bottom: "15%", right: "10%" }} />
      <div className="plasma-word">SWAP</div>
      <div className="plasma-sub">social platform</div>
    </div>
  );
}
