import React, { useMemo } from "react";
import { View } from "react-native";
import {
  Circle,
  G,
  Line,
  Rect,
  Svg,
  Text as SvgText,
} from "react-native-svg";

import { ChordFingering } from "@/context/ChordContext";

const NUM_FRETS = 4;
const NUM_STRINGS = 6;

interface ChordDiagramProps {
  chord: Pick<ChordFingering, "strings" | "baseFret" | "barre" | "name">;
  width?: number;
  showLabel?: boolean;
  primaryColor?: string;
  textColor?: string;
  gridColor?: string;
}

export function ChordDiagram({
  chord,
  width = 100,
  showLabel = true,
  primaryColor = "#e8a043",
  textColor = "#f5ede4",
  gridColor = "#6b5040",
}: ChordDiagramProps) {
  const { strings, baseFret, barre, name } = chord;

  const layout = useMemo(() => {
    const labelH = showLabel ? 20 : 0;
    const markerH = 18;
    const topPad = labelH + markerH;
    const leftPad = baseFret > 1 ? 22 : 6;
    const rightPad = 6;
    const bottomPad = 6;

    const diagW = width - leftPad - rightPad;
    const stringSpacing = diagW / (NUM_STRINGS - 1);
    const fretH = stringSpacing * 1.25;
    const diagH = fretH * NUM_FRETS;
    const height = topPad + diagH + bottomPad;

    const diagX = leftPad;
    const diagY = topPad;

    const strX = (i: number) => diagX + i * stringSpacing;
    const fretLineY = (f: number) => diagY + f * fretH;
    const dotCY = (relFret: number) => diagY + (relFret - 0.5) * fretH;

    return { labelH, markerH, topPad, diagX, diagY, diagW, diagH, height, stringSpacing, fretH, strX, fretLineY, dotCY };
  }, [width, baseFret, showLabel]);

  const { labelH, topPad, diagX, diagY, diagW, height, stringSpacing, fretH, strX, fretLineY, dotCY } = layout;

  const dotR = Math.max(5, stringSpacing * 0.36);

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Chord name label */}
        {showLabel && (
          <SvgText
            x={width / 2}
            y={labelH - 4}
            textAnchor="middle"
            fill={textColor}
            fontSize={Math.max(12, width * 0.13)}
            fontWeight="bold"
          >
            {name}
          </SvgText>
        )}

        {/* Fret number if above open position */}
        {baseFret > 1 && (
          <SvgText
            x={diagX - 4}
            y={dotCY(1)}
            textAnchor="end"
            fill={textColor}
            fontSize={Math.max(9, width * 0.09)}
            alignmentBaseline="middle"
          >
            {baseFret}
          </SvgText>
        )}

        {/* String indicators (X / O) */}
        {strings.map((val, i) => {
          const cx = strX(i);
          const cy = topPad - 9;
          if (val === -1) {
            const s = Math.max(5, stringSpacing * 0.28);
            return (
              <G key={i}>
                <Line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} stroke={textColor} strokeWidth={1.5} strokeLinecap="round" />
                <Line x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s} stroke={textColor} strokeWidth={1.5} strokeLinecap="round" />
              </G>
            );
          }
          if (val === 0) {
            return (
              <Circle key={i} cx={cx} cy={cy} r={Math.max(4, stringSpacing * 0.28)} fill="none" stroke={textColor} strokeWidth={1.5} />
            );
          }
          return null;
        })}

        {/* Nut (thick top line) or regular top line */}
        <Line
          x1={diagX}
          y1={diagY}
          x2={diagX + diagW}
          y2={diagY}
          stroke={textColor}
          strokeWidth={baseFret === 1 ? 4 : 1.5}
          strokeLinecap="round"
        />

        {/* Fret lines */}
        {Array.from({ length: NUM_FRETS }, (_, f) => (
          <Line
            key={f}
            x1={diagX}
            y1={fretLineY(f + 1)}
            x2={diagX + diagW}
            y2={fretLineY(f + 1)}
            stroke={gridColor}
            strokeWidth={1}
          />
        ))}

        {/* String lines */}
        {strings.map((_, i) => (
          <Line
            key={i}
            x1={strX(i)}
            y1={diagY}
            x2={strX(i)}
            y2={fretLineY(NUM_FRETS)}
            stroke={gridColor}
            strokeWidth={1}
          />
        ))}

        {/* Barre */}
        {barre &&
          barre.fret >= baseFret &&
          barre.fret < baseFret + NUM_FRETS && (() => {
            const relFret = barre.fret - baseFret + 1;
            const fromX = strX(Math.min(barre.from, barre.to));
            const toX = strX(Math.max(barre.from, barre.to));
            const cy = dotCY(relFret);
            const barreH = dotR * 2;
            return (
              <Rect
                key="barre"
                x={fromX - dotR * 0.5}
                y={cy - dotR}
                width={toX - fromX + dotR}
                height={barreH}
                rx={dotR}
                fill={primaryColor}
              />
            );
          })()}

        {/* Finger dots */}
        {strings.map((val, i) => {
          if (val <= 0) return null;
          const relFret = val - baseFret + 1;
          if (relFret < 1 || relFret > NUM_FRETS) return null;
          // Skip if covered by barre (same fret, within barre range)
          if (
            barre &&
            barre.fret === val &&
            i >= Math.min(barre.from, barre.to) &&
            i <= Math.max(barre.from, barre.to)
          ) {
            return null;
          }
          return (
            <Circle
              key={i}
              cx={strX(i)}
              cy={dotCY(relFret)}
              r={dotR}
              fill={primaryColor}
            />
          );
        })}
      </Svg>
    </View>
  );
}
