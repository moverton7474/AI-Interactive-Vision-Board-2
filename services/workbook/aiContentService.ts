/**
 * AI Content Service for Workbook v2.1
 *
 * Generates personalized AI content for workbooks including:
 * - Ghostwriter Foreword ("Letter from Your Future Self")
 * - Theme-based reflection prompts
 * - Goal-aligned content suggestions
 *
 * Uses the gemini-proxy edge function for text generation.
 */

import { supabase } from '../../lib/supabase';
import { AIContentContext, AIGeneratedContent, ThemePack } from '../../types/workbookTypes';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Theme-specific guidance for AI content generation
 */
const THEME_GUIDANCE: Record<ThemePack, string> = {
  faith:
    'Include references to faith, purpose, and divine guidance. Use scripture-inspired language. Focus on spiritual growth and service to others.',
  executive:
    'Use strategic language, KPIs, and measurable outcomes. Focus on leadership impact, professional excellence, and data-driven achievement.',
  retirement:
    'Focus on freedom, legacy, and the fulfillment of life goals. Celebrate the journey and emphasize quality time with loved ones.',
  health:
    'Emphasize vitality, wellness milestones, and physical transformation. Celebrate energy, longevity, and mind-body connection.',
  entrepreneur:
    'Highlight innovation, risk-taking, and building something meaningful. Celebrate hustle, vision, and creating value.',
  relationship:
    'Focus on connection, love, and meaningful relationships. Celebrate partnership, communication, and growing together.',
};

/**
 * Generate "Letter from Your Future Self" (Ghostwriter Foreword)
 * Uses gemini-proxy edge function with retry logic
 *
 * @param context - AI content context with user data
 * @returns Generated foreword text
 */
export async function generateGhostwriterForeword(context: AIContentContext): Promise<string> {
  const prompt = buildForewordPrompt(context);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          prompt,
          model: 'gemini-1.5-flash',
          maxTokens: 800,
        },
      });

      if (error) throw error;
      return data?.text || getFallbackForeword(context);
    } catch (err) {
      console.warn(`[aiContentService] Ghostwriter attempt ${attempt + 1} failed:`, err);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  return getFallbackForeword(context);
}

/**
 * Build the prompt for foreword generation
 */
function buildForewordPrompt(context: AIContentContext): string {
  const { theme, financialTarget, goals, visionText, userName } = context;

  return `
You are writing a deeply personal "Letter from Your Future Self" for ${userName || 'the reader'}.
This is the opening page of their Executive Vision Workbook.

**Context:**
- Theme: ${theme} - ${THEME_GUIDANCE[theme]}
- Financial Target: ${financialTarget ? `$${financialTarget.toLocaleString()}` : 'Not specified'}
- Vision: "${visionText || 'A life of purpose and achievement'}"
- Goals: ${goals.length > 0 ? goals.join(', ') : 'Personal growth and fulfillment'}

**Instructions:**
Write a 200-300 word letter in first person from their FUTURE SELF (3 years from now) looking back at this moment.
- Celebrate specific achievements they will accomplish
- Reference their actual goals and financial targets
- Match the ${theme} coaching style
- Be emotionally resonant but not cheesy
- End with encouragement to trust the process

Begin the letter with "Dear [Current Self]," and sign it "With pride, Your Future Self"
  `.trim();
}

/**
 * Fallback foreword when AI generation fails
 */
function getFallbackForeword(context: AIContentContext): string {
  const themeOpeners: Record<ThemePack, string> = {
    faith: 'Through faith and purpose, you have built something beautiful.',
    executive: 'Every strategic decision has led to this moment of achievement.',
    retirement: 'The freedom you dreamed of is now your daily reality.',
    health: 'Your body and mind are now in perfect harmony.',
    entrepreneur: 'Your vision has become a thriving reality.',
    relationship: 'The connections you cultivated have blossomed beyond measure.',
  };

  return `Dear Self,

As I write this from three years in the future, I want you to know that the vision you're holding right now—it becomes real. ${themeOpeners[context.theme]}

Every goal you've written in this workbook, every habit you're building, leads to this moment of pride. The path wasn't always easy, but it was always worth it.

${context.financialTarget ? `That financial target of $${context.financialTarget.toLocaleString()}? You exceeded it.` : 'Your financial goals? Achieved and exceeded.'}

Trust the process. Stay consistent. Your future self is grateful for the work you're about to do.

With pride,
Your Future Self`;
}

