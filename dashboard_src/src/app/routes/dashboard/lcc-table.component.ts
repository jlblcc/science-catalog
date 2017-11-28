import {Component} from '@angular/core';
import {CatalogService,LCCListDataSource} from '../../providers';

// TODO sorting not working
// https://material.angular.io/components/sort/overview, requires passing MatSort
// into data source, etc.
@Component({
    selector: 'lcc-table',
    template: `
    <div class="mat-elevation-z8">
        <mat-table #table [dataSource]="lccs" matSort>

          <ng-container matColumnDef="title">
            <mat-header-cell *matHeaderCellDef mat-sort-header> Title </mat-header-cell>
            <mat-cell *matCellDef="let lcc"> {{lcc.title}} </mat-cell>
          </ng-container>

          <ng-container matColumnDef="_id">
            <mat-header-cell *matHeaderCellDef mat-sort-header> Id </mat-header-cell>
            <mat-cell *matCellDef="let lcc">
            <a target="_blank" [href]="'https://www.sciencebase.gov/catalog/item/'+lcc._id">{{lcc._id}}</a>
            </mat-cell>
          </ng-container>

          <ng-container matColumnDef="projectCount">
            <mat-header-cell *matHeaderCellDef mat-sort-header> Projects </mat-header-cell>
            <mat-cell *matCellDef="let lcc"> {{lcc.projectCount | number}} </mat-cell>
          </ng-container>

          <ng-container matColumnDef="lastSync">
            <mat-header-cell *matHeaderCellDef mat-sort-header> Last Sync </mat-header-cell>
            <mat-cell *matCellDef="let lcc"> {{lcc.lastSync | date:'short'}} </mat-cell>
          </ng-container>

          <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
          <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>
        </mat-table>
    </div>`
})
export class LccTableComponent {
    displayedColumns = ['title','_id','projectCount','lastSync'];
    lccs:LCCListDataSource;

    constructor(private catalog:CatalogService) {}

    ngOnInit() {
        this.lccs = this.catalog.lccsDataSource();
    }
}
