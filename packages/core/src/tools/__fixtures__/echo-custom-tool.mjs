// Test fixture for loadCustomTool — a real module on disk, loaded via
// dynamic import exactly the way a user's own custom tool would be.
export function defineCustomTool() {
  return {
    name: "echo",
    description: "Echoes the given text back, uppercased",
    schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    async execute(input) {
      return { echoed: String(input.text).toUpperCase() };
    },
  };
}