/**
 * Generate Theme-Based Prompts for Reflection Pages
 *
 * @param theme - User's selected theme pack
 * @param category - Category of prompts to generate
 * @returns Array of reflection prompts
 */
export async function generateThemePrompts(
  theme: ThemePack,
  category: 'financial' | 'health' | 'career' | 'relationship' | 'spiritual'
): Promise<string[]> {
  const themePromptMap: Record<ThemePack, Partial<Record<typeof category, string[]>>> = {
    faith: {
      financial: [
        'How will financial freedom allow me to serve others?',
        'What is my stewardship goal this year?',
        'How can I be a blessing with my resources?',
      ],
      health: [
        'How can I honor my body as a temple?',
        'What wellness practices align with my faith?',
        'How will health help me serve longer?',
      ],
      spiritual: [
        'What spiritual disciplines am I committing to?',
        'How will I grow closer to God this year?',
        'What legacy of faith am I building?',
      ],
      relationship: [
        'How can I love others as myself?',
        'What relationships need reconciliation?',
        'How will I serve my community?',
      ],
      career: [
        'How does my work serve a higher purpose?',
        'What values guide my professional decisions?',
        'How can I be a light in my workplace?',
      ],
    },
    executive: {
      financial: [
        'What is my 3-year revenue target?',
        'What ROI do I expect from this investment in myself?',
        'What metrics define financial success?',
      ],
      career: [
        'What leadership impact will I create?',
        'How will I develop my team?',
        'What strategic initiatives will I drive?',
      ],
      health: [
        'How will peak performance improve my leadership?',
        'What energy management systems will I implement?',
        'How does wellness affect my decision-making?',
      ],
      relationship: [
        'How will I balance ambition with family time?',
        'What networking goals will I set?',
        'How can I mentor others effectively?',
      ],
      spiritual: [
        'What is my purpose beyond profit?',
        'How do I define meaningful success?',
        'What legacy am I building?',
      ],
    },
    retirement: {
      financial: [
        'What does financial freedom look like daily?',
        'How will I manage my retirement income?',
        'What legacy will I leave?',
      ],
      relationship: [
        'How will I invest in family relationships?',
        'What experiences will I share with loved ones?',
        'How will I stay socially connected?',
      ],
      health: [
        'How will I maintain vitality in retirement?',
        'What adventures require good health?',
        'What wellness routines will I establish?',
      ],
      career: [
        'What passion projects will I pursue?',
        'How might I contribute through part-time work?',
        'What skills will I share with others?',
      ],
      spiritual: [
        'What gives my life meaning now?',
        'How will I practice gratitude daily?',
        'What wisdom will I pass on?',
      ],
    },
    health: {
      health: [
        'What does my ideal body feel like?',
        'What nutrition habits will I build?',
        'How will I measure progress?',
      ],
      relationship: [
        'How will better health improve my relationships?',
        'Who will support my health journey?',
        'How can I inspire others to be healthy?',
      ],
      financial: [
        'How will health save me money long-term?',
        'What investments will I make in my wellness?',
        'How does energy affect my earning potential?',
      ],
      career: [
        'How will vitality improve my work performance?',
        'What health boundaries will I set at work?',
        'How does sleep affect my productivity?',
      ],
      spiritual: [
        'How is physical health connected to mental peace?',
        'What mindfulness practices will I adopt?',
        'How will I honor my body?',
      ],
    },
    entrepreneur: {
      financial: [
        'What revenue milestone am I targeting?',
        'How will I reinvest profits?',
        'What is my exit strategy?',
      ],
      career: [
        'What problem am I solving?',
        'How will I scale my impact?',
        'What partnerships will I build?',
      ],
      relationship: [
        'How will I balance business with family?',
        'Who are my key advisors?',
        'How will I build my team culture?',
      ],
      health: [
        'How will I avoid burnout?',
        'What boundaries protect my energy?',
        'How does health fuel my hustle?',
      ],
      spiritual: [
        'What drives me beyond money?',
        'How will my business make a difference?',
        'What values guide my decisions?',
      ],
    },
    relationship: {
      relationship: [
        'What does my ideal relationship look like?',
        'How will I show up for my partner?',
        'What experiences will we share?',
      ],
      spiritual: [
        'How will we grow together spiritually?',
        'What values do we share?',
        'How do we practice gratitude together?',
      ],
      financial: [
        'What are our shared financial goals?',
        'How will we make money decisions together?',
        'What experiences are worth investing in?',
      ],
      health: [
        'How will we support each other\'s health?',
        'What activities will we enjoy together?',
        'How do healthy habits strengthen us?',
      ],
      career: [
        'How do we support each other\'s ambitions?',
        'What work-life balance will we maintain?',
        'How do we celebrate each other\'s wins?',
      ],
    },
  };

  return (
    themePromptMap[theme]?.[category] || [
      'What does success look like in this area?',
      'What habits will support this goal?',
      "How will I know I've achieved it?",
    ]
  );
}

