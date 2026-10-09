import { Global, Module } from '@nestjs/common';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

@Global()
@Module({
  controllers: [GuestController],
  providers: [GuestService],
  exports: [GuestService],
})
export class GuestModule {}
