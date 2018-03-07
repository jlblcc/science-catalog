import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MaterialModule } from '../material';

import { LccSelect } from './lcc-select.component';

@NgModule({
    imports: [
        CommonModule,
        MaterialModule
    ],
    declarations:[
        LccSelect
    ],
    exports:[
        LccSelect
    ]
})
export class ControlsModule {}
