import { ClioClient } from '../clio-client-production';
import { MockClioClient } from '../clio-client-mock';
import { safeLog } from '../pii-redaction';

interface ConflictCheckResult {
  search_query: string;
  direct_matches: Array<{
    type: 'contact' | 'matter';
    id: string;
    name: string;
    details: Record<string, unknown>;
  }>;
  related_party_matches: Array<{
    type: 'contact' | 'matter';
    id: string;
    name: string;
    relationship: string;
    source_matter_id?: string;
    source_matter_number?: string;
  }>;
  closed_matter_history: Array<{
    matter_id: string;
    matter_number: string;
    status: string;
    closed_date?: string;
  }>;
}

/**
 * Perform ethical conflict check by searching contacts and matters
 * Flags matches in related contacts and custom fields
 */
export async function performEthicalConflictCheck(
  client: ClioClient | MockClioClient,
  searchQuery: string
): Promise<string> {
  const startTime = Date.now();
  safeLog('info', `Performing ethical conflict check for: ${searchQuery}`);

  try {
    // Search contacts and matters in parallel
    const [contactsResponse, mattersResponse] = await Promise.all([
      client.getInstance().get('/contacts', {
        params: {
          q: searchQuery,
          limit: 100,
        },
      }),
      client.getInstance().get('/matters', {
        params: {
          q: searchQuery,
          limit: 100,
        },
      }),
    ]);

    const contacts = contactsResponse.data.data || [];
    const matters = mattersResponse.data.data || [];

    const result: ConflictCheckResult = {
      search_query: searchQuery,
      direct_matches: [],
      related_party_matches: [],
      closed_matter_history: [],
    };

    // Process direct contact matches
    for (const contact of contacts) {
      result.direct_matches.push({
        type: 'contact',
        id: contact.id,
        name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        details: {
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
        },
      });
    }

    // Process direct matter matches
    for (const matter of matters) {
      result.direct_matches.push({
        type: 'matter',
        id: matter.id,
        name: matter.display_number || matter.number || matter.description || '',
        details: {
          description: matter.description,
          status: matter.status,
          practice_area: matter.practice_area?.name || matter.practice_area,
        },
      });

      // Check if matter is closed
      if (matter.status === 'Closed' || matter.closed_date) {
        result.closed_matter_history.push({
          matter_id: matter.id,
          matter_number: matter.display_number || matter.number || '',
          status: matter.status,
          closed_date: matter.closed_date || matter.updated_at,
        });
      }
    }

    // Search for related party matches in matters
    // We need to check ALL matters (not just search results) for custom fields and related contacts
    // First, get all matters to check for custom field matches
    let allMattersForCheck = matters;
    if (matters.length < 100) {
      // If initial search returned fewer than 100, fetch all matters to check custom fields
      try {
        const allMattersResponse = await client.getInstance().get('/matters', {
          params: { limit: 100 },
        });
        const allMatters = allMattersResponse.data.data || [];
        // Merge with existing matters, avoiding duplicates
        const existingIds = new Set(matters.map((m: any) => m.id));
        allMattersForCheck = [
          ...matters,
          ...allMatters.filter((m: any) => !existingIds.has(m.id)),
        ];
      } catch (error) {
        // If fetching all matters fails, just use the search results
        safeLog('warn', 'Could not fetch all matters for custom field check', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    const relatedPartyPromises = allMattersForCheck.slice(0, 20).map(async (matter: any) => {
      try {
        const matterDetailResponse = await client.getInstance().get(`/matters/${matter.id}`);
        const matterDetail = matterDetailResponse.data.data || matterDetailResponse.data;

        const matches: Array<{
          type: 'contact' | 'matter';
          id: string;
          name: string;
          relationship: string;
          source_matter_id?: string;
          source_matter_number?: string;
        }> = [];

        // Check related contacts
        if (matterDetail.contacts) {
          for (const contactRel of matterDetail.contacts) {
            const contactName = contactRel.name || contactRel.contact?.name || 
                               `${contactRel.contact?.first_name || ''} ${contactRel.contact?.last_name || ''}`.trim();
            
            if (contactName.toLowerCase().includes(searchQuery.toLowerCase())) {
              matches.push({
                type: 'contact',
                id: contactRel.id || contactRel.contact_id,
                name: contactName,
                relationship: contactRel.role || contactRel.relationship_type || 'Related Contact',
                source_matter_id: matter.id,
                source_matter_number: matter.display_number || matter.number,
              });
            }
          }
        }

        // Check custom fields for opposing counsel, related parties, etc.
        if (matterDetail.custom_fields) {
          for (const field of matterDetail.custom_fields) {
            const fieldValue = String(field.value || '').toLowerCase();
            if (fieldValue.includes(searchQuery.toLowerCase())) {
              const fieldName = field.name || field.id || 'Custom Field';
              matches.push({
                type: 'matter',
                id: matter.id,
                name: matter.display_number || matter.number || '',
                relationship: `${fieldName}: ${field.value}`,
                source_matter_id: matter.id,
                source_matter_number: matter.display_number || matter.number,
              });
            }
          }
        }

        return matches;
      } catch (error) {
        safeLog('warn', `Error fetching matter details for conflict check`, { 
          matter_id: matter.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    });

    const relatedPartyResults = await Promise.all(relatedPartyPromises);
    result.related_party_matches = relatedPartyResults.flat();

    // Format as JSON report
    const report = formatConflictCheckReport(result);
    
    const duration = Date.now() - startTime;
    safeLog('info', `Ethical conflict check completed in ${duration}ms`, {
      search_query: searchQuery,
      direct_matches: result.direct_matches.length,
      related_matches: result.related_party_matches.length,
      closed_matters: result.closed_matter_history.length,
    });

    return report;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    safeLog('error', `Error performing ethical conflict check after ${duration}ms`, {
      search_query: searchQuery,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function formatConflictCheckReport(result: ConflictCheckResult): string {
  return JSON.stringify(result, null, 2);
}

