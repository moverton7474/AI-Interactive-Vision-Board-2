import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Generate Workbook PDF Edge Function
 *
 * Creates personalized workbook sections and generates PDF content for printing via Prodigi.
 * Uses the knowledge base and user data to populate workbook sections.
 *
 * Endpoints:
 * - POST /generate-workbook-pdf?action=create_order - Create a new workbook order
 * - POST /generate-workbook-pdf?action=generate - Generate PDF sections for an order
 * - GET /generate-workbook-pdf?action=get_templates - Get available templates
 * - GET /generate-workbook-pdf?action=get_order&order_id=xxx - Get order details
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' }
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'get_templates'

    switch (action) {
      case 'get_templates':
        return await getTemplates(supabase)
      case 'create_order':
        const createBody = await req.json()
        return await createOrder(supabase, userId, createBody)
      case 'generate':
        const generateBody = await req.json()
        return await generateWorkbook(supabase, userId, generateBody.order_id)
      case 'get_order':
        const orderId = url.searchParams.get('order_id')
        return await getOrder(supabase, userId, orderId)
      case 'get_orders':
        return await getOrders(supabase, userId)
      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error: any) {
    console.error('Generate workbook PDF error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

/**
 * Get available workbook templates
 */
async function getTemplates(supabase: any) {
  const { data, error } = await supabase
    .from('workbook_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error

  return new Response(
    JSON.stringify({ success: true, templates: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Create a new workbook order
 *
 * WORKBOOK V2: Now accepts workbook_pages from the wizard to ensure
 * the PDF matches exactly what the user previewed.
 */
async function createOrder(supabase: any, userId: string, body: any) {
  const {
    template_id,
    title,
    subtitle,
    dedication_text,
    cover_style,
    include_weekly_journal,
    include_habit_tracker,
    vision_board_ids,
    included_habits,
    shipping_address,
    workbook_pages // NEW: Pre-generated pages from the wizard preview
  } = body

  // Get template for pricing (allow mock templates)
  let template = null;
  if (template_id && !template_id.startsWith('executive-')) {
    const { data, error: templateError } = await supabase
      .from('workbook_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (!templateError) {
      template = data;
    }
  }

  // Fallback to mock template pricing if not found
  if (!template) {
    template = {
      id: template_id || 'executive-leather',
      base_price: 89.00,
      shipping_estimate: 12.99,
      sku: 'EXEC-LEATHER-7x9'
    };
  }

  // Calculate pricing
  const subtotal = template.base_price
  const shippingCost = template.shipping_estimate || 9.99
  const totalPrice = subtotal + shippingCost

  // Create the order with stored pages
  const { data: order, error: orderError } = await supabase
    .from('workbook_orders')
    .insert([{
      user_id: userId,
      template_id,
      status: 'draft',
      title: title || 'My Vision Workbook',
      subtitle: subtitle || new Date().getFullYear().toString(),
      dedication_text,
      cover_style: cover_style || 'classic',
      include_weekly_journal: include_weekly_journal ?? true,
      include_habit_tracker: include_habit_tracker ?? true,
      vision_board_ids: vision_board_ids || [],
      included_habits: included_habits || [],
      shipping_address,
      subtotal,
      shipping_cost: shippingCost,
      total_price: totalPrice,
      customization_data: {
        include_foreword: body.include_foreword ?? true,
        included_sections: body.included_sections || [],
        // Store the exact pages used in preview for PDF generation
        workbook_pages: workbook_pages || null,
        ...body.customization_data
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (orderError) throw orderError

  console.log(`[CreateOrder] Created order ${order.id} with ${workbook_pages?.length || 0} pre-generated pages`);

  return new Response(
    JSON.stringify({
      success: true,
      order: { ...order, template }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Generate workbook sections and PDF
 *
 * WORKBOOK V2: Uses stored WorkbookPage[] from order if available,
 * ensuring the PDF matches exactly what the user previewed.
 */
async function generateWorkbook(supabase: any, userId: string, orderId: string) {
  if (!orderId) throw new Error('Order ID is required')

  // Get the order
  const { data: order, error: orderError } = await supabase
    .from('workbook_orders')
    .select('*, template:workbook_templates(*)')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single()

  if (orderError || !order) {
    throw new Error('Order not found')
  }

  // Update status to generating
  await supabase
    .from('workbook_orders')
    .update({ status: 'generating', generation_started_at: new Date().toISOString() })
    .eq('id', orderId)

  // WORKBOOK V2: Check if we have pre-generated pages from the wizard
  const storedPages = order.customization_data?.workbook_pages;

  let pagesToRender: any[];

  if (storedPages && Array.isArray(storedPages) && storedPages.length > 0) {
    // USE STORED PAGES (Single Source of Truth)
    console.log(`[GenerateWorkbook] Using ${storedPages.length} pre-generated pages from wizard preview`);
    pagesToRender = storedPages;
  } else {
    // FALLBACK: Generate sections from scratch (legacy behavior)
    console.log(`[GenerateWorkbook] No stored pages found, generating from scratch...`);

    // Get user's knowledge base
    const { data: knowledgeBase } = await supabase
      .from('user_knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Get vision boards if selected
    // SECURITY: Also filter by user_id to prevent data bleeding (defense-in-depth with RLS)
    let visionBoards: any[] = []
    if (order.vision_board_ids?.length > 0) {
      const { data } = await supabase
        .from('vision_boards')
        .select('*')
        .in('id', order.vision_board_ids)
        .eq('user_id', userId)
      visionBoards = data || []
    }

    // Get habits if selected
    // SECURITY: Also filter by user_id to prevent data bleeding (defense-in-depth with RLS)
    let habits: any[] = []
    if (order.included_habits?.length > 0) {
      const { data } = await supabase
        .from('habits')
        .select('*')
        .in('id', order.included_habits)
        .eq('user_id', userId)
      habits = data || []
    }

    // Get action tasks
    const { data: actionTasks } = await supabase
      .from('action_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })

    // Generate sections
    const sections = await generateSections(supabase, orderId, {
      order,
      knowledgeBase,
      visionBoards,
      habits,
      actionTasks: actionTasks || []
    })

    // Map legacy sections to page format
    pagesToRender = sections.map(s => ({
      type: s.section_type === 'monthly_planner' ? 'MONTHLY_PLANNER' :
        s.section_type === 'habit_tracker' ? 'HABIT_TRACKER' :
        s.section_type === 'vision_gallery' ? 'VISION_BOARD_SPREAD' :
          'GENERIC',
      ...s.content,
      monthlyData: s.content.monthlyData,
      habitTracker: s.section_type === 'habit_tracker' ? {
        habits: s.content.habits || [],
        period: 'MONTH'
      } : undefined,
      imageBlocks: s.section_type === 'vision_gallery' && s.content.visionBoards ?
        s.content.visionBoards.map((vb: any) => ({
          id: vb.id,
          sourceType: 'VISION_IMAGE',
          url: vb.imageUrl,
          alt: vb.prompt,
          layout: 'FULL_BLEED',
          position: { x: 0, y: 5, w: 100, h: 70 }
        })) : [],
      textBlocks: [
        { role: 'TITLE', content: s.title, position: { x: 10, y: 10 } },
        ...(s.content.text ? [{ role: 'BODY', content: s.content.text, position: { x: 10, y: 20 } }] : [])
      ]
    }));
  }

  // REAL PDF GENERATION with v2.1 theme support
  console.log(`[GenerateWorkbook] Generating PDF for ${pagesToRender.length} pages...`);

  // Extract theme from order customization data or stored pages
  const themePack = order.theme_pack || order.customization_data?.theme_pack || 'executive';
  const bindingType = order.template?.binding || 'SOFTCOVER';

  console.log(`[GenerateWorkbook] Using theme: ${themePack}, binding: ${bindingType}`);

  let pdfBytes: Uint8Array;
  try {
    const { generatePdf } = await import('./pdfGenerator.ts');
    pdfBytes = await generatePdf(pagesToRender, {
      theme: themePack,
      bindingType: bindingType
    });
  } catch (e: any) {
    console.error("[GenerateWorkbook] PDF Generation failed:", e);
    throw new Error(`PDF Generation failed: ${e.message}`);
  }

  // Upload to Supabase Storage
  const fileName = `${orderId}/final_workbook.pdf`;
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('workbooks') // Ensure this bucket exists
    .upload(fileName, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError);
    throw new Error("Failed to upload generated PDF");
  }

  // Get Public URL
  const { data: { publicUrl } } = supabase
    .storage
    .from('workbooks')
    .getPublicUrl(fileName);

  const pdfUrl = publicUrl;

  // Update order with PDF URL
  await supabase
    .from('workbook_orders')
    .update({
      merged_pdf_url: pdfUrl,
      status: 'printing'
    })
    .eq('id', orderId);

  // Submit to Prodigi
  // We need to construct the payload for submit-to-prodigi
  // The submit-to-prodigi function expects: { orderId, recipient, items }

  const shippingAddress = order.shipping_address || {};

  const prodigiPayload = {
    orderId: orderId,
    recipient: {
      name: shippingAddress.name || 'Valued Customer',
      address: {
        line1: shippingAddress.line1,
        line2: shippingAddress.line2,
        townOrCity: shippingAddress.city,
        stateOrCounty: shippingAddress.state,
        postalOrZipCode: shippingAddress.postalCode,
        countryCode: shippingAddress.country || 'US'
      }
    },
    items: [
      {
        sku: order.template?.sku || 'GLOBAL-NTB-A5-HC-100',
        copies: 1,
        sizing: 'fillPrintArea',
        assets: [
          {
            printArea: 'default',
            url: pdfUrl // The URL of the generated PDF
          }
        ]
      }
    ]
  };

  console.log("Submitting to Prodigi...", JSON.stringify(prodigiPayload));

  // Invoke submit-to-prodigi
  const { data: prodigiResponse, error: prodigiError } = await supabase.functions.invoke('submit-to-prodigi', {
    body: prodigiPayload
  });

  if (prodigiError) {
    console.error("Prodigi Submission Failed:", prodigiError);
    // Don't fail the whole request, but log it. Status remains 'printing' or could be set to 'error'
    await supabase.from('workbook_orders').update({ status: 'error', error_message: 'Prodigi submission failed' }).eq('id', orderId);
  } else {
    console.log("Prodigi Submission Success:", prodigiResponse);
    await supabase.from('workbook_orders').update({
      status: 'submitted',
      prodigi_order_id: prodigiResponse.orderId,
      submitted_at: new Date().toISOString()
    }).eq('id', orderId);
  }

  // Update order status to ready (or submitted)
  await supabase
    .from('workbook_orders')
    .update({
      generation_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)

  return new Response(
    JSON.stringify({
      success: true,
      order_id: orderId,
      pages_generated: pagesToRender.length,
      theme: themePack,
      status: prodigiError ? 'error' : 'submitted',
      pdf_url: pdfUrl
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Generate individual workbook sections
 */
async function generateSections(
  supabase: any,
  orderId: string,
  data: {
    order: any,
    knowledgeBase: any,
    visionBoards: any[],
    habits: any[],
    actionTasks: any[]
  }
): Promise<any[]> {
  const { order, knowledgeBase, visionBoards, habits, actionTasks } = data
  const sections: any[] = []
  let sectionOrder = 0

  // 1. Cover Section
  sections.push({
    workbook_order_id: orderId,
    section_type: 'cover',
    section_order: sectionOrder++,
    title: order.title,
    content: {
      title: order.title,
      subtitle: order.subtitle,
      style: order.cover_style,
      userName: knowledgeBase?.names || 'Visionary'
    },
    status: 'complete'
  })

  // 2. Title Page
  sections.push({
    workbook_order_id: orderId,
    section_type: 'title_page',
    section_order: sectionOrder++,
    title: 'Title Page',
    content: {
      title: order.title,
      subtitle: order.subtitle,
      createdDate: new Date().toLocaleDateString(),
      userName: knowledgeBase?.names
    },
    status: 'complete'
  })

  // 3. Dedication (if provided)
  if (order.dedication_text) {
    sections.push({
      workbook_order_id: orderId,
      section_type: 'dedication',
      section_order: sectionOrder++,
      title: 'Dedication',
      content: {
        text: order.dedication_text
      },
      status: 'complete'
    })
  }



  // 4. AI Coach Letter (Ghostwriter)
  const includeForeword = order.customization_data?.include_foreword ?? true;
  if (includeForeword) {
    let forewordContent = '';
    try {
      // Call Gemini Proxy to generate the foreword
      const goals = knowledgeBase?.top_priorities || [];
      const habitsList = habits.map((h: any) => h.title);

      const prompt = `
        You are the user's "Future Self" writing from 3 years in the future.
        You have achieved these goals: ${goals.join(', ') || 'living my best life'}.
        You stuck to these habits: ${habitsList.join(', ') || 'consistent daily action'}.
        
        Write a heartfelt, inspiring letter to your past self (the user today).
        - Acknowledge the doubts they might be feeling right now.
        - Tell them that the hard work paid off.
        - Describe how amazing life is now that these visions are reality.
        - Keep it under 300 words.
        - Sign it "With gratitude,\nYour Future Self".
        `;

      const geminiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/gemini-proxy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'raw',
          contents: [{ parts: [{ text: prompt }] }],
          config: { temperature: 0.7, maxOutputTokens: 1000 }
        })
      });

      if (geminiResponse.ok) {
        const data = await geminiResponse.json();
        forewordContent = data.response?.candidates?.[0]?.content?.parts?.[0]?.text;
      }
    } catch (e) {
      console.error('Failed to generate foreword:', e);
    }

    // Fallback if generation failed
    if (!forewordContent) {
      forewordContent = `Dear Visionary,\n\nI am writing to you from the future to tell you that everything you are working for is worth it. Keep going.\n\nSincerely,\nYour Future Self`;
    }

    sections.push({
      workbook_order_id: orderId,
      section_type: 'coach_letter',
      section_order: sectionOrder++,
      title: 'A Letter from Your Future Self',
      content: {
        userName: knowledgeBase?.names || 'Visionary',
        text: forewordContent
      },
      status: 'complete'
    })
  }

  // 5. Vision Gallery (vision boards with reflection prompts)
  if (visionBoards.length > 0) {
    sections.push({
      workbook_order_id: orderId,
      section_type: 'vision_gallery',
      section_order: sectionOrder++,
      title: 'Your Vision Gallery',
      content: {
        visionBoards: visionBoards.map(vb => ({
          id: vb.id,
          imageUrl: vb.image_url,
          prompt: vb.prompt,
          createdAt: vb.created_at,
          reflectionPrompts: [
            'Why does this vision matter to you?',
            'How will life feel when you achieve this?',
            'What must be true financially for this to happen?'
          ]
        }))
      },
      status: 'complete'
    })
  }

  // 6. Goal Overview (New)
  if (order.customization_data?.included_sections?.includes('goal_overview') || true) { // Default to true for now
    sections.push({
      workbook_order_id: orderId,
      section_type: 'goal_overview',
      section_order: sectionOrder++,
      title: 'Annual Goals Overview',
      content: {
        goals: knowledgeBase?.top_priorities || []
      },
      status: 'complete'
    });
  }

  // 7. Financial Snapshot
  if (knowledgeBase?.financial_summary) {
    sections.push({
      workbook_order_id: orderId,
      section_type: 'financial_snapshot',
      section_order: sectionOrder++,
      title: 'Your Financial Snapshot',
      content: {
        summary: knowledgeBase.financial_summary,
        retirementGoal: knowledgeBase.retirement_goal,
        monthlyBudget: knowledgeBase.monthly_budget,
        plaidConnected: knowledgeBase.plaid_accounts_summary?.connected || false
      },
      status: 'complete'
    })
  }

  // 8. Action Plan (3-year roadmap)
  if (actionTasks.length > 0) {
    // Group by milestone year
    const tasksByYear: Record<number, any[]> = {}
    for (const task of actionTasks) {
      const year = task.milestone_year || new Date().getFullYear()
      if (!tasksByYear[year]) tasksByYear[year] = []
      tasksByYear[year].push(task)
    }

    sections.push({
      workbook_order_id: orderId,
      section_type: 'action_plan',
      section_order: sectionOrder++,
      title: 'Your 3-Year Action Plan',
      content: {
        tasksByYear,
        totalTasks: actionTasks.length,
        completedTasks: actionTasks.filter(t => t.is_completed).length,
        goalsummary: knowledgeBase?.goals_summary
      },
      status: 'complete'
    })
  }

  // 9. Habit Tracker (12-month grids)
  if (order.include_habit_tracker && habits.length > 0) {
    sections.push({
      workbook_order_id: orderId,
      section_type: 'habit_tracker',
      section_order: sectionOrder++,
      title: '12-Month Habit Tracker',
      content: {
        habits: habits.map(h => ({
          id: h.id,
          title: h.title,
          description: h.description,
          frequency: h.frequency,
          currentStreak: h.current_streak || 0
        })),
        habitsSummary: knowledgeBase?.habits_summary
      },
      status: 'complete'
    })
  }

  // 10. Monthly Planner (Calendar)
  if (order.customization_data?.included_sections?.includes('monthly_planner')) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const year = new Date().getFullYear() + 1; // Planning for next year

    for (let i = 0; i < 12; i++) {
      sections.push({
        workbook_order_id: orderId,
        section_type: 'monthly_planner',
        section_order: sectionOrder++,
        title: `${months[i]} ${year}`,
        content: {
          monthlyData: {
            monthLabel: months[i],
            year: year,
            weeks: generateCalendarWeeks(year, i) // Helper function we'll need to add or inline
          }
        },
        status: 'complete'
      });
    }
  }

  // 11. Weekly Journal (52 weeks)
  if (order.include_weekly_journal) {
    sections.push({
      workbook_order_id: orderId,
      section_type: 'weekly_journal',
      section_order: sectionOrder++,
      title: '52-Week Reflection Journal',
      content: {
        weeksCount: 52,
        prompts: [
          'Wins this week:',
          'Challenges faced:',
          'Lessons learned:',
          'Next week focus:',
          'Message from future self:'
        ]
      },
      status: 'complete'
    })
  }

  // 12. Monthly Reflection (New)
  if (order.customization_data?.included_sections?.includes('reflection')) {
    sections.push({
      workbook_order_id: orderId,
      section_type: 'reflection',
      section_order: sectionOrder++,
      title: 'Monthly Reflections',
      content: {
        monthsCount: 12
      },
      status: 'complete'
    });
  }

  // 13. Notes Section
  sections.push({
    workbook_order_id: orderId,
    section_type: 'notes',
    section_order: sectionOrder++,
    title: 'Notes & Ideas',
    content: {
      pagesCount: 10
    },
    status: 'complete'
  })

  // 14. Back Cover
  sections.push({
    workbook_order_id: orderId,
    section_type: 'back_cover',
    section_order: sectionOrder++,
    title: 'Back Cover',
    content: {
      tagline: 'Powered by Visionary AI',
      qrCodeUrl: `https://visionary.app/reorder/${orderId}`,
      supportUrl: 'https://visionary.app/support'
    },
    status: 'complete'
  })

  // Insert all sections
  const { data: insertedSections, error } = await supabase
    .from('workbook_sections')
    .insert(sections.map(s => ({
      ...s,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })))
    .select()

  if (error) {
    console.error('Failed to insert sections:', error)
    throw error
  }

  return insertedSections || sections
}

/**
 * Get order details
 */
async function getOrder(supabase: any, userId: string, orderId: string | null) {
  if (!orderId) throw new Error('Order ID is required')

  const { data: order, error } = await supabase
    .from('workbook_orders')
    .select('*, template:workbook_templates(*), sections:workbook_sections(*)')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single()

  if (error) throw error

  return new Response(
    JSON.stringify({ success: true, order }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Get all orders for a user
 */
async function getOrders(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('workbook_orders')
    .select('*, template:workbook_templates(name, sku, size, binding)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return new Response(
    JSON.stringify({ success: true, orders: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Helper to generate calendar weeks for a given month/year
 */
function generateCalendarWeeks(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  const weeks = [];
  let currentWeek = [];

  // Pad start
  for (let i = 0; i < firstDay.getDay(); i++) {
    currentWeek.push({ id: `pad-start-${i}`, dateLabel: '' });
  }

  // Days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    currentWeek.push({ id: `day-${d}`, dateLabel: String(d) });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad end
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ id: `pad-end-${currentWeek.length}`, dateLabel: '' });
    }
    weeks.push(currentWeek);
  }

  return weeks;
}
