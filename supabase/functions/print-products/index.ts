import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Print Products Service
 *
 * Handles the extended print catalog including Focus Pads, Habit Cue Cards,
 * and other personalized print products that integrate with AMIE and habits.
 *
 * Actions:
 * - catalog: Get available print products
 * - customize: Generate personalized product preview
 * - order: Create print order via Prodigi
 * - list_orders: Get user's print product orders
 */

// Product catalog with Prodigi SKUs
const PRINT_PRODUCTS = [
  {
    id: 'focus-pad-daily',
    name: 'Daily Focus Pad',
    description: 'A 50-sheet tear-off pad with your vision image and daily intention prompts. Perfect for desk motivation.',
    product_type: 'pad',
    prodigi_sku: 'GLOBAL-CFP-A5',
    size: 'A5 (5.8" x 8.3")',
    pages: 50,
    base_price: 24.99,
    shipping_estimate: 5.99,
    preview_image: '/print-previews/focus-pad.png',
    personalization_fields: ['vision_image', 'headline', 'daily_prompts'],
    features: [
      'Premium 80lb paper',
      'Tear-off sheets',
      'Custom vision image header',
      'Daily intention section',
      'Gratitude prompts'
    ],
    elite_exclusive: false
  },
  {
    id: 'focus-pad-weekly',
    name: 'Weekly Planner Pad',
    description: 'A 52-sheet weekly planning pad with goal tracking, habit checkboxes, and your personalized vision.',
    product_type: 'pad',
    prodigi_sku: 'GLOBAL-CFP-A4',
    size: 'A4 (8.3" x 11.7")',
    pages: 52,
    base_price: 34.99,
    shipping_estimate: 6.99,
    preview_image: '/print-previews/weekly-pad.png',
    personalization_fields: ['vision_image', 'weekly_goals', 'habit_list'],
    features: [
      'Premium 80lb paper',
      'Weekly at-a-glance layout',
      'Habit tracking checkboxes',
      'Goal review section',
      'Notes area'
    ],
    elite_exclusive: false
  },
  {
    id: 'habit-cue-cards',
    name: 'Habit Cue Cards',
    description: 'Set of 20 custom cards featuring your habits with visual cues and AMIE encouragement messages.',
    product_type: 'cards',
    prodigi_sku: 'GLOBAL-PHO-4X6-PRO',
    size: '4" x 6"',
    quantity: 20,
    base_price: 19.99,
    shipping_estimate: 4.99,
    preview_image: '/print-previews/habit-cards.png',
    personalization_fields: ['habits', 'theme_colors', 'encouragement_messages'],
    features: [
      'Premium card stock',
      'Rounded corners',
      'One habit per card',
      'Visual cue imagery',
      'AMIE motivational quotes'
    ],
    elite_exclusive: false
  },
  {
    id: 'vision-postcards',
    name: 'Vision Postcards',
    description: 'Pack of 10 postcards featuring your vision board images. Share your dreams or use as daily reminders.',
    product_type: 'cards',
    prodigi_sku: 'GLOBAL-PHO-4X6',
    size: '4" x 6"',
    quantity: 10,
    base_price: 14.99,
    shipping_estimate: 3.99,
    preview_image: '/print-previews/vision-postcards.png',
    personalization_fields: ['vision_images', 'captions'],
    features: [
      'Premium photo paper',
      'Glossy finish',
      'Blank back for writing',
      'Multiple vision images'
    ],
    elite_exclusive: false
  },
  {
    id: 'affirmation-deck',
    name: 'AMIE Affirmation Deck',
    description: 'A 52-card deck of personalized affirmations based on your AMIE identity profile and coaching theme.',
    product_type: 'cards',
    prodigi_sku: 'GLOBAL-PHO-3X5-PRO',
    size: '3" x 5"',
    quantity: 52,
    base_price: 29.99,
    shipping_estimate: 5.99,
    preview_image: '/print-previews/affirmation-deck.png',
    personalization_fields: ['identity_profile', 'theme', 'affirmations'],
    features: [
      'Premium linen card stock',
      'Custom box packaging',
      'Weekly affirmation format',
      'AMIE voice personalization',
      'Theme-matched design'
    ],
    elite_exclusive: true
  },
  {
    id: 'milestone-stickers',
    name: 'Milestone Achievement Stickers',
    description: 'Sheet of 30 custom stickers celebrating your milestones and achievements. Perfect for journals.',
    product_type: 'sticker',
    prodigi_sku: 'GLOBAL-STI-A6',
    size: 'A6 sheet',
    quantity: 30,
    base_price: 9.99,
    shipping_estimate: 2.99,
    preview_image: '/print-previews/milestone-stickers.png',
    personalization_fields: ['milestones', 'achievement_badges'],
    features: [
      'Die-cut stickers',
      'Waterproof vinyl',
      'Achievement designs',
      'Custom milestone text'
    ],
    elite_exclusive: false
  },
  {
    id: 'vision-canvas',
    name: 'Vision Board Canvas',
    description: 'Gallery-quality canvas print of your vision board. Museum-grade archival quality.',
    product_type: 'canvas',
    prodigi_sku: 'GLOBAL-CAN-16X20',
    size: '16" x 20"',
    base_price: 79.99,
    shipping_estimate: 12.99,
    preview_image: '/print-previews/vision-canvas.png',
    personalization_fields: ['vision_board_id'],
    features: [
      'Museum-quality canvas',
      'Wooden frame included',
      'Ready to hang',
      '1.5" gallery wrap'
    ],
    elite_exclusive: true
  },
  {
    id: 'dream-bundle',
    name: 'Dream Starter Bundle',
    description: 'Complete kit: Daily Focus Pad + Habit Cue Cards + Vision Postcards at 20% off.',
    product_type: 'bundle',
    bundle_items: ['focus-pad-daily', 'habit-cue-cards', 'vision-postcards'],
    base_price: 47.99, // vs $59.97 individually
    shipping_estimate: 8.99,
    preview_image: '/print-previews/dream-bundle.png',
    personalization_fields: ['vision_image', 'habits', 'headline'],
    features: [
      'Save 20%',
      'Complete daily system',
      'Coordinated design',
      'Gift packaging available'
    ],
    elite_exclusive: false
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'catalog'

    // Catalog doesn't require auth
    if (action === 'catalog') {
      return getCatalog(url.searchParams)
    }

    // All other actions require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid or expired authentication token')
    }

    const userId = user.id

    let body: any = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    switch (action) {
      case 'customize':
        return await customizeProduct(supabase, userId, body)
      case 'order':
        return await createOrder(supabase, userId, body)
      case 'list_orders':
        return await listOrders(supabase, userId, url.searchParams)
      case 'get_order':
        return await getOrder(supabase, userId, url.searchParams)
      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error: any) {
    console.error('Print products error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Get product catalog
 */
function getCatalog(params: URLSearchParams) {
  const productType = params.get('type')
  const eliteOnly = params.get('elite') === 'true'

  let products = [...PRINT_PRODUCTS]

  if (productType) {
    products = products.filter(p => p.product_type === productType)
  }

  if (eliteOnly) {
    products = products.filter(p => p.elite_exclusive)
  }

  return new Response(
    JSON.stringify({
      success: true,
      products,
      categories: [
        { id: 'pad', name: 'Focus Pads', count: products.filter(p => p.product_type === 'pad').length },
        { id: 'cards', name: 'Cards & Decks', count: products.filter(p => p.product_type === 'cards').length },
        { id: 'sticker', name: 'Stickers', count: products.filter(p => p.product_type === 'sticker').length },
        { id: 'canvas', name: 'Canvas Prints', count: products.filter(p => p.product_type === 'canvas').length },
        { id: 'bundle', name: 'Bundles', count: products.filter(p => p.product_type === 'bundle').length }
      ]
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Customize product with user's content
 */
async function customizeProduct(supabase: any, userId: string, body: any) {
  const { productId, customization } = body

  if (!productId) {
    throw new Error('productId is required')
  }

  const product = PRINT_PRODUCTS.find(p => p.id === productId)
  if (!product) {
    throw new Error('Product not found')
  }

  // Fetch user's content based on product requirements
  const contentData: any = {}

  // Get vision boards if needed
  if (product.personalization_fields.includes('vision_image') ||
      product.personalization_fields.includes('vision_images') ||
      product.personalization_fields.includes('vision_board_id')) {
    // SECURITY: Always filter by user_id to prevent data bleeding
    const { data: visions } = await supabase
      .from('vision_boards')
      .select('id, prompt, image_url, is_favorite')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    contentData.visions = visions || []
  }

  // Get habits if needed
  if (product.personalization_fields.includes('habits') ||
      product.personalization_fields.includes('habit_list')) {
    const { data: habits } = await supabase
      .from('habits')
      .select('id, title, description, frequency')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(20)

    contentData.habits = habits || []
  }

  // Get AMIE identity profile if needed
  if (product.personalization_fields.includes('identity_profile') ||
      product.personalization_fields.includes('theme') ||
      product.personalization_fields.includes('encouragement_messages') ||
      product.personalization_fields.includes('affirmations')) {

    const { data: profile } = await supabase
      .from('user_identity_profiles')
      .select(`
        *,
        amie_themes (
          name,
          display_name,
          color_scheme,
          encouragement_phrases
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    contentData.identityProfile = profile
    contentData.theme = profile?.amie_themes
  }

  // Get milestones if needed
  if (product.personalization_fields.includes('milestones')) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('title, milestone_year')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .not('milestone_year', 'is', null)
      .limit(30)

    contentData.milestones = tasks || []
  }

  // Get weekly goals if needed
  if (product.personalization_fields.includes('weekly_goals')) {
    const { data: reviews } = await supabase
      .from('weekly_reviews')
      .select('next_steps')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    contentData.weeklyGoals = reviews?.next_steps || []
  }

  // Generate preview data
  const preview = generatePreview(product, contentData, customization)

  return new Response(
    JSON.stringify({
      success: true,
      product,
      contentData,
      preview,
      estimatedTotal: product.base_price + (product.shipping_estimate || 0)
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Generate preview data for a customized product
 */
function generatePreview(product: any, contentData: any, customization: any) {
  const preview: any = {
    productId: product.id,
    productName: product.name,
    elements: []
  }

  // Build preview elements based on product type
  switch (product.product_type) {
    case 'pad':
      preview.elements.push({
        type: 'header_image',
        source: customization?.visionImageId
          ? contentData.visions?.find((v: any) => v.id === customization.visionImageId)?.image_url
          : contentData.visions?.[0]?.image_url,
        fallback: '/default-vision.png'
      })
      preview.elements.push({
        type: 'headline',
        text: customization?.headline || 'My Vision for Tomorrow'
      })
      if (product.id === 'focus-pad-weekly' && contentData.habits) {
        preview.elements.push({
          type: 'habit_list',
          items: contentData.habits.slice(0, 7).map((h: any) => h.title)
        })
      }
      break

    case 'cards':
      if (product.id === 'habit-cue-cards' && contentData.habits) {
        preview.elements.push({
          type: 'card_grid',
          cards: contentData.habits.slice(0, 20).map((h: any, i: number) => ({
            title: h.title,
            description: h.description || '',
            encouragement: contentData.theme?.encouragement_phrases?.[i % (contentData.theme?.encouragement_phrases?.length || 1)] || 'You got this!'
          }))
        })
      } else if (product.id === 'affirmation-deck') {
        preview.elements.push({
          type: 'affirmation_cards',
          theme: contentData.theme?.display_name || 'Your Theme',
          sampleAffirmations: generateAffirmations(contentData.identityProfile, 5)
        })
      } else if (product.id === 'vision-postcards') {
        preview.elements.push({
          type: 'postcard_grid',
          images: contentData.visions?.slice(0, 10).map((v: any) => ({
            url: v.image_url,
            caption: v.prompt?.slice(0, 50) + '...'
          })) || []
        })
      }
      break

    case 'sticker':
      preview.elements.push({
        type: 'sticker_sheet',
        stickers: contentData.milestones?.map((m: any) => ({
          text: m.title,
          year: m.milestone_year
        })) || []
      })
      break

    case 'canvas':
      preview.elements.push({
        type: 'canvas_preview',
        imageUrl: customization?.visionBoardId
          ? contentData.visions?.find((v: any) => v.id === customization.visionBoardId)?.image_url
          : contentData.visions?.[0]?.image_url
      })
      break

    case 'bundle':
      preview.elements.push({
        type: 'bundle_contents',
        items: product.bundle_items
      })
      break
  }

  return preview
}

/**
 * Generate personalized affirmations
 */
function generateAffirmations(profile: any, count: number): string[] {
  const defaultAffirmations = [
    "I am capable of achieving my dreams.",
    "Every day I move closer to my goals.",
    "I embrace challenges as opportunities.",
    "My potential is limitless.",
    "I am worthy of success and happiness."
  ]

  if (!profile) return defaultAffirmations.slice(0, count)

  // Personalize based on profile
  const coreValues = profile.core_values || []
  const roles = profile.life_roles || []
  const drivers = profile.motivation_drivers || []

  const personalized: string[] = []

  coreValues.forEach((value: string) => {
    personalized.push(`I embody ${value.toLowerCase()} in all I do.`)
  })

  roles.forEach((role: string) => {
    personalized.push(`As a ${role.toLowerCase()}, I make a positive impact.`)
  })

  drivers.forEach((driver: string) => {
    personalized.push(`My ${driver.toLowerCase()} drives me forward.`)
  })

  // Fill with defaults if needed
  while (personalized.length < count) {
    personalized.push(defaultAffirmations[personalized.length % defaultAffirmations.length])
  }

  return personalized.slice(0, count)
}

/**
 * Create print order
 */
async function createOrder(supabase: any, userId: string, body: any) {
  const { productId, customization, shippingAddress, quantity = 1 } = body

  if (!productId || !shippingAddress) {
    throw new Error('productId and shippingAddress are required')
  }

  const product = PRINT_PRODUCTS.find(p => p.id === productId)
  if (!product) {
    throw new Error('Product not found')
  }

  // Check elite exclusivity
  if (product.elite_exclusive) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single()

    if (profile?.subscription_tier !== 'ELITE') {
      throw new Error('This product is exclusive to ELITE subscribers')
    }
  }

  // Calculate pricing
  const subtotal = product.base_price * quantity
  const shipping = product.shipping_estimate || 5.99
  const total = subtotal + shipping

  // Create order record
  const { data: order, error: orderError } = await supabase
    .from('print_product_orders')
    .insert({
      user_id: userId,
      product_id: productId,
      product_name: product.name,
      product_type: product.product_type,
      prodigi_sku: product.prodigi_sku,
      quantity,
      customization,
      shipping_address: shippingAddress,
      subtotal,
      shipping_cost: shipping,
      total_price: total,
      status: 'pending'
    })
    .select()
    .single()

  if (orderError) {
    throw new Error(`Failed to create order: ${orderError.message}`)
  }

  // In production, this would submit to Prodigi API
  // For now, we'll simulate order submission
  console.log(`Print order created: ${order.id} for product ${productId}`)

  return new Response(
    JSON.stringify({
      success: true,
      order: {
        id: order.id,
        productName: product.name,
        quantity,
        subtotal,
        shipping,
        total,
        status: 'pending',
        estimatedDelivery: getEstimatedDelivery()
      },
      message: 'Order created successfully. You will receive a confirmation email shortly.'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get estimated delivery date
 */
function getEstimatedDelivery(): string {
  const date = new Date()
  date.setDate(date.getDate() + 10) // 10 business days estimate
  return date.toISOString().split('T')[0]
}

/**
 * List user's print product orders
 */
async function listOrders(supabase: any, userId: string, params: URLSearchParams) {
  const limit = parseInt(params.get('limit') || '20')
  const status = params.get('status')

  let query = supabase
    .from('print_product_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: orders, error } = await query

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      orders: orders || []
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get specific order details
 */
async function getOrder(supabase: any, userId: string, params: URLSearchParams) {
  const orderId = params.get('orderId')

  if (!orderId) {
    throw new Error('orderId is required')
  }

  const { data: order, error } = await supabase
    .from('print_product_orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single()

  if (error || !order) {
    throw new Error('Order not found')
  }

  // Get product details
  const product = PRINT_PRODUCTS.find(p => p.id === order.product_id)

  return new Response(
    JSON.stringify({
      success: true,
      order,
      product
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
