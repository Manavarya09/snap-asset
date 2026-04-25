const { setFlag, isEnabled } = require('../src/featureFlag');

test('feature flag enables and disables correctly', () => {
  setFlag('new-ui', false);
  expect(isEnabled('new-ui')).toBe(false);
  setFlag('new-ui', true);
  expect(isEnabled('new-ui')).toBe(true);
});
