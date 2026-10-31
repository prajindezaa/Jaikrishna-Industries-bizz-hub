/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Gemini Tool Definitions (Read Tools & Propose Tools ONLY)
 * Invariant: The model possesses ZERO tools that write to Firestore.
 */

export const ASSISTANT_GEMINI_TOOLS = [
  // ----------------------------------------------------
  // A. READ TOOLS
  // ----------------------------------------------------
  {
    name: 'search_customers',
    description: 'Search customer leads and accounts by company name, contact person, phone number, city, or stage.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Name, phone number, city, or keyword to match against customers.',
        },
        limit: {
          type: 'INTEGER',
          description: 'Maximum number of results to return (max 20).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_tasks',
    description: 'Look up scheduled follow-up tasks, calls, dispatches, or general tasks by date, assignee email, or customer name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: {
          type: 'STRING',
          description: 'Date in YYYY-MM-DD or "today", "tomorrow".',
        },
        assignedTo: {
          type: 'STRING',
          description: 'Email of the team member assigned to the task.',
        },
        status: {
          type: 'STRING',
          description: 'Task status: "Pending", "In Progress", "Done", or "All".',
        },
      },
    },
  },
  {
    name: 'get_daily_or_weekly_plan',
    description: 'Retrieve the daily or weekly operations briefing plan for a given date.',
    parameters: {
      type: 'OBJECT',
      properties: {
        planType: {
          type: 'STRING',
          enum: ['daily', 'weekly'],
          description: 'Whether to fetch the daily morning briefing or weekly schedule.',
        },
        date: {
          type: 'STRING',
          description: 'Target date in YYYY-MM-DD.',
        },
      },
      required: ['planType', 'date'],
    },
  },
  {
    name: 'list_festival_events',
    description: 'Retrieve upcoming Tamil Nadu pooja & festival calendar events for campaign planning.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fromDate: {
          type: 'STRING',
          description: 'Starting date in YYYY-MM-DD.',
        },
        toDate: {
          type: 'STRING',
          description: 'Ending date in YYYY-MM-DD.',
        },
      },
    },
  },

  // ----------------------------------------------------
  // B. PROPOSE TOOLS (Zero write path — Generates pending proposal only)
  // ----------------------------------------------------
  {
    name: 'propose_task_create',
    description: 'Propose creating a new scheduled follow-up task or pooja delivery for a customer. Does NOT create it directly; presents a preview confirmation card to the user.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Actionable title of the task.',
        },
        customerNameOrId: {
          type: 'STRING',
          description: 'Customer name or customer ID associated with the task.',
        },
        date: {
          type: 'STRING',
          description: 'Date in YYYY-MM-DD, or natural language like "today", "tomorrow", "Friday".',
        },
        time: {
          type: 'STRING',
          description: 'Start time like "10:00", "4:00 PM". If unspecified, defaults to 10:00 AM IST.',
        },
        priority: {
          type: 'STRING',
          enum: ['Low', 'Medium', 'High', 'Urgent'],
          description: 'Priority level of the task.',
        },
        type: {
          type: 'STRING',
          enum: ['Follow-up Call', 'Payment Collection', 'Order Dispatch', 'Sample Delivery', 'Customer Visit', 'General'],
          description: 'Category of the task.',
        },
        assignedToEmail: {
          type: 'STRING',
          description: 'Email of the team member to assign the task to (one of the 3 allowlisted members).',
        },
        notes: {
          type: 'STRING',
          description: 'Additional operational notes for the task.',
        },
      },
      required: ['title', 'date', 'assignedToEmail'],
    },
  },
  {
    name: 'propose_task_edit',
    description: 'Propose modifying fields of an existing task (e.g. title, priority, date, or notes). Generates a preview card for user confirmation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: {
          type: 'STRING',
          description: 'Unique ID of the existing task.',
        },
        title: { type: 'STRING' },
        date: { type: 'STRING' },
        time: { type: 'STRING' },
        priority: { type: 'STRING', enum: ['Low', 'Medium', 'High', 'Urgent'] },
        assignedToEmail: { type: 'STRING' },
        notes: { type: 'STRING' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'propose_task_status',
    description: 'Propose marking a task In Progress or Done with an optional completion note.',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskId: { type: 'STRING', description: 'Unique ID of the task.' },
        status: { type: 'STRING', enum: ['In Progress', 'Done'] },
        completionNote: { type: 'STRING', description: 'Note explaining what was achieved upon completion.' },
      },
      required: ['taskId', 'status'],
    },
  },
  {
    name: 'propose_customer_add',
    description: 'Propose adding a new wholesale or retail customer lead. Generates a preview card for member confirmation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        companyName: { type: 'STRING', description: 'Business or store name.' },
        contactPerson: { type: 'STRING', description: 'Key contact person name.' },
        phone: { type: 'STRING', description: 'Phone number.' },
        city: { type: 'STRING', description: 'City/town in Tamil Nadu or South India.' },
        leadStage: {
          type: 'STRING',
          enum: ['Discovery', 'Sample Sent', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'],
        },
        groupName: { type: 'STRING', description: 'Customer category group (e.g. Salem Wholesalers).' },
        notes: { type: 'STRING', description: 'Introductory notes.' },
        nextFollowUpDate: { type: 'STRING', description: 'Initial follow-up date YYYY-MM-DD.' },
      },
      required: ['companyName', 'phone'],
    },
  },
  {
    name: 'propose_customer_edit',
    description: 'Propose editing customer lead details, phone, city, tags, or next follow-up date.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING', description: 'Customer document ID.' },
        companyName: { type: 'STRING' },
        contactPerson: { type: 'STRING' },
        phone: { type: 'STRING' },
        city: { type: 'STRING' },
        leadStage: {
          type: 'STRING',
          enum: ['Discovery', 'Sample Sent', 'Quotation Sent', 'Negotiation', 'Won', 'Lost', 'Inactive'],
        },
        nextFollowUpDate: { type: 'STRING' },
        notes: { type: 'STRING' },
      },
      required: ['customerId'],
    },
  },
  {
    name: 'propose_customer_log_outcome',
    description: 'Propose logging an outreach call/visit outcome for a customer with optional follow-up scheduling.',
    parameters: {
      type: 'OBJECT',
      properties: {
        customerId: { type: 'STRING', description: 'Customer document ID.' },
        channel: { type: 'STRING', enum: ['call', 'whatsapp', 'visit', 'email'] },
        outcome: {
          type: 'STRING',
          enum: ['interested', 'callback_requested', 'busy', 'wrong_number', 'not_interested', 'sample_requested', 'order_placed'],
        },
        notes: { type: 'STRING', description: 'Call summary details.' },
        nextFollowUpDate: { type: 'STRING', description: 'Next scheduled touchpoint date.' },
      },
      required: ['customerId', 'channel', 'outcome', 'notes'],
    },
  },
  {
    name: 'propose_plan_upsert',
    description: 'Propose creating or updating the daily or weekly operations plan target outcomes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        planType: { type: 'STRING', enum: ['daily', 'weekly'] },
        date: { type: 'STRING', description: 'Target date YYYY-MM-DD.' },
        title: { type: 'STRING', description: 'Title of the plan briefing.' },
        targetOutcomes: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Key business outcomes or sales targets to accomplish.',
        },
        reviewNotes: { type: 'STRING', description: 'End-of-day or review notes.' },
      },
      required: ['planType', 'date', 'title', 'targetOutcomes'],
    },
  },
  {
    name: 'propose_festival_event',
    description: 'Propose adding or updating a pooja or temple festival event on the calendar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Festival name (e.g. Panguni Uthiram, Navaratri).' },
        date: { type: 'STRING', description: 'Date YYYY-MM-DD.' },
        notes: { type: 'STRING', description: 'Production or packaging preparation notes.' },
      },
      required: ['name', 'date'],
    },
  },
  {
    name: 'propose_meta_ad_draft',
    description: 'Propose creating or editing a planning draft for a Meta Ad pooja campaign.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Campaign draft name.' },
        occasion: { type: 'STRING', description: 'Associated festival or pooja occasion.' },
        goal: { type: 'STRING', enum: ['Messages', 'Sales', 'Awareness', 'Traffic'] },
        dailyBudget: { type: 'NUMBER', description: 'Daily budget in INR.' },
        totalBudget: { type: 'NUMBER', description: 'Total campaign budget in INR.' },
        plannedStart: { type: 'STRING', description: 'Planned start date YYYY-MM-DD.' },
        plannedEnd: { type: 'STRING', description: 'Planned end date YYYY-MM-DD.' },
      },
      required: ['name'],
    },
  },
];
