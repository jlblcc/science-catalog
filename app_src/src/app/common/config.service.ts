import { InjectionToken, Injectable, Inject } from '@angular/core';

import { API_PREFIX } from '../../../../src/uris';

export interface ScienceCatalogConfiguration {
    catalogRoot?: string;
}

export const SCIENCE_CATALOG_CONFIGURATION = new InjectionToken<ScienceCatalogConfiguration>('ScienceCatalogConfiguration');

@Injectable()
export class ConfigService {
    constructor(@Inject(SCIENCE_CATALOG_CONFIGURATION) private config:ScienceCatalogConfiguration) {}

    qualifyApiUrl(path:string):string {
        if(this.config.catalogRoot) {
            return `${this.config.catalogRoot}${API_PREFIX}${path}`;
        }
        return path;
    }
}
