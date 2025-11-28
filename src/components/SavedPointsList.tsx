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
    const listRef = React.useRef<HTMLDivElement>(null);

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

    // Create sorted array with indices
    const sortedData = [...points]
        .map((point, idx) => ({ point, idx }))
        .sort((a, b) => {
            if (Math.abs(a.point.coord.x - b.point.coord.x) > 0.00001) {
                return a.point.coord.x - b.point.coord.x;
            }
            const valA = styleSet === "A" ? (a.point.coord.y || 0) : (a.point.coord.z || 0);
            const valB = styleSet === "A" ? (b.point.coord.y || 0) : (b.point.coord.z || 0);
            return valA - valB;
        });

    // Keyboard navigation
    React.useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();

                if (sortedData.length === 0) return;

                const currentIndex = sortedData.findIndex(item => isSelected(item.point));
                let nextIndex = -1;

                if (currentIndex === -1) {
                    nextIndex = 0;
                } else {
                    if (e.key === "ArrowUp") {
                        nextIndex = Math.max(0, currentIndex - 1);
                    } else {
                        nextIndex = Math.min(sortedData.length - 1, currentIndex + 1);
                    }
                }

                if (nextIndex !== -1 && nextIndex !== currentIndex) {
                    const nextItem = sortedData[nextIndex];
                    onPointSelect(nextItem.point.coord, (nextItem.point as any).normCoord, nextItem.idx);

                    const container = listRef.current;
                    if (container) {
                        const itemElement = container.children[nextIndex] as HTMLElement;
                        if (itemElement) {
                            itemElement.scrollIntoView({ block: 'nearest' });
                        }
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, sortedData, selectedCoord, onPointSelect]);

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
                        <div className="points-list" ref={listRef}>
                            {sortedData.map((item, displayIndex) => (
                                <div
                                    key={keyOf(item.point.coord)}
                                    className={`point-item ${isSelected(item.point) ? "selected" : ""}`}
                                    onClick={() => onPointSelect(item.point.coord, (item.point as any).normCoord, item.idx)}
                                    onMouseEnter={() => onPointHover(item.point.coord)}
                                    onMouseLeave={() => onPointHover(null)}
                                >
                                    <div className="point-number">#{displayIndex + 1}</div>
                                    <div className="point-info">
                                        <div className="point-coord">{getCoordDisplay(item.point)}</div>
                                        <div className="point-score">Score: {item.point.score}</div>
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
