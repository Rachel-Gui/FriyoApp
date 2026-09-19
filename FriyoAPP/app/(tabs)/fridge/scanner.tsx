import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Image, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import { Colors }         from '@/constants/Colors';
import { SFIcon }         from '@/components/ui/SFIcon';
import { fridgeService }  from '@/services/fridgeService';
import { aiConsentService } from '@/services/aiConsentService';

const { width, height } = Dimensions.get('window');

type Stage = 'idle' | 'capturing' | 'processing' | 'done' | 'error';

interface DetectedItem {
  label: string;
  conf:  string;
  x:     number;
  y:     number;
}

export default function FridgeScanner() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const qc       = useQueryClient();

  const [permission, requestPermission] = useCameraPermissions();
  const [stage,         setStage]         = useState<Stage>('idle');
  const [capturedUri,   setCapturedUri]   = useState<string | null>(null);
  const [detectedItems,  setDetectedItems]  = useState<DetectedItem[]>([]);
  const [scannedItems,   setScannedItems]   = useState<any[]>([]);
  const [sessionId,      setSessionId]      = useState<string | null>(null);
  const [errorMsg,       setErrorMsg]       = useState('');
  const [cameraFacing,   setCameraFacing]   = useState<'back' | 'front'>('back');

  const cameraRef = useRef<CameraView>(null);

  // Shutter animation
  const shutterScale = useRef(new Animated.Value(1)).current;
  const shutterIn  = () => Animated.spring(shutterScale, { toValue: 0.88, useNativeDriver: true, stiffness: 500, damping: 22 }).start();
  const shutterOut = () => Animated.spring(shutterScale, { toValue: 1,    useNativeDriver: true, stiffness: 280, damping: 24 }).start();

  // Scan line animation
  const scanY = useRef(new Animated.Value(0)).current;
  const startScanLine = () => {
    scanY.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  };

  const scanLineTranslate = scanY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height * 0.52],
  });

  // ── Take photo ──────────────────────────────────────────────────────────────
  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      setStage('capturing');
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      if (!photo) { setStage('idle'); return; }
      setCapturedUri(photo.uri);
      await processImage(photo.uri);
    } catch {
      setStage('idle');
    }
  }, []);

  // ── Import from library ─────────────────────────────────────────────────────
  const importFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setCapturedUri(result.assets[0].uri);
      await processImage(result.assets[0].uri);
    }
  }, []);

  // ── Process image → API → results ──────────────────────────────────────────
  const processImage = useCallback(async (uri: string) => {
    if (!(await aiConsentService.requestConsent())) {
      setCapturedUri(null);
      setStage('idle');
      return;
    }
    setStage('processing');
    setDetectedItems([]);
    setErrorMsg('');
    startScanLine();

    try {
      // Start scan — uploads image to backend
      const session = await fridgeService.startScan(uri);
      setSessionId(session.sessionId);

      // Poll for results (max 30 s)
      let result = await fridgeService.pollScan(session.sessionId);
      let attempts = 0;
      while (result.status === 'processing' && attempts < 20) {
        await new Promise(r => setTimeout(r, 1500));
        result = await fridgeService.pollScan(session.sessionId);
        attempts++;
      }

      if (result.status === 'failed' || attempts >= 20) {
        setDetectedItems([]);
        setScannedItems([]);
        setStage('done');
        return;
      }

      // Keep raw ScannedItems for confirmScan API call
      setScannedItems(result.items ?? []);

      // Map detected items to overlay positions for display
      const items = (result.items ?? []).map((item: any, i: number) => ({
        label: item.customName ?? item.name ?? 'Item',
        conf:  item.confidence ? `${Math.round(item.confidence * 100)}%` : '—',
        x:     0.15 + (i % 3) * 0.28,
        y:     0.20 + Math.floor(i / 3) * 0.20,
      }));

      setDetectedItems(items);
      setStage('done');

    } catch (err: any) {
      setDetectedItems([]);
      setScannedItems([]);
      setErrorMsg(err?.message ?? 'Could not scan this image. Please try again.');
      setStage('done');
    }
  }, []);

  // ── Confirm → save to fridge ────────────────────────────────────────────────
  const confirmItems = useCallback(async () => {
    if (detectedItems.length === 0 || !sessionId) {
      router.back();
      return;
    }
    try {
      await fridgeService.confirmScan(sessionId, scannedItems);
      qc.invalidateQueries({ queryKey: ['fridge'] });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save items. Please try again.');
      return;
    }
    router.back();
  }, [detectedItems, scannedItems, sessionId]);

  // ── Permission not yet determined ───────────────────────────────────────────
  if (!permission) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.yellow} />
      </View>
    );
  }

  // ── Permission denied ───────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
        <Text style={{ color: Colors.white, fontSize: 18, fontFamily: 'DMSans_700Bold', textAlign: 'center', marginBottom: 16 }}>
          Camera Access Required
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 28 }}>
          Friyo needs camera access to scan your fridge contents.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: Colors.yellow, borderRadius: 50, paddingVertical: 14, paddingHorizontal: 28 }}
          onPress={requestPermission}
        >
          <Text style={{ fontFamily: 'DMSans_700Bold', color: Colors.black, fontSize: 15 }}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 14 }} onPress={() => router.back()}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const FRAME_MARGIN = 36;
  const isProcessing = stage === 'processing' || stage === 'capturing';

  return (
    <View style={s.root}>

      {/* ── Camera / captured photo background ──────────────────────────── */}
      {capturedUri ? (
        <Image source={{ uri: capturedUri }} style={s.bg} resizeMode="cover" />
      ) : (
        <CameraView ref={cameraRef} style={s.bg} facing={cameraFacing} />
      )}
      <View style={[s.bgDim, isProcessing && { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <SafeAreaView style={s.topSafe} edges={['top']}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.glassBtn}>
            <BlurView intensity={70} tint="dark" style={s.glassBtnInner}>
              <SFIcon name="xmark" size={16} color="rgba(255,255,255,0.85)" />
            </BlurView>
          </TouchableOpacity>

          <View style={s.titleBlock}>
            <Text style={s.topTitle}>AI Fridge Scanner</Text>
            <Text style={s.topSub}>
              {stage === 'idle'       ? 'Point camera at your fridge or shelf'  :
               stage === 'capturing'  ? 'Capturing…'                             :
               stage === 'processing' ? `Analysing… ${detectedItems.length > 0 ? detectedItems.length + ' detected' : ''}` :
               stage === 'done' && detectedItems.length > 0 ? `${detectedItems.length} items found!` :
               stage === 'done'       ? (errorMsg || 'Done — add items manually') :
               'Something went wrong'}
            </Text>
          </View>

          {isProcessing && (
            <View style={s.aiPill}>
              <ActivityIndicator size="small" color={Colors.black} />
            </View>
          )}
          {stage === 'done' && detectedItems.length > 0 && (
            <View style={s.aiPill}>
              <SFIcon name="sparkles" size={13} color={Colors.black} weight="fill" />
              <Text style={s.aiPillText}>AI</Text>
            </View>
          )}
          {!isProcessing && stage !== 'done' && <View style={{ width: 36 }} />}
        </View>
      </SafeAreaView>

      {/* ── Scan frame ────────────────────────────────────────────────────── */}
      <View style={[s.scanFrame, { margin: FRAME_MARGIN }]}>
        {[
          { top: -1, left: -1 },
          { top: -1, right: -1 },
          { bottom: -1, left: -1 },
          { bottom: -1, right: -1 },
        ].map((pos, i) => (
          <View
            key={i}
            style={[
              s.corner,
              { borderTopWidth:    pos.top    !== undefined ? 3 : 0 },
              { borderBottomWidth: pos.bottom !== undefined ? 3 : 0 },
              { borderLeftWidth:   pos.left   !== undefined ? 3 : 0 },
              { borderRightWidth:  pos.right  !== undefined ? 3 : 0 },
              pos,
            ]}
          />
        ))}

        {isProcessing && (
          <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineTranslate }] }]} />
        )}
      </View>

      {/* ── Detection labels ──────────────────────────────────────────────── */}
      {stage === 'done' && detectedItems.map((item, i) => (
        <View
          key={i}
          style={[s.detectionTag, { top: height * item.y, left: width * item.x }]}
        >
          <View style={s.detectionDot} />
          <Text style={s.detectionText}>{item.label}</Text>
          <Text style={s.detectionConf}>{item.conf}</Text>
        </View>
      ))}

      {/* ── Bottom action bar ─────────────────────────────────────────────── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>

        {/* Confirm banner (done state) */}
        {stage === 'done' && detectedItems.length > 0 && (
          <TouchableOpacity style={s.addStorageBtn} onPress={confirmItems}>
            <SFIcon name="checkmark" size={16} color={Colors.black} weight="fill" />
            <Text style={s.addStorageBtnText}>
              {`Add ${detectedItems.length} Items to Fridge →`}
            </Text>
          </TouchableOpacity>
        )}

        {stage === 'done' && detectedItems.length === 0 && (
          <View style={s.emptyResultCard}>
            <Text style={s.emptyResultTitle}>No items found</Text>
            <Text style={s.emptyResultText}>
              {errorMsg || 'Try another angle, better light, or import a clearer photo.'}
            </Text>
          </View>
        )}

        {/* Retry button (done state) */}
        {stage === 'done' && (
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => { setStage('idle'); setCapturedUri(null); setDetectedItems([]); setErrorMsg(''); }}
          >
            <Text style={s.retryBtnText}>Scan Again</Text>
          </TouchableOpacity>
        )}

        {/* Three-button row: Import | Shutter | Flash */}
        {stage !== 'done' && (
          <View style={s.actionRow}>
            {/* Import from library */}
            <TouchableOpacity style={s.sideBtn} onPress={importFromLibrary} disabled={isProcessing}>
              <View style={[s.sideBtnIcon, isProcessing && { opacity: 0.4 }]}>
                <SFIcon name="photo.on.rectangle" size={22} color="rgba(255,255,255,0.85)" />
              </View>
              <Text style={s.sideBtnLabel}>Import</Text>
            </TouchableOpacity>

            {/* Shutter */}
            <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={shutterIn}
                onPressOut={shutterOut}
                onPress={takePhoto}
                disabled={isProcessing}
                style={s.shutterWrap}
              >
                <View style={[s.shutterOuter, isProcessing && { borderColor: Colors.yellow }]}>
                  {isProcessing ? (
                    <ActivityIndicator color={Colors.yellow} size="large" />
                  ) : (
                    <View style={s.shutterInner} />
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Flip camera */}
            <TouchableOpacity
              style={s.sideBtn}
              disabled={isProcessing}
              onPress={() => setCameraFacing(facing => facing === 'back' ? 'front' : 'back')}
            >
              <View style={[s.sideBtnIcon, isProcessing && { opacity: 0.4 }]}>
                <SFIcon name="arrow.triangle.2.circlepath.camera" size={22} color="rgba(255,255,255,0.85)" />
              </View>
              <Text style={s.sideBtnLabel}>Flip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const FRAME_H = height * 0.52;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bg:   { position: 'absolute', width, height },
  bgDim: { position: 'absolute', width, height, backgroundColor: 'rgba(0,0,0,0.25)' },

  topSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  glassBtn:      { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  glassBtnInner: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  titleBlock: { flex: 1, alignItems: 'center' },
  topTitle:   { fontSize: 15, fontFamily: 'DMSans_700Bold', color: Colors.white },
  topSub:     { fontSize: 11, fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.yellow, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4, minWidth: 36 },
  aiPillText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: Colors.black },

  scanFrame: { position: 'absolute', top: 110, left: 0, right: 0, height: FRAME_H, borderRadius: 20, overflow: 'hidden' },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: Colors.yellow },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: Colors.yellow, shadowColor: Colors.yellow, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8, opacity: 0.85 },

  detectionTag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(245,216,75,0.55)' },
  detectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.yellow },
  detectionText: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: Colors.white },
  detectionConf: { fontSize: 10, fontFamily: 'DMSans_400Regular', color: Colors.yellow },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 12, paddingTop: 16, paddingHorizontal: 24 },

  addStorageBtn: { backgroundColor: Colors.yellow, borderRadius: 50, paddingVertical: 15, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: Colors.yellow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  addStorageBtnText: { fontFamily: 'DMSans_700Bold', color: Colors.black, fontSize: 15 },

  emptyResultCard: { width: '100%', backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  emptyResultTitle: { fontFamily: 'DMSans_700Bold', color: Colors.white, fontSize: 15, textAlign: 'center', marginBottom: 4 },
  emptyResultText: { fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.76)', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  retryBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 50, paddingVertical: 11, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  retryBtnText: { fontFamily: 'DMSans_500Medium', color: Colors.white, fontSize: 14 },

  actionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', width: '100%' },
  sideBtn: { alignItems: 'center', gap: 6, minWidth: 64 },
  sideBtnIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  sideBtnLabel: { fontSize: 12, fontFamily: 'DMSans_500Medium', color: 'rgba(255,255,255,0.85)' },

  shutterWrap:  { alignItems: 'center', justifyContent: 'center' },
  shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 3.5, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 10 },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: Colors.white },
});
