export function Minimal() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Montserrat', sans-serif",
      gap: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@200;900&display=swap');
        .min-word {
          font-size: clamp(80px, 22vw, 160px);
          font-weight: 900;
          letter-spacing: 0.08em;
          color: #fff;
          line-height: 1;
          user-select: none;
        }
        .min-rule {
          width: 100px;
          height: 1px;
          background: #333;
        }
        .min-sub {
          font-weight: 200;
          font-size: 11px;
          letter-spacing: 0.5em;
          text-transform: uppercase;
          color: #555;
        }
      `}</style>
      <div className="min-word">SWAP</div>
      <div className="min-rule" />
      <div className="min-sub">social platform</div>
    </div>
  );
}
