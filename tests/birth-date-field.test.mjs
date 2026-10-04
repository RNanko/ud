import test from 'node:test';
import assert from 'node:assert/strict';
import {format,parseISO} from 'date-fns';
import {loadModule,hookHarness,jsxRuntime,findNode} from './helpers.mjs';

test('typed birth dates accept a valid calendar day, reject rollover and future dates, and preserve calendar strings',()=>{
 const dates=loadModule('lib/account/birth-date.ts');
 for(const [input,expected] of [['29/02/1992','1992-02-29'],['25.03.1990','1990-03-25'],['1990-03-25','1990-03-25'],['29/02/1991',''],['31/04/1990',''],['01/01/2099',''],['25/10/1990','1990-10-25'],['29/03/1990','1990-03-29'],['2/2/1990',''],['','']])assert.equal(dates.birthDateFromInput(input),expected);
 assert.equal(dates.birthDateInputValue('1992-02-29'),'29/02/1992');
 assert.equal(dates.birthDateInputValue(''),'');
});

test('birth-date calendar and typing update the same canonical value, while invalid input stays editable',()=>{
 const harness=hookHarness();let value='';
 const BirthDate=loadModule('app/components/shared/account/BirthDateField.tsx',{
  react:{...harness.react,useId:()=> 'birth-date'},'react/jsx-runtime':jsxRuntime,'lucide-react':{CalendarDays:'CalendarIcon'},'date-fns':{format,parseISO},'react-day-picker/locale':{enGB:{}},
  '@/app/components/ui/input':{Input:'Input'},'@/app/components/ui/calendar':{Calendar:'Calendar'},'@/app/components/ui/popover':{Popover:'Popover',PopoverContent:'PopoverContent',PopoverTrigger:'PopoverTrigger'},
 },{}).default;
 const render=()=>harness.render(()=>BirthDate({value,onChange:next=>{value=next;}}));
 let tree=render();const calendar=findNode(tree,n=>n.type==='Calendar');
 assert.equal(calendar.props.selected,undefined);
 assert.equal(calendar.props.captionLayout,'dropdown');
 assert.equal(calendar.props.disabled.after.getTime(),calendar.props.today.getTime());
 findNode(tree,n=>n.type==='Input').props.onChange({target:{value:'31/02/1992'}});
 assert.equal(value,'');tree=render();findNode(tree,n=>n.type==='Input').props.onBlur();tree=render();
 assert.equal(findNode(tree,n=>n.type==='Input').props.value,'31/02/1992');
 assert.equal(findNode(tree,n=>n.props?.role==='alert').props.id,'birth-date-error');
 findNode(tree,n=>n.type==='Calendar').props.onSelect(parseISO('1992-02-29'));
 assert.equal(value,'1992-02-29');tree=render();
 assert.equal(findNode(tree,n=>n.type==='Input').props.value,'29/02/1992');
 assert.equal(findNode(tree,n=>n.props?.role==='alert'),undefined);
 assert.equal(findNode(tree,n=>n.type==='Popover').props.open,false);
 findNode(tree,n=>n.type==='Calendar').props.onSelect(parseISO('2099-01-01'));
 assert.equal(value,'1992-02-29');
 findNode(tree,n=>n.type==='Input').props.onChange({target:{value:'25/10/1990'}});
 assert.equal(value,'1990-10-25');
});
