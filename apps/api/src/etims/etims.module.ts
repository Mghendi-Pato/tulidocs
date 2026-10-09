import { Global, Module } from '@nestjs/common';
import { EtimsService } from './etims.service';

@Global()
@Module({ providers: [EtimsService], exports: [EtimsService] })
export class EtimsModule {}
