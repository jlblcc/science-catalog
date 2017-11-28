import {Component} from '@angular/core';
@Component({
    template: `
    <div class="dashboard-container">
        <lcc-table></lcc-table>
        <project-status-report></project-status-report>
    </div>
    `
})
export class DashboardComponent {}
