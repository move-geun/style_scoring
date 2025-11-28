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

    // Sort points: X primary, Y (or Z) secondary
    // We map to { point, originalIndex } to preserve the original index for callbacks
    const sortedPoints = React.useMemo(() => {
        return points
            .map((point, index) => ({ point, originalIndex: index }))
            .sort((a, b) => {
                // Primary: X coordinate
                if (Math.abs(a.point.coord.x - b.point.coord.x) > 0.00001) {
                    return a.point.coord.x - b.point.coord.x;
                }
                // Secondary: Y or Z coordinate
                const valA = styleSet === "A" ? (a.point.coord.y || 0) : (a.point.coord.z || 0);
                const valB = styleSet === "A" ? (b.point.coord.y || 0) : (b.point.coord.z || 0);
                return valA - valB;
            });
    }, [points, styleSet]);

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

    // Keyboard navigation
    React.useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault(); // Prevent page scroll

                if (sortedPoints.length === 0) return;

                // Find current selected index in the SORTED list
                const currentSortedIndex = sortedPoints.findIndex(item => isSelected(item.point));

                let nextSortedIndex = -1;

                if (currentSortedIndex === -1) {
                    // If nothing selected, select first item on ArrowDown, or last on ArrowUp?
                    // Usually select first item is a safe bet for either if nothing is selected.
                    nextSortedIndex = 0;
                } else {
                    if (e.key === "ArrowUp") {
                        nextSortedIndex = Math.max(0, currentSortedIndex - 1);
                    } else {
                        nextSortedIndex = Math.min(sortedPoints.length - 1, currentSortedIndex + 1);
                    }
                }

                if (nextSortedIndex !== -1 && nextSortedIndex !== currentSortedIndex) {
                    const nextItem = sortedPoints[nextSortedIndex];
                    onPointSelect(nextItem.point.coord, nextItem.point.normCoord, nextItem.originalIndex);

                    // Scroll into view logic could go here if needed, 
                    // but simple implementation relies on browser's default behavior or user scrolling.
                    // For better UX, we can manually scroll the container.
                    const container = listRef.current;
                    if (container) {
                        const itemElement = container.children[nextSortedIndex] as HTMLElement;
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
    }, [isOpen, sortedPoints, selectedCoord, onPointSelect]);

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
                            {sortedPoints.map(({ point, originalIndex }, sortedIndex) => (
                                <div
                                    key={keyOf(point.coord)}
                                    className={`point-item ${isSelected(point) ? "selected" : ""}`}
                                    onClick={() => onPointSelect(point.coord, point.normCoord, originalIndex)}
                                    onMouseEnter={() => onPointHover(point.coord)}
                                    onMouseLeave={() => onPointHover(null)}
                                >
                                    <div className="point-number">#{sortedIndex + 1}</div>
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
