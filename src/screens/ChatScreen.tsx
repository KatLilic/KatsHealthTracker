import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import {
  getWeightEntries,
  getUserProfile,
  getMeasurements,
  getZepboundStats,
} from '../database/db';
import { useTheme } from '../theme/ThemeContext';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  canRetry?: boolean;
}

// AIML API Configuration - Your API key
const API_BASE = 'https://api.aimlapi.com/v1/chat/completions';
const AIML_API_KEY = '07ca0cb8d6e1417ba82420fdc3054fc6';
const MAX_CHATS_PER_HOUR = 10;
const CHAT_TIMESTAMPS_KEY = '@health_tracker_chat_timestamps';

// Persistent rate limiting functions
const loadChatTimestamps = async (): Promise<number[]> => {
  try {
    const data = await AsyncStorage.getItem(CHAT_TIMESTAMPS_KEY);
    if (data) {
      const timestamps = JSON.parse(data) as number[];
      const now = Date.now();
      const hourAgo = now - (60 * 60 * 1000);
      // Filter out timestamps older than 1 hour
      return timestamps.filter(t => t > hourAgo);
    }
  } catch (e) {
    console.log('Failed to load chat timestamps:', e);
  }
  return [];
};

const saveChatTimestamps = async (timestamps: number[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CHAT_TIMESTAMPS_KEY, JSON.stringify(timestamps));
  } catch (e) {
    console.log('Failed to save chat timestamps:', e);
  }
};

const getNextResetTime = (timestamps: number[]): number | null => {
  if (timestamps.length === 0) return null;
  if (timestamps.length < MAX_CHATS_PER_HOUR) return null;
  // The oldest timestamp will expire first, so add 1 hour to it
  const oldestTimestamp = Math.min(...timestamps);
  return oldestTimestamp + (60 * 60 * 1000);
};

