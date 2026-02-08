// AI Service for health insights using AIML API
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_KEY_STORAGE = '@health_tracker_aiml_key';
const AIML_API_BASE = 'https://api.aimlapi.com/v1/chat/completions';

// AIML API key 
const AIML_API_KEY = '07ca0cb8d6e1417ba82420fdc3054fc6';

export interface HealthData {
  currentWeight?: number;
  goalWeight?: number;
  height?: number;
  recentWeightChange?: number;
  measurements?: {
    waist?: number;
    hips?: number;
  };
  lastZepboundDose?: number;
  daysSinceLastShot?: number;
  weeksOnMedication?: number;
}

export interface AIInsight {
  type: 'tip' | 'prediction' | 'recommendation' | 'motivation';
  title: string;
  content: string;
  icon: string;
}

// Store API key securely
export async function setApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORAGE, key);
}

// Get stored API key (or use hardcoded)
export async function getApiKey(): Promise<string | null> {
  const storedKey = await AsyncStorage.getItem(API_KEY_STORAGE);
  return storedKey || AIML_API_KEY;
}

// Check if API key is set
export async function hasApiKey(): Promise<boolean> {
  return true; // Always true since we have hardcoded key
}

// Main function to get AI insights using AIML API
export async function getHealthInsights(data: HealthData): Promise<AIInsight[]> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    return getOfflineInsights(data);
  }

  try {
    const prompt = buildPrompt(data);

    const response = await fetch(AIML_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // AIML API supports various models
        messages: [
          {
            role: 'system',
            content: `You are a supportive health coach helping someone on their weight loss journey with Zepbound (tirzepatide). 
            Provide helpful, encouraging insights based on their data. Be warm and supportive but also informative.
            Always respond with valid JSON array of insights. Each insight has: type (tip|prediction|recommendation|motivation), title (short), content (2-3 sentences), icon (Ionicons name).`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.log('AIML API error:', response.status, response.statusText);
      return getOfflineInsights(data);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as AIInsight[];
      }
    } catch (parseError) {
      console.log('Failed to parse AIML response');
    }

    return getOfflineInsights(data);
  } catch (error) {
    console.log('AIML service error:', error);
    return getOfflineInsights(data);
  }
}

// Build prompt from health data
function buildPrompt(data: HealthData): string {
  const parts: string[] = ['Here is my health data:'];

  if (data.currentWeight) {
    parts.push(`Current weight: ${(data.currentWeight * 2.205).toFixed(1)} lbs`);
  }
  if (data.goalWeight) {
    parts.push(`Goal weight: ${(data.goalWeight * 2.205).toFixed(1)} lbs`);
  }
  if (data.currentWeight && data.goalWeight) {
    const toGo = (data.currentWeight - data.goalWeight) * 2.205;
    parts.push(`${toGo > 0 ? toGo.toFixed(1) : 0} lbs to goal`);
  }
  if (data.height) {
    const totalInches = data.height / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    parts.push(`Height: ${feet}'${inches}"`);
  }
  if (data.recentWeightChange !== undefined) {
    const change = data.recentWeightChange * 2.205;
    parts.push(`Recent weight change: ${change > 0 ? '+' : ''}${change.toFixed(1)} lbs`);
  }
  if (data.measurements?.waist) {
    parts.push(`Waist: ${(data.measurements.waist / 2.54).toFixed(1)} inches`);
  }
  if (data.lastZepboundDose) {
    parts.push(`Current Zepbound dose: ${data.lastZepboundDose}mg`);
  }
  if (data.daysSinceLastShot !== undefined) {
    parts.push(`Days since last injection: ${data.daysSinceLastShot}`);
  }
  if (data.weeksOnMedication) {
    parts.push(`Weeks on Zepbound: ${data.weeksOnMedication}`);
  }

  parts.push('\nPlease provide 3-4 personalized insights as a JSON array.');

  return parts.join('\n');
}

