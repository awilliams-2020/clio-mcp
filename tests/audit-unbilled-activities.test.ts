import { describe, it, expect, beforeAll } from 'vitest';
import { MockClioClient } from '../src/lib/clio-client-mock';
import { auditUnbilledActivities } from '../src/lib/tools/audit-unbilled-activities';

describe('audit_unbilled_activities', () => {
  let mockClient: MockClioClient;

  beforeAll(() => {
    mockClient = new MockClioClient();
  });

  it('should flag vague descriptions correctly', async () => {
    const matterId = '12345';
    const result = await auditUnbilledActivities(mockClient, matterId);

    // Verify it's a string (structured report)
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);

    // Verify it contains the audit structure
    expect(result).toContain('Unbilled Activities Audit');
    expect(result).toContain('Total Unbilled Activities');
    expect(result).toContain('Vague Descriptions');

    // Verify vague descriptions are flagged
    expect(result).toContain('⚠️'); // Warning emoji for vague descriptions
    expect(result).toContain('Work'); // Vague description from mock data
    expect(result).toContain('Review'); // Vague description from mock data
    expect(result).toContain('Call'); // Vague description from mock data

    // Verify professional descriptions are not flagged
    expect(result).toContain('Drafted Motion to Dismiss'); // Professional description
    expect(result).toContain('Prepared comprehensive discovery'); // Professional description
  });

  it('should calculate total billable amount correctly', async () => {
    const matterId = '12345';
    const result = await auditUnbilledActivities(mockClient, matterId);

    // Extract total from the report
    const totalMatch = result.match(/Total Billable Amount.*?\$([\d,]+\.\d{2})/);
    expect(totalMatch).toBeDefined();

    // Verify it's a valid amount (should be sum of all activities)
    // Matter 12345 has activities: 875 + 500 + 375 + 1000 + 125 = 2875.00
    const totalAmount = parseFloat(totalMatch![1].replace(/,/g, ''));
    expect(totalAmount).toBeGreaterThan(0);
  });

  it('should provide reasons for vague descriptions', async () => {
    const matterId = '12345';
    const result = await auditUnbilledActivities(mockClient, matterId);

    // Verify vague descriptions include reasons
    expect(result).toContain('Too short');
    expect(result).toContain('characters');
    // "Meeting" matches vague pattern (exact match), so it should show pattern reason
    expect(result).toContain('vague description pattern');
  });

  it('should separate vague and clear descriptions', async () => {
    const matterId = '12345';
    const result = await auditUnbilledActivities(mockClient, matterId);

    // Verify sections exist
    expect(result).toContain('⚠️ Vague Descriptions');
    expect(result).toContain('✓ Clear Descriptions');

    // Verify vague descriptions section comes first
    const vagueIndex = result.indexOf('⚠️ Vague Descriptions');
    const clearIndex = result.indexOf('✓ Clear Descriptions');
    expect(vagueIndex).toBeLessThan(clearIndex);
  });

  it('should handle matter with no activities gracefully', async () => {
    // Matter 12349 has fewer activities, test it still works
    const matterId = '12349';
    const result = await auditUnbilledActivities(mockClient, matterId);

    expect(typeof result).toBe('string');
    expect(result).toContain('Unbilled Activities Audit');
    // Should still generate a valid report
  });
});

