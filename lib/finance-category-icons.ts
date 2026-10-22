import catalog from './finance-category-icons.json';
export const financeCategoryIcons=catalog;
const icons=new Map(catalog.map(icon=>[icon.id,icon]));
export const isFinanceCategoryIcon=(value:string)=>icons.has(value);
export const financeCategoryIcon=(value:string|null|undefined)=>value?icons.get(value):undefined;
