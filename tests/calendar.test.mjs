import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule,jsxRuntime,findNode} from './helpers.mjs';

const selectMocks=Object.fromEntries(['Select','SelectContent','SelectGroup','SelectItem','SelectLabel','SelectTrigger','SelectValue'].map(name=>[name,name]));
const {Calendar,CalendarDropdown}=loadModule('app/components/ui/calendar.tsx',{
 react:{},'react/jsx-runtime':jsxRuntime,
 'lucide-react':{ChevronDownIcon:'Down',ChevronLeftIcon:'Left',ChevronRightIcon:'Right'},
 'react-day-picker':{DayPicker:'DayPicker',DayButton:'DayButton',getDefaultClassNames:()=>({})},
 '@/lib/utils':{cn:(...classes)=>classes.filter(Boolean).join(' ')},
 '@/app/components/ui/button':{Button:'Button',buttonVariants:()=> 'button'},
 '@/app/components/ui/select':selectMocks,
 './calendar.module.css':{__esModule:true,default:{calendar:'calendar',dropdownCalendar:'dropdown-calendar',selectTrigger:'calendar-select',options:'calendar-options'}},
});

test('shared calendar preserves single/range callbacks and caller limits without birth-date restrictions',()=>{
 const onSelect=()=>{},single={mode:'single',selected:new Date(2028,0,15),onSelect};
 const tree=Calendar(single);
 assert.equal(tree.props.selected,single.selected);assert.equal(tree.props.onSelect,onSelect);
 assert.equal(tree.props.captionLayout,'label');assert.equal(tree.props.disabled,undefined);assert.equal(tree.props.endMonth,undefined);
 const range={from:new Date(2028,0,15),to:new Date(2028,0,20)},limit=new Date(2030,11,31);
 const ranged=Calendar({mode:'range',captionLayout:'dropdown',selected:range,onSelect,endMonth:limit});
 assert.equal(ranged.props.selected,range);assert.equal(ranged.props.onSelect,onSelect);assert.equal(ranged.props.endMonth,limit);
 assert.equal(ranged.props.navLayout,'after');assert.equal(ranged.props.components.Dropdown,CalendarDropdown);
 const customDropdown=()=>{},custom=Calendar({captionLayout:'dropdown',navLayout:'around',components:{Dropdown:customDropdown}});
 assert.equal(custom.props.navLayout,'around');assert.equal(custom.props.components.Dropdown,customDropdown);
});

test('shared month/year menus preserve values, localized labels and disabled navigation',()=>{
 const changes=[];
 const month=CalendarDropdown({value:0,'aria-label':'Choose the Month',options:[{value:0,label:'Jan',disabled:false},{value:1,label:'Feb',disabled:false},{value:2,label:'Mar',disabled:true}],onChange:event=>changes.push(event.target.value)});
 assert.equal(month.props.value,'0');
 assert.equal(findNode(month,n=>n.type==='SelectTrigger').props['aria-label'],'Choose the Month');
 assert.equal(findNode(month,n=>n.type==='SelectItem'&&n.props.value==='2').props.disabled,true);
 month.props.onValueChange('1');month.props.onValueChange('0');month.props.onValueChange('2');month.props.onValueChange('12');
 assert.deepEqual(changes,['1','0']);
 const year=CalendarDropdown({value:2026,'aria-label':'Wybierz rok',options:[{value:2026,label:'2026',disabled:false},{value:1992,label:'1992',disabled:false}],onChange:event=>changes.push(event.target.value)});
 assert.equal(findNode(year,n=>n.type==='SelectLabel').props.children,'Wybierz rok');
 year.props.onValueChange('1992');assert.deepEqual(changes,['1','0','1992']);
 const disabled=CalendarDropdown({value:0,disabled:true,options:[{value:0,label:'Jan',disabled:false}],onChange:()=>assert.fail('Disabled navigation must not change the month')});
 disabled.props.onValueChange('0');
});
