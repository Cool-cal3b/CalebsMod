import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { DocumentationController } from './documentation.controller';
import { DocumentationService } from './documentation.service';

describe('DocumentationController', () => {
  let app: INestApplication;
  let directory: string;

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'calebsmod-docs-api-'));
    fs.writeFileSync(path.join(directory, 'guide.md'), '# Guide\nHello');

    const module = await Test.createTestingModule({
      controllers: [DocumentationController],
      providers: [
        {
          provide: DocumentationService,
          useValue: new DocumentationService(directory),
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('serves the public document list and document content', async () => {
    await request(app.getHttpServer())
      .get('/api/documentation')
      .expect(200)
      .expect([{ id: 'guide', title: 'Guide' }]);

    await request(app.getHttpServer())
      .get('/api/documentation/guide')
      .expect(200)
      .expect({ id: 'guide', title: 'Guide', markdown: '# Guide\nHello' });
  });

  it('returns 404 for an unknown document', () =>
    request(app.getHttpServer())
      .get('/api/documentation/missing')
      .expect(404));
});
