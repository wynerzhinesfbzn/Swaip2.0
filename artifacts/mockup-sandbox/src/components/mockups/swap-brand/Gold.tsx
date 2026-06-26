export function Gold() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 70% 55% at 50% 45%, #1a1200 0%, #0d0900 50%, #050400 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Montserrat', sans-serif",
      gap: 18,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
        @keyframes gold-glow {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(212,170,50,0.5)) drop-shadow(0 0 60px rgba(180,130,20,0.25)); }
          50% { filter: drop-shadow(0 0 30px rgba(255,210,80,0.7)) drop-shadow(0 0 80px rgba(200,150,30,0.4)); }
        }
        @keyframes gold-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .gold-word {
          font-size: clamp(80px, 22vw, 158px);
          font-weight: 900;
          letter-spacing: -0.02em;
          background: linear-gradient(
            110deg,
            #8B6914 0%,
            #D4AA32 18%,
            #FFE566 30%,
            #F5C842 42%,
            #C8960C 55%,
            #FFE566 68%,
            #D4AA32 80%,
            #8B6914 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gold-shimmer 4s linear infinite, gold-glow 3s ease-in-out infinite;
          user-select: none;
        }
        .gold-ornament {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #8B6914;
          font-size: 10px;
          letter-spacing: 0.45em;
          text-transform: uppercase;
        }
        .gold-line {
          width: 36px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #D4AA32, transparent);
        }
      `}</style>
      <div className="gold-word">SWAP</div>
      <div className="gold-ornament">
        <div className="gold-line" />
        <span>premium</span>
        <div className="gold-line" />
      </div>
    </div>
  );
}
