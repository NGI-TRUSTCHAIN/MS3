import * as path from 'path';
import { DBRepository } from './dbPersistance';
import { LocalRepository } from './localPersistance';

export class VersionRepository {
  private repo: LocalRepository | DBRepository;

  constructor(useDB = false) {
    const filePath = path.join(__dirname, '..', 'versions', 'versionMatrix.json');
    this.repo = useDB ? new DBRepository({}) : new LocalRepository(filePath);
  }

  isCompatible(moduleName: string, adapterVersion: string): boolean {
    const data = this.repo.get({ moduleName, adapterVersion });
    return !!data;
  }
}