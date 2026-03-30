// FHIR R4 client service with Redis caching.
//
// Why Redis caching on FHIR reads?
// - FHIR server round-trips add 100-300ms per call
// - Patient data doesn't change during a single assessment session (~60s)
// - 5-minute TTL balances freshness and performance
// - Cache key pattern: fhir:{patientId}:{resourceType} or fhir:{patientId}:Obs:{loincCode}
//
// Note: Redis is optional — falls back gracefully if unavailable (dev without Docker).

import { Injectable, Logger } from '@nestjs/common';
import FhirKitClient from 'fhir-kit-client';
import Redis from 'ioredis';

const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class FhirService {
  private readonly logger = new Logger(FhirService.name);
  private redis: Redis | null = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
        this.redis.connect().catch(() => {
          this.logger.warn('Redis unavailable — FHIR caching disabled');
          this.redis = null;
        });
      } catch {
        this.logger.warn('Redis unavailable — FHIR caching disabled');
      }
    }
  }

  private getClient(baseUrl: string, accessToken: string): FhirKitClient {
    return new FhirKitClient({
      baseUrl,
      customHeaders: { Authorization: `Bearer ${accessToken}` },
    });
  }

  private async cacheGet(key: string): Promise<any | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  private async cacheSet(key: string, value: any): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL);
    } catch { /* cache failures are non-fatal */ }
  }

  async getPatient(patientId: string, baseUrl: string, token: string) {
    const cacheKey = `fhir:${patientId}:Patient`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    const client = this.getClient(baseUrl, token);
    const patient = await client.read({ resourceType: 'Patient', id: patientId } as any);
    await this.cacheSet(cacheKey, patient);
    return patient;
  }

  async getConditions(patientId: string, baseUrl: string, token: string) {
    const client = this.getClient(baseUrl, token);
    return client.search({
      resourceType: 'Condition',
      searchParams: { patient: patientId, 'clinical-status': 'active', _count: '100' },
    } as any);
  }

  async getObservation(patientId: string, loincCode: string, baseUrl: string, token: string) {
    const cacheKey = `fhir:${patientId}:Obs:${loincCode}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return cached;

    const client = this.getClient(baseUrl, token);
    const result = await client.search({
      resourceType: 'Observation',
      searchParams: { patient: patientId, code: loincCode, _sort: '-date', _count: '1' },
    } as any);
    await this.cacheSet(cacheKey, result);
    return result;
  }

  async getMedications(patientId: string, baseUrl: string, token: string) {
    const client = this.getClient(baseUrl, token);
    return client.search({
      resourceType: 'MedicationRequest',
      searchParams: { patient: patientId, status: 'active', _count: '100' },
    } as any);
  }

  async createResource(resourceType: string, body: any, baseUrl: string, token: string) {
    const client = this.getClient(baseUrl, token);
    return client.create({ resourceType, body } as any);
  }
}
