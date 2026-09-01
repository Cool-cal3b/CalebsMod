import { Controller, Get, Param } from '@nestjs/common';
import { DocumentationService } from './documentation.service';

@Controller('api/documentation')
export class DocumentationController {
  constructor(private readonly documentationService: DocumentationService) {}

  @Get()
  listDocuments() {
    return this.documentationService.listDocuments();
  }

  @Get(':id')
  getDocument(@Param('id') id: string) {
    return this.documentationService.getDocument(id);
  }
}
