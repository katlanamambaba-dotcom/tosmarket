const router=require('express').Router();
const db=require('../db');
const crypto=require('crypto');
const {userAuth,optionalUserAuth}=require('../middleware/user');
router.post('/',optionalUserAuth,async(req,res)=>{
  const {items=[],paymentMethod='crypto_trx',nickname}=req.body||{};
  if(paymentMethod!=='crypto_trx')return res.status(400).json({error:'Şu anda yalnızca TRX / TRON ödeme aktiftir.'});
  if(!Array.isArray(items)||!items.length)return res.status(400).json({error:'Sepet boş.'});
  const client=await db.connect();
  try{await client.query('BEGIN');let total=0,verified=[];for(const item of items){const {rows:p}=await client.query('SELECT id,name,description,price,stock,status FROM products WHERE id=$1 FOR UPDATE',[Number(item.productId)]);if(!p[0]||p[0].status!=='active')throw new Error('Bir ürün artık satışta değil.');const qty=Math.max(1,Math.floor(Number(item.quantity)||1));if(qty>p[0].stock)throw new Error(`Yeterli stok yok: ${p[0].name}`);total+=Number(p[0].price)*qty;verified.push({id:p[0].id,name:p[0].name,price:Number(p[0].price),qty});}
    const paymentToken=crypto.randomBytes(32).toString('hex');const userId=req.user?.id||null;const safeNick=userId?req.user.nickname:(String(nickname||'Misafir').trim().slice(0,40)||'Misafir');
    const {rows:o}=await client.query(`INSERT INTO orders(customer_name,customer_email,total,payment_method,note,payment_token,user_id,customer_nickname) VALUES($1,NULL,$2,'crypto_trx','',$3,$4,$5) RETURNING id,payment_token,total,created_at`,[safeNick,total,paymentToken,userId,safeNick]);
    for(const x of verified){await client.query('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)',[o[0].id,x.id,x.name,x.qty,x.price]);await client.query('UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2',[x.qty,x.id]);}
    await client.query(`INSERT INTO messages(customer_name,customer_email,subject,body,direction,thread_id,user_id,order_id,is_read) VALUES('TOS MARKET',$1,$2,$3,'outbound',NULL,$4,$5,TRUE)`,[userId?req.user.display_name||req.user.nickname:safeNick,userId?req.user.email:null,'Sipariş #'+o[0].id,'Siparişiniz oluşturuldu. Ödeme ve teslimat süreciyle ilgili bu sipariş üzerinden TOS MARKET ekibiyle mesajlaşabilirsiniz.',userId,o[0].id]);
    await client.query('UPDATE messages SET thread_id=id WHERE order_id=$1 AND thread_id IS NULL',[o[0].id]);
    if(userId)await client.query(`INSERT INTO auth_logs(user_id,action,details) VALUES($1,'order_created',$2)`,[userId,'Sipariş #'+o[0].id+' oluşturuldu']);
    await client.query('COMMIT');res.status(201).json({orderId:o[0].id,total:Number(o[0].total),paymentMethod,paymentToken:o[0].payment_token});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'Sipariş oluşturulamadı.'});}finally{client.release();}
});
router.get('/mine/list',userAuth,async(req,res)=>{const {rows}=await db.query('SELECT id,total,status,payment_method,created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[req.user.id]);res.json({orders:rows.map(x=>({...x,total:Number(x.total)}))});});
router.get('/:id',async(req,res)=>{const token=String(req.query.token||'');if(!token)return res.status(401).json({error:'Sipariş erişim anahtarı gerekli.'});const {rows:o}=await db.query('SELECT id,total,status,payment_method,payment_token,created_at,customer_nickname,user_id FROM orders WHERE id=$1 AND payment_token=$2',[req.params.id,token]);if(!o[0])return res.status(404).json({error:'Sipariş bulunamadı.'});const {rows:items}=await db.query(`SELECT oi.product_id,oi.product_name,oi.quantity,oi.unit_price,p.delivery_text FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1`,[req.params.id]);const delivery=items.filter(x=>x.delivery_text).map(x=>({product:x.product_name,content:x.delivery_text}));res.json({order:{...o[0],total:Number(o[0].total)},items,delivery});});
module.exports=router;
