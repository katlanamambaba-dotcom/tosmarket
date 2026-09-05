const jwt=require('jsonwebtoken');
const db=require('../db');
async function loadUser(id){const {rows}=await db.query('SELECT id,nickname,email,display_name,bio,avatar_mime,cover_mime,account_status,created_at FROM users WHERE id=$1',[id]);return rows[0]||null}
async function userAuth(req,res,next){try{const token=req.cookies.tos_user;if(!token||!process.env.JWT_SECRET)return res.status(401).json({error:'Giriş gerekli.'});const p=jwt.verify(token,process.env.JWT_SECRET);const u=await loadUser(p.id);if(!u)return res.status(401).json({error:'Kullanıcı bulunamadı.'});if(u.account_status!=='active')return res.status(403).json({error:'Hesabın askıya alınmış.'});req.user=u;next();}catch{return res.status(401).json({error:'Giriş gerekli.'});}}
async function optionalUserAuth(req,res,next){try{const token=req.cookies.tos_user;if(token&&process.env.JWT_SECRET){const p=jwt.verify(token,process.env.JWT_SECRET);const u=await loadUser(p.id);if(u&&u.account_status==='active')req.user=u;}}catch{}next();}
module.exports={userAuth,optionalUserAuth};
