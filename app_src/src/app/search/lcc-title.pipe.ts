import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'lccTitle'})
export class LccTitlePipe implements PipeTransform {
    transform(value:string) {
        return value ?
            value.replace(/Landscape Conservation Cooperative$/,'') : value;
    }
}
