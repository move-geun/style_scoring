import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import type { RankGroup } from "../types.ts";

interface RecommendedStylesPanelProps {
  rankGroups: RankGroup[];
  hoveredRankGroup: RankGroup | null;
}

export interface RecommendedStylesPanelRef {
  scrollToTop: () => void;
}

export const RecommendedStylesPanel = forwardRef<RecommendedStylesPanelRef, RecommendedStylesPanelProps>(({
  rankGroups,
  hoveredRankGroup,
}, ref) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      // Find the sidebar-content parent element which is the actual scrollable container
      if (scrollContainerRef.current) {
        const sidebarContent = scrollContainerRef.current.closest('.sidebar-content');
        if (sidebarContent) {
          sidebarContent.scrollTop = 0;
        }
      }
    },
  }));

  const displayGroups = hoveredRankGroup ? [hoveredRankGroup] : rankGroups.slice(0, 5);

  // 디버깅: rankGroups 변경 감지
  useEffect(() => {
    console.log("RecommendedStylesPanel - rankGroups updated:", rankGroups);
    console.log("displayGroups:", displayGroups);
  }, [rankGroups, displayGroups]);

  return (
    <div className="recommended-panel" ref={scrollContainerRef}>
      {/* <h3 className="panel-title">추천 스타일</h3> - Removed as per feedback */}
      {displayGroups.length === 0 ? (
        <div className="empty-state">
          <p>그래프를 클릭하여 추천 스타일을 확인하세요.</p>
        </div>
      ) : (
        <div className="rank-groups">
          {displayGroups.map((group, index) => {
            const hue = (group.rank * 60) % 360;
            const color = `hsl(${hue}, 70%, 50%)`;

            return (
              <div key={`${group.rank}-${group.styles.length}-${index}`} className="rank-group">
                <div className="rank-header" style={{ borderLeftColor: color }}>
                  <span className="rank-number">{group.rank}</span>
                  <span className="rank-label">순위</span>
                  <span className="rank-meta">
                    거리: {group.distance.toFixed(5)} · {group.styles.length}개
                  </span>
                </div>
                <div className="styles-grid">
                  {group.styles.slice(0, 5).map((style) => {
                    return (
                      <div
                        key={style.style_id}
                        className="style-card"
                      >
                        <div className="style-image-wrapper">
                          <img
                            src={style.full_image_url}
                            alt={`Style ${style.style_id}`}
                            className="style-image"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23374151' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
                            }}
                          />
                        </div>
                        <div className="style-info">
                          <span className="style-id">ID: {style.style_id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`
        .recommended-panel {
          height: 100%;
          overflow-y: auto;
        }
        
        .panel-title {
          margin: 0 0 24px 0;
          font-size: 20px;
          font-weight: 700;
          color: #e5e5e5;
          letter-spacing: -0.3px;
        }
        
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: #9ca3af;
          font-size: 14px;
        }
        
        .rank-groups {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .rank-group {
          background: #1f1f1f;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .rank-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          border-left: 4px solid;
          padding-left: 12px;
        }
        
        .rank-number {
          font-size: 24px;
          font-weight: 700;
          color: #e5e5e5;
        }
        
        .rank-label {
          font-size: 14px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .rank-meta {
          margin-left: auto;
          font-size: 12px;
          color: #6b7280;
        }
        
        .styles-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
        }
        
        .style-card {
          position: relative;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 10px;
          background: #1a1a1a;
          transition: all 0.2s;
          overflow: hidden;
        }
        
        .style-image-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          background: #2a2a2a;
        }
        
        .style-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        
        .style-info {
          margin-top: 10px;
          text-align: center;
        }
        
        .style-id {
          font-size: 12px;
          font-weight: 600;
          color: #9ca3af;
          letter-spacing: 0.3px;
        }
      `}</style>
    </div>
  );
});
