import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { safeLog } from './pii-redaction';

/**
 * Mock Clio Client for local testing
 * Reads from JSON files in tests/mocks/ directory
 * Simulates network delay and API structure
 */
export class MockClioClient {
  private mockDataDir: string;
  private delayMs: number;

  constructor(mockDataDir?: string, delayMs: number = 200) {
    this.mockDataDir = mockDataDir || path.join(process.cwd(), 'tests', 'mocks');
    this.delayMs = delayMs;
  }

  /**
   * Simulate network delay
   */
  private async delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.delayMs));
  }

  /**
   * Load JSON file from mock data directory
   */
  private loadMockFile(filename: string): any {
    const filePath = path.join(this.mockDataDir, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      safeLog('error', `[MockClioClient] Error loading ${filename}`, {
        error: error instanceof Error ? error.message : String(error),
        filePath: filePath,
      });
      return { data: [], meta: { paging: { records: 0 } } };
    }
  }

  /**
   * Create axios-like instance that reads from mock files
   */
  getInstance(): AxiosInstance {
    const self = this;

    return {
      get: async (url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> => {
        await self.delay();

        // Parse URL to determine which mock file to load
        const urlPath = url.split('?')[0]; // Remove query params
        
        let responseData: any;

        if (urlPath === '/matters' || urlPath.startsWith('/matters')) {
          // Handle matter-specific endpoints
          const matterIdMatch = urlPath.match(/\/matters\/([^\/]+)(?:\/(.+))?/);
          
          if (matterIdMatch) {
            const matterId = matterIdMatch[1];
            const subResource = matterIdMatch[2];

            if (subResource === 'file_notes') {
              // Return file notes for the matter
              const allFileNotes = self.loadMockFile('file_notes.json');
              const matterFileNotes = allFileNotes.data.filter((note: any) => note.matter_id === matterId);
              responseData = {
                data: matterFileNotes,
                meta: { paging: { records: matterFileNotes.length } }
              };
            } else if (subResource === 'calendar_entries') {
              // Return calendar entries for the matter
              const allEntries = self.loadMockFile('calendar_entries.json');
              const matterEntries = allEntries.data.filter((entry: any) => entry.matter_id === matterId);
              // Filter by start_date if provided (compare dates, not strings)
              if (config?.params?.start_date) {
                const startDate = new Date(config.params.start_date);
                const filtered = matterEntries.filter((entry: any) => {
                  if (!entry.start_at) return false;
                  const entryDate = new Date(entry.start_at);
                  return entryDate >= startDate;
                });
                responseData = {
                  data: filtered,
                  meta: { paging: { records: filtered.length } }
                };
              } else {
                responseData = {
                  data: matterEntries,
                  meta: { paging: { records: matterEntries.length } }
                };
              }
            } else if (subResource === 'activities' || subResource === 'time_entries') {
              // Return activities for the matter
              const allActivities = self.loadMockFile('activities.json');
              const matterActivities = allActivities.data.filter((act: any) => act.matter_id === matterId);
              
              // Apply filters
              let filtered = matterActivities;
              if (config?.params?.billable === true) {
                filtered = filtered.filter((act: any) => act.billable === true);
              }
              if (config?.params?.billed === false) {
                filtered = filtered.filter((act: any) => act.billed === false);
              }
              
              responseData = {
                data: filtered,
                meta: { paging: { records: filtered.length } }
              };
            } else {
              // Return specific matter
              const allMatters = self.loadMockFile('matters.json');
              const matter = allMatters.data.find((m: any) => m.id === matterId);
              
              if (matter) {
                responseData = { data: matter };
              } else {
                throw {
                  response: {
                    status: 404,
                    statusText: 'Not Found',
                    data: { error: 'Matter not found' }
                  }
                };
              }
            }
          } else {
            // List all matters (with optional search query)
            const matters = self.loadMockFile('matters.json');
            
            // Apply search query if provided
            if (config?.params?.q) {
              const query = (config.params.q as string).toLowerCase();
              const filtered = matters.data.filter((matter: any) => 
                matter.display_number?.toLowerCase().includes(query) ||
                matter.number?.toLowerCase().includes(query) ||
                matter.description?.toLowerCase().includes(query) ||
                matter.practice_area?.name?.toLowerCase().includes(query)
              );
              responseData = {
                data: filtered,
                meta: { paging: { records: filtered.length } }
              };
            } else {
              responseData = matters;
            }
          }
        } else if (urlPath === '/contacts') {
          // Search contacts
          const contacts = self.loadMockFile('contacts.json');
          
          // Apply search query if provided
          if (config?.params?.q) {
            const query = (config.params.q as string).toLowerCase();
            const filtered = contacts.data.filter((contact: any) => 
              contact.name?.toLowerCase().includes(query) ||
              contact.email?.toLowerCase().includes(query) ||
              contact.first_name?.toLowerCase().includes(query) ||
              contact.last_name?.toLowerCase().includes(query)
            );
            responseData = {
              data: filtered,
              meta: { paging: { records: filtered.length } }
            };
          } else {
            responseData = contacts;
          }
        } else {
          throw {
            response: {
              status: 404,
              statusText: 'Not Found',
              data: { error: `Mock endpoint not implemented: ${urlPath}` }
            }
          };
        }

        return {
          data: responseData,
          status: 200,
          statusText: 'OK',
          headers: {
            'x-ratelimit-remaining': '999',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
          },
          config: config || {},
        } as AxiosResponse;
      },
    } as AxiosInstance;
  }
}