export default function ChatScreen() {
  const { themeColors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [healthContext, setHealthContext] = useState('');
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [chatsRemaining, setChatsRemaining] = useState(MAX_CHATS_PER_HOUR);
  const [resetCountdown, setResetCountdown] = useState<string | null>(null);
  const [chatTimestamps, setChatTimestamps] = useState<number[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const lastUserMessage = useRef<string>('');
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load timestamps and update remaining count
  const refreshQuota = async () => {
    const timestamps = await loadChatTimestamps();
    setChatTimestamps(timestamps);
    setChatsRemaining(MAX_CHATS_PER_HOUR - timestamps.length);
    
    // Check if we need a countdown timer
    const nextReset = getNextResetTime(timestamps);
    if (nextReset && timestamps.length >= MAX_CHATS_PER_HOUR) {
      startCountdown(nextReset);
    } else {
      setResetCountdown(null);
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    }
  };

  const startCountdown = (resetTime: number) => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = resetTime - now;
      
      if (remaining <= 0) {
        setResetCountdown(null);
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
        refreshQuota(); // Refresh quota when timer expires
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setResetCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };
    
    updateCountdown();
    countdownInterval.current = setInterval(updateCountdown, 1000);
  };

  const recordChatSent = async () => {
    const newTimestamps = [...chatTimestamps, Date.now()];
    setChatTimestamps(newTimestamps);
    await saveChatTimestamps(newTimestamps);
    setChatsRemaining(MAX_CHATS_PER_HOUR - newTimestamps.length);
    
    // Start countdown if we hit the limit
    if (newTimestamps.length >= MAX_CHATS_PER_HOUR) {
      const nextReset = getNextResetTime(newTimestamps);
      if (nextReset) startCountdown(nextReset);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHealthContext();
      refreshQuota();
      
      return () => {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }
      };
    }, [])
  );

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '0',
          role: 'assistant',
          content:
            "Hi! I'm your AI health assistant 💕 I can analyze your health data and provide personalized summaries, insights, diet tips, Zepbound questions, exercise suggestions, and motivation for your weight loss journey. What would you like to know?",
          timestamp: new Date(),
        },
      ]);
      setConnectionOk(true); // AIML API is pre-configured
    }
  }, []);

  const loadHealthContext = async () => {
    try {
      const [weights, profile, measurements, zepStats] = await Promise.all([
        getWeightEntries(5),
        getUserProfile(),
        getMeasurements(3),
        getZepboundStats(),
      ]);

      const parts: string[] = [];

      if (profile?.height_cm) {
        const inches = profile.height_cm / 2.54;
        const feet = Math.floor(inches / 12);
        const rem = Math.round(inches % 12);
        parts.push(`Height: ${feet}'${rem}"`);
      }
      if (profile?.goal_weight_kg) {
        parts.push(`Goal weight: ${(profile.goal_weight_kg * 2.205).toFixed(1)} lbs`);
      }
      if (weights.length > 0) {
        parts.push(`Current weight: ${(weights[0].weight_kg * 2.205).toFixed(1)} lbs`);
        if (weights.length > 1) {
          const change = (weights[0].weight_kg - weights[weights.length - 1].weight_kg) * 2.205;
          parts.push(
            `Recent weight trend: ${change > 0 ? '+' : ''}${change.toFixed(1)} lbs over last ${weights.length} entries`
          );
        }
      }
      if (measurements.length > 0) {
        const m = measurements[0];
        if (m.waist_cm) parts.push(`Waist: ${(m.waist_cm / 2.54).toFixed(1)} in`);
        if (m.hips_cm) parts.push(`Hips: ${(m.hips_cm / 2.54).toFixed(1)} in`);
        if (m.chest_cm) parts.push(`Chest: ${(m.chest_cm / 2.54).toFixed(1)} in`);
      }
      // Add Zepbound context
      if (zepStats) {
        if (zepStats.currentDose) parts.push(`Current Zepbound dose: ${zepStats.currentDose}mg`);
        if (zepStats.totalShots) parts.push(`Total shots taken: ${zepStats.totalShots}`);
        if (zepStats.firstShotDate) {
          const days = Math.floor((Date.now() - new Date(zepStats.firstShotDate).getTime()) / 86400000);
          parts.push(`Days on Zepbound: ${days}`);
        }
      }

      setHealthContext(parts.join(', '));
    } catch (e) {
      console.error('Failed to load health context:', e);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = async (retryText?: string) => {
    const text = (retryText || inputText).trim();
    if (!text || isLoading) return;

    lastUserMessage.current = text;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    if (!retryText) {
      setMessages((prev) => [...prev, userMessage]);
      setInputText('');
    }
    setIsLoading(true);
    scrollToBottom();

    try {
      const currentMessages = retryText ? messages : [...messages, userMessage];
      const history = currentMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => ({ role: m.role as string, content: m.content }));

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AIML_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a warm, supportive AI health assistant helping someone on their weight loss journey with Zepbound (tirzepatide). Provide personalized summaries and insights based on their data. Be encouraging, helpful, and concise. Use a friendly tone with occasional emojis. Give evidence-based advice. Keep responses under 150 words unless the user asks for detail.' +
                (healthContext ? '\n\nUser health data: ' + healthContext : ''),
            },
            ...history,
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errBody = await response.json();
          errorDetail = errBody?.error?.message || '';
        } catch {
          errorDetail = '';
        }

        if (response.status === 429) {
          throw new Error("RATE_LIMIT:You've sent too many requests. Please wait a moment and try again.");
        } else if (response.status === 500 || response.status === 503) {
          throw new Error('SERVER_ERROR:API is temporarily unavailable. Please try again in a few minutes.');
        } else {
          throw new Error(`API_ERROR:API error ${response.status}${errorDetail ? ': ' + errorDetail : ''}`);
        }
      }

      const result = await response.json();
      const aiContent =
        result.choices?.[0]?.message?.content ||
        'Sorry, I had trouble responding. Please try again!';

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev.filter((m) => m.role !== 'error'), aiMessage]);
      setConnectionOk(true);
      await recordChatSent();
      scrollToBottom();
    } catch (error: any) {
      const errorStr = error?.message || 'Unknown error';
      let displayMessage = '';
      let canRetry = true;

      if (errorStr.startsWith('RATE_LIMIT:')) {
        displayMessage = '⏳ ' + errorStr.replace('RATE_LIMIT:', '');
      } else if (errorStr.startsWith('SERVER_ERROR:')) {
        displayMessage = '⚠️ ' + errorStr.replace('SERVER_ERROR:', '');
      } else if (errorStr.startsWith('API_ERROR:')) {
        displayMessage = '⚠️ ' + errorStr.replace('API_ERROR:', '');
      } else if (errorStr.includes('Network request failed') || errorStr.includes('TypeError')) {
        displayMessage = '📶 No internet connection. Please check your network and try again.';
      } else {
        displayMessage = "I'm having trouble connecting. Error: " + errorStr;
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'error',
        content: displayMessage,
        timestamp: new Date(),
        canRetry,
      };
      setMessages((prev) => [...prev.filter((m) => m.role !== 'error'), errorMessage]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastUserMessage.current) {
      setMessages((prev) => prev.filter((m) => m.role !== 'error'));
      sendMessage(lastUserMessage.current);
    }
  };

  const quickQuestions = [
    "How's my progress?",
    "Meal ideas",
    "Zepbound tips",
    "Need motivation",
  ];

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isError = item.role === 'error';

    if (isError) {
      return (
        <View style={styles.errorBubble}>
          <View style={styles.errorContent}>
            <Text style={styles.errorText}>{item.content}</Text>
            {item.canRetry && (
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: themeColors.primaryLight }]} 
                onPress={handleRetry}
              >
                <Ionicons name="refresh" size={16} color={themeColors.primary} />
                <Text style={[styles.retryText, { color: themeColors.primary }]}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: themeColors.primaryLight }]}>
            <Ionicons name="sparkles" size={16} color={themeColors.primary} />
          </View>
        )}
        <View
          style={[
            styles.bubbleContent,
            isUser 
              ? [styles.userContent, { backgroundColor: themeColors.primary }] 
              : styles.aiContent,
          ]}
        >
          <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: themeColors.primaryLight }]}>
          <Ionicons name="sparkles" size={20} color={themeColors.primary} />
        </View>
        <Text style={styles.headerTitle}>AI Summary</Text>
        <View style={styles.rateLimitBadge}>
          {resetCountdown ? (
            <View style={styles.countdownContainer}>
              <Ionicons name="time-outline" size={14} color={colors.error} />
              <Text style={[styles.rateLimitText, { color: colors.error, marginLeft: 4 }]}>
                {resetCountdown}
              </Text>
            </View>
          ) : (
            <Text style={[styles.rateLimitText, { color: chatsRemaining <= 2 ? colors.error : themeColors.primary }]}>
              {chatsRemaining}/{MAX_CHATS_PER_HOUR} left
            </Text>
          )}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          messages.length === 1 ? (
            <View style={styles.quickQuestionsContainer}>
              <Text style={styles.quickQuestionsLabel}>Quick questions:</Text>
              <View style={styles.quickQuestionsGrid}>
                {quickQuestions.map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.quickQuestionBtn, { borderColor: themeColors.primary }]}
                    onPress={() => setInputText(q)}
                  >
                    <Text style={[styles.quickQuestionText, { color: themeColors.primary }]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null
        }
      />

      {isLoading && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color={themeColors.primary} />
          <Text style={styles.typingText}>AI is thinking...</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask me anything about your health..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() && !isLoading ? themeColors.primary : colors.border },
            ]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() && !isLoading ? '#fff' : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 10 : 50,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  rateLimitBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateLimitText: {
    fontSize: 12,
    fontWeight: '600',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-end',
  },
  userBubble: { 
    justifyContent: 'flex-end',
  },
  aiBubble: { 
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  bubbleContent: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
  },
  userContent: {
    borderBottomRightRadius: 4,
    marginLeft: 'auto',
  },
  aiContent: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: { 
    fontSize: 15, 
    lineHeight: 21,
  },
  userText: { 
    color: '#fff',
  },
  aiText: { 
    color: colors.text,
  },
  errorBubble: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  errorContent: {
    backgroundColor: colors.error + '20',
    borderWidth: 1,
    borderColor: colors.error + '40',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  quickQuestionsContainer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  quickQuestionsLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  quickQuestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickQuestionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1.5,
  },
  quickQuestionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  typingText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
});
