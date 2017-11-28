import { Component } from '@angular/core';
import { MediaChange, ObservableMedia } from "@angular/flex-layout";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  sideNavMode = 'push';
  sideNavOpen = false;

  constructor(private media:ObservableMedia){
      this.media.subscribe((mediaChange:MediaChange) => {
          console.debug('mediaChange',mediaChange);
          let lg = mediaChange.mqAlias === 'lg' || mediaChange.mqAlias === 'md';
          this.sideNavMode = lg ? 'side' : 'push';
          this.sideNavOpen = lg;
      });
  }
}
