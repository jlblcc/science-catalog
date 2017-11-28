import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { CommonComponentsModule } from '../../common_components';

import { LccRouteComponent } from './lcc-route.component';


@NgModule({
    imports:[
        CommonModule,
        RouterModule,
        CommonComponentsModule
    ],
    declarations:[
        LccRouteComponent
    ],
    exports: [
        LccRouteComponent
    ]
})
export class LccRouteComponentModule {}

export { LccRouteComponent } from './lcc-route.component';
