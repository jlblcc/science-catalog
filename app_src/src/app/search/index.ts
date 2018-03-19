import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MaterialModule } from '../material';

import { ItemIcon } from './item-icon.component';
import { SctypeSelect } from './sctype-select.component';
import { TextSearch } from './text-search.component';
import { LccSelect } from './lcc-select.component';
import { KeywordSelect } from './keyword-select.component';
import { DistinctAutocomplete } from './distinct-autocomplete.component';
import { DistinctSelect } from './distinct-select.component';
import { FundingSearchControls } from './funding-search-controls.component';
import { SummaryStatistics } from './summary-statistics.component';


import { ItemList } from './item-list.component';
import { ItemTable } from './item-table.component';
import { HighlightText, HighlightPipe } from './highlight-text.component';
import { LccTitlePipe } from './lcc-title.pipe';
import { ResourceTypePipe } from './resource-type.pipe';

import { ItemSearch } from './item-search.component';

import { SearchService } from './search.service';

@NgModule({
    imports: [
        CommonModule,
        MaterialModule
    ],
    declarations:[
        ItemIcon,
        LccSelect, TextSearch, SctypeSelect, KeywordSelect,
        DistinctAutocomplete, DistinctSelect,
        FundingSearchControls,
        SummaryStatistics,

        ItemList, ItemTable,
        HighlightText, HighlightPipe,
        ItemSearch,

        LccTitlePipe, ResourceTypePipe,
    ],
    exports:[
        ItemSearch
    ],
    providers: [
        LccTitlePipe, ResourceTypePipe,
        SearchService
    ]
})
export class SearchModule {}
