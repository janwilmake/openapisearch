/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable sonarjs/no-nested-assignment */
/* eslint-disable no-restricted-syntax */
/**
 * klona/json - MIT License
 *
 * https://github.com/lukeed/klona/blob/master/license
 * @param {any} val
 * @returns {any}
 */
export function klona(val) {
  let index, out, tmp;

  if (Array.isArray(val)) {
    out = Array((index = val.length));
    while (index--)
      out[index] =
        (tmp = val[index]) && typeof tmp === "object" ? klona(tmp) : tmp;
    return out;
  }

  if (Object.prototype.toString.call(val) === "[object Object]") {
    out = {}; // null
    for (index in val) {
      if (index === "__proto__") {
        Object.defineProperty(out, index, {
          value: klona(val[index]),
          configurable: true,
          enumerable: true,
          writable: true,
        });
      } else {
        out[index] =
          (tmp = val[index]) && typeof tmp === "object" ? klona(tmp) : tmp;
      }
    }
    return out;
  }

  return val;
}
/**
 * @typedef {import('./types').JSONSchema} JSONSchema
 * @typedef {import('./types').DereferencedJSONSchema} DereferencedJSONSchema
 */

/**
 * Resolves a $ref pointer in a schema and returns the referenced value.
 * Handles both JSON pointer refs (#/path/to/item) and URL refs.
 * @param {JSONSchema} schema
 * @param {string} ref
 * @returns {unknown}
 */
export const resolveRefSync = (schema, ref) => {
  if (!cache.has(schema)) {
    cache.set(schema, new Map());
  }
  const schemaCache = cache.get(schema);

  if (schemaCache.has(ref)) {
    return schemaCache.get(ref);
  }

  let result = null;

  try {
    // Handle URL refs (http://, https://, file://, etc.)
    if (ref.includes("://") || ref.startsWith("//")) {
      // For now, we can't resolve external URLs synchronously
      // Keep as-is or return null
      result = null;
    } else if (ref.startsWith("#/")) {
      // Handle JSON pointer refs
      const path = ref
        .slice(2)
        .split("/")
        .map((segment) =>
          // Decode JSON pointer escaping
          segment.replace(/~1/g, "/").replace(/~0/g, "~")
        );

      let current = schema;
      for (const segment of path) {
        if (!current || typeof current !== "object") {
          current = null;
          break;
        }
        current = current[segment] ?? null;
      }
      result = current;
    } else if (ref.startsWith("#")) {
      // Handle fragment-only refs (just #)
      result = ref === "#" ? schema : null;
    } else {
      // Handle relative refs or other formats
      // For now, return null for unsupported formats
      result = null;
    }
  } catch (error) {
    // If any error occurs during resolution, return null
    result = null;
  }

  schemaCache.set(ref, result);
  return result;
};

/**
 * @typedef {import('./types').JSONSchema} JSONSchema
 * @typedef {import('./types').DereferencedJSONSchema} DereferencedJSONSchema
 */

const PROHIBITED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const cache = new Map();

/**
 * Removes prohibited keys from an object (shallow).
 * @param {object} obj
 * @returns {object}
 */
function filterProhibitedKeys(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !PROHIBITED_KEYS.has(key))
  );
}

/**
 * Resolves all $ref pointers in a schema and returns a new schema without any $ref pointers.
 * Handles circular references by keeping them as $ref pointers and deeply nested $refs.
 * @param {JSONSchema} schema - The JSON schema to dereference.
 * @returns {DereferencedJSONSchema} The dereferenced schema.
 */
export const dereferenceSync = (schema) => {
  if (cache.has(schema)) return cache.get(schema);

  // Filter prohibited keys at the root level
  const filtered =
    typeof schema === "object" && schema !== null && !Array.isArray(schema)
      ? filterProhibitedKeys(schema)
      : schema;

  const cloned = klona(filtered);
  const resolving = new Set(); // Track refs currently being resolved to detect cycles
  const resolved = new Map(); // Cache resolved refs to avoid duplicate work

  /**
   * Recursively resolves a value (object, array, or primitive).
   * @param {any} current - The current value to resolve.
   * @param {string} path - The current JSON pointer path.
   * @returns {any} The resolved value.
   */
  const resolve = (current, path) => {
    if (typeof current !== "object" || current === null) return current;

    // Handle arrays
    if (Array.isArray(current)) {
      return current.map((item, i) => resolve(item, `${path}/${i}`));
    }

    // Handle $ref
    if ("$ref" in current && typeof current.$ref === "string") {
      const ref = current.$ref;

      // Check if this ref is currently being resolved (circular reference)
      if (resolving.has(ref)) {
        // Keep circular references as $ref pointers
        return { $ref: ref };
      }

      // Check if we've already resolved this ref
      if (resolved.has(ref)) {
        return resolved.get(ref);
      }

      // Mark this ref as being resolved
      resolving.add(ref);

      try {
        const refTarget = resolveRefSync(cloned, ref);
        if (!refTarget) {
          resolved.set(ref, null);
          return null;
        }

        // Recursively resolve the target
        const resolvedTarget = resolve(refTarget, ref);
        resolved.set(ref, resolvedTarget);
        return resolvedTarget;
      } finally {
        // Always remove from resolving set when done
        resolving.delete(ref);
      }
    }

    // Handle objects
    const obj = {};
    for (const [key, value] of Object.entries(current)) {
      if (!PROHIBITED_KEYS.has(key)) {
        obj[key] = resolve(value, `${path}/${key}`);
      }
    }
    return obj;
  };

  const result = resolve(cloned, "#");
  cache.set(schema, result);
  return result;
};
