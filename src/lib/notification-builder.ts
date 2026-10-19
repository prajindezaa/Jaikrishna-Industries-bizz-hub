/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Central Message & Content Builder (English & Tamil)
 * Guaranteed:
 * 1. Uses REAL entity data only (customer name, task title, amount, etc.)
 * 2. Short, crisp text without sensitive personal data
 * 3. Length limits strictly enforced for mobile push (Title <= 60 chars, Body <= 140 chars)
 * 4. Tamil text marked clearly as [needs proofreading by owner]
 */

export interface MessagePayload {
  title: string;
  body: string;
}

export interface MessageContext {
  taskTitle?: string;
  customerName?: string;
  timeStr?: string;
  dateStr?: string;
  assignerName?: string;
  assigneeName?: string;
  nudgeIdx?: number;
  maxNudges?: number;
  count?: number;
  highCount?: number;
  amount?: number;
  productSummary?: string;
  ruleName?: string;
  adName?: string;
  festivalName?: string;
  reason?: string;
}

export type NotificationTemplateType =
  | 'task_assigned'
  | 'task_reassigned'
  | 'task_due_soon'
  | 'task_starting_now'
  | 'task_overdue_nudge'
  | 'task_missed_peer'
  | 'task_completed'
  | 'task_empty_today'
  | 'task_empty_tomorrow'
  | 'cust_followup_due'
  | 'cust_followup_overdue'
  | 'cust_assigned'
  | 'leads_new_single'
  | 'leads_new_bundled'
  | 'cust_import_success'
  | 'cust_import_failed'
  | 'cust_dnm_changed'
  | 'plan_morning_brief'
  | 'plan_evening_review'
  | 'plan_missing_daily'
  | 'plan_missing_weekly'
  | 'plan_ads_stale'
  | 'ad_publish_due'
  | 'ad_ending_soon'
  | 'ad_results_missing'
  | 'ad_stage_changed'
  | 'ad_festival_unplanned'
  | 'wa_queue_pending'
  | 'wa_queue_completed'
  | 'wa_outside_hours_logged'
  | 'wa_freq_override_logged'
  | 'order_new_recorded'
  | 'order_first_promo'
  | 'auto_run_summary'
  | 'auto_cap_deferred'
  | 'auto_rule_failed'
  | 'auto_cron_missed'
  | 'sys_all_devices_offline'
  | 'sys_backup_reminder'
  | 'sys_member_changed'
  | 'sys_quota_warning';

