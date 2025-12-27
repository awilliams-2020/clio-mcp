import { describe, it, expect, beforeAll } from 'vitest';
import { MockClioClient } from '../src/lib/clio-client-mock';
import { getMatterIntelligenceBrief } from '../src/lib/tools/matter-intelligence-brief';

describe('get_matter_intelligence_brief', () => {
  let mockClient: MockClioClient;

  beforeAll(() => {
    mockClient = new MockClioClient();
  });

  it('should combine matter details, file notes, and calendar entries correctly', async () => {
    const matterId = '12345';
    const result = await getMatterIntelligenceBrief(mockClient, matterId);

    // Verify it's a string (Markdown format)
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);

    // Verify it contains matter information
    expect(result).toContain('2024-001'); // Matter display number
    expect(result).toContain('Personal Injury'); // Practice area
    expect(result).toContain('Motor Vehicle Accident'); // Description

    // Verify it contains Recent Activity section
    expect(result).toContain('Recent Activity');
    expect(result).toContain('Client called to discuss settlement offer'); // From file notes

    // Verify it contains Pending Tasks section
    expect(result).toContain('Pending Tasks');
    expect(result).toContain('Court Hearing'); // From calendar entries

    // Verify it contains Case Metadata
    expect(result).toContain('Case Metadata');
    expect(result).toContain('Date of Accident'); // Custom field
    expect(result).toContain('2024-01-15'); // Custom field value
    expect(result).toContain('Related Contacts');
    expect(result).toContain('John Doe'); // Related contact
  });

  it('should handle matter with no file notes gracefully', async () => {
    // This test verifies the tool handles missing data gracefully
    // In a real scenario, you might create a matter without file notes
    const matterId = '12346';
    const result = await getMatterIntelligenceBrief(mockClient, matterId);

    expect(typeof result).toBe('string');
    expect(result).toContain('2024-002');
    // Should still generate a valid brief even with limited data
  });
});

