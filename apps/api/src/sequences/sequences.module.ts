import { Global, Module } from '@nestjs/common';
import { SequencesService } from './sequences.service';

@Global()
@Module({ providers: [SequencesService], exports: [SequencesService] })
export class SequencesModule {}
