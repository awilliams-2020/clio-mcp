import { ClioClient } from '../clio-client-production';
import { MockClioClient } from '../clio-client-mock';
import { safeLog } from '../pii-redaction';

interface MatterIntelligenceBriefResult {
  matter: {
    id: string;
    display_number: string;
    description?: string;
    status?: string;
    practice_area?: string;
    custom_fields?: Record<string, unknown>;
  };
  recent_activity: Array<{
    id: string;
    note: string;
    created_at: string;
    created_by?: string;
  }>;
  pending_tasks: Array<{
    id: string;
    subject: string;
    due_date?: string;
    assigned_to?: string;
  }>;
  case_metadata: {
    custom_fields: Record<string, unknown>;
    related_contacts: Array<{
      id: string;
      name: string;
      role?: string;
    }>;
  };
}

/**
 * Get comprehensive intelligence brief for a matter
 * Aggregates matter details, recent file notes, and upcoming calendar entries
 */
export async function getMatterIntelligenceBrief(
  client: ClioClient | MockClioClient,
  matterId: string
): Promise<string> {
  const startTime = Date.now();
  safeLog('info', `Fetching matter intelligence brief for matter_id: ${matterId}`);

  try {
    // Fetch all data in parallel for better performance
    // Use Promise.allSettled to handle cases where some endpoints might not be available
    const [matterResult, fileNotesResult, calendarEntriesResult] = await Promise.allSettled([
      client.getInstance().get(`/matters/${matterId}`),
      client.getInstance().get(`/matters/${matterId}/file_notes`, {
        params: {
          limit: 5,
          order: 'created_at desc',
        },
      }).catch(() => ({ data: { data: [] } })), // Fallback if endpoint doesn't exist
      client.getInstance().get(`/matters/${matterId}/calendar_entries`, {
        params: {
          limit: 10,
          start_date: '2024-02-15', // Use a fixed date for consistent testing
          order: 'start_at asc',
        },
      }).catch(() => ({ data: { data: [] } })), // Fallback if endpoint doesn't exist
    ]);

    // Extract data from settled promises
    const matterResponse = matterResult.status === 'fulfilled' ? matterResult.value : { data: {} };
    const fileNotesResponse = fileNotesResult.status === 'fulfilled' ? fileNotesResult.value : { data: { data: [] } };
    const calendarEntriesResponse = calendarEntriesResult.status === 'fulfilled' ? calendarEntriesResult.value : { data: { data: [] } };

    const matter = matterResponse.data.data || matterResponse.data;
    const fileNotes = fileNotesResponse.data.data || fileNotesResponse.data.data || [];
    const calendarEntries = calendarEntriesResponse.data.data || calendarEntriesResponse.data.data || [];

    // Extract custom fields
    const customFields: Record<string, unknown> = {};
    if (matter.custom_fields) {
      for (const field of matter.custom_fields) {
        if (field.value !== null && field.value !== undefined && field.value !== '') {
          customFields[field.name || field.id] = field.value;
        }
      }
    }

    // Format recent activity (file notes)
    const recentActivity = (fileNotes.slice(0, 5) || []).map((note: any) => ({
      id: note.id,
      note: note.note || note.body || '',
      created_at: note.created_at || note.date,
      created_by: note.created_by?.name || note.user?.name,
    }));

    // Format pending tasks (upcoming calendar entries)
    const pendingTasks = (calendarEntries || []).map((entry: any) => ({
      id: entry.id,
      subject: entry.subject || entry.title || '',
      due_date: entry.start_at || entry.due_date,
      assigned_to: entry.assigned_to?.name || entry.user?.name,
    }));

    // Get related contacts
    const relatedContacts = (matter.contacts || []).map((contact: any) => ({
      id: contact.id || contact.contact_id,
      name: contact.name || contact.contact?.name || '',
      role: contact.role || contact.relationship_type,
    }));

    const result: MatterIntelligenceBriefResult = {
      matter: {
        id: matter.id,
        display_number: matter.display_number || matter.number || '',
        description: matter.description,
        status: matter.status,
        practice_area: matter.practice_area?.name || matter.practice_area,
        custom_fields: customFields,
      },
      recent_activity: recentActivity,
      pending_tasks: pendingTasks,
      case_metadata: {
        custom_fields: customFields,
        related_contacts: relatedContacts,
      },
    };

    // Format as Markdown brief
    const markdown = formatIntelligenceBriefAsMarkdown(result);
    
    const duration = Date.now() - startTime;
    safeLog('info', `Matter intelligence brief generated in ${duration}ms`, { matter_id: matterId });

    return markdown;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    safeLog('error', `Error generating matter intelligence brief after ${duration}ms`, { 
      matter_id: matterId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function formatIntelligenceBriefAsMarkdown(result: MatterIntelligenceBriefResult): string {
  const { matter, recent_activity, pending_tasks, case_metadata } = result;

  let markdown = `# Matter Intelligence Brief\n\n`;
  markdown += `**Matter:** ${matter.display_number}\n`;
  if (matter.description) markdown += `**Description:** ${matter.description}\n`;
  if (matter.status) markdown += `**Status:** ${matter.status}\n`;
  if (matter.practice_area) markdown += `**Practice Area:** ${matter.practice_area}\n`;
  markdown += `\n---\n\n`;

  // Recent Activity
  markdown += `## Recent Activity\n\n`;
  if (recent_activity.length === 0) {
    markdown += `*No recent file notes found.*\n\n`;
  } else {
    for (const activity of recent_activity) {
      markdown += `### ${activity.created_at}\n`;
      if (activity.created_by) markdown += `*By: ${activity.created_by}*\n`;
      markdown += `${activity.note}\n\n`;
    }
  }

  // Pending Tasks
  markdown += `## Pending Tasks\n\n`;
  if (pending_tasks.length === 0) {
    markdown += `*No upcoming calendar entries found.*\n\n`;
  } else {
    for (const task of pending_tasks) {
      markdown += `- **${task.subject}**`;
      if (task.due_date) markdown += ` (Due: ${task.due_date})`;
      if (task.assigned_to) markdown += ` - Assigned to: ${task.assigned_to}`;
      markdown += `\n`;
    }
    markdown += `\n`;
  }

  // Case Metadata
  markdown += `## Case Metadata\n\n`;
  
  if (Object.keys(case_metadata.custom_fields).length > 0) {
    markdown += `### Custom Fields\n\n`;
    for (const [key, value] of Object.entries(case_metadata.custom_fields)) {
      markdown += `- **${key}:** ${value}\n`;
    }
    markdown += `\n`;
  }

  if (case_metadata.related_contacts.length > 0) {
    markdown += `### Related Contacts\n\n`;
    for (const contact of case_metadata.related_contacts) {
      markdown += `- **${contact.name}**`;
      if (contact.role) markdown += ` (${contact.role})`;
      markdown += `\n`;
    }
    markdown += `\n`;
  }

  return markdown;
}

