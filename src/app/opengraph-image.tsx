import {ImageResponse} from 'next/og';
import {getCatalog} from '@/lib/catalog';
export const alt='Awesome Game Security — multilingual resource directory';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function Image(){const catalog=getCatalog();return new ImageResponse(<div style={{width:'100%',height:'100%',background:'#1e1e1e',color:'#d4d4d4',display:'flex',flexDirection:'column',padding:'76px',fontFamily:'sans-serif',justifyContent:'space-between'}}><div style={{display:'flex',color:'#569cd6',fontSize:25,letterSpacing:4}}>AGS / OPEN RESOURCE DIRECTORY</div><div style={{display:'flex',flexDirection:'column'}}><div style={{fontSize:80,fontWeight:700,lineHeight:1.1}}>Awesome</div><div style={{fontSize:80,fontWeight:700,lineHeight:1.1}}>Game Security</div></div><div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #aaa',paddingTop:30,fontSize:25,color:'#aaa'}}><span>{catalog.resources.length.toLocaleString('en')} resources · 10 languages</span><span>gs.awesome.rip</span></div></div>,size);}
