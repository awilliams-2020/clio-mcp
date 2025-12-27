# Local Testing Environment Setup

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install Vitest and other testing dependencies.

### 2. Run Tests

```bash
npm run test:mcp
```

This command automatically:
- Sets `USE_MOCK_DATA=true`
- Runs all tests using mock data
- Does NOT require a live Clio API connection

### 3. Watch Mode (Development)

```bash
npm run test:watch
```

Automatically re-runs tests when you make changes.

## What Gets Tested

### ✅ Matter Intelligence Brief
- Aggregates matter details, file notes, and calendar entries
- Formats as structured Markdown
- Extracts custom fields and related contacts

### ✅ Ethical Conflict Check
- Searches contacts and matters simultaneously
- Flags matches in related contacts
- Flags matches in custom fields (e.g., "Opposing Counsel")

### ✅ Audit Unbilled Activities
- Identifies vague descriptions (< 15 chars or vague patterns)
- Calculates total billable amounts
- Provides AI-ready structured output

## Mock Data

Mock data is stored in `tests/mocks/`:

- **5 matters** (all "Open" status)
- **10 contacts** (including "Jane Smith" as opposing party)
- **13 activities** (mix of vague and professional descriptions)
- **5 file notes** (recent activity)
- **4 calendar entries** (upcoming tasks)

## Test Coverage

All three aggregator tools are fully tested with:
- ✅ Happy path scenarios
- ✅ Edge cases (missing data, no matches)
- ✅ Data aggregation verification
- ✅ Output format validation

## Environment Variables

The mock mode is controlled by:

```bash
USE_MOCK_DATA=true  # Enable mock mode
```

You can also customize:

```bash
MOCK_DATA_DIR=/path/to/mocks  # Custom mock data location
MOCK_DELAY_MS=200            # Simulated network delay
```

## Example Usage

```bash
# Run all tests
npm run test:mcp

# Run with coverage
npm run test:coverage

# Run specific test file
USE_MOCK_DATA=true npx vitest tests/matter-intelligence-brief.test.ts
```

## Troubleshooting

**Problem**: Tests fail with module not found
**Solution**: Run `npm install` to install Vitest

**Problem**: Mock data not loading
**Solution**: Verify files exist in `tests/mocks/` directory

**Problem**: Type errors
**Solution**: Ensure TypeScript paths are configured (see `vitest.config.ts`)

## Next Steps

1. ✅ Run `npm run test:mcp` to verify everything works
2. ✅ Review test output to understand tool behavior
3. ✅ Modify mock data to test edge cases
4. ✅ Add new test cases as needed

For detailed documentation, see `tests/README.md`.

