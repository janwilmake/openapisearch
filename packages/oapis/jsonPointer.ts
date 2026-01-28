/**
 * A TypeScript implementation of JSON Pointer (RFC 6901)
 * Allows referencing specific values within a JSON document
 */

export class JSONPointer {
  /**
   * Resolves a JSON pointer against a document
   * @param doc The document to query
   * @param pointer The JSON pointer string (e.g. "/foo/0/bar")
   * @returns The referenced value
   * @throws Error if the pointer is invalid or the reference doesn't exist
   */
  static get(doc: any, pointer: string): any {
    if (pointer === "") return doc;
    if (!pointer.startsWith("/")) {
      throw new Error('Invalid JSON Pointer: must start with "/"');
    }

    // Split the pointer into reference tokens
    const tokens = pointer.slice(1).split("/").map(this.decodeToken);

    // Traverse the document
    let current = doc;
    for (const token of tokens) {
      if (current === undefined || current === null) {
        throw new Error(`Cannot read property '${token}' of ${current}`);
      }

      if (!(token in current)) {
        throw new Error(`Property '${token}' does not exist`);
      }

      current = current[token];
    }

    return current;
  }

  /**
   * Sets a value in a document using a JSON pointer
   * @param doc The document to modify
   * @param pointer The JSON pointer string
   * @param value The value to set
   * @throws Error if the pointer is invalid or parent path doesn't exist
   */
  static set(doc: any, pointer: string, value: any): void {
    if (pointer === "") {
      throw new Error("Cannot set document root");
    }
    if (!pointer.startsWith("/")) {
      throw new Error('Invalid JSON Pointer: must start with "/"');
    }

    const tokens = pointer.slice(1).split("/").map(this.decodeToken);
    const lastToken = tokens.pop();
    if (lastToken === undefined) {
      throw new Error("Invalid pointer: empty reference token");
    }

    // Traverse to the parent
    let current = doc;
    for (const token of tokens) {
      if (current === undefined || current === null) {
        throw new Error(`Cannot read property '${token}' of ${current}`);
      }

      if (!(token in current)) {
        throw new Error(`Property '${token}' does not exist`);
      }

      current = current[token];
    }

    // Set the value
    if (current === undefined || current === null) {
      throw new Error(`Cannot set property '${lastToken}' of ${current}`);
    }

    current[lastToken] = value;
  }

  /**
   * Decodes a reference token according to RFC 6901
   * @param token The encoded reference token
   * @returns The decoded reference token
   */
  private static decodeToken(token: string): string {
    return token.replace(/~1/g, "/").replace(/~0/g, "~");
  }

  /**
   * Encodes a reference token according to RFC 6901
   * @param token The reference token to encode
   * @returns The encoded reference token
   */
  private static encodeToken(token: string): string {
    return token.replace(/~/g, "~0").replace(/\//g, "~1");
  }
}
