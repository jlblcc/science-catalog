import { NgModule } from '@angular/core';

import { BASE_URI  } from '../../../../src/uris';
import { ConfigService, SCIENCE_CATALOG_CONFIGURATION } from './config.service';

export function scConfigurationFactory() {
    return window['science_catalog_configuration']||{
        catalogRoot: BASE_URI
    };
}

@NgModule({
    providers:[
        {provide: SCIENCE_CATALOG_CONFIGURATION,useFactory:scConfigurationFactory},
        ConfigService
    ]
})
export class ScienceCatalogCommonModule {}

export { ConfigService } from './config.service';
export * from './monitors-destroy';
