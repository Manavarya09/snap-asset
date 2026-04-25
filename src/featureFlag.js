// Simple feature flag helper
const flags = new Map();

function setFlag(name, value) {
  flags.set(name, !!value);
}

function isEnabled(name) {
  return !!flags.get(name);
}

module.exports = { setFlag, isEnabled };