/**
 * Generate a coach letter for the workbook
 * A personalized message from the AI coach based on user's goals
 */
export async function generateCoachLetter(context: AIContentContext): Promise<string> {
  const { theme, goals, userName } = context;

  const prompt = `
You are AMIE, an AI Vision Coach specializing in the ${theme} journey.
Write a brief (150-200 words) letter to ${userName || 'your mentee'} about their vision workbook journey.

Their goals include: ${goals.join(', ') || 'personal growth and achievement'}

The letter should:
- Be warm but professional
- Reference their specific goals
- Match the ${theme} coaching style: ${THEME_GUIDANCE[theme]}
- Include one actionable piece of advice
- End with encouragement

Sign as "Your AI Coach, AMIE"
  `.trim();

  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: {
        prompt,
        model: 'gemini-1.5-flash',
        maxTokens: 400,
      },
    });

    if (error) throw error;
    return data?.text || getDefaultCoachLetter(context);
  } catch (err) {
    console.warn('[aiContentService] Coach letter generation failed:', err);
    return getDefaultCoachLetter(context);
  }
}

/**
 * Default coach letter when AI generation fails
 */
function getDefaultCoachLetter(context: AIContentContext): string {
  return `Dear ${context.userName || 'Visionary'},

Congratulations on taking this powerful step toward your dreams. This workbook represents your commitment to growth, and I'm honored to be part of your journey.

Your goals—${context.goals.slice(0, 3).join(', ') || 'the vision you hold'}—are not just dreams. They are destinations you are capable of reaching.

My advice: Start with one small action today. Momentum builds through consistency, not perfection.

I believe in you.

Your AI Coach,
AMIE`;
}

/**
 * Generate all AI content for a workbook order
 * Returns content to be stored in ai_content JSONB column
 *
 * @param context - AI content context with user data
 * @returns Complete AI generated content package
 */
export async function generateAllAIContent(context: AIContentContext): Promise<AIGeneratedContent> {
  const result: AIGeneratedContent = {
    fallbackUsed: false,
  };

  try {
    // Generate foreword
    const foreword = await generateGhostwriterForeword(context);
    result.foreword = foreword;
    result.forewordGeneratedAt = new Date().toISOString();

    // Generate theme prompts for each category
    const categories: Array<'financial' | 'health' | 'career' | 'relationship' | 'spiritual'> = [
      'financial',
      'health',
      'career',
      'relationship',
    ];

    result.themePrompts = {};
    for (const category of categories) {
      result.themePrompts[category] = await generateThemePrompts(context.theme, category);
    }

    // Generate coach letter
    result.coachLetter = await generateCoachLetter(context);

    // Generate reflection prompts
    result.reflectionPrompts = [
      `As someone focused on ${context.theme}, what am I most grateful for today?`,
      `What progress have I made toward my ${context.goals[0] || 'primary'} goal?`,
      `How am I showing up as my best self?`,
      `What challenges have I overcome this week?`,
      `What will I focus on tomorrow?`,
    ];
  } catch (error) {
    console.error('[aiContentService] Error generating AI content:', error);
    result.fallbackUsed = true;

    // Use fallbacks
    result.foreword = getFallbackForeword(context);
    result.coachLetter = getDefaultCoachLetter(context);
    result.reflectionPrompts = [
      'What am I grateful for today?',
      'What progress have I made toward my goals?',
      'How am I showing up as my best self?',
    ];
  }

  return result;
}
