import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentationService } from './documentation.service';

describe('DocumentationService', () => {
  let directory: string;
  let service: DocumentationService;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'calebsmod-docs-'));
    service = new DocumentationService(directory);
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('lists Markdown documents by title and ignores other files', () => {
    fs.writeFileSync(path.join(directory, 'z-file.md'), '# Alpha\nBody');
    fs.writeFileSync(path.join(directory, 'a-file.md'), '# Zebra\nBody');
    fs.writeFileSync(path.join(directory, 'notes.txt'), '# Not a document');

    expect(service.listDocuments()).toEqual([
      { id: 'z-file', title: 'Alpha' },
      { id: 'a-file', title: 'Zebra' },
    ]);
  });

  it('uses a cleaned filename when no H1 exists', () => {
    fs.writeFileSync(path.join(directory, 'getting_started.md'), 'Start here.');

    expect(service.listDocuments()).toEqual([
      { id: 'getting_started', title: 'Getting Started' },
    ]);
  });

  it('returns the selected Markdown document', () => {
    fs.writeFileSync(path.join(directory, 'guide.md'), '# Guide\nHello');

    expect(service.getDocument('guide')).toEqual({
      id: 'guide',
      title: 'Guide',
      markdown: '# Guide\nHello',
    });
  });

  it('rejects unknown and traversing identifiers', () => {
    fs.writeFileSync(path.join(directory, 'guide.md'), '# Guide');

    expect(() => service.getDocument('missing')).toThrow(NotFoundException);
    expect(() => service.getDocument('../guide')).toThrow(NotFoundException);
  });
});
