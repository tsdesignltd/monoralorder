import { money, type Order, type Row } from '../lib/model';
export default function LegacySaleView({row,customer,onClose}:{row:Row<Order>;customer:string;onClose:()=>void}) {
 const d=row.data.legacy!;
 return <div className="overlay"><section className="modal wide" role="dialog" aria-modal="true" aria-label="過去の販売伝票"><div className="modal-header"><h2>旧伝票 {d.legacyInvoiceNumber}</h2><button onClick={onClose}>閉じる</button></div><div style={{padding:24,overflow:'auto'}}>
 <p>FileMakerから移行した履歴です。元の金額を保持し、編集・再請求の対象から除外しています。</p>
 <p>顧客：{customer}　／　業務：{row.data.businessType}</p>
 {!d.legacyCustomerId && <p className="error">要確認：元伝票の顧客番号が空欄です。</p>}
 <p>納品日：{d.deliveryDate}　請求日：{d.invoiceDate || '未記入'}　入金日：{d.paymentDate || '未記入'}</p>
 <div className="table-wrap"><table><thead><tr><th>商品コード・名称</th><th>数量</th><th>元単価</th><th>元明細金額</th><th>備考</th></tr></thead><tbody>{d.items.map((item,i)=><tr key={i}><td>{item.sku}<br/>{item.name}</td><td>{item.quantity ?? '未記入（要確認）'} {item.unit}</td><td>{money(item.unitPrice)}</td><td>{money(item.amount)}</td><td>{item.description}</td></tr>)}</tbody></table></div>
 <p>元小計：{money(d.retailSubtotal)}　仕切率：{row.data.wholesaleRate}%　仕切後小計：{money(d.wholesaleSubtotal)}</p>
 <p>消費税：{money(d.tax)}　{d.shippingLabel || '送料'}：{d.shipping===null?'未記入':money(d.shipping)}</p>
 <h3>元の請求金額：{money(d.invoiceTotal)}</h3>
 </div></section></div>;
}
