import { describe, it, expect, beforeAll } from 'vitest';
import { MockClioClient } from '../src/lib/clio-client-mock';
import { performEthicalConflictCheck } from '../src/lib/tools/ethical-conflict-check';

describe('perform_ethical_conflict_check', () => {
  let mockClient: MockClioClient;

  beforeAll(() => {
    mockClient = new MockClioClient();
  });

  it('should flag direct matches in contacts', async () => {
    const searchQuery = 'John Doe';
    const result = await performEthicalConflictCheck(mockClient, searchQuery);

    // Parse JSON result
    const report = JSON.parse(result);

    // Verify structure
    expect(report).toHaveProperty('search_query', searchQuery);
    expect(report).toHaveProperty('direct_matches');
    expect(report).toHaveProperty('related_party_matches');
    expect(report).toHaveProperty('closed_matter_history');

    // Verify direct contact match
    const contactMatch = report.direct_matches.find(
      (match: any) => match.type === 'contact' && match.name.includes('John Doe')
    );
    expect(contactMatch).toBeDefined();
    expect(contactMatch.details).toHaveProperty('email');
  });

  it('should flag matches in related contacts and custom fields', async () => {
    // Search for "Jane Smith" who is an opposing party in matter 12345
    const searchQuery = 'Jane Smith';
    const result = await performEthicalConflictCheck(mockClient, searchQuery);

    const report = JSON.parse(result);

    // Should find direct match
    const directMatch = report.direct_matches.find(
      (match: any) => match.name.includes('Jane Smith')
    );
    expect(directMatch).toBeDefined();

    // Should also find related party match in matters
    const relatedMatch = report.related_party_matches.find(
      (match: any) => match.name.includes('Jane Smith')
    );
    expect(relatedMatch).toBeDefined();
    expect(relatedMatch.source_matter_id).toBe('12345');
    expect(relatedMatch.relationship).toContain('Opposing Party');
  });

  it('should flag matches in custom fields (Opposing Counsel)', async () => {
    // Search for "Smith & Associates" which appears in custom fields
    const searchQuery = 'Smith & Associates';
    const result = await performEthicalConflictCheck(mockClient, searchQuery);

    const report = JSON.parse(result);

    // Should find direct match (company contact)
    const directMatch = report.direct_matches.find(
      (match: any) => match.name.includes('Smith')
    );
    expect(directMatch).toBeDefined();

    // Should find match in custom fields
    const customFieldMatch = report.related_party_matches.find(
      (match: any) => match.relationship && match.relationship.includes('Opposing Counsel')
    );
    expect(customFieldMatch).toBeDefined();
  });

  it('should return empty arrays when no matches found', async () => {
    const searchQuery = 'NonExistentPerson12345';
    const result = await performEthicalConflictCheck(mockClient, searchQuery);

    const report = JSON.parse(result);

    expect(report.direct_matches).toEqual([]);
    expect(report.related_party_matches).toEqual([]);
  });
});

