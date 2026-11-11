/**
 * The file access the schema layer needs: reading the bundled catalog and schemas,
 * reading the XSD files of user associations, and keeping downloaded schemas.
 *
 * On Node the host reads the disk (`createNodeSchemaHost`). Where there is no disk,
 * such as a browser, the embedding code supplies a host of its own.
 */
export interface SchemaHost {
  /** Folder that holds `catalog.json` and the bundled schemas. */
  readonly schemasRoot: string;
  /** Folder where downloaded schemas are kept. */
  readonly cacheDir: string;
  /** Joins path segments the way this host writes paths. */
  join(...segments: string[]): string;
  /** True when a file exists at the path. */
  exists(filePath: string): boolean;
  /** Returns the text of a file. Throws when the file cannot be read. */
  readFile(filePath: string): string;
  /** Writes a text file, creating missing parent folders. */
  writeFile(filePath: string, text: string): void;
}
