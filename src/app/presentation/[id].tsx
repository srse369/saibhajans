import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, ChevronDown, Layers3, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from 'lucide-react-native';
import { NavigationBar } from 'expo-navigation-bar';
import RenderHtml from '@native-html/render';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { liveSessionItemKey, useLiveSession } from '../../contexts/LiveSessionContext';
import {
  fetchPresentationSession,
  fetchPresentationTemplates,
  type PresentationImageOverlay,
  type PresentationSession,
  type PresentationTemplate,
  type PresentationTemplateSlide,
  type PresentationTextOverlay,
  type PresentationTextStyle,
} from '../../lib/presentation';
import { fetchSong, type Song } from '../../lib/songs';
import { colors } from '../../lib/theme';
import { singerNameColor } from '../../lib/singerColors';

function rgbaFromHex(value: string, opacity: number) {
  const match = value.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!match) return value;
  const [, red, green, blue] = match;
  return `rgba(${parseInt(red, 16)}, ${parseInt(green, 16)}, ${parseInt(blue, 16)}, ${opacity})`;
}

interface SlideDimensions {
  width: number;
  height: number;
}

type PresentationDeckSlide =
  | { kind: 'song'; songIndex: number }
  | { kind: 'static'; templateSlide: PresentationTemplateSlide };

interface PositionedElement {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  position?: string;
  opacity?: number;
  zIndex?: number;
  rotation?: number;
}

function templateFontSize(value: string | undefined, fallback: number, scale: number) {
  const match = value?.trim().match(/^([\d.]+)(px|rem|em)?$/i);
  if (!match) return fallback * scale;
  const size = Number.parseFloat(match[1]) * (match[2] === 'rem' || match[2] === 'em' ? 16 : 1);
  return Number.isFinite(size) ? size * scale : fallback * scale;
}

function nativeHtml(html: string) {
  return html
    .replace(/<c:([\da-f]{6})\s*>/gi, '<span style="color: #$1">')
    .replace(/<\/c:[\da-f]{6}\s*>/gi, '</span>');
}

function templateTextStyle(style: PresentationTextStyle | undefined, fallback: { fontSize: number; color: string; fontWeight?: '400' | '700' }, scale = 1) {
  const rawWeight = style?.fontWeight;
  const fontWeight = rawWeight === 'normal'
    ? '400' as const
    : rawWeight === 'bold'
      ? '700' as const
      : ['100', '200', '300', '400', '500', '600', '700', '800', '900'].includes(rawWeight || '')
        ? rawWeight as '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
        : fallback.fontWeight || '400' as const;
  return {
    color: style?.color || fallback.color,
    fontSize: templateFontSize(style?.fontSize, fallback.fontSize, scale),
    fontWeight,
    fontStyle: style?.fontStyle || 'normal',
    textAlign: style?.textAlign || 'center',
    ...(style?.fontFamily ? { fontFamily: style.fontFamily } : {}),
  };
}

function scaleCanvasValue(value: number | string | undefined, sourceSize: number, canvasSize: number) {
  if (value === undefined || sourceSize <= 0) return undefined;
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    return (Number.parseFloat(value) / 100) * canvasSize;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value.replace(/px$/i, '').trim());
  return Number.isFinite(parsed) ? parsed * canvasSize / sourceSize : undefined;
}

