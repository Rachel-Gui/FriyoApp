import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { buildRecipeGraph, WorkbenchStep } from '@/services/recipeWorkbench';

const CARD_W = 242, CARD_H = 160, GAP = 60, LANE = 282;
export function RecipeGraph({ steps }: { steps: WorkbenchStep[] }) {
  const nodes = buildRecipeGraph(steps);
  const total = Math.max(0, ...nodes.map(node => node.end));
  const serial = steps.reduce((sum, step) => sum + (step.duration_min ?? 5), 0);
  const positions = new Map<number, { x: number; y: number }>();
  for (const node of nodes) {
    const parents = node.after.map(n => positions.get(n)).filter((p): p is { x: number; y: number } => !!p);
    positions.set(node.step.step_number, { x: node.step.step_type === 'hands_on' ? 10 : LANE + 10, y: parents.length ? Math.max(...parents.map(p => p.y)) + CARD_H + GAP : 25 });
  }
  const height = Math.max(0, ...Array.from(positions.values()).map(p => p.y)) + CARD_H + 60;
  return <View style={s.wrap}>
    <Text style={s.title}>Cooking graph</Text>
    <Text style={s.note}>{total} min{nodes.some(node => node.estimated) ? ' estimated' : ''} · {serial - total} min overlap savings</Text>
    <Text style={s.note}>Orange: hands-on · Teal: waiting. Arrows show dependencies. Only explicitly independent work overlaps. * Unknown durations use a 5 min preview estimate.</Text>
    <ScrollView horizontal accessibilityLabel="Cooking dependency graph">
      <View style={{ width: 570 }}>
        <View style={s.head}><Text style={s.lane}>Hands-on</Text><Text style={s.lane}>Hands-off / waiting</Text></View>
        <View style={{ height }}>
          {nodes.flatMap(node => {
            const target = positions.get(node.step.step_number)!;
            return node.after.map(parent => {
              const source = positions.get(parent)!;
              const x1 = source.x + CARD_W / 2, y1 = source.y + CARD_H;
              const x2 = target.x + CARD_W / 2, y2 = target.y;
              const mid = y2 - 24;
              return <View key={`${parent}-${node.step.step_number}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={[s.line, { left: x1, top: y1, width: 2, height: mid - y1 }]} />
                <View style={[s.line, { left: Math.min(x1, x2), top: mid, width: Math.max(2, Math.abs(x2 - x1)), height: 2 }]} />
                <View style={[s.line, { left: x2, top: mid, width: 2, height: y2 - mid }]} />
                <Text style={{ position: 'absolute', left: x2 - 6, top: y2 - 16, color: '#6C8075' }}>▼</Text>
              </View>;
            });
          })}
          {nodes.map(node => {
            const position = positions.get(node.step.step_number)!;
            return <View key={node.step.step_number} style={[s.card, { left: position.x, top: position.y, borderColor: node.step.step_type === 'hands_on' ? '#DA773B' : '#139A8C' }]}>
              <Text style={s.label}>#{node.step.step_number} · {node.start}–{node.end} min{node.estimated ? '*' : ''}</Text>
              <Text style={s.edge}>{node.parallel ? `Parallel with #${node.step.parallel_with_step_number}` : node.after.length ? `After ${node.after.map(n => `#${n}`).join(' + ')}` : 'Start'}</Text>
              <Text style={s.description} numberOfLines={4}>{node.step.description}</Text>
              {!!node.step.parallel_with_step_number && !node.parallel && <Text style={s.note}>No safe overlap window; runs later.</Text>}
            </View>;
          })}
          <Text style={[s.end, { position: 'absolute', top: height - 30, left: 10 }]}>↓ All tasks complete · Serve</Text>
        </View>
      </View>
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  wrap: { backgroundColor: '#F4F6F4', borderRadius: 18, padding: 16, gap: 8 }, title: { fontSize: 21, fontWeight: '700', color: '#172D28' },
  note: { fontSize: 12, color: '#52625D', lineHeight: 18 }, head: { flexDirection: 'row', paddingLeft: 10, marginBottom: 8 }, lane: { width: LANE, fontWeight: '700', color: '#253D35' },
  card: { position: 'absolute', width: CARD_W, height: CARD_H, borderLeftWidth: 3, padding: 12, backgroundColor: 'white', borderRadius: 8, gap: 6 },
  line: { position: 'absolute', backgroundColor: '#8B9E91' }, edge: { color: '#52625D', fontSize: 11 }, label: { fontWeight: '700', color: '#172D28' }, description: { color: '#253D35', lineHeight: 20 }, end: { fontWeight: '700', color: '#172D28' },
});
