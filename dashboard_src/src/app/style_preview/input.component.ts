import { Component } from '@angular/core';

@Component({
    selector: 'input-style',
    template: `
    <mat-card>
        <mat-card-title>Input</mat-card-title>
        <mat-card-content>
            <mat-checkbox>Accent (default)</mat-checkbox>
            <mat-checkbox color="primary">Primary</mat-checkbox>
            <mat-checkbox color="warn">Warn</mat-checkbox>
            <mat-form-field>
                <input matInput placeholder="Primary (default)" />
            </mat-form-field>
            <mat-form-field color="accent">
                <input matInput placeholder="Accent" />
            </mat-form-field>
            <mat-form-field color="warn">
                <input matInput placeholder="Warn" />
            </mat-form-field>
        </mat-card-content>
    </mat-card>
    `,
    styles: [`
        mat-checkbox {
            margin-right: 10px;
        }
        mat-form-field {
            display: block;
        }
    `]
})
export class InputComponent {}
