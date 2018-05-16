import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MaterialModule } from '../material';
import { ClipboardModule } from 'ngx-clipboard';
import { AgmCoreModule } from '@agm/core';

import { ScienceCatalogCommonModule } from '../common';

import { ItemIcon } from './item-icon.component';
import { SctypeSelect } from './sctype-select.component';
import { TextSearch } from './text-search.component';
import { LccSelect } from './lcc-select.component';
import { KeywordSelect } from './keyword-select.component';
import { DistinctAutocomplete } from './distinct-autocomplete.component';
import { DistinctSelect } from './distinct-select.component';
import { GeneralAdvancedControls } from './general-advanced-controls.component';
import { FundingSearchControls } from './funding-search-controls.component';
import { SummaryStatistics, FundsByYear } from './summary-statistics.component';
import { Share } from './share.component';
import { Reset } from './reset.component';
import { ItemLink } from './item-link.component';
import { PrincipalInvestigators } from './principal-investigators.component';
import { ItemDate } from './item-date.component';

import { ItemTeaser } from './item-teaser.component';
import { ItemList } from './item-list.component';
import { ItemTable } from './item-table.component';
import { ItemMap } from './item-map.component';

import { HighlightText, HighlightPipe } from './highlight-text.component';
import { LccTitlePipe } from './lcc-title.pipe';
import { ResourceTypePipe } from './resource-type.pipe';
import { CollaboratorPipe } from './collaborator.pipe';

import { ItemSearch } from './item-search.component';
import { SyncStatus } from './sync-status.component';

import { SearchService } from './search.service';

@NgModule({
    imports: [
        CommonModule,
        MaterialModule,
        ClipboardModule,
        AgmCoreModule,
        ScienceCatalogCommonModule
    ],
    declarations:[
        ItemIcon, ItemLink, PrincipalInvestigators, ItemDate, Share, Reset,
        LccSelect, TextSearch, SctypeSelect, KeywordSelect,
        DistinctAutocomplete, DistinctSelect,
        FundingSearchControls,
        SummaryStatistics, FundsByYear,
        GeneralAdvancedControls,
        SyncStatus,

        ItemTeaser,
        ItemList, ItemTable, ItemMap,
        HighlightText, HighlightPipe,
        ItemSearch,

        LccTitlePipe, ResourceTypePipe, CollaboratorPipe,
    ],
    exports:[
        ItemSearch
    ],
    providers: [
        LccTitlePipe, ResourceTypePipe, CollaboratorPipe,
        SearchService
    ]
})
export class SearchModule {}
