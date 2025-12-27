import { z } from 'zod';

/**
 * Zod schemas for tool input validation
 * Ensures type safety and validates inputs before making API calls
 */

export const MatterIntelligenceBriefSchema = z.object({
  matter_id: z.string().min(1, 'matter_id is required'),
});

export const EthicalConflictCheckSchema = z.object({
  search_query: z.string().min(1, 'search_query is required'),
});

export const AuditUnbilledActivitiesSchema = z.object({
  matter_id: z.string().min(1, 'matter_id is required'),
});

// Legacy tool schemas (for backward compatibility)
export const ListMattersSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const GetMatterDetailsSchema = z.object({
  matter_id: z.string().min(1, 'matter_id is required'),
});

export const SearchContactsSchema = z.object({
  name: z.string().min(1, 'name is required'),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

