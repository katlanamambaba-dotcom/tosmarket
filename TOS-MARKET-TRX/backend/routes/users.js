const router=require('express').Router();
const db=require('../db');const bcrypt=require('bcryptjs');const jwt=require('jsonwebtoken');const multer=require('multer');const {userAuth}=require('../middleware/user');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024},fileFilter:(req,file,cb)=>cb(null,/^image\/(png|jpe?g|webp)$/.test(file.mimetype))});
function cookie(res,token){res.cookie('tos_user',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*86400000});}
function normalizeEmail(v){return String(v||'').trim().toLowerCase();}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v);}
function userSafe(row){return {id:row.id,nickname:row.nickname,email:row.email||'',display_name:row.display_name};}
router.post('/register',async(req,res)=>{try{
  const nickname=String(req.body.nickname||'').trim();
  const email=normalizeEmail(req.body.email);
  const password=String(req.body.password||'');
  const confirm=String(req.body.confirm_password||'');
  if(!/^[a-zA-Z0-9_]{3,24}$/.test(nickname))return res.status(400).json({error:'Nickname 3-24 karakter olmalı; sadece harf, sayı ve _ kullanılabilir.'});
  if(!validEmail(email)||email.length>255)return res.status(400).json({error:'Geçerli bir e-posta adresi gir.'});
  if(password.length<8||password.length>72)return res.status(400).json({error:'Şifre 8-72 karakter arasında olmalı.'});
  if(confirm&&password!==confirm)return res.status(400).json({error:'Şifreler eşleşmiyor.'});
  const existing=await db.query('SELECT nickname,email FROM users WHERE LOWER(nickname)=LOWER($1) OR LOWER(email)=LOWER($2) LIMIT 1',[nickname,email]);
  if(existing.rows[0])return res.status(409).json({error:existing.rows[0].nickname.toLowerCase()===nickname.toLowerCase()?'Bu nickname zaten alınmış.':'Bu e-posta zaten kayıtlı.'});
  const hash=await bcrypt.hash(password,12);
  const {rows}=await db.query('INSERT INTO users(nickname,email,password_hash,display_name) VALUES($1,$2,$3,$1) RETURNING id,nickname,email,display_name',[nickname.toLowerCase(),email,hash]);
  const token=jwt.sign({id:rows[0].id},process.env.JWT_SECRET,{expiresIn:'30d'});cookie(res,token);res.status(201).json({user:userSafe(rows[0])});
}catch(e){console.error('register:',e.message);res.status(e.code==='23505'?409:400).json({error:e.code==='23505'?'Nickname veya e-posta zaten kayıtlı.':'Kayıt işlemi başarısız.'});}});
router.post('/login',async(req,res)=>{try{
  const identifier=String(req.body.identifier||req.body.nickname||req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
  if(!identifier||!password)return res.status(400).json({error:'E-posta/nickname ve şifre gerekli.'});
  const {rows}=await db.query('SELECT * FROM users WHERE LOWER(nickname)=LOWER($1) OR LOWER(email)=LOWER($1) LIMIT 1',[identifier]);
  if(!rows[0]||!(await bcrypt.compare(password,rows[0].password_hash)))return res.status(401).json({error:'E-posta/nickname veya şifre hatalı.'});
  const token=jwt.sign({id:rows[0].id},process.env.JWT_SECRET,{expiresIn:'30d'});cookie(res,token);res.json({user:userSafe(rows[0])});
}catch(e){console.error('login:',e.message);res.status(500).json({error:'Giriş işlemi başarısız.'});}});
router.post('/logout',(req,res)=>{res.clearCookie('tos_user');res.json({ok:true});});
router.get('/me',userAuth,async(req,res)=>res.json({user:{...req.user,avatar_url:req.user.avatar_mime?`/api/users/avatar/${req.user.id}`:null}}));
router.get('/profile/:nickname',async(req,res)=>{const {rows}=await db.query('SELECT id,nickname,email,display_name,bio,created_at,(avatar_data IS NOT NULL) has_avatar FROM users WHERE nickname=$1',[String(req.params.nickname).toLowerCase()]);if(!rows[0])return res.status(404).json({error:'Profil bulunamadı.'});res.json({profile:{...rows[0],avatar_url:rows[0].has_avatar?`/api/users/avatar/${rows[0].id}`:null}});});
router.get('/avatar/:id',async(req,res)=>{const {rows}=await db.query('SELECT avatar_data,avatar_mime FROM users WHERE id=$1',[req.params.id]);if(!rows[0]?.avatar_data)return res.status(404).end();res.type(rows[0].avatar_mime||'image/png');res.set('Cache-Control','public,max-age=3600');res.send(rows[0].avatar_data);});
router.put('/profile',userAuth,upload.single('avatar'),async(req,res)=>{const displayName=String(req.body.display_name||'').trim().slice(0,60),bio=String(req.body.bio||'').trim().slice(0,500);let sql='UPDATE users SET display_name=$1,bio=$2,updated_at=NOW()';const values=[displayName||req.user.nickname,bio];if(req.file){values.push(req.file.buffer,req.file.mimetype);sql+=`,avatar_data=$3,avatar_mime=$4`;}sql+=' WHERE id=$'+(values.length+1);values.push(req.user.id);await db.query(sql,values);res.json({ok:true});});
module.exports=router;
