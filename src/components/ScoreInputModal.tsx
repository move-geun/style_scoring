import React, { useState, useEffect } from "react";
import type { Coordinate } from "../types.ts";

interface ScoreInputModalProps {
  isOpen: boolean;
  coord: Coordinate | null;
  existingScore: number | null;
  note: string;
  onScoreChange: (score: number) => void;
  onNoteChange: (note: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const ScoreInputModal: React.FC<ScoreInputModalProps> = ({
  isOpen,
  coord,
  existingScore,
  note,
  onScoreChange,
  onNoteChange,
  onSave,
  onClose,
}) => {
  const [score, setScore] = useState<number>(existingScore ?? 0);

  useEffect(() => {
    if (isOpen) {
      setScore(existingScore ?? 0);
    }
  }, [existingScore, coord, isOpen]);

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setScore(value);
      onScoreChange(value);
    }
  };

  if (!isOpen || !coord) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">점수 입력</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="score-section">
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
          </div>

          <div className="input-group">
            <label className="input-label">
              매력도 점수
              <span className="input-hint">(0-100)</span>
            </label>
            <div className="score-input-wrapper">
              <input
                type="number"
                value={score}
                onChange={handleScoreChange}
                className="score-input"
                min="0"
                max="100"
                placeholder="0"
              />
              <div className="score-slider-wrapper">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setScore(val);
                    onScoreChange(val);
                  }}
                  className="score-slider"
                />
              </div>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">메모</label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              className="note-input"
              placeholder="메모를 입력하세요..."
              rows={4}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">
            취소
          </button>
          <button onClick={onSave} className="btn-save">
            {existingScore !== null ? "✏️ 수정" : "💾 저장"}
          </button>
        </div>
      </div>
    </div>
  );
};


