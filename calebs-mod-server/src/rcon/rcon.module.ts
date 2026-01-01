import { Module, Global } from '@nestjs/common';
import { RconService } from './rcon.service';

@Global()
@Module({
  providers: [RconService],
  exports: [RconService],
})
export class RconModule {}
