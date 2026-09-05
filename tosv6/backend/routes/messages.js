const router=require('express').Router();
const db=require('../db');
const crypto=require('crypto');
const {adminAuth}=require('../middleware/auth');

router.post('/guest',async(req,res)=>{
  const {guestToken,subject='TOS MARKET Destek',body}=req.body||{};
  if(!body||String(body).trim().length<1)return res.status(400).json({error:'Mesaj boş olamaz.'});
  const token=String(guestToken||crypto.randomBytes(24).toString('hex')).slice(0,64);
  const {rows}=await db.query(`INSERT INTO messages(customer_name,customer_email,subject,body,direction,thread_id,is_read,guest_token) VALUES('Ziyaretçi',NULL,$1,$2,'inbound',NULL,FALSE,$3) RETURNING id`,[String(subject).slice(0,255),String(body).trim(),token]);
  res.status(201).json({messageId:rows[0].id,guestToken:token});
});

router.get('/guest',async(req,res)=>{
  const token=String(req.query.token||'');
  if(!token)return res.status(400).json({error:'Destek anahtarı gerekli.'});
  const {rows}=await db.query(`SELECT id,subject,body,direction,is_read,created_at FROM messages WHERE guest_token=$1 OR thread_id IN (SELECT id FROM messages WHERE guest_token=$1) ORDER BY created_at ASC`,[token]);
  await db.query("UPDATE messages SET is_read=TRUE WHERE guest_token=$1 AND direction='outbound'",[token]);
  res.json({messages:rows});
});

router.post('/',async(req,res)=>{
  const {name,email,subject,body}=req.body||{};
  if(!name||!email||!subject||!body)return res.status(400).json({error:'Alanlar zorunlu.'});
  const {rows}=await db.query('INSERT INTO messages(customer_name,customer_email,subject,body) VALUES($1,$2,$3,$4) RETURNING id',[name.trim(),email.toLowerCase().trim(),subject.trim(),body.trim()]);
  res.status(201).json({messageId:rows[0].id});
});

router.get('/admin/inbox',adminAuth,async(req,res)=>{const {rows}=await db.query('SELECT id,customer_name,customer_email,subject,body,direction,thread_id,is_read,guest_token,created_at FROM messages ORDER BY created_at DESC');res.json({messages:rows});});

router.post('/admin/reply',adminAuth,async(req,res)=>{
  const {threadId,email,subject,body,guestToken}=req.body||{};
  if(!body)return res.status(400).json({error:'Cevap boş olamaz.'});
  let token=guestToken||null;
  if(!token&&threadId){const r=await db.query('SELECT guest_token FROM messages WHERE id=$1',[threadId]);token=r.rows[0]?.guest_token||null;}
  const customerEmail=email?email.trim():null;
  const {rows}=await db.query(`INSERT INTO messages(customer_name,customer_email,subject,body,direction,thread_id,is_read,guest_token) VALUES('TOS MARKET',$1,$2,$3,'outbound',$4,TRUE,$5) RETURNING id`,[customerEmail,subject||'TOS MARKET Destek',body.trim(),threadId||null,token]);
  res.json({messageId:rows[0].id,sent:false});
});
router.patch('/admin/read/:id',adminAuth,async(req,res)=>{await db.query('UPDATE messages SET is_read=TRUE WHERE id=$1',[req.params.id]);res.json({ok:true});});
module.exports=router;
