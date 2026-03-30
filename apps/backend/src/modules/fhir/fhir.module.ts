import { Module } from '@nestjs/common';
import { FhirService } from './fhir.service';

@Module({
  providers: [FhirService],
  exports: [FhirService],
})
export class FhirModule {}
