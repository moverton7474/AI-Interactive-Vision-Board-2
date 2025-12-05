import { WorkbookTheme, ThemePack, WorkbookPageType } from '../types/workbookTypes';

// ============================================
// THEME PACK LIBRARY
// ============================================

export const THEME_PACKS: Record<WorkbookTheme, ThemePack> = {
    WEIGHT_LOSS_FITNESS: {
        id: 'theme-fitness',
        theme: 'WEIGHT_LOSS_FITNESS',
        name: 'Weight Loss & Fitness',
        description: 'Transform your body and build sustainable health habits',
        icon: '💪',
        primary_color: '#10B981',
        secondary_color: '#34D399',

        recommended_pages: [
            'LIFE_VISION_OVERVIEW',
            'SMART_GOALS_WORKSHEET',
            'HABIT_TRACKER',
            'FITNESS_LOG',
            'MEAL_PLANNER',
            'WATER_INTAKE',
            'SLEEP_TRACKER',
            'WELLNESS_TRACKER',
            'WEEKLY_REFLECTION',
            'MONTHLY_REVIEW',
            'WINS_TRACKER',
            'NOTES_PAGES'
        ],

        ai_prompts: {
            vision_statement: 'Describe your ideal physical self in vivid detail. What does your healthiest, strongest version look like? How do you feel in your transformed body? What activities can you now enjoy?',
            goal_framework: 'Generate SMART fitness goals based on: Starting weight {current_weight}, Target weight {target_weight}, Timeline {timeline}, Fitness level {fitness_level}, Preferred activities {activities}',
            habit_suggestions: [
                'Morning workout (30 min)',
                'Track all meals in food journal',
                'Drink 8 glasses of water daily',
                'Meal prep Sunday for the week',
                'Evening walk (20 min)',
                'Sleep 7-8 hours',
                'Take progress photos weekly'
            ],
            reflection_prompts: [
                'What did I do well this week to honor my body?',
                'Which unhealthy patterns did I successfully break?',
                'How did I feel physically and emotionally after workouts?',
                'What obstacles did I overcome?',
                'What will I improve next week?'
            ]
        },

        key_metrics: [
            { name: 'Current Weight', unit: 'lbs' },
            { name: 'Target Weight', unit: 'lbs' },
            { name: 'Body Fat %', unit: '%' },
            { name: 'Workout Days/Week', unit: 'days' },
            { name: 'Daily Calories', unit: 'cal' },
            { name: 'Water Intake', unit: 'oz' },
            { name: 'Sleep Hours', unit: 'hrs' }
        ]
    },

    FINANCIAL_FREEDOM: {
        id: 'theme-financial',
        theme: 'FINANCIAL_FREEDOM',
        name: 'Financial Freedom',
        description: 'Build wealth, eliminate debt, and achieve financial independence',
        icon: '💰',
        primary_color: '#F59E0B',
        secondary_color: '#FBBF24',

        recommended_pages: [
            'LIFE_VISION_OVERVIEW',
            'ANNUAL_VISION',
            'SMART_GOALS_WORKSHEET',
            'FINANCIAL_SNAPSHOT',
            'BUDGET_PLANNER',
            'SAVINGS_TRACKER',
            'DEBT_PAYOFF',
            'NET_WORTH_TRACKER',
            'RETIREMENT_PROJECTION',
            'EXPENSE_LOG',
            'MONTHLY_REVIEW',
            'QUARTERLY_ASSESSMENT',
            'NOTES_PAGES'
        ],

        ai_prompts: {
            vision_statement: 'Imagine your life with complete financial freedom. What does your ideal financial position look like in 3 years? What can you now afford? How does financial security change your daily decisions?',
            goal_framework: 'Create wealth-building milestones based on: Current income {income}, Current savings {savings}, Monthly expenses {expenses}, Debt {debt}, Retirement target {retirement_goal}',
            habit_suggestions: [
                'Track every expense in real-time',
                'Review budget weekly',
                'Automate 20% savings on payday',
                'Cook at home 5 days/week',
                'Update net worth monthly',
                'Read financial book 30 min/day',
                'Review investment portfolio quarterly'
            ],
            reflection_prompts: [
                'Did I honor my budget this week?',
                'What unnecessary purchases did I avoid?',
                'How did I increase income or decrease expenses?',
                'What financial win am I most proud of?',
                'What money mindset shifted for me this month?'
            ]
        },

        key_metrics: [
            { name: 'Current Net Worth', unit: '$' },
            { name: 'Target Net Worth', unit: '$' },
            { name: 'Monthly Income', unit: '$' },
            { name: 'Monthly Expenses', unit: '$' },
            { name: 'Savings Rate', unit: '%' },
            { name: 'Total Debt', unit: '$' },
            { name: 'Emergency Fund', unit: '$' },
            { name: 'Investment Portfolio', unit: '$' }
        ]
    },

    LEADERSHIP_DEVELOPMENT: {
        id: 'theme-leadership',
        theme: 'LEADERSHIP_DEVELOPMENT',
        name: 'Leadership Development',
        description: 'Develop executive presence and lead high-performing teams',
        icon: '👔',
        primary_color: '#3B82F6',
        secondary_color: '#60A5FA',

        recommended_pages: [
            'LIFE_VISION_OVERVIEW',
            'LEADERSHIP_GOALS',
            'TEAM_VISION',
            'SMART_GOALS_WORKSHEET',
            'LEARNING_TRACKER',
            'ONE_ON_ONE_NOTES',
            'DECISION_LOG',
            'HABIT_TRACKER',
            'WEEKLY_PLANNER',
            'WEEKLY_REFLECTION',
            'MONTHLY_REVIEW',
            'QUARTERLY_ASSESSMENT',
            'WINS_TRACKER',
            'NOTES_PAGES'
        ],

        ai_prompts: {
            vision_statement: 'Envision yourself as the leader you aspire to become. What kind of leader are you? How does your team describe you? What impact are you making? What legacy are you building?',
            goal_framework: 'Generate leadership development objectives for: Current role {current_role}, Target role {target_role}, Team size {team_size}, Industry {industry}, Key challenges {challenges}',
            habit_suggestions: [
                'Daily leadership reading (30 min)',
                'Weekly 1:1s with direct reports',
                'Monthly team feedback session',
                'Practice public speaking weekly',
                'Mentor one junior team member',
                'Journal on leadership lessons daily',
                'Attend networking event monthly'
            ],
            reflection_prompts: [
                'What leadership principle did I embody this week?',
                'How did I serve my team today?',
                'What difficult decision did I make with integrity?',
                'Who did I mentor or develop this week?',
                'What feedback did I receive and act upon?'
            ]
        },

        key_metrics: [
            { name: 'Team Size', unit: 'people' },
            { name: 'Direct Reports', unit: 'people' },
            { name: 'Team Engagement Score', unit: '%' },
            { name: 'Goals Achieved', unit: 'goals' },
            { name: 'Books Read', unit: 'books' },
            { name: '1:1s Completed', unit: 'meetings' },
            { name: 'Leadership Hours/Week', unit: 'hrs' }
        ]
    },

    SPIRITUAL_GROWTH: {
        id: 'theme-spiritual',
        theme: 'SPIRITUAL_GROWTH',
        name: 'Spiritual Growth',
        description: 'Deepen your faith and live out your spiritual calling',
        icon: '✝️',
        primary_color: '#8B5CF6',
        secondary_color: '#A78BFA',

        recommended_pages: [
            'LIFE_VISION_OVERVIEW',
            'CORE_VALUES',
            'FAITH_MILESTONES',
            'SCRIPTURE_READING',
            'PRAYER_JOURNAL',
            'SPIRITUAL_DISCIPLINES',
            'GRATITUDE_LOG',
            'HABIT_TRACKER',
            'WEEKLY_REFLECTION',
            'MONTHLY_REVIEW',
            'NOTES_PAGES'
        ],

        ai_prompts: {
            vision_statement: 'Describe your spiritual journey and where God is calling you. What does a deeper relationship with Christ look like for you? How are you living out your faith daily?',
            goal_framework: 'Create spiritual growth plan based on: Faith tradition {tradition}, Current practices {practices}, Desired depth {depth_level}, Service opportunities {service_interests}',
            habit_suggestions: [
                'Morning devotional with Scripture',
                'Prayer time (15 min morning & evening)',
                'Weekly church attendance',
                'Bible study group participation',
                'Scripture memory (1 verse/week)',
                'Serve in ministry monthly',
                'Fast one day per week'
            ],
            reflection_prompts: [
                'How did I see God at work this week?',
                'What Scripture spoke to my heart?',
                'Where did I step out in faith?',
                'Who did I serve or encourage?',
                'What is God teaching me right now?'
            ]
        },

        key_metrics: [
            { name: 'Daily Devotional Streak', unit: 'days' },
            { name: 'Scripture Passages Read', unit: 'chapters' },
            { name: 'Prayer Minutes/Day', unit: 'min' },
            { name: 'Service Hours/Month', unit: 'hrs' },
            { name: 'Bible Studies Attended', unit: 'sessions' },
            { name: 'Verses Memorized', unit: 'verses' }
        ]
    },

    CAREER_ACCELERATION: {
        id: 'theme-career',
        theme: 'CAREER_ACCELERATION',
        name: 'Career Acceleration',
        description: 'Advance your career and achieve professional excellence',
        icon: '🚀',
        primary_color: '#EC4899',
        secondary_color: '#F472B6',

        recommended_pages: [
            'LIFE_VISION_OVERVIEW',
            'ANNUAL_VISION',
            'SMART_GOALS_WORKSHEET',
            'LEARNING_TRACKER',
            'HABIT_TRACKER',
            'WEEKLY_PLANNER',
            'PRIORITY_FOCUS',
            'PRODUCTIVITY_MATRIX',
            'WINS_TRACKER',
            'WEEKLY_REFLECTION',
            'MONTHLY_REVIEW',
            'QUARTERLY_ASSESSMENT',
            'NOTES_PAGES'
        ],

        ai_prompts: {
            vision_statement: 'Visualize your ideal career in 2 years. What role do you hold? What projects are you leading? What recognition have you earned? How has your expertise grown?',
            goal_framework: 'Generate career milestones for: Current role {current_role}, Target role {target_role}, Industry {industry}, Key skills needed {skills}, Timeline {timeline}',
            habit_suggestions: [
                'Skill practice daily (1 hour)',
                'Network with industry leaders weekly',
                'Update portfolio monthly',
                'Read industry publications daily',
                'Attend conference or webinar monthly',
                'Publish content weekly (blog, LinkedIn)',
                'Seek feedback from mentor monthly'
            ],
            reflection_prompts: [
                'What professional skill did I improve this week?',
                'What value did I deliver to my organization?',
                'Who did I connect with in my network?',
                'What opportunity did I pursue?',
                'What lesson will I apply going forward?'
            ]
        },

        key_metrics: [
            { name: 'Current Salary', unit: '$' },
            { name: 'Target Salary', unit: '$' },
            { name: 'Skills Learned', unit: 'skills' },
            { name: 'Certifications Earned', unit: 'certs' },
            { name: 'Network Connections', unit: 'people' },
            { name: 'Projects Completed', unit: 'projects' },
            { name: 'Learning Hours/Week', unit: 'hrs' }
        ]
    },

    RELATIONSHIPS_FAMILY: {
        id: 'theme-relationships',
        theme: 'RELATIONSHIPS_FAMILY',
        name: 'Relationships & Family',
        description: 'Strengthen bonds and create meaningful family connections',
        icon: '❤️',
        primary_color: '#EF4444',
        secondary_color: '#F87171',

        recommended_pages: [
            'LIFE_VISION_OVERVIEW',
            'RELATIONSHIP_GOALS',
            'FAMILY_CALENDAR',
            'QUALITY_TIME_LOG',
            'GRATITUDE_LOG',
            'HABIT_TRACKER',
            'MONTHLY_OVERVIEW',
            'WEEKLY_REFLECTION',
            'MONTHLY_REVIEW',
            'NOTES_PAGES'
        ],

        ai_prompts: {
            vision_statement: 'Imagine your ideal relationship and family life. How do you connect? What traditions do you share? What does quality time look like? How do you support each other?',
            goal_framework: 'Create relationship-building goals for: Relationship status {status}, Family context {family}, Communication style {style}, Desired improvements {improvements}',
            habit_suggestions: [
                'Daily appreciation note to partner',
                'Weekly date night (no phones)',
                'Monthly family meeting',
                'Daily dinner together',
                'Weekend family adventure',
                'Bedtime routine with kids',
                'Weekly relationship check-in'
            ],
            reflection_prompts: [
                'How did I show love to my partner/family this week?',
                'What quality time did we share?',
                'What conflict did we resolve with grace?',
                'What tradition or memory did we create?',
                'How can I be more present next week?'
            ]
        },

        key_metrics: [
            { name: 'Date Nights/Month', unit: 'dates' },
            { name: 'Quality Time Hours/Week', unit: 'hrs' },
            { name: 'Family Dinners/Week', unit: 'dinners' },
            { name: 'Meaningful Conversations', unit: 'talks' },
            { name: 'Acts of Service', unit: 'acts' },
            { name: 'Phone-Free Hours Together', unit: 'hrs' }
        ]
    },

    CUSTOM: {
        id: 'theme-custom',
        theme: 'CUSTOM',
        name: 'Custom Theme',
        description: 'Fully personalized planner based on your unique goals',
        icon: '⚙️',
        primary_color: '#6B7280',
        secondary_color: '#9CA3AF',

        recommended_pages: [
            'LIFE_VISION_OVERVIEW',
            'ANNUAL_VISION',
            'SMART_GOALS_WORKSHEET',
            'HABIT_TRACKER',
            'WEEKLY_PLANNER',
            'MONTHLY_OVERVIEW',
            'WEEKLY_REFLECTION',
            'MONTHLY_REVIEW',
            'NOTES_PAGES'
        ],

        ai_prompts: {
            vision_statement: 'Describe your vision for the next year in your own words. What matters most to you? What are you working towards?',
            goal_framework: 'Generate personalized goals based on user profile and stated priorities',
            habit_suggestions: [
                'Morning routine',
                'Evening reflection',
                'Weekly review',
                'Monthly planning'
            ],
            reflection_prompts: [
                'What progress did I make this week?',
                'What did I learn about myself?',
                'What am I grateful for?',
                'What will I focus on next week?'
            ]
        },

        key_metrics: []
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getThemePack(theme: WorkbookTheme): ThemePack {
    return THEME_PACKS[theme];
}

export function getAllThemes(): ThemePack[] {
    return Object.values(THEME_PACKS);
}

export function getRecommendedPagesForThemes(themes: WorkbookTheme[]): WorkbookPageType[] {
    const allPages = new Set<WorkbookPageType>();

    themes.forEach(theme => {
        const pack = getThemePack(theme);
        pack.recommended_pages.forEach(page => allPages.add(page));
    });

    return Array.from(allPages);
}

export function getCombinedKeyMetrics(themes: WorkbookTheme[]): { name: string; unit: string; target?: number }[] {
    const allMetrics: { name: string; unit: string; target?: number }[] = [];

    themes.forEach(theme => {
        const pack = getThemePack(theme);
        allMetrics.push(...pack.key_metrics);
    });

    return allMetrics;
}

export function getThemeColor(theme: WorkbookTheme): { primary: string; secondary: string } {
    const pack = getThemePack(theme);
    return {
        primary: pack.primary_color,
        secondary: pack.secondary_color
    };
}
