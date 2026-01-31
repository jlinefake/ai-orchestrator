# Test Runner Guide

## Quick Start

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npx vitest src/main/orchestration/cli-verification-extension.spec.ts
```

### Run Tests in Watch Mode
```bash
npx vitest --watch
```

### Run Tests with Coverage
```bash
npx vitest --coverage
```

## Test Configuration

The project uses Vitest for unit testing. Configuration is in `vitest.config.ts`.

### Key Settings

- **Environment**: Node.js
- **Test Files**: `src/**/*.spec.ts` and `src/**/*.test.ts`
- **Coverage Provider**: v8
- **Reporters**: text, json, html

## CLI Verification Extension Tests

### Location
`src/main/orchestration/cli-verification-extension.spec.ts`

### What It Tests

1. **cancelVerification()**
   - Cancelling active verification sessions
   - Handling non-existent session IDs
   - Early cancellation (before agents start)
   - Provider termination
   - Event emission
   - Session cleanup
   - Error handling
   - Timeout handling

2. **cancelAllVerifications()**
   - Batch cancellation
   - Count aggregation
   - Error collection
   - Parallel execution

### Run Only These Tests

```bash
npx vitest src/main/orchestration/cli-verification-extension.spec.ts
```

### Run Specific Test Suite

```bash
npx vitest src/main/orchestration/cli-verification-extension.spec.ts -t "cancelVerification"
```

### Run Specific Test Case

```bash
npx vitest src/main/orchestration/cli-verification-extension.spec.ts -t "should cancel an active verification session"
```

## Debugging Tests

### Run with UI

```bash
npx vitest --ui
```

This opens a browser-based UI for interactive test exploration.

### Run with Debug Output

```bash
DEBUG=* npx vitest src/main/orchestration/cli-verification-extension.spec.ts
```

### Run Single Test

```bash
npx vitest src/main/orchestration/cli-verification-extension.spec.ts --run --reporter=verbose
```

## Understanding Test Output

### Successful Test
```
✓ src/main/orchestration/cli-verification-extension.spec.ts (25)
  ✓ CliVerificationCoordinator - Cancellation (25)
    ✓ cancelVerification (10)
      ✓ should cancel an active verification session
      ✓ should return error for non-existent session ID
      ...
```

### Failed Test
```
✗ should cancel an active verification session
  AssertionError: expected false to be true
```

### Coverage Report
```
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
cli-verification... |   95.12 |    88.88 |     100 |   95.12 |
--------------------|---------|----------|---------|---------|
```

## Common Issues

### Tests Not Found

If tests aren't discovered, ensure:
1. File ends with `.spec.ts` or `.test.ts`
2. File is in `src/` directory
3. Vitest config includes the correct pattern

### Import Errors

If you see module import errors:
1. Check `vitest.config.ts` has correct path aliases
2. Verify TypeScript is configured correctly
3. Ensure all dependencies are installed (`npm install`)

### Timeout Errors

Some tests have custom timeouts (e.g., 20 seconds for timeout testing):
```typescript
it('should timeout...', async () => {
  // test code
}, 20000); // 20 second timeout
```

If tests timeout unexpectedly, increase the timeout or check for hanging promises.

## Code Coverage

### Generate Coverage Report

```bash
npx vitest --coverage
```

### View HTML Report

After running with coverage, open:
```
./coverage/index.html
```

### Coverage Thresholds

Current project doesn't enforce thresholds, but you can add them to `vitest.config.ts`:

```typescript
coverage: {
  lines: 80,
  functions: 80,
  branches: 80,
  statements: 80,
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npx vitest --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Testing Best Practices](https://vitest.dev/guide/testing-best-practices.html)

## Test Writing Tips

### Use Descriptive Names

```typescript
// Good
it('should cancel an active verification session', async () => {

// Bad
it('test1', async () => {
```

### Follow AAA Pattern

```typescript
it('should do something', async () => {
  // Arrange - setup
  const data = createTestData();

  // Act - execute
  const result = await functionUnderTest(data);

  // Assert - verify
  expect(result).toBe(expected);
});
```

### Clean Up Resources

```typescript
afterEach(() => {
  // Clean up any active verifications
  coordinator.cancelAllVerifications();
});
```

### Test Edge Cases

- Empty inputs
- Null/undefined values
- Boundary conditions
- Error scenarios
- Concurrent operations

## Performance

### Fast Tests

Tests should run quickly. If a test takes more than 1 second, consider:
- Using mocks instead of real dependencies
- Reducing artificial delays
- Parallelizing independent tests

### Parallel Execution

Vitest runs tests in parallel by default. To run sequentially:

```bash
npx vitest --no-threads
```

## Troubleshooting

### "Cannot find module" Error

1. Install dependencies: `npm install`
2. Check import paths match file structure
3. Verify path aliases in `vitest.config.ts`

### "ReferenceError: describe is not defined"

Ensure `globals: true` is set in `vitest.config.ts`:

```typescript
test: {
  globals: true,
}
```

### TypeScript Errors

1. Check `tsconfig.json` includes test files
2. Verify types are installed: `npm install -D @types/node`
3. Update `vitest.config.ts` to match TypeScript config

### Snapshot Mismatches

Update snapshots (if using):
```bash
npx vitest -u
```

## Next Steps

1. Run the tests: `npm test`
2. Review coverage: `npx vitest --coverage`
3. Fix any failing tests
4. Add more test cases as needed
5. Integrate into CI/CD pipeline
