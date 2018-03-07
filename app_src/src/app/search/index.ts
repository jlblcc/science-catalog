import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MaterialModule } from '../material';

import { LccSelect } from './lcc-select.component';
import { ItemList } from './item-list.component';
import { HighlightText, HighlightPipe } from './highlight-text.component';
import { LccTitlePipe } from './lcc-title.pipe';

import { ItemSearch } from './item-search.component';

@NgModule({
    imports: [
        CommonModule,
        MaterialModule
    ],
    declarations:[
        LccSelect,
        ItemList,
        HighlightText, HighlightPipe,
        ItemSearch,
        LccTitlePipe
    ],
    exports:[
        ItemSearch
    ],
    providers: [
        LccTitlePipe
    ]
})
export class SearchModule {}
