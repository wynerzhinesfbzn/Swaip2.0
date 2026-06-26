export function Holo() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(140deg, #050508 0%, #0a080e 50%, #050508 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Montserrat', sans-serif",
      gap: 20,
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
        @keyframes holo-shift {
          0%   { background-position: 0% 50%; filter: drop-shadow(0 0 30px rgba(120,80,255,0.5)); }
          16%  { background-position: 20% 20%; filter: drop-shadow(0 0 30px rgba(0,180,255,0.5)); }
          33%  { background-position: 50% 0%; filter: drop-shadow(0 0 30px rgba(0,240,180,0.5)); }
          50%  { background-position: 100% 50%; filter: drop-shadow(0 0 30px rgba(255,220,0,0.5)); }
          66%  { background-position: 80% 100%; filter: drop-shadow(0 0 30px rgba(255,60,120,0.5)); }
          83%  { background-position: 20% 80%; filter: drop-shadow(0 0 30px rgba(200,0,255,0.5)); }
          100% { background-position: 0% 50%; filter: drop-shadow(0 0 30px rgba(120,80,255,0.5)); }
        }
        .holo-word {
          font-size: clamp(80px, 22vw, 158px);
          font-weight: 900;
          letter-spacing: -0.01em;
          background: linear-gradient(
            90deg,
            #ff0080,
            #ff6600,
            #ffdd00,
            #00ff88,
            #00ccff,
            #8844ff,
            #ff0080
          );
          background-size: 400% 400%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: holo-shift 5s linear infinite;
          user-select: none;
        }
        .holo-plate {
          position: relative;
          padding: 20px 48px;
          border-radius: 16px;
          border: 1px solid transparent;
          background: linear-gradient(#050508, #050508) padding-box,
                      linear-gradient(90deg, #ff0080, #00ccff, #ffdd00, #ff0080) border-box;
          background-size: 200% 200%;
          animation: holo-shift 5s linear infinite;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .holo-sub {
          font-size: 10px;
          letter-spacing: 0.45em;
          text-transform: uppercase;
          background: linear-gradient(90deg, #8844ff, #00ccff, #00ff88);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: holo-shift 5s linear infinite;
          opacity: 0.8;
        }
      `}</style>
      <div className="holo-plate">
        <div className="holo-word">SWAP</div>
        <div className="holo-sub">social platform</div>
      </div>
    </div>
  );
}
