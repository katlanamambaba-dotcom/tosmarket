const router=require('express').Router();
const db=require('../db');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const multer=require('multer');
const crypto=require('crypto');
const nodemailer=require('nodemailer');
const {userAuth}=require('../middleware/user');

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024},fileFilter:(req,file,cb)=>cb(null,/^image\/(png|jpe?g|webp)$/.test(file.mimetype))});
const coverUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024},fileFilter:(req,file,cb)=>cb(null,/^(image\/(png|jpe?g|webp|gif)|video\/(mp4|webm))$/.test(file.mimetype))});
function cookie(res,token){res.cookie('tos_user',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*86400000});}
function normalizeEmail(v){return String(v||'').trim().toLowerCase();}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v);}
const SOCIALS=['instagram','youtube','facebook','discord','tiktok','twitter','snapchat','telegram'];
function safeSocialUrl(v){try{const u=new URL(String(v||'').trim());return ['http:','https:'].includes(u.protocol)?u.toString().slice(0,500):''}catch{return ''}}
function mediaUrl(kind,id,version,mime){const mediaType=String(mime||'').startsWith('video/')?'video':'image';return `/api/users/${kind}/${id}?v=${encodeURIComponent(new Date(version||Date.now()).getTime())}&media=${mediaType}`}
function hashCode(code){return crypto.createHash('sha256').update(String(code)).digest('hex')}
function code6(){return String(crypto.randomInt(100000,1000000))}
function mailReady(){return !!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS)}
function mailer(){return nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'false')==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}})}
async function sendMail(to,subject,html){
 if(!mailReady()) throw new Error('E-posta servisi yapılandırılmamış.');
 const from=process.env.MAIL_FROM||process.env.SMTP_USER;
 await mailer().sendMail({from,to,subject,html,text:html.replace(/<[^>]+>/g,' ')});
}
function emailHtml(title,code,copy){const store=process.env.STORE_PUBLIC_URL||'https://www.tos.quest';return `<!doctype html><html><body style="margin:0;background:#07090c;color:#f4f7fb;font-family:Arial,sans-serif;padding:32px"><div style="max-width:560px;margin:auto;background:#0d1218;border:1px solid #26313d;border-radius:18px;padding:30px"><div style="font-size:22px;font-weight:800;letter-spacing:.04em">TOS MARKET</div><p style="color:#8ea0b3">${title}</p><div style="font-size:36px;font-weight:800;letter-spacing:.18em;background:#07090c;border:1px solid #293441;border-radius:14px;padding:18px;text-align:center;margin:24px 0">${code}</div><p style="color:#b8c2ce;line-height:1.6">${copy}</p><p style="color:#6f7d8c;font-size:12px">${store}</p></div></body></html>`}
function userSafe(row){return {id:row.id,nickname:row.nickname,email:row.email||'',display_name:row.display_name};}

router.post('/register',async(req,res)=>{
 const nickname=String(req.body.nickname||'').trim();const email=normalizeEmail(req.body.email);const password=String(req.body.password||'');const confirm=String(req.body.confirm_password||'');
 if(!/^[a-zA-Z0-9_]{3,24}$/.test(nickname))return res.status(400).json({error:'Nickname 3-24 karakter olmalı; sadece harf, sayı ve _ kullanılabilir.'});
 if(!validEmail(email)||email.length>255)return res.status(400).json({error:'Geçerli bir e-posta adresi gir.'});
 if(password.length<8||password.length>72)return res.status(400).json({error:'Şifre 8-72 karakter arasında olmalı.'});
 if(password!==confirm)return res.status(400).json({error:'Şifreler eşleşmiyor.'});
 if(!mailReady())return res.status(503).json({error:'Kayıt için e-posta doğrulama servisi henüz yapılandırılmadı.'});
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  const existing=await client.query('SELECT nickname,email FROM users WHERE LOWER(nickname)=LOWER($1) OR LOWER(email)=LOWER($2) LIMIT 1',[nickname,email]);
  if(existing.rows[0]){await client.query('ROLLBACK');return res.status(409).json({error:existing.rows[0].nickname.toLowerCase()===nickname.toLowerCase()?'Bu nickname zaten alınmış.':'Bu e-posta zaten kayıtlı.'});}
  const hash=await bcrypt.hash(password,12);const code=code6();const codeHash=hashCode(code);const {rows}=await client.query(`INSERT INTO users(nickname,email,password_hash,display_name,email_verified,email_verification_code_hash,email_verification_expires_at) VALUES($1,$2,$3,$1,FALSE,$4,NOW()+INTERVAL '10 minutes') RETURNING id,nickname,email,display_name`,[nickname.toLowerCase(),email,hash,codeHash]);
  await client.query('INSERT INTO user_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING',[rows[0].id]);
  await client.query('COMMIT');
  try{await sendMail(email,'TOS MARKET e-posta doğrulama kodun',emailHtml('E-posta adresini doğrula',code,'Bu kod 10 dakika geçerlidir. Kodu kimseyle paylaşma.'))}
  catch(e){await db.query('DELETE FROM users WHERE id=$1',[rows[0].id]);return res.status(503).json({error:'Doğrulama e-postası gönderilemedi. E-posta ayarlarını kontrol edin.'});}
  res.status(201).json({requires_verification:true,email});
 }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('register:',e.message);res.status(e.code==='23505'?409:400).json({error:e.code==='23505'?'Nickname veya e-posta zaten kayıtlı.':'Kayıt işlemi başarısız.'})}finally{client.release()}
});

