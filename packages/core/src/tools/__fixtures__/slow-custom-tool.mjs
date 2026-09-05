// Test fixture: a tool whose execute() never resolves within any reasonable
// test timeout, used to verify loadCustomTool's own timeout actually fires.
export function defineCustomTool() {
  return {
    name: "slow",
    description: "Never resolves",
    schema: { type: "object", properties: {} },
    execute() {
      return new Promise(() => {}); // deliberately never settles
    },
  };
}
