import * as fs from 'fs';

export class LocalRepository {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  get(query: any): any {
    const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8') || '{}');
    return data[query.moduleName]?.[query.adapterVersion];
  }

  set(data: any): void {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}