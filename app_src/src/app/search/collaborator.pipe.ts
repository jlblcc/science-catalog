import { Pipe, PipeTransform } from '@angular/core';

const ABBREVIATIONS = {
    'lcc': 'LCC',
    'ngo': 'NGO'
};

@Pipe({name: 'collaborator'})
export class CollaboratorPipe implements PipeTransform {
    transform(collab:string):string {
        if(ABBREVIATIONS[collab]) {
            return ABBREVIATIONS[collab];
        }
        let s = '',i,c;
        for(i = 0; i < collab.length; i++) {
            c = collab.charAt(i);
            if(i === 0) {
                s += c.toUpperCase();
            } else if(/[A-Z]/.test(c)) { // doesn't happen
                s += ` ${c}`;
            } else {
                s += c;
            }
        }
        return s;
    }
}
