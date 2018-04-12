import { Component, Input } from '@angular/core';
import { ItemIfc } from '../../../../src/db/models';

@Component({
    selector: 'item-date',
    template: `
    <span *ngIf="item.simplified.dates && item.simplified.dates.sort">{{item.simplified.dates.sort | date:'MM/dd/yyyy'}}</span>
    `
})
export class ItemDate {
    @Input() item:ItemIfc;
}
