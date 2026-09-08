import { Module } from '@nestjs/common';
import * as path from 'path';
import { InstallController } from './install.controller';
import { INSTALL_SCRIPT_PATH, InstallService } from './install.service';

@Module({
  controllers: [InstallController],
  providers: [
    {
      // Anchored on __dirname rather than process.cwd() so it does not depend
      // on where the process was launched from. From dist/install that is:
      // dist/install -> dist -> calebs-mod-server -> repo root.
      //
      // Reaching into a sibling package is deliberate. The bootstrapper is the
      // script's home - it is the darwin twin of the Go code beside it, and the
      // build-mac.sh workflow ships the same file - so a copy kept here would
      // be one more thing to remember to sync, and the copy that went stale
      // would be the one every new friend runs.
      provide: INSTALL_SCRIPT_PATH,
      useFactory: () =>
        path.join(
          __dirname,
          '..',
          '..',
          '..',
          'calebs-mod-bootstrapper',
          'install-mac.sh',
        ),
    },
    InstallService,
  ],
})
export class InstallModule {}
