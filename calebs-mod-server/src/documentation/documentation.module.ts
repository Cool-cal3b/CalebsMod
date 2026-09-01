import { Module } from '@nestjs/common';
import * as path from 'path';
import { DocumentationController } from './documentation.controller';
import {
  DOCUMENTATION_DIRECTORY,
  DocumentationService,
} from './documentation.service';

@Module({
  controllers: [DocumentationController],
  providers: [
    {
      provide: DOCUMENTATION_DIRECTORY,
      useFactory: () => path.join(process.cwd(), 'documentation'),
    },
    DocumentationService,
  ],
})
export class DocumentationModule {}
