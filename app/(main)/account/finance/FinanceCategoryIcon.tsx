import { financeCategoryIcon } from '@/lib/finance-category-icons';

export default function FinanceCategoryIcon({icon,className='size-10'}:{icon?:string|null;className?:string}) {
 const item=financeCategoryIcon(icon);
 if(!item)return null;
 // SVGs are packaged local assets, rendered as images rather than injected markup.
 // eslint-disable-next-line @next/next/no-img-element
 return <img src={item.src} alt="" aria-hidden="true" width={64} height={64} className={`shrink-0 object-contain ${className}`} loading="lazy" decoding="async"/>;
}
