import OpenAI from 'openai';

// Initialize the OpenAI client with Hugging Face endpoint
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

// Configure OpenAI client with better timeout settings
const openai = new OpenAI({
  apiKey: apiKey || 'hf_dummy_key', // Use a dummy key if none provided
  baseURL: "https://nc4r71glhhp1qbx8.us-east-1.aws.endpoints.huggingface.cloud/v1/",
  dangerouslyAllowBrowser: true, // Required for client-side usage
  timeout: 10000, // 10 second timeout for faster feedback
  maxRetries: 2 // Retry failed requests twice
});

// Simple cache for repeated questions
const questionCache = new Map<string, string>();

/**
 * 
 * 
 * @param framework1 - Name of the first framework
 * @param framework2 - Name of the second framework
 * @param question1 - The first question text
 * @param question2 - The second question text
 * @param thematicConnection - Optional thematic connection between frameworks
 * @param similarityScore - Optional similarity score between questions
 * @returns A merged question text
 */
export async function mergeQuestionsWithAI(
  framework1: string,
  framework2: string,
  question1: string,
  question2: string,
  thematicConnection?: string,
  similarityScore?: number
): Promise<string> {
  try {
    // Input validation
    if (!question1?.trim() || !question2?.trim()) {
      throw new Error('Question texts cannot be empty');
    }
    
    if (!framework1?.trim() || !framework2?.trim()) {
      throw new Error('Framework names cannot be empty');
    }

    // Normalize questions for comparison
    const normalizeQuestion = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalizedQ1 = normalizeQuestion(question1);
    const normalizedQ2 = normalizeQuestion(question2);

    // If questions are identical after normalization, return the original question
    if (normalizedQ1 === normalizedQ2) {
      return question1; // Return the original question as is
    }
    
    // Create a cache key based on inputs
    const cacheKey = `${framework1}|${framework2}|${question1}|${question2}|${thematicConnection || ''}|${similarityScore || ''}`;
    
    // Check cache first
    if (questionCache.has(cacheKey)) {
      return questionCache.get(cacheKey)!;
    }
    
    // Optimized prompt for smarter merging
    const prompt = `Analyze these two questions from different frameworks and create a meaningful merged question:

Framework 1 (${framework1}): "${question1}"
Framework 2 (${framework2}): "${question2}"
${thematicConnection ? `Thematic connection: ${thematicConnection}` : ''}
${similarityScore ? `Similarity score: ${similarityScore}` : ''}

Instructions:
1. If the questions are asking exactly the same thing (even with slightly different wording), return the clearer/more complete version
2. If the questions are very similar but have different aspects, create a merged question that captures both aspects
3. If the questions are different but related, create a meaningful combination that addresses both frameworks' requirements
4. The merged question should:
   - Be clear and complete
   - Maintain the original meaning
   - Use consistent terminology
   - Be specific and actionable
   - End with a question mark
   - Be under 45 words

Respond with ONLY the merged question:`;

    const response = await openai.chat.completions.create({
      model: "tgi",
      messages: [
        { role: "system", content: "You are an expert at analyzing and merging sustainability framework questions. You create precise, meaningful merged questions that maintain the original intent while being clear and actionable." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 100,
      top_p: 0.9,
    });
    
    let mergedQuestion = response.choices[0]?.message?.content?.trim() || '';
    
    // Enhanced validation
    if (!validateResponse(mergedQuestion, question1, question2)) {
      // For identical or very similar questions, use the clearer version
      if (similarityScore && similarityScore > 0.8) {
        return question1.length > question2.length ? question1 : question2;
      }
      
      // Try fallback for other cases
      const fallbackResponse = await generateFallbackQuestion(
        framework1, framework2, question1, question2, thematicConnection
      );
      
      if (fallbackResponse && validateResponse(fallbackResponse, question1, question2)) {
        mergedQuestion = fallbackResponse;
      } else {
        // If all else fails, use the clearer original question
        return question1.length > question2.length ? question1 : question2;
      }
    }
    
    // Ensure proper formatting
    mergedQuestion = ensureFormattingRequirements(mergedQuestion);
    
    // Store in cache
    questionCache.set(cacheKey, mergedQuestion);
    
    // Limit cache size
    if (questionCache.size > 100) {
      const firstKey = questionCache.keys().next().value;
      questionCache.delete(firstKey);
    }
    
    return mergedQuestion;
  } catch (error) {
    console.error('Error merging questions:', error);
    
    // For identical questions, return the original
    if (question1.toLowerCase().trim() === question2.toLowerCase().trim()) {
      return question1;
    }
    
    // For other errors, use the clearer original question
    return question1.length > question2.length ? question1 : question2;
  }
}

/**
 * Validates if the generated response meets quality criteria
 */
function validateResponse(text: string, question1: string, question2: string): boolean {
  if (!text || text.length < 10) return false;
  
  // Must end with question mark
  if (!text.includes('?')) return false;
  
  // Check for critical issues
  if (text.includes('<') && text.includes('>')) return false;
  if (text.includes('[Listed Entity]')) return false;
  
  // Check if it contains key terms from both original questions
  // Extract meaningful keywords from both questions
  const keywords1 = extractKeywords(question1);
  const keywords2 = extractKeywords(question2);
  
  // Must contain at least one key term from each original question
  let hasKeywordFromQ1 = false;
  let hasKeywordFromQ2 = false;
  
  for (const keyword of keywords1) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      hasKeywordFromQ1 = true;
      break;
    }
  }
  
  for (const keyword of keywords2) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      hasKeywordFromQ2 = true;
      break;
    }
  }
  
  return hasKeywordFromQ1 && hasKeywordFromQ2;
}


