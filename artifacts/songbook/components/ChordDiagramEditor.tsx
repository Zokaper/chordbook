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

interface ChordDiagramEditorProps {
  value: Pick<ChordFingering, "strings" | "baseFret" | "barre">;
  onChange: (value: Pick<ChordFingering, "strings" | "baseFret" | "barre">) => void;
  width?: number;
  primaryColor?: string;
  textColor?: string;
  gridColor?: string;
  mutedColor?: string;
}

export function ChordDiagramEditor({
  value,
  onChange,
  width = 260,
  primaryColor = "#e8a043",
  textColor = "#f5ede4",
  gridColor = "#5a3e2c",
  mutedColor = "#e05555",
}: ChordDiagramEditorProps) {
  const { strings, baseFret, barre } = value;

  const layout = useMemo(() => {
    const markerH = 36;
    const topPad = markerH;
    const leftPad = baseFret > 1 ? 30 : 10;
    const rightPad = 10;
    const bottomPad = 10;

    const diagW = width - leftPad - rightPad;
    const stringSpacing = diagW / (NUM_STRINGS - 1);
    const fretH = stringSpacing * 1.3;
    const diagH = fretH * NUM_FRETS;
    const height = topPad + diagH + bottomPad;

    const diagX = leftPad;
    const diagY = topPad;

    const strX = (i: number) => diagX + i * stringSpacing;
    const fretLineY = (f: number) => diagY + f * fretH;
    const dotCY = (relFret: number) => diagY + (relFret - 0.5) * fretH;

    return {
      markerH, topPad, diagX, diagY, diagW, diagH, height,
      stringSpacing, fretH, strX, fretLineY, dotCY, leftPad, rightPad
    };
  }, [width, baseFret]);

  const {
    markerH, topPad, diagX, diagY, diagW, height,
    stringSpacing, fretH, strX, fretLineY, dotCY,
  } = layout;

  const dotR = Math.max(8, stringSpacing * 0.38);
  const cellW = stringSpacing * 0.9;

  const handleStringTap = (i: number) => {
    const newStrings = [...strings] as number[];
    if (newStrings[i] === -1) {
      newStrings[i] = 0; // muted → open
    } else {
      newStrings[i] = -1; // open or fretted → muted
    }
    onChange({ ...value, strings: newStrings });
  };

  const handleCellTap = (stringIdx: number, relFret: number) => {
    const actualFret = baseFret + relFret - 1;
    const newStrings = [...strings] as number[];
    if (newStrings[stringIdx] === actualFret) {
      newStrings[stringIdx] = 0; // toggle off → open
    } else {
      newStrings[stringIdx] = actualFret;
    }
    // Remove muted status if placing a dot
    if (newStrings[stringIdx] > 0) {
      // ensure not muted
    }
    onChange({ ...value, strings: newStrings });
  };

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Fret number if above position 1 */}
        {baseFret > 1 && (
          <SvgText
            x={diagX - 5}
            y={dotCY(1)}
            textAnchor="end"
            fill={textColor}
            fontSize={13}
            alignmentBaseline="middle"
          >
            {baseFret}
          </SvgText>
        )}

        {/* Nut or top line */}
        <Line
          x1={diagX}
          y1={diagY}
          x2={diagX + diagW}
          y2={diagY}
          stroke={textColor}
          strokeWidth={baseFret === 1 ? 5 : 2}
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
            strokeWidth={1.5}
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
            strokeWidth={1.5}
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
            return (
              <Rect
                key="barre"
                x={fromX - dotR * 0.6}
                y={cy - dotR}
                width={toX - fromX + dotR * 1.2}
                height={dotR * 2}
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
          if (
            barre &&
            barre.fret === val &&
            i >= Math.min(barre.from, barre.to) &&
            i <= Math.max(barre.from, barre.to)
          ) return null;
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

        {/* String indicator labels (X / O) */}
        {strings.map((val, i) => {
          const cx = strX(i);
          const cy = topPad / 2;
          if (val === -1) {
            const s = dotR * 0.55;
            return (
              <G key={i}>
                <Line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} stroke={mutedColor} strokeWidth={2.5} strokeLinecap="round" />
                <Line x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s} stroke={mutedColor} strokeWidth={2.5} strokeLinecap="round" />
              </G>
            );
          }
          if (val === 0) {
            return (
              <Circle key={i} cx={cx} cy={cy} r={dotR * 0.55} fill="none" stroke={textColor} strokeWidth={2} />
            );
          }
          return null;
        })}

        {/* Invisible touch targets for string indicators */}
        {strings.map((_, i) => (
          <Rect
            key={`si-${i}`}
            x={strX(i) - cellW / 2}
            y={0}
            width={cellW}
            height={topPad}
            fill="transparent"
            onPress={() => handleStringTap(i)}
          />
        ))}

        {/* Invisible touch targets for fret cells */}
        {Array.from({ length: NUM_FRETS }, (_, rowIdx) =>
          strings.map((_, colIdx) => (
            <Rect
              key={`cell-${rowIdx}-${colIdx}`}
              x={strX(colIdx) - cellW / 2}
              y={fretLineY(rowIdx)}
              width={cellW}
              height={fretH}
              fill="transparent"
              onPress={() => handleCellTap(colIdx, rowIdx + 1)}
            />
          ))
        )}
      </Svg>
    </View>
  );
}
