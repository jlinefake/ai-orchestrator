# Quick Test Reference

## Run Tests

```bash
# Run all unit tests (watch mode)
npm run test:unit

# Run tests once
npm run test:unit:run

# Run with coverage
npm run test:coverage

# Run specific file
npx vitest src/main/orchestration/cli-verification-extension.spec.ts
```

## Files

```
src/main/orchestration/
├── cli-verification-extension.ts          # Source code
├── cli-verification-extension.spec.ts     # Unit tests
└── cli-verification-extension.spec.md     # Test documentation

vitest.config.ts                            # Test configuration
TEST_RUNNER_GUIDE.md                        # Detailed guide
UNIT_TEST_SUMMARY.md                        # Complete summary
```

## Test Stats

- **Total Tests**: 25+
- **Test Suites**: 5
- **Coverage Target**: 100% of cancellation methods

## Test Suites

1. **cancelVerification()** - 10 tests
2. **cancelAllVerifications()** - 5 tests
3. **Session State Management** - 2 tests
4. **isVerificationActive()** - 3 tests
5. **Edge Cases** - 2 tests

## What's Tested

### Core Functionality
- Cancel single verification session
- Cancel all verification sessions
- Provider termination
- Session cleanup
- Event emission

### Error Handling
- Non-existent session IDs
- Provider termination failures
- Timeout scenarios (10s limit)
- Empty/edge cases

### State Management
- activeSessions map cleanup
- activeVerifications map cleanup
- Provider map clearing
- Cancelled flag setting

## Key Test Commands

```bash
# Quick check (run once)
npx vitest run

# Watch mode (auto-rerun)
npx vitest

# Coverage report
npx vitest --coverage

# Verbose output
npx vitest --reporter=verbose

# UI mode
npx vitest --ui

# Specific test
npx vitest -t "should cancel an active verification"
```

## Coverage Check

After running `npm run test:coverage`:

1. Open `coverage/index.html` in browser
2. Navigate to `cli-verification-extension.ts`
3. Check cancellation methods are 100% covered

## Common Issues

### "Cannot find module"
```bash
npm install
```

### Type errors
```bash
npm install -D @types/node vitest
```

### Tests timeout
- Check for unresolved promises
- Increase timeout on specific tests:
```typescript
it('test name', async () => {
  // test code
}, 20000); // 20 second timeout
```

## NPM Scripts

```json
{
  "test:unit": "vitest",
  "test:unit:run": "vitest run",
  "test:coverage": "vitest --coverage"
}
```

## Documentation

- **Full Guide**: [TEST_RUNNER_GUIDE.md](./TEST_RUNNER_GUIDE.md)
- **Summary**: [UNIT_TEST_SUMMARY.md](./UNIT_TEST_SUMMARY.md)
- **Test Spec**: [cli-verification-extension.spec.md](./src/main/orchestration/cli-verification-extension.spec.md)

## Next Steps

1. ✅ Tests created
2. ⏳ Run tests: `npm run test:unit:run`
3. ⏳ Check coverage: `npm run test:coverage`
4. ⏳ Review results
5. ⏳ Fix any failures
6. ⏳ Add to CI/CD
