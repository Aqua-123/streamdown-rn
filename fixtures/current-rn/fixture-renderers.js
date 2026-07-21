import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';

const TABLEAU_10 = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];

export function mermaidHeightFromSvg(svg, width) {
  const viewBox = svg.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  const sourceWidth = Number(viewBox?.[1]);
  const sourceHeight = Number(viewBox?.[2]);
  const aspectHeight = sourceWidth > 0 && sourceHeight > 0 ? width * (sourceHeight / sourceWidth) : 260;
  return Math.round(Math.min(520, Math.max(180, aspectHeight)));
}

export function ResponsiveMermaidSvg({ svg }) {
  const [width, setWidth] = useState(320);
  return (
    <View onLayout={({ nativeEvent }) => setWidth(Math.max(1, nativeEvent.layout.width))} style={{ width: '100%', minHeight: mermaidHeightFromSvg(svg, width), justifyContent: 'center' }}>
      <SvgXml xml={svg} width="100%" height={mermaidHeightFromSvg(svg, width)} />
    </View>
  );
}

export function parseVegaLiteBars(code) {
  const spec = JSON.parse(code);
  const xField = spec?.encoding?.x?.field;
  const yField = spec?.encoding?.y?.field;
  const values = spec?.data?.values;
  if (!xField || !yField || !Array.isArray(values)) throw new Error('Vega-Lite bar charts require x, y, and inline data.values');
  const bars = values.map((value) => ({ label: String(value[xField]), value: Number(value[yField]) }));
  if (!bars.length || bars.some((bar) => !Number.isFinite(bar.value))) throw new Error('Vega-Lite values must be numeric');
  bars.sort((a, b) => a.label.localeCompare(b.label));
  return { bars, xTitle: xField, yTitle: spec.encoding.y.title || yField };
}

export function VegaLiteRenderer({ code, language, isIncomplete }) {
  const [width, setWidth] = useState(320);
  if (isIncomplete) {
    return <View accessible accessibilityLabel="Loading Vega-Lite chart" accessibilityState={{ busy: true }} style={{ height: 220, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#71717a' }}>Loading chart…</Text></View>;
  }

  let chart;
  try {
    chart = parseVegaLiteBars(code);
  } catch (error) {
    return <View style={{ padding: 16 }}><Text accessibilityRole="alert" style={{ color: '#dc2626' }}>{error instanceof Error ? error.message : 'Invalid Vega-Lite spec'}</Text></View>;
  }

  const height = 250;
  const left = 42;
  const right = 10;
  const top = 14;
  const bottom = 38;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = height - top - bottom;
  const rawMax = Math.max(...chart.bars.map((bar) => bar.value));
  const max = Math.max(10, Math.ceil(rawMax / 20) * 20);
  const slot = plotWidth / chart.bars.length;
  const barWidth = Math.max(8, slot - Math.min(12, slot * 0.18));

  return (
    <View style={{ marginVertical: 16, padding: 8, gap: 8, borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#fafafa' }}>
      <View style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
        <Text style={{ color: '#71717a', fontFamily: 'Menlo', fontSize: 11 }}>{language}</Text>
      </View>
      <View onLayout={({ nativeEvent }) => setWidth(Math.max(1, nativeEvent.layout.width))} accessible accessibilityRole="image" accessibilityLabel={`Bar chart of ${chart.yTitle} by ${chart.xTitle}`} style={{ padding: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 6, backgroundColor: '#ffffff' }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {[0, 20, 40, 60, 80, 100].filter((tick) => tick <= max).map((tick) => {
            const y = top + plotHeight - (tick / max) * plotHeight;
            return <G key={tick}><Line x1={left} y1={y} x2={width - right} y2={y} stroke="#e4e4e7" strokeDasharray="4 4" /><SvgText x={left - 7} y={y + 4} textAnchor="end" fontSize="10" fill="#52525b">{tick}</SvgText></G>;
          })}
          <Line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="#a1a1aa" />
          <Line x1={left} y1={top + plotHeight} x2={width - right} y2={top + plotHeight} stroke="#a1a1aa" />
          {chart.bars.map((bar, index) => {
            const barHeight = (bar.value / max) * plotHeight;
            const x = left + index * slot + (slot - barWidth) / 2;
            const y = top + plotHeight - barHeight;
            return <G key={bar.label}><Rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill={TABLEAU_10[index % TABLEAU_10.length]} /><SvgText x={x + barWidth / 2} y={top + plotHeight + 16} textAnchor="middle" fontSize="10" fill="#18181b">{bar.label}</SvgText></G>;
          })}
          <SvgText x={left + plotWidth / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="#18181b">{chart.xTitle}</SvgText>
          <SvgText x={12} y={top + plotHeight / 2} textAnchor="middle" fontSize="10" fill="#18181b" rotation="-90" origin={`12, ${top + plotHeight / 2}`}>{chart.yTitle}</SvgText>
        </Svg>
      </View>
    </View>
  );
}
