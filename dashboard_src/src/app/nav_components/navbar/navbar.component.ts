import { Component, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { MenuItem, menuItemFromPath } from '../../app-routing.module';

@Component({
    selector: 'dashboard-navbar',
    templateUrl: './navbar.component.html',
    styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
    @Output()
    onToggleSidebar = new EventEmitter<void>();

    active:MenuItem;

    constructor(private router:Router) {
        this.router.events.pipe(
            filter(e => e instanceof NavigationEnd),
            map((ne:NavigationEnd) => ne.url.substring(1) ) // strip / and
        ).subscribe(path => this.active = menuItemFromPath(path) );
    }

    toggleSidebar() {
        this.onToggleSidebar.emit();
    }
}
