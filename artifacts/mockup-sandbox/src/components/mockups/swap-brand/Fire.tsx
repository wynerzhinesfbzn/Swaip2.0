export function Fire() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 75% 55% at 50% 45%, #1c0800 0%, #0d0200 55%, #000 100%)",
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
        @keyframes fire-dance {
          0%, 100% {
            background-position: 0% 50%;
            filter: drop-shadow(0 0 25px rgba(255,120,20,0.7)) drop-shadow(0 0 60px rgba(255,60,0,0.4));
          }
          33% {
            background-position: 50% 0%;
            filter: drop-shadow(0 0 35px rgba(255,200,30,0.8)) drop-shadow(0 0 80px rgba(255,100,0,0.5));
          }
          66% {
            background-position: 100% 50%;
            filter: drop-shadow(0 0 28px rgba(255,80,0,0.75)) drop-shadow(0 0 70px rgba(200,40,0,0.45));
          }
        }
        .fire-word {
          font-size: clamp(80px, 22vw, 158px);
          font-weight: 900;
          letter-spacing: -0.01em;
          background: linear-gradient(
            115deg,
            #ff2200,
            #ff6600,
            #ffaa00,
            #ffdd00,
            #ffaa00,
            #ff6600,
            #ff2200
          );
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: fire-dance 2.5s ease-in-out infinite;
          user-select: none;
        }
        .fire-ember {
          position: absolute;
          border-radius: 50%;
          filter: blur(50px);
          pointer-events: none;
          opacity: 0.18;
        }
        .fire-sub {
          color: #ff6a1a;
          font-size: 11px;
          letter-spacing: 0.38em;
          text-transform: uppercase;
          opacity: 0.55;
        }
      `}</style>
      <div className="fire-ember" style={{ width: 220, height: 180, background: "#ff4400", top: "20%", left: "5%" }} />
      <div className="fire-ember" style={{ width: 180, height: 160, background: "#ff8800", bottom: "18%", right: "8%" }} />
      <div className="fire-word">SWAP</div>
      <div className="fire-sub">social platform</div>
    </div>
  );
}