function extractKeywords(text: string): string[] {
  // Simple implementation - extract words with 4+ chars that aren't stopwords
  const stopwords = new Set(['and', 'the', 'for', 'with', 'that', 'this', 'your', 'have', 'from', 'are', 'does']);
  return text
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopwords.has(word.toLowerCase()))
    .map(word => word.replace(/[,.?;:'"!()]/g, '')) // Remove punctuation
    .filter(Boolean);
}

/**
 * Generate a fallback question with more explicit instructions
 */
async function generateFallbackQuestion(
  framework1: string,
  framework2: string,
  question1Text: string,
  question2Text: string,
  thematicConnection?: string
): Promise<string> {
  try {
    const fallbackPrompt = `
Analyze these two sustainability questions and determine if they have the same context:
1. "${question1Text.trim()}"
2. "${question2Text.trim()}"

BE VERY STRICT in your analysis:
- Do they ask about exactly the same sustainability topic?
- Would the exact same answer satisfy both questions completely?
- Do they share multiple key terminology and concepts?
- Are they essentially asking the same thing in different ways?

If they have different contexts or are only tangentially related, respond with "DIFFERENT_CONTEXT" only.

If they truly have the same context, create one merged question that:
- Includes the main topic from question 1 (about ${extractMainTopic(question1Text)})
- Includes the main topic from question 2 (about ${extractMainTopic(question2Text)})
- Verifies that answering it would satisfy both original framework requirements
- Ends with a question mark
- Is under 45 words

RESPOND WITH ONLY THE MERGED QUESTION OR "DIFFERENT_CONTEXT".`;

    const response = await openai.chat.completions.create({
      model: "tgi",
      messages: [
        { role: "system", content: "You combine questions accurately and concisely." },
        { role: "user", content: fallbackPrompt }
      ],
      temperature: 0.2,
      max_tokens: 75,
    });
    
    return response.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Fallback generation failed:', error);
    return '';
  }
}

/**
 * Extract the main topic from a question for use in fallback prompt
 */
function extractMainTopic(text: string): string {
  const keywords = extractKeywords(text);
  return keywords.slice(0, 3).join(' ');
}

/**
 * Create a deterministic fallback when AI generation fails
 */
function createDeterministicFallback(
  framework1: string,
  framework2: string,
  question1Text: string,
  question2Text: string
): string {
  // Extract first part of each question (first 5-7 words)
  const q1Start = question1Text.split(' ').slice(0, 5).join(' ');
  const q2Start = question2Text.split(' ').slice(0, 5).join(' ');
  
  // Random emoji selection
  const emojis = ['🌟', '🔄', '🌱', '🌍', '⚡', '💼', '🔍', '🛡️', '🤝', '📊', '⚖️', '🌐'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  return `${emoji} How does ${q1Start.replace(/[?.,]+$/, '')} relate to ${q2Start.replace(/[?.,]+$/, '')}?`;
}

/**
 * Ensure the merged question has required formatting
 */
function ensureFormattingRequirements(text: string): string {
  // List of valid starting emojis
  const validEmojis = ['🌟', '🔄', '🌱', '🌍', '⚡', '💼', '🔍', '🛡️', '🤝', '📊', '⚖️', '🌐'];
  
  // Check if text starts with one of the valid emojis
  const startsWithValidEmoji = validEmojis.some(emoji => text.startsWith(emoji));
  
  // If not, add a random emoji at the start
  if (!startsWithValidEmoji) {
    const randomEmoji = validEmojis[Math.floor(Math.random() * validEmojis.length)];
    text = `${randomEmoji} ${text}`;
  }
  
  // Ensure it ends with a question mark
  if (!text.endsWith('?')) {
    text = text.replace(/[.!]*$/, '') + '?';
  }
  
  return text;
}