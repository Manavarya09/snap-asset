import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { renderComponent } from '../src/component-renderer.js';

test('renderComponent throws for non-existent path', async () => {
  await assert.rejects(
    () => renderComponent('/nonexistent/path/to/Component.tsx'),
    /Component not found/,
  );
});

test('renderComponent throws for empty path', async () => {
  await assert.rejects(
    () => renderComponent(''),
    /Component not found/,
  );
});

test('renderComponent throws for directory instead of file', async () => {
  await assert.rejects(
    () => renderComponent('src'),
    /Component not found/,
  );
});
