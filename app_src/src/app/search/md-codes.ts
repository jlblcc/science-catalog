import { RESOURCE_TYPES as MD_SCOPE_CODE } from '../../../../src/qaqc/resourceTypeCodes';

const mapDescriptionByCode = (map,item) => {
    map[item.codeName] = item.description;
    return map;
};

export const MD_CODES:any = {
    "MD_ScopeCode": MD_SCOPE_CODE.reduce(mapDescriptionByCode,{})
};
