import { ClioClient } from '../clio-client-production';
import { MockClioClient } from '../clio-client-mock';
import { safeLog } from '../pii-redaction';

interface UnbilledActivity {
  id: string;
  description: string;
  date: string;
  time_spent?: number;
  rate?: number;
  billable_amount?: number;
  vague_description_flag: boolean;
  vague_reason?: string;
}

interface AuditResult {
  matter_id: string;
  total_unbilled_activities: number;
  total_billable_amount: number;
  vague_descriptions_count: number;
  activities: UnbilledActivity[];
}

/**
 * Audit unbilled activities for a matter
 * Flags vague descriptions that might be rejected by insurance
 */
export async function auditUnbilledActivities(
  client: ClioClient | MockClioClient,
  matterId: string
): Promise<string> {
  const startTime = Date.now();
  safeLog('info', `Auditing unbilled activities for matter_id: ${matterId}`);

  try {
    // Fetch unbilled activities
    // Try activities endpoint, fallback to time_entries if needed
    let activitiesResponse;
    try {
      activitiesResponse = await client.getInstance().get(`/matters/${matterId}/activities`, {
        params: {
          billable: true,
          billed: false,
          limit: 500, // Get all unbilled activities
        },
      });
    } catch (error) {
      // Fallback to time_entries endpoint if activities doesn't exist
      safeLog('warn', 'Activities endpoint not available, trying time_entries', { matter_id: matterId });
      try {
        activitiesResponse = await client.getInstance().get(`/matters/${matterId}/time_entries`, {
          params: {
            billable: true,
            limit: 500,
          },
        });
      } catch (fallbackError) {
        safeLog('error', 'Both activities and time_entries endpoints failed', { matter_id: matterId });
        throw new Error('Unable to fetch activities. Endpoint may not be available for this matter.');
      }
    }

    const activities = activitiesResponse.data.data || activitiesResponse.data.data || [];

    const auditResult: AuditResult = {
      matter_id: matterId,
      total_unbilled_activities: activities.length,
      total_billable_amount: 0,
      vague_descriptions_count: 0,
      activities: [],
    };

    // Process each activity
    for (const activity of activities) {
      const description = activity.description || activity.note || activity.subject || '';
      const isVague = isVagueDescription(description);
      
      if (isVague) {
        auditResult.vague_descriptions_count++;
      }

      const billableAmount = activity.billable_amount || 
                            (activity.time_spent && activity.rate ? activity.time_spent * activity.rate : 0) ||
                            0;
      
      auditResult.total_billable_amount += billableAmount;

      auditResult.activities.push({
        id: activity.id,
        description: description,
        date: activity.date || activity.created_at || '',
        time_spent: activity.time_spent,
        rate: activity.rate,
        billable_amount: billableAmount,
        vague_description_flag: isVague,
        vague_reason: isVague ? getVagueReason(description) : undefined,
      });
    }

    // Sort by date (most recent first)
    auditResult.activities.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    // Format as structured report
    const report = formatAuditReport(auditResult);
    
    const duration = Date.now() - startTime;
    safeLog('info', `Unbilled activities audit completed in ${duration}ms`, {
      matter_id: matterId,
      total_activities: auditResult.total_unbilled_activities,
      vague_count: auditResult.vague_descriptions_count,
      total_amount: auditResult.total_billable_amount,
    });

    return report;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    safeLog('error', `Error auditing unbilled activities after ${duration}ms`, {
      matter_id: matterId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Check if a description is vague (likely to be rejected by insurance)
 */
function isVagueDescription(description: string): boolean {
  if (!description || description.trim().length === 0) {
    return true;
  }

  // Check length (under 15 characters is likely too vague)
  if (description.trim().length < 15) {
    return true;
  }

  // Check for common vague patterns
  const vaguePatterns = [
    /^(meeting|call|email|phone|review|work|task|draft|research|prep|preparation|follow.?up|followup)\s*$/i,
    /^(mtg|mtng|tel|telcon|eml|em|rev|wk|tsk|drft|rsch|prep|f\/u|f\/up)\s*$/i,
    /^(see|see above|same|as above|as noted|per|per above)\s*$/i,
    /^(misc|miscellaneous|other|various|general|miscellaneous work|general work|other tasks)\s*$/i,
    /^[a-z]\s*$/i, // Single letter
    /^\d+\s*$/, // Just numbers
    /^[^\w\s]+\s*$/, // Just punctuation
  ];

  for (const pattern of vaguePatterns) {
    if (pattern.test(description.trim())) {
      return true;
    }
  }

  return false;
}

/**
 * Get reason why description is vague
 */
function getVagueReason(description: string): string {
  if (!description || description.trim().length === 0) {
    return 'Empty description';
  }

  if (description.trim().length < 15) {
    return `Too short (${description.trim().length} characters). Insurance typically requires at least 15 characters.`;
  }

  return 'Matches vague description pattern (e.g., "meeting", "call", "review" without context)';
}

/**
 * Format audit report as structured text
 */
function formatAuditReport(result: AuditResult): string {
  let report = `# Unbilled Activities Audit\n\n`;
  report += `**Matter ID:** ${result.matter_id}\n`;
  report += `**Total Unbilled Activities:** ${result.total_unbilled_activities}\n`;
  report += `**Total Billable Amount:** $${result.total_billable_amount.toFixed(2)}\n`;
  report += `**Vague Descriptions:** ${result.vague_descriptions_count} (${result.vague_descriptions_count > 0 ? '⚠️ Review Required' : '✓ All Clear'})\n\n`;
  report += `---\n\n`;

  if (result.activities.length === 0) {
    report += `*No unbilled activities found.*\n`;
    return report;
  }

  // Group by vague flag
  const vagueActivities = result.activities.filter(a => a.vague_description_flag);
  const clearActivities = result.activities.filter(a => !a.vague_description_flag);

  if (vagueActivities.length > 0) {
    report += `## ⚠️ Vague Descriptions (${vagueActivities.length})\n\n`;
    report += `*These descriptions may be rejected by insurance. Please review and update.*\n\n`;
    
    for (const activity of vagueActivities) {
      report += `### Activity ${activity.id}\n`;
      report += `- **Date:** ${activity.date}\n`;
      report += `- **Description:** "${activity.description}"\n`;
      report += `- **Issue:** ${activity.vague_reason}\n`;
      if (activity.time_spent) report += `- **Time:** ${activity.time_spent} hours\n`;
      if (activity.billable_amount) report += `- **Amount:** $${activity.billable_amount.toFixed(2)}\n`;
      report += `\n`;
    }
    report += `\n`;
  }

  if (clearActivities.length > 0) {
    report += `## ✓ Clear Descriptions (${clearActivities.length})\n\n`;
    
    for (const activity of clearActivities.slice(0, 20)) { // Limit to first 20 for readability
      report += `- **${activity.date}** - ${activity.description}`;
      if (activity.billable_amount) report += ` - $${activity.billable_amount.toFixed(2)}`;
      report += `\n`;
    }
    
    if (clearActivities.length > 20) {
      report += `\n*... and ${clearActivities.length - 20} more clear activities*\n`;
    }
    report += `\n`;
  }

  return report;
}

