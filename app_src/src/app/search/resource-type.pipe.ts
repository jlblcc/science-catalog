import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'resourceType'})
export class ResourceTypePipe implements PipeTransform {
    transform(resourceType:string,addendum?:string):string {
        let s = '',i = 0,c;
        if(/^non[A-Z]/.test(resourceType)) {
            s = 'Non-' + resourceType.charAt(3);
            i = 4;
        } else {
            s = resourceType.charAt(0).toUpperCase();
            i = 1;
        }
        for(; i < resourceType.length; i++) {
            c = resourceType.charAt(i);
            if(c === c.toUpperCase()) {
                s += ` ${c}`;
            } else {
                s += c;
            }
        }
        return s+(addendum ? `: ${addendum}` : '');
    }
}
