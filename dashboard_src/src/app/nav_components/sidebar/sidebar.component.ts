import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { MENU, MenuItem, menuItemFromPath } from '../../app-routing.module';


@Component({
    selector: 'dashboard-sidebar',
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
    menu = MENU;
    active:MenuItem;

    constructor(private router:Router) {
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            map((ne:NavigationEnd) => ne.url.substring(1) ) // strip / and
        ).subscribe(path => this.active = menuItemFromPath(path) );
    }
}
