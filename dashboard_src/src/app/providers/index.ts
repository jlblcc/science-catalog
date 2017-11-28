import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { CatalogService } from './catalog.service';

@NgModule({
    imports: [
        HttpClientModule
    ],
    declarations:[
    ],
    providers: [
        HttpClientModule,
        CatalogService
    ]
})
export class ProvidersModule {

}

export * from './catalog.service';
