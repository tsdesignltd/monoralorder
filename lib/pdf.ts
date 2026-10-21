import { documentGreeting } from "./document-text";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { pdfFontkit as fontkit } from "./pdf-fontkit";
import { number, money, orderTotals, documentTotals, documentTotal, retailLines, retailSubtotal, invoicePeriodLabel, documentDeliveryRecipient, type Row, type DocumentData } from "./model";

export async function createDocumentPdf(row: Row<DocumentData>, fontBytes: Uint8Array, demo=false, sealBytes?:Uint8Array) {
  const pdf=await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font:PDFFont=await pdf.embedFont(fontBytes,{subset:true});
  const d=row.data, dark=rgb(.08,.08,.08), gray=rgb(.5,.5,.5), light=rgb(.94,.94,.94);
  const docNo=d.order.documentNumber || number(row);
  pdf.setTitle(`${d.type} ${docNo}`);pdf.setAuthor(d.company.name);
  let page=pdf.addPage([595.28,841.89]),y=790;
  const clean=(s:string)=>s.replace(/[\u0000-\u0008\u000b-\u001f]/g,"");
  function wrap(value:string,width:number,size=9) {
    const lines:string[]=[];
    for(const paragraph of clean(value).split("\n")) {
      let line="";
      for(const c of paragraph) { if(line && font.widthOfTextAtSize(line+c,size)>width){lines.push(line);line=c;}else line+=c; }
      lines.push(line);
    }
    return lines;
  }
  function text(value:string,x:number,yy:number,size=9) {page.drawText(clean(value),{x,y:yy,font,size,color:dark});}
  function at(value:string,x:number,yy:number,width:number,size=9) {for(const l of wrap(value,width,size)){text(l,x,yy,size);yy-=size+5;}return yy;}
  function line(yy:number,x1=42,x2=553){page.drawLine({start:{x:x1,y:yy},end:{x:x2,y:yy},color:gray,thickness:.5});}
  function newPage(){page=pdf.addPage([595.28,841.89]);y=788;text(`${d.type}（続き）`,42,y,14);text(`No. ${docNo}`,410,y,9);y-=24;line(y);y-=22;}
  function ensure(h:number){if(y-h<55)newPage();}
  function block(value:string,size=9){for(const l of wrap(value,511,size)){ensure(size+6);text(l,42,y,size);y-=size+6;}}
  const titleSize=24;text(d.type,(595.28-font.widthOfTextAtSize(d.type,titleSize))/2,y,titleSize);y-=30;line(y);y-=22;
  if(demo){text("SAMPLE / 操作確認用",42,y,8);y-=18;}
  const contact=d.customer.contact && (/様$|御中$/.test(d.customer.contact)?d.customer.contact:d.customer.contact+" 様");
  let left=at(d.customer.name+(contact?"":" 御中"),42,y,275,13);
  if(contact)left=at(contact,50,left,267,12);
  if(d.customer.postal)left=at(`〒${d.customer.postal}`,50,left-5,267,9);
  if(d.customer.address)left=at(d.customer.address,50,left,267,9);
  const greeting=documentGreeting(d.type);
  if(greeting)left=at(greeting,42,left-10,275,9);
  const stamped=d.company.name === "アウトデザイン株式会社" && sealBytes;
  if(stamped){
    const seal=await pdf.embedPng(sealBytes);
    const size=seal.scale(60/seal.width);
    page.drawImage(seal,{x:493,y:y+9-size.height,width:size.width,height:size.height});
  }
  const issuerWidth=stamped?145:213;
  let right=at(d.company.name,340,y,issuerWidth,12);
  right=at([d.company.registration&&`登録番号 ${d.company.registration}`,d.company.postal&&`〒${d.company.postal}`,d.company.address,d.company.phone&&`TEL:${d.company.phone}`,d.company.fax&&`FAX:${d.company.fax}`].filter(Boolean).join("\n"),340,right-4,issuerWidth,9);
  y=Math.min(left,right)-24;
  page.drawRectangle({x:42,y:y-17,width:511,height:38,borderColor:dark,borderWidth:.7});
  text("合計金額",53,y-3,15);
  const amount=`${money(documentTotal(d))} -`;text(amount,540-font.widthOfTextAtSize(amount,19),y-3,19);y-=42;
  if(d.monthly)block(`対象期間：${invoicePeriodLabel(d)}`);
  else block(`業務名称：${d.order.businessType}`);
  y-=5;
  const periodTable=!!d.monthly?.startDate;
  const tableRules: {page: typeof page; y: number}[]=[];
  let widths:number[]=[], headings:string[]=[];
  function header(){
    ensure(30);let x=42;
    for(let i=0;i<widths.length;i++){page.drawRectangle({x,y:y-23,width:widths[i],height:23,color:light,borderColor:gray,borderWidth:.4});text(headings[i],x+4,y-15,8);x+=widths[i];}
    y-=23;
    if(periodTable)tableRules.push({page,y});
  }
  function cells(values:string[],opts:{bold?:boolean; shade?:boolean; total?:boolean}={}){
    const all=values.map((v,i)=>wrap(v,widths[i]-8,8));
    const h=Math.max(21,...all.map(ls=>ls.length*12+9));
    if(y-h<55){newPage();header();}
    let x=42;
    for(let i=0;i<widths.length;i++){
      page.drawRectangle({x,y:y-h,width:widths[i],height:h,color:opts.total && i>=widths.length-2?light:opts.shade?light:rgb(1,1,1),borderColor:gray,borderWidth:.35});
      let yy=y-14;for(const l of all[i]){text(l,opts.total && i===widths.length-2?x+widths[i]-8-font.widthOfTextAtSize(l,8):x+4,yy,8);yy-=12;}x+=widths[i];
    }
    y-=h;
    if(opts.total)tableRules.push({page,y});
  }
  if(d.monthly?.startDate){
    widths=[58,48,62,180,28,64,71];headings=["納品書発行日","No.","商品番号","商品名","数量","単価","小計"];header();
    for(const o of d.monthly.orders){
      if(o.order){
        const items=retailLines(o.order);
        items.forEach((i,n)=>cells([n===0?o.date:"",n===0?o.number:"",i.sku,i.name,String(i.qty),money(i.price),money(i.qty*i.price)]));
        if(!items.length)cells([o.date,o.number,"","","","",""]);
        const t=orderTotals(o.order);
        cells(["","","",`仕切率（${o.order.wholesaleRate}%）`,"","",money(t.subtotal)]);
        for(const g of t.groups)cells(["","","",`消費税（${g.rate}%）`,"","",money(g.tax)]);
        cells(["","","","送料（税込）","","",money(t.shipping)]);
        cells(["","","","","","合計",money(o.total)],{total:true});
      }else{
        cells([o.date,o.number,"","","","合計",money(o.total)],{total:true});
      }
    }
  }else{
    widths=[80,214,38,35,73,71];headings=["商品番号","商品名","数量","単位","単価（税抜）","小計"];header();
    for(const i of retailLines(d.order))cells([i.sku,i.name,String(i.qty),i.unit,money(i.price),money(i.qty*i.price)]);
  }
  for(const rule of tableRules)rule.page.drawLine({start:{x:42,y:rule.y},end:{x:553,y:rule.y},color:dark,thickness:1.2});
  y-=16;
  const t=documentTotals(d);
  const summary:[string,number][]=[];
  if(!d.monthly)summary.push(["小計（定価）",retailSubtotal(d.order)]);
  summary.push([d.monthly?"仕切後小計":`仕切率（${d.order.wholesaleRate}%）`,t.subtotal]);
  for(const g of t.groups)summary.push([`消費税（${g.rate}%）`,g.tax]);
  summary.push(["送料（税込）",t.shipping]);
  if(d.monthly?.previousBalance)summary.push(["前回繰越額",d.monthly.previousBalance]);
  if(d.monthly?.payment)summary.push(["入金・相殺額",-d.monthly.payment]);
  summary.push(["合計",documentTotal(d)]);
  ensure(summary.length*23+15);
  const metaY=y;
  const summaryDivider=553-Math.max(65,...summary.map(([,value])=>font.widthOfTextAtSize(money(value),10)+16));
  for(const [label,value] of summary){
    page.drawRectangle({x:315,y:y-20,width:238,height:22,color:label==="合計"?light:rgb(1,1,1),borderColor:gray,borderWidth:.4});
    text(label,summaryDivider-8-font.widthOfTextAtSize(label,9),y-13,9);const v=money(value);text(v,545-font.widthOfTextAtSize(v,10),y-13,10);y-=22;
  }
  page.drawLine({start:{x:summaryDivider,y:metaY+2},end:{x:summaryDivider,y:y+2},color:gray,thickness:.4});
  const dateLabel=d.type==="納品請求書"?"納品・請求書発行日":`${d.type}発行日`;
  let info=at(`${dateLabel}：${d.date}`,42,metaY-12,260,9);
  const numberLabel=d.type==="見積書"?"見積No.":d.type.includes("納品")?"納品No.":"請求書No.";
  info=at(`${numberLabel}：${docNo}`,42,info,260,9);
  if(d.type.includes("納品"))info=at([d.order.dueDate&&`入金予定日：${d.order.dueDate}`,d.order.dispatchDate&&`発送日：${d.order.dispatchDate}`,d.order.carrier&&`運送業者：${d.order.carrier}`].filter(Boolean).join("\n"),42,info,260,9);
  y=Math.min(y,info)-12;
  if(d.type.includes("請求")){
    const bank=[d.company.bank,d.company.note].filter(Boolean).join("\n");
    if(bank){ensure(65);block(bank,9);y-=8;}
  }
  const delivery=documentDeliveryRecipient(d);
  if(delivery){ensure(65);block("納品先",10);block([delivery.name,delivery.postal,delivery.address,delivery.contact].filter(Boolean).join("\n"));y-=10;}
  if(d.order.note){ensure(45);block("メモ",10);block(d.order.note);}
  pdf.getPages().forEach((p,i)=>p.drawText(`${d.company.name} / ${docNo} / ${i+1} / ${pdf.getPageCount()}`,{x:42,y:28,size:8,font,color:gray}));
  return pdf.save();
}
export async function downloadDocumentPdf(
  row: Row<DocumentData>,
  demo = false,
) {
  const response = await fetch("./fonts/NotoSansJP.otf");
  if (!response.ok) throw new Error("PDF用フォントを読み込めません");
  let sealBytes: Uint8Array | undefined;
  if(row.data.company.name === "アウトデザイン株式会社"){
    const seal=await fetch("./brand/outdesign-seal.png");
    if(!seal.ok) throw new Error("印鑑画像を読み込めません。再読み込みしてください");
    sealBytes=new Uint8Array(await seal.arrayBuffer());
  }
  const bytes = await createDocumentPdf(
    row,
    new Uint8Array(await response.arrayBuffer()),
    demo,
    sealBytes,
  );
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${demo ? "SAMPLE-" : ""}${number(row)}-${row.data.type}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