function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function buildNotificationMessage(
  type: NotificationTemplateType,
  ctx: MessageContext,
  lang: 'en' | 'ta' = 'en'
): MessagePayload {
  const isTa = lang === 'ta';
  const cName = ctx.customerName || 'Customer';
  const tTitle = ctx.taskTitle || 'Task';
  const assigner = ctx.assignerName || 'Team member';
  const time = ctx.timeStr || '';
  const nudge = ctx.nudgeIdx || 1;
  const maxNudges = ctx.maxNudges || 5;

  let title = '';
  let body = '';

  switch (type) {
    case 'task_assigned':
      title = isTa
        ? `[needs proofreading by owner] புதிய பணி: ${cName}`
        : `New Task: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] ${assigner} உங்களுக்காக "${tTitle}" பணியை ஒதுக்கியுள்ளார்.`
        : `${assigner} assigned task "${tTitle}" to you.`;
      break;

    case 'task_reassigned':
      title = isTa
        ? `[needs proofreading by owner] பணி மாற்றம்: ${cName}`
        : `Task Reassigned: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] "${tTitle}" பணி உங்களுக்கு ஒதுக்கப்பட்டுள்ளது.`
        : `Task "${tTitle}" was reassigned to you.`;
      break;

    case 'task_due_soon':
      title = isTa
        ? `[needs proofreading by owner] 15 நிமிடத்தில்: ${cName}`
        : `Starting in 15m: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] "${tTitle}" பணி ${time} மணிக்கு தொடங்க உள்ளது.`
        : `"${tTitle}" starts at ${time}. Tap to view contact details.`;
      break;

    case 'task_starting_now':
      title = isTa
        ? `[needs proofreading by owner] இப்போது தொடங்குகிறது: ${cName}`
        : `Starting Now: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] "${tTitle}" பணியை தொடங்கவும்.`
        : `Scheduled time reached for "${tTitle}".`;
      break;

    case 'task_overdue_nudge':
      title = isTa
        ? `[needs proofreading by owner] தாமதமான பணி (${nudge}/${maxNudges}): ${cName}`
        : `Overdue (${nudge}/${maxNudges}): ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] "${tTitle}" பணி முடிக்கப்படவில்லை. தயவுசெய்து முடிவை பதிவு செய்யவும்.`
        : `"${tTitle}" was not completed. Please log outcome or reschedule.`;
      break;

    case 'task_missed_peer':
      title = isTa
        ? `[needs proofreading by owner] விடுபட்ட பணி: ${cName}`
        : `Missed Task Alert: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] ${ctx.assigneeName || 'Member'} "${tTitle}" பணியை இன்று முடிக்கவில்லை.`
        : `${ctx.assigneeName || 'Member'} missed task "${tTitle}" today.`;
      break;

    case 'task_completed':
      title = isTa
        ? `[needs proofreading by owner] பணி முடிந்தது: ${cName}`
        : `Task Completed: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] ${ctx.assigneeName || 'Member'} "${tTitle}" பணியை முடித்துள்ளார்.`
        : `${ctx.assigneeName || 'Member'} marked "${tTitle}" as completed.`;
      break;

    case 'task_empty_today':
      title = isTa
        ? `[needs proofreading by owner] இன்று பணிகள் இல்லை`
        : `No Tasks Scheduled Today`;
      body = isTa
        ? `[needs proofreading by owner] இன்று உங்களுக்கு பணிகள் இல்லை. பின்தொடர்தல் பணிகளை உருவாக்கவும்.`
        : `You have 0 tasks scheduled for today. Review customer follow-ups to plan your day.`;
      break;

    case 'task_empty_tomorrow':
      title = isTa
        ? `[needs proofreading by owner] நாளைக்கான திட்டமிடல்`
        : `Plan Ahead for Tomorrow`;
      body = isTa
        ? `[needs proofreading by owner] நாளைக்கு இன்னும் பணிகள் எதுவும் ஒதுக்கப்படவில்லை.`
        : `0 tasks scheduled for tomorrow. Add priorities now for an organized morning.`;
      break;

    case 'cust_followup_due':
      title = isTa
        ? `[needs proofreading by owner] பின்தொடர வேண்டிய நாள்: ${cName}`
        : `Follow-up Due: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] ${cName}-ஐ இன்று தொடர்பு கொள்ள வேண்டும்.`
        : `Scheduled contact date for ${cName} is today. Tap to call or message.`;
      break;

    case 'cust_followup_overdue':
      title = isTa
        ? `[needs proofreading by owner] தாமதமான பின்தொடர்தல்: ${cName}`
        : `Overdue Follow-up: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] ${cName} பின்தொடர்தல் தாமதமாகியுள்ளது. தொடர்பு கொள்ளவும்.`
        : `Scheduled follow-up with ${cName} was missed. Immediate contact advised.`;
      break;

    case 'cust_assigned':
      title = isTa
        ? `[needs proofreading by owner] வாடிக்கையாளர் ஒதுக்கீடு: ${cName}`
        : `Customer Assigned: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] ${cName} உங்கள் கணக்கில் ஒதுக்கப்பட்டுள்ளது.`
        : `${cName} has been assigned to you.`;
      break;

    case 'leads_new_single':
      title = isTa
        ? `[needs proofreading by owner] புதிய லீட்: ${cName}`
        : `New Lead: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] ${cName} புதிய லீடாக பதிவாகியுள்ளது.`
        : `New lead received from ${cName}. Tap to review details.`;
      break;

    case 'leads_new_bundled':
      title = isTa
        ? `[needs proofreading by owner] புதிய லீட்கள் (${ctx.count} லீட்கள்)`
        : `New Leads Received (${ctx.count})`;
      body = isTa
        ? `[needs proofreading by owner] ${cName} மற்றும் மேலும் ${Math.max(0, (ctx.count || 0) - 1)} லீட்கள் பதிவாகியுள்ளன.`
        : `${cName} and ${(ctx.count || 1) - 1} more new leads need initial contact.`;
      break;

    case 'cust_import_success':
      title = isTa
        ? `[needs proofreading by owner] பட்டியல் பதிவேற்றம் முடிந்தது`
        : `Customer Import Complete`;
      body = isTa
        ? `[needs proofreading by owner] ${ctx.count || 0} வாடிக்கையாளர் விவரங்கள் வெற்றிகரமாக பதிவேற்றப்பட்டன.`
        : `Successfully imported ${ctx.count || 0} customers into your CRM.`;
      break;

    case 'cust_import_failed':
      title = isTa
        ? `[needs proofreading by owner] பதிவேற்றம் தோல்வி`
        : `Customer Import Issue`;
      body = isTa
        ? `[needs proofreading by owner] சில வாடிக்கையாளர் விவரங்களை பதிவேற்றுவதில் பிழை ஏற்பட்டது.`
        : `Import batch encountered errors (${ctx.count || 0} failed). Check error report.`;
      break;

    case 'cust_dnm_changed':
      title = isTa
        ? `[needs proofreading by owner] செய்தி அனுப்ப தடை: ${cName}`
        : `Do Not Message Update: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] ${cName}-க்கு செய்தி அனுப்ப தடை விதிக்கப்பட்டுள்ளது.`
        : `${cName} was marked as Do Not Message / Opted-out.`;
      break;

    case 'plan_morning_brief':
      title = isTa
        ? `[needs proofreading by owner] காலை பணித் திட்டம் — ${ctx.dateStr || 'இன்று'}`
        : `Daily Morning Plan — ${ctx.dateStr || 'Today'}`;
      body = isTa
        ? `[needs proofreading by owner] இன்று உங்களுக்கு ${ctx.count || 0} பணிகள் (${ctx.highCount || 0} முக்கிய பணிகள்) உள்ளன.`
        : `You have ${ctx.count || 0} task(s) today (${ctx.highCount || 0} high priority). Tap to view plan.`;
      break;

    case 'plan_evening_review':
      title = isTa
        ? `[needs proofreading by owner] மாலை பணி ஆய்வு`
        : `Evening Operations Review`;
      body = isTa
        ? `[needs proofreading by owner] இன்றைய பணிகளை மதிப்பாய்வு செய்து நாளைய திட்டத்தை முடிக்கவும்.`
        : `Review today's task outcomes and prepare tomorrow's priorities.`;
      break;

    case 'plan_missing_daily':
      title = isTa
        ? `[needs proofreading by owner] தினசரி திட்டம் நிலுவை`
        : `Daily Plan Pending`;
      body = isTa
        ? `[needs proofreading by owner] உங்கள் இன்றைய காலை பணித் திட்டத்தை உறுதிப்படுத்தவும்.`
        : `Your morning plan has not been confirmed yet. Tap to review tasks.`;
      break;

    case 'plan_missing_weekly':
      title = isTa
        ? `[needs proofreading by owner] வாராந்திர திட்டம் நிலுவை`
        : `Weekly Targets Pending`;
      body = isTa
        ? `[needs proofreading by owner] இந்த வாரத்திற்கான இலக்குகளை நிர்ணயிக்கவும்.`
        : `Weekly targets for sales and orders have not been set for this week.`;
      break;

    case 'plan_ads_stale':
      title = isTa
        ? `[needs proofreading by owner] விளம்பர திட்டம் புதுப்பிக்கப்படவில்லை`
        : `Meta Ads Plan Needs Review`;
      body = isTa
        ? `[needs proofreading by owner] விளம்பர திட்டம் 7 நாட்களாக புதுப்பிக்கப்படவில்லை.`
        : `Meta ads planning hub has not been updated in over 7 days.`;
      break;

    case 'ad_publish_due':
      title = isTa
        ? `[needs proofreading by owner] விளம்பரம் வெளியிட வேண்டிய நேரம்: ${ctx.adName || 'Ad'}`
        : `Ad Publish Date Reached: ${ctx.adName || 'Ad'}`;
      body = isTa
        ? `[needs proofreading by owner] திட்டமிட்டபடி "${ctx.adName}" விளம்பரத்தை பேஸ்புக் மேனேஜரில் வெளியிடவும்.`
        : `"${ctx.adName}" is scheduled to go live today. Verify in Meta Ads Manager.`;
      break;

    case 'ad_ending_soon':
      title = isTa
        ? `[needs proofreading by owner] விளம்பரம் முடிவடைகிறது: ${ctx.adName || 'Ad'}`
        : `Ad Ending in 24 Hours: ${ctx.adName || 'Ad'}`;
      body = isTa
        ? `[needs proofreading by owner] "${ctx.adName}" விளம்பரம் நாளை முடிவடைகிறது.`
        : `"${ctx.adName}" will complete its run in 24 hours.`;
      break;

    case 'ad_results_missing':
      title = isTa
        ? `[needs proofreading by owner] விளம்பர முடிவுகள் தேவை: ${ctx.adName || 'Ad'}`
        : `Enter Ad Results: ${ctx.adName || 'Ad'}`;
      body = isTa
        ? `[needs proofreading by owner] விளம்பரம் முடிவடைந்தது. செலவு மற்றும் முடிவுகளை உள்ளிடவும்.`
        : `"${ctx.adName}" has completed. Please enter conversations and spend results.`;
      break;

    case 'ad_stage_changed':
      title = isTa
        ? `[needs proofreading by owner] விளம்பர நிலை மாற்றம்: ${ctx.adName || 'Ad'}`
        : `Ad Stage Updated: ${ctx.adName || 'Ad'}`;
      body = isTa
        ? `[needs proofreading by owner] விளம்பரம் "${ctx.reason || 'Updated'}" நிலைக்கு மாற்றப்பட்டது.`
        : `"${ctx.adName}" was updated to ${ctx.reason || 'new stage'}.`;
      break;

    case 'ad_festival_unplanned':
      title = isTa
        ? `[needs proofreading by owner] பண்டிகைக்கான விளம்பரம் இல்லை: ${ctx.festivalName || 'Festival'}`
        : `Unplanned Festival: ${ctx.festivalName || 'Festival'}`;
      body = isTa
        ? `[needs proofreading by owner] ${ctx.festivalName} 14 நாட்களில் வரவுள்ளது. சலுகை அல்லது விளம்பரம் திட்டமிடப்படவில்லை.`
        : `${ctx.festivalName} is in 14 days. No promotional offer or ad campaign is planned yet.`;
      break;

    case 'wa_queue_pending':
      title = isTa
        ? `[needs proofreading by owner] வாட்ஸ்அப் வரிசை நிலுவை`
        : `WhatsApp Outbound Queue Pending`;
      body = isTa
        ? `[needs proofreading by owner] வாடிக்கையாளர்களுக்கு அனுப்ப வேண்டிய செய்திகள் வரிசையில் உள்ளன.`
        : `Scheduled WhatsApp outbound queue items are ready for manual review and sending.`;
      break;

    case 'wa_queue_completed':
      title = isTa
        ? `[needs proofreading by owner] வாட்ஸ்அப் வரிசை முடிந்தது`
        : `WhatsApp Queue Finished`;
      body = isTa
        ? `[needs proofreading by owner] திட்டமிடப்பட்ட அனைத்து செய்திகளும் அனுப்பப்பட்டன.`
        : `All queued WhatsApp outreach messages have been processed.`;
      break;

    case 'wa_outside_hours_logged':
      title = isTa
        ? `[needs proofreading by owner] நேர மீறல் செய்தி பதிவு`
        : `WhatsApp Notice`;
      body = isTa
        ? `[needs proofreading by owner] பரிந்துரைக்கப்பட்ட நேரத்திற்கு வெளியே வாடிக்கையாளருக்கு செய்தி அனுப்பப்பட்டது.`
        : `Queue item marked sent outside recommended hours for ${cName}.`;
      break;

    case 'wa_freq_override_logged':
      title = isTa
        ? `[needs proofreading by owner] அதிர்வெண் மீறல் பதிவு`
        : `WhatsApp Notice`;
      body = isTa
        ? `[needs proofreading by owner] அனுமதிக்கப்பட்ட இடைவெளிக்கு முன் வாடிக்கையாளருக்கு செய்தி அனுப்பப்பட்டது.`
        : `Frequency override used to contact ${cName} earlier than standard interval.`;
      break;

    case 'order_new_recorded':
      title = isTa
        ? `[needs proofreading by owner] புதிய ஆர்டர்: ₹${ctx.amount || 0}`
        : `New Order Booked: ₹${ctx.amount || 0}`;
      body = isTa
        ? `[needs proofreading by owner] ${cName}-க்கு ₹${ctx.amount || 0} மதிப்புள்ள புதிய ஆர்டர் பதிவு செய்யப்பட்டது.`
        : `Order for ${cName} (₹${ctx.amount || 0}) was confirmed by ${assigner}.`;
      break;

    case 'order_first_promo':
      title = isTa
        ? `[needs proofreading by owner] புதிய வாடிக்கையாளர் மாற்றம்: ${cName}`
        : `Promoted to Old Customer: ${cName}`;
      body = isTa
        ? `[needs proofreading by owner] முதல் ஆர்டர் உறுதி செய்யப்பட்டதால் ${cName} பழைய வாடிக்கையாளராக மாற்றப்பட்டது.`
        : `${cName} confirmed their first order and was automatically moved to "Old customer".`;
      break;

    case 'auto_run_summary':
      title = isTa
        ? `[needs proofreading by owner] தானியங்கி பணிகள் அறிக்கை`
        : `Daily Automations Summary`;
      body = isTa
        ? `[needs proofreading by owner] இன்றைய தானியங்கி விதிகள் ${ctx.count || 0} புதிய பணிகளை உருவாக்கியுள்ளன.`
        : `Daily automation run completed: ${ctx.count || 0} tasks created, ${ctx.highCount || 0} skipped.`;
      break;

    case 'auto_cap_deferred':
      title = isTa
        ? `[needs proofreading by owner] பணி வரம்பு எட்டப்பட்டது: ${ctx.ruleName || 'Rule'}`
        : `Daily Automation Cap Reached: ${ctx.ruleName || 'Rule'}`;
      body = isTa
        ? `[needs proofreading by owner] இன்றைய வரம்பு எட்டப்பட்டதால் ${ctx.count || 0} பணிகள் நாளைக்கு ஒத்திவைக்கப்பட்டன.`
        : `Daily cap reached for ${ctx.ruleName}. ${ctx.count || 0} items deferred to tomorrow.`;
      break;

    case 'auto_rule_failed':
      title = isTa
        ? `[needs proofreading by owner] தானியங்கி விதி பிழை: ${ctx.ruleName || 'Rule'}`
        : `Automation Error: ${ctx.ruleName || 'Rule'}`;
      body = isTa
        ? `[needs proofreading by owner] ${ctx.ruleName} செயல்படவில்லை: ${ctx.reason || 'Error'}`
        : `${ctx.ruleName} execution failed: ${ctx.reason || 'Check logs'}.`;
      break;

    case 'auto_cron_missed':
      title = isTa
        ? `[needs proofreading by owner] தானியங்கி இயக்க தாமதம்`
        : `Scheduler Heartbeat Delayed`;
      body = isTa
        ? `[needs proofreading by owner] காலை 8:00 மணி தானியங்கி இயக்கம் 2 மணி நேரத்திற்கும் மேலாக தாமதமாகியுள்ளது.`
        : `Automation heartbeat has not reported in 2+ hours. Please check health dashboard.`;
      break;

    case 'sys_all_devices_offline':
      title = isTa
        ? `[needs proofreading by owner] அறிவிப்புகள் முடக்கப்பட்டுள்ளன`
        : `Push Notifications Disabled`;
      body = isTa
        ? `[needs proofreading by owner] உங்கள் சாதனத்தில் புஷ் அறிவிப்புகள் இயக்கப்படவில்லை. அமைப்புகளில் சரிபார்க்கவும்.`
        : `No active devices registered for push alerts. Enable notifications in Settings.`;
      break;

    case 'sys_backup_reminder':
      title = isTa
        ? `[needs proofreading by owner] வாராந்திர தரவு காப்பு நினைவூட்டல்`
        : `Weekly Data Backup Reminder`;
      body = isTa
        ? `[needs proofreading by owner] தரவுத்தளத்தின் நகலை சேமித்து வைக்க பரிந்துரைக்கப்படுகிறது.`
        : `Sunday backup: Export customer and order spreadsheets to maintain local records.`;
      break;

    case 'sys_member_changed':
      title = isTa
        ? `[needs proofreading by owner] குழு உறுப்பினர் மாற்றம்`
        : `Team Member Updated`;
      body = isTa
        ? `[needs proofreading by owner] குழு உறுப்பினர்களின் விவரங்கள் மாற்றப்பட்டுள்ளன.`
        : `Team allowlist or roles were updated for ${ctx.assigneeName || 'member'}.`;
      break;

    case 'sys_quota_warning':
      title = isTa
        ? `[needs proofreading by owner] பயன்பாட்டு வரம்பு எச்சரிக்கை`
        : `Database Quota Warning`;
      body = isTa
        ? `[needs proofreading by owner] தரவுத்தள பயன்பாடு இலவச வரம்பை நெருங்குகிறது.`
        : `Daily database read/write volume is approaching free quota thresholds.`;
      break;

    default:
      title = isTa ? `[needs proofreading by owner] அறிவிப்பு` : `Jaikrishna Alert`;
      body = isTa ? `[needs proofreading by owner] புதிய தகவல்` : `New update available.`;
  }

  return {
    title: truncate(title, 60),
    body: truncate(body, 140),
  };
}
