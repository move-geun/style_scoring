import React from "react";
import type { AttractionPoint, Coordinate, StyleSetType } from "../types";
import { keyOf } from "../utils";
import "./SavedPointsList.css";

interface SavedPointsListProps {
    points: AttractionPoint[];
    styleSet: StyleSetType;
    selectedCoord: Coordinate | null;
    onPointSelect: (coord: Coordinate, normCoord: Coordinate | undefined, index?: number) => void;
    onPointHover: (coord: Coordinate | null) => void;
}

export const SavedPointsList: React.FC<SavedPointsListProps> = ({
    points,
    styleSet,
    selectedCoord,
    onPointSelect,
    onPointHover,
}) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const getCoordDisplay = (point: AttractionPoint): string => {
        if (styleSet === "A") {
            return `(${point.coord.x.toFixed(5)}, ${point.coord.y?.toFixed(5) || "0.00000"})`;
        } else {
            return `(${point.coord.x.toFixed(5)}, ${point.coord.z?.toFixed(5) || "0.00000"})`;
        }
    };

    const isSelected = (point: AttractionPoint): boolean => {
        if (!selectedCoord) return false;
        return keyOf(point.coord) === keyOf(selectedCoord);
    };

    return (
        <div className="saved-points-list">
            <div
                className="saved-points-header"
                onClick={() => setIsOpen(!isOpen)}
            >
                <h3>
                    <span className="dropdown-icon">{isOpen ? "▼" : "▶"}</span>
                    Saved Points ({points.length})
                </h3>
            </div>
            {isOpen && (
                <div className="saved-points-container">
                    {points.length === 0 ? (
                        <div className="empty-message">No saved points yet</div>
                    ) : (
                        <div className="points-list">
                            {points.map((point, index) => (
                                <div
                                    key={keyOf(point.coord)}
                                    className={`point-item ${isSelected(point) ? "selected" : ""}`}
                                    onClick={() => onPointSelect(point.coord, point.normCoord, index)}
                                    onMouseEnter={() => onPointHover(point.coord)}
                                    onMouseLeave={() => onPointHover(null)}
                                >
                                    <div className="point-number">#{index + 1}</div>
                                    <div className="point-info">
                                        <div className="point-coord">{getCoordDisplay(point)}</div>
                                        <div className="point-score">Score: {point.score}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