router.post('/verify-email',async(req,res)=>{try{
 const email=normalizeEmail(req.body.email),code=String(req.body.code||'').trim();if(!validEmail(email)||!/^[0-9]{6}$/.test(code))return res.status(400).json({error:'Geçerli e-posta ve 6 haneli kod gerekli.'});
 const {rows}=await db.query('SELECT id,nickname,email,email_verified,email_verification_code_hash,email_verification_expires_at FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1',[email]);const u=rows[0];
 if(!u)return res.status(404).json({error:'Bu e-posta ile kayıtlı hesap bulunamadı.'});if(u.email_verified)return res.json({ok:true,already_verified:true});
 if(!u.email_verification_expires_at||new Date(u.email_verification_expires_at)<new Date())return res.status(410).json({error:'Kodun süresi dolmuş. Yeni kod iste.'});
 if(hashCode(code)!==u.email_verification_code_hash)return res.status(401).json({error:'Doğrulama kodu hatalı.'});
 await db.query('UPDATE users SET email_verified=TRUE,email_verification_code_hash=NULL,email_verification_expires_at=NULL,updated_at=NOW(),last_seen_at=NOW() WHERE id=$1',[u.id]);
 const token=jwt.sign({id:u.id},process.env.JWT_SECRET,{expiresIn:'30d'});cookie(res,token);res.json({ok:true,user:{id:u.id,nickname:u.nickname,email:u.email,display_name:u.nickname}});
}catch(e){console.error('verify-email:',e.message);res.status(500).json({error:'E-posta doğrulanamadı.'})}});

router.post('/resend-verification',async(req,res)=>{try{
 const email=normalizeEmail(req.body.email);if(!validEmail(email))return res.status(400).json({error:'Geçerli bir e-posta gir.'});
 const {rows}=await db.query('SELECT id,email_verified FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1',[email]);if(!rows[0])return res.status(404).json({error:'Bu e-posta ile kayıtlı hesap bulunamadı.'});if(rows[0].email_verified)return res.json({ok:true,already_verified:true});
 const code=code6();await db.query('UPDATE users SET email_verification_code_hash=$1,email_verification_expires_at=NOW()+INTERVAL \'10 minutes\',updated_at=NOW() WHERE id=$2',[hashCode(code),rows[0].id]);await sendMail(email,'TOS MARKET yeni doğrulama kodu',emailHtml('Yeni doğrulama kodun',code,'Bu kod 10 dakika geçerlidir.'));res.json({ok:true})
}catch(e){console.error('resend:',e.message);res.status(503).json({error:'Doğrulama e-postası gönderilemedi.'})}});

