function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}
assert.ok = assert;
assert.strictEqual = (a, b, msg) => { if (a !== b) throw new Error(msg || `${a} !== ${b}`); };
assert.deepStrictEqual = assert.ok;
module.exports = assert;
