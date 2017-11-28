import { Component } from '@angular/core';

@Component({
    selector: 'progress-style',
    template: `
    <mat-card>
        <mat-card-title>Progress</mat-card-title>
        <mat-card-content>
            <mat-progress-bar mode="indeterminate" color="primary"></mat-progress-bar>
            <mat-progress-bar mode="indeterminate" color="accent"></mat-progress-bar>
            <mat-progress-bar mode="indeterminate" color="warn"></mat-progress-bar>
            <mat-spinner color="primary"></mat-spinner>
            <mat-spinner color="accent"></mat-spinner>
            <mat-spinner color="warn"></mat-spinner>
        </mat-card-content>
    </mat-card>
    `,
    styles:[`
        mat-progress-bar,
        mat-spinner {
            margin-bottom: 10px;
        }
    `]
})
export class ProgressComponent {}
