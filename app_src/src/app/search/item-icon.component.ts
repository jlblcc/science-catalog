import { Component, Input } from '@angular/core';

import { ItemIfc } from '../../../../src/db/models';

@Component({
    selector: 'item-icon',
    template: `<mat-icon [fontIcon]="item.scType === 'project' ? 'fa-product-hunt' : 'fa-shopping-basket'" [matTooltip]='item.scType'></mat-icon>`
})
export class ItemIcon {
    @Input() item:ItemIfc;
}
