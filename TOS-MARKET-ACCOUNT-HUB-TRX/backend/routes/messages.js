const router=require('express').Router();
const db=require('../db');
const crypto=require('crypto');
const multer=require('multer');
const {adminAuth}=require('../middleware/auth');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>cb(null,/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype))});

router.post('/guest',upload.single('attachment'),async(req,res)=>{
  try{
    const {guestToken,subject='TOS MARKET Destek',body=''}=req.body||{};
    const clean=String(body).trim();
    if(!clean && !req.file)return res.status(400).json({error:'Mesaj veya fotoğraf ekle.'});
    const token=String(guestToken||crypto.randomBytes(24).toString('hex')).slice(0,64);
    const prior=await db.query('SELECT id FROM messages WHERE guest_token=$1 ORDER BY created_at ASC LIMIT 1',[token]);
    const threadId=prior.rows[0]?.id||null;
    const params=[String(subject).slice(0,255),clean.slice(0,5000),threadId,token,req.file?.buffer||null,req.file?.mimetype||null,req.file?.originalname?.slice(0,255)||null];
    const {rows}=await db.query(`INSERT INTO messages(customer_name,customer_email,subject,body,direction,thread_id,is_read,guest_token,attachment_data,attachment_mime,attachment_name) VALUES('Ziyaretçi',NULL,$1,$2,'inbound',$3,FALSE,$4,$5,$6,$7) RETURNING id`,params);
    const rootId=threadId||rows[0].id;
    if(!threadId)await db.query('UPDATE messages SET thread_id=$1 WHERE id=$2',[rootId,rows[0].id]);
    res.status(201).json({messageId:rows[0].id,guestToken:token,threadId:rootId});
  }catch(e){console.error('guest message:',e.message);res.status(400).json({error:'Mesaj gönderilemedi.'});}
});

router.get('/guest',async(req,res)=>{
  try{const token=String(req.query.token||'');if(!token)return res.status(400).json({error:'Destek anahtarı gerekli.'});
  const {rows}=await db.query(`SELECT id,subject,body,direction,is_read,created_at,(attachment_data IS NOT NULL) has_attachment,attachment_name FROM messages WHERE guest_token=$1 OR thread_id IN (SELECT id FROM messages WHERE guest_token=$1) ORDER BY created_at ASC`,[token]);
  await db.query("UPDATE messages SET is_read=TRUE WHERE guest_token=$1 AND direction='outbound'",[token]);
  res.json({messages:rows});}catch(e){res.status(500).json({error:'Destek geçmişi yüklenemedi.'});}
});

router.get('/attachment/:id',async(req,res)=>{try{const token=String(req.query.token||'');const {rows}=await db.query('SELECT attachment_data,attachment_mime,attachment_name,guest_token FROM messages WHERE id=$1',[req.params.id]);const m=rows[0];if(!m?.attachment_data)return res.status(404).end();if(!token||m.guest_token!==token)return res.status(403).end();res.type(m.attachment_mime||'application/octet-stream');res.set('Cache-Control','private,max-age=3600');res.send(m.attachment_data);}catch{res.status(404).end();}});

router.post('/',async(req,res)=>{const {name,email,subject,body}=req.body||{};if(!name||!email||!subject||!body)return res.status(400).json({error:'Alanlar zorunlu.'});const {rows}=await db.query('INSERT INTO messages(customer_name,customer_email,subject,body) VALUES($1,$2,$3,$4) RETURNING id',[name.trim(),email.toLowerCase().trim(),subject.trim(),body.trim()]);res.status(201).json({messageId:rows[0].id});});

router.get('/admin/inbox',adminAuth,async(req,res)=>{const {rows}=await db.query('SELECT id,customer_name,customer_email,subject,body,direction,thread_id,is_read,guest_token,created_at,(attachment_data IS NOT NULL) has_attachment,attachment_name,attachment_mime FROM messages ORDER BY created_at DESC');res.json({messages:rows});});
router.get('/admin/attachment/:id',adminAuth,async(req,res)=>{const {rows}=await db.query('SELECT attachment_data,attachment_mime FROM messages WHERE id=$1',[req.params.id]);const m=rows[0];if(!m?.attachment_data)return res.status(404).end();res.type(m.attachment_mime||'application/octet-stream');res.set('Cache-Control','private,max-age=3600');res.send(m.attachment_data);});

router.post('/admin/reply',adminAuth,async(req,res)=>{const {threadId,email,subject,body,guestToken}=req.body||{};if(!body)return res.status(400).json({error:'Cevap boş olamaz.'});let token=guestToken||null;if(!token&&threadId){const r=await db.query('SELECT guest_token FROM messages WHERE id=$1',[threadId]);token=r.rows[0]?.guest_token||null;}const customerEmail=email?email.trim():null;const {rows}=await db.query(`INSERT INTO messages(customer_name,customer_email,subject,body,direction,thread_id,is_read,guest_token) VALUES('TOS MARKET',$1,$2,$3,'outbound',$4,TRUE,$5) RETURNING id`,[customerEmail,subject||'TOS MARKET Destek',body.trim(),threadId||null,token]);res.json({messageId:rows[0].id,sent:false});});
router.patch('/admin/read/:id',adminAuth,async(req,res)=>{await db.query('UPDATE messages SET is_read=TRUE WHERE id=$1',[req.params.id]);res.json({ok:true});});
module.exports=router;
