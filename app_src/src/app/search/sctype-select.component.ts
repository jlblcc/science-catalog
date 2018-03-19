import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';

import { MatButtonToggleChange } from '@angular/material';

import { SearchService } from './search.service';

@Component({
    selector: 'sctype-select',
    template: `
    <mat-button-toggle-group multiple>
        <mat-button-toggle value="project"
                [checked]="!includeProject"
                (change)="toggle($event)"
                [matTooltip]="projectTT">
            <span class="fa-stack">
                <i class="fa fa-product-hunt fa-stack-1x"></i>
                <i *ngIf="!includeProject" class="fa fa-ban fa-stack-2x"></i>
            </span>
        </mat-button-toggle>
        <mat-button-toggle value="product"
                [checked]="!includeProject"
                (change)="toggle($event)"
                [matTooltip]="productTT">
            <span class="fa-stack">
                <i class="fa fa-shopping-basket fa-stack-1x"></i>
                <i *ngIf="!includeProduct" class="fa fa-ban fa-stack-2x"></i>
            </span>
        </mat-button-toggle>
    </mat-button-toggle-group>
    `
})
export class SctypeSelect {
    control:FormControl;
    includeProject;
    projectTT;
    includeProduct;
    productTT;

    constructor(private search:SearchService) {
        let initial = search.initial,
            scType = initial ? initial.scType : null;
        this.control = new FormControl(scType);
        switch(scType) {
            case 'project':
                this.includeProject = true;
                this.includeProduct = false;
                break;
            case 'product':
                this.includeProject = false;
                this.includeProduct = true;
                break;
            default:
                this.includeProject = true;
                this.includeProduct = true;
                break;
        }
        this.projectTT = `${this.includeProject ? 'Exclude' : 'Include'} projects`;
        this.productTT = `${this.includeProduct ? 'Exclude' : 'Include'} products`;
    }

    toggle(change:MatButtonToggleChange) {
        if(change.value === 'project') {
            if ( !(this.includeProject = !this.includeProject) && !this.includeProduct) {
                this.includeProduct = true;
            }
        } else {
            if( !(this.includeProduct = !this.includeProduct) && !this.includeProject) {
                this.includeProject = true;
            }
        }
        this.projectTT = `${this.includeProject ? 'Exclude' : 'Include'} projects`;
        this.productTT = `${this.includeProduct ? 'Exclude' : 'Include'} products`;
        this.control.setValue((this.includeProject && this.includeProduct) ? null : this.includeProject ? 'project' : 'product');
    }
}
