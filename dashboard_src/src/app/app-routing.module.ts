import { NgModule } from '@angular/core';
import { Route, Routes, RouterModule } from '@angular/router';

import { StylePreviewComponent } from './style_preview';

import { DashboardComponent } from './routes/dashboard';

export class MenuItem {
    title: string;
    icon?: string;
    route?: Route;
    children?: MenuItem[];
    expanded?:boolean;
    defaultRoute?:boolean;
}

const STYLES_ROUTE:Route = {
    path: 'styles',
    component: StylePreviewComponent
};
const DASHBOARD_ROUTE:Route = {
    path: 'dashboard',
    component: DashboardComponent
};
const TODO_ROUTE:Route = STYLES_ROUTE;

export const MENU:MenuItem = {
    title: 'Dashboard',
    icon: 'tachometer',
    route: DASHBOARD_ROUTE,
    defaultRoute: true,
    children:[/*{
        title: 'Results reporting',
        expanded: true,
        children:[{
            title: 'Report on results',
            expanded: true,
            children:[{
                title: 'Daily hunter log',
                icon: 'th-list',
                route: HUNTER_ROUTE // TODO
            },{
                title: 'Program participation',
                icon: 'user',
                route: PARTICIPATION_ROUTE // TODO
            },{
                title: 'Visitor count',
                icon: 'users',
                route: VISITOR_COUNT_ROUTE // TODO
            }]
        },{
            title: 'Display results',
            expanded: true,
            children:[{
                title: 'Refuge results',
                icon: 'line-chart',
                route: REF_RESULTS_ROUTE // TODO
            },{
                title: 'Regional results',
                icon: 'bar-chart',
                route: REG_RESULTS_ROUTE // TODO
            }]
        }]
    },*/{
        title: 'Development',
        children:[{
            title: 'Misc',
            expanded: true,
            children:[{
                title: 'Styles',
                icon: 'paint-brush',
                route: STYLES_ROUTE
            }]
        }]
    }]
};
function reduceMenu(item:MenuItem,items:any):any {
    if(item.defaultRoute) {
        items.defaultRoute = item;
    }
    if(item.route) {
        items.paths = items.paths||{};
        items.paths[item.route.path] = item;
    }
    (item.children||[]).forEach(i => reduceMenu(i,items));
    return items;
}
const ROUTE_MENU_ITEMS = reduceMenu(MENU,{});

export function menuItemFromPath(path:string) {
    return !path ? ROUTE_MENU_ITEMS.defaultRoute : ROUTE_MENU_ITEMS.paths[path];
}


const routes: Routes = [{
    path: '',
    component: DashboardComponent
},
DASHBOARD_ROUTE,
STYLES_ROUTE];

@NgModule({
  imports: [RouterModule.forRoot(routes,{useHash: true})],
  exports: [RouterModule]
})
export class AppRoutingModule { }
