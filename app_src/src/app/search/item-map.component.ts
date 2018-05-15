import { Component, Input } from '@angular/core';
import { MatSort, Sort, MatSortable, MatSelectChange, SortDirection } from '@angular/material';
import {} from '@types/googlemaps';
import { MapsAPILoader } from '@agm/core';

import { SearchService } from './search.service';
import { ItemList } from './item-list.component';

@Component({
    selector: 'item-map',
    template: `
    <div class="sort-controls">
        <mat-form-field class="sort-column">
            <mat-select (selectionChange)="sortChange()" [(value)]="sort.active">
                <mat-option *ngFor="let c of tableColumns" [value]="c.property">{{c.label}}</mat-option>
            </mat-select>
            <span matPrefix>Sort by:&nbsp;</span>
        </mat-form-field>
        <mat-button-toggle class="sort-direction-toggle"
            [checked]="sortDescending"
            matTooltip="Change sort direction"
            (change)="sortDirectionChange()">
            <mat-icon [fontIcon]="sortDescending ? 'fa-arrow-down' :'fa-arrow-up'"></mat-icon>
        </mat-button-toggle>
    </div>
    <agm-map [latitude]="latitude" [longitude]="longitude" [zoom]="zoom"
        mapTypeId="satellite"
        [fitBounds]="markerBounds"
        [mapTypeControl]="mapTypeControl"
        [streetViewControl]="false" [scrollwheel]="false" [styles]="mapStyles">
        <agm-marker *ngFor="let item of dataSource.data"
            [title]="item.simplified.title"
            [latitude]="item?.simplified?.extent?.representativePoint?.coordinates[1]"
            [longitude]="item?.simplified?.extent?.representativePoint?.coordinates[0]"
            [iconUrl]="item.scType==='project' ? 'http://maps.google.com/mapfiles/ms/micons/purple-dot.png' : 'http://maps.google.com/mapfiles/ms/micons/blue-dot.png'">
            <agm-info-window>
                <item-teaser [item]="item" [highlight]="highlight"></item-teaser>
            </agm-info-window>
        </agm-marker>
    </agm-map>
    `,
    styles:[`
        agm-map {
            width: 100%;
            height: 500px;
        }
    `]
})
export class ItemMap extends ItemList /* for common sort functionality */ {
    latitude:number = 50.523804;
    longitude:number = -101.329257;
    zoom:number = 3;
    mapTypeControl:boolean = true;
    mapStyles:any[] = [{
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{visibility:'on'}]
            },{
                featureType: 'transit.station',
                elementType: 'labels',
                stylers: [{visibility:'off'}]
            },
            {
                featureType: 'poi.park',
                stylers: [{ visibility: 'off'}]
            },
            {
                featureType: 'landscape',
                stylers: [{ visibility: 'on'}]
            }];
    markerBounds:google.maps.LatLngBounds;

    constructor(protected search:SearchService,private mapsApiLoader:MapsAPILoader) {
        super(search);
    }

    cData:any;
    ngDoCheck() {
        if(this.cData !== this.dataSource.data) {
            this.cData = this.dataSource.data;
            if(this.cData.length) {
                setTimeout(() => {
                    this.mapsApiLoader.load()
                        .then(() => {
                            if(this.cData.length === 1) {
                                // if just a single marker than make the bounding box span a single degree
                                // surrounding the marker
                                const item = this.cData[0],
                                      lat = item.simplified.extent.representativePoint.coordinates[1],
                                      lng = item.simplified.extent.representativePoint.coordinates[0],
                                      delta = 0.5;
                                this.markerBounds = new google.maps.LatLngBounds();
                                this.markerBounds.extend(new google.maps.LatLng(
                                    lat + delta,
                                    lng + delta
                                ));
                                this.markerBounds.extend(new google.maps.LatLng(
                                    lat - delta,
                                    lng - delta
                                ));
                            } else {
                                this.markerBounds = new google.maps.LatLngBounds();
                                (this.cData||[])
                                // only necessary for that second when switching from list/table to map
                                .filter(item => !!item.simplified.extent)
                                .forEach(item => {
                                    const latLng = new google.maps.LatLng(
                                        item.simplified.extent.representativePoint.coordinates[1],
                                        item.simplified.extent.representativePoint.coordinates[0]
                                    );
                                    this.markerBounds.extend(latLng);
                                });
                            }
                        });
                });
            }
        }
    }
}
