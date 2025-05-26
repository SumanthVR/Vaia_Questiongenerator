import { Framework, Question, ApiQuestion } from "./types";
import { mergeQuestionsWithAI } from './openai';

// Function to load frameworks from the JSON file
export const loadFrameworksFromJson = async (): Promise<Framework[]> => {
  try {
    const response = await fetch('/prism.frameworks.json');
    if (!response.ok) {
      throw new Error(`Failed to load frameworks: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Map the JSON data to our Framework type
    const frameworks: Framework[] = data.map((item: any) => ({
      id: item._id.$oid || item._id,
      name: item.name,
      questionCount: item.questions?.length || 0,
      description: item.description
    }));
    
    return frameworks;
  } catch (error) {
    console.error("Error loading frameworks:", error);
    throw error;
  }
};

// Function to get questions for a specific framework
export const getQuestionsForFramework = async (frameworkName: string): Promise<any[]> => {
  try {
    const response = await fetch('/prism.frameworks.json');
    if (!response.ok) {
      throw new Error(`Failed to load frameworks: ${response.status}`);
    }
    
    const data = await response.json();
    const framework = data.find((item: any) => item.name === frameworkName);
    
    if (!framework) {
      return [];
    }
    
    return framework.questions || [];
  } catch (error) {
    console.error(`Error loading questions for ${frameworkName}:`, error);
    return [];
  }
};

// Get framework description if available
export const getFrameworkDescription = async (frameworkName: string): Promise<string> => {
  try {
    const response = await fetch('/prism.frameworks.json');
    if (!response.ok) {
      throw new Error(`Failed to load frameworks: ${response.status}`);
    }
    
    const data = await response.json();
    const framework = data.find((item: any) => item.name === frameworkName);
    
    if (!framework) {
      return '';
    }
    
    return framework.description || '';
  } catch (error) {
    console.error(`Error loading description for ${frameworkName}:`, error);
    return '';
  }
};

// Generate questions based on selected frameworks
export const generateQuestionsFromFrameworks = async (
  count: number, 
  frameworks: string[]
): Promise<Question[]> => {
  if (frameworks.length < 2) {
    return [];
  }
  
  // Load all framework data in parallel
  const frameworkDataPromises = frameworks.map(async (framework) => {
    const [questions, description] = await Promise.all([
      getQuestionsForFramework(framework),
      getFrameworkDescription(framework)
    ]);
    return { framework, questions, description };
  });
  
  const frameworkData = await Promise.all(frameworkDataPromises);
  
  // Create lookup maps for faster access
  const allFrameworkQuestions: Record<string, any[]> = {};
  const frameworkDescriptions: Record<string, string> = {};
  
  frameworkData.forEach(({ framework, questions, description }) => {
    allFrameworkQuestions[framework] = questions;
    frameworkDescriptions[framework] = description;
  });

  // Generate framework pairs and pre-calculate thematic connections
  const frameworkPairs: Array<{
    framework1: string,
    framework2: string,
    thematicConnection: string
  }> = [];
  
  for (let i = 0; i < frameworks.length; i++) {
    for (let j = i + 1; j < frameworks.length; j++) {
      const framework1 = frameworks[i];
      const framework2 = frameworks[j];
      frameworkPairs.push({
        framework1,
        framework2,
        thematicConnection: findThematicConnection(
          framework1,
          framework2,
          frameworkDescriptions[framework1],
          frameworkDescriptions[framework2]
        )
      });
    }
  }

  // Process questions in chunks for better performance
  const CHUNK_SIZE = 50; // Process 50 question pairs at a time
  const allQuestionPairs: Array<{
    framework1: string,
    framework2: string,
    question1: any,
    question2: any,
    score: number,
    thematicConnection: string
  }> = [];

  // Process framework pairs in chunks
  for (let i = 0; i < frameworkPairs.length; i += CHUNK_SIZE) {
    const chunk = frameworkPairs.slice(i, i + CHUNK_SIZE);
    const chunkPromises = chunk.map(async ({ framework1, framework2, thematicConnection }) => {
      const questions1 = allFrameworkQuestions[framework1];
      const questions2 = allFrameworkQuestions[framework2];
      
      if (!questions1.length || !questions2.length) return [];

      // Use a more efficient similarity calculation
      const pairs = [];
      for (const q1 of questions1) {
        for (const q2 of questions2) {
          const score = calculateQuestionSimilarity(q1, q2);
          if (score > 0) {
            pairs.push({
              framework1,
              framework2,
              question1: q1,
              question2: q2,
              score,
              thematicConnection
            });
          }
        }
      }
      return pairs;
    });

    const chunkResults = await Promise.all(chunkPromises);
    allQuestionPairs.push(...chunkResults.flat());
  }

  // Sort and take top N pairs
  allQuestionPairs.sort((a, b) => b.score - a.score);
  const selectedPairs = allQuestionPairs.slice(0, count);

  // Process questions in larger batches for better throughput
  const BATCH_SIZE = 10; // Increased from 5 to 10
  const generatedQuestions: Question[] = [];

  // Process in batches with parallel execution
  for (let batchStart = 0; batchStart < selectedPairs.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, selectedPairs.length);
    const batch = selectedPairs.slice(batchStart, batchEnd);
    
    const batchPromises = batch.map((pair, index) => 
      createMergedQuestion(
        pair.framework1,
        pair.framework2,
        pair.question1,
        pair.question2,
        generatedQuestions.length + index,
        pair.thematicConnection
      )
    );

    const batchResults = await Promise.all(batchPromises);
    const validQuestions = batchResults.filter((q): q is Question => q !== null);
    generatedQuestions.push(...validQuestions);
    
    // If we have enough questions, stop processing
    if (generatedQuestions.length >= count) {
      break;
    }
  }

  // If we still need more questions, try additional pairs
  if (generatedQuestions.length < count && allQuestionPairs.length > count) {
    const additionalPairs = allQuestionPairs.slice(count, count * 2);
    const additionalPromises = additionalPairs
      .slice(0, count - generatedQuestions.length)
      .map((pair, index) => 
        createMergedQuestion(
          pair.framework1,
          pair.framework2,
          pair.question1,
          pair.question2,
          generatedQuestions.length + index,
          pair.thematicConnection
        )
      );

    const additionalResults = await Promise.all(additionalPromises);
    const validAdditionalQuestions = additionalResults.filter((q): q is Question => q !== null);
    generatedQuestions.push(...validAdditionalQuestions);
  }

  if (generatedQuestions.length === 0 && count > 0) {
    throw new Error("Failed to generate any questions. Please try again.");
  }

  return generatedQuestions.slice(0, count);
};

// Helper function to get random frameworks
function getRandomFrameworks(frameworks: string[], count: number): string[] {
  if (frameworks.length <= count) return frameworks;
  
  const result: string[] = [];
  const availableFrameworks = [...frameworks];
  
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * availableFrameworks.length);
    result.push(availableFrameworks[randomIndex]);
    availableFrameworks.splice(randomIndex, 1);
  }
  
  return result;
}

// Helper function to find thematic connection between frameworks based on descriptions
function findThematicConnection(
  framework1: string, 
  framework2: string, 
  description1: string, 
  description2: string
): string {
  // Framework pairings with known connections
  const knownConnections: Record<string, Record<string, string>> = {
    "TCFD": {
      "GRI Standards": "climate transparency and environmental reporting",
      "Science Based Targets": "science-based climate action and risk disclosure",
      "EU CSRD": "climate-related financial and sustainability disclosures",
      "SASB": "industry-specific climate risk assessment and disclosure"
    },
    "GRI Standards": {
      "SASB": "comprehensive sustainability reporting and material ESG disclosure",
      "UN Global Compact": "global sustainability principles and comprehensive reporting",
      "B Corp Assessment": "transparency in sustainability performance and stakeholder impact",
      "EU CSRD": "comprehensive sustainability reporting across global frameworks"
    },
    "Integrated Reporting": {
      "IIRC Framework": "holistic value creation and integrated thinking",
      "SASB": "material financial and non-financial information integration",
      "GRI Standards": "comprehensive and strategic sustainability disclosure"
    },
    "IFC Listed Companies": {
      "SASB": "robust governance and material risk disclosure",
      "UN Global Compact": "governance structures and ethical business principles"
    }
  };
  
  // Check if we have a known connection
  if (knownConnections[framework1]?.[framework2]) {
    return knownConnections[framework1][framework2];
  } else if (knownConnections[framework2]?.[framework1]) {
    return knownConnections[framework2][framework1];
  }
  
  // Look for common terms in the descriptions
  if (description1 && description2) {
    const keywords = ["governance", "climate", "environmental", "social", "transparency", 
                      "sustainability", "disclosure", "reporting", "risk", "stakeholder",
                      "value", "strategy", "performance", "impact", "ethical"];
    
    for (const keyword of keywords) {
      if (description1.toLowerCase().includes(keyword) && 
          description2.toLowerCase().includes(keyword)) {
        return keyword;
      }
    }
  }
  
  // Default thematic connections based on framework pairs
  const defaultThemes: Record<string, string> = {
    "TCFD-GRI": "climate disclosure and sustainability reporting",
    "SASB-GRI": "material sustainability reporting",
    "UNGC-ISO26000": "social responsibility principles",
    "CSRD-IIRC": "integrated sustainability disclosure",
    "SBT-TCFD": "science-based climate action",
    "BCORP-SDG": "impact measurement and sustainable development",
    "ISO26000-UNGC": "ethical business practices and social responsibility"
  };
  
  const pairKey1 = `${framework1}-${framework2}`;
  const pairKey2 = `${framework2}-${framework1}`;
  
  if (defaultThemes[pairKey1]) {
    return defaultThemes[pairKey1];
  } else if (defaultThemes[pairKey2]) {
    return defaultThemes[pairKey2];
  }
  
  // Fallback to a generic connection
  return "sustainability compliance and strategic performance";
}

// Helper function to get a contextual connector between two questions
function getContextualConnector(framework1: string, framework2: string, thematicConnection?: string): string {
  // If we have a thematic connection, use it
  if (thematicConnection) {
    const themeBased = [
      `for ${thematicConnection}`,
      `in ${thematicConnection} context`,
      `regarding ${thematicConnection}`,
      `for ${thematicConnection} purposes`,
      `in ${thematicConnection} reporting`
    ];
    
    return themeBased[Math.floor(Math.random() * themeBased.length)];
  }

  // Generic connectors as fallback
  const connectors = [
    `across frameworks`,
    `in your reporting`,
    `in practice`,
    `effectively`,
    `in your organization`,
    `in sustainability reporting`,
    `for stakeholders`,
    `for compliance`
  ];
  
  return connectors[Math.floor(Math.random() * connectors.length)];
}

// Helper function to get opening phrases for merged questions
function getOpeningPhrase(): string {
  const phrases = [
    "How do you",
    "How does your company",
    "What approach do you use to",
    "How do you effectively",
    "What methods do you use to",
    "How do you implement",
    "What strategies help you",
    "How can organizations",
    "What practices enable",
    "How can companies"
  ];
  
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// Helper function to get thematic verbs for connecting concepts
function getThematicVerb(): string {
  const verbs = [
    "address",
    "manage",
    "implement",
    "integrate",
    "balance",
    "navigate",
    "harmonize",
    "optimize",
    "coordinate",
    "synchronize",
    "elevate",
    "transform",
    "enhance",
    "strengthen",
    "evolve"
  ];
  
  return verbs[Math.floor(Math.random() * verbs.length)];
}

// Helper function to get transition phrases
function getTransitionPhrase(): string {
  const transitions = [
    "while simultaneously",
    "while also",
    "in conjunction with",
    "in parallel with",
    "alongside efforts to",
    "in addition to",
    "complemented by efforts to",
    "in harmony with",
    "in balance with",
    "integrated with"
  ];
  
  return transitions[Math.floor(Math.random() * transitions.length)];
}

// Helper function to extract the essence of a question
function extractQuestionEssence(text: string): string {
  // Remove common question phrases
  let cleanText = text.replace(/^(How|What|Describe|Does|Can|In what ways|Please|Are|Is).+?(your|the|an|you|organization|company).+?(address|manage|implement|ensure|approach|handle|confirm|provide)/i, "").trim();
  
  // Remove question marks and other punctuation at the end
  cleanText = cleanText.replace(/[\?\.\,\;\:]$/g, "").trim();
  
  // If the text is very short, just return it as is
  if (cleanText.length < 30) {
    return cleanText;
  }
  
  // Extract key nouns and concepts
  const words = cleanText.split(' ');
  
  // Find important keywords (nouns, adjectives, etc.)
  const importantWords = words.filter(word => {
    const w = word.toLowerCase();
    // Skip common stop words and short words
    if (['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of'].includes(w) || w.length < 4) {
      return false;
    }
    return true;
  });
  
  // If we have enough important words, use those
  if (importantWords.length >= 3) {
    return importantWords.slice(0, 4).join(' ');
  }
  
  // Otherwise, just take the first few words of the cleaned text
  if (words.length > 5) {
    return words.slice(0, 5).join(' ');
  }
  
  return cleanText;
}

// Helper function to calculate semantic similarity between two questions
function calculateQuestionSimilarity(q1: any, q2: any): number {
  let similarityScore = 0;
  
  // 1. Category matching (reduced weight to allow more semantic matching)
  if (q1.category && q2.category && 
      q1.category.toLowerCase() === q2.category.toLowerCase()) {
    similarityScore += 8; // Reduced from 10 to 8 to give more weight to semantic matching
  }
  
  // 2. Question text analysis
  const q1Text = (q1.question || "").toLowerCase();
  const q2Text = (q2.question || "").toLowerCase();
  
  // Extract and normalize words (remove common words, punctuation)
  const stopWords = new Set([
    'what', 'how', 'when', 'where', 'which', 'who', 'why', 'does', 'do', 'are', 'is', 
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'and', 'or', 
    'but', 'if', 'then', 'else', 'when', 'your', 'their', 'our', 'its', 'this', 'that', 
    'these', 'those', 'have', 'has', 'had', 'can', 'could', 'will', 'would', 'should',
    'shall', 'may', 'might', 'must', 'need', 'needs', 'required', 'requires'
  ]);
  
  const q1Words = q1Text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
    
  const q2Words = q2Text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  
  // 3. Calculate word overlap with semantic grouping
  const q1WordSet = new Set(q1Words);
  const q2WordSet = new Set(q2Words);
  const matchingWords = [...q1WordSet].filter(w => q2WordSet.has(w));
  
  // Semantic term groups for better matching
  const semanticGroups = {
    // Governance and oversight terms
    governance: ['board', 'committee', 'director', 'oversight', 'supervision', 'monitoring', 'control', 'governance', 'management', 'leadership'],
    
    // Risk and compliance terms
    risk: ['risk', 'compliance', 'audit', 'review', 'assessment', 'evaluation', 'check', 'verify', 'validate', 'assure', 'assurance'],
    
    // Environmental terms
    environmental: ['environmental', 'environment', 'climate', 'emission', 'carbon', 'pollution', 'waste', 'resource', 'energy', 'water'],
    
    // Social terms
    social: ['social', 'community', 'stakeholder', 'employee', 'labor', 'human', 'rights', 'diversity', 'inclusion', 'safety', 'health'],
    
    // Process and implementation terms
    process: ['process', 'procedure', 'system', 'framework', 'standard', 'guideline', 'policy', 'practice', 'implementation', 'execution'],
    
    // Performance and measurement terms
    performance: ['performance', 'measure', 'metric', 'indicator', 'target', 'goal', 'objective', 'outcome', 'result', 'impact', 'effect'],
    
    // Action and response terms
    action: ['address', 'implement', 'take', 'ensure', 'establish', 'develop', 'create', 'maintain', 'improve', 'enhance', 'strengthen'],
    
    // Deficiency and issue terms
    deficiency: ['deficiency', 'issue', 'problem', 'gap', 'weakness', 'shortcoming', 'failure', 'noncompliance', 'violation', 'breach'],
    
    // Reporting and disclosure terms
    reporting: ['report', 'disclose', 'disclosure', 'transparency', 'communication', 'inform', 'document', 'record', 'track', 'monitor']
  };

  // Calculate word similarity score with semantic grouping
  let wordScore = 0;
  let semanticMatches = new Set<string>();

  // First pass: direct word matches
  for (const word of matchingWords) {
    const wordStr = word as string;
    let wordMatched = false;
    
    // Check if word belongs to any semantic group
    for (const [group, terms] of Object.entries(semanticGroups)) {
      if (terms.includes(wordStr)) {
        semanticMatches.add(group);
        wordScore += 2; // Higher score for semantic matches
        wordMatched = true;
        break;
      }
    }
    
    if (!wordMatched) {
      wordScore += 1; // Normal score for other matches
    }
  }

  // Second pass: check for semantic group matches even if words are different
  for (const [group, terms] of Object.entries(semanticGroups)) {
    const q1HasGroup = terms.some(term => q1Words.includes(term));
    const q2HasGroup = terms.some(term => q2Words.includes(term));
    
    if (q1HasGroup && q2HasGroup && !semanticMatches.has(group)) {
      wordScore += 1.5; // Bonus for semantic group matches with different words
      semanticMatches.add(group);
    }
  }
  
  // Normalize word score based on total unique words
  const totalUniqueWords = q1WordSet.size + q2WordSet.size;
  if (totalUniqueWords > 0) {
    similarityScore += (wordScore / totalUniqueWords) * 20; // Increased weight for semantic matching
  }
  
  // 4. Check for similar question structure (reduced weight)
  const q1Structure = q1Text.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
  const q2Structure = q2Text.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
  if (q1Structure === q2Structure) {
    similarityScore += 2; // Reduced from 3 to 2
  }
  
  // 5. Check for similar question patterns
  const questionPatterns = [
    ['how', 'does', 'ensure'],
    ['what', 'measures', 'taken'],
    ['how', 'do', 'you'],
    ['what', 'processes', 'place'],
    ['how', 'are', 'you'],
    ['what', 'steps', 'taken'],
    ['how', 'does', 'your'],
    ['what', 'mechanisms', 'place']
  ];
  
  for (const pattern of questionPatterns) {
    const q1HasPattern = pattern.every(word => q1Text.includes(word));
    const q2HasPattern = pattern.every(word => q2Text.includes(word));
    if (q1HasPattern && q2HasPattern) {
      similarityScore += 1;
      break;
    }
  }
  
  // 6. Minimum similarity threshold (reduced to allow more semantic matches)
  const MIN_SIMILARITY_THRESHOLD = 10; // Reduced from 12 to 10
  
  return similarityScore >= MIN_SIMILARITY_THRESHOLD ? similarityScore : 0;
}

// Helper function to create a merged question from two framework questions
async function createMergedQuestion(
  framework1: string,
  framework2: string,
  question1: any,
  question2: any,
  index: number,
  thematicConnection?: string
): Promise<Question | null> {
  // Clean and validate input questions
  const cleanInput = (text: string): string => {
    return text
      .split('\n')[0] // Take only first line
      .replace(/[^\w\s\?\.\,\;\:\-\'\/]/g, '') // Remove special characters except basic punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/DIFFERENT_CONTEXT\?/g, '') // Remove DIFFERENT_CONTEXT text
      .replace(/best practicesframework/g, 'best practices/framework') // Fix common typos
      .replace(/and\/ or/g, 'and/or') // Fix common formatting
      .trim();
  };

  const text1 = cleanInput(question1.question || "");
  const text2 = cleanInput(question2.question || "");

  // Normalize questions for comparison (case-insensitive, ignore punctuation)
  const normalizeQuestion = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedQ1 = normalizeQuestion(text1);
  const normalizedQ2 = normalizeQuestion(text2);

  // If questions are identical after normalization, return the original question
  if (normalizedQ1 === normalizedQ2) {
    const defaultEmoji = ["🌟", "🔄", "🌱", "🌍", "⚡", "💼", "🔍", "🛡️", "🤝", "📊", "⚖️", "🌐"][Math.floor(Math.random() * 12)];
    const finalText = `${defaultEmoji} ${text1}`; // Use original text with emoji

    return {
      id: `q${index + 1}`,
      text: finalText,
      frameworks: [framework1, framework2],
      originalQuestions: [
        {
          text: text1,
          framework: framework1,
          category: question1.category,
          ref: question1.ref || question1._id
        },
        {
          text: text2,
          framework: framework2,
          category: question2.category,
          ref: question2.ref || question2._id
        }
      ],
      emoji: defaultEmoji,
      category: question1.category || question2.category,
      ref: `${framework1}-${framework2}-${index}`,
      timestamp: new Date().toISOString(),
      generatedWithAI: false // Mark as not AI-generated since it's the original question
    };
  }

  // Calculate similarity score for non-identical questions
  const similarityScore = calculateQuestionSimilarity(
    { question: text1, category: question1.category },
    { question: text2, category: question2.category }
  );

  const defaultEmoji = ["🌟", "🔄", "🌱", "🌍", "⚡", "💼", "🔍", "🛡️", "🤝", "📊", "⚖️", "🌐"][Math.floor(Math.random() * 12)];
  let finalText = '';

  try {
    // Only use AI merging for non-identical questions
    finalText = await Promise.race([
      mergeQuestionsWithAI(
        framework1,
        framework2,
        text1,
        text2,
        thematicConnection,
        similarityScore
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]) as string;

    // Basic cleanup of AI output
    finalText = finalText
      .split('\n')[0] // Take only first line
      .replace(/[^\w\s\?\.\,\;\:\-\'\/]/g, '') // Allow forward slash for "best practices/framework"
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^[^a-zA-Z]*/, '') // Remove any non-letter characters at start
      .replace(/[^a-zA-Z0-9\s\?\.\,\;\:\-\'\/]+$/, '') // Remove trailing special characters
      .replace(/DIFFERENT_CONTEXT\?/g, '') // Remove DIFFERENT_CONTEXT text
      .replace(/best practicesframework/g, 'best practices/framework') // Fix common typos
      .replace(/and\/ or/g, 'and/or') // Fix common formatting
      .trim();

    // Basic validation
    if (!finalText.endsWith('?') && !finalText.endsWith('.')) {
      finalText += '?';
    }

    // Ensure proper capitalization
    finalText = finalText.charAt(0).toUpperCase() + finalText.slice(1);

    // Add emoji
    finalText = `${defaultEmoji} ${finalText}`;

    // Basic length validation
    if (finalText.length < 10 || finalText.length > 500) {
      throw new Error('Invalid question length');
    }

    // Basic format validation
    if (!/^[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}] [A-Z]/u.test(finalText)) {
      throw new Error('Invalid question format');
    }

  } catch (error) {
    console.error('Error merging questions:', error);
    return null;
  }

  // Store original questions
  const originalQuestions = [
    {
      text: text1,
      framework: framework1,
      category: question1.category,
      ref: question1.ref || question1._id
    },
    {
      text: text2,
      framework: framework2,
      category: question2.category,
      ref: question2.ref || question2._id
    }
  ];

  return {
    id: `q${index + 1}`,
    text: finalText,
    frameworks: [framework1, framework2],
    originalQuestions,
    emoji: defaultEmoji,
    category: question1.category || question2.category,
    ref: `${framework1}-${framework2}-${index}`,
    timestamp: new Date().toISOString(),
    generatedWithAI: true
  };
} 
