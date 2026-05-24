import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { buildAnalysisResult } from './src/services/duplicateChecker';
import { analyzeSupplementPhoto } from './src/services/visionService';
import { AnalysisResult } from './src/types';

const API_KEY_STORAGE = 'stack-check-gemini-api-key';
const isWeb = Platform.OS === 'web';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [draftApiKey, setDraftApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(API_KEY_STORAGE).then((saved) => {
      if (saved) {
        setApiKey(saved);
      } else {
        setShowSettings(true);
      }
    });
  }, []);

  const saveApiKey = useCallback(async () => {
    const trimmed = draftApiKey.trim();
    if (!trimmed) {
      Alert.alert('API 키 필요', 'Google Gemini API 키를 입력해 주세요.');
      return;
    }

    await AsyncStorage.setItem(API_KEY_STORAGE, trimmed);
    setApiKey(trimmed);
    setShowSettings(false);
    Alert.alert('저장됨', 'API 키가 저장되었어요.');
  }, [draftApiKey]);

  const pickImage = useCallback(async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('권한 필요', useCamera ? '카메라 권한이 필요해요.' : '사진 접근 권한이 필요해요.');
      return;
    }

    const pickerResult = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        });

    if (pickerResult.canceled || !pickerResult.assets[0]?.uri) {
      return;
    }

    setPhotoUri(pickerResult.assets[0].uri);
    setResult(null);

    if (!apiKey) {
      setShowSettings(true);
      Alert.alert('API 키 설정', '분석하려면 먼저 Gemini API 키를 저장해 주세요.');
      return;
    }

    const base64 = pickerResult.assets[0].base64;
    if (!base64) {
      Alert.alert('오류', '사진 데이터를 읽지 못했어요.');
      return;
    }

    setLoading(true);
    try {
      const visionResult = await analyzeSupplementPhoto(base64, apiKey);
      setResult(buildAnalysisResult(visionResult.products, visionResult.warnings));
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      Alert.alert('분석 실패', message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  const reset = useCallback(() => {
    setPhotoUri(null);
    setResult(null);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={[styles.container, isWeb && styles.containerWeb]}>
        <View style={styles.header}>
          <Text style={styles.title}>영양제 무더기</Text>
          <Text style={styles.subtitle}>
            {isWeb
              ? '사진을 올리면 겹치는 성분을 찾아줘요'
              : '통 여러 개를 한 번에 찍으면\n겹치는 성분을 찾아줘요'}
          </Text>
          <Pressable style={styles.settingsButton} onPress={() => setShowSettings((prev) => !prev)}>
            <Text style={styles.settingsButtonText}>{showSettings ? '설정 닫기' : 'API 키 설정'}</Text>
          </Pressable>
        </View>

        {showSettings && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Google Gemini API 키</Text>
            <Text style={styles.cardHint}>
              aistudio.google.com 에서 무료 API 키를 발급받을 수 있어요.{'\n'}
              (프로토타입용 — 나중에 서버로 옮기면 키를 앱에 넣지 않아도 됩니다)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="AIza..."
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={draftApiKey}
              onChangeText={setDraftApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.primaryButton} onPress={saveApiKey}>
              <Text style={styles.primaryButtonText}>저장</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.actionRow}>
          {isWeb ? (
            <>
              <Pressable style={styles.captureButton} onPress={() => pickImage(false)} disabled={loading}>
                <Text style={styles.captureEmoji}>🖼️</Text>
                <Text style={styles.captureTitle}>사진 업로드</Text>
                <Text style={styles.captureHint}>영양제 여러 통이 보이게 한 장</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => pickImage(true)} disabled={loading}>
                <Text style={styles.secondaryButtonText}>카메라로 촬영 (모바일)</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.captureButton} onPress={() => pickImage(true)} disabled={loading}>
                <Text style={styles.captureEmoji}>📸</Text>
                <Text style={styles.captureTitle}>무더기 촬영</Text>
                <Text style={styles.captureHint}>식탁에 펼쳐놓고 한 장</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => pickImage(false)} disabled={loading}>
                <Text style={styles.secondaryButtonText}>앨범에서 선택</Text>
              </Pressable>
            </>
          )}
        </View>

        {photoUri && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>촬영한 사진</Text>
            <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
            <Pressable style={styles.linkButton} onPress={reset}>
              <Text style={styles.linkButtonText}>다시 찍기</Text>
            </Pressable>
          </View>
        )}

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0f766e" />
            <Text style={styles.loadingText}>AI가 라벨을 읽는 중...</Text>
          </View>
        )}

        {result && !loading && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>인식된 제품 ({result.products.length}개)</Text>
              {result.products.map((product) => (
                <View key={product.id} style={styles.productItem}>
                  <Text style={styles.productName}>
                    {product.name}
                    {product.brand ? ` · ${product.brand}` : ''}
                  </Text>
                  {!product.labelVisible && (
                    <Text style={styles.productWarning}>성분표가 잘 안 보여요 — 뒷면 추가 촬영 권장</Text>
                  )}
                  {product.ingredients.length > 0 ? (
                    product.ingredients.slice(0, 6).map((ingredient, index) => (
                      <Text key={`${product.id}-${index}`} style={styles.ingredientText}>
                        • {ingredient.name}
                        {ingredient.amount ? ` (${ingredient.amount})` : ''}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.ingredientText}>• 성분 정보 없음</Text>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {result.overlaps.length > 0 ? '⚠️ 겹치는 성분' : '✅ 겹치는 성분 없음'}
              </Text>
              {result.overlaps.length === 0 ? (
                <Text style={styles.cardHint}>현재 등록된 제품끼리 같은 성분이 겹치지 않았어요.</Text>
              ) : (
                result.overlaps.map((overlap) => (
                  <View key={overlap.normalizedName} style={styles.overlapItem}>
                    <Text style={styles.overlapName}>{overlap.displayName}</Text>
                    <Text style={styles.overlapProducts}>포함 제품: {overlap.products.join(', ')}</Text>
                    <Text style={styles.overlapSuggestion}>{overlap.suggestion}</Text>
                  </View>
                ))
              )}
            </View>

            {result.warnings.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>추가 안내</Text>
                {result.warnings.map((warning, index) => (
                  <Text key={index} style={styles.warningText}>
                    • {warning}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={styles.disclaimer}>
          본 앱은 참고용 정보입니다. 복용 변경은 약사·의사와 상담하세요.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0fdfa',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  containerWeb: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#134e4a',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
  },
  settingsButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  settingsButtonText: {
    color: '#0f766e',
    fontWeight: '600',
  },
  actionRow: {
    gap: 12,
  },
  captureButton: {
    backgroundColor: '#0f766e',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  captureEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  captureTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  captureHint: {
    color: '#ccfbf1',
    marginTop: 6,
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontWeight: '700',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#134e4a',
  },
  cardHint: {
    color: '#64748b',
    lineHeight: 21,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
  },
  primaryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  linkButton: {
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    color: '#0f766e',
    fontWeight: '600',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: {
    color: '#475569',
    fontWeight: '600',
  },
  productItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  productName: {
    fontWeight: '700',
    color: '#0f172a',
    fontSize: 15,
  },
  productWarning: {
    color: '#b45309',
    fontSize: 13,
  },
  ingredientText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  overlapItem: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  overlapName: {
    fontWeight: '800',
    color: '#9a3412',
    fontSize: 16,
  },
  overlapProducts: {
    color: '#7c2d12',
    fontSize: 14,
  },
  overlapSuggestion: {
    color: '#9a3412',
    lineHeight: 20,
    fontSize: 14,
  },
  warningText: {
    color: '#b45309',
    lineHeight: 20,
  },
  disclaimer: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
