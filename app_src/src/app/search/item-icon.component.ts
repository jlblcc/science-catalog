import { Component, Input } from '@angular/core';

import { ItemIfc } from '../../../../src/db/models';



@Component({
    selector: 'item-icon',
    template: `
    <mat-icon *ngFor="let rt of item.simplified.resourceType"
        [fontIcon]="FONT_ICONS[rt.type]||UNKNOWN_FONT_ICON"
        [matTooltip]="rt.type + (rt.name ? (': '+rt.name) : '')"
        matTooltipPosition="right"></mat-icon>
    `
})
export class ItemIcon {
    @Input() item:ItemIfc;

    // built from a distinct query on mdJson.metadata.resourceInfo.resourceType.type
    // so is not future proof
    readonly FONT_ICONS = {
        "project": "fa-product-hunt",
        "report": "fa-book",
        "document": "fa-file-o",
        "dataset": "fa-database",
        "factSheet": "fa-file-o",
        "presentation": "fa-file-powerpoint-o",
        "map": "fa-map-o",
        "publication": "fa-book",
        "collection": "fa-bars",
        "website": "fa-link",
        "Journal": "fa-book",
        "service": "fa-cogs",
        "application": "fa-code",
        "tabularDataset": "fa-table",
        "collectionHardware": "fa-hdd-o",
        "repository": "fa-database",
        "software": "fa-code",
        "model": "fa-lightbulb-o",
        "nonGeographicDataset": "fa-table",
        "product": "fa-shopping-basket",
        "awardInfo": "fa-trophy",
        "geographicDataset": "fa-globe",
        "nonGeographicDataset, report": "fa-book",
        "tile": "fa-file-image-o",
    };

    readonly UNKNOWN_FONT_ICON = 'fa-question-circle-o';
}
