/**
 * Content Moderation Service
 * 
 * Validates user-generated content against blocked words database.
 * Used for comments, reviews, messages, and other user content.
 */

import { getServiceRoleClient } from '@/lib/supabase';

interface BlockedWord {
  id: string;
  word: string;
  category: string;
  severity: string;
  is_regex: boolean;
}

interface ModerationResult {
  isBlocked: boolean;
  blockedWords: string[];
  categories: string[];
  highestSeverity: string | null;
}

// Cache blocked words for performance (refresh every 5 minutes)
let cachedWords: BlockedWord[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch blocked words from database with caching
 */
async function getBlockedWords(): Promise<BlockedWord[]> {
  const now = Date.now();
  
  // Return cached words if still valid
  if (cachedWords && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedWords;
  }
  
  try {
    const supabase = getServiceRoleClient();
    if (!supabase) {
      console.warn('[ContentModeration] No service role client available');
      return [];
    }
    
    const { data, error } = await supabase
      .from('blocked_words')
      .select('id, word, category, severity, is_regex');
    
    if (error) {
      console.error('[ContentModeration] Error fetching blocked words:', error);
      return cachedWords || [];
    }
    
    cachedWords = data || [];
    cacheTimestamp = now;
    return cachedWords;
  } catch (error) {
    console.error('[ContentModeration] Error:', error);
    return cachedWords || [];
  }
}

/**
 * Check if content contains blocked words
 */
export async function moderateContent(content: string): Promise<ModerationResult> {
  const result: ModerationResult = {
    isBlocked: false,
    blockedWords: [],
    categories: [],
    highestSeverity: null,
  };
  
  if (!content || content.trim().length === 0) {
    return result;
  }
  
  const blockedWords = await getBlockedWords();
  if (blockedWords.length === 0) {
    return result;
  }
  
  const contentLower = content.toLowerCase();
  const severityOrder = ['low', 'medium', 'high', 'critical'];
  
  for (const blocked of blockedWords) {
    let isMatch = false;
    
    if (blocked.is_regex) {
      try {
        const regex = new RegExp(blocked.word, 'gi');
        isMatch = regex.test(content);
      } catch {
        // Invalid regex, skip
        continue;
      }
    } else {
      // Word boundary matching for non-regex
      const wordRegex = new RegExp(`\\b${escapeRegex(blocked.word)}\\b`, 'gi');
      isMatch = wordRegex.test(contentLower);
    }
    
    if (isMatch) {
      result.isBlocked = true;
      result.blockedWords.push(blocked.word);
      
      if (!result.categories.includes(blocked.category)) {
        result.categories.push(blocked.category);
      }
      
      // Update highest severity
      const currentIndex = result.highestSeverity 
        ? severityOrder.indexOf(result.highestSeverity) 
        : -1;
      const newIndex = severityOrder.indexOf(blocked.severity);
      
      if (newIndex > currentIndex) {
        result.highestSeverity = blocked.severity;
      }
    }
  }
  
  return result;
}

/**
 * Censor blocked words in content (replace with asterisks)
 */
export async function censorContent(content: string): Promise<string> {
  if (!content || content.trim().length === 0) {
    return content;
  }
  
  const blockedWords = await getBlockedWords();
  if (blockedWords.length === 0) {
    return content;
  }
  
  let censored = content;
  
  for (const blocked of blockedWords) {
    if (blocked.is_regex) {
      try {
        const regex = new RegExp(blocked.word, 'gi');
        censored = censored.replace(regex, (match) => '*'.repeat(match.length));
      } catch {
        // Invalid regex, skip
        continue;
      }
    } else {
      const wordRegex = new RegExp(`\\b${escapeRegex(blocked.word)}\\b`, 'gi');
      censored = censored.replace(wordRegex, (match) => '*'.repeat(match.length));
    }
  }
  
  return censored;
}

/**
 * Clear the blocked words cache (call after admin updates)
 */
export function clearBlockedWordsCache(): void {
  cachedWords = null;
  cacheTimestamp = 0;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