// Fallback insights when API key not set or API fails
function getOfflineInsights(data: HealthData): AIInsight[] {
  const insights: AIInsight[] = [];

  // Add motivational insight
  if (data.currentWeight && data.goalWeight) {
    const progress = ((data.currentWeight - data.goalWeight) / data.currentWeight) * 100;
    if (data.currentWeight > data.goalWeight) {
      insights.push({
        type: 'motivation',
        title: 'Keep Going! 💪',
        content: `You're working towards your goal! Every day is progress. Small consistent steps lead to big results over time.`,
        icon: 'heart',
      });
    } else {
      insights.push({
        type: 'motivation',
        title: 'Goal Reached! 🎉',
        content: `Amazing work! You've reached your goal weight. Focus on maintaining your healthy habits.`,
        icon: 'trophy',
      });
    }
  }

  // Weight change insight
  if (data.recentWeightChange !== undefined) {
    if (data.recentWeightChange < 0) {
      insights.push({
        type: 'tip',
        title: 'Great Progress!',
        content: `You've lost ${Math.abs(data.recentWeightChange * 2.205).toFixed(1)} lbs recently. A healthy rate is 1-2 lbs per week - you're doing great!`,
        icon: 'trending-down',
      });
    } else if (data.recentWeightChange > 0.5) {
      insights.push({
        type: 'tip',
        title: 'Weight Fluctuation',
        content: `Small fluctuations are normal! They can be caused by water retention, sodium, or hormones. Focus on the overall trend.`,
        icon: 'analytics',
      });
    }
  }

  // Zepbound insight
  if (data.daysSinceLastShot !== undefined) {
    if (data.daysSinceLastShot >= 7) {
      insights.push({
        type: 'recommendation',
        title: 'Injection Reminder',
        content: `It's been ${data.daysSinceLastShot} days since your last Zepbound injection. Time to take your weekly dose!`,
        icon: 'medical',
      });
    } else if (data.daysSinceLastShot < 3) {
      insights.push({
        type: 'tip',
        title: 'Post-Injection Tips',
        content: `Fresh injection! Stay hydrated and eat smaller portions as appetite suppression may be stronger these first few days.`,
        icon: 'water',
      });
    }
  }

  // Prediction based on progress
  if (data.currentWeight && data.goalWeight && data.recentWeightChange && data.recentWeightChange < 0) {
    const toGo = data.currentWeight - data.goalWeight;
    const weeklyLoss = Math.abs(data.recentWeightChange);
    if (toGo > 0 && weeklyLoss > 0) {
      const weeksToGoal = Math.ceil(toGo / weeklyLoss);
      insights.push({
        type: 'prediction',
        title: 'Goal Estimate',
        content: `At your current pace, you could reach your goal in approximately ${weeksToGoal} weeks. Keep up the amazing work!`,
        icon: 'calendar',
      });
    }
  }

  // General health tip
  insights.push({
    type: 'recommendation',
    title: 'Stay Active',
    content: `Even light activity like walking 30 minutes daily can boost your results and improve mood. Find movement you enjoy!`,
    icon: 'walk',
  });

  return insights.slice(0, 4);
}

// Get meal suggestions (simplified offline version)
export async function getMealSuggestions(): Promise<string[]> {
  return [
    '🥗 Greek yogurt with berries and a sprinkle of granola',
    '🍳 Egg white omelet with spinach and feta cheese',
    '🥑 Avocado toast on whole grain bread with cherry tomatoes',
    '🍗 Grilled chicken salad with mixed greens and light vinaigrette',
    '🐟 Baked salmon with roasted vegetables',
    '🥣 Overnight oats with almond butter and banana',
    '🌯 Turkey lettuce wraps with hummus',
    '🍲 Vegetable soup with lean protein',
  ];
}

// Get exercise suggestions
export async function getExerciseSuggestions(): Promise<string[]> {
  return [
    '🚶 30-minute brisk walk',
    '🧘 20-minute yoga flow',
    '💪 15-minute bodyweight workout',
    '🏊 Swimming laps for 30 minutes',
    '🚴 Cycling for 20-30 minutes',
    '🎵 Dance workout video (fun cardio!)',
    '🏋️ Light resistance training',
    '🧘‍♀️ Stretching and mobility work',
  ];
}
