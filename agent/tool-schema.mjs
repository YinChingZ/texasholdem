// Discovery projection for harnesses with a restricted JSON Schema vocabulary.
// Execution still validates the original shared HTTP schema with Ajv.
export function toolSchema(source) {
  const result = {};
  for (const key of ['type', 'description', 'title', 'required', 'additionalProperties', 'enum', 'const'])
    if (key in source) result[key] = source[key];
  if (!result.type && source.enum) result.type = typeof source.enum[0];
  if (!result.type && 'const' in source) result.type = typeof source.const;
  if (source.properties) result.properties = Object.fromEntries(Object.entries(source.properties).map(([key, value]) => [key, toolSchema(value)]));
  if (source.items) result.items = toolSchema(source.items);
  if (Array.isArray(result.type)) {
    const types = result.type; delete result.type;
    return { oneOf: types.map(type => (type === "null" ? { type } : { ...result, type })) };
  }
  return result;
}
