import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import type { StyleMaster, Coordinate, RankGroup, StyleSetType } from "../types.ts";
import { generateContourPath, keyOf } from "../utils";

interface StyleGraphProps {
  styles: StyleMaster[];
  styleSet: StyleSetType;
  points: Array<{ coord: Coordinate; score: number }>;
  rankGroups: RankGroup[];
  selectedCoord: Coordinate | null;
  hoveredPointCoord: Coordinate | null;
  onCoordinateClick: (normCoord: Coordinate, originalCoord?: Coordinate, index?: number) => void;
  onContourHover?: (rankGroup: RankGroup | null) => void;
  onResetSelection?: () => void;
  isScoreViewMode?: boolean;
}

export const StyleGraph: React.FC<StyleGraphProps> = ({
  styles,
  styleSet,
  points,
  rankGroups,
  selectedCoord,
  hoveredPointCoord,
  onCoordinateClick,
  onContourHover,
  onResetSelection,
  isScoreViewMode = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 600 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGElement, unknown> | null>(null);
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const scalesRef = useRef<{ x: d3.ScaleLinear<number, number>, y: d3.ScaleLinear<number, number> } | null>(null);



  // 반응형 크기 조정
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        // Use the smaller dimension to maintain 1:1 aspect ratio
        const size = Math.min(width, height);
        setDimensions({
          width: size,
          height: size,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Refs for D3 selections to share between effects
  const mainGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const markerGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const axisGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const overlayGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const xScaleOriginalRef = useRef<d3.ScaleLinear<number, number> | null>(null);
  const yScaleOriginalRef = useRef<d3.ScaleLinear<number, number> | null>(null);

  // 1. Setup Effect: Initialize SVG, Zoom, Scales, Groups (Runs on dimensions/styleSet changes)
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    // Smaller margins for maximum graph size
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };

    // Use full container dimensions (already 1:1 from updateDimensions)
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // 기존 SVG 내용 제거
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .style("max-width", "100%")
      .style("max-height", "100%");

    // Define clipPath for the graph area
    const defs = svg.append("defs");
    defs.append("clipPath")
      .attr("id", "graph-area-clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("x", margin.left)
      .attr("y", margin.top);

    // 원본 스케일 (축 범위를 0~1로 고정 - normalized coordinates)
    const xScaleOriginal = d3
      .scaleLinear()
      .domain([0, 1])
      .range([0, width]);

    const yScaleOriginal = d3
      .scaleLinear()
      .domain([0, 1])
      .range([height, 0]);

    scalesRef.current = { x: xScaleOriginal, y: yScaleOriginal };
    xScaleOriginalRef.current = xScaleOriginal;
    yScaleOriginalRef.current = yScaleOriginal;

    // 메인 그룹 (등고선용 - translate + scale 적용) - LAYER 1 (BOTTOM)
    const mainGroup = svg
      .append("g")
      .attr("class", "main-group")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("clip-path", "url(#graph-area-clip)"); // Apply clip path
    mainGroupRef.current = mainGroup;

    // Inactive area overlay group - LAYER 2 (above contours, below markers)
    const overlayGroup = svg
      .append("g")
      .attr("class", "overlay-group")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .style("pointer-events", "none");
    overlayGroupRef.current = overlayGroup;

    // Function to update inactive area overlays based on current view
    const updateOverlays = (xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>) => {
      overlayGroup.selectAll("*").remove();

      const x1 = xScale(-1);
      const x2 = xScale(1);
      const y1 = yScale(1); // y is inverted
      const y2 = yScale(-1);

      // Left overlay (x < -1)
      if (x1 > 0) {
        overlayGroup.append("rect")
          .attr("x", 0)
          .attr("y", 0)
          .attr("width", x1)
          .attr("height", height)
          .attr("fill", "#1f2937")
          .attr("opacity", 0.7);
      }

      // Right overlay (x > 1)
      if (x2 < width) {
        overlayGroup.append("rect")
          .attr("x", x2)
          .attr("y", 0)
          .attr("width", width - x2)
          .attr("height", height)
          .attr("fill", "#1f2937")
          .attr("opacity", 0.7);
      }

      // Top overlay (y > 1)
      if (y1 > 0) {
        overlayGroup.append("rect")
          .attr("x", Math.max(0, x1))
          .attr("y", 0)
          .attr("width", Math.min(width, x2) - Math.max(0, x1))
          .attr("height", y1)
          .attr("fill", "#1f2937")
          .attr("opacity", 0.7);
      }

      // Bottom overlay (y < -1)
      if (y2 < height) {
        overlayGroup.append("rect")
          .attr("x", Math.max(0, x1))
          .attr("y", y2)
          .attr("width", Math.min(width, x2) - Math.max(0, x1))
          .attr("height", height - y2)
          .attr("fill", "#1f2937")
          .attr("opacity", 0.7);
      }
    };

    // 마커 그룹 (마커와 이미지용) - LAYER 3 (above overlay, below axes)
    const markerGroup = svg
      .append("g")
      .attr("class", "marker-group")
      .attr("transform",
        `translate(${margin.left}, ${margin.top}) ` +
        `translate(${currentTransformRef.current.x}, ${currentTransformRef.current.y}) ` +
        `scale(${currentTransformRef.current.k})`
      );
    markerGroupRef.current = markerGroup;

    // 축 그룹 (zoom과 분리) - LAYER 4 (TOP)
    const axisGroup = svg
      .append("g")
      .attr("class", "axis-group")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);
    axisGroupRef.current = axisGroup;

    // Graph Border (Visual 1:1 confirmation) - LAYER 5 (VERY TOP)
    svg.append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "none")
      .attr("stroke", "#374151") // Dark gray border
      .attr("stroke-width", 1)
      .style("pointer-events", "none");

    // Draw all master styles as dots (static)
    const drawAllStyles = () => {
      markerGroup.selectAll(".all-style-dot").remove();

      styles.forEach(style => {
        const normCoord = (style as any).normCoord as Coordinate | undefined;
        if (normCoord && normCoord.x !== undefined) {
          // For Type A, skip styles where normCoord.y is undefined (filtered out, e.g. y=-1)
          if (styleSet === "A" && normCoord.y === undefined) {
            return; // Skip this style
          }
          // For Type B, skip styles where normCoord.z is undefined (filtered out, e.g. z=-1)
          if (styleSet === "B" && normCoord.z === undefined) {
            return; // Skip this style
          }

          const yValue = styleSet === "A" ? (normCoord.y ?? 0) : (normCoord.z ?? 0);
          const x = xScaleOriginal(normCoord.x);
          const y = yScaleOriginal(yValue);

          // Limit size when zoomed (min 4px, max 12px visual diameter)
          const minVisualRadius = 2;
          const maxVisualRadius = 6;
          const minR = minVisualRadius / currentTransformRef.current.k;
          const maxR = maxVisualRadius / currentTransformRef.current.k;
          const maxDataRadius = 0.004; // Reduced for smaller dots
          const dotRadius = Math.max(minR, Math.min(maxDataRadius, maxR));

          markerGroup
            .append("circle")
            .attr("class", "all-style-dot")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", dotRadius)
            .attr("fill", isScoreViewMode ? "#6b7280" : "#fb923c") // Gray in Score View
            .attr("opacity", isScoreViewMode ? 0.3 : 0.7) // More transparent in Score View
            .style("pointer-events", "none");
        }
      });
    };

    // 클릭 영역 (zoom과 분리)
    const clickRect = svg
      .append("rect")
      .attr("class", "click-area")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .style("cursor", "crosshair");

    // 축 그리기 함수
    const drawAxes = (xScale: d3.ScaleLinear<number, number>, yScale: d3.ScaleLinear<number, number>) => {
      axisGroup.selectAll("*").remove();

      const xAxis = d3.axisBottom(xScale)
        .ticks(10)
        .tickSize(-height);

      const xAxisGroup = axisGroup
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis);

      xAxisGroup.selectAll("line").attr("stroke", "#374151").attr("stroke-dasharray", "2,2");
      xAxisGroup.selectAll("path").attr("stroke", "#4b5563").attr("stroke-width", 1.5);
      xAxisGroup.selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#9ca3af")
        .style("font-weight", "500");

      // X축 라벨
      svg.selectAll(".x-axis-label").remove();
      svg
        .append("text")
        .attr("class", "x-axis-label")
        .attr("x", margin.left + width / 2)
        .attr("y", margin.top + height + 40)
        .attr("fill", "#9ca3af")
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .text("PL-LS (선형+Tanh)");

      const yAxis = d3.axisLeft(yScale)
        .ticks(10)
        .tickSize(-width);

      const yAxisGroup = axisGroup
        .append("g")
        .attr("class", "y-axis")
        .call(yAxis);

      yAxisGroup.selectAll("line").attr("stroke", "#374151").attr("stroke-dasharray", "2,2");
      yAxisGroup.selectAll("path").attr("stroke", "#4b5563").attr("stroke-width", 1.5);
      yAxisGroup.selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#9ca3af")
        .style("font-weight", "500");

      // Y축 레이블
      const yAxisLabel = styleSet === "A" ? "비캐 지도값" : "캐 지도값";
      yAxisGroup.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -50)
        .attr("x", -height / 2)
        .attr("fill", "#9ca3af")
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .text(yAxisLabel);

      // Zero Lines
      const xZeroInView = xScale.domain()[0] <= 0 && xScale.domain()[1] >= 0;
      const yZeroInView = yScale.domain()[0] <= 0 && yScale.domain()[1] >= 0;

      if (xZeroInView) {
        axisGroup
          .append("line")
          .attr("class", "zero-line-x")
          .attr("x1", xScale(0))
          .attr("x2", xScale(0))
          .attr("y1", 0)
          .attr("y2", height)
          .attr("stroke", "#4b5563")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "4,4")
          .attr("opacity", 0.2);
      }

      if (yZeroInView) {
        axisGroup
          .append("line")
          .attr("class", "zero-line-y")
          .attr("x1", 0)
          .attr("x2", width)
          .attr("y1", yScale(0))
          .attr("y2", yScale(0))
          .attr("stroke", "#4b5563")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "4,4")
          .attr("opacity", 0.2);
      }
    };

    // Zoom behavior
    const xMin = xScaleOriginal(-0.1);
    const xMax = xScaleOriginal(1.1);
    const yMin = yScaleOriginal(1.1);
    const yMax = yScaleOriginal(-0.1);

    const zoom = d3
      .zoom<SVGElement, unknown>()
      .scaleExtent([0.5, 10000])
      .translateExtent([
        [xMin - width, yMin - height],
        [xMax + width, yMax + height]
      ])
      .on("zoom", (event) => {
        currentTransformRef.current = event.transform;

        // mainGroup에 zoom transform 적용
        mainGroup.attr("transform",
          `translate(${margin.left}, ${margin.top}) ` +
          `translate(${event.transform.x}, ${event.transform.y}) ` +
          `scale(${event.transform.k})`
        );

        // markerGroup에도 mainGroup과 동일한 transform 적용
        markerGroup.attr("transform",
          `translate(${margin.left}, ${margin.top}) ` +
          `translate(${event.transform.x}, ${event.transform.y}) ` +
          `scale(${event.transform.k})`
        );

        // 줌 transform이 적용된 스케일 사용
        const xScale = event.transform.rescaleX(xScaleOriginal);
        const yScale = event.transform.rescaleY(yScaleOriginal);

        // Update dynamic elements
        const minDotVisualRadius = 2;
        const maxDotVisualRadius = 6;
        const minDotR = minDotVisualRadius / event.transform.k;
        const maxDotR = maxDotVisualRadius / event.transform.k;
        const maxDataRadius = 0.004; // Reduced for smaller dots
        const dotRadius = Math.max(minDotR, Math.min(maxDataRadius, maxDotR));

        markerGroup.selectAll(".all-style-dot")
          .attr("r", dotRadius);

        const minVisualSize = 8;
        const maxVisualSize = 12;
        const maxDataSize = 0.08;
        const targetVisualSize = Math.max(minVisualSize, Math.min(maxVisualSize, maxDataSize * event.transform.k));
        const imageSize = targetVisualSize / event.transform.k;
        const clipRadius = imageSize;

        markerGroup.selectAll(".style-bg")
          .attr("r", clipRadius)
          .attr("stroke-width", 2 / event.transform.k);

        markerGroup.selectAll(".style-image")
          .attr("x", -clipRadius)
          .attr("y", -clipRadius)
          .attr("width", clipRadius * 2)
          .attr("height", clipRadius * 2);

        svg.selectAll(".style-clip-circle")
          .attr("r", clipRadius);

        markerGroup.selectAll(".contour-group path")
          .attr("stroke-width", 2.5 / event.transform.k);

        markerGroup.selectAll(".saved-point-marker")
          .attr("stroke-width", 2 / event.transform.k);

        markerGroup.select(".click-marker")
          .attr("r", 10 / event.transform.k)
          .attr("stroke-width", 3 / event.transform.k);

        markerGroup.select(".click-marker-inner")
          .attr("r", 5 / event.transform.k);

        markerGroup.selectAll(".saved-point-score")
          .attr("font-size", `${14 / event.transform.k}px`)
          .attr("x", (d: any) => {
            const normCoord = (d as any).normCoord as Coordinate || d.coord;
            const x = normCoord.x;
            return xScaleOriginal(x) + (12 / event.transform.k);
          })
          .attr("y", (d: any) => {
            const normCoord = (d as any).normCoord as Coordinate || d.coord;
            const y = styleSet === "A" ? (normCoord.y ?? 0) : (normCoord.z ?? 0);
            return yScaleOriginal(y) + (4 / event.transform.k);
          });

        drawAxes(xScale, yScale);
        updateOverlays(xScale, yScale);
      });

    zoomRef.current = zoom;
    svg.on("wheel.zoom", null);
    svg.call(zoom as any);

    // Custom wheel event
    svg.on("wheel", function (event) {
      event.preventDefault();
      const [svgX, svgY] = d3.pointer(event, svg.node() as any);
      const mouseX = svgX - margin.left;
      const mouseY = svgY - margin.top;
      const currentK = currentTransformRef.current.k;
      const delta = -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode === 2 ? 1 : 0.002);
      const newK = Math.max(0.5, Math.min(10000, currentK * Math.pow(2, delta / 300)));
      const newX = mouseX - (mouseX - currentTransformRef.current.x) * (newK / currentK);
      const newY = mouseY - (mouseY - currentTransformRef.current.y) * (newK / currentK);
      const newTransform = d3.zoomIdentity.translate(newX, newY).scale(newK);
      svg.transition().duration(50).call(zoom.transform as any, newTransform);
    });

    // Touch events (Pinch)
    let touchStartDistance = 0;
    let touchStartTransform = d3.zoomIdentity;

    svg.on("touchstart", function (event) {
      if (event.touches.length === 2) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        touchStartDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        touchStartTransform = currentTransformRef.current;
      }
    });

    svg.on("touchmove", function (event) {
      if (event.touches.length === 2) {
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const rect = svg.node()?.getBoundingClientRect();
        if (!rect) return;
        const svgX = centerX - rect.left;
        const svgY = centerY - rect.top;
        const mouseX = svgX - margin.left;
        const mouseY = svgY - margin.top;
        const scaleRatio = currentDistance / touchStartDistance;
        const newK = Math.max(0.5, Math.min(10000, touchStartTransform.k * scaleRatio));
        const newX = mouseX - (mouseX - touchStartTransform.x) * (newK / touchStartTransform.k);
        const newY = mouseY - (mouseY - touchStartTransform.y) * (newK / touchStartTransform.k);
        const newTransform = d3.zoomIdentity.translate(newX, newY).scale(newK);
        svg.call(zoom.transform as any, newTransform);
      }
    });

    // Click event
    clickRect.on("click", function (event) {
      const [svgX, svgY] = d3.pointer(event, svg.node() as any);
      const mouseX = svgX - margin.left;
      const mouseY = svgY - margin.top;
      const localX = (mouseX - currentTransformRef.current.x) / currentTransformRef.current.k;
      const localY = (mouseY - currentTransformRef.current.y) / currentTransformRef.current.k;
      const x = xScaleOriginal.invert(localX);
      const y = yScaleOriginal.invert(localY);

      const clickThreshold = 20 / currentTransformRef.current.k; // 20px threshold in screen coordinates
      let closestPointIndex = -1;
      let minDistance = Infinity;

      points.forEach((p, i) => {
        const normCoord = (p as any).normCoord as Coordinate || p.coord;
        const px = xScaleOriginal(normCoord.x);
        const py = yScaleOriginal(styleSet === "A" ? (normCoord.y ?? 0) : (normCoord.z ?? 0));

        const dist = Math.hypot(px - localX, py - localY);
        if (dist < minDistance) {
          minDistance = dist;
          closestPointIndex = i;
        }
      });

      if (closestPointIndex !== -1 && minDistance <= clickThreshold) {
        const p = points[closestPointIndex];
        const normCoord = (p as any).normCoord as Coordinate || p.coord;
        onCoordinateClick(normCoord, p.coord, closestPointIndex);
        return;
      }

      if (x < 0 || x > 1 || y < 0 || y > 1) return;

      const coord: Coordinate = { x };
      if (styleSet === "A") {
        coord.y = y;
      } else {
        coord.z = y;
      }
      onCoordinateClick(coord);
    });

    // Initial draw
    drawAllStyles();
    drawAxes(xScaleOriginal, yScaleOriginal);
    updateOverlays(xScaleOriginal, yScaleOriginal);

  }, [dimensions, styleSet, styles, isScoreViewMode, points]); // Only re-run when dimensions or styleSet/styles/points change

  // 2. Content Effect: Draw dynamic content (Contours, Markers, Saved Points)
  useEffect(() => {
    if (!markerGroupRef.current || !xScaleOriginalRef.current || !yScaleOriginalRef.current || !svgRef.current) return;

    const markerGroup = markerGroupRef.current;
    const xScaleOriginal = xScaleOriginalRef.current;
    const yScaleOriginal = yScaleOriginalRef.current;
    const currentTransform = currentTransformRef.current;

    // Draw Contours
    markerGroup.selectAll(".contour-group").remove();
    if (rankGroups && rankGroups.length > 0 && selectedCoord) {
      const normSelectedCoord = selectedCoord;
      rankGroups.forEach((group) => {
        const path = generateContourPath(group.styles, styleSet, normSelectedCoord);
        if (!path || path.length === 0) return;
        const color = d3.hsl((group.rank * 60) % 360, 0.7, 0.5).toString();
        const line = d3.line<[number, number]>()
          .x(d => d[0])
          .y(d => d[1])
          .curve(d3.curveBasisClosed);

        const contourGroup = markerGroup.append("g").attr("class", "contour-group");
        contourGroup.append("path")
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2.5 / currentTransform.k)
          .attr("stroke-opacity", 0.6)
          .attr("d", line(path.map(p => [xScaleOriginal(p.x), yScaleOriginal(p.y)])))
          .style("cursor", "pointer")
          .on("mouseenter", () => {
            onContourHover?.(group);
            d3.select(contourGroup.node() as any).select("path")
              .attr("stroke-width", 3.5 / currentTransform.k)
              .attr("stroke-opacity", 0.9);
          })
          .on("mouseleave", () => {
            onContourHover?.(null);
            d3.select(contourGroup.node() as any).select("path")
              .attr("stroke-width", 2.5 / currentTransform.k)
              .attr("stroke-opacity", 0.6);
          });
      });
    }

    // Draw Style Images (Top 5)
    markerGroup.selectAll("g[class^='style-marker-']").remove();
    rankGroups.forEach((group) => {
      if (!group.styles || group.styles.length === 0) return;
      group.styles.slice(0, 5).forEach((style) => {
        const normCoord = (style as any).normCoord as Coordinate | undefined;
        if (!normCoord) return;
        const x = normCoord.x;
        const y = styleSet === "A" ? (normCoord.y ?? 0) : (normCoord.z ?? 0);
        const screenX = xScaleOriginal(x);
        const screenY = yScaleOriginal(y);
        const clipId = `image-clip-${style.style_id}-${group.rank}`;

        let defs = d3.select(svgRef.current).select("defs");
        let clipPath = defs.select<SVGClipPathElement>(`#${clipId}`);
        if (clipPath.empty()) {
          clipPath = defs.append("clipPath").attr("id", clipId);
          clipPath.append("circle").attr("class", "style-clip-circle");
        }

        const minVisualSize = 8;
        const maxVisualSize = 12;
        const maxDataSize = 0.08;
        const targetVisualSize = Math.max(minVisualSize, Math.min(maxVisualSize, maxDataSize * currentTransform.k));
        const imageSize = targetVisualSize / currentTransform.k;
        const clipRadius = imageSize;
        clipPath.select("circle").attr("r", clipRadius);

        const styleGroup = markerGroup.append("g")
          .attr("class", `style-marker-${style.style_id}`)
          .attr("transform", `translate(${screenX}, ${screenY})`)
          .style("cursor", "pointer")
          .on("mouseenter", () => onContourHover?.(group))
          .on("mouseleave", () => onContourHover?.(null));

        styleGroup.append("circle")
          .attr("class", "style-bg")
          .attr("r", imageSize)
          .attr("fill", "#e5e7eb")
          .attr("stroke", "#fff")
          .attr("stroke-width", 2 / currentTransform.k);

        styleGroup.append("image")
          .attr("class", "style-image")
          .attr("href", style.full_image_url)
          .attr("x", -imageSize)
          .attr("y", -imageSize)
          .attr("width", imageSize * 2)
          .attr("height", imageSize * 2)
          .attr("clip-path", `url(#${clipId})`)
          .style("opacity", 0.9)
          .on("error", function () { d3.select(this).style("display", "none"); });
      });
    });

    // Draw Clicked Marker
    markerGroup.select(".click-marker").remove();
    markerGroup.select(".click-marker-inner").remove();
    if (selectedCoord) {
      const normCoord = selectedCoord;
      const x = normCoord.x;
      const y = styleSet === "A" ? (normCoord.y ?? 0) : (normCoord.z ?? 0);
      const localX = xScaleOriginal(x);
      const localY = yScaleOriginal(y);

      markerGroup.append("circle")
        .attr("class", "click-marker")
        .attr("cx", localX)
        .attr("cy", localY)
        .attr("r", 10 / currentTransform.k)
        .attr("fill", "none")
        .attr("stroke", "#60a5fa")
        .attr("stroke-width", 3 / currentTransform.k)
        .style("pointer-events", "none");

      markerGroup.append("circle")
        .attr("class", "click-marker-inner")
        .attr("cx", localX)
        .attr("cy", localY)
        .attr("r", 5 / currentTransform.k)
        .attr("fill", "#60a5fa")
        .style("pointer-events", "none");
    }

    // Draw Saved Points
    markerGroup.selectAll(".saved-point-marker").remove();
    markerGroup.selectAll(".saved-point-score").remove();

    points.forEach((p, i) => {
      const normCoord = (p as any).normCoord as Coordinate || p.coord;
      const x = normCoord.x;
      const y = styleSet === "A" ? (normCoord.y ?? 0) : (normCoord.z ?? 0);
      const isHovered = hoveredPointCoord && keyOf(p.coord) === keyOf(hoveredPointCoord);
      const normalRadius = Math.min(Math.max(6 / currentTransform.k, 0.008), 10 / currentTransform.k);
      const hoverRadius = Math.min(Math.max(8 / currentTransform.k, 0.012), 14 / currentTransform.k);

      let pointFill = isHovered ? "#f59e0b" : "#ef4444";
      let pointStroke = isHovered ? "#d97706" : "#dc2626";
      let scoreColor = "";

      // Helper for score color (Rainbow: 100=Red -> 0=Violet)
      const getScoreColor = (score: number) => {
        if (score >= 80) {
          // 80-100: 주황 -> 빨강
          return d3.interpolateRgb("#f97316", "#ef4444")((score - 80) / 20);
        } else if (score >= 60) {
          // 60-80: 노랑 -> 주황
          return d3.interpolateRgb("#eab308", "#f97316")((score - 60) / 20);
        } else if (score >= 40) {
          // 40-60: 초록 -> 노랑
          return d3.interpolateRgb("#22c55e", "#eab308")((score - 40) / 20);
        } else if (score >= 20) {
          // 20-40: 파랑 -> 초록
          return d3.interpolateRgb("#3b82f6", "#22c55e")((score - 20) / 20);
        } else {
          // 0-20: 보라 -> 파랑
          return d3.interpolateRgb("#a855f7", "#3b82f6")(score / 20);
        }
      };

      if (isScoreViewMode) {
        scoreColor = getScoreColor(p.score);
        pointFill = scoreColor;
        pointStroke = d3.rgb(scoreColor).darker(0.5).toString();
      }

      markerGroup.append("circle")
        .attr("class", "saved-point-marker")
        .attr("cx", xScaleOriginal(x))
        .attr("cy", yScaleOriginal(y))
        .attr("r", isHovered ? hoverRadius : normalRadius)
        .attr("fill", pointFill)
        .attr("stroke", pointStroke)
        .attr("stroke-width", 2 / currentTransform.k)
        .attr("opacity", 0.9)
        .style("cursor", "pointer")
        .on("click", (event) => {
          event.stopPropagation();
          onCoordinateClick(normCoord, p.coord, i);
        })
        .append("title")
        .text(`점수: ${p.score} `);

      if (isScoreViewMode) {
        markerGroup.append("text")
          .datum(p) // Bind data for zoom updates
          .attr("class", "saved-point-score")
          .attr("x", xScaleOriginal(x) + (12 / currentTransform.k))
          .attr("y", yScaleOriginal(y) + (4 / currentTransform.k))
          .text(p.score)
          .attr("font-size", `${14 / currentTransform.k}px`)
          .attr("font-weight", "bold")
          .attr("fill", scoreColor)
          .style("pointer-events", "auto")
          .style("cursor", "pointer")
          .style("text-shadow", "0px 0px 3px rgba(0,0,0,0.8)")
          .on("click", (event) => {
            event.stopPropagation();
            onCoordinateClick(normCoord, p.coord, i);
          });
      }
    });

    // Auto-zoom when rankGroups change (only if selectedCoord exists)
    if (selectedCoord && rankGroups.length > 0 && zoomRef.current) {
      // This part needs to be careful not to conflict with user interactions
      // We only want to auto-zoom on NEW selection, not just any render
      // But since selectedCoord changes on new selection, this is fine.
      // However, we should probably check if we are already zoomed?
      // For now, keep original logic but be aware it runs on every render if dependencies change.
      // Actually, we should probably move this to a separate effect or keep it here.
      // Original logic:
      const normSelectedCoord = selectedCoord;
      const maxDistance = Math.max(...rankGroups.map(g => g.distance));
      if (maxDistance > 0) {
        const width = dimensions.width - 80; // approx
        const height = dimensions.height - 80;
        const baseRadiusPx = xScaleOriginal(maxDistance) - xScaleOriginal(0);
        const targetRadiusPx = Math.min(width, height) / 2.5;
        let targetK = targetRadiusPx / baseRadiusPx;
        targetK = Math.max(0.5, Math.min(10000, targetK));

        const centerX = xScaleOriginal(normSelectedCoord.x);
        const centerY = yScaleOriginal(styleSet === "A" ? (normSelectedCoord.y ?? 0) : (normSelectedCoord.z ?? 0));
        const tx = dimensions.width / 2 - centerX * targetK; // Using full width for center
        const ty = dimensions.height / 2 - centerY * targetK;

        // Only zoom if we are not already close to that state? 
        // Or just let it happen. It's a transition.
        // NOTE: If this effect runs on Reset (selectedCoord becomes null), this block is skipped.
        // So Reset animation works.

        // One issue: if we click a point, selectedCoord changes -> Effect runs -> Zoom happens.
        // This is desired.

        const newTransform = d3.zoomIdentity.translate(tx, ty).scale(targetK);
        d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform as any, newTransform);
      }
    }

  }, [points, rankGroups, selectedCoord, hoveredPointCoord, styleSet, dimensions, isScoreViewMode]); // Content dependencies

  // Zoom to hovered point
  useEffect(() => {
    if (hoveredPointCoord && zoomRef.current && svgRef.current && scalesRef.current) {
      const x = hoveredPointCoord.x;
      const y = styleSet === "A" ? (hoveredPointCoord.y ?? 0) : (hoveredPointCoord.z ?? 0);

      const targetX = scalesRef.current.x(x);
      const targetY = scalesRef.current.y(y);

      const scale = 8; // Fixed zoom level for hover
      // width/height are not available here directly, use dimensions with margin adjustment
      const margin = { top: 20, right: 20, bottom: 60, left: 60 };
      const graphWidth = dimensions.width - margin.left - margin.right;
      const graphHeight = dimensions.height - margin.top - margin.bottom;

      const translate = [graphWidth / 2 - targetX * scale, graphHeight / 2 - targetY * scale];

      d3.select(svgRef.current)
        .transition()
        .duration(500) // Faster transition for hover
        .call(
          zoomRef.current.transform as any,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    }
  }, [hoveredPointCoord, styleSet, dimensions]);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const centerX = dimensions.width / 2 - 60; // margin 제외한 중심
    const centerY = dimensions.height / 2 - 40;

    const currentTransform = currentTransformRef.current;
    const currentK = currentTransform.k;
    const newK = Math.min(10000, currentK * 1.5);

    const newX = centerX - (centerX - currentTransform.x) * (newK / currentK);
    const newY = centerY - (centerY - currentTransform.y) * (newK / currentK);

    const newTransform = d3.zoomIdentity
      .translate(newX, newY)
      .scale(newK);

    svg.transition()
      .duration(200)
      .call(zoomRef.current.transform as any, newTransform);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const centerX = dimensions.width / 2 - 60;
    const centerY = dimensions.height / 2 - 40;

    const currentTransform = currentTransformRef.current;
    const currentK = currentTransform.k;
    const newK = Math.max(0.5, currentK / 1.5);

    const newX = centerX - (centerX - currentTransform.x) * (newK / currentK);
    const newY = centerY - (centerY - currentTransform.y) * (newK / currentK);

    const newTransform = d3.zoomIdentity
      .translate(newX, newY)
      .scale(newK);

    svg.transition()
      .duration(200)
      .call(zoomRef.current.transform as any, newTransform);
  };

  const handleZoomReset = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(300)
      .call(zoomRef.current.transform as any, d3.zoomIdentity);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {/* Help text - moved to top-right */}
      <div style={{
        position: "absolute",
        top: "0",
        right: "0",
        fontSize: "12px",
        color: "#9ca3af",
        background: "rgba(0, 0, 0, 0.6)",
        padding: "8px 12px",
        borderRadius: "0 0 0 6px",
        pointerEvents: "none",
        zIndex: 5
      }}>
        마우스 휠: 확대/축소 | 드래그: 이동
      </div>

      <svg ref={svgRef} style={{ display: "block" }} />

      {/* 확대/축소 컨트롤 버튼 - Moved to bottom right */}
      <div style={{
        position: "absolute",
        bottom: "30px", // Changed from top to bottom
        right: "30px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: 10,
      }}>
        <button
          onClick={handleZoomIn}
          style={{
            width: "40px",
            height: "40px",
            backgroundColor: "#1f1f1f",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            color: "#e5e5e5",
            fontSize: "20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#2a2a2a";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#1f1f1f";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
          }}
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            width: "40px",
            height: "40px",
            backgroundColor: "#1f1f1f",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            color: "#e5e5e5",
            fontSize: "20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#2a2a2a";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#1f1f1f";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
          }}
        >
          −
        </button>
        <button
          onClick={handleZoomReset}
          style={{
            width: "40px",
            height: "40px",
            backgroundColor: "#1f1f1f",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            color: "#e5e5e5",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#2a2a2a";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#1f1f1f";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
          }}
        >
          ⌂
        </button>
      </div>
    </div>
  );
};
