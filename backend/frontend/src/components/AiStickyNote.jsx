import React, { useEffect, useRef, useState } from "react";

function renderInlineMarkdown(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} style={{ color: "#ffffff" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function renderAnswer(answer) {
  const lines = answer.split("\n");

  return lines.map((line, index) => {
    const cleanLine = line.trim();

    if (!cleanLine) {
      return <div key={index} style={{ height: "10px" }} />;
    }

    if (cleanLine.startsWith("###")) {
      return (
        <h3 key={index} style={styles.answerHeading}>
          {cleanLine.replace(/^###\s*/, "")}
        </h3>
      );
    }

    if (cleanLine.startsWith("##")) {
      return (
        <h3 key={index} style={styles.answerHeading}>
          {cleanLine.replace(/^##\s*/, "")}
        </h3>
      );
    }

    if (cleanLine.startsWith("-")) {
      return (
        <div key={index} style={styles.bulletRow}>
          <span style={styles.bullet}>•</span>
          <span>{renderInlineMarkdown(cleanLine.replace(/^-\s*/, ""))}</span>
        </div>
      );
    }

    return (
      <p key={index} style={styles.answerParagraph}>
        {renderInlineMarkdown(cleanLine)}
      </p>
    );
  });
}

export default function AiStickyNote({ notes = [], onClose, onDeleteNote }) {
  const contentRef = useRef(null);
  const [activeNoteId, setActiveNoteId] = useState(null);

  useEffect(() => {
    if (notes.length > 0) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeNoteId]);

  if (!notes.length) return null;

  const activeNote = notes.find((note) => note.id === activeNoteId) || notes[0];

  return (
    <div style={styles.overlay}>
      <div style={styles.note}>
        <div style={styles.header}>
          <div>
            <span style={styles.headerIcon}>📝</span>
            <span>Răspunsuri AI</span>
          </div>

          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.tabs}>
          {notes.map((note, index) => (
            <button
              key={note.id}
              onClick={() => setActiveNoteId(note.id)}
              style={{
                ...styles.tabBtn,
                ...(activeNote.id === note.id ? styles.activeTabBtn : {}),
              }}
            >
              Întrebarea {notes.length - index}
            </button>
          ))}
        </div>

        <div ref={contentRef} style={styles.content} className="ai-note-scroll">
          <div style={styles.questionBox}>
            <strong>Întrebare:</strong>
            <p>{activeNote.question}</p>
          </div>

          <div style={styles.answerText}>{renderAnswer(activeNote.answer)}</div>

          {activeNote.sources?.length > 0 && (
            <div style={styles.sourcesBox}>
              <strong style={styles.sourcesTitle}>Surse utilizate</strong>

              {activeNote.sources.map((src, index) => (
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

          <button
            style={styles.deleteNoteBtn}
            onClick={() => onDeleteNote(activeNote.id)}
          >
            Șterge acest răspuns
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    right: "24px",
    bottom: "24px",
    zIndex: 9999,
  },

  note: {
    width: "500px",
    maxHeight: "72vh",
    backgroundColor: "#111827",
    color: "#e5e7eb",
    borderRadius: "22px",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.6)",
    border: "1px solid #334155",
    overflow: "hidden",
    fontFamily: "Arial, sans-serif",
    textAlign: "left",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 18px",
    background: "linear-gradient(135deg, #1e293b, #111827)",
    borderBottom: "1px solid #334155",
    fontWeight: "800",
    fontSize: "18px",
    color: "#ffffff",
  },

  headerIcon: {
    marginRight: "8px",
  },

  closeBtn: {
    width: "34px",
    height: "34px",
    borderRadius: "11px",
    border: "1px solid #475569",
    backgroundColor: "#0f172a",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: "17px",
    fontWeight: "bold",
  },

  tabs: {
    display: "flex",
    gap: "8px",
    padding: "10px 14px",
    borderBottom: "1px solid #334155",
    overflowX: "auto",
    backgroundColor: "#0f172a",
  },

  tabBtn: {
    border: "1px solid #334155",
    backgroundColor: "#111827",
    color: "#cbd5e1",
    padding: "8px 10px",
    borderRadius: "999px",
    cursor: "pointer",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },

  activeTabBtn: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
    color: "#ffffff",
  },

  content: {
    padding: "18px",
    maxHeight: "52vh",
    overflowY: "auto",
  },

  questionBox: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "14px",
    padding: "12px",
    marginBottom: "16px",
  },

  answerText: {
    color: "#e2e8f0",
  },

  answerHeading: {
    margin: "12px 0 10px",
    fontSize: "17px",
    color: "#ffffff",
  },

  answerParagraph: {
    margin: "0 0 12px",
    lineHeight: 1.65,
    fontSize: "15px",
  },

  bulletRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "9px",
    lineHeight: 1.6,
    fontSize: "15px",
  },

  bullet: {
    color: "#818cf8",
    fontWeight: "bold",
  },

  sourcesBox: {
    marginTop: "18px",
    paddingTop: "14px",
    borderTop: "1px solid #334155",
  },

  sourcesTitle: {
    display: "block",
    marginBottom: "10px",
    color: "#ffffff",
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

  deleteNoteBtn: {
    marginTop: "16px",
    width: "100%",
    padding: "10px",
    borderRadius: "12px",
    border: "1px solid #475569",
    backgroundColor: "#1e293b",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: "700",
  },
};