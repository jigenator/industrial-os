// A JSON Schema (draft 2020-12) validator for the keywords the lesson schema uses. Compiling rejects any other
// keyword, so the schema cannot quietly ask for a check this validator does not make.
const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$defs']);
const KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'pattern',
  'enum',
  'const',
  'oneOf',
  '$ref',
]);
const TYPES = {
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: Array.isArray,
  string: (v) => typeof v === 'string',
  integer: Number.isInteger,
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  boolean: (v) => typeof v === 'boolean',
  null: (v) => v === null,
};
const TYPE_ERROR = /^must be an? (object|array|string|integer|number|boolean|null)$/;
// JSON Pointer of a path inside the document, e.g. /sections/0/slides/2/title.
export const pointer = (path) => '/' + path.map((p) => String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');

export function compileSchema(root) {
  const patterns = new Map();
  (function check(node, at) {
    if (typeof node !== 'object' || node === null) throw Error(`Schema ${at} is not an object`);
    for (const [key, value] of Object.entries(node)) {
      if (!ANNOTATIONS.has(key) && !KEYWORDS.has(key)) throw Error(`Schema ${at} uses unsupported keyword ${key}`);
      if (key === '$defs' || key === 'properties')
        for (const [k, v] of Object.entries(value)) check(v, `${at}/${key}/${k}`);
      if (key === 'items' || (key === 'additionalProperties' && typeof value === 'object'))
        check(value, `${at}/${key}`);
      if (key === 'oneOf') value.forEach((v, i) => check(v, `${at}/oneOf/${i}`));
      if (key === 'pattern') patterns.set(value, new RegExp(value, 'u'));
      if (key === 'type' && !TYPES[value]) throw Error(`Schema ${at} has unknown type ${value}`);
      if (key === '$ref' && !resolve(value)) throw Error(`Schema ${at} has unresolved $ref ${value}`);
    }
  })(root, '#');
  function resolve(ref) {
    if (!ref.startsWith('#/')) return null;
    return ref
      .slice(2)
      .split('/')
      .reduce((node, part) => node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], root);
  }
  function validate(node, value, path, errors) {
    const fail = (message) => errors.push({ path: pointer(path), message });
    if (node.$ref) validate(resolve(node.$ref), value, path, errors);
    if (node.type && !TYPES[node.type](value))
      return fail(`must be ${node.type === 'object' ? 'an' : 'a'} ${node.type}`);
    if ('const' in node && value !== node.const) fail(`must be ${JSON.stringify(node.const)}`);
    if (node.enum && !node.enum.includes(value))
      fail(`must be one of ${node.enum.map((v) => JSON.stringify(v)).join(', ')}`);
    if (typeof value === 'string') {
      const length = [...value].length;
      if (node.maxLength !== undefined && length > node.maxLength) fail(`must be at most ${node.maxLength} characters`);
      if (node.minLength !== undefined && length < node.minLength)
        fail(`must be at least ${node.minLength} characters`);
      if (node.pattern && !patterns.get(node.pattern).test(value)) fail(`must match ${node.pattern}`);
    }
    if (Array.isArray(value)) {
      if (node.minItems !== undefined && value.length < node.minItems)
        fail(`must have at least ${node.minItems} items`);
      if (node.maxItems !== undefined && value.length > node.maxItems) fail(`must have at most ${node.maxItems} items`);
      if (node.items) value.forEach((v, i) => validate(node.items, v, [...path, i], errors));
    }
    if (TYPES.object(value)) {
      for (const key of node.required || []) if (!Object.hasOwn(value, key)) fail(`is missing required "${key}"`);
      for (const [key, v] of Object.entries(value)) {
        if (node.properties && Object.hasOwn(node.properties, key))
          validate(node.properties[key], v, [...path, key], errors);
        else if (node.additionalProperties === false)
          errors.push({ path: pointer([...path, key]), message: 'is not allowed' });
        else if (typeof node.additionalProperties === 'object')
          validate(node.additionalProperties, v, [...path, key], errors);
      }
    }
    if (node.oneOf) {
      const results = node.oneOf.map((branch) => {
        const found = [];
        validate(branch, value, path, found);
        return found;
      });
      const passing = results.filter((r) => !r.length).length;
      if (passing > 1) fail('matches more than one allowed form');
      // When nothing matches, report the closest form's errors rather than every branch's; a form of the wrong type
      // is the furthest.
      else if (!passing) {
        const here = pointer(path),
          distance = (r) => r.length + (r.some((e) => e.path === here && TYPE_ERROR.test(e.message)) ? 1000 : 0);
        errors.push(...results.reduce((a, b) => (distance(b) < distance(a) ? b : a)));
      }
    }
  }
  return (value) => {
    const errors = [];
    validate(root, value, [], errors);
    return errors;
  };
}
