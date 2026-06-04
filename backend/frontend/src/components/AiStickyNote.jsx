import React from "react";

export default function AiStickyNote({ answer, sources, onClose }) {
  if (!answer) return null;

  return (
    <div className="ai-sticky-note">
      <div className="ai-sticky-header">
        <span>📝 Răspuns AI</span>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="ai-sticky-content">
        <div className="ai-answer-text">{answer}</div>

        {sources?.length > 0 && (
          <div className="ai-sticky-sources">
            <strong>Surse utilizate:</strong>

            {sources.map((src, index) => (
              <div className="ai-source-item" key={index}>
                <span>{src.fileName}</span>

                {typeof src.score === "number" && (
                  <small>Relevanță: {src.score.toFixed(3)}</small>
                )}

                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ai-source-preview"
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