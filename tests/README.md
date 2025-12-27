# Clio MCP Testing Guide

This directory contains the local testing environment for the Clio MCP server, including mock data and automated test suites.

## Overview

The testing environment allows you to test the MCP tools without requiring a live Clio API connection. It uses mock data stored in JSON files and simulates API responses with realistic delays.

## Mock Data

Mock data files are located in `tests/mocks/`:

- **matters.json**: 5 open matters with custom fields (e.g., "Date of Accident", "Opposing Counsel")
- **contacts.json**: 10 contacts, including "Jane Smith" who appears as an opposing party
- **activities.json**: Time entries with both professional and vague descriptions
- **file_notes.json**: Recent file notes for matters
- **calendar_entries.json**: Upcoming calendar entries/tasks

## Running Tests

### Install Dependencies

First, install Vitest if not already installed:

```bash
npm install
```

### Run All Tests

```bash
npm run test:mcp
```

This command:
- Sets `USE_MOCK_DATA=true` environment variable
- Runs all tests in the `tests/` directory
- Uses mock data instead of real API calls

### Run Tests in Watch Mode

```bash
npm run test:watch
```

Automatically re-runs tests when files change.

### Run Tests with Coverage

```bash
npm run test:coverage
```

Generates a coverage report showing which code is tested.

## Test Suites

### 1. Matter Intelligence Brief (`matter-intelligence-brief.test.ts`)

Tests the `get_matter_intelligence_brief` tool:

- ✅ Verifies matter details are included
- ✅ Verifies file notes are aggregated (last 5)
- ✅ Verifies calendar entries are included
- ✅ Verifies custom fields are extracted
- ✅ Verifies related contacts are listed
- ✅ Handles missing data gracefully

**Test Matter ID**: `12345`

### 2. Ethical Conflict Check (`ethical-conflict-check.test.ts`)

Tests the `perform_ethical_conflict_check` tool:

- ✅ Flags direct matches in contacts
- ✅ Flags matches in related contacts (opposing parties)
- ✅ Flags matches in custom fields (e.g., "Opposing Counsel")
- ✅ Returns properly structured JSON report
- ✅ Handles no-match scenarios

**Test Search Queries**:
- `"John Doe"` - Direct contact match
- `"Jane Smith"` - Related party match (opposing party in matter 12345)
- `"Smith & Associates"` - Custom field match (Opposing Counsel)

### 3. Audit Unbilled Activities (`audit-unbilled-activities.test.ts`)

Tests the `audit_unbilled_activities` tool:

- ✅ Flags vague descriptions (< 15 chars or vague patterns)
- ✅ Calculates total billable amount correctly
- ✅ Provides reasons for flagged descriptions
- ✅ Separates vague and clear descriptions
- ✅ Handles matters with no activities

**Test Matter ID**: `12345` (has both vague and professional descriptions)

## Mock Client Behavior

The mock client (`MockClioClient`) simulates:

- **Network delay**: 200ms per request (configurable)
- **API structure**: Same response format as real Clio API
- **Query filtering**: Supports search queries and filters
- **Error handling**: Returns 404 for non-existent resources

## Environment Variables

- `USE_MOCK_DATA=true`: Enables mock mode (automatically set by test scripts)
- `MOCK_DATA_DIR`: Optional path to mock data directory (defaults to `tests/mocks/`)
- `MOCK_DELAY_MS`: Optional delay in milliseconds (defaults to 200ms)

## Example Test Output

```
✓ tests/matter-intelligence-brief.test.ts (2)
  ✓ get_matter_intelligence_brief
    ✓ should combine matter details, file notes, and calendar entries correctly
    ✓ should handle matter with no file notes gracefully

✓ tests/ethical-conflict-check.test.ts (4)
  ✓ perform_ethical_conflict_check
    ✓ should flag direct matches in contacts
    ✓ should flag matches in related contacts and custom fields
    ✓ should flag matches in custom fields (Opposing Counsel)
    ✓ should return empty arrays when no matches found

✓ tests/audit-unbilled-activities.test.ts (5)
  ✓ audit_unbilled_activities
    ✓ should flag vague descriptions correctly
    ✓ should calculate total billable amount correctly
    ✓ should provide reasons for vague descriptions
    ✓ should separate vague and clear descriptions
    ✓ should handle matter with no activities gracefully

Test Files  3 passed (3)
     Tests  11 passed (11)
```

## Adding New Mock Data

To add new test cases:

1. Edit the appropriate JSON file in `tests/mocks/`
2. Follow the existing structure
3. Update tests to use new data
4. Run tests to verify

## Troubleshooting

### Tests fail with "Cannot find module"

Make sure you've run `npm install` to install Vitest and dependencies.

### Mock data not loading

Check that:
- Files exist in `tests/mocks/`
- JSON files are valid
- File paths are correct

### Type errors

Ensure TypeScript can resolve the `@/` alias (configured in `vitest.config.ts`).

## Integration with CI/CD

The test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run MCP Tests
  run: npm run test:mcp
  env:
    USE_MOCK_DATA: true
```

