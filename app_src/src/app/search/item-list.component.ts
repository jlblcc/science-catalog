import { Component, Input } from '@angular/core';

@Component({
    selector: 'item-list',
    template: `
    <mat-list>
        <mat-list-item *ngFor="let item of dataSource.data">
            <h4 mat-line><highlight-text [text]="item.simplified.title" [highlight]="highlight"></highlight-text></h4>
            <h5 mat-line>{{item.simplified.lcc | lccTitle}}</h5>
            <p mat-line><highlight-text [text]="item.simplified.abstract" [highlight]="highlight"></highlight-text></p>
        </mat-list-item>
    </mat-list>
    `
})
export class ItemList {
    @Input() highlight:string[];
    @Input() dataSource;
}