function positionedElementStyle(
  element: PositionedElement,
  source: SlideDimensions,
  canvas: SlideDimensions,
  fallbackWidth?: number | null,
  fallbackHeight?: number | null,
  fallbackPosition = 'top-left',
) {
  const width = scaleCanvasValue(element.width, source.width, canvas.width)
    ?? (fallbackWidth === null ? undefined : scaleCanvasValue(fallbackWidth ?? source.width, source.width, canvas.width));
  const height = scaleCanvasValue(element.height, source.height, canvas.height)
    ?? (fallbackHeight === null || fallbackHeight === undefined ? undefined : scaleCanvasValue(fallbackHeight, source.height, canvas.height));
  const x = scaleCanvasValue(element.x, source.width, canvas.width);
  const y = scaleCanvasValue(element.y, source.height, canvas.height);
  const position = element.position || fallbackPosition;
  const horizontal = position.split('-').at(-1);
  const vertical = position.split('-')[0];
  const left = x ?? (horizontal === 'right'
    ? canvas.width - (width ?? 0)
    : horizontal === 'center'
      ? (canvas.width - (width ?? 0)) / 2
      : 0);
  const top = y ?? (vertical === 'bottom'
    ? canvas.height - (height ?? 0)
    : vertical === 'center'
      ? (canvas.height - (height ?? 0)) / 2
      : 0);
  return {
    position: 'absolute' as const,
    left,
    top,
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    opacity: element.opacity ?? 1,
    zIndex: element.zIndex ?? 0,
    ...(element.rotation === undefined || element.position ? {} : { transform: [{ rotate: `${element.rotation}deg` }] }),
  };
}

function templateContentBox(
  style: PresentationTextStyle | undefined,
  fallback: Required<Pick<PresentationTextStyle, 'x' | 'y' | 'width'>> & Pick<PresentationTextStyle, 'height' | 'zIndex'>,
  source: SlideDimensions,
  canvas: SlideDimensions,
  includeHeight = true,
) {
  return positionedElementStyle({
    x: style?.x ?? fallback.x,
    y: style?.y ?? fallback.y,
    width: style?.width ?? fallback.width,
    height: includeHeight ? style?.height ?? fallback.height : undefined,
    zIndex: style?.zIndex ?? fallback.zIndex,
  }, source, canvas);
}

