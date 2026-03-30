// Why `fhir-kit-client`?
// Most popular FHIR client for Node.js. Supports R4, search bundles, CRUD.
// Alternative `fhir.js` is less maintained.
// Source: https://github.com/Vermonster/fhir-kit-client

import FhirKitClient from 'fhir-kit-client';

export class FhirClient {
  private client: FhirKitClient;

  constructor(baseUrl: string, accessToken: string) {
    this.client = new FhirKitClient({
      baseUrl,
      customHeaders: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async read(resourceType: string, id: string): Promise<any> {
    return this.client.read({ resourceType, id } as any);
  }

  async search(resourceType: string, searchParams: Record<string, string>): Promise<any> {
    return this.client.search({ resourceType, searchParams } as any);
  }

  async create(resourceType: string, body: any): Promise<any> {
    return this.client.create({ resourceType, body } as any);
  }
}
