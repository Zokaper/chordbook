/**
 * ChordDiagramEditor — cross-platform interactive chord diagram
 *
 * Two layers stacked absolutely:
 *  1. SVG at the bottom — draws everything (grid, dots, ghost dot, labels)
 *  2. Pressable cells on top — transparent, capture all touches
 *
 * No `pointerEvents` style / prop needed: Pressables rendered last are
 * highest in z-order and receive all touches; the SVG below is purely visual.
 */
import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
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
const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];

interface Props {
  value: Pick<ChordFingering, "strings" | "baseFret" | "barre">;
  onChange: (v: Pick<ChordFingering, "strings" | "baseFret" | "barre">) => void;
  width?: number;
  primaryColor?: string;
  textColor?: string;
  gridColor?: string;
  mutedColor?: string;
}

export function ChordDiagramEditor({
  value,
  onChange,
  width = 290,
  primaryColor = "#e8a043",
  textColor = "#f5ede4",
  gridColor = "#5a3e2c",
  mutedColor = "#e05555",
}: Props) {
  const { strings, baseFret, barre } = value;
  const [pressedCell, setPressedCell] = useState<string | null>(null);

  const L = useMemo(() => {
    const nameLabelH = 18;
    const markerH = 38;
    const topPad = nameLabelH + markerH;
    const leftPad = baseFret > 1 ? 32 : 18;
    const rightPad = 18;
    const bottomPad = 12;
    const diagW = width - leftPad - rightPad;
    const sp = diagW / (NUM_STRINGS - 1);
    const fretH = Math.round(sp * 1.45);
    const totalH = topPad + fretH * NUM_FRETS + bottomPad;
    // Cap so dots don't crowd each other at large widths
    const dotR = Math.max(9, Math.min(sp * 0.36, 16));
    const strX = (i: number) => leftPad + i * sp;
    const fretLineY = (f: number) => topPad + f * fretH;
    const dotCY = (rel: number) => topPad + (rel - 0.5) * fretH;
    return { nameLabelH, markerH, topPad, leftPad, rightPad, diagW, sp, fretH, totalH, dotR, strX, fretLineY, dotCY };
  }, [width, baseFret]);

  const { nameLabelH, markerH, topPad, leftPad, diagW, sp, fretH, totalH, dotR, strX, fretLineY, dotCY } = L;

  const toggleString = (i: number) => {
    const next = [...strings] as number[];
    next[i] = next[i] === -1 ? 0 : -1;
    onChange({ ...value, strings: next });
  };

  const toggleFret = (col: number, relRow: number) => {
    const actual = baseFret + relRow - 1;
    const next = [...strings] as number[];
    next[col] = next[col] === actual ? 0 : actual;
    onChange({ ...value, strings: next });
  };

  // Ghost dot info from pressedCell key "row-col"
  const ghostInfo = pressedCell
    ? { row: parseInt(pressedCell.split("-")[0], 10), col: parseInt(pressedCell.split("-")[1], 10) }
    : null;

  return (
    <View style={{ width, height: totalH }}>

      {/* ── Visual layer: all drawing happens here ─────────────────────── */}
      <Svg
        width={width}
        height={totalH}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* String name labels */}
        {STRING_NAMES.map((n, i) => (
          <SvgText
            key={`lbl-${i}`}
            x={strX(i)} y={nameLabelH * 0.72}
            textAnchor="middle" alignmentBaseline="middle"
            fill={textColor} fontSize={11} fontWeight="600" opacity={0.55}
          >
            {n}
          </SvgText>
        ))}

        {/* Fret position number */}
        {baseFret > 1 && (
          <SvgText
            x={leftPad - 8} y={dotCY(1)}
            textAnchor="end" alignmentBaseline="middle"
            fill={textColor} fontSize={13}
          >
            {baseFret}
          </SvgText>
        )}

        {/* Nut */}
        <Line
          x1={leftPad} y1={topPad}
          x2={leftPad + diagW} y2={topPad}
          stroke={textColor}
          strokeWidth={baseFret === 1 ? 5 : 2}
          strokeLinecap="round"
        />

        {/* Fret lines */}
        {Array.from({ length: NUM_FRETS }, (_, f) => (
          <Line
            key={`fl-${f}`}
            x1={leftPad} y1={fretLineY(f + 1)}
            x2={leftPad + diagW} y2={fretLineY(f + 1)}
            stroke={gridColor} strokeWidth={1.5}
          />
        ))}

        {/* String lines */}
        {Array.from({ length: NUM_STRINGS }, (_, i) => (
          <Line
            key={`sl-${i}`}
            x1={strX(i)} y1={topPad}
            x2={strX(i)} y2={fretLineY(NUM_FRETS)}
            stroke={gridColor} strokeWidth={1.5}
          />
        ))}

        {/* X / O string markers */}
        {strings.map((val, i) => {
          const cx = strX(i);
          const cy = nameLabelH + markerH * 0.45;
          const r = Math.max(7, dotR * 0.55);
          if (val === -1) {
            const s = r * 0.72;
            return (
              <G key={`xo-${i}`}>
                <Line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s}
                  stroke={mutedColor} strokeWidth={2.5} strokeLinecap="round" />
                <Line x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s}
                  stroke={mutedColor} strokeWidth={2.5} strokeLinecap="round" />
              </G>
            );
          }
          if (val === 0) {
            return (
              <Circle key={`xo-${i}`} cx={cx} cy={cy} r={r}
                fill="none" stroke={textColor} strokeWidth={2} />
            );
          }
          return null;
        })}

        {/* Barre bar */}
        {barre &&
          barre.fret >= baseFret &&
          barre.fret < baseFret + NUM_FRETS &&
          (() => {
            const rel = barre.fret - baseFret + 1;
            const x1 = strX(Math.min(barre.from, barre.to));
            const x2 = strX(Math.max(barre.from, barre.to));
            const cy = dotCY(rel);
            return (
              <Rect
                key="barre"
                x={x1 - dotR * 0.55} y={cy - dotR}
                width={x2 - x1 + dotR * 1.1} height={dotR * 2}
                rx={dotR} fill={primaryColor}
              />
            );
          })()}

        {/* Finger dots */}
        {strings.map((val, i) => {
          if (val <= 0) return null;
          const rel = val - baseFret + 1;
          if (rel < 1 || rel > NUM_FRETS) return null;
          if (
            barre && barre.fret === val &&
            i >= Math.min(barre.from, barre.to) &&
            i <= Math.max(barre.from, barre.to)
          ) return null;
          return (
            <Circle key={`dot-${i}`}
              cx={strX(i)} cy={dotCY(rel)} r={dotR} fill={primaryColor}
            />
          );
        })}

        {/* Ghost dot on press (empty cell only) */}
        {ghostInfo && (() => {
          const { row, col } = ghostInfo;
          const actual = baseFret + row;
          if (strings[col] === actual) return null;
          return (
            <Circle
              key="ghost"
              cx={strX(col)} cy={dotCY(row + 1)}
              r={dotR} fill={primaryColor} opacity={0.35}
            />
          );
        })()}
      </Svg>

      {/* ── Touch layer: transparent Pressables on top ─────────────────── */}

      {/* String indicator buttons (top strip) */}
      {Array.from({ length: NUM_STRINGS }, (_, i) => (
        <Pressable
          key={`ps-${i}`}
          onPress={() => toggleString(i)}
          hitSlop={6}
          style={{
            position: "absolute",
            left: strX(i) - sp / 2,
            top: 0,
            width: sp,
            height: topPad,
          }}
        />
      ))}

      {/* Fret cells (flattened to one array) */}
      {Array.from({ length: NUM_FRETS * NUM_STRINGS }, (_, idx) => {
        const row = Math.floor(idx / NUM_STRINGS);
        const col = idx % NUM_STRINGS;
        const key = `${row}-${col}`;
        return (
          <Pressable
            key={`pc-${key}`}
            onPressIn={() => setPressedCell(key)}
            onPressOut={() => setPressedCell(null)}
            onPress={() => toggleFret(col, row + 1)}
            hitSlop={2}
            style={{
              position: "absolute",
              left: strX(col) - sp / 2,
              top: topPad + row * fretH,
              width: sp,
              height: fretH,
            }}
          />
        );
      })}
    </View>
  );
}