export default function SessionPresentationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { items: liveItems, isLoading: isLiveSessionLoading } = useLiveSession();
  const [session, setSession] = useState<PresentationSession | null>(null);
  const [templates, setTemplates] = useState<PresentationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [loadedSong, setLoadedSong] = useState<{ id: string; song: Song } | null>(null);
  const [index, setIndex] = useState(0);
  const [lyricsZoom, setLyricsZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null;
  const slideDimensions: SlideDimensions = selectedTemplate?.aspectRatio === '4:3'
    ? { width: 1600, height: 1200 }
    : { width: 1920, height: 1080 };
  const referenceIndex = Math.min(
    Math.max(selectedTemplate?.referenceSlideIndex ?? 0, 0),
    Math.max((selectedTemplate?.slides?.length || 1) - 1, 0),
  );
  const referenceSlide = selectedTemplate?.slides?.[referenceIndex];
  const liveSession: PresentationSession | null = isLiveSessionLoading ? null : {
    id: 'live',
    name: 'Live session',
    items: liveItems.map((item, sequenceOrder) => ({
        id: liveSessionItemKey(item),
      songId: item.songId,
      songName: item.songName,
        singerName: item.singerName,
      singerGender: item.singerGender,
        pitch: item.pitch,
      sequenceOrder,
    })),
  };
  const activeSession = id === 'live' ? liveSession : session;
  const deck: PresentationDeckSlide[] = (() => {
    if (!activeSession?.items.length) return [];
    const slides = selectedTemplate?.slides || [];
    const deckSlides: PresentationDeckSlide[] = [];
    if (slides.length) {
      for (let slideIndex = 0; slideIndex < referenceIndex; slideIndex += 1) {
        deckSlides.push({ kind: 'static', templateSlide: slides[slideIndex] });
      }
    }
    activeSession.items.forEach((_, songIndex) => deckSlides.push({ kind: 'song', songIndex }));
    if (slides.length) {
      for (let slideIndex = referenceIndex + 1; slideIndex < slides.length; slideIndex += 1) {
        deckSlides.push({ kind: 'static', templateSlide: slides[slideIndex] });
      }
    }
    return deckSlides;
  })();
  const deckSlide = deck[index];
  const currentSongIndex = deckSlide?.kind === 'song' ? deckSlide.songIndex : undefined;
  const currentItem = currentSongIndex === undefined ? undefined : activeSession?.items[currentSongIndex];
  const nextItem = currentSongIndex === undefined
    ? index < referenceIndex ? activeSession?.items[0] : undefined
    : activeSession?.items[currentSongIndex + 1];
  const currentSongId = currentItem?.songId;
  const song = currentSongId && loadedSong?.id === currentSongId ? loadedSong.song : null;
  const templateSlide = deckSlide?.kind === 'static' ? deckSlide.templateSlide : referenceSlide;
  const templateBackground = templateSlide?.background || selectedTemplate?.background;
  const stageColor = templateBackground?.type === 'color'
    ? rgbaFromHex(templateBackground.value, templateBackground.opacity ?? 1)
    : templateBackground?.type === 'video'
      ? '#000000'
      : colors.forestDeep;
  const templateImages = templateSlide ? templateSlide.images || [] : selectedTemplate?.images || [];
  const templateText = templateSlide ? templateSlide.text || [] : selectedTemplate?.text || [];
  const templateLayers = [
    ...templateImages.map((element: PresentationImageOverlay) => ({ type: 'image' as const, element, zIndex: element.zIndex ?? 0 })),
    ...templateText.map((element: PresentationTextOverlay) => ({ type: 'text' as const, element, zIndex: element.zIndex ?? 0 })),
  ].sort((first, second) => first.zIndex - second.zIndex);
  const canvasScale = stageSize.width > 0 && stageSize.height > 0
    ? Math.min(1, stageSize.width / slideDimensions.width, stageSize.height / slideDimensions.height)
    : 0;
  const canvasDimensions = {
    width: slideDimensions.width * canvasScale,
    height: slideDimensions.height * canvasScale,
  };
  const titleStyle = templateSlide?.songTitleStyle || selectedTemplate?.songTitleStyle;
  const lyricsStyle = templateSlide?.songLyricsStyle || selectedTemplate?.songLyricsStyle;
  const translationStyle = templateSlide?.songTranslationStyle || selectedTemplate?.songTranslationStyle;
  const titleTextStyle = templateTextStyle(titleStyle, { fontSize: 48, color: colors.white, fontWeight: '700' }, canvasScale);
  const lyricsTextStyle = templateTextStyle(lyricsStyle, { fontSize: 36, color: '#F7F4EC', fontWeight: '700' }, canvasScale);
  const scaledLyricsTextStyle = { ...lyricsTextStyle, fontSize: lyricsTextStyle.fontSize * lyricsZoom };
  const meaningTextStyle = templateTextStyle(translationStyle, { fontSize: 24, color: colors.white, fontWeight: '400' }, canvasScale);
  const titleBox = templateContentBox(titleStyle, { x: 40, y: 54, width: slideDimensions.width - 80, zIndex: 20 }, slideDimensions, canvasDimensions, false);
  const lyricsBox = templateContentBox(lyricsStyle, { x: 40, y: 216, width: slideDimensions.width - 80, height: 500, zIndex: 21 }, slideDimensions, canvasDimensions);
  const meaningBox = templateContentBox(translationStyle, { x: 40, y: 810, width: slideDimensions.width - 80, height: 200, zIndex: 22 }, slideDimensions, canvasDimensions);
  const bottomLeftConfig = referenceSlide?.bottomLeftTextStyle || selectedTemplate?.bottomLeftTextStyle;
  const bottomRightConfig = referenceSlide?.bottomRightTextStyle || selectedTemplate?.bottomRightTextStyle;
  const bottomLeftTextStyle = templateTextStyle(bottomLeftConfig, { fontSize: 20, color: colors.white, fontWeight: '400' }, canvasScale);
  const bottomRightTextStyle = templateTextStyle(bottomRightConfig, { fontSize: 20, color: colors.white, fontWeight: '400' }, canvasScale);
  const bottomTextWidth = (slideDimensions.width - 120) / 2;
  const bottomLeftBox = templateContentBox(bottomLeftConfig, { x: 40, y: slideDimensions.height * 0.92, width: bottomTextWidth, zIndex: 23 }, slideDimensions, canvasDimensions);
  const bottomRightBox = templateContentBox(bottomRightConfig, { x: slideDimensions.width / 2, y: slideDimensions.height * 0.92, width: bottomTextWidth, zIndex: 24 }, slideDimensions, canvasDimensions);

  useEffect(() => {
    if (id === 'live') return;
    let isActive = true;
    void fetchPresentationSession(id)
      .then((loadedSession) => {
        if (isActive) setSession(loadedSession);
      })
      .catch((cause: unknown) => {
        if (isActive) setError(cause instanceof Error ? cause.message : 'Unable to open this session.');
      })
      .finally(() => {
        if (isActive) setIsLoadingSession(false);
      });
    return () => {
      isActive = false;
    };
  }, [id]);

  useEffect(() => {
    let isActive = true;
    void fetchPresentationTemplates()
      .then((loadedTemplates) => {
        if (!isActive) return;
        setTemplates(loadedTemplates);
        setSelectedTemplateId((currentId) =>
          currentId && loadedTemplates.some((template) => template.id === currentId)
            ? currentId
            : loadedTemplates.find((template) => template.isDefault)?.id || loadedTemplates[0]?.id || null,
        );
      })
      .catch((cause: unknown) => {
        if (isActive) setError(cause instanceof Error ? cause.message : 'Unable to load templates.');
      })
      .finally(() => {
        if (isActive) setIsLoadingTemplates(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!currentSongId) return;
    let isActive = true;
    void fetchSong(currentSongId)
      .then((loaded) => {
        if (isActive) setLoadedSong({ id: currentSongId, song: loaded });
      })
      .catch((cause: unknown) => {
        if (isActive) setError(cause instanceof Error ? cause.message : 'Unable to load song lyrics.');
      });
    return () => {
      isActive = false;
    };
  }, [currentSongId]);

  useEffect(() => {
    if (Platform.OS === 'android') NavigationBar.setHidden(isFullscreen);
  }, [isFullscreen]);

  useEffect(() => () => {
    if (Platform.OS === 'android') NavigationBar.setHidden(false);
  }, []);

  const isPresentationLoading = id === 'live' ? isLiveSessionLoading : isLoadingSession || session?.id !== id;
  if (isPresentationLoading || !activeSession) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        {error ? <Text style={styles.errorTitle}>Unable to present session</Text> : <ActivityIndicator color={colors.saffronLight} />}
        {error ? <Text style={styles.errorText}>{error}</Text> : <Text style={styles.loadingText}>Preparing presentation</Text>}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.exitLoading}>
          <Text style={styles.exitLoadingLabel}>Back to sessions</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const total = deck.length;
  const canGoBack = index > 0;
  const canGoForward = index < total - 1;
  const lyricZoomControls = deckSlide?.kind === 'song' ? (
    <View style={styles.zoomControls}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zoom lyrics out"
        accessibilityState={{ disabled: lyricsZoom <= 0.5 }}
        disabled={lyricsZoom <= 0.5}
        onPress={() => setLyricsZoom((current) => Math.max(0.5, Math.round((current - 0.1) * 10) / 10))}
        style={[styles.zoomButton, lyricsZoom <= 0.5 && styles.disabledControl]}
      >
        <ZoomOut color={colors.white} size={18} />
      </Pressable>
      <Text style={styles.zoomValue}>{Math.round(lyricsZoom * 100)}%</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zoom lyrics in"
        accessibilityState={{ disabled: lyricsZoom >= 1.5 }}
        disabled={lyricsZoom >= 1.5}
        onPress={() => setLyricsZoom((current) => Math.min(1.5, Math.round((current + 0.1) * 10) / 10))}
        style={[styles.zoomButton, lyricsZoom >= 1.5 && styles.disabledControl]}
      >
        <ZoomIn color={colors.white} size={18} />
      </Pressable>
    </View>
  ) : null;

  return (
    <SafeAreaView edges={isFullscreen ? [] : undefined} style={[styles.screen, { backgroundColor: stageColor }]}>
      <StatusBar hidden={isFullscreen} style="light" animated />
      {!isFullscreen ? <>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit presentation" onPress={() => router.back()} style={styles.topButton}>
          <X color={colors.white} size={21} strokeWidth={1.8} />
        </Pressable>
        <Text numberOfLines={1} style={styles.sessionTitle}>{activeSession.name}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose template. Current: ${selectedTemplate?.name || (isLoadingTemplates ? 'Loading' : 'Default')}`}
          onPress={() => setShowTemplatePicker(true)}
          style={styles.templateButton}
        >
          <Layers3 color={colors.white} size={14} strokeWidth={1.8} />
          <Text numberOfLines={1} style={styles.templateButtonText}>{selectedTemplate?.name || (isLoadingTemplates ? 'Loading' : 'Template')}</Text>
          <ChevronDown color={colors.white} size={14} strokeWidth={1.8} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enter full screen"
          onPress={() => setIsFullscreen(true)}
          style={styles.fullscreenToggle}
        >
          <Maximize2 color={colors.white} size={17} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.counter}>{index + 1} / {total}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${total ? ((index + 1) / total) * 100 : 0}%` }]} />
      </View>
      </> : null}
      <View
        style={styles.stageArea}
        onLayout={(event) => setStageSize({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })}
      >
        {deckSlide && canvasScale > 0 ? (
          <View style={[styles.slideCanvas, { width: canvasDimensions.width, height: canvasDimensions.height, backgroundColor: stageColor }]}>
            {templateBackground?.type === 'image' ? (
              <Image
                source={{ uri: templateBackground.value }}
                resizeMode="cover"
                pointerEvents="none"
                style={[styles.canvasBackground, { opacity: templateBackground.opacity ?? 1 }]}
              />
            ) : null}
            {templateLayers.map((layer) => {
              if (layer.type === 'image') {
                const image = layer.element;
                const imageDimensions = {
                  ...image,
                  width: image.width ?? (image.height !== undefined ? slideDimensions.width : undefined),
                  height: image.height ?? (image.width !== undefined ? slideDimensions.height : undefined),
                };
                return (
                  <Image
                    key={image.id}
                    source={{ uri: image.url }}
                    resizeMode="stretch"
                    pointerEvents="none"
                    style={[
                      positionedElementStyle(imageDimensions, slideDimensions, canvasDimensions, null, null, image.position || 'top-right'),
                      styles.canvasImage,
                      { zIndex: layer.zIndex + 1 },
                    ]}
                  />
                );
              }
              const text = layer.element;
              const textBox = positionedElementStyle(
                { ...text, width: text.width ?? text.maxWidth, height: undefined },
                slideDimensions,
                canvasDimensions,
                null,
                null,
                text.position || 'top-left',
              );
              const textStyle = templateTextStyle(text, { fontSize: 16, color: colors.white, fontWeight: '400' }, canvasScale);
              return (
                <View key={text.id} style={[styles.templateTextBox, textBox, { zIndex: layer.zIndex + 1 }]}>
                  <RenderHtml
                    contentWidth={Number(textBox.width) || canvasDimensions.width}
                    baseStyle={{ ...textStyle, lineHeight: textStyle.fontSize }}
                    source={{ html: nativeHtml(text.content) }}
                    tagsStyles={{ p: { marginTop: 0, marginBottom: 0 } }}
                  />
                </View>
              );
            })}
            {deckSlide.kind === 'song' ? (
              <>
                <View style={[styles.templateTextBox, titleBox]}>
                  <Text style={[styles.songTitle, titleTextStyle, { lineHeight: titleTextStyle.fontSize * 1.1 }]}>
                    {song?.name || currentItem?.songName || 'Loading song'}
                  </Text>
                </View>
                <ScrollView
                  style={[styles.songContentBox, lyricsBox]}
                  showsVerticalScrollIndicator={false}
                >
                  {song ? (
                    <RenderHtml
                      contentWidth={Number(lyricsBox.width) || canvasDimensions.width}
                      defaultTextProps={{ selectable: true }}
                      baseStyle={{ ...scaledLyricsTextStyle, lineHeight: scaledLyricsTextStyle.fontSize * 1.25 }}
                      source={{ html: nativeHtml(song.lyrics?.trim() || 'Lyrics have not been added for this song yet.') }}
                      tagsStyles={{ p: { marginTop: 0, marginBottom: 0 } }}
                    />
                  ) : error ? (
                    <Text style={styles.slideError}>{error}</Text>
                  ) : (
                    <ActivityIndicator color={colors.saffronLight} />
                  )}
                </ScrollView>
                {song?.meaning?.trim() ? (
                  <ScrollView
                    style={[styles.songContentBox, meaningBox]}
                    showsVerticalScrollIndicator={false}
                  >
                    <RenderHtml
                      contentWidth={Number(meaningBox.width) || canvasDimensions.width}
                      defaultTextProps={{ selectable: true }}
                      baseStyle={{ ...meaningTextStyle, lineHeight: meaningTextStyle.fontSize * 1.25 }}
                      source={{ html: nativeHtml(song.meaning.trim()) }}
                      tagsStyles={{ p: { marginTop: 0, marginBottom: 0 } }}
                    />
                  </ScrollView>
                ) : null}
                {currentItem?.singerName || currentItem?.pitch ? (
                  <View style={[styles.templateTextBox, bottomLeftBox, styles.bottomText, { zIndex: (bottomLeftConfig?.zIndex ?? 23) + 1 }]}>
                    <Text style={bottomLeftTextStyle}>
                      Current: {currentItem.singerName ? <Text style={{ color: singerNameColor(currentItem.singerGender) }}>{currentItem.singerName}</Text> : null}
                      {currentItem.singerName && currentItem.pitch ? ' - ' : ''}
                      {currentItem.pitch}
                    </Text>
                  </View>
                ) : null}
                {nextItem ? (
                  <View style={[styles.templateTextBox, bottomRightBox, styles.bottomText, { zIndex: (bottomRightConfig?.zIndex ?? 24) + 1 }]}>
                    <Text style={[bottomRightTextStyle, { textAlign: bottomRightConfig?.textAlign || 'right' }]}>
                      Next: {nextItem.songName}
                      {nextItem.singerName ? <Text style={{ color: singerNameColor(nextItem.singerGender) }}> - {nextItem.singerName}</Text> : null}
                      {nextItem.pitch ? ` - ${nextItem.pitch}` : ''}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
      </View>
      {!isFullscreen ? <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous song"
          disabled={!canGoBack}
          onPress={() => setIndex((current) => Math.max(0, current - 1))}
          style={[styles.controlButton, !canGoBack && styles.disabledControl]}
        >
          <ArrowLeft color={colors.white} size={20} />
          <Text style={styles.controlLabel}>Previous</Text>
        </Pressable>
        {lyricZoomControls}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next song"
          disabled={!canGoForward}
          onPress={() => setIndex((current) => Math.min(total - 1, current + 1))}
          style={[styles.controlButton, styles.nextButton, !canGoForward && styles.disabledControl]}
        >
          <Text style={styles.controlLabel}>{canGoForward ? 'Next' : 'End'}</Text>
          <ArrowRight color={colors.white} size={20} />
        </Pressable>
      </View> : (
        <View pointerEvents="box-none" style={styles.fullscreenOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit full screen"
            onPress={() => setIsFullscreen(false)}
            style={[styles.fullscreenExit, { top: Math.max(12, insets.top + 10), right: Math.max(12, insets.right + 10) }]}
          >
            <Minimize2 color={colors.white} size={20} strokeWidth={1.8} />
          </Pressable>
          <View style={[styles.controls, styles.fullscreenControls, { bottom: Math.max(12, insets.bottom + 10) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous slide"
              disabled={!canGoBack}
              onPress={() => setIndex((current) => Math.max(0, current - 1))}
              style={[styles.controlButton, !canGoBack && styles.disabledControl]}
            >
              <ArrowLeft color={colors.white} size={20} />
              <Text style={styles.controlLabel}>Previous</Text>
            </Pressable>
            {lyricZoomControls}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next slide"
              disabled={!canGoForward}
              onPress={() => setIndex((current) => Math.min(total - 1, current + 1))}
              style={[styles.controlButton, styles.nextButton, !canGoForward && styles.disabledControl]}
            >
              <Text style={styles.controlLabel}>{canGoForward ? 'Next' : 'End'}</Text>
              <ArrowRight color={colors.white} size={20} />
            </Pressable>
          </View>
        </View>
      )}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowTemplatePicker(false)}
        presentationStyle="overFullScreen"
        transparent
        visible={showTemplatePicker}
      >
        <SafeAreaProvider style={styles.pickerSafeArea}>
          <View style={styles.pickerBackdrop}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close template picker" onPress={() => setShowTemplatePicker(false)} style={styles.pickerScrim} />
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <View>
                  <Text style={styles.pickerEyebrow}>PRESENTATION STYLE</Text>
                  <Text style={styles.pickerTitle}>Choose a template</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close template picker" onPress={() => setShowTemplatePicker(false)} style={styles.pickerClose}>
                  <X color={colors.ink} size={19} strokeWidth={1.8} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.templateList} showsVerticalScrollIndicator={false}>
                {isLoadingTemplates ? (
                  <ActivityIndicator color={colors.forest} style={styles.templateLoader} />
                ) : templates.length ? templates.map((template) => {
                  const selected = template.id === selectedTemplateId;
                  return (
                    <Pressable
                      key={template.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setSelectedTemplateId(template.id);
                        setIndex(0);
                        setShowTemplatePicker(false);
                      }}
                      style={[styles.templateOption, selected && styles.templateOptionSelected]}
                    >
                      <View style={styles.templateOptionCopy}>
                        <View style={styles.templateNameRow}>
                          <Text numberOfLines={1} style={styles.templateName}>{template.name}</Text>
                          {template.isDefault ? <Text style={styles.defaultBadge}>DEFAULT</Text> : null}
                        </View>
                        {template.description ? <Text numberOfLines={2} style={styles.templateDescription}>{template.description}</Text> : null}
                        <Text style={styles.templateMeta}>
                          {template.aspectRatio || '16:9'}  ·  {template.slides?.length || 1} {(template.slides?.length || 1) === 1 ? 'slide' : 'slides'}
                        </Text>
                      </View>
                      {selected ? <Layers3 color={colors.forest} size={18} /> : null}
                    </Pressable>
                  );
                }) : (
                  <Text style={styles.emptyTemplates}>No templates are available for this account.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.forestDeep },
  fullBackground: { ...StyleSheet.absoluteFill },
  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  slideCanvas: { position: 'relative', overflow: 'hidden' },
  canvasBackground: { ...StyleSheet.absoluteFill },
  canvasImage: { position: 'absolute' },
  templateTextBox: { position: 'absolute' },
  songContentBox: { position: 'absolute' },
  bottomText: { backgroundColor: 'rgba(16, 29, 23, 0.5)', paddingHorizontal: 8, paddingVertical: 4 },
  loadingScreen: { flex: 1, backgroundColor: colors.forestDeep, alignItems: 'center', justifyContent: 'center', padding: 28 },
  loadingText: { color: '#D0DDD3', fontSize: 13, marginTop: 12 },
  errorTitle: { color: colors.white, fontFamily: 'Georgia', fontSize: 22, textAlign: 'center' },
  errorText: { color: '#F0C4B8', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  exitLoading: { padding: 14, marginTop: 16 },
  exitLoadingLabel: { color: colors.saffronLight, fontSize: 14, fontWeight: '600' },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, gap: 5 },
  topButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  sessionTitle: { flex: 1, color: '#D0DDD3', fontSize: 11, textAlign: 'center', marginHorizontal: 3 },
  counter: { color: '#D0DDD3', fontSize: 11, fontVariant: ['tabular-nums'], minWidth: 42, textAlign: 'right' },
  progressTrack: { height: 2, backgroundColor: '#426756' },
  progressFill: { height: 2, backgroundColor: colors.saffronLight },
  templateButton: { minHeight: 34, maxWidth: 112, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 7, backgroundColor: '#426756' },
  templateButtonText: { color: colors.white, fontSize: 10, fontWeight: '600', flexShrink: 1 },
  fullscreenToggle: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  slide: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 14 },
  slideEyebrow: { color: '#E6C08B', fontSize: 10, fontWeight: '700', letterSpacing: 1.8, textAlign: 'center', marginBottom: 12 },
  songTitle: { color: colors.white, fontFamily: 'Georgia', fontSize: 28, lineHeight: 35, textAlign: 'center' },
  songMeta: { color: '#C3D2C8', fontSize: 12, textAlign: 'center', marginTop: 9 },
  lyricsRule: { height: 1, backgroundColor: '#426756', marginVertical: 24 },
  lyrics: { color: '#F7F4EC', fontFamily: 'Georgia', fontSize: 19, lineHeight: 34, textAlign: 'center' },
  meaning: { marginTop: 24 },
  slideError: { color: '#F0C4B8', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  lyricsLoader: { marginVertical: 26 },
  controls: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#426756' },
  controlButton: { flexShrink: 1, minHeight: 48, minWidth: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 4 },
  fullscreenOverlay: { ...StyleSheet.absoluteFill, zIndex: 50 },
  fullscreenExit: { position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 29, 23, 0.72)', zIndex: 51 },
  fullscreenControls: { position: 'absolute', left: 0, right: 0, borderTopWidth: 0, backgroundColor: 'rgba(16, 29, 23, 0.46)' },
  nextButton: { backgroundColor: '#426756' },
  zoomControls: { flexShrink: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 1, paddingHorizontal: 2, borderRadius: 8, backgroundColor: 'rgba(66, 103, 86, 0.82)' },
  zoomButton: { width: 32, height: 42, alignItems: 'center', justifyContent: 'center' },
  zoomValue: { minWidth: 32, color: colors.white, fontSize: 10, fontVariant: ['tabular-nums'], textAlign: 'center' },
  disabledControl: { opacity: 0.38 },
  controlLabel: { color: colors.white, fontSize: 13, fontWeight: '600' },
  pickerSafeArea: { flex: 1 },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 29, 23, 0.48)' },
  pickerScrim: { ...StyleSheet.absoluteFill },
  pickerSheet: { maxHeight: '78%', backgroundColor: colors.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  pickerHeader: { minHeight: 82, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  pickerEyebrow: { color: colors.saffron, fontSize: 9, fontWeight: '700', letterSpacing: 1.4, marginBottom: 4 },
  pickerTitle: { color: colors.ink, fontSize: 21, fontFamily: 'Georgia' },
  pickerClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  templateList: { paddingHorizontal: 16, paddingVertical: 12 },
  templateLoader: { paddingVertical: 24 },
  templateOption: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, marginBottom: 8 },
  templateOptionSelected: { borderColor: colors.forest, backgroundColor: '#EFF4ED' },
  templateOptionCopy: { flex: 1, marginRight: 12 },
  templateNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  templateName: { color: colors.ink, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  defaultBadge: { color: colors.forest, backgroundColor: colors.sage, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '700' },
  templateDescription: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  templateMeta: { color: colors.saffron, fontSize: 10, fontWeight: '600', marginTop: 5 },
  emptyTemplates: { color: colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 26 },
});