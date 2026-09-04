const router=require('express').Router();
const db=require('../db');
const nodemailer=require('nodemailer');
const crypto=require('crypto');
async function sendMail(to,subject,text){
  if(process.env.RESEND_API_KEY){
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM||'TOS MARKET <info@tos.quest>',to:[to],subject,text})});
    if(!r.ok)throw new Error(`Resend HTTP ${r.status}`);return true;
  }
  if(!process.env.SMTP_HOST)return false;
  const t=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE)==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}});
  await t.sendMail({from:process.env.MAIL_FROM||'info@tos.quest',to,subject,text});return true;
}
router.post('/',async(req,res)=>{
  const {name,email,note='',items=[],paymentMethod='crypto_email'}=req.body;
  if(!['crypto_email','crypto_trc20'].includes(paymentMethod))return res.status(400).json({error:'Geçersiz ödeme yöntemi'});
  if(!name||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Array.isArray(items)||!items.length)return res.status(400).json({error:'Name, valid email and cart items are required'});
  const client=await db.connect();
  try{
    await client.query('BEGIN');let total=0,verified=[];
    for(const item of items){
      const {rows:p}=await client.query('SELECT id,name,price,stock,status FROM products WHERE id=$1 FOR UPDATE',[Number(item.productId)]);
      if(!p[0]||p[0].status!=='active')throw new Error('A product is no longer available');
      const qty=Math.max(1,Math.floor(Number(item.quantity)||1));
      if(qty>p[0].stock)throw new Error(`Not enough stock for ${p[0].name}`);
      total+=Number(p[0].price)*qty;verified.push({id:p[0].id,name:p[0].name,price:Number(p[0].price),qty});
    }
    const paymentToken=crypto.randomBytes(24).toString('hex');
    const {rows:o}=await client.query('INSERT INTO orders(customer_name,customer_email,total,payment_method,note,payment_token) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,payment_token',[name.trim(),email.trim().toLowerCase(),total,paymentMethod,note,paymentToken]);
    for(const x of verified){await client.query('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)',[o[0].id,x.id,x.name,x.qty,x.price]);await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2',[x.qty,x.id]);}
    await client.query('COMMIT');
    const lines=verified.map(x=>`${x.qty} x ${x.name} — ${x.price.toFixed(2)} TL`).join('\n');
    const body=`Yeni TOS MARKET siparişi #${o[0].id}\n\nMüşteri: ${name}\nE-posta: ${email}\nToplam: ${total.toFixed(2)} TL\n\nÜrünler:\n${lines}\n\nNot:\n${note||'-'}\n\nÖdeme yöntemi: E-posta üzerinden kripto\nMüşteriye ödeme bilgilerini yanıt olarak gönder.`;
    let mailed=false;try{mailed=await sendMail(process.env.ADMIN_EMAIL||'info@tos.quest',`TOS MARKET Sipariş #${o[0].id}`,body);}catch(e){console.error('Mail error:',e.message)}
    res.status(201).json({orderId:o[0].id,total,paymentMethod,paymentToken:o[0].payment_token,adminEmail:process.env.ADMIN_EMAIL||'info@tos.quest',mailed});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'Checkout failed'});}finally{client.release();}
});
router.get('/:id',async(req,res)=>{const {rows:o}=await db.query('SELECT * FROM orders WHERE id=$1',[req.params.id]);if(!o[0])return res.status(404).json({error:'Order not found'});const {rows:items}=await db.query('SELECT product_name,quantity,unit_price FROM order_items WHERE order_id=$1',[req.params.id]);res.json({order:o[0],items});});
module.exports=router;
