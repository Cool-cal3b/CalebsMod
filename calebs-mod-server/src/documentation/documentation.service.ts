import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export const DOCUMENTATION_DIRECTORY = Symbol('DOCUMENTATION_DIRECTORY');

export interface DocumentationSummary {
  id: string;
  title: string;
}

export interface DocumentationDocument extends DocumentationSummary {
  markdown: string;
}

@Injectable()
export class DocumentationService {
  constructor(
    @Inject(DOCUMENTATION_DIRECTORY)
    private readonly documentationDirectory: string,
  ) {}

  listDocuments(): DocumentationSummary[] {
    return fs
      .readdirSync(this.documentationDirectory, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() && path.extname(entry.name).toLowerCase() === '.md',
      )
      .map((entry) => this.readSummary(entry.name))
      .sort((a, b) =>
        a.title.localeCompare(b.title, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      );
  }

  getDocument(id: string): DocumentationDocument {
    const summary = this.listDocuments().find((document) => document.id === id);
    if (!summary) {
      throw new NotFoundException('Documentation not found');
    }

    const markdown = fs.readFileSync(
      path.join(this.documentationDirectory, `${summary.id}.md`),
      'utf8',
    );

    return { ...summary, markdown };
  }

  private readSummary(fileName: string): DocumentationSummary {
    const id = path.basename(fileName, path.extname(fileName));
    const markdown = fs.readFileSync(
      path.join(this.documentationDirectory, fileName),
      'utf8',
    );
    const heading = markdown.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();

    return {
      id,
      title: heading || this.titleFromId(id),
    };
  }

  private titleFromId(id: string): string {
    return id
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}
