import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { SFIcon } from '@/components/ui/SFIcon';
import { RecipeMetaChip } from '@/components/ui/RecipeMetaChip';
import type { AIRecipeSuggestion } from '@/services/types';

interface Props {
  recipes:         AIRecipeSuggestion[];
  onStartCooking?: (recipe: AIRecipeSuggestion) => void;
}

export function RecipeRecommendationCard({ recipes, onStartCooking }: Props) {
  const [expanded, setExpanded] = useState<string | null>(recipes[0]?.recipeId ?? null);

  return (
    <View style={card.wrap}>
      {recipes.map((recipe, index) => {
        const isOpen = expanded === recipe.recipeId;
        const isBest = index === 0;

        return (
          <View
            key={recipe.recipeId}
            style={[card.row, index < recipes.length - 1 && card.rowBorder]}
          >
            {/* Tap header to expand / collapse */}
            <TouchableOpacity
              style={card.header}
              onPress={() => setExpanded(isOpen ? null : recipe.recipeId)}
              activeOpacity={0.75}
            >
              <View style={[card.emojiCircle, isBest && card.emojiCircleBest]}>
                <Text style={card.emoji}>{recipe.emoji}</Text>
              </View>

              <View style={{ flex: 1, gap: 5 }}>
                <View style={card.titleRow}>
                  {isBest && (
                    <View style={card.bestBadge}>
                      <Text style={card.bestBadgeText}>BEST</Text>
                    </View>
                  )}
                  <Text style={card.title} numberOfLines={1}>{recipe.title}</Text>
                </View>

                <View style={card.metaRow}>
                  <RecipeMetaChip icon="timer" label={recipe.cookingTime} iconColor="rgba(0,0,0,0.4)" />
                  <RecipeMetaChip label={recipe.difficulty} />
                  <RecipeMetaChip icon="flame" label={`${recipe.calories} kcal`} iconColor={Colors.orange} />
                </View>
              </View>

              <SFIcon
                name={isOpen ? 'chevron.left' : 'chevron.right'}
                size={13}
                color={Colors.gray}
                style={{ transform: [{ rotate: isOpen ? '90deg' : '-90deg' }] }}
              />
            </TouchableOpacity>

            {/* Expanded content */}
            {isOpen && (
              <View style={card.body}>
                {/* Reason */}
                <View style={card.reasonRow}>
                  <SFIcon name="sparkles" size={12} color={Colors.orange} />
                  <Text style={card.reason}>{recipe.reason}</Text>
                </View>

                {/* Ingredients */}
                <View style={card.section}>
                  <Text style={card.sectionLabel}>Ingredients</Text>
                  <View style={card.ingRow}>
                    {recipe.usedIngredients.map((ing, i) => (
                      <View key={i} style={card.haveChip}>
                        <Text style={card.haveText}>✓ {ing}</Text>
                      </View>
                    ))}
                    {recipe.missingIngredients.map((ing, i) => (
                      <View key={i} style={card.needChip}>
                        <Text style={card.needText}>+ {ing}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Substitution hint */}
                {!!recipe.substitution && (
                  <View style={card.subRow}>
                    <SFIcon name="info.circle" size={12} color={Colors.blue} />
                    <Text style={card.subText}>{recipe.substitution}</Text>
                  </View>
                )}

                {/* Steps preview */}
                <View style={card.section}>
                  <Text style={card.sectionLabel}>Quick steps</Text>
                  {recipe.stepsPreview.map((step, i) => (
                    <View key={i} style={card.stepRow}>
                      <View style={card.stepNum}>
                        <Text style={card.stepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={card.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA — only for best match */}
                {isBest && (
                  <TouchableOpacity
                    style={card.ctaBtn}
                    onPress={() => onStartCooking?.(recipe)}
                    activeOpacity={0.82}
                  >
                    <SFIcon name="play.fill" size={13} color={Colors.black} weight="fill" />
                    <Text style={card.ctaText}>Start Cooking</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.white,
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.08,
    shadowRadius:    10,
    elevation:       4,
  },
  row: { paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderGray },

  header:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emojiCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center' },
  emojiCircleBest: { backgroundColor: Colors.yellowMedium },
  emoji:      { fontSize: 22 },

  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bestBadge:  { backgroundColor: Colors.yellow, borderRadius: 50, paddingHorizontal: 6, paddingVertical: 2 },
  bestBadgeText: { fontSize: 9, fontFamily: 'DMSans_700Bold', color: Colors.black, letterSpacing: 0.5 },
  title:      { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.black, flex: 1 },
  metaRow:    { flexDirection: 'row', gap: 5, alignItems: 'center' },

  body:       { paddingTop: 10, gap: 10 },

  reasonRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: Colors.yellowLight, borderRadius: 10, padding: 10 },
  reason:     { flex: 1, fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.black, lineHeight: 18 },

  section:    { gap: 6 },
  sectionLabel: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.gray, letterSpacing: 0.4, textTransform: 'uppercase' },

  ingRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  haveChip:   { backgroundColor: Colors.greenLight, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  haveText:   { fontSize: 11, fontFamily: 'DMSans_500Medium', color: Colors.green },
  needChip:   { backgroundColor: '#FFF3E0', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  needText:   { fontSize: 11, fontFamily: 'DMSans_500Medium', color: Colors.orange },

  subRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  subText:    { flex: 1, fontSize: 12, fontFamily: 'DMSans_400Regular', color: Colors.blue, lineHeight: 17 },

  stepRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  stepNum:    { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.black, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText:{ fontSize: 10, fontFamily: 'DMSans_700Bold', color: Colors.white },
  stepText:   { flex: 1, fontSize: 13, fontFamily: 'DMSans_400Regular', color: Colors.black, lineHeight: 18 },

  ctaBtn:     { backgroundColor: Colors.yellow, borderRadius: 50, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2 },
  ctaText:    { fontSize: 14, fontFamily: 'DMSans_700Bold', color: Colors.black },
});
