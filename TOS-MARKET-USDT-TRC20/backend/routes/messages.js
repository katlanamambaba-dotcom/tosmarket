const router=require('express').Router();
const db=require('../db');
const nodemailer=require('nodemailer');
const {adminAuth}=require('../middleware/auth');
async function mail(to,subject,text){
  if(process.env.RESEND_API_KEY){const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM||'TOS MARKET <info@tos.quest>',to:[to],subject,text})});if(!r.ok)throw new Error(`Resend HTTP ${r.status}`);return true;}
  if(!process.env.SMTP_HOST)return false;const t=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE)==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}});await t.sendMail({from:process.env.MAIL_FROM||'info@tos.quest',to,subject,text});return true;
}
router.post('/',async(req,res)=>{const {name,email,subject,body}=req.body;if(!name||!email||!subject||!body)return res.status(400).json({error:'All fields are required'});const {rows}=await db.query('INSERT INTO messages(customer_name,customer_email,subject,body) VALUES($1,$2,$3,$4) RETURNING id',[name.trim(),email.toLowerCase().trim(),subject.trim(),body.trim()]);let sent=false;try{sent=await mail(process.env.ADMIN_EMAIL||'info@tos.quest',`TOS MARKET message: ${subject}`,`From: ${name} <${email}>\n\n${body}`);}catch(e){console.error('Mail error:',e.message)}res.status(201).json({messageId:rows[0].id,sent});});
router.get('/admin/inbox',adminAuth,async(req,res)=>{const {rows}=await db.query('SELECT id,customer_name,customer_email,subject,body,direction,thread_id,is_read,created_at FROM messages ORDER BY created_at DESC');res.json({messages:rows});});
router.post('/admin/reply',adminAuth,async(req,res)=>{const {threadId,email,subject,body}=req.body;if(!email||!body)return res.status(400).json({error:'Email and message are required'});const {rows}=await db.query(`INSERT INTO messages(customer_name,customer_email,subject,body,direction,thread_id,is_read) VALUES($1,$2,$3,$4,'outbound',$5,TRUE) RETURNING id`,['TOS MARKET',email.trim(),subject||'Reply from TOS MARKET',body.trim(),threadId||null]);let sent=false;try{sent=await mail(email.trim(),subject||'Reply from TOS MARKET',body.trim());}catch(e){console.error('Mail error:',e.message)}res.json({messageId:rows[0].id,sent});});
router.patch('/admin/read/:id',adminAuth,async(req,res)=>{await db.query('UPDATE messages SET is_read=TRUE WHERE id=$1',[req.params.id]);res.json({ok:true});});
module.exports=router;
