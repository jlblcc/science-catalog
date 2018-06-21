import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'lccTitle'})
export class LccTitlePipe implements PipeTransform {
    transform(value: any,joinWith?:string) {
        if(value instanceof Array) {
            return (value as string[]).map(v => v.replace(/Landscape Conservation Cooperative$/,'LCC')).join(joinWith||', ');
        }
        return value ? value.replace(/Landscape Conservation Cooperative$/,'LCC') : value;
    }
}
