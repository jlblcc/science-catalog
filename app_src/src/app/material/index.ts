import { NgModule } from '@angular/core';

import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatButtonModule,
         MatFormFieldModule,
         MatSelectModule,
         MatCheckboxModule,
         MatProgressSpinnerModule,
         MatListModule,
         MatInputModule,
         MatTableModule,
         MatPaginatorModule,
         MatSortModule } from '@angular/material';

@NgModule({
    imports:[
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,

        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatListModule,
        MatInputModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule
    ],
    exports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,

        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatListModule,
        MatInputModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule
    ]
})
export class MaterialModule {}
