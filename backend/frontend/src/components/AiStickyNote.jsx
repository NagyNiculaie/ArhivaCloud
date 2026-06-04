import React from "react";

export default function AiStickyNote({ answer, sources, onClose }) {
  if (!answer) return null;

  return (
    <div style={styles.note}>
      <div style={styles.header}>
        <span>📝 Răspuns AI</span>

        <button style={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.answerText}>{answer}</div>

        {sources?.length > 0 && (
          <div style={styles.sourcesBox}>
            <strong>Surse utilizate:</strong>

            {sources.map((src, index) => (
              <div style={styles.sourceItem} key={index}>
                <span style={styles.sourceName}>{src.fileName}</span>

                {typeof src.score === "number" && (
                  <small style={styles.sourceScore}>
                    Relevanță: {src.score.toFixed(3)}
                  </small>
                )}

                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.previewLink}
                  >
                    Preview
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  note: {
    position: "fixed",
    right: "28px",
    bottom: "28px",
    width: "520px",
    maxHeight: "78vh",
    backgroundColor: "#111827",
    color: "#e5e7eb",
    borderRadius: "20px",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.55)",
    border: "1px solid #334155",
    zIndex: 9999,
    overflow: "hidden",
    fontFamily: "Arial, sans-serif",
    textAlign: "left",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 18px",
    background: "linear-gradient(135deg, #1e293b, #111827)",
    borderBottom: "1px solid #334155",
    fontWeight: "800",
    fontSize: "18px",
    color: "#ffffff",
  },

  closeBtn: {
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    border: "1px solid #475569",
    backgroundColor: "#0f172a",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
  },

  content: {
    padding: "18px",
    maxHeight: "65vh",
    overflowY: "auto",
  },

  answerText: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.65,
    fontSize: "15px",
    color: "#e2e8f0",
  },

  sourcesBox: {
    marginTop: "18px",
    paddingTop: "14px",
    borderTop: "1px solid #334155",
  },

  sourceItem: {
    marginTop: "10px",
    padding: "12px",
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "12px",
  },

  sourceName: {
    display: "block",
    fontWeight: "700",
    color: "#ffffff",
    wordBreak: "break-word",
  },

  sourceScore: {
    display: "block",
    marginTop: "4px",
    color: "#94a3b8",
  },

  previewLink: {
    display: "inline-block",
    marginTop: "8px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "8px 11px",
    borderRadius: "9px",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: "700",
  },
};