router.post('/login',async(req,res)=>{try{
 const identifier=String(req.body.identifier||req.body.nickname||req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');if(!identifier||!password)return res.status(400).json({error:'E-posta/nickname ve şifre gerekli.'});
 const {rows}=await db.query('SELECT * FROM users WHERE LOWER(nickname)=LOWER($1) OR LOWER(email)=LOWER($1) LIMIT 1',[identifier]);
 if(!rows[0]||!(await bcrypt.compare(password,rows[0].password_hash)))return res.status(401).json({error:'E-posta/nickname veya şifre hatalı.'});
 if(rows[0].account_status==='banned')return res.status(403).json({error:'Bu hesap engellenmiş.'});if(rows[0].account_status==='suspended')return res.status(403).json({error:'Bu hesap geçici olarak askıya alınmış.'});
 if(rows[0].email_verified===false)return res.status(403).json({error:'Önce e-posta adresini doğrula.',code:'EMAIL_UNVERIFIED',email:rows[0].email});
 await db.query('UPDATE users SET last_seen_at=NOW() WHERE id=$1',[rows[0].id]);const token=jwt.sign({id:rows[0].id},process.env.JWT_SECRET,{expiresIn:'30d'});cookie(res,token);res.json({user:userSafe(rows[0])});
}catch(e){console.error('login:',e.message);res.status(500).json({error:'Giriş işlemi başarısız.'})}});

router.post('/forgot-password',async(req,res)=>{try{
 const email=normalizeEmail(req.body.email);if(!validEmail(email))return res.status(400).json({error:'Geçerli bir e-posta gir.'});
 const {rows}=await db.query('SELECT id,email,nickname FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1',[email]);
 if(!rows[0])return res.json({ok:true});
 const code=code6();await db.query('UPDATE users SET password_reset_code_hash=$1,password_reset_expires_at=NOW()+INTERVAL \'10 minutes\',updated_at=NOW() WHERE id=$2',[hashCode(code),rows[0].id]);await sendMail(email,'TOS MARKET şifre sıfırlama kodun',emailHtml('Şifreni yenile',code,'Bu kod 10 dakika geçerlidir. Kodla yeni şifreni belirleyebilirsin.'));res.json({ok:true})
}catch(e){console.error('forgot-password:',e.message);res.status(503).json({error:'Şifre sıfırlama e-postası gönderilemedi.'})}});

router.post('/reset-password',async(req,res)=>{try{
 const email=normalizeEmail(req.body.email),code=String(req.body.code||'').trim(),password=String(req.body.password||''),confirm=String(req.body.confirm_password||'');if(!validEmail(email)||!/^[0-9]{6}$/.test(code))return res.status(400).json({error:'E-posta ve 6 haneli kod gerekli.'});if(password.length<8||password.length>72)return res.status(400).json({error:'Yeni şifre 8-72 karakter arasında olmalı.'});if(password!==confirm)return res.status(400).json({error:'Şifreler eşleşmiyor.'});
 const {rows}=await db.query('SELECT id,password_reset_code_hash,password_reset_expires_at FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1',[email]);const u=rows[0];if(!u||!u.password_reset_code_hash)return res.status(401).json({error:'Sıfırlama kodu geçersiz.'});if(new Date(u.password_reset_expires_at)<new Date())return res.status(410).json({error:'Sıfırlama kodunun süresi dolmuş.'});if(hashCode(code)!==u.password_reset_code_hash)return res.status(401).json({error:'Sıfırlama kodu hatalı.'});
 const hash=await bcrypt.hash(password,12);await db.query('UPDATE users SET password_hash=$1,password_reset_code_hash=NULL,password_reset_expires_at=NULL,updated_at=NOW() WHERE id=$2',[hash,u.id]);res.json({ok:true})
}catch(e){console.error('reset-password:',e.message);res.status(500).json({error:'Şifre sıfırlanamadı.'})}});

router.post('/logout',(req,res)=>{res.clearCookie('tos_user');res.json({ok:true})});
router.get('/me',userAuth,async(req,res)=>{const pref=await db.query('SELECT profile_public FROM user_preferences WHERE user_id=$1',[req.user.id]);if(!pref.rows[0])await db.query('INSERT INTO user_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING',[req.user.id]);const socials=await db.query('SELECT platform,url FROM user_socials WHERE user_id=$1 ORDER BY platform',[req.user.id]);res.json({user:{...req.user,avatar_url:req.user.avatar_mime?mediaUrl('avatar',req.user.id,req.user.updated_at,req.user.avatar_mime):null,cover_url:req.user.cover_mime?mediaUrl('cover',req.user.id,req.user.updated_at,req.user.cover_mime):null,profile_public:pref.rows[0]?.profile_public!==false,socials:socials.rows}})});
router.get('/profile/:nickname',async(req,res)=>{const {rows}=await db.query("SELECT id,nickname,display_name,bio,created_at,updated_at,avatar_mime,cover_mime,(avatar_data IS NOT NULL) has_avatar,(cover_data IS NOT NULL) has_cover FROM users WHERE nickname=$1 AND account_status='active' AND email_verified<>FALSE",[String(req.params.nickname).toLowerCase()]);if(!rows[0])return res.status(404).json({error:'Profil bulunamadı.'});const pref=await db.query('SELECT profile_public FROM user_preferences WHERE user_id=$1',[rows[0].id]);if(pref.rows[0]?.profile_public===false)return res.status(404).json({error:'Profil gizli.'});const socials=await db.query('SELECT platform,url FROM user_socials WHERE user_id=$1 ORDER BY platform',[rows[0].id]);res.json({profile:{...rows[0],avatar_url:rows[0].has_avatar?mediaUrl('avatar',rows[0].id,rows[0].updated_at,rows[0].avatar_mime):null,cover_url:rows[0].has_cover?mediaUrl('cover',rows[0].id,rows[0].updated_at,rows[0].cover_mime):null,socials:socials.rows}})});
router.get('/id/:id',async(req,res)=>{const {rows}=await db.query("SELECT id,nickname,display_name,bio,created_at,updated_at,avatar_mime,cover_mime,(avatar_data IS NOT NULL) has_avatar,(cover_data IS NOT NULL) has_cover FROM users WHERE id=$1 AND account_status='active' AND email_verified<>FALSE",[req.params.id]);if(!rows[0])return res.status(404).json({error:'Profil bulunamadı.'});const pref=await db.query('SELECT profile_public FROM user_preferences WHERE user_id=$1',[rows[0].id]);if(pref.rows[0]?.profile_public===false)return res.status(404).json({error:'Profil gizli.'});const socials=await db.query('SELECT platform,url FROM user_socials WHERE user_id=$1 ORDER BY platform',[rows[0].id]);res.json({profile:{...rows[0],avatar_url:rows[0].has_avatar?mediaUrl('avatar',rows[0].id,rows[0].updated_at,rows[0].avatar_mime):null,cover_url:rows[0].has_cover?mediaUrl('cover',rows[0].id,rows[0].updated_at,rows[0].cover_mime):null,socials:socials.rows}})});
router.get('/public/list',async(req,res)=>{const q=String(req.query.q||'').trim().toLowerCase();const vals=[];let where="WHERE u.account_status='active' AND u.email_verified<>FALSE AND COALESCE(up.profile_public,TRUE)=TRUE";if(q){vals.push('%'+q+'%');where+=' AND (LOWER(u.nickname) LIKE $1 OR LOWER(u.display_name) LIKE $1)'}const {rows}=await db.query(`SELECT u.id,u.nickname,u.display_name,u.bio,u.updated_at,(u.avatar_data IS NOT NULL) has_avatar,(u.cover_data IS NOT NULL) has_cover FROM users u LEFT JOIN user_preferences up ON up.user_id=u.id ${where} ORDER BY u.created_at DESC LIMIT 100`,vals);res.json({users:rows.map(u=>({...u,avatar_url:u.has_avatar?mediaUrl('avatar',u.id,u.updated_at,'image/png'):null}))})});
router.get('/cover/:id',async(req,res)=>{const {rows}=await db.query('SELECT cover_data,cover_mime FROM users WHERE id=$1',[req.params.id]);if(!rows[0]?.cover_data)return res.status(404).end();res.type(rows[0].cover_mime||'image/jpeg');res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');res.send(rows[0].cover_data)});
router.delete('/cover',userAuth,async(req,res)=>{await db.query('UPDATE users SET cover_data=NULL,cover_mime=NULL,updated_at=NOW() WHERE id=$1',[req.user.id]);res.json({ok:true})});
router.post('/cover',userAuth,coverUpload.single('cover'),async(req,res)=>{if(!req.file)return res.status(400).json({error:'Geçerli bir GIF, görsel veya MP4/WebM video seç.'});await db.query('UPDATE users SET cover_data=$1,cover_mime=$2,updated_at=NOW() WHERE id=$3',[req.file.buffer,req.file.mimetype,req.user.id]);res.json({ok:true,cover_url:mediaUrl('cover',req.user.id,Date.now(),req.file.mimetype),cover_mime:req.file.mimetype})});
router.get('/avatar/:id',async(req,res)=>{const {rows}=await db.query('SELECT avatar_data,avatar_mime FROM users WHERE id=$1',[req.params.id]);if(!rows[0]?.avatar_data)return res.status(404).end();res.type(rows[0].avatar_mime||'image/png');res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');res.send(rows[0].avatar_data)});
router.delete('/avatar',userAuth,async(req,res)=>{await db.query('UPDATE users SET avatar_data=NULL,avatar_mime=NULL,updated_at=NOW() WHERE id=$1',[req.user.id]);res.json({ok:true})});
router.put('/profile',userAuth,upload.single('avatar'),async(req,res)=>{const displayName=String(req.body.display_name||'').trim().slice(0,60),bio=String(req.body.bio||'').trim().slice(0,500);let sql='UPDATE users SET display_name=$1,bio=$2,updated_at=NOW()';const values=[displayName||req.user.nickname,bio];if(req.file){values.push(req.file.buffer,req.file.mimetype);sql+=`,avatar_data=$3,avatar_mime=$4`;}sql+=' WHERE id=$'+(values.length+1);values.push(req.user.id);await db.query(sql,values);const now=Date.now();res.set('Cache-Control','no-store');res.json({ok:true,avatar_url:req.file?`/api/users/avatar/${req.user.id}?v=${now}`:null,avatar_mime:req.file?.mimetype||null,updated_at:now})});
router.put('/preferences',userAuth,async(req,res)=>{const publicProfile=req.body.profile_public!==false;await db.query('INSERT INTO user_preferences(user_id,profile_public) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET profile_public=EXCLUDED.profile_public,updated_at=NOW()',[req.user.id,publicProfile]);res.json({ok:true,profile_public:publicProfile})});
router.get('/socials',userAuth,async(req,res)=>{const {rows}=await db.query('SELECT platform,url FROM user_socials WHERE user_id=$1 ORDER BY platform',[req.user.id]);res.json({socials:rows})});
router.put('/socials',userAuth,async(req,res)=>{const socials=req.body.socials&&typeof req.body.socials==='object'?req.body.socials:{};const client=await db.connect();try{await client.query('BEGIN');for(const p of SOCIALS){const url=safeSocialUrl(socials[p]);if(url)await client.query('INSERT INTO user_socials(user_id,platform,url) VALUES($1,$2,$3) ON CONFLICT(user_id,platform) DO UPDATE SET url=EXCLUDED.url,updated_at=NOW()',[req.user.id,p,url]);else await client.query('DELETE FROM user_socials WHERE user_id=$1 AND platform=$2',[req.user.id,p]);}await client.query('COMMIT');res.json({ok:true})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:'Sosyal bağlantılar kaydedilemedi.'})}finally{client.release()}});
router.put('/password',userAuth,async(req,res)=>{try{const current=String(req.body.current_password||''),next=String(req.body.new_password||''),confirm=String(req.body.confirm_password||'');if(!current||!next)return res.status(400).json({error:'Mevcut ve yeni şifre gerekli.'});if(next.length<8||next.length>72)return res.status(400).json({error:'Yeni şifre 8-72 karakter arasında olmalı.'});if(next!==confirm)return res.status(400).json({error:'Yeni şifreler eşleşmiyor.'});const {rows}=await db.query('SELECT password_hash FROM users WHERE id=$1',[req.user.id]);if(!rows[0]||!(await bcrypt.compare(current,rows[0].password_hash)))return res.status(401).json({error:'Mevcut şifre hatalı.'});const hash=await bcrypt.hash(next,12);await db.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2',[hash,req.user.id]);res.json({ok:true})}catch(e){console.error('password:',e.message);res.status(500).json({error:'Şifre güncellenemedi.'})}});
module.exports=router;
