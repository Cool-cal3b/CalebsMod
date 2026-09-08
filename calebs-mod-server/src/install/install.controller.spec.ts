import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { InstallController } from './install.controller';
import { InstallService } from './install.service';

describe('InstallController', () => {
  let app: INestApplication;
  let directory: string;
  let scriptPath: string;

  const buildApp = async () => {
    const module = await Test.createTestingModule({
      controllers: [InstallController],
      providers: [
        {
          provide: InstallService,
          useValue: new InstallService(scriptPath),
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  };

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'calebsmod-install-'));
    scriptPath = path.join(directory, 'install-mac.sh');
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('serves the script as readable plain text', async () => {
    fs.writeFileSync(scriptPath, '#!/bin/bash\necho hi\n');
    await buildApp();

    const response = await request(app.getHttpServer())
      .get('/install.sh')
      .expect(200)
      .expect('Content-Type', /text\/plain/);

    expect(response.text).toBe('#!/bin/bash\necho hi\n');
  });

  // The failure this guards against is silent and total: bash reads the
  // carriage returns as part of each command, so every line of a CRLF script
  // fails with "$'\r': command not found".
  it('normalises CRLF, so a Windows working copy still pipes into bash', async () => {
    fs.writeFileSync(scriptPath, '#!/bin/bash\r\necho hi\r\n');
    await buildApp();

    const response = await request(app.getHttpServer())
      .get('/install.sh')
      .expect(200);

    expect(response.text).not.toContain('\r');
    expect(response.text).toBe('#!/bin/bash\necho hi\n');
  });

  it('404s rather than serving an empty body when the script is missing', async () => {
    await buildApp();

    await request(app.getHttpServer()).get('/install.sh').expect(404);
  });
});
