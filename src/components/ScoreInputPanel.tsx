import React, { useState, useEffect } from "react";
import type { Coordinate } from "../types.ts";

interface ScoreInputPanelProps {
  coord: Coordinate | null;
  existingScore: number | null;
  note: string;
  onScoreChange: (score: number) => void;
  onNoteChange: (note: string) => void;
  onSave: () => void;
}

export const ScoreInputPanel: React.FC<ScoreInputPanelProps> = ({
  coord,
  existingScore,
  note,
  onScoreChange,
  onNoteChange,
  onSave,
}) => {
  const [score, setScore] = useState<number>(existingScore ?? 0);

  useEffect(() => {
    setScore(existingScore ?? 0);
  }, [existingScore, coord]);

  if (!coord) {
    return (
      <div className="score-panel-empty">
        <div className="empty-icon">📍</div>
        <p>그래프를 클릭하여 좌표를 선택하세요</p>
      </div>
    );
  }

  return (
    <div className="score-panel">
      <h3 className="score-panel-title">점수 입력</h3>

      <div className="coord-score-row">
        <div className="coord-display">
          <div className="coord-item">
            <span className="coord-label">X</span>
            <span className="coord-value">{coord.x.toFixed(5)}</span>
          </div>
          {coord.y !== undefined && (
            <div className="coord-item">
              <span className="coord-label">Y</span>
              <span className="coord-value">{coord.y.toFixed(5)}</span>
            </div>
          )}
          {coord.z !== undefined && (
            <div className="coord-item">
              <span className="coord-label">Z</span>
              <span className="coord-value">{coord.z.toFixed(5)}</span>
            </div>
          )}
        </div>
        <div className="score-input-inline">
          <label className="score-label-inline">매력도</label>
          <input
            type="text"
            value={score}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, "");
              if (
                value === "" ||
                (parseInt(value, 10) >= 0 && parseInt(value, 10) <= 100)
              ) {
                const numValue = value === "" ? 0 : parseInt(value, 10);
                setScore(numValue);
                onScoreChange(numValue);
              }
            }}
            className="score-input-inline-field"
            placeholder="0"
            maxLength={3}
          />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">메모</label>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          className="note-input"
          placeholder="메모를 입력하세요..."
          rows={2}
        />
      </div>

      <button onClick={onSave} className="save-button">
        <span>{existingScore !== null ? "✏️ 수정" : "💾 저장"}</span>
      </button>

      <style>{`
        .score-panel-empty {
          padding: 40px 20px;
          text-align: center;
          color: #9ca3af;
        }
        
        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
          opacity: 0.5;
        }
        
        .score-panel {
          background: #1f1f1f;
          border-radius: 8px;
          padding: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .score-panel-title {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 700;
          color: #e5e5e5;
          letter-spacing: -0.2px;
        }
        
        .coord-score-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .coord-display {
          display: flex;
          gap: 8px;
          flex: 1;
        }
        
        .score-input-inline {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        
        .score-label-inline {
          font-size: 11px;
          font-weight: 600;
          color: #9ca3af;
          white-space: nowrap;
        }
        
        .score-input-inline-field {
          width: 60px;
          padding: 6px 8px;
          border: 2px solid #374151;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 700;
          text-align: center;
          color: #e5e5e5;
          background: #1a1a1a;
          transition: all 0.2s;
        }
        
        .score-input-inline-field:focus {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
        }
        
        .score-input-inline-field::-webkit-inner-spin-button,
        .score-input-inline-field::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        .score-input-inline-field[type=number] {
          -moz-appearance: textfield;
        }
        
        .coord-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 6px 10px;
          background: #2a2a2a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          min-width: 70px;
        }
        
        .coord-label {
          font-size: 10px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .coord-value {
          font-size: 12px;
          font-weight: 700;
          color: #e5e5e5;
          font-family: 'Monaco', 'Menlo', monospace;
        }
        
        .input-group {
          margin-bottom: 12px;
        }
        
        .input-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #d1d5db;
          margin-bottom: 6px;
        }
        
        
        .note-input {
          width: 100%;
          padding: 8px 10px;
          border: 2px solid #374151;
          border-radius: 6px;
          font-size: 12px;
          font-family: inherit;
          color: #e5e5e5;
          background: #1a1a1a;
          resize: vertical;
          transition: all 0.2s;
          rows: 2;
        }
        
        .note-input:focus {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
        }
        
        .note-input::placeholder {
          color: #6b7280;
        }
        
        .save-button {
          width: 100%;
          padding: 10px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        
        .save-button:hover {
          background: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        
        .save-button:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};
