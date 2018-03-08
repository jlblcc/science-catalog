import { NgModule } from '@angular/core';

import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatIconModule,
         MatButtonModule,
         MatFormFieldModule,
         MatSelectModule,
         MatCheckboxModule,
         MatProgressSpinnerModule,
         MatListModule,
         MatInputModule,
         MatTableModule,
         MatPaginatorModule,
         MatSortModule,
         MatButtonToggleModule,
         MatTooltipModule } from '@angular/material';

@NgModule({
    imports:[
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,

        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatListModule,
        MatInputModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatButtonToggleModule,
        MatTooltipModule
    ],
    exports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,

        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatListModule,
        MatInputModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatButtonToggleModule,
        MatTooltipModule
    ]
})
export class MaterialModule {}
