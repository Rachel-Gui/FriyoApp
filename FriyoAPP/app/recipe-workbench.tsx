import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';
import { recipeService } from '@/services/recipeService';
import { RecipeGraph } from '@/components/RecipeGraph';
import { WorkbenchRecipe, WorkbenchStep, importRecipe, sampleRecipe, validateWorkbench, removeWorkbenchStep, moveWorkbenchStep } from '@/services/recipeWorkbench';

function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, disabled && { opacity: 0.4 }]}><Text style={s.buttonText}>{title}</Text></TouchableOpacity>;
}
export default function RecipeWorkbench() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = useAuthStore(state => state.user?.id);
  const [recipe, setRecipe] = useState<WorkbenchRecipe>(() => JSON.parse(JSON.stringify(sampleRecipe)));
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const errors = validateWorkbench(recipe);
  const key = `friyo:recipe-workbench:${userId ?? 'guest'}`;
  useEffect(() => {
    let live = true;
    if (id) {
      setBusy(true);
      recipeService.getRecipeDetail(id).then(data => { if (live) setRecipe(importRecipe(JSON.stringify(data))); })
        .catch(err => { if (live) setStatus(`Could not load recipe: ${err.message}`); }).finally(() => { if (live) setBusy(false); });
    }
    return () => { live = false; };
  }, [id]);
  const updateStep = (index: number, patch: Partial<WorkbenchStep>) => setRecipe(value => ({ ...value, steps: value.steps.map((step, i) => i === index ? { ...step, ...patch } : step) }));
  const number = (value: string) => value.trim() === '' ? undefined : Number(value);
  const action = async (fn: () => Promise<void>) => { setBusy(true); setStatus(''); try { await fn(); } catch (err) { setStatus((err as Error).message); } finally { setBusy(false); } };
  const exportJson = async () => {
    const text = JSON.stringify(recipe, null, 2);
    if (Platform.OS === 'web') {
      const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      link.href = url; link.download = 'friyo-recipe.json'; link.click(); URL.revokeObjectURL(url);
    } else await Share.share({ message: text, title: recipe.title });
    setStatus('Recipe exported.');
  };
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Button title="‹ Back" onPress={() => router.back()} />
    <Text style={s.title}>Recipe workbench</Text>
    <Text style={s.note}>Import a recipe, edit its tables and preview cooking dependencies. Drafts stay on this device. Submitted copies enter review.</Text>
    <View style={s.panel}>
      <Text style={s.heading}>1 · Import</Text>
      <Text style={s.note}>Paste Friyo JSON (snake_case or exported recipe data). Source links are saved as attribution; link extraction is not available yet.</Text>
      {Platform.OS === 'web' && <Button title="Choose JSON file" disabled={busy} onPress={() => {
        const picker = document.createElement('input'); picker.type = 'file'; picker.accept = '.json,application/json';
        picker.onchange = () => { const file = picker.files?.[0]; if (!file) return; void action(async () => { if (file.size > 1_000_000) throw new Error('File must be smaller than 1 MB.'); const text = await file.text(); const parsed = importRecipe(text); setRecipe(parsed); setStatus('Recipe imported.'); }); }; picker.click();
      }} />}
      <TextInput accessibilityLabel="Recipe JSON" multiline value={input} onChangeText={setInput} placeholder="Paste recipe JSON here" style={[s.input, { height: 110 }]} />
      <View style={s.actions}>
        <Button title="Import JSON" disabled={busy} onPress={() => void action(async () => { setRecipe(importRecipe(input)); setStatus('Recipe imported.'); })} />
        <Button title="Load sample" disabled={busy} onPress={() => { setRecipe(JSON.parse(JSON.stringify(sampleRecipe))); setStatus('Sample loaded.'); }} />
        <Button title="Restore draft" disabled={busy || !key} onPress={() => void action(async () => { const data = await AsyncStorage.getItem(key!); if (!data) throw new Error('No saved draft on this device.'); setRecipe(importRecipe(data)); setStatus('Draft restored.'); })} />
      </View>
    </View>
    <Text style={s.heading}>2 · Recipe tables</Text>
    <TextInput accessibilityLabel="Recipe title" value={recipe.title} onChangeText={title => setRecipe(v => ({ ...v, title }))} style={s.input} placeholder="Recipe title" />
    <TextInput accessibilityLabel="Source URL" value={recipe.source_url ?? ''} onChangeText={source_url => setRecipe(v => ({ ...v, source_url: source_url || undefined }))} style={s.input} placeholder="HTTPS source URL (optional)" autoCapitalize="none" />
    <Text style={s.note}>Servings</Text><TextInput accessibilityLabel="Servings" keyboardType="number-pad" value={String(recipe.servings)} onChangeText={value => setRecipe(v => ({ ...v, servings: Number(value) }))} style={s.input} />
    <Text style={s.heading}>Ingredients</Text>
    <ScrollView horizontal><View>
      <View style={s.row}>{['Ingredient', 'Quantity', 'Unit', ''].map((name, i) => <Text key={i} style={[s.column, i === 0 && s.wide]}>{name}</Text>)}</View>
      {recipe.ingredients.map((line, i) => <View key={i} style={s.row}>
        <TextInput accessibilityLabel={`Ingredient ${i + 1} name`} style={[s.cell, s.wide]} value={line.display_name} onChangeText={value => setRecipe(v => ({ ...v, ingredients: v.ingredients.map((item, j) => j === i ? { ...item, display_name: value } : item) }))} />
        <TextInput accessibilityLabel={`Ingredient ${i + 1} quantity`} style={s.cell} keyboardType="decimal-pad" value={line.quantity === undefined ? '' : String(line.quantity)} onChangeText={value => setRecipe(v => ({ ...v, ingredients: v.ingredients.map((item, j) => j === i ? { ...item, quantity: number(value) } : item) }))} />
        <TextInput accessibilityLabel={`Ingredient ${i + 1} unit`} style={s.cell} value={line.unit ?? ''} onChangeText={value => setRecipe(v => ({ ...v, ingredients: v.ingredients.map((item, j) => j === i ? { ...item, unit: value } : item) }))} />
        <Button title="Remove" onPress={() => setRecipe(v => ({ ...v, ingredients: v.ingredients.filter((_, j) => j !== i) }))} />
      </View>)}
    </View></ScrollView>
    <Button title="+ Ingredient" onPress={() => setRecipe(v => ({ ...v, ingredients: [...v.ingredients, { display_name: '', unit: '' }] }))} />
    <Text style={s.heading}>Steps</Text>
    <Text style={s.note}>Parallel with # references an earlier waiting step. Confirm that work is independent; overlapping tasks must fit inside its wait window.</Text>
    <ScrollView horizontal><View>
      <View style={s.row}>{['#', 'Instructions', 'Minutes', 'Type', 'Parallel with #', ''].map((name, i) => <Text key={i} style={[s.column, i === 1 && { width: 260 }]}>{name}</Text>)}</View>
      {recipe.steps.map((step, i) => <View key={step.step_number} style={s.row}>
        <Text style={s.column}>{step.step_number}</Text>
        <TextInput accessibilityLabel={`Step ${step.step_number} instructions`} multiline style={[s.cell, { width: 260, minHeight: 70 }]} value={step.description} onChangeText={description => updateStep(i, { description })} />
        <TextInput accessibilityLabel={`Step ${step.step_number} minutes`} style={s.cell} keyboardType="number-pad" value={step.duration_min === undefined ? '' : String(step.duration_min)} onChangeText={value => updateStep(i, { duration_min: number(value) })} placeholder="Unknown" />
        <Button title={step.step_type === 'hands_on' ? 'Hands-on' : 'Waiting'} onPress={() => updateStep(i, { step_type: step.step_type === 'hands_on' ? 'hands_off' : 'hands_on' })} />
        <TextInput accessibilityLabel={`Step ${step.step_number} parallel with`} style={s.cell} keyboardType="number-pad" value={step.parallel_with_step_number === undefined ? '' : String(step.parallel_with_step_number)} onChangeText={value => updateStep(i, { parallel_with_step_number: number(value) })} placeholder="None" />
        <Button title="↑" onPress={() => setRecipe(v => ({ ...v, steps: moveWorkbenchStep(v.steps, i, -1) }))} />
        <Button title="↓" onPress={() => setRecipe(v => ({ ...v, steps: moveWorkbenchStep(v.steps, i, 1) }))} />
        <Button title="Remove" onPress={() => setRecipe(v => ({ ...v, steps: removeWorkbenchStep(v.steps, step.step_number) }))} />
      </View>)}
    </View></ScrollView>
    <Button title="+ Step" onPress={() => setRecipe(v => ({ ...v, steps: [...v.steps, { step_number: Math.max(0, ...v.steps.map(s => s.step_number)) + 1, description: '', step_type: 'hands_on' }] }))} />
    {!!errors.length && <Text accessibilityRole="alert" style={s.error}>{errors.join('\n')}</Text>}
    <Text style={s.heading}>3 · Graph preview</Text>
    {!errors.length && <RecipeGraph steps={recipe.steps} />}
    <View style={s.actions}>
      <Button title="Save draft" disabled={busy || !!errors.length || !key} onPress={() => void action(async () => { await AsyncStorage.setItem(key!, JSON.stringify(recipe)); setStatus('Draft saved on this device.'); })} />
      <Button title="Export JSON" disabled={busy || !!errors.length} onPress={() => void action(exportJson)} />
      <Button title="Submit for review" disabled={busy || !!errors.length || !userId} onPress={() => void action(async () => { await recipeService.submitRecipe(recipe); setStatus('Copy submitted for review. It will appear in search after approval.'); })} />
    </View>
    {!!status && <Text accessibilityLiveRegion="polite" style={s.status}>{status}</Text>}
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF9F4' }, content: { padding: 20, paddingBottom: 50, gap: 14, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  title: { fontSize: 30, fontWeight: '700', color: '#183C30' }, heading: { fontSize: 20, fontWeight: '700', color: '#183C30', marginTop: 8 }, note: { color: '#52625D', lineHeight: 21 },
  panel: { backgroundColor: '#FFF', padding: 16, gap: 12, borderRadius: 18 }, input: { borderWidth: 1, borderColor: '#C9D1C9', backgroundColor: '#FFF', borderRadius: 10, padding: 12, color: '#172D28' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: '#E8EFCF', alignSelf: 'flex-start' }, buttonText: { fontWeight: '600', color: '#183C30' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }, column: { width: 110, padding: 8, color: '#52625D', fontWeight: '600' }, cell: { width: 110, borderWidth: 1, borderColor: '#C9D1C9', backgroundColor: '#FFF', borderRadius: 8, padding: 10, color: '#172D28' }, wide: { width: 200 },
  error: { color: '#A82E28', lineHeight: 22 }, status: { color: '#183C30', padding: 14, backgroundColor: '#E8EFCF', borderRadius: 10, lineHeight: 22 },
});